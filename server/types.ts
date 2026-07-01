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
}

/** Plantilla de agente detectada en .agents/*.md */
export interface AgentTemplate {
  /** Nombre del archivo con extensión, usado como id (p.ej. "frontend.md"). */
  file: string
  /** Nombre legible (frontmatter `name`). */
  name: string
}

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
}

// ---- Protocolo de streaming (NDJSON) ----
// El cliente lanza una ronda con POST /api/run { prompt } y el servidor
// responde con un stream NDJSON: un ServerMessage por línea. Cancelar = abortar
// la petición (el servidor detecta el cierre y mata los procesos).

/** Eventos que el servidor emite por línea durante una ronda. */
export type ServerMessage =
  | { type: 'agent-update'; agentId: string; status: AgentStatus; text?: string; error?: string }
  | { type: 'agent-usage'; agentId: string; aic: number; outputTokens: number; inputTokens: number }
  | { type: 'run-started'; agentIds: string[] }
  | { type: 'run-finished' }
