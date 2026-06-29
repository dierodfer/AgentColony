import type { AgentStatus } from '../types'

// Estados reales que emite el backend, presentados con etiquetas elegantes.
// `pulse` activa un latido suave (sólo en estados de trabajo).
const STATUS_META: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  idle: { label: 'En espera', color: 'var(--color-st-idle)', pulse: false },
  starting: { label: 'Conectando', color: 'var(--color-st-starting)', pulse: true },
  thinking: { label: 'Pensando', color: 'var(--color-st-thinking)', pulse: true },
  responding: { label: 'Respondiendo', color: 'var(--color-st-responding)', pulse: true },
  finished: { label: 'Completado', color: 'var(--color-st-finished)', pulse: false },
  error: { label: 'Error', color: 'var(--color-st-error)', pulse: false },
}

/** Indicador compacto del estado actual del agente: punto + etiqueta. */
export function StatusBadge({ status }: { status: AgentStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{
        color: meta.color,
        borderColor: `color-mix(in srgb, ${meta.color} 28%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
      }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.pulse ? 'status-pulse' : ''}`}
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  )
}
