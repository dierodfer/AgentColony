/**
 * Frontmatter YAML simple (`key: value`) delimitado por `---` al principio de un
 * markdown. El parseo recorre las líneas una sola vez en vez de aplicar una
 * expresión regular sobre el documento entero: además de ser más legible, evita
 * el backtracking superlineal de un patrón como `^---\s*\n([\s\S]*?)\n---`.
 */
export interface Frontmatter {
  meta: Record<string, string>
  body: string
}

const FENCE = '---'
const KEY_RE = /^[A-Za-z0-9_-]+$/

/** Quita una comilla envolvente al principio y/o al final del valor. */
function unquote(value: string): string {
  return value.replace(/^["']/, '').replace(/["']$/, '')
}

/** Devuelve el frontmatter y el cuerpo, o `null` si el documento no lo lleva. */
export function parseFrontmatter(raw: string): Frontmatter | null {
  const lines = raw.split('\n')
  if (lines[0]?.trim() !== FENCE) return null

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === FENCE)
  if (end === -1) return null

  const meta: Record<string, string> = {}
  for (const line of lines.slice(1, end)) {
    const sep = line.indexOf(':')
    if (sep <= 0) continue
    const key = line.slice(0, sep).trim()
    if (KEY_RE.test(key)) meta[key] = unquote(line.slice(sep + 1).trim())
  }

  return { meta, body: lines.slice(end + 1).join('\n').trim() }
}
