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

// ---- Helpers HTTP (sin Express; trabajamos con req/res crudos) ----

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
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

  const cli: AgentCli = CLI_IDS.includes(b?.cli as AgentCli) ? (b.cli as AgentCli) : 'copilot'

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
        const method = req.method ?? 'GET'
        if (!url.startsWith('/api/')) return next()

        const path = url.split('?')[0]

        try {
          // ---- Catálogos ----
          if (method === 'GET' && path === '/api/models') {
            const q = new URLSearchParams(url.split('?')[1] ?? '')
            const cli = q.get('cli') ?? 'copilot'
            if (!CLI_IDS.includes(cli as AgentCli)) {
              return sendJson(res, 400, { error: 'CLI no reconocido.' })
            }
            return sendJson(res, 200, getModels(cli as AgentCli))
          }
          if (method === 'GET' && path === '/api/skills') return sendJson(res, 200, getSkills())

          // ---- Recargar modelos del CLI indicado, bajo demanda ----
          if (method === 'POST' && path === '/api/models/refresh') {
            const b = (await readJson(req)) as { cli?: string }
            const cli = b.cli ?? 'copilot'
            if (!CLI_IDS.includes(cli as AgentCli)) {
              return sendJson(res, 400, { error: 'CLI no reconocido.' })
            }
            try {
              return sendJson(res, 200, await refreshModels(cli as AgentCli))
            } catch (e) {
              return sendJson(res, 502, { error: (e as Error).message })
            }
          }

          // ---- Disponibilidad de CLIs (copilot/claude/opencode) ----
          if (method === 'GET' && path === '/api/cli/status') {
            return sendJson(res, 200, await checkAllAvailability())
          }
          if (method === 'POST' && path === '/api/cli/check') {
            const b = (await readJson(req)) as { cli?: string }
            if (!CLI_IDS.includes(b.cli as AgentCli)) {
              return sendJson(res, 400, { error: 'CLI no reconocido.' })
            }
            return sendJson(res, 200, await checkAvailability(b.cli as AgentCli))
          }
          if (method === 'GET' && path === '/api/templates') return sendJson(res, 200, getAgentTemplates())

          // ---- Generar skill con IA ----
          if (method === 'POST' && path === '/api/skills/generate') {
            const b = (await readJson(req)) as { prompt?: string; model?: string }
            if (!b.prompt?.trim()) return sendJson(res, 400, { error: 'El prompt es obligatorio.' })
            try {
              const skill = await generateSkill(b.prompt, b.model || undefined)
              return sendJson(res, 201, skill)
            } catch (e) {
              return sendJson(res, 400, { error: (e as Error).message })
            }
          }

          // ---- Crear skill / plantilla (escriben en .skills/ y .agents/) ----
          if (method === 'POST' && path === '/api/skills') {
            const b = (await readJson(req)) as { name?: string; body?: string; applyTo?: string }
            if (!b.name?.trim()) return sendJson(res, 400, { error: 'El nombre es obligatorio.' })
            try {
              return sendJson(res, 201, createSkill(b.name, b.body ?? '', b.applyTo))
            } catch (e) {
              return sendJson(res, 400, { error: (e as Error).message })
            }
          }

          if (method === 'POST' && path === '/api/templates') {
            const b = (await readJson(req)) as { name?: string; body?: string }
            if (!b.name?.trim()) return sendJson(res, 400, { error: 'El nombre es obligatorio.' })
            try {
              return sendJson(res, 201, createTemplate(b.name, b.body ?? ''))
            } catch (e) {
              return sendJson(res, 400, { error: (e as Error).message })
            }
          }

          // ---- Generar template con IA ----
          if (method === 'POST' && path === '/api/templates/generate') {
            const b = (await readJson(req)) as { prompt?: string; model?: string }
            if (!b.prompt?.trim()) return sendJson(res, 400, { error: 'El prompt es obligatorio.' })
            try {
              const tpl = await generateAgentTemplate(b.prompt, b.model || undefined)
              return sendJson(res, 201, tpl)
            } catch (e) {
              return sendJson(res, 400, { error: (e as Error).message })
            }
          }

          // ---- CRUD de templates y skills individuales ----
          const tplMatch = path.match(/^\/api\/templates\/([^/]+)$/)
          if (tplMatch) {
            const file = decodeURIComponent(tplMatch[1])
            if (method === 'GET') return sendJson(res, 200, { body: getAgentTemplateBody(file) })
            if (method === 'PUT') {
              const b = (await readJson(req)) as { name?: string; body?: string }
              if (!b.name?.trim()) return sendJson(res, 400, { error: 'El nombre es obligatorio.' })
              try {
                return sendJson(res, 200, updateTemplate(file, b.name, b.body ?? ''))
              } catch (e) {
                return sendJson(res, 400, { error: (e as Error).message })
              }
            }
            if (method === 'DELETE') {
              try {
                deleteTemplate(file)
                res.writeHead(204).end()
                return
              } catch (e) {
                return sendJson(res, 400, { error: (e as Error).message })
              }
            }
          }

          const skillMatch = path.match(/^\/api\/skills\/([^/]+)$/)
          if (skillMatch) {
            const id = decodeURIComponent(skillMatch[1])
            if (method === 'GET') return sendJson(res, 200, { body: getSkillBody(id) })
            if (method === 'PUT') {
              const b = (await readJson(req)) as { name?: string; body?: string; applyTo?: string }
              if (!b.name?.trim()) return sendJson(res, 400, { error: 'El nombre es obligatorio.' })
              try {
                return sendJson(res, 200, updateSkill(id, b.name, b.body ?? '', b.applyTo))
              } catch (e) {
                return sendJson(res, 400, { error: (e as Error).message })
              }
            }
            if (method === 'DELETE') {
              try {
                deleteSkill(id)
                res.writeHead(204).end()
                return
              } catch (e) {
                return sendJson(res, 400, { error: (e as Error).message })
              }
            }
          }

          // ---- CRUD del equipo ----
          if (method === 'GET' && path === '/api/agents') return sendJson(res, 200, readTeam())

          if (method === 'POST' && path === '/api/agents') {
            const team = readTeam()
            if (team.length >= MAX_AGENTS) {
              return sendJson(res, 400, { error: `Máximo ${MAX_AGENTS} agentes.` })
            }
            const result = validateAgent(await readJson(req))
            if ('error' in result) return sendJson(res, 400, { error: result.error })
            const agent: AgentConfig = { id: randomUUID(), ...result.agent }
            team.push(agent)
            writeTeam(team)
            return sendJson(res, 201, agent)
          }

          const agentMatch = path.match(/^\/api\/agents\/([^/]+)$/)
          if (agentMatch && (method === 'PUT' || method === 'DELETE')) {
            const id = decodeURIComponent(agentMatch[1])
            const team = readTeam()
            const idx = team.findIndex((a) => a.id === id)
            if (idx === -1) return sendJson(res, 404, { error: 'Agente no encontrado.' })

            if (method === 'DELETE') {
              writeTeam(team.filter((a) => a.id !== id))
              res.writeHead(204).end()
              return
            }
            const result = validateAgent(await readJson(req))
            if ('error' in result) return sendJson(res, 400, { error: result.error })
            team[idx] = { id, ...result.agent }
            writeTeam(team)
            return sendJson(res, 200, team[idx])
          }

          // ---- Enlaces de memoria entre agentes ----
          if (method === 'GET' && path === '/api/memory') return sendJson(res, 200, readMemoryLinks())
          if (method === 'PUT' && path === '/api/memory') {
            const b = (await readJson(req)) as { links?: unknown }
            const links = Array.isArray(b.links)
              ? (b.links as unknown[]).filter(
                  (l): l is MemoryLink =>
                    Array.isArray(l) && l.length === 2 && typeof l[0] === 'string' && typeof l[1] === 'string',
                )
              : []
            writeMemoryLinks(links)
            return sendJson(res, 200, readMemoryLinks())
          }

          // ---- Síntesis del equipo: combina respuestas en una conclusión ----
          if (method === 'POST' && path === '/api/synthesize') {
            const b = (await readJson(req)) as { prompt?: string; answers?: unknown }
            const prompt = b.prompt?.trim()
            if (!prompt) return sendJson(res, 400, { error: 'Falta el prompt.' })
            const answers: AnswerInput[] = Array.isArray(b.answers)
              ? (b.answers as unknown[])
                  .map((a) => a as { name?: unknown; text?: unknown })
                  .filter((a) => typeof a.name === 'string' && typeof a.text === 'string')
                  .map((a) => ({ name: a.name as string, text: a.text as string }))
              : []
            if (answers.length < 2) return sendJson(res, 400, { error: 'Se necesitan al menos 2 respuestas.' })
            try {
              return sendJson(res, 200, { text: await synthesizeAnswers(prompt, answers) })
            } catch (e) {
              return sendJson(res, 502, { error: (e as Error).message })
            }
          }

          // ---- Ronda de ejecución (streaming NDJSON) ----
          if (method === 'POST' && path === '/api/run') {
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
              return
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
            return
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
