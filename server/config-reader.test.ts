import { describe, it, expect } from 'vitest'
import { sanitizeMemoryLinks } from './config-reader.ts'
import type { MemoryLink } from './types.ts'

const ids = new Set(['a', 'b', 'c'])

describe('sanitizeMemoryLinks', () => {
  it('conserva enlaces válidos', () => {
    const links: MemoryLink[] = [['a', 'b'], ['b', 'c']]
    expect(sanitizeMemoryLinks(links, ids)).toEqual([['a', 'b'], ['b', 'c']])
  })

  it('descarta bucles y ids inexistentes', () => {
    const links: MemoryLink[] = [['a', 'a'], ['a', 'zzz']]
    expect(sanitizeMemoryLinks(links, ids)).toEqual([])
  })

  it('deduplica sin importar la dirección', () => {
    const links: MemoryLink[] = [['a', 'b'], ['b', 'a']]
    expect(sanitizeMemoryLinks(links, ids)).toEqual([['a', 'b']])
  })
})
