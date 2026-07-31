import { useCallback, useReducer, useRef, useState } from 'react'
import type { AgentRuntime, ServerMessage } from '../types'

export interface RunEntry {
  /** Número de ronda (1, 2, 3…). Identidad estable de la entrada. */
  id: number
  aic: number
  tokens: number
  prompt: string
}

export interface RunState {
  agents: Record<string, AgentRuntime>
  totalAic: number
  totalTokens: number
  requestCount: number
  runHistory: RunEntry[]
}

const EMPTY: AgentRuntime = { status: 'idle', text: '', aic: 0, inputTokens: 0, outputTokens: 0, startedAt: null, elapsedMs: null }

/** Estados en los que el agente está ocupado (el cronómetro corre). */
const WORKING_STATUSES = new Set(['starting', 'thinking', 'responding'])
/** Estados terminales (fijan la duración final). */
const DONE_STATUSES = new Set(['finished', 'error'])

type AgentUpdate = Extract<ServerMessage, { type: 'agent-update' }>
type AgentUsage = Extract<ServerMessage, { type: 'agent-usage' }>

type Action =
  | { type: 'reset'; ids: string[]; prompt: string }
  | { type: 'event'; msg: ServerMessage }

/** Arranca una ronda: pone todos los agentes a cero y abre una entrada de historial. */
function applyReset(state: RunState, ids: string[], prompt: string): RunState {
  const agents: Record<string, AgentRuntime> = {}
  for (const id of ids) agents[id] = EMPTY
  const round = state.requestCount + 1
  return {
    ...state,
    agents,
    requestCount: round,
    runHistory: [...state.runHistory, { id: round, aic: 0, tokens: 0, prompt }],
  }
}

/** Cambio de estado/texto de un agente, llevando la cuenta de su duración. */
function applyAgentUpdate(state: RunState, msg: AgentUpdate): RunState {
  const prev = state.agents[msg.agentId] ?? EMPTY
  const startedAt = prev.startedAt ?? (WORKING_STATUSES.has(msg.status) ? Date.now() : null)
  const finished = DONE_STATUSES.has(msg.status) && startedAt !== null

  return {
    ...state,
    agents: {
      ...state.agents,
      [msg.agentId]: {
        ...prev,
        status: msg.status,
        text: msg.text ?? prev.text,
        error: msg.error,
        startedAt,
        elapsedMs: finished ? Date.now() - startedAt : prev.elapsedMs,
      },
    },
  }
}

/** Consumo reportado por un agente: suma al total, a la ronda en curso y al agente. */
function applyAgentUsage(state: RunState, msg: AgentUsage): RunState {
  const prev = state.agents[msg.agentId] ?? EMPTY
  const runTokens = msg.inputTokens + msg.outputTokens
  const last = state.runHistory.length - 1

  return {
    ...state,
    totalAic: state.totalAic + msg.aic,
    totalTokens: state.totalTokens + runTokens,
    runHistory: state.runHistory.map((r, i) =>
      i === last ? { ...r, aic: r.aic + msg.aic, tokens: r.tokens + runTokens } : r
    ),
    agents: {
      ...state.agents,
      [msg.agentId]: {
        ...prev,
        aic: prev.aic + msg.aic,
        inputTokens: prev.inputTokens + msg.inputTokens,
        outputTokens: prev.outputTokens + msg.outputTokens,
      },
    },
  }
}

export function reducer(state: RunState, action: Action): RunState {
  if (action.type === 'reset') return applyReset(state, action.ids, action.prompt)

  const msg = action.msg
  if (msg.type === 'agent-update') return applyAgentUpdate(state, msg)
  if (msg.type === 'agent-usage') return applyAgentUsage(state, msg)
  return state
}

const INIT: RunState = { agents: {}, totalAic: 0, totalTokens: 0, requestCount: 0, runHistory: [] }

/** Separa las líneas completas del buffer y devuelve el resto sin terminar. */
function takeLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n')
  return { lines: parts.slice(0, -1), rest: parts.at(-1) ?? '' }
}

/** Entrega una línea NDJSON; ignora las vacías y el ruido no-JSON. */
function dispatchLine(line: string, onMessage: (msg: ServerMessage) => void): void {
  const trimmed = line.trim()
  if (!trimmed) return
  try {
    onMessage(JSON.parse(trimmed) as ServerMessage)
  } catch {
    /* línea incompleta o ruido: ignorar */
  }
}

/** Consume el stream NDJSON de la ronda, emitiendo un mensaje por línea. */
async function readNdjson(
  body: ReadableStream<Uint8Array>,
  onMessage: (msg: ServerMessage) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const { lines, rest } = takeLines(buffer + decoder.decode(value, { stream: true }))
    buffer = rest
    for (const line of lines) dispatchLine(line, onMessage)
  }
}

export function useOfficeRun() {
  const [state, dispatch] = useReducer(reducer, INIT)
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (prompt: string, agentIds: string[]) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    dispatch({ type: 'reset', ids: agentIds, prompt })
    setIsRunning(true)

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error(`run → ${res.status}`)

      await readNdjson(res.body, (msg) => dispatch({ type: 'event', msg }))
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error en la ronda:', err)
      }
    } finally {
      setIsRunning(false)
      abortRef.current = null
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return {
    runtime: state.agents,
    totalAic: state.totalAic,
    totalTokens: state.totalTokens,
    requestCount: state.requestCount,
    runHistory: state.runHistory,
    isRunning,
    run,
    cancel,
  }
}
