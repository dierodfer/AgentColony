import type { AgentCli } from '../types'

/**
 * Insignia pequeña con la marca del CLI que ejecuta al agente, para superponer
 * en una esquina del robot. Marcas propias estilizadas (no logos de terceros):
 * copilot = anillo/gafas, claude = destello, opencode = corchetes </>.
 * Opcionalmente muestra un punto de disponibilidad (verde/rojo).
 */

const CLI_META: Record<AgentCli, { label: string; color: string }> = {
  copilot: { label: 'GitHub Copilot CLI', color: '#7C93FF' },
  claude: { label: 'Claude Code', color: '#D97757' },
  opencode: { label: 'opencode', color: '#57C7B8' },
}

function CliMark({ cli }: { cli: AgentCli }) {
  if (cli === 'claude') {
    // Destello de 4 puntas (asterisco redondeado).
    return (
      <path
        d="M8 2.6c.5 2 .9 2.4 2.9 2.9-2 .5-2.4.9-2.9 2.9-.5-2-.9-2.4-2.9-2.9 2-.5 2.4-.9 2.9-2.9z"
        transform="translate(0 0.5)"
        fill="currentColor"
      />
    )
  }
  if (cli === 'opencode') {
    // Corchetes </>
    return (
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.4 5.5 4.3 8l2.1 2.5" />
        <path d="M9.6 5.5 11.7 8l-2.1 2.5" />
      </g>
    )
  }
  // copilot: anillo con dos "ojos".
  return (
    <g>
      <circle cx="8" cy="8" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6.7" cy="8" r="0.9" fill="currentColor" />
      <circle cx="9.3" cy="8" r="0.9" fill="currentColor" />
    </g>
  )
}

export function CliBadge({
  cli,
  size = 20,
  available,
}: {
  cli: AgentCli
  size?: number
  /** true=verde, false=rojo, undefined=sin indicador. */
  available?: boolean
}) {
  const meta = CLI_META[cli] ?? CLI_META.copilot
  const dot = available === undefined ? null : available ? 'var(--color-st-finished)' : 'var(--color-st-error)'
  const title = available === undefined
    ? meta.label
    : `${meta.label} · ${available ? 'disponible' : 'no disponible'}`

  return (
    <span
      title={title}
      className="relative inline-flex items-center justify-center rounded-full border border-black/40 shadow-md shadow-black/40"
      style={{
        width: size,
        height: size,
        backgroundColor: 'rgba(11,15,23,0.92)',
        color: meta.color,
      }}
    >
      <svg viewBox="0 0 16 16" width={size * 0.72} height={size * 0.72} aria-hidden>
        <CliMark cli={cli} />
      </svg>
      {dot && (
        <span
          className="absolute -right-0.5 -top-0.5 rounded-full ring-2"
          style={{
            width: size * 0.34,
            height: size * 0.34,
            backgroundColor: dot,
            // @ts-expect-error CSS var para el color del ring
            '--tw-ring-color': 'rgba(11,15,23,0.92)',
          }}
        />
      )}
    </span>
  )
}
