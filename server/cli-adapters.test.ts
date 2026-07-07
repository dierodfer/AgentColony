import { describe, it, expect } from 'vitest'
import { firstJsonObject, parseOpencodeModelLines } from './cli-adapters.ts'

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
