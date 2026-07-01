import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { getAgentTemplateBody, getSkillBody, getSkills } from './config-reader.ts'
import type { AgentConfig, ServerMessage } from './types.ts'

const MAX_PARALLEL = 8
/** Tiempo máximo por agente antes de abortar (ms). */
const AGENT_TIMEOUT_MS = 180_000

type Send = (msg: ServerMessage) => void

/**
 * Construye el prompt completo de un agente: persona (plantilla) + skills +
 * instrucción de brevedad + la pregunta del usuario. Copilot CLI no expone un
 * flag de "system prompt", así que inyectamos el contexto en el propio prompt.
 */
function buildPrompt(agent: AgentConfig, userPrompt: string): string {
  const parts: string[] = []

  const persona = getAgentTemplateBody(agent.agentFile)
  if (persona) parts.push(persona)

  const skillNames = new Map(getSkills().map((s) => [s.id, s.name]))
  for (const skillId of agent.skills) {
    const body = getSkillBody(skillId)
    if (body) parts.push(`## Skill: ${skillNames.get(skillId) ?? skillId}\n${body}`)
  }

  parts.push(
    'Responde de forma MUY BREVE y compacta: 2 o 3 frases como máximo, en ' +
      'texto plano y conversacional. No uses listas, ni numeración, ni markdown ' +
      '(nada de **, #, viñetas). Sin preámbulos ni saludos. No explores archivos ' +
      'ni ejecutes herramientas; responde solo con tu opinión experta.',
  )
  parts.push(`Pregunta:\n${userPrompt}`)

  return parts.join('\n\n')
}

/** Estado interno de un proceso de agente en curso. */
interface AgentProcess {
  child: ChildProcessWithoutNullStreams
  timer: ReturnType<typeof setTimeout>
  finalText: string
  /** Ids de mensajes de razonamiento (su contenido NO es la respuesta). */
  reasoningMessageIds: Set<string>
  outputTokens: number
  inputTokens: number
  settled: boolean
}

/**
 * Orquesta una ronda de ejecución: lanza un proceso `copilot -p` por agente,
 * traduce los eventos JSONL a actualizaciones de estado y permite cancelar.
 * Solo una ronda activa a la vez.
 */
export class OfficeRunner {
  private running = new Map<string, AgentProcess>()

  get isRunning(): boolean {
    return this.running.size > 0
  }

  /** Lanza la ronda. Resuelve cuando todos los agentes han terminado. */
  async run(agents: AgentConfig[], prompt: string, send: Send): Promise<void> {
    if (this.isRunning) this.cancel()

    const batch = agents.slice(0, MAX_PARALLEL)
    send({ type: 'run-started', agentIds: batch.map((a) => a.id) })

    await Promise.all(batch.map((agent) => this.runOne(agent, prompt, send)))

    send({ type: 'run-finished' })
  }

  /** Cancela la ronda actual matando todos los procesos vivos. */
  cancel(): void {
    for (const [, proc] of this.running) {
      proc.settled = true
      clearTimeout(proc.timer)
      proc.child.kill('SIGTERM')
      // Garantía: si no muere en 2s, forzar.
      setTimeout(() => {
        if (!proc.child.killed) proc.child.kill('SIGKILL')
      }, 2000)
    }
    this.running.clear()
  }

  private runOne(agent: AgentConfig, prompt: string, send: Send): Promise<void> {
    return new Promise<void>((resolve) => {
      send({ type: 'agent-update', agentId: agent.id, status: 'starting' })

      const fullPrompt = buildPrompt(agent, prompt)
      const args = [
        '-p', fullPrompt,
        '--model', agent.model,
        '--output-format', 'json',
        '--allow-all-tools',
        '--no-custom-instructions',
        '--no-color',
        // Q&A puro: bloqueamos edición de archivos y shell (la app no edita).
        '--deny-tool', 'write',
        '--deny-tool', 'shell',
      ]

      let child: ChildProcessWithoutNullStreams
      try {
        child = spawn('copilot', args, { cwd: process.cwd() })
      } catch (err) {
        send({
          type: 'agent-update',
          agentId: agent.id,
          status: 'error',
          error: `No se pudo iniciar Copilot CLI: ${(err as Error).message}`,
        })
        resolve()
        return
      }

      const proc: AgentProcess = {
        child,
        finalText: '',
        reasoningMessageIds: new Set(),
        outputTokens: 0,
        inputTokens: 0,
        settled: false,
        timer: setTimeout(() => {
          if (!proc.settled) {
            proc.settled = true
            child.kill('SIGTERM')
            send({
              type: 'agent-update',
              agentId: agent.id,
              status: 'error',
              error: 'Tiempo de espera agotado.',
            })
            finish()
          }
        }, AGENT_TIMEOUT_MS),
      }
      this.running.set(agent.id, proc)

      const finish = () => {
        clearTimeout(proc.timer)
        this.running.delete(agent.id)
        resolve()
      }

      let stdoutBuf = ''
      let stderrBuf = ''

      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdoutBuf += chunk
        let nl: number
        while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
          const line = stdoutBuf.slice(0, nl).trim()
          stdoutBuf = stdoutBuf.slice(nl + 1)
          if (line) this.handleLine(line, agent.id, proc, send)
        }
      })

      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => {
        stderrBuf += chunk
      })

      child.on('error', (err) => {
        if (proc.settled) return
        proc.settled = true
        send({
          type: 'agent-update',
          agentId: agent.id,
          status: 'error',
          error: `Error al ejecutar Copilot CLI: ${err.message}`,
        })
        finish()
      })

      child.on('close', (code) => {
        if (proc.settled) {
          finish()
          return
        }
        proc.settled = true
        if (code === 0) {
          send({
            type: 'agent-update',
            agentId: agent.id,
            status: 'finished',
            text: proc.finalText.trim(),
          })
        } else {
          const detail = this.extractError(stderrBuf) || `Copilot CLI salió con código ${code}.`
          send({ type: 'agent-update', agentId: agent.id, status: 'error', error: detail })
        }
        finish()
      })
    })
  }

  /** Procesa una línea JSONL de Copilot y emite el estado correspondiente. */
  private handleLine(line: string, agentId: string, proc: AgentProcess, send: Send): void {
    // Líneas de error no-JSON (p.ej. "Error: Model ... is not available.")
    if (!line.startsWith('{')) {
      if (/^Error:/i.test(line)) {
        proc.settled = true
        clearTimeout(proc.timer)
        send({
          type: 'agent-update',
          agentId,
          status: 'error',
          error: line.replace(/^Error:\s*/i, ''),
        })
        proc.child.kill('SIGTERM')
      }
      return
    }

    let evt: any
    try {
      evt = JSON.parse(line)
    } catch {
      return
    }

    // El contenido de razonamiento llega por eventos assistant.reasoning*, y la
    // respuesta por assistant.message*. NO filtramos por `phase` (no es fiable:
    // gpt-5.x lo incluye como "final_answer" pero claude no lo emite). Solo
    // tratamos `phase: "reasoning"` como excepción a ignorar.
    switch (evt.type) {
      case 'assistant.turn_start':
        send({ type: 'agent-update', agentId, status: 'thinking' })
        break

      case 'assistant.message_start':
        if (evt.data?.messageId) {
          if (evt.data?.phase === 'reasoning') {
            proc.reasoningMessageIds.add(evt.data.messageId)
          } else {
            send({ type: 'agent-update', agentId, status: 'responding', text: proc.finalText })
          }
        }
        break

      case 'assistant.message_delta':
        if (evt.data?.messageId && !proc.reasoningMessageIds.has(evt.data.messageId)) {
          proc.finalText += evt.data.deltaContent ?? ''
          send({ type: 'agent-update', agentId, status: 'responding', text: proc.finalText })
        }
        break

      case 'assistant.message':
        if (
          typeof evt.data?.content === 'string' &&
          evt.data?.phase !== 'reasoning' &&
          !(evt.data?.messageId && proc.reasoningMessageIds.has(evt.data.messageId))
        ) {
          proc.finalText = evt.data.content
          send({ type: 'agent-update', agentId, status: 'responding', text: proc.finalText })
        }
        if (typeof evt.data?.outputTokens === 'number') {
          proc.outputTokens += evt.data.outputTokens
        }
        if (typeof evt.data?.inputTokens === 'number') {
          proc.inputTokens += evt.data.inputTokens
        }
        break

      case 'result': {
        const aic = typeof evt.usage?.premiumRequests === 'number' ? evt.usage.premiumRequests : 0
        send({ type: 'agent-usage', agentId, aic, outputTokens: proc.outputTokens, inputTokens: proc.inputTokens })
        break
      }

      default:
        break
    }
  }

  /** Intenta extraer un mensaje de error legible de stderr. */
  private extractError(stderr: string): string {
    const errLine = stderr.split('\n').find((l) => /error/i.test(l))
    return errLine?.trim() || stderr.trim().split('\n').slice(-1)[0]?.trim() || ''
  }
}
