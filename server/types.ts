// Tipos compartidos del backend. El frontend tiene su propia copia en
// src/types.ts (mantener ambas alineadas).

/** Estados del ciclo de vida de un agente durante una ejecución. */
export type AgentStatus =
  | 'idle'
  | 'starting'
  | 'thinking'
  | 'responding'
  | 'finished'
  | 'error'

/** Modelo seleccionable, expuesto al frontend para el dropdown. */
export interface ModelOption {
  /** Identificador para el flag --model de Copilot CLI. */
  id: string
  /** Nombre legible para mostrar. */
  label: string
}

/** Skill detectada en .skills/*.md */
export interface SkillInfo {
  /** Nombre del archivo sin extensión, usado como id (p.ej. "astro"). */
  id: string
  /** Nombre legible (frontmatter `name` o el id capitalizado). */
  name: string
  /**
   * Patrones glob (frontmatter `applyTo`, separados por comas) que indican a
   * qué archivos aplica la skill, p.ej. "**\/*.java, **\/pom.xml". Mismo
   * campo que usa GitHub Copilot para instrucciones específicas de path.
   * Metadata informativa: no filtra automáticamente, es guía para quien arma
   * el equipo.
   */
  applyTo?: string
}

/** Plantilla de agente detectada en .agents/*.md */
export interface AgentTemplate {
  /** Nombre del archivo con extensión, usado como id (p.ej. "frontend.md"). */
  file: string
  /** Nombre legible (frontmatter `name`). */
  name: string
}

/** CLI de agente que ejecuta las respuestas (cada uno tiene su binario/args). */
export type AgentCli = 'copilot' | 'claude' | 'opencode'

/** Instancia de agente del equipo (un puesto en la oficina). */
export interface AgentConfig {
  id: string
  name: string
  /** Id del avatar SVG (p.ej. "avatar-1"). */
  avatar: string
  /** Archivo de plantilla en .agents/ (p.ej. "frontend.md"). */
  agentFile: string
  /** Id del modelo para --model. */
  model: string
  /** Ids de skills seleccionadas (nombres de archivo sin extensión). */
  skills: string[]
  /** CLI que ejecuta al agente (por defecto "copilot"). */
  cli: AgentCli
}

/**
 * Enlace de memoria entre dos agentes (par de ids). Los agentes conectados
 * comparten skills y respuestas anteriores en cada ronda. Los grupos de memoria
 * son los componentes conexos del grafo de enlaces.
 */
export type MemoryLink = [string, string]

// ---- Protocolo de streaming (NDJSON) ----
// El cliente lanza una ronda con POST /api/run { prompt } y el servidor
// responde con un stream NDJSON: un ServerMessage por línea. Cancelar = abortar
// la petición (el servidor detecta el cierre y mata los procesos).

/** Eventos que el servidor emite por línea durante una ronda. */
export type ServerMessage =
  | { type: 'agent-update'; agentId: string; status: AgentStatus; text?: string; error?: string }
  | { type: 'agent-usage'; agentId: string; aic: number; inputTokens: number; outputTokens: number }
  | { type: 'run-started'; agentIds: string[] }
  | { type: 'run-finished' }
