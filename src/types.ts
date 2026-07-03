// Tipos del frontend. Espejo de server/types.ts (mantener alineados).

export type AgentStatus =
  | 'idle'
  | 'starting'
  | 'thinking'
  | 'responding'
  | 'finished'
  | 'error'

export interface ModelOption {
  id: string
  label: string
}

export interface SkillInfo {
  id: string
  name: string
  /** Patrones glob (separados por comas) a los que aplica, p.ej. "**\/*.java". */
  applyTo?: string
}

export interface AgentTemplate {
  file: string
  name: string
}

export interface AgentConfig {
  id: string
  name: string
  avatar: string
  agentFile: string
  model: string
  skills: string[]
}

/** Datos de un agente sin id (para crear/editar). */
export type AgentDraft = Omit<AgentConfig, 'id'>

/** Eventos NDJSON que emite el servidor durante una ronda. */
export type ServerMessage =
  | { type: 'agent-update'; agentId: string; status: AgentStatus; text?: string; error?: string }
  | { type: 'agent-usage'; agentId: string; aic: number; inputTokens: number; outputTokens: number }
  | { type: 'run-started'; agentIds: string[] }
  | { type: 'run-finished' }

/** Estado en vivo de un agente durante/after una ronda. */
export interface AgentRuntime {
  status: AgentStatus
  text: string
  error?: string
  aic: number
  inputTokens: number
  outputTokens: number
  /** Instante (ms) en que el agente empezó a trabajar; null si aún no. */
  startedAt: number | null
  /** Duración total de la ejecución en ms una vez finalizado; null si no acabó. */
  elapsedMs: number | null
}
