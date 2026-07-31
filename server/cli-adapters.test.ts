import { describe, it, expect } from 'vitest'
import { firstJsonObject, getAdapter, parseOpencodeModelLines } from './cli-adapters.ts'
import type { AgentProcState, LineHandlers } from './cli-adapters.ts'

describe('firstJsonObject', () => {
  it('extrae un objeto JSON envuelto en texto', () => {
    const raw = 'ruido antes {"result":"hola","n":1} ruido después'
    expect(firstJsonObject(raw)).toEqual({ result: 'hola', n: 1 })
  })

  it('respeta llaves dentro de strings', () => {
    const raw = '{"result":"a } b","ok":true}'
    expect(firstJsonObject(raw)).toEqual({ result: 'a } b', ok: true })
  })

  it('maneja objetos anidados', () => {
    const raw = 'x {"usage":{"input_tokens":2,"output_tokens":6}} y'
    expect(firstJsonObject(raw)).toEqual({ usage: { input_tokens: 2, output_tokens: 6 } })
  })

  it('devuelve null si no hay objeto', () => {
    expect(firstJsonObject('sin json aquí')).toBeNull()
    expect(firstJsonObject('{ roto sin cerrar')).toBeNull()
  })
})

describe('parseOpencodeModelLines', () => {
  it('devuelve una línea por id, sin vacías', () => {
    const raw = 'github-copilot/gpt-5.4-mini\ngithub-copilot/claude-sonnet-5\n\n'
    expect(parseOpencodeModelLines(raw)).toEqual([
      'github-copilot/gpt-5.4-mini',
      'github-copilot/claude-sonnet-5',
    ])
  })

  it('quita códigos ANSI', () => {
    expect(parseOpencodeModelLines('\x1b[36mgithub-copilot/gpt-5.4\x1b[0m')).toEqual(['github-copilot/gpt-5.4'])
  })
})

describe('copilotAdapter.onLine', () => {
  const feed = (lines: string[]) => {
    const adapter = getAdapter('copilot')
    const state: AgentProcState = {
      finalText: '',
      reasoningMessageIds: new Set<string>(),
      outputTokens: 0,
      inputTokens: 0,
    }
    const calls: string[] = []
    let aic = 0
    let fatal: string | null = null
    const handlers: LineHandlers = {
      setThinking: () => calls.push('thinking'),
      setResponding: (text) => calls.push(`responding:${text}`),
      addUsageAic: (n) => (aic += n),
      fatal: (e) => (fatal = e),
    }
    for (const line of lines) adapter.onLine?.(line, state, handlers)
    return { state, calls, aic, fatal }
  }

  const evt = (o: unknown) => JSON.stringify(o)

  it('acumula los deltas de la respuesta', () => {
    const { state } = feed([
      evt({ type: 'assistant.message_start', data: { messageId: 'm1' } }),
      evt({ type: 'assistant.message_delta', data: { messageId: 'm1', deltaContent: 'Hola ' } }),
      evt({ type: 'assistant.message_delta', data: { messageId: 'm1', deltaContent: 'mundo' } }),
    ])
    expect(state.finalText).toBe('Hola mundo')
  })

  it('descarta el texto de los mensajes de razonamiento', () => {
    const { state } = feed([
      evt({ type: 'assistant.message_start', data: { messageId: 'r1', phase: 'reasoning' } }),
      evt({ type: 'assistant.message_delta', data: { messageId: 'r1', deltaContent: 'pensando…' } }),
      evt({ type: 'assistant.message', data: { messageId: 'r1', content: 'razonamiento' } }),
    ])
    expect(state.finalText).toBe('')
  })

  it('ignora un mensaje completo marcado como razonamiento por su fase', () => {
    const { state } = feed([
      evt({ type: 'assistant.message', data: { messageId: 'x', phase: 'reasoning', content: 'no' } }),
    ])
    expect(state.finalText).toBe('')
  })

  it('un mensaje completo reemplaza el texto y suma los tokens', () => {
    const { state } = feed([
      evt({ type: 'assistant.message_delta', data: { messageId: 'm1', deltaContent: 'parcial' } }),
      evt({ type: 'assistant.message', data: { messageId: 'm1', content: 'final', inputTokens: 3, outputTokens: 7 } }),
    ])
    expect(state.finalText).toBe('final')
    expect(state.inputTokens).toBe(3)
    expect(state.outputTokens).toBe(7)
  })

  it('notifica el inicio del turno y acumula el consumo de AIC', () => {
    const { calls, aic } = feed([
      evt({ type: 'assistant.turn_start' }),
      evt({ type: 'result', usage: { premiumRequests: 2 } }),
      evt({ type: 'result', usage: {} }),
    ])
    expect(calls).toContain('thinking')
    expect(aic).toBe(2)
  })

  it('marca error ante una línea "Error:" e ignora las demás no-JSON', () => {
    expect(feed(['Error: Model x is not available.']).fatal).toBe('Model x is not available.')
    expect(feed(['cargando…']).fatal).toBeNull()
  })

  it('ignora líneas JSON malformadas y tipos desconocidos', () => {
    const { state, calls } = feed(['{no es json', evt({ type: 'algo.desconocido' })])
    expect(state.finalText).toBe('')
    expect(calls).toEqual([])
  })
})
