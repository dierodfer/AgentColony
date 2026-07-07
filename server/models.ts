import { runOnce } from './cli-adapters.ts'
import type { AgentCli, ModelOption } from './types.ts'

// Cada CLI tiene su propio catálogo de modelos. Se obtienen preguntándole al
// propio CLI en modo no interactivo (vía runOnce, misma capa de adaptadores que
// el runner) por los ids que acepta su flag --model, forzando salida JSON pura.
// NO se consulta automáticamente: solo bajo demanda desde el botón "Recargar
// modelos" del formulario de agente (endpoint POST /api/models/refresh con el
// CLI seleccionado). Cada catálogo resuelto se cachea en memoria durante la
// sesión del servidor; hasta la primera recarga, la lista de ese CLI está vacía.

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
  // Si el CLI ofrece "auto", lo mostramos primero (opción recomendada).
  models.sort((a, b) => (a.id === 'auto' ? -1 : b.id === 'auto' ? 1 : 0))
  return models
}

// Caché en memoria por CLI: se rellena al pulsar "Recargar modelos". Vacía al arrancar.
const cachedModels = new Map<AgentCli, ModelOption[]>()
const modelIdSets = new Map<AgentCli, Set<string>>()

/** Modelos resueltos en la última recarga de un CLI (vacío hasta la primera). */
export function getModels(cli: AgentCli): ModelOption[] {
  return cachedModels.get(cli) ?? []
}

/** ¿Es un id de modelo válido para ese CLI (según su última recarga)? */
export function isValidModel(cli: AgentCli, id: string): boolean {
  return modelIdSets.get(cli)?.has(id) ?? false
}

/**
 * Recarga los modelos del CLI indicado (vía runOnce, con la política de
 * seguridad y el cwd aislado de la capa de adaptadores), actualiza su caché y
 * devuelve la lista. Puede devolver [] si la respuesta no se pudo parsear.
 */
export async function refreshModels(cli: AgentCli): Promise<ModelOption[]> {
  const output = await runOnce(cli, LIST_MODELS_PROMPT, 'auto', REFRESH_TIMEOUT_MS)
  const models = parseModelsFromOutput(output)
  cachedModels.set(cli, models)
  modelIdSets.set(cli, new Set(models.map((m) => m.id)))
  return models
}
