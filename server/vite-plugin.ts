import type { Plugin, Connect } from 'vite'
import type { ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import {
  getAgentTemplates,
  getAgentTemplateBody,
  getSkills,
  getSkillBody,
  readTeam,
  writeTeam,
  readMemoryLinks,
  writeMemoryLinks,
  createSkill,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  updateSkill,
  deleteSkill,
} from './config-reader.ts'
import { getModels, isValidModel, refreshModels } from './models.ts'
import { OfficeRunner } from './copilot-runner.ts'
import { generateAgentTemplate, generateSkill } from './template-generator.ts'
import { checkAvailability, checkAllAvailability, CLI_IDS } from './cli-adapters.ts'
import { synthesizeAnswers, type AnswerInput } from './synthesizer.ts'
import type { AgentCli, AgentConfig, MemoryLink, ServerMessage } from './types.ts'

const MAX_AGENTS = 8

const UNKNOWN_CLI = { error: 'CLI no reconocido.' }
const NAME_REQUIRED = { error: 'El nombre es obligatorio.' }
const PROMPT_REQUIRED = { error: 'El prompt es obligatorio.' }

// ---- Helpers HTTP (sin Express; trabajamos con req/res crudos) ----

/**
 * Escribe una respuesta JSON. Devuelve siempre `true` para que los enrutadores
 * puedan hacer `return sendJson(...)`, donde el booleano significa "atendida".
 */
function sendJson(res: ServerResponse, status: number, data: unknown): true {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
  return true
}

/** Respuesta 204 sin cuerpo. */
function sendEmpty(res: ServerResponse): true {
  res.writeHead(204).end()
  return true
}

/**
 * Ejecuta `produce` y responde con su resultado; si lanza, devuelve el mensaje
 * de error con el estado indicado. Concentra el try/catch que antes se repetía
 * en cada ruta de escritura.
 */
async function sendResult(
  res: ServerResponse,
  status: number,
  produce: () => unknown,
  errorStatus = 400,
): Promise<true> {
  try {
    const value = await produce()
    return status === 204 ? sendEmpty(res) : sendJson(res, status, value)
  } catch (e) {
    return sendJson(res, errorStatus, { error: (e as Error).message })
  }
}

function readBody(req: Connect.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function readJson(req: Connect.IncomingMessage): Promise<unknown> {
  const raw = await readBody(req)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// ---- Enrutado ----

/** Datos ya normalizados de la petición, compartidos por todos los enrutadores. */
interface ApiContext {
  req: Connect.IncomingMessage
  res: ServerResponse
  method: string
  /** Ruta sin query string, p.ej. `/api/agents/42`. */
  path: string
  /** `"<MÉTODO> <ruta>"`, para comparar de un vistazo en vez de `method === … && path === …`. */
  route: string
  query: URLSearchParams
}

/**
 * Un enrutador atiende la petición y devuelve `true`, o devuelve `false` para
 * que se pruebe el siguiente.
 */
type ApiHandler = (ctx: ApiContext) => Promise<boolean>

/** Id de un recurso bajo `prefix` (`/api/skills/foo` → `foo`), o null si no encaja. */
function resourceId(path: string, prefix: string): string | null {
  if (!path.startsWith(`${prefix}/`)) return null
  const rest = path.slice(prefix.length + 1)
  if (!rest || rest.includes('/')) return null
  return decodeURIComponent(rest)
}

/** Devuelve el CLI si el valor es uno de los soportados; null en caso contrario. */
function parseCli(value: unknown): AgentCli | null {
  return CLI_IDS.includes(value as AgentCli) ? (value as AgentCli) : null
}

// ---- Catálogos y estado de los CLIs ----

async function handleCatalogs(ctx: ApiContext): Promise<boolean> {
  const { res, route } = ctx
  if (route === 'GET /api/skills') return sendJson(res, 200, getSkills())
  if (route === 'GET /api/templates') return sendJson(res, 200, getAgentTemplates())
  if (route === 'GET /api/cli/status') return sendJson(res, 200, await checkAllAvailability())
  if (route === 'GET /api/models') {
    const cli = parseCli(ctx.query.get('cli') ?? 'copilot')
    return cli ? sendJson(res, 200, getModels(cli)) : sendJson(res, 400, UNKNOWN_CLI)
  }
  if (route === 'POST /api/models/refresh') {
    const cli = parseCli(((await readJson(ctx.req)) as { cli?: string }).cli ?? 'copilot')
    if (!cli) return sendJson(res, 400, UNKNOWN_CLI)
    return sendResult(res, 200, () => refreshModels(cli), 502)
  }
  if (route === 'POST /api/cli/check') {
    const cli = parseCli(((await readJson(ctx.req)) as { cli?: string }).cli)
    if (!cli) return sendJson(res, 400, UNKNOWN_CLI)
    return sendJson(res, 200, await checkAvailability(cli))
  }
  return false
}

// ---- Generación con IA de skills y plantillas ----

async function handleGeneration(ctx: ApiContext): Promise<boolean> {
  const { res, route } = ctx
  const isSkill = route === 'POST /api/skills/generate'
  if (!isSkill && route !== 'POST /api/templates/generate') return false

  const b = (await readJson(ctx.req)) as { prompt?: string; model?: string }
  const prompt = b.prompt?.trim()
  if (!prompt) return sendJson(res, 400, PROMPT_REQUIRED)

  const model = b.model || undefined
  const generate = isSkill ? generateSkill : generateAgentTemplate
  return sendResult(res, 201, () => generate(prompt, model))
}

// ---- CRUD de los recursos markdown (.skills/ y .agents/) ----

/**
 * Skills y plantillas se guardan igual (un .md con frontmatter) y exponen la
 * misma API, así que comparten enrutador y sólo cambian las funciones de acceso.
 */
interface MarkdownResource {
  prefix: string
  read: (id: string) => string
  create: (name: string, body: string, applyTo?: string) => unknown
  update: (id: string, name: string, body: string, applyTo?: string) => unknown
  remove: (id: string) => void
}

const SKILL_RESOURCE: MarkdownResource = {
  prefix: '/api/skills',
  read: getSkillBody,
  create: (name, body, applyTo) => createSkill(name, body, applyTo),
  update: (id, name, body, applyTo) => updateSkill(id, name, body, applyTo),
  remove: deleteSkill,
}

const TEMPLATE_RESOURCE: MarkdownResource = {
  prefix: '/api/templates',
  read: getAgentTemplateBody,
  create: (name, body) => createTemplate(name, body),
  update: (id, name, body) => updateTemplate(id, name, body),
  remove: deleteTemplate,
}

/** Cuerpo común de las rutas de creación y actualización. */
interface MarkdownBody {
  name?: string
  body?: string
  applyTo?: string
}

function markdownResourceHandler(resource: MarkdownResource): ApiHandler {
  return async (ctx: ApiContext): Promise<boolean> => {
    const { req, res, method, path } = ctx

    if (ctx.route === `POST ${resource.prefix}`) {
      const b = (await readJson(req)) as MarkdownBody
      const name = b.name?.trim()
      if (!name) return sendJson(res, 400, NAME_REQUIRED)
      return sendResult(res, 201, () => resource.create(name, b.body ?? '', b.applyTo))
    }

    const id = resourceId(path, resource.prefix)
    if (id === null) return false

    if (method === 'GET') return sendJson(res, 200, { body: resource.read(id) })
    if (method === 'DELETE') return sendResult(res, 204, () => resource.remove(id))
    if (method === 'PUT') {
      const b = (await readJson(req)) as MarkdownBody
      const name = b.name?.trim()
      if (!name) return sendJson(res, 400, NAME_REQUIRED)
      return sendResult(res, 200, () => resource.update(id, name, b.body ?? '', b.applyTo))
    }
    return false
  }
}

// ---- CRUD del equipo ----

/** Valida y normaliza el cuerpo de un agente. Devuelve error legible o el agente. */
function validateAgent(body: unknown): { agent: Omit<AgentConfig, 'id'> } | { error: string } {
  const b = body as Record<string, unknown>
  const name = typeof b?.name === 'string' ? b.name.trim() : ''
  if (!name) return { error: 'El nombre es obligatorio.' }

  const avatar = typeof b?.avatar === 'string' ? b.avatar : 'avatar-1'
  const agentFile = typeof b?.agentFile === 'string' ? b.agentFile : ''
  if (!getAgentTemplates().some((t) => t.file === agentFile)) {
    return { error: `La plantilla de agente "${agentFile}" no existe.` }
  }

  const cli = parseCli(b?.cli) ?? 'copilot'

  const model = typeof b?.model === 'string' ? b.model : ''
  if (!model) return { error: 'El modelo es obligatorio.' }
  // Solo validamos contra el catálogo del CLI si ya se han recargado sus
  // modelos; si aún no (caché vacía), aceptamos cualquier id para no bloquear
  // la edición de agentes.
  if (getModels(cli).length > 0 && !isValidModel(cli, model)) {
    return { error: `El modelo "${model}" no es válido para ${cli}.` }
  }

  const validSkills = new Set(getSkills().map((s) => s.id))
  const skills = Array.isArray(b?.skills)
    ? (b.skills as unknown[]).filter((s): s is string => typeof s === 'string' && validSkills.has(s))
    : []

  return { agent: { name, avatar, agentFile, model, skills, cli } }
}

async function createAgent(ctx: ApiContext): Promise<boolean> {
  const team = readTeam()
  if (team.length >= MAX_AGENTS) {
    return sendJson(ctx.res, 400, { error: `Máximo ${MAX_AGENTS} agentes.` })
  }
  const result = validateAgent(await readJson(ctx.req))
  if ('error' in result) return sendJson(ctx.res, 400, { error: result.error })

  const agent: AgentConfig = { id: randomUUID(), ...result.agent }
  team.push(agent)
  writeTeam(team)
  return sendJson(ctx.res, 201, agent)
}

async function handleAgents(ctx: ApiContext): Promise<boolean> {
  const { req, res, method, path } = ctx
  if (ctx.route === 'GET /api/agents') return sendJson(res, 200, readTeam())
  if (ctx.route === 'POST /api/agents') return createAgent(ctx)

  const id = resourceId(path, '/api/agents')
  if (id === null) return false
  if (method !== 'PUT' && method !== 'DELETE') return false

  const team = readTeam()
  const idx = team.findIndex((a) => a.id === id)
  if (idx === -1) return sendJson(res, 404, { error: 'Agente no encontrado.' })

  if (method === 'DELETE') {
    writeTeam(team.filter((a) => a.id !== id))
    return sendEmpty(res)
  }

  const result = validateAgent(await readJson(req))
  if ('error' in result) return sendJson(res, 400, { error: result.error })
  team[idx] = { id, ...result.agent }
  writeTeam(team)
  return sendJson(res, 200, team[idx])
}

// ---- Enlaces de memoria entre agentes ----

/** Se queda con los pares [string, string]; descarta cualquier otra forma. */
function parseMemoryLinks(value: unknown): MemoryLink[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[]).filter(
    (l): l is MemoryLink =>
      Array.isArray(l) && l.length === 2 && typeof l[0] === 'string' && typeof l[1] === 'string',
  )
}

async function handleMemory(ctx: ApiContext): Promise<boolean> {
  if (ctx.route === 'GET /api/memory') return sendJson(ctx.res, 200, readMemoryLinks())
  if (ctx.route !== 'PUT /api/memory') return false

  const b = (await readJson(ctx.req)) as { links?: unknown }
  writeMemoryLinks(parseMemoryLinks(b.links))
  return sendJson(ctx.res, 200, readMemoryLinks())
}

// ---- Síntesis del equipo: combina respuestas en una conclusión ----

/** Se queda con las respuestas que traen nombre y texto. */
function parseAnswers(value: unknown): AnswerInput[] {
  if (!Array.isArray(value)) return []
  return (value as unknown[])
    .map((a) => a as { name?: unknown; text?: unknown })
    .filter((a) => typeof a.name === 'string' && typeof a.text === 'string')
    .map((a) => ({ name: a.name as string, text: a.text as string }))
}

async function handleSynthesize(ctx: ApiContext): Promise<boolean> {
  if (ctx.route !== 'POST /api/synthesize') return false

  const b = (await readJson(ctx.req)) as { prompt?: string; answers?: unknown }
  const prompt = b.prompt?.trim()
  if (!prompt) return sendJson(ctx.res, 400, { error: 'Falta el prompt.' })

  const answers = parseAnswers(b.answers)
  if (answers.length < 2) {
    return sendJson(ctx.res, 400, { error: 'Se necesitan al menos 2 respuestas.' })
  }
  return sendResult(ctx.res, 200, async () => ({ text: await synthesizeAnswers(prompt, answers) }), 502)
}

// ---- Ronda de ejecución (streaming NDJSON) ----

async function handleRun(ctx: ApiContext): Promise<boolean> {
  if (ctx.route !== 'POST /api/run') return false

  const { req, res } = ctx
  const body = (await readJson(req)) as { prompt?: string }
  const prompt = body.prompt?.trim()
  if (!prompt) return sendJson(res, 400, { error: 'Falta el prompt.' })

  const team = readTeam()
  const memoryLinks = readMemoryLinks()
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  if (team.length === 0) {
    res.end(JSON.stringify({ type: 'run-finished' } satisfies ServerMessage) + '\n')
    return true
  }

  const runner = new OfficeRunner()
  const send = (msg: ServerMessage) => {
    if (!res.writableEnded) res.write(JSON.stringify(msg) + '\n')
  }
  // Cancelación: si el cliente aborta la petición, matamos los procesos.
  req.on('close', () => {
    if (runner.isRunning) runner.cancel()
  })

  await runner.run(team, prompt, send, memoryLinks)
  if (!res.writableEnded) res.end()
  return true
}

/**
 * Orden de los enrutadores. `handleGeneration` va antes que los CRUD de
 * recursos porque `/api/skills/generate` también encajaría como un id de skill.
 */
const HANDLERS: ApiHandler[] = [
  handleCatalogs,
  handleGeneration,
  markdownResourceHandler(SKILL_RESOURCE),
  markdownResourceHandler(TEMPLATE_RESOURCE),
  handleAgents,
  handleMemory,
  handleSynthesize,
  handleRun,
]

/**
 * Plugin que convierte el dev server de Vite en el backend de la app:
 * expone /api/* y hace streaming NDJSON de las rondas. Un único proceso.
 */
export function officeApiPlugin(): Plugin {
  return {
    name: 'agent-colony-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()

        const [path, search] = url.split('?')
        const method = req.method ?? 'GET'
        const ctx: ApiContext = {
          req,
          res,
          method,
          path,
          route: `${method} ${path}`,
          query: new URLSearchParams(search ?? ''),
        }

        try {
          for (const handle of HANDLERS) {
            if (await handle(ctx)) return
          }
          return next()
        } catch (err) {
          if (!res.headersSent) sendJson(res, 500, { error: (err as Error).message })
          else if (!res.writableEnded) res.end()
        }
      })
    },
  }
}
