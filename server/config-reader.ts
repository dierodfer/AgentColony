import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { AgentTemplate, SkillInfo, AgentConfig } from './types.ts'

// La app se ejecuta desde la raíz del proyecto (el plugin de Vite corre en ese
// cwd), donde viven .agents/ (plantillas) y .skills/.
const ROOT = process.cwd()
const AGENTS_DIR = join(ROOT, '.agents')
const SKILLS_DIR = join(ROOT, '.skills')
// El equipo es estado local en runtime, no código fuente: se guarda en una
// carpeta temporal del proyecto (.tmp/, ignorada por git) que se regenera en
// la máquina de cada usuario.
const TEAM_DIR = join(ROOT, '.tmp')
const TEAM_FILE = join(TEAM_DIR, 'agent.config.json')

/** Separa el frontmatter YAML simple (key: value) del cuerpo markdown. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {}
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) return { meta, body: raw.trim() }

  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return { meta, body: match[2].trim() }
}

/** Capitaliza un id para usarlo como nombre por defecto. */
function titleize(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1)
}

/** Lista archivos .md de un directorio (vacío si no existe). */
function listMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
}

/** Plantillas de agente detectadas en .agents/*.md */
export function getAgentTemplates(): AgentTemplate[] {
  return listMarkdown(AGENTS_DIR).map((file) => {
    const { meta } = parseFrontmatter(readFileSync(join(AGENTS_DIR, file), 'utf8'))
    const id = file.replace(/\.md$/, '')
    return { file, name: meta.name || titleize(id) }
  })
}

/** Skills detectadas en .skills/*.md */
export function getSkills(): SkillInfo[] {
  return listMarkdown(SKILLS_DIR).map((file) => {
    const { meta } = parseFrontmatter(readFileSync(join(SKILLS_DIR, file), 'utf8'))
    const id = file.replace(/\.md$/, '')
    return { id, name: meta.name || titleize(id) }
  })
}

/** Cuerpo (sin frontmatter) de una plantilla de agente. "" si no existe. */
export function getAgentTemplateBody(file: string): string {
  const safe = basename(file) // evita path traversal
  const path = join(AGENTS_DIR, safe)
  if (!existsSync(path)) return ''
  return parseFrontmatter(readFileSync(path, 'utf8')).body
}

/** Cuerpo (sin frontmatter) de una skill por su id. "" si no existe. */
export function getSkillBody(id: string): string {
  const safe = basename(id).replace(/\.md$/, '')
  const path = join(SKILLS_DIR, `${safe}.md`)
  if (!existsSync(path)) return ''
  return parseFrontmatter(readFileSync(path, 'utf8')).body
}

/** Lee el equipo configurado desde .tmp/agent.config.json. Vacío si no existe. */
export function readTeam(): AgentConfig[] {
  if (!existsSync(TEAM_FILE)) return []
  try {
    const data = JSON.parse(readFileSync(TEAM_FILE, 'utf8'))
    return Array.isArray(data.agents) ? data.agents : []
  } catch {
    return []
  }
}

/** Persiste el equipo en .tmp/agent.config.json (crea la carpeta si falta). */
export function writeTeam(agents: AgentConfig[]): void {
  mkdirSync(TEAM_DIR, { recursive: true })
  writeFileSync(TEAM_FILE, JSON.stringify({ agents }, null, 2) + '\n', 'utf8')
}

// ---- Creación de skills y plantillas desde la app ----

/** Convierte un nombre en un slug seguro para nombre de archivo. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (combining marks)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/** Escapa comillas dobles para incrustar un valor en el frontmatter. */
function yamlValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

/**
 * Crea una nueva skill en .skills/<slug>.md. Lanza si el nombre es inválido o
 * el archivo ya existe.
 */
export function createSkill(name: string, body: string): SkillInfo {
  const trimmed = name.trim()
  const slug = slugify(trimmed)
  if (!slug) throw new Error('Nombre de skill inválido.')

  mkdirSync(SKILLS_DIR, { recursive: true })
  const path = join(SKILLS_DIR, `${slug}.md`)
  if (existsSync(path)) throw new Error(`Ya existe una skill "${slug}".`)

  const content = `---\nname: ${yamlValue(trimmed)}\n---\n\n${body.trim() || trimmed}\n`
  writeFileSync(path, content, 'utf8')
  return { id: slug, name: trimmed }
}

/**
 * Crea una nueva plantilla de agente en .agents/<slug>.md. Lanza si el nombre
 * es inválido o el archivo ya existe.
 */
export function createTemplate(name: string, body: string): AgentTemplate {
  const trimmed = name.trim()
  const slug = slugify(trimmed)
  if (!slug) throw new Error('Nombre de plantilla inválido.')

  mkdirSync(AGENTS_DIR, { recursive: true })
  const file = `${slug}.md`
  const path = join(AGENTS_DIR, file)
  if (existsSync(path)) throw new Error(`Ya existe una plantilla "${file}".`)

  const content = `---\nname: ${yamlValue(trimmed)}\n---\n\n${body.trim() || trimmed}\n`
  writeFileSync(path, content, 'utf8')
  return { file, name: trimmed }
}

/** Actualiza una plantilla de agente existente. */
export function updateTemplate(file: string, name: string, body: string): AgentTemplate {
  const safe = basename(file)
  const path = join(AGENTS_DIR, safe)
  if (!existsSync(path)) throw new Error(`Plantilla "${safe}" no encontrada.`)
  const n = name.trim()
  const content = `---\nname: ${yamlValue(n)}\n---\n\n${body.trim()}\n`
  writeFileSync(path, content, 'utf8')
  return { file: safe, name: n }
}

/** Elimina una plantilla de agente del disco. */
export function deleteTemplate(file: string): void {
  const safe = basename(file)
  const path = join(AGENTS_DIR, safe)
  if (!existsSync(path)) throw new Error(`Plantilla "${safe}" no encontrada.`)
  unlinkSync(path)
}

/** Actualiza una skill existente. */
export function updateSkill(id: string, name: string, body: string): SkillInfo {
  const safe = basename(id).replace(/\.md$/, '')
  const path = join(SKILLS_DIR, `${safe}.md`)
  if (!existsSync(path)) throw new Error(`Skill "${safe}" no encontrada.`)
  const n = name.trim()
  const content = `---\nname: ${yamlValue(n)}\n---\n\n${body.trim()}\n`
  writeFileSync(path, content, 'utf8')
  return { id: safe, name: n }
}

/** Elimina una skill del disco. */
export function deleteSkill(id: string): void {
  const safe = basename(id).replace(/\.md$/, '')
  const path = join(SKILLS_DIR, `${safe}.md`)
  if (!existsSync(path)) throw new Error(`Skill "${safe}" no encontrada.`)
  unlinkSync(path)
}
