import { useCallback, useState } from 'react'
import { api } from '../api'

/**
 * Estado y acción para la "síntesis del equipo": combina las respuestas de la
 * ronda en una conclusión unificada llamando a POST /api/synthesize.
 */
export function useSynthesis() {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const synthesize = useCallback(async (prompt: string, answers: { name: string; text: string }[]) => {
    setLoading(true)
    setError(null)
    setText(null)
    try {
      const { text } = await api.synthesize({ prompt, answers })
      setText(text)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setText(null)
    setError(null)
  }, [])

  return { text, loading, error, synthesize, reset }
}
