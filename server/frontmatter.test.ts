import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from './frontmatter.ts'

describe('parseFrontmatter', () => {
  it('separa metadatos y cuerpo', () => {
    expect(parseFrontmatter('---\nname: Hola\n---\ncuerpo')).toEqual({
      meta: { name: 'Hola' },
      body: 'cuerpo',
    })
  })

  it('quita comillas simples y dobles del valor', () => {
    const parsed = parseFrontmatter('---\nname: "Con comillas"\napplyTo: \'**/*.ts\'\n---\nx')
    expect(parsed?.meta).toEqual({ name: 'Con comillas', applyTo: '**/*.ts' })
  })

  it('tolera espacios sobrantes alrededor de las marcas y los valores', () => {
    const parsed = parseFrontmatter('---  \nname:   espacios   \n---  \ncuerpo')
    expect(parsed).toEqual({ meta: { name: 'espacios' }, body: 'cuerpo' })
  })

  it('conserva los dos puntos que aparecen dentro del valor', () => {
    expect(parseFrontmatter('---\nname: a: b\n---\nx')?.meta.name).toBe('a: b')
  })

  it('ignora las líneas que no son "clave: valor"', () => {
    expect(parseFrontmatter('---\nlínea suelta\nname: X\n---\ny')?.meta).toEqual({ name: 'X' })
  })

  it('devuelve null sin frontmatter o sin marca de cierre', () => {
    expect(parseFrontmatter('sin frontmatter')).toBeNull()
    expect(parseFrontmatter('---\nname: Sin cierre\ncuerpo')).toBeNull()
  })

  it('conserva los saltos de línea internos del cuerpo', () => {
    expect(parseFrontmatter('---\nname: M\n---\nl1\nl2\n\nl3\n')?.body).toBe('l1\nl2\n\nl3')
  })
})
