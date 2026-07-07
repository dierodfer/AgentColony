import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

/**
 * Guardián de drift: `server/types.ts` y `src/types.ts` son copias que deben
 * mantenerse alineadas a mano (los dos proyectos TS —tsconfig.node y
 * tsconfig.app— tienen includes disjuntos, así que no pueden compartir un único
 * fichero sin riesgo). Este test compara las declaraciones compartidas entre
 * ambos ficheros (ignorando comentarios y espacios) y falla si divergen.
 */

const SHARED_TYPES = [
  'AgentStatus',
  'ModelOption',
  'SkillInfo',
  'AgentTemplate',
  'AgentCli',
  'AgentConfig',
  'MemoryLink',
  'ServerMessage',
]

/** Quita comentarios de línea y de bloque. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** Mapa nombre → declaración normalizada (sin comentarios, espacios colapsados). */
function declarations(src: string): Map<string, string> {
  const clean = stripComments(src)
  const map = new Map<string, string>()
  const re = /export\s+(?:interface|type)\s+(\w+)[\s\S]*?(?=\n\s*export\s|$)/g
  for (const m of clean.matchAll(re)) {
    const name = m[1]
    const body = m[0].replace(/\s+/g, ' ').trim()
    map.set(name, body)
  }
  return map
}

describe('drift de tipos server/types.ts ↔ src/types.ts', () => {
  const serverSrc = readFileSync(fileURLToPath(new URL('./types.ts', import.meta.url)), 'utf8')
  const frontSrc = readFileSync(fileURLToPath(new URL('../src/types.ts', import.meta.url)), 'utf8')
  const server = declarations(serverSrc)
  const front = declarations(frontSrc)

  it.each(SHARED_TYPES)('%s coincide en ambos ficheros', (name) => {
    expect(server.get(name), `falta ${name} en server/types.ts`).toBeDefined()
    expect(front.get(name), `falta ${name} en src/types.ts`).toBeDefined()
    expect(front.get(name)).toBe(server.get(name))
  })
})
