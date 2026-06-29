import { useCallback, useEffect, useState } from 'react'

const KEY = 'agent-colony:history'
const MAX_ITEMS = 12

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Historial de preguntas anteriores, persistido en localStorage. Permite
 * reutilizar una pregunta o eliminarla del historial.
 */
export function useHistory() {
  const [items, setItems] = useState<string[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* sin persistencia si localStorage no está disponible */
    }
  }, [items])

  const add = useCallback((question: string) => {
    const q = question.trim()
    if (!q) return
    setItems((prev) => [q, ...prev.filter((x) => x !== q)].slice(0, MAX_ITEMS))
  }, [])

  const remove = useCallback((question: string) => {
    setItems((prev) => prev.filter((x) => x !== question))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  return { items, add, remove, clear }
}
