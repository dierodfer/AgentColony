import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentCli } from './types.ts'

/**
 * Política de ejecución (seguridad) por CLI. Fuente ÚNICA de cómo se fuerza el
 * modo "Q&A puro, solo lectura" en cada agente. Reutilizada por el runner, por
 * runOnce y por el chequeo de disponibilidad.
 *
 * Los flags/config están verificados contra la documentación oficial:
 * - copilot: `--deny-tool write` / `--deny-tool shell` bloquean edición y shell.
 * - claude:  `--permission-mode dontAsk` auto-deniega cualquier herramienta que
 *   pediría permiso; `--disallowedTools` son deny rules DURAS (aplican en todos
 *   los modos). (No usamos `--bare`: rompería la auth por OAuth/suscripción.)
 * - opencode: no hay flag CLI; se apunta `OPENCODE_CONFIG` a un perfil propio
 *   con `permission: { edit/bash/write/patch: "deny" }`.
 *
 * Nota: el chequeo de disponibilidad solo valida `--version`, no estos flags de
 * ejecución. Además ejecutamos en un cwd aislado (fuera del repo) como cinturón
 * de seguridad agnóstico de CLI: evita que claude/opencode descubran la config
 * del proyecto (CLAUDE.md, .mcp.json, opencode.json, hooks) hacia arriba.
 */
export interface CliPolicy {
  /** Flags que fuerzan el modo solo-lectura, añadidos tras los args funcionales. */
  readOnlyArgs: string[]
  /** Variables de entorno extra (p.ej. OPENCODE_CONFIG). */
  env: Record<string, string>
  /** Ejecutar en un cwd aislado y vacío en vez del cwd del proyecto. */
  isolateCwd: boolean
}

/** Ruta absoluta al perfil de solo-lectura de opencode (commiteado en el repo). */
const OPENCODE_READONLY_CONFIG = fileURLToPath(
  new URL('./cli-profiles/opencode-readonly.json', import.meta.url),
)

const DEFAULT_POLICIES: Record<AgentCli, CliPolicy> = {
  copilot: {
    readOnlyArgs: ['--deny-tool', 'write', '--deny-tool', 'shell'],
    env: {},
    isolateCwd: true,
  },
  claude: {
    readOnlyArgs: [
      '--permission-mode',
      'dontAsk',
      '--disallowedTools',
      'Bash,Write,Edit,MultiEdit,NotebookEdit,WebFetch,WebSearch',
    ],
    env: {},
    isolateCwd: true,
  },
  opencode: {
    readOnlyArgs: [],
    env: { OPENCODE_CONFIG: OPENCODE_READONLY_CONFIG },
    isolateCwd: true,
  },
}

/**
 * Overrides de política definidos por el usuario. Hoy vacío: es el gancho de
 * configuración futura (p.ej. leer agent-colony.config.json o variables de
 * entorno) sin tocar los call-sites. Se mergea sobre DEFAULT_POLICIES.
 */
function loadUserOverrides(): Partial<Record<AgentCli, Partial<CliPolicy>>> {
  return {}
}

/** Política efectiva de un CLI (defaults + overrides del usuario). */
export function getPolicy(cli: AgentCli): CliPolicy {
  const base = DEFAULT_POLICIES[cli] ?? DEFAULT_POLICIES.copilot
  const override = loadUserOverrides()[cli]
  return override ? { ...base, ...override } : base
}

/** Directorio aislado y vacío (fuera del repo) donde ejecutar los procesos. */
export function getSandboxCwd(): string {
  const dir = join(tmpdir(), 'agent-colony-sandbox')
  mkdirSync(dir, { recursive: true })
  return dir
}
