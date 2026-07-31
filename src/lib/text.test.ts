import { describe, it, expect } from 'vitest'
import { cleanText } from './text'

describe('cleanText', () => {
  it('quita negritas y comillas de código', () => {
    expect(cleanText('**negrita** y `code` y __otro__')).toBe('negrita y code y otro')
  })

  it('quita las almohadillas de los títulos', () => {
    expect(cleanText('# Título\n### Otro')).toBe('Título\nOtro')
  })

  it('convierte las viñetas en •', () => {
    expect(cleanText('- uno\n* dos')).toBe('• uno\n• dos')
  })

  it('no une dos viñetas en la misma línea', () => {
    expect(cleanText('- a\n- b')).toBe('• a\n• b')
  })

  it('conserva la línea en blanco que separa un párrafo de una lista', () => {
    expect(cleanText('Intro\n\n- uno')).toBe('Intro\n\n• uno')
  })

  it('colapsa espacios repetidos y líneas en blanco de más', () => {
    expect(cleanText('a    b')).toBe('a b')
    expect(cleanText('a\n\n\n\n\nb')).toBe('a\n\nb')
  })
})
