import { describe, it, expect } from 'vitest'
import { computeGroupMembers } from './copilot-runner.ts'
import type { MemoryLink } from './types.ts'

describe('computeGroupMembers', () => {
  it('sin enlaces: cada agente es su propio grupo', () => {
    const m = computeGroupMembers(['a', 'b', 'c'], [])
    expect(m.get('a')).toEqual(['a'])
    expect(m.get('b')).toEqual(['b'])
    expect(m.get('c')).toEqual(['c'])
  })

  it('une pares en un mismo grupo', () => {
    const links: MemoryLink[] = [['a', 'b']]
    const m = computeGroupMembers(['a', 'b', 'c'], links)
    expect(new Set(m.get('a'))).toEqual(new Set(['a', 'b']))
    expect(new Set(m.get('b'))).toEqual(new Set(['a', 'b']))
    expect(m.get('c')).toEqual(['c'])
  })

  it('agrupa por transitividad (a-b, b-c => {a,b,c})', () => {
    const links: MemoryLink[] = [['a', 'b'], ['b', 'c']]
    const m = computeGroupMembers(['a', 'b', 'c', 'd'], links)
    const g = new Set(m.get('a'))
    expect(g).toEqual(new Set(['a', 'b', 'c']))
    expect(new Set(m.get('c'))).toEqual(g)
    expect(m.get('d')).toEqual(['d'])
  })

  it('ignora enlaces con ids fuera del equipo', () => {
    const links: MemoryLink[] = [['a', 'fantasma']]
    const m = computeGroupMembers(['a', 'b'], links)
    expect(m.get('a')).toEqual(['a'])
  })
})
