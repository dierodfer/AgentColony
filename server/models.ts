import { spawn } from 'node:child_process'
import type { ModelOption } from './types.ts'

// Los modelos se obtienen ejecutando el slash-command `/model` dentro de
// Copilot CLI (así es como el CLI los lista). NO se consulta automáticamente:
// solo bajo demanda desde el botón "Recargar modelos" del formulario de agente
// (endpoint POST /api/models/refresh). La lista resuelta se cachea en memoria
// durante la sesión del servidor.

const REFRESH_TIMEOUT_MS = 12_000

// Familias de modelos conocidas de Copilot CLI. El grupo captura el id completo
// (familia + versión + sufijo), permitiendo puntos y guiones internos.
const MODEL_ID_RE = /\b((?:claude|gpt|gemini|grok)-[a-z0-9][a-z0-9.-]*|o[0-9][a-z0-9.-]*|auto)\b/gi

// Secuencias ANSI (colores, movimientos de cursor) que emite la TUI de Copilot.
// Se construye sin carácter de control literal para no disparar no-control-regex.
const ANSI_RE = new RegExp(String.fromCharCode(27) + '\\[[0-9;?]*[ -/]*[@-~]', 'g')
const ESC = String.fromCharCode(27)

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
 * Extrae los ids de modelo de la salida del comando `/model` de Copilot,
 * limpiando primero los códigos ANSI de la TUI. Exportada para testear el
 * parseo sin ejecutar el CLI.
 */
export function parseModelsFromOutput(raw: string): ModelOption[] {
  const text = raw.replace(ANSI_RE, '')
  const ids: string[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(MODEL_ID_RE)) {
    const id = m[1].toLowerCase().replace(/[.,;]+$/, '')
    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }
  const models = ids.map((id) => ({ id, label: labelFor(id) }))
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
 * Lanza `copilot`, ejecuta el slash-command `/model` para que liste los modelos
 * disponibles, y devuelve la salida cruda (con ANSI). Resuelve con lo capturado
 * al cerrar el proceso o al agotar el timeout; rechaza si `copilot` no se pudo
 * ejecutar y no produjo salida alguna.
 */
function runModelCommand(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('copilot', [], { stdio: ['pipe', 'pipe', 'pipe'] })

    let out = ''
    let settled = false
    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!child.killed) child.kill('SIGTERM')
      if (err && !out) reject(err)
      else resolve(out)
    }

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (c: string) => (out += c))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (c: string) => (out += c))
    child.on('error', (err) => finish(new Error(`No se pudo ejecutar copilot: ${err.message}`)))
    child.on('close', () => finish())

    const timer = setTimeout(() => finish(), REFRESH_TIMEOUT_MS)

    // Abre el selector de modelos y, tras dar tiempo a que lo pinte, cierra el
    // selector (ESC) y sale del REPL para que el proceso termine y volquemos out.
    const write = (s: string) => {
      try {
        child.stdin.write(s)
      } catch {
        /* stdin pudo cerrarse si copilot no arrancó; el handler 'error' lo cubre */
      }
    }
    write('/model\n')
    setTimeout(() => {
      write(ESC)
      write('/exit\n')
    }, 1800)
  })
}

/**
 * Recarga los modelos desde Copilot (`/model`), actualiza la caché y devuelve
 * la lista. Puede devolver [] si no se pudo parsear ningún modelo.
 */
export async function refreshModels(): Promise<ModelOption[]> {
  const output = await runModelCommand()
  const models = parseModelsFromOutput(output)
  cachedModels = models
  modelIdSet = new Set(models.map((m) => m.id))
  return models
}
