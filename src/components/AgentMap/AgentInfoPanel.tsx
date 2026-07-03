import { AnimatePresence, motion } from 'framer-motion'
import { AgentRobot } from '../AgentIdentity'
import type { NodePos } from '../../lib/nodeLayout'

const PANEL_WIDTH = 220
const NODE_GAP = 46

/**
 * Panel de identidad de un agente: nombre, avatar, plantilla (perfil) y
 * modelo/skills. Se abre al click sobre el nombre del nodo y permanece
 * estático (no se auto-cierra) hasta que el usuario lo cierra o vuelve a
 * pulsar el nombre. Anclado con las coordenadas del nodo, igual que
 * `AgentBubble`, para que no bobee con la animación de flotación.
 */
export function AgentInfoPanel({
  accent,
  name,
  avatar,
  templateName,
  model,
  skills,
  anchor,
  side,
  bounds,
  onClose,
}: {
  accent: string
  name: string
  avatar: string
  templateName: string
  model: string
  skills: string[]
  anchor: NodePos
  side: 'left' | 'right'
  bounds: { width: number; height: number }
  onClose: () => void
}) {
  const left =
    side === 'right'
      ? Math.min(anchor.x + NODE_GAP, bounds.width - PANEL_WIDTH - 8)
      : Math.max(anchor.x - NODE_GAP - PANEL_WIDTH, 8)
  const top = Math.min(Math.max(anchor.y - 40, 8), Math.max(bounds.height - 200, 8))

  return (
    <AnimatePresence>
      <motion.div
        key="info"
        initial={{ opacity: 0, scale: 0.85, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="absolute z-30"
        style={{ left, top, width: PANEL_WIDTH }}
      >
        <div
          className="relative rounded-2xl border p-3 shadow-lg backdrop-blur-sm"
          style={{
            borderColor: `color-mix(in srgb, ${accent} 30%, var(--color-line))`,
            backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
          }}
        >
          <div
            className="absolute top-10 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border"
            style={{
              [side === 'right' ? 'left' : 'right']: -5,
              borderColor: `color-mix(in srgb, ${accent} 30%, var(--color-line))`,
              backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
            }}
          />

          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <AgentRobot id={avatar} status="idle" size={32} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-white/90">{name}</p>
                <p className="truncate text-[11px] text-white/40">{templateName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-[11px] text-white/30 hover:text-white/60"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-lg border border-line bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/75">
              {model}
            </span>
            {skills.map((s) => (
              <span
                key={s}
                className="rounded-lg border border-line bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-white/55"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
