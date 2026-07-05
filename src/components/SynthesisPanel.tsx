import { motion, AnimatePresence } from 'framer-motion'
import { useSynthesis } from '../hooks/useSynthesis'

function SparklesIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path d="M8 1.5l1.2 3.3L12.5 6 9.2 7.2 8 10.5 6.8 7.2 3.5 6l3.3-1.2z" fill="currentColor" />
      <path d="M12.5 10.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="currentColor" />
    </svg>
  )
}

/**
 * Botón "Sintetizar" + modal con la conclusión unificada del equipo. Visible
 * solo cuando hay al menos 2 respuestas. Autónomo: gestiona su propia llamada.
 */
export function SynthesisPanel({
  question,
  answers,
}: {
  question: string
  answers: { name: string; text: string }[]
}) {
  const { text, loading, error, synthesize, reset } = useSynthesis()
  if (answers.length < 2) return null
  const open = loading || error !== null || text !== null

  return (
    <>
      <button
        onClick={() => synthesize(question, answers)}
        disabled={loading}
        title="Combinar las respuestas del equipo en una conclusión"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={loading ? 'animate-spin' : ''}>
          <SparklesIcon />
        </span>
        {loading ? 'Sintetizando…' : 'Sintetizar equipo'}
      </button>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={reset}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-2xl border border-line-strong bg-elevated p-6 shadow-2xl shadow-black/50"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
                  <span className="text-accent">
                    <SparklesIcon />
                  </span>
                  Síntesis del equipo
                </h3>
                <button
                  onClick={reset}
                  className="text-lg leading-none text-white/40 transition-colors hover:text-white/80"
                >
                  ×
                </button>
              </div>

              {loading && (
                <p className="text-sm text-white/50">
                  Combinando {answers.length} respuestas en una conclusión…
                </p>
              )}
              {error && (
                <div className="rounded-lg border border-st-error/30 bg-st-error/10 px-3 py-2 text-sm text-st-error">
                  {error}
                </div>
              )}
              {text && (
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-white/85">{text}</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
