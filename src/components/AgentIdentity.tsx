import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import type { AgentStatus } from '../types'

// ---- Click animations (random) -----------------------------------------------

const CLICK_ANIMS = ['bounce', 'wiggle', 'hearts'] as const
type ClickAnim = (typeof CLICK_ANIMS)[number]

const CLICK_VARIANTS = {
  bounce: { animate: { scale: [1, 1.35, 0.85, 1.15, 0.95, 1] }, transition: { duration: 0.55, ease: 'easeInOut' as const } },
  wiggle: { animate: { rotate: [0, -12, 12, -8, 8, 0] }, transition: { duration: 0.4, ease: 'easeInOut' as const } },
  hearts: { animate: {}, transition: {} },
}

function randomClickAnim(): ClickAnim {
  return CLICK_ANIMS[Math.floor(Math.random() * CLICK_ANIMS.length)]
}

// Identidad visual de un agente: un robot-mascota animado (SVG paramétrico). El
// color del cuerpo y la forma de los ojos se derivan del id "avatar-N" (que se
// conserva por compatibilidad con office.config.json), de modo que dos agentes
// con distinto id nunca comparten icono. La expresión y la animación dependen
// del estado del agente (idle / trabajando / terminado / error).

export type EyeShape = 'oval' | 'round' | 'square'

export interface Identity {
  id: string
  /** Color del cuerpo (también el acento del agente: accentOf). */
  color: string
  /** Color brillante de los ojos sobre la pantalla oscura. */
  eye: string
  /** Forma neutral de los ojos (personalidad de cada robot). */
  eyes: EyeShape
}

/** Identidades premium (cuerpo + ojos), legibles sobre fondo oscuro. */
export const IDENTITIES: Identity[] = [
  { id: 'avatar-1', color: '#4F7CFF', eye: '#CFE3FF', eyes: 'oval' }, // azul
  { id: 'avatar-2', color: '#2DD4A7', eye: '#DBFFF4', eyes: 'round' }, // teal
  { id: 'avatar-3', color: '#A78BFA', eye: '#ECE3FF', eyes: 'square' }, // violeta
  { id: 'avatar-4', color: '#F5A524', eye: '#FFF1D6', eyes: 'oval' }, // ámbar
  { id: 'avatar-6', color: '#38BDF8', eye: '#DDF6FF', eyes: 'square' }, // cielo
  { id: 'avatar-8', color: '#FB7185', eye: '#FFE4E6', eyes: 'round' }, // coral
  { id: 'avatar-9', color: '#E6EAF2', eye: '#5BC8FF', eyes: 'oval' }, // claro
  { id: 'avatar-10', color: '#3A4356', eye: '#7FE7FF', eyes: 'square' }, // grafito
]

/** Alias retro-compatible (antes era una paleta de acentos). */
export const ACCENTS = IDENTITIES

const MAP = new Map(IDENTITIES.map((i) => [i.id, i]))

export function identityOf(id: string): Identity {
  return MAP.get(id) ?? IDENTITIES[0]
}

/** Color de acento de un agente a partir de su id de identidad (= cuerpo). */
export function accentOf(id: string): string {
  return identityOf(id).color
}

// ---- Helpers ----------------------------------------------------------------

/** Aclara (amt > 0) u oscurece (amt < 0) un hex #RRGGBB. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  const r = Math.round((t - ((n >> 16) & 255)) * p + ((n >> 16) & 255))
  const g = Math.round((t - ((n >> 8) & 255)) * p + ((n >> 8) & 255))
  const b = Math.round((t - (n & 255)) * p + (n & 255))
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

type Group = 'idle' | 'working' | 'done' | 'fail'

function groupOf(status: AgentStatus): Group {
  if (status === 'finished') return 'done'
  if (status === 'error') return 'fail'
  if (status === 'starting' || status === 'thinking' || status === 'responding') return 'working'
  return 'idle'
}

// ---- Ojos -------------------------------------------------------------------

const EYE_X = [19, 29] // centros horizontales de los dos ojos
const EYE_Y = 25

function NeutralEyes({ shape, color }: { shape: EyeShape; color: string }) {
  return (
    <>
      {EYE_X.map((cx) => {
        if (shape === 'round') return <circle key={cx} cx={cx} cy={EYE_Y} r={3} fill={color} />
        if (shape === 'square')
          return <rect key={cx} x={cx - 2.6} y={EYE_Y - 2.6} width={5.2} height={5.2} rx={1.6} fill={color} />
        return <rect key={cx} x={cx - 1.8} y={EYE_Y - 3.5} width={3.6} height={7} rx={1.8} fill={color} />
      })}
    </>
  )
}

function HeartEyes() {
  // Dos corazones centrados en EYE_X, EYE_Y
  return (
    <>
      {EYE_X.map((cx) => (
        <path
          key={cx}
          d={`M${cx} ${EYE_Y + 2.5} C${cx - 0.8} ${EYE_Y + 1},${cx - 3} ${EYE_Y - 0.5},${cx - 3} ${EYE_Y - 1.5} A1.5 1.5 0 0 1 ${cx} ${EYE_Y - 1.5} A1.5 1.5 0 0 1 ${cx + 3} ${EYE_Y - 1.5} C${cx + 3} ${EYE_Y - 0.5},${cx + 0.8} ${EYE_Y + 1},${cx} ${EYE_Y + 2.5}Z`}
          fill="#FF6B8A"
        />
      ))}
    </>
  )
}

function HappyEyes({ color }: { color: string }) {
  return (
    <g stroke={color} strokeWidth={2.4} strokeLinecap="round" fill="none">
      <path d="M15.6 24 Q19 28.6 22.4 24" />
      <path d="M25.6 24 Q29 28.6 32.4 24" />
    </g>
  )
}

function ErrorEyes({ color }: { color: string }) {
  return (
    <g stroke={color} strokeWidth={2} strokeLinecap="round">
      {EYE_X.map((cx) => (
        <g key={cx}>
          <line x1={cx - 2.4} y1={EYE_Y - 2.4} x2={cx + 2.4} y2={EYE_Y + 2.4} />
          <line x1={cx + 2.4} y1={EYE_Y - 2.4} x2={cx - 2.4} y2={EYE_Y + 2.4} />
        </g>
      ))}
    </g>
  )
}

// ---- Robot ------------------------------------------------------------------

/**
 * Robot-mascota de un agente. Abstracto pero con carácter: nunca una persona.
 * `id` determina cuerpo/ojos; `status` determina expresión y animación.
 */
export function AgentRobot({
  id,
  status = 'idle',
  size = 44,
}: {
  id: string
  status?: AgentStatus
  size?: number
}) {
  const { color, eye, eyes } = identityOf(id)
  const reduce = !!useReducedMotion()
  const uid = useId().replace(/:/g, '')
  const gid = `body-${uid}`
  const group = groupOf(status)

  // Click animation (random, re-triggerable).
  const [clickAnim, setClickAnim] = useState<ClickAnim | null>(null)
  const clickCount = useRef(0)
  const [showHearts, setShowHearts] = useState(false)

  // Ojos: vuelven a neutral 10s después de completar.
  const [eyeGroup, setEyeGroup] = useState<Group>(group)
  useEffect(() => {
    if (group === 'done') {
      setEyeGroup('done')
      const id = setTimeout(() => setEyeGroup('idle'), 10000)
      return () => clearTimeout(id)
    }
    setEyeGroup(group)
  }, [group])

  const handleClick = () => {
    clickCount.current += 1
    const anim = randomClickAnim()
    if (anim === 'hearts') {
      setShowHearts(true)
      setTimeout(() => setShowHearts(false), 1500)
    } else {
      setClickAnim(anim)
    }
  }

  const ca = clickAnim ? CLICK_VARIANTS[clickAnim] : null

  // Desfase determinista por instancia (parpadeo/flotación escalonados).
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0)
  const delay = (seed % 10) / 5 // 0..2s

  const expr = showHearts ? 'hearts' : eyeGroup === 'done' ? 'happy' : eyeGroup === 'fail' ? 'x' : 'neutral'
  const eyeColor = expr === 'x' ? '#FFB4B4' : eye
  const ear = shade(color, -0.14)

  // Animación a nivel SVG (flotar / bob / rebote / temblor).
  const svgVariants: Variants = {
    idle: { x: 0, y: 0, scale: 1 },
    working: { x: 0, scale: 1, y: [0, -1, 0], transition: { y: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } } },
    done: { x: 0, y: 0, scale: [1, 1.16, 0.95, 1.03, 1], transition: { duration: 0.6, ease: 'easeOut' } },
    fail: { y: 0, scale: 1, x: [0, -2.5, 2.5, -1.5, 1.5, 0], transition: { duration: 0.45, ease: 'easeInOut' } },
    rest: { x: 0, y: 0, scale: 1 },
  }

  return (
    <motion.div
      key={`click-${clickCount.current}`}
      onClick={handleClick}
      className="cursor-pointer"
      style={{ display: 'inline-flex', perspective: 600 }}
      animate={ca?.animate}
      transition={ca?.transition}
      onAnimationComplete={() => setClickAnim(null)}
    >
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="robot del agente"
      className="shrink-0"
      style={{ overflow: 'visible', transformOrigin: 'center' }}
      variants={svgVariants}
      animate={reduce ? 'rest' : group}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(color, 0.2)} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={shade(color, -0.16)} />
        </linearGradient>
      </defs>

      {/* Sombra de apoyo */}
      <ellipse cx="24" cy="41.5" rx="12.5" ry="2.4" fill="#000" opacity="0.18" />

      {/* Antena (se inclina al fallar) */}
      <motion.g
        style={{ transformBox: 'view-box', transformOrigin: '24px 12px' }}
        variants={{ idle: { rotate: 0 }, working: { rotate: 0 }, done: { rotate: 0 }, fail: { rotate: 17 }, rest: { rotate: group === 'fail' ? 17 : 0 } }}
        animate={reduce ? 'rest' : group}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <line x1="24" y1="12" x2="24" y2="6.5" stroke={shade(color, -0.08)} strokeWidth="1.6" strokeLinecap="round" />
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          variants={{
            idle: { scale: 1, opacity: 1 },
            working: { scale: [1, 1.4, 1], opacity: [1, 0.55, 1], transition: { duration: 0.85, repeat: Infinity, ease: 'easeInOut' } },
            done: { scale: 1, opacity: 1 },
            fail: { scale: 1, opacity: 1 },
            rest: { scale: 1, opacity: 1 },
          }}
          animate={reduce ? 'rest' : group}
        >
          <circle cx="24" cy="5" r="3" fill={color} />
          <circle cx="23" cy="4" r="1" fill="#fff" fillOpacity="0.5" />
        </motion.g>
      </motion.g>

      {/* Orejas */}
      <rect x="5.5" y="21" width="5" height="9" rx="2.5" fill={ear} />
      <rect x="37.5" y="21" width="5" height="9" rx="2.5" fill={ear} />

      {/* Cabeza */}
      <rect x="8" y="11" width="32" height="29" rx="11" fill={`url(#${gid})`} stroke="#fff" strokeOpacity="0.1" strokeWidth="0.75" />
      {/* Brillo (gloss) */}
      <ellipse cx="18" cy="17" rx="9" ry="4.5" fill="#fff" opacity="0.16" />

      {/* Pantalla */}
      <rect x="12.5" y="16.5" width="23" height="17" rx="8" fill="#0E1320" />
      <rect x="12.5" y="16.5" width="23" height="8" rx="8" fill="#fff" opacity="0.04" />

      {/* Ojos (glow) */}
      <g style={{ filter: `drop-shadow(0 0 1.6px ${eyeColor})` }}>
        <AnimatePresence mode="wait" initial={false}>
          {expr === 'neutral' && (
            <motion.g key="neutral" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <motion.g
                animate={group === 'working' && !reduce ? { x: [0, -1.6, 1.6, 0] } : { x: 0 }}
                transition={{ duration: 1.8, repeat: group === 'working' && !reduce ? Infinity : 0, ease: 'easeInOut' }}
              >
                <motion.g
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  animate={reduce ? { scaleY: 1 } : { scaleY: [1, 1, 0.12, 1] }}
                  transition={{ duration: 4.2, times: [0, 0.93, 0.965, 1], repeat: reduce ? 0 : Infinity, delay, ease: 'easeInOut' }}
                >
                  <NeutralEyes shape={eyes} color={eyeColor} />
                </motion.g>
              </motion.g>
            </motion.g>
          )}
          {expr === 'hearts' && (
            <motion.g
              key="hearts"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <HeartEyes />
            </motion.g>
          )}
          {expr === 'happy' && (
            <motion.g
              key="happy"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            >
              <HappyEyes color={eyeColor} />
            </motion.g>
          )}
          {expr === 'x' && (
            <motion.g
              key="x"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorEyes color={eyeColor} />
            </motion.g>
          )}
        </AnimatePresence>
      </g>

      {/* Tinte rojo al fallar */}
      {group === 'fail' && <rect x="8" y="11" width="32" height="29" rx="11" fill="#FF3B3B" opacity="0.16" />}

      {/* Chispa al terminar */}
      {group === 'done' && !reduce && (
        <motion.path
          key="spark"
          d="M38 9 l1 3 l3 1 l-3 1 l-1 3 l-1 -3 l-3 -1 l3 -1 z"
          fill={eye}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.6] }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      )}
    </motion.svg>
    </motion.div>
  )
}
