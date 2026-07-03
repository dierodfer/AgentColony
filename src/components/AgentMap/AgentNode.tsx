import { useMemo } from 'react'
import type { RefObject } from 'react'
import { motion } from 'framer-motion'
import { AgentRobot } from '../AgentIdentity'
import type { AgentConfig, AgentStatus } from '../../types'
import type { NodePos } from '../../lib/nodeLayout'

const STATUS_GLOW: Record<AgentStatus, string> = {
  idle: 'var(--color-st-idle)',
  starting: 'var(--color-st-starting)',
  thinking: 'var(--color-st-thinking)',
  responding: 'var(--color-st-responding)',
  finished: 'var(--color-st-finished)',
  error: 'var(--color-st-error)',
}

/**
 * Nodo flotante de un agente: posición "semifija" (home o, tras arrastrar,
 * la última posición donde se soltó), con una capa de flotación continua
 * (bobbing) independiente del drag para que ambos transforms no se pisen.
 * El drag usa `dragConstraints` sobre el contenedor del mapa; al soltar se
 * remonta con `key` (posición ya integrada en `anchor`) para resetear el
 * offset interno de Framer Motion.
 */
export function AgentNode({
  agent,
  status,
  accent,
  anchor,
  depth,
  containerRef,
  onDragEnd,
  infoOpen,
  onToggleInfo,
}: {
  agent: AgentConfig
  status: AgentStatus
  accent: string
  anchor: NodePos
  depth: number
  containerRef: RefObject<HTMLDivElement | null>
  onDragEnd: (agentId: string, next: NodePos) => void
  infoOpen: boolean
  onToggleInfo: () => void
}) {
  const seed = useMemo(() => [...agent.id].reduce((a, c) => a + c.charCodeAt(0), 0), [agent.id])
  const bobAmplitude = 6 + (seed % 5)
  const bobDuration = 3.4 + (seed % 5) * 0.4
  const bobDelay = (seed % 10) / 5
  const glow = STATUS_GLOW[status]
  const size = Math.round(64 * depth)

  return (
    <motion.div
      key={`${Math.round(anchor.x)}-${Math.round(anchor.y)}`}
      drag
      dragMomentum={false}
      dragElastic={0.15}
      dragConstraints={containerRef}
      onDragEnd={(_e, info) =>
        onDragEnd(agent.id, { x: anchor.x + info.offset.x, y: anchor.y + info.offset.y })
      }
      whileDrag={{ scale: 1.08 }}
      className="absolute cursor-grab touch-none select-none active:cursor-grabbing"
      style={{ left: anchor.x, top: anchor.y, zIndex: 10 + Math.round(depth * 10) }}
    >
      <motion.div
        animate={{ y: [0, -bobAmplitude, 0] }}
        transition={{ duration: bobDuration, repeat: Infinity, ease: 'easeInOut', delay: bobDelay }}
        className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
        style={{
          filter: `blur(${((1 - depth) * 2).toFixed(2)}px)`,
          opacity: 0.55 + depth * 0.45,
          willChange: 'transform',
        }}
      >
        <div className="relative flex items-center justify-center">
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: size * 1.35,
              height: size * 1.35,
              background: `color-mix(in srgb, ${glow} 50%, transparent)`,
              filter: 'blur(16px)',
              zIndex: -1,
            }}
          />
          <AgentRobot id={agent.avatar} status={status} size={size} />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleInfo()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title={`Ver ficha de ${agent.name}`}
          className="whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium text-white/85 transition-transform hover:scale-105"
          style={{
            borderColor: infoOpen
              ? accent
              : `color-mix(in srgb, ${accent} 35%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${accent} 14%, rgba(11,15,23,0.72))`,
          }}
        >
          {agent.name}
        </button>
      </motion.div>
    </motion.div>
  )
}
