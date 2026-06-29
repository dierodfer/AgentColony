import type { ModelOption } from './types.ts'

// Modelos disponibles en GitHub Copilot CLI (verificados contra el selector de
// `copilot` 1.0.63). El `id` es el valor exacto del flag --model.
// "auto" deja que Copilot elija automáticamente.
export const MODELS: ModelOption[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'claude-opus-4.8', label: 'Claude Opus 4.8' },
  { id: 'gpt-5.5', label: 'GPT-5.5' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3-Codex' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
]

const MODEL_IDS = new Set(MODELS.map((m) => m.id))

/** ¿Es un id de modelo válido y seleccionable? */
export function isValidModel(id: string): boolean {
  return MODEL_IDS.has(id)
}

// Modelo por defecto para agentes nuevos (mientras no se configure otro).
// Nota: el id "gpt-5-mini" no existe en Copilot CLI; el mini disponible es
// "gpt-5.4-mini".
export const DEFAULT_MODEL = 'gpt-5.4-mini'
