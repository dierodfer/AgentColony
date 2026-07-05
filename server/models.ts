import { runOnce } from './cli-adapters.ts'
import type { ModelOption } from './types.ts'

// Los modelos se obtienen preguntándole a Copilot CLI en modo no interactivo
// (vía runOnce, misma capa de adaptadores que el runner) por los ids que acepta
// su propio flag --model, forzando salida JSON pura. NO se consulta
// automáticamente: solo bajo demanda desde el botón "Recargar modelos" del
// formulario de agente (endpoint POST /api/models/refresh). La lista resuelta se
// cachea en memoria durante la sesión del servidor. Es específico de copilot.

const REFRESH_TIMEOUT_MS = 30_000

const LIST_MODELS_PROMPT =
  'List every AI model id you can be configured to use (the exact ids accepted ' +
  'by the --model flag). Respond with ONLY a JSON array of strings, no prose, ' +
  'no markdown fences.'

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
 * Extrae el array de ids de modelo de la respuesta del agente (un bloque JSON,
 * posiblemente con texto alrededor pese a la instrucción). Exportada para
 * testear el parseo sin ejecutar el CLI.
 */
export function parseModelsFromOutput(raw: string): ModelOption[] {
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  let ids: unknown
  try {
    ids = JSON.parse(match[0])
  } catch {
    return []
  }
  if (!Array.isArray(ids)) return []
  const models = ids
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
    .map((id) => ({ id, label: labelFor(id) }))
  // Si Copilot ofrece "auto", lo mostramos primero (opción recomendada).
  models.sort((a, b) => (a.id === 'auto' ? -1 : b.id === 'auto' ? 1 : 0))
  return models
}

// Cache en memoria: se rellena al pulsar "Recargar modelos". Vacío al arrancar.
let cachedModels: ModelOption[] = []
let modelIdSet = new Set<string>()

/** Modelos resueltos en la última recarga (vacío hasta la primera). */
export function getModels(): ModelOption[] {
  return cachedModels
}

/** ¿Es un id de modelo válido y seleccionable (según la última recarga)? */
export function isValidModel(id: string): boolean {
  return modelIdSet.has(id)
}

/**
 * Recarga los modelos desde Copilot (vía runOnce, con la política de seguridad y
 * el cwd aislado de la capa de adaptadores), actualiza la caché y devuelve la
 * lista. Puede devolver [] si la respuesta no se pudo parsear.
 */
export async function refreshModels(): Promise<ModelOption[]> {
  const output = await runOnce('copilot', LIST_MODELS_PROMPT, 'auto', REFRESH_TIMEOUT_MS)
  const models = parseModelsFromOutput(output)
  cachedModels = models
  modelIdSet = new Set(models.map((m) => m.id))
  return models
}
