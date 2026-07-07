import type { CSSProperties } from 'react'
import type { AgentCli } from '../types'
import { cliInfo } from '../lib/clis'
import { CliLogo } from './CliLogo'

/**
 * Insignia pequeña con el logo oficial del CLI que ejecuta al agente, para
 * superponer en una esquina del robot. Opcionalmente muestra un punto de
 * disponibilidad (verde/rojo).
 */

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
  const meta = cliInfo(cli)
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
      <CliLogo cli={cli} size={size * 0.6} />
      {dot && (
        <span
          className="absolute -right-0.5 -top-0.5 rounded-full ring-2"
          style={{
            width: size * 0.34,
            height: size * 0.34,
            backgroundColor: dot,
            '--tw-ring-color': 'rgba(11,15,23,0.92)',
          } as CSSProperties}
        />
      )}
    </span>
  )
}
