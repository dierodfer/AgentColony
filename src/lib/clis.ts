import type { AgentCli } from '../types'

/**
 * Descriptor único de los CLIs de agente para el frontend (etiqueta legible y
 * color de marca). Fuente única usada por el selector del editor y por el badge
 * del robot, para no repetir la lista. El backend tiene su propia lista de
 * ejecución/preferencia en server/cli-adapters.ts (frontera front/back).
 */
export interface CliDescriptor {
  id: AgentCli
  label: string
  color: string
}

export const CLIS: CliDescriptor[] = [
  { id: 'copilot', label: 'GitHub Copilot CLI', color: '#7C93FF' },
  { id: 'claude', label: 'Claude Code', color: '#D97757' },
  { id: 'opencode', label: 'opencode', color: '#57C7B8' },
]

const CLI_MAP = new Map(CLIS.map((c) => [c.id, c]))

/** Descriptor de un CLI (copilot por defecto si el id no se reconoce). */
export function cliInfo(cli: AgentCli): CliDescriptor {
  return CLI_MAP.get(cli) ?? CLIS[0]
}
