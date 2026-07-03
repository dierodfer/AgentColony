import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cleanText } from '../../lib/text'
import type { AgentRuntime, AgentStatus } from '../../types'
import type { NodePos } from '../../lib/nodeLayout'

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: 'var(--color-st-idle)',
  starting: 'var(--color-st-starting)',
  thinking: 'var(--color-st-thinking)',
  responding: 'var(--color-st-responding)',
  finished: 'var(--color-st-finished)',
  error: 'var(--color-st-error)',
}

const BUBBLE_WIDTH = 240
const BUBBLE_HEIGHT = 150
const NODE_GAP = 46

/**
 * Bocadillo de diálogo anclado a un nodo. Se muestra mientras el agente
 * trabaja o tiene respuesta, y permanece estático (no se auto-colapsa):
 * solo se minimiza a un icono si el usuario pulsa ✕, reexpandible al click.
 * El lado (`left`/`right`) y el clamping contra el contenedor los decide
 * `AgentMapView` por cuadrante del nodo.
 */
export function AgentBubble({
  accent,
  name,
  runtime,
  anchor,
  side,
  bounds,
}: {
  accent: string
  name: string
  runtime: AgentRuntime
  anchor: NodePos
  side: 'left' | 'right'
  bounds: { width: number; height: number }
}) {
  const { status, text, error } = runtime
  const isWorking = status === 'starting' || status === 'thinking'
  const display = status === 'error' ? error || 'Algo salió mal.' : cleanText(text)
  const visible = status !== 'idle' && (isWorking || !!display)

  const [collapsed, setCollapsed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status !== 'finished' && status !== 'error') setCollapsed(false)
  }, [status])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [display])

  if (!visible) return null

  const color = STATUS_COLOR[status]
  const left =
    side === 'right'
      ? Math.min(anchor.x + NODE_GAP, bounds.width - BUBBLE_WIDTH - 8)
      : Math.max(anchor.x - NODE_GAP - BUBBLE_WIDTH, 8)
  const top = Math.min(Math.max(anchor.y - BUBBLE_HEIGHT / 2, 8), Math.max(bounds.height - BUBBLE_HEIGHT - 8, 8))

  return (
    <AnimatePresence>
      {collapsed ? (
        <motion.button
          key="collapsed"
          onClick={() => setCollapsed(false)}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
          className="absolute z-30 flex h-7 w-7 items-center justify-center rounded-full border text-[12px]"
          style={{
            left: anchor.x + (side === 'right' ? NODE_GAP - 12 : -(NODE_GAP - 12)),
            top: anchor.y - 12,
            borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${color} 16%, rgba(18,24,38,0.9))`,
            color,
          }}
          title={`Ver respuesta de ${name}`}
          aria-label={`Ver respuesta de ${name}`}
        >
          ●
        </motion.button>
      ) : (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, scale: 0.85, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="absolute z-30"
          style={{ left, top }}
        >
          <div
            className="relative rounded-2xl border p-3 shadow-lg backdrop-blur-sm"
            style={{
              width: BUBBLE_WIDTH,
              borderColor: `color-mix(in srgb, ${accent} 30%, var(--color-line))`,
              backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
            }}
          >
            <div
              className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border"
              style={{
                [side === 'right' ? 'left' : 'right']: -5,
                borderColor: `color-mix(in srgb, ${accent} 30%, var(--color-line))`,
                backgroundColor: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
              }}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{name}</p>
              {(status === 'finished' || status === 'error') && (
                <button
                  onClick={() => setCollapsed(true)}
                  className="text-[11px] text-white/30 hover:text-white/60"
                  aria-label="Minimizar"
                >
                  ✕
                </button>
              )}
            </div>
            {isWorking && !display ? (
              <span className="mt-1 inline-flex items-center gap-1 py-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/40" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/40" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/40" />
              </span>
            ) : (
              <div ref={scrollRef} className="scroll-thin mt-1 max-h-24 overflow-y-auto">
                <p
                  className="whitespace-pre-line text-[12.5px] leading-relaxed"
                  style={{ color: status === 'error' ? 'var(--color-st-error)' : 'rgba(255,255,255,0.82)' }}
                >
                  {display}
                  {status === 'responding' && <span className="stream-caret ml-0.5 text-accent">▍</span>}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
