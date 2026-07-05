import { spawn } from 'node:child_process'
import type { AgentCli } from './types.ts'

/**
 * Adaptadores por CLI de agente. Centralizan lo específico de cada binario
 * (nombre, flags, formato de salida) para que el runner sea agnóstico. Antes
 * el nombre "copilot" y sus flags estaban hardcodeados; ahora cada agente
 * elige su CLI (agent.cli) y aquí vive la traducción.
 *
 * - copilot: emite JSONL en streaming (eventos assistant.* / result) → damos
 *   actualizaciones token a token.
 * - claude / opencode: se ejecutan en modo no-streaming (respuesta final de una
 *   vez); el estado va de "thinking" a "finished" sin texto incremental. Los
 *   flags exactos pueden variar entre versiones: el chequeo de disponibilidad
 *   (`--version`) es la fuente de verdad de si el CLI está instalado.
 */

/** Estado mutable de un proceso en curso, compartido con el adaptador. */
export interface AgentProcState {
  finalText: string
  /** Ids de mensajes de razonamiento (su contenido NO es la respuesta). */
  reasoningMessageIds: Set<string>
  outputTokens: number
  inputTokens: number
}

/** Callbacks que el adaptador invoca al procesar una línea de stdout. */
export interface LineHandlers {
  setThinking(): void
  setResponding(text: string): void
  addUsageAic(aic: number): void
  /** Error terminal detectado en la salida: marca error y mata el proceso. */
  fatal(error: string): void
}

/** Uso (tokens/AIC) resuelto al cerrar, para CLIs no-streaming. */
export interface FinalUsage {
  aic: number
  inputTokens: number
  outputTokens: number
}

export interface CliAdapter {
  id: AgentCli
  /** Binario a ejecutar (en PATH). */
  bin: string
  /** Argumentos para lanzar una consulta con prompt+modelo. */
  runArgs(prompt: string, model: string): string[]
  /**
   * Procesa una línea de stdout en streaming (updates en vivo). Solo para CLIs
   * que emiten eventos línea a línea (copilot). Ausente = no-streaming.
   */
  onLine?(line: string, state: AgentProcState, h: LineHandlers): void
  /** Texto final definitivo cuando el proceso cierra con código 0. */
  finalText(stdout: string, state: AgentProcState): string
  /** Uso final para CLIs no-streaming (copilot lo emite vía onLine → null). */
  finalUsage?(stdout: string, state: AgentProcState): FinalUsage | null
  /** Argumentos para comprobar disponibilidad (normalmente --version). */
  versionArgs: string[]
}

/** Quita secuencias de escape ANSI de una salida de terminal. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\[[0-9;]*m/g, '')
}

/** Extrae el primer objeto JSON balanceado de un texto (o null). */
function firstJsonObject(raw: string): unknown {
  const start = raw.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

// ---- Copilot (streaming JSONL) ----

const copilotAdapter: CliAdapter = {
  id: 'copilot',
  bin: 'copilot',
  versionArgs: ['--version'],
  runArgs(prompt, model) {
    return [
      '-p', prompt,
      '--model', model,
      '--output-format', 'json',
      '--allow-all-tools',
      '--no-custom-instructions',
      '--no-color',
      // Q&A puro: bloqueamos edición de archivos y shell (la app no edita).
      '--deny-tool', 'write',
      '--deny-tool', 'shell',
    ]
  },
  onLine(line, state, h) {
    // Líneas de error no-JSON (p.ej. "Error: Model ... is not available.")
    if (!line.startsWith('{')) {
      if (/^Error:/i.test(line)) h.fatal(line.replace(/^Error:\s*/i, ''))
      return
    }

    let evt: any
    try {
      evt = JSON.parse(line)
    } catch {
      return
    }

    // El razonamiento llega por eventos assistant.reasoning* / phase reasoning y
    // NO es la respuesta; la respuesta va por assistant.message*.
    switch (evt.type) {
      case 'assistant.turn_start':
        h.setThinking()
        break

      case 'assistant.message_start':
        if (evt.data?.messageId) {
          if (evt.data?.phase === 'reasoning') {
            state.reasoningMessageIds.add(evt.data.messageId)
          } else {
            h.setResponding(state.finalText)
          }
        }
        break

      case 'assistant.message_delta':
        if (evt.data?.messageId && !state.reasoningMessageIds.has(evt.data.messageId)) {
          state.finalText += evt.data.deltaContent ?? ''
          h.setResponding(state.finalText)
        }
        break

      case 'assistant.message':
        if (
          typeof evt.data?.content === 'string' &&
          evt.data?.phase !== 'reasoning' &&
          !(evt.data?.messageId && state.reasoningMessageIds.has(evt.data.messageId))
        ) {
          state.finalText = evt.data.content
          h.setResponding(state.finalText)
        }
        if (typeof evt.data?.outputTokens === 'number') state.outputTokens += evt.data.outputTokens
        if (typeof evt.data?.inputTokens === 'number') state.inputTokens += evt.data.inputTokens
        break

      case 'result': {
        const aic = typeof evt.usage?.premiumRequests === 'number' ? evt.usage.premiumRequests : 0
        h.addUsageAic(aic)
        break
      }

      default:
        break
    }
  },
  finalText(_stdout, state) {
    return state.finalText
  },
}

// ---- Claude Code (no-streaming, JSON final) ----

const claudeAdapter: CliAdapter = {
  id: 'claude',
  bin: 'claude',
  versionArgs: ['--version'],
  runArgs(prompt, model) {
    const args = ['-p', prompt, '--output-format', 'json', '--permission-mode', 'plan']
    if (model && model !== 'auto') args.push('--model', model)
    return args
  },
  finalText(stdout) {
    const obj = firstJsonObject(stdout) as { result?: unknown } | null
    if (obj && typeof obj.result === 'string') return obj.result
    return stripAnsi(stdout).trim()
  },
  finalUsage(stdout) {
    const obj = firstJsonObject(stdout) as
      | { usage?: { input_tokens?: number; output_tokens?: number } }
      | null
    const input = obj?.usage?.input_tokens
    const output = obj?.usage?.output_tokens
    if (typeof input !== 'number' && typeof output !== 'number') return null
    return { aic: 0, inputTokens: input ?? 0, outputTokens: output ?? 0 }
  },
}

// ---- opencode (no-streaming, texto plano) ----

const opencodeAdapter: CliAdapter = {
  id: 'opencode',
  bin: 'opencode',
  versionArgs: ['--version'],
  runArgs(prompt, model) {
    const args = ['run', prompt]
    if (model && model !== 'auto') args.push('--model', model)
    return args
  },
  finalText(stdout) {
    return stripAnsi(stdout).trim()
  },
}

const ADAPTERS: Record<AgentCli, CliAdapter> = {
  copilot: copilotAdapter,
  claude: claudeAdapter,
  opencode: opencodeAdapter,
}

/** Adaptador para un CLI dado (copilot por defecto si el id no se reconoce). */
export function getAdapter(cli: AgentCli | undefined): CliAdapter {
  return ADAPTERS[cli as AgentCli] ?? copilotAdapter
}

/** Ids de CLI soportados. */
export const CLI_IDS: AgentCli[] = ['copilot', 'claude', 'opencode']

export interface AvailabilityResult {
  cli: AgentCli
  available: boolean
  version?: string
  error?: string
}

const CHECK_TIMEOUT_MS = 10_000

/**
 * Comprueba si el binario de un CLI está disponible ejecutando `<bin> --version`.
 * Resuelve siempre (nunca rechaza): available:false con mensaje si no se puede
 * ejecutar o sale con error.
 */
export function checkAvailability(cli: AgentCli): Promise<AvailabilityResult> {
  const adapter = getAdapter(cli)
  return new Promise((resolve) => {
    let settled = false
    let out = ''
    let err = ''
    const done = (r: Omit<AvailabilityResult, 'cli'>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!child.killed) child.kill('SIGTERM')
      resolve({ cli, ...r })
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(adapter.bin, adapter.versionArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      resolve({ cli, available: false, error: (e as Error).message })
      return
    }

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (c: string) => (out += c))
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (c: string) => (err += c))

    child.on('error', (e) =>
      done({ available: false, error: `No se pudo ejecutar ${adapter.bin}: ${e.message}` }),
    )
    child.on('close', (code) => {
      if (code === 0) {
        const version = stripAnsi(out || err).trim().split('\n')[0] || undefined
        done({ available: true, version })
      } else {
        done({
          available: false,
          error: stripAnsi(err || out).trim().split('\n')[0] || `${adapter.bin} salió con código ${code}`,
        })
      }
    })

    const timer = setTimeout(() => done({ available: false, error: 'Tiempo de espera agotado.' }), CHECK_TIMEOUT_MS)
  })
}

/** Comprueba todos los CLIs y devuelve un mapa id → disponibilidad. */
export async function checkAllAvailability(): Promise<Record<AgentCli, AvailabilityResult>> {
  const results = await Promise.all(CLI_IDS.map((c) => checkAvailability(c)))
  return Object.fromEntries(results.map((r) => [r.cli, r])) as Record<AgentCli, AvailabilityResult>
}

/**
 * Ejecuta una consulta puntual (no-streaming) contra un CLI y resuelve con el
 * texto final. Reutiliza el mismo parseo de cada adaptador que el runner.
 * Pensado para tareas one-off (p.ej. síntesis del equipo). Rechaza si el
 * proceso no arranca, sale con error o agota el timeout.
 */
export function runOnce(cli: AgentCli, prompt: string, model = 'auto', timeoutMs = 60_000): Promise<string> {
  const adapter = getAdapter(cli)
  return new Promise((resolve, reject) => {
    const state: AgentProcState = { finalText: '', reasoningMessageIds: new Set(), outputTokens: 0, inputTokens: 0 }
    let full = ''
    let stderrOut = ''
    let stdoutBuf = ''
    let settled = false
    let fatalErr: string | null = null

    const handlers: LineHandlers = {
      setThinking() {},
      setResponding(text) {
        state.finalText = text
      },
      addUsageAic() {},
      fatal(error) {
        fatalErr = error
      },
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(adapter.bin, adapter.runArgs(prompt, model), { cwd: process.cwd() })
    } catch (e) {
      reject(new Error(`No se pudo iniciar ${adapter.bin}: ${(e as Error).message}`))
      return
    }

    const finish = (err: Error | null, value?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!child.killed) child.kill('SIGTERM')
      if (err) reject(err)
      else resolve(value ?? '')
    }

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      full += chunk
      if (!adapter.onLine) return
      stdoutBuf += chunk
      let nl: number
      while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
        const line = stdoutBuf.slice(0, nl).trim()
        stdoutBuf = stdoutBuf.slice(nl + 1)
        if (line) adapter.onLine(line, state, handlers)
      }
    })
    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (c: string) => (stderrOut += c))

    child.on('error', (e) => finish(new Error(`No se pudo ejecutar ${adapter.bin}: ${e.message}`)))
    child.on('close', (code) => {
      if (fatalErr) return finish(new Error(fatalErr))
      if (code === 0) finish(null, adapter.finalText(full, state).trim())
      else finish(new Error(stderrOut.trim().split('\n').slice(-1)[0] || `${adapter.bin} salió con código ${code}`))
    })

    const timer = setTimeout(() => finish(new Error('Tiempo de espera agotado.')), timeoutMs)
  })
}
