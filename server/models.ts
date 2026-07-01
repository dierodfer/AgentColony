import { execFile } from 'node:child_process'
import type { ModelOption } from './types.ts'

// La lista de modelos se obtiene EXCLUSIVAMENTE de Copilot CLI en tiempo de
// ejecución (parseando `copilot help`), porque el CLI no expone un comando
// específico para listarlos. No hay lista por defecto: si Copilot no está
// disponible, el selector queda vacío (la app depende de una instalación de
// `copilot` autenticada para funcionar).

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
 * Solo devuelve lo que Copilot expone; no inyecta ningún modelo por defecto.
 * Exportada para poder testear el parseo sin ejecutar el CLI.
 */
export function parseModelsFromHelp(help: string): ModelOption[] {
  const lines = help.split('\n')
  const start = lines.findIndex((l) => /--model/.test(l))

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
  // Si Copilot ofrece "auto", lo mostramos primero (es la opción recomendada).
  models.sort((a, b) => (a.id === 'auto' ? -1 : b.id === 'auto' ? 1 : 0))
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

// Cache a nivel de módulo: los modelos no cambian durante la sesión. Solo
// cacheamos un resultado no vacío, para reintentar si Copilot no respondió.
let cachedModels: ModelOption[] | null = null
let loadPromise: Promise<ModelOption[]> | null = null
let modelIdSet = new Set<string>()

/**
 * Resuelve la lista de modelos desde Copilot CLI (cacheada). Devuelve [] si el
 * CLI no está disponible o no se pudo parsear ningún modelo (sin lista de
 * reserva: la app requiere `copilot`).
 */
export function loadModels(): Promise<ModelOption[]> {
  if (cachedModels) return Promise.resolve(cachedModels)
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const help = await runCopilotHelp()
    const models = help ? parseModelsFromHelp(help) : []
    if (models.length > 0) {
      cachedModels = models
      modelIdSet = new Set(models.map((m) => m.id))
    } else {
      loadPromise = null // no cachear vacío: permite reintentar en la próxima llamada
    }
    return models
  })()
  return loadPromise
}

/**
 * ¿Es un id de modelo válido y seleccionable? Comprueba contra la lista
 * resuelta de Copilot (vacía hasta que se cargue o si `copilot` no está).
 */
export function isValidModel(id: string): boolean {
  return modelIdSet.has(id)
}
