import { useCallback, useReducer, useRef, useState } from 'react'
import type { AgentRuntime, ServerMessage } from '../types'

export interface RunEntry { aic: number; tokens: number; prompt: string }

interface RunState {
  agents: Record<string, AgentRuntime>
  totalAic: number
  totalTokens: number
  requestCount: number
  runHistory: RunEntry[]
}

const EMPTY: AgentRuntime = { status: 'idle', text: '', aic: 0, inputTokens: 0, outputTokens: 0, startedAt: null, elapsedMs: null }

type Action =
  | { type: 'reset'; ids: string[]; prompt: string }
  | { type: 'event'; msg: ServerMessage }

function reducer(state: RunState, action: Action): RunState {
  switch (action.type) {
    case 'reset': {
      const agents: Record<string, AgentRuntime> = {}
      for (const id of action.ids) agents[id] = EMPTY
      return {
        ...state,
        agents,
        requestCount: state.requestCount + 1,
        runHistory: [...state.runHistory, { aic: 0, tokens: 0, prompt: action.prompt }],
      }
    }
    case 'event': {
      const msg = action.msg
      if (msg.type === 'agent-update') {
        const prev = state.agents[msg.agentId] ?? EMPTY
        const working = msg.status === 'starting' || msg.status === 'thinking' || msg.status === 'responding'
        const done = msg.status === 'finished' || msg.status === 'error'
        const startedAt = prev.startedAt ?? (working ? Date.now() : null)
        return {
          ...state,
          agents: {
            ...state.agents,
            [msg.agentId]: {
              ...prev,
              status: msg.status,
              text: msg.text !== undefined ? msg.text : prev.text,
              error: msg.error,
              startedAt,
              elapsedMs: done && startedAt != null ? Date.now() - startedAt : prev.elapsedMs,
            },
          },
        }
      }
      if (msg.type === 'agent-usage') {
        const prev = state.agents[msg.agentId] ?? EMPTY
        const runTokens = msg.inputTokens + msg.outputTokens
        const last = state.runHistory.length - 1
        const runHistory = state.runHistory.map((r, i) =>
          i === last ? { ...r, aic: r.aic + msg.aic, tokens: r.tokens + runTokens } : r
        )
        return {
          ...state,
          totalAic: state.totalAic + msg.aic,
          totalTokens: state.totalTokens + runTokens,
          runHistory,
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
      return state
    }
    default:
      return state
  }
}

const INIT: RunState = { agents: {}, totalAic: 0, totalTokens: 0, requestCount: 0, runHistory: [] }

export function useOfficeRun() {
  const [state, dispatch] = useReducer(reducer, INIT)
  const [isRunning, setIsRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (prompt: string, agentIds: string[]) => {
    if (abortRef.current) abortRef.current.abort()
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

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line) continue
          try {
            dispatch({ type: 'event', msg: JSON.parse(line) as ServerMessage })
          } catch {
            /* línea incompleta o ruido: ignorar */
          }
        }
      }
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
