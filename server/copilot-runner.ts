import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { getAgentTemplateBody, getSkillBody, getSkills } from './config-reader.ts'
import { getAdapter, type LineHandlers } from './cli-adapters.ts'
import { getPolicy, getSandboxCwd } from './cli-policy.ts'
import type { AgentConfig, MemoryLink, ServerMessage } from './types.ts'

const MAX_PARALLEL = 8
/** Tiempo máximo por agente antes de abortar (ms). */
const AGENT_TIMEOUT_MS = 180_000

type Send = (msg: ServerMessage) => void

/**
 * Última respuesta de cada agente, a nivel de módulo (persiste entre rondas
 * porque se crea un OfficeRunner nuevo por request). Es la "memoria" que los
 * agentes enlazados comparten: en la ronda siguiente, cada agente recibe las
 * respuestas anteriores de sus compañeros de grupo.
 */
const lastAnswers = new Map<string, string>()

/** Contexto compartido por el grupo de memoria al que pertenece un agente. */
interface SharedContext {
  /** Unión de las skills de todos los miembros del grupo. */
  skillIds: string[]
  /** Respuestas anteriores de los compañeros de grupo. */
  partners: { name: string; text: string }[]
}

/**
 * Construye el prompt completo de un agente: persona (plantilla) + skills +
 * (memoria compartida del grupo) + instrucción de brevedad + la pregunta. Los
 * CLIs no exponen un flag de "system prompt", así que inyectamos el contexto en
 * el propio prompt.
 */
function buildPrompt(agent: AgentConfig, userPrompt: string, shared?: SharedContext): string {
  const parts: string[] = []

  const persona = getAgentTemplateBody(agent.agentFile)
  if (persona) parts.push(persona)

  const skillNames = new Map(getSkills().map((s) => [s.id, s.name]))
  const skillIds = shared && shared.skillIds.length > 0 ? shared.skillIds : agent.skills
  for (const skillId of skillIds) {
    const body = getSkillBody(skillId)
    if (body) parts.push(`## Skill: ${skillNames.get(skillId) ?? skillId}\n${body}`)
  }

  if (shared && shared.partners.length > 0) {
    const mem = shared.partners.map((p) => `${p.name}: ${p.text}`).join('\n\n')
    parts.push(
      '## Memoria compartida del equipo\n' +
        'Compañeros con los que compartes memoria respondieron en la ronda ' +
        `anterior:\n\n${mem}\n\nTenlo en cuenta al elaborar tu respuesta.`,
    )
    // TODO: compartir también los MCPs de los agentes enlazados (pendiente).
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

/**
 * Calcula los grupos de memoria (componentes conexos del grafo de enlaces) y
 * devuelve, para cada id de agente, la lista de miembros de su grupo (incluido
 * él mismo). Ids fuera de `agentIds` se ignoran.
 */
export function computeGroupMembers(agentIds: string[], links: MemoryLink[]): Map<string, string[]> {
  const parent = new Map(agentIds.map((id) => [id, id]))
  const find = (x: string): string => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r)!
    // Compresión de caminos.
    let c = x
    while (parent.get(c) !== r) {
      const next = parent.get(c)!
      parent.set(c, r)
      c = next
    }
    return r
  }
  const idSet = new Set(agentIds)
  for (const [a, b] of links) {
    if (!idSet.has(a) || !idSet.has(b)) continue
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  const byRoot = new Map<string, string[]>()
  for (const id of agentIds) {
    const root = find(id)
    const list = byRoot.get(root) ?? []
    list.push(id)
    byRoot.set(root, list)
  }
  const memberMap = new Map<string, string[]>()
  for (const members of byRoot.values()) {
    for (const id of members) memberMap.set(id, members)
  }
  return memberMap
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
 * Orquesta una ronda de ejecución: lanza un proceso por agente (según su CLI:
 * copilot, claude u opencode), traduce la salida a actualizaciones de estado y
 * permite cancelar. Solo una ronda activa a la vez.
 */
export class OfficeRunner {
  private running = new Map<string, AgentProcess>()

  get isRunning(): boolean {
    return this.running.size > 0
  }

  /** Lanza la ronda. Resuelve cuando todos los agentes han terminado. */
  async run(agents: AgentConfig[], prompt: string, send: Send, links: MemoryLink[] = []): Promise<void> {
    if (this.isRunning) this.cancel()

    const batch = agents.slice(0, MAX_PARALLEL)
    send({ type: 'run-started', agentIds: batch.map((a) => a.id) })

    // Purga la memoria de agentes que ya no están en el equipo (evita fugas).
    const teamIds = new Set(agents.map((a) => a.id))
    for (const id of lastAnswers.keys()) {
      if (!teamIds.has(id)) lastAnswers.delete(id)
    }

    const byId = new Map(batch.map((a) => [a.id, a]))
    const memberMap = computeGroupMembers(batch.map((a) => a.id), links)

    await Promise.all(
      batch.map((agent) => {
        const members = memberMap.get(agent.id) ?? [agent.id]
        const skillIds = [...new Set(members.flatMap((id) => byId.get(id)?.skills ?? []))]
        const partners = members
          .filter((id) => id !== agent.id)
          .map((id) => ({ name: byId.get(id)?.name ?? id, text: lastAnswers.get(id) ?? '' }))
          .filter((p) => p.text.trim() !== '')
        return this.runOne(agent, prompt, send, { skillIds, partners })
      }),
    )

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

  private runOne(agent: AgentConfig, prompt: string, send: Send, shared: SharedContext): Promise<void> {
    return new Promise<void>((resolve) => {
      send({ type: 'agent-update', agentId: agent.id, status: 'starting' })

      const adapter = getAdapter(agent.cli)
      const policy = getPolicy(agent.cli)
      const fullPrompt = buildPrompt(agent, prompt, shared)
      // Args funcionales + flags de seguridad (solo-lectura) de la política.
      const args = [...adapter.runArgs(fullPrompt, agent.model), ...policy.readOnlyArgs]

      let child: ChildProcessWithoutNullStreams
      try {
        child = spawn(adapter.bin, args, {
          cwd: policy.isolateCwd ? getSandboxCwd() : process.cwd(),
          env: { ...process.env, ...policy.env },
        })
      } catch (err) {
        send({
          type: 'agent-update',
          agentId: agent.id,
          status: 'error',
          error: `No se pudo iniciar ${adapter.bin}: ${(err as Error).message}`,
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

      const handlers: LineHandlers = {
        setThinking: () => send({ type: 'agent-update', agentId: agent.id, status: 'thinking' }),
        setResponding: (text) =>
          send({ type: 'agent-update', agentId: agent.id, status: 'responding', text }),
        addUsageAic: (aic) =>
          send({
            type: 'agent-usage',
            agentId: agent.id,
            aic,
            outputTokens: proc.outputTokens,
            inputTokens: proc.inputTokens,
          }),
        fatal: (error) => {
          if (proc.settled) return
          proc.settled = true
          clearTimeout(proc.timer)
          send({ type: 'agent-update', agentId: agent.id, status: 'error', error })
          proc.child.kill('SIGTERM')
        },
      }

      // CLIs no-streaming (claude/opencode): no hay eventos por línea, así que
      // marcamos "thinking" al arrancar; el texto llega de una vez al cerrar.
      if (!adapter.onLine) handlers.setThinking()

      let stdoutBuf = ''
      let fullStdout = ''
      let stderrBuf = ''

      child.stdout.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        fullStdout += chunk
        if (!adapter.onLine) return
        stdoutBuf += chunk
        let nl: number
        while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
          const line = stdoutBuf.slice(0, nl).trim()
          stdoutBuf = stdoutBuf.slice(nl + 1)
          if (line) adapter.onLine(line, proc, handlers)
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
          error: `Error al ejecutar ${adapter.bin}: ${err.message}`,
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
          const text = adapter.finalText(fullStdout, proc).trim()
          lastAnswers.set(agent.id, text)
          send({ type: 'agent-update', agentId: agent.id, status: 'finished', text })
          if (adapter.finalUsage) {
            const u = adapter.finalUsage(fullStdout, proc)
            if (u) {
              send({
                type: 'agent-usage',
                agentId: agent.id,
                aic: u.aic,
                outputTokens: u.outputTokens,
                inputTokens: u.inputTokens,
              })
            }
          }
        } else {
          const detail = this.extractError(stderrBuf) || `${adapter.bin} salió con código ${code}.`
          send({ type: 'agent-update', agentId: agent.id, status: 'error', error: detail })
        }
        finish()
      })
    })
  }

  /** Intenta extraer un mensaje de error legible de stderr. */
  private extractError(stderr: string): string {
    const errLine = stderr.split('\n').find((l) => /error/i.test(l))
    return errLine?.trim() || stderr.trim().split('\n').slice(-1)[0]?.trim() || ''
  }
}
