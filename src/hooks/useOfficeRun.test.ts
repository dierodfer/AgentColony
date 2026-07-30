import { describe, it, expect } from 'vitest'
import { reducer, type RunState } from './useOfficeRun'

const INIT: RunState = { agents: {}, totalAic: 0, totalTokens: 0, requestCount: 0, runHistory: [] }

const reset = (state: RunState, ids: string[], prompt = 'p') =>
  reducer(state, { type: 'reset', ids, prompt })

describe('reducer de la ronda', () => {
  it('reset pone los agentes a cero y abre una entrada de historial', () => {
    const s = reset(INIT, ['a', 'b'], '¿qué tal?')
    expect(Object.keys(s.agents)).toEqual(['a', 'b'])
    expect(s.agents.a.status).toBe('idle')
    expect(s.requestCount).toBe(1)
    expect(s.runHistory).toEqual([{ aic: 0, tokens: 0, prompt: '¿qué tal?' }])
  })

  it('agent-update guarda estado y texto', () => {
    const s = reducer(reset(INIT, ['a']), {
      type: 'event',
      msg: { type: 'agent-update', agentId: 'a', status: 'responding', text: 'hola' },
    })
    expect(s.agents.a.status).toBe('responding')
    expect(s.agents.a.text).toBe('hola')
  })

  it('conserva el texto previo si el mensaje no trae texto', () => {
    let s = reset(INIT, ['a'])
    s = reducer(s, { type: 'event', msg: { type: 'agent-update', agentId: 'a', status: 'responding', text: 'hola' } })
    s = reducer(s, { type: 'event', msg: { type: 'agent-update', agentId: 'a', status: 'finished' } })
    expect(s.agents.a.text).toBe('hola')
  })

  it('cronometra desde el primer estado de trabajo hasta el terminal', () => {
    let s = reset(INIT, ['a'])
    s = reducer(s, { type: 'event', msg: { type: 'agent-update', agentId: 'a', status: 'starting' } })
    const startedAt = s.agents.a.startedAt
    expect(startedAt).not.toBeNull()

    s = reducer(s, { type: 'event', msg: { type: 'agent-update', agentId: 'a', status: 'thinking' } })
    expect(s.agents.a.startedAt).toBe(startedAt)
    expect(s.agents.a.elapsedMs).toBeNull()

    s = reducer(s, { type: 'event', msg: { type: 'agent-update', agentId: 'a', status: 'finished' } })
    expect(s.agents.a.elapsedMs).not.toBeNull()
  })

  it('no arranca el cronómetro en estados que no son de trabajo', () => {
    const s = reducer(reset(INIT, ['a']), {
      type: 'event',
      msg: { type: 'agent-update', agentId: 'a', status: 'idle' },
    })
    expect(s.agents.a.startedAt).toBeNull()
    expect(s.agents.a.elapsedMs).toBeNull()
  })

  it('agent-usage suma al agente, al total y a la ronda en curso', () => {
    let s = reset(INIT, ['a'])
    s = reducer(s, { type: 'event', msg: { type: 'agent-usage', agentId: 'a', aic: 2, inputTokens: 10, outputTokens: 5 } })
    s = reducer(s, { type: 'event', msg: { type: 'agent-usage', agentId: 'a', aic: 1, inputTokens: 1, outputTokens: 1 } })

    expect(s.totalAic).toBe(3)
    expect(s.totalTokens).toBe(17)
    expect(s.agents.a.aic).toBe(3)
    expect(s.agents.a.inputTokens).toBe(11)
    expect(s.agents.a.outputTokens).toBe(6)
    expect(s.runHistory.at(-1)).toEqual({ aic: 3, tokens: 17, prompt: 'p' })
  })

  it('el consumo se imputa solo a la última ronda', () => {
    let s = reset(INIT, ['a'], 'primera')
    s = reducer(s, { type: 'event', msg: { type: 'agent-usage', agentId: 'a', aic: 1, inputTokens: 1, outputTokens: 1 } })
    s = reset(s, ['a'], 'segunda')
    s = reducer(s, { type: 'event', msg: { type: 'agent-usage', agentId: 'a', aic: 5, inputTokens: 0, outputTokens: 0 } })

    expect(s.runHistory[0]).toEqual({ aic: 1, tokens: 2, prompt: 'primera' })
    expect(s.runHistory[1]).toEqual({ aic: 5, tokens: 0, prompt: 'segunda' })
    expect(s.requestCount).toBe(2)
  })

  it('ignora los mensajes que no cambian el estado', () => {
    const s = reset(INIT, ['a'])
    expect(reducer(s, { type: 'event', msg: { type: 'run-finished' } })).toBe(s)
  })
})
