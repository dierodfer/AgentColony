import { describe, it, expect } from 'vitest'
import { parseModelsFromOutput } from './models.ts'

describe('parseModelsFromOutput', () => {
  it('parsea un array JSON de ids', () => {
    const out = parseModelsFromOutput('["gpt-5.4-mini","claude-sonnet-5"]')
    expect(out.map((m) => m.id)).toEqual(['gpt-5.4-mini', 'claude-sonnet-5'])
  })

  it('coloca "auto" primero', () => {
    const out = parseModelsFromOutput('["gpt-5.4","auto"]')
    expect(out[0].id).toBe('auto')
    expect(out[0].label).toBe('Auto')
  })

  it('ignora texto alrededor del array', () => {
    const out = parseModelsFromOutput('Aquí tienes: ["a","b"] fin')
    expect(out.map((m) => m.id)).toEqual(['a', 'b'])
  })

  it('devuelve [] si no hay array válido', () => {
    expect(parseModelsFromOutput('sin array')).toEqual([])
  })
})
