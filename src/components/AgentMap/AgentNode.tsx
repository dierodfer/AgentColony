import { useMemo } from 'react'
import type { RefObject } from 'react'
import { motion } from 'framer-motion'
import { AgentRobot } from '../AgentIdentity'
import { CliBadge } from '../CliBadge'
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
function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
      <path
        d="M6.5 9.5 9.5 6.5M7 4.5 8.2 3.3a2.4 2.4 0 0 1 3.5 3.5L10.5 8M9 11.5 7.8 12.7a2.4 2.4 0 0 1-3.5-3.5L5.5 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
  available,
  linking,
  linkingActive,
  onStartLink,
  onLinkTarget,
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
  available?: boolean
  /** Este nodo es el origen de un enlace en curso. */
  linking: boolean
  /** Hay una sesión de enlace activa (de cualquier origen). */
  linkingActive: boolean
  onStartLink: () => void
  onLinkTarget: () => void
}) {
  const seed = useMemo(() => [...agent.id].reduce((a, c) => a + c.charCodeAt(0), 0), [agent.id])
  const bobAmplitude = 6 + (seed % 5)
  const bobDuration = 3.4 + (seed % 5) * 0.4
  const bobDelay = (seed % 10) / 5
  const glow = STATUS_GLOW[status]
  const size = Math.round(64 * depth)
  const badgeSize = Math.round(size * 0.34)

  // En modo enlace: los demás nodos son objetivos (aro pulsante); el origen se
  // resalta con el acento. Fuera de modo enlace, comportamiento normal (drag).
  const isTarget = linkingActive && !linking
  const ringColor = linking ? accent : isTarget ? 'var(--color-st-thinking)' : null

  return (
    <motion.div
      key={`${Math.round(anchor.x)}-${Math.round(anchor.y)}`}
      drag={!linkingActive}
      dragMomentum={false}
      dragElastic={0.15}
      dragConstraints={containerRef}
      onDragEnd={(_e, info) =>
        onDragEnd(agent.id, { x: anchor.x + info.offset.x, y: anchor.y + info.offset.y })
      }
      whileDrag={{ scale: 1.08 }}
      className={`group absolute touch-none select-none ${
        linkingActive ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      }`}
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
        <div
          className="relative flex items-center justify-center"
          onClick={(e) => {
            if (!linkingActive) return
            e.stopPropagation()
            onLinkTarget()
          }}
        >
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
          {ringColor && (
            <motion.div
              animate={isTarget ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: size * 1.15, height: size * 1.15, border: `2px solid ${ringColor}` }}
            />
          )}
          <AgentRobot id={agent.avatar} status={status} size={size} />
          <span className="absolute" style={{ right: -badgeSize * 0.35, bottom: -badgeSize * 0.35 }}>
            <CliBadge cli={agent.cli} size={badgeSize} available={available} />
          </span>

          {/* Botón conectar: aparece al hover, fuera del modo enlace. */}
          {!linkingActive && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStartLink()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title={`Conectar memoria de ${agent.name}`}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border text-white opacity-0 shadow-md shadow-black/40 transition-opacity duration-150 group-hover:opacity-100"
              style={{ backgroundColor: 'rgba(11,15,23,0.92)', borderColor: accent, color: accent }}
            >
              <LinkIcon />
            </button>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (linkingActive) onLinkTarget()
            else onToggleInfo()
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
