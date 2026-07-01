import { execFile } from 'node:child_process'
import type { ModelOption } from './types.ts'

// La lista de modelos se obtiene de Copilot CLI en tiempo de ejecución
// (parseando `copilot help`), porque el CLI no expone un comando específico
// para listarlos. Si el CLI no está disponible o cambia el formato, se usa la
// lista de reserva (FALLBACK_MODELS) para que la app nunca se quede sin modelos.

/** Lista de reserva: modelos verificados contra `copilot` 1.0.63. */
export const FALLBACK_MODELS: ModelOption[] = [
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

// Modelo por defecto para agentes nuevos (mientras no se configure otro).
export const DEFAULT_MODEL = 'gpt-5.4-mini'

const HELP_TIMEOUT_MS = 8_000

// Familias de modelos conocidas de Copilot CLI. El grupo captura el id completo
// (familia + versión + sufijo), permitiendo puntos y guiones internos.
const MODEL_ID_RE = /\b((?:claude|gpt|gemini|grok)-[a-z0-9][a-z0-9.-]*|o[0-9][a-z0-9.-]*|auto)\b/gi

/** Genera una etiqueta legible a partir de un id de modelo. */
function labelFor(id: string): string {
  if (id === 'auto') return 'Auto'
  return id
    .split('-')
    .map((part) => {
      if (/^gpt$/i.test(part)) return 'GPT'
      if (/^\d/.test(part)) return part // fragmento de versión (5.4, 4.6…)
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

/**
 * Extrae los ids de modelo del texto de ayuda de Copilot CLI. Busca el bloque
 * de la opción `--model` (su descripción incluye los model strings) y, si no lo
 * encuentra, cae a escanear todo el texto por patrones de modelo conocidos.
 * Exportada para poder testear el parseo sin ejecutar el CLI.
 */
export function parseModelsFromHelp(help: string): ModelOption[] {
  const lines = help.split('\n')
  const start = lines.findIndex((l) => /(^|\s)-?-?model\b/.test(l) && /--model/.test(l))

  let scope = help
  if (start !== -1) {
    // Toma la línea de --model y las siguientes de continuación (indentadas o de
    // descripción) hasta la próxima opción (línea que empieza por '-') o un hueco.
    const block: string[] = [lines[start]]
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]
      if (/^\s*-{1,2}\w/.test(l) || l.trim() === '') break
      block.push(l)
    }
    scope = block.join('\n')
  }

  const ids: string[] = []
  const seen = new Set<string>()
  for (const m of scope.matchAll(MODEL_ID_RE)) {
    let id = m[1].toLowerCase().replace(/[.,;]+$/, '') // limpia puntuación final
    if (id.endsWith('.')) id = id.slice(0, -1)
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  const models = ids.map((id) => ({ id, label: labelFor(id) }))
  // Garantiza que "auto" esté disponible y primero.
  if (!seen.has('auto')) models.unshift({ id: 'auto', label: 'Auto' })
  else models.sort((a, b) => (a.id === 'auto' ? -1 : b.id === 'auto' ? 1 : 0))
  return models
}

/** Ejecuta `copilot help` y devuelve su salida, o null si falla. */
function runCopilotHelp(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('copilot', ['help'], { timeout: HELP_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err && !stdout && !stderr) return resolve(null)
      resolve((stdout || '') + '\n' + (stderr || ''))
    })
  })
}

// Cache a nivel de módulo: los modelos no cambian durante la sesión, así que
// solo consultamos a Copilot una vez por arranque del servidor.
let cachedModels: ModelOption[] | null = null
let loadPromise: Promise<ModelOption[]> | null = null
let modelIdSet = new Set(FALLBACK_MODELS.map((m) => m.id))

/**
 * Resuelve la lista de modelos desde Copilot CLI (cacheada). Cae a
 * FALLBACK_MODELS si el CLI no está disponible o no se pudo parsear ninguno.
 */
export function loadModels(): Promise<ModelOption[]> {
  if (cachedModels) return Promise.resolve(cachedModels)
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const help = await runCopilotHelp()
    const parsed = help ? parseModelsFromHelp(help) : []
    // Necesitamos algo más que solo "auto" para considerar el parseo válido.
    const models = parsed.filter((m) => m.id !== 'auto').length > 0 ? parsed : FALLBACK_MODELS
    cachedModels = models
    modelIdSet = new Set(models.map((m) => m.id))
    return models
  })()
  return loadPromise
}

/**
 * ¿Es un id de modelo válido y seleccionable? Comprueba contra la lista
 * resuelta (o la de reserva si aún no se ha cargado).
 */
export function isValidModel(id: string): boolean {
  return modelIdSet.has(id)
}
