import { describe, it, expect } from 'vitest'
import { firstJsonObject } from './cli-adapters.ts'

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
