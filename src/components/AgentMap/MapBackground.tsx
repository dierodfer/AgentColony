import { motion, useReducedMotion } from 'framer-motion'

/**
 * Fondo con sensación de profundidad: gradientes radiales estáticos + un par
 * de manchas grandes muy desenfocadas que derivan muy despacio. Lee las
 * variables de parallax `--mx`/`--my` (fracción -1..1) que actualiza
 * `AgentMapView` en el contenedor padre, con un multiplicador bajo para que
 * el fondo se mueva menos que los nodos ("capa lejana").
 */
export function MapBackground() {
  const reduce = !!useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 700px at 50% 0%, rgba(79,124,255,0.10), transparent 60%),' +
            'radial-gradient(900px 600px at 85% 90%, rgba(45,212,167,0.06), transparent 60%),' +
            'radial-gradient(800px 500px at 10% 85%, rgba(167,139,250,0.06), transparent 60%)',
        }}
      />
      <motion.div
        className="absolute -left-1/4 -top-1/4 h-[60%] w-[60%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(79,124,255,0.14), transparent 70%)',
          filter: 'blur(80px)',
          willChange: 'transform',
          transform: 'translate3d(calc(var(--mx, 0) * 12px), calc(var(--my, 0) * 12px), 0)',
        }}
        animate={
          reduce
            ? undefined
            : { x: [0, 24, 0, -24, 0], y: [0, -16, 0, 16, 0] }
        }
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-1/4 -right-1/4 h-[55%] w-[55%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(45,212,167,0.10), transparent 70%)',
          filter: 'blur(90px)',
          willChange: 'transform',
          transform: 'translate3d(calc(var(--mx, 0) * -10px), calc(var(--my, 0) * -10px), 0)',
        }}
        animate={
          reduce
            ? undefined
            : { x: [0, -20, 0, 20, 0], y: [0, 14, 0, -14, 0] }
        }
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
