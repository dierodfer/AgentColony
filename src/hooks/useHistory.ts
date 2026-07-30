import { useCallback, useEffect, useState } from 'react'

const KEY = 'agent-colony:history'
const MAX_ITEMS = 12
const MAX_LEN = 2000

/**
 * Normaliza lo que entra y sale de localStorage: sólo cadenas, sin caracteres
 * de control y acotadas en longitud, para que una pregunta arbitraria no pueda
 * envenenar el almacenamiento ni desbordar la cuota.
 */
const DEL = '\u007F'

/** Sustituye por espacios los caracteres de control (rango C0 y DEL). */
function stripControlChars(text: string): string {
  return Array.from(text, (ch) => (ch < ' ' || ch === DEL ? ' ' : ch)).join('')
}

function sanitize(items: readonly unknown[]): string[] {
  return items
    .filter((x): x is string => typeof x === 'string')
    .map((x) => stripControlChars(x).trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_ITEMS)
}

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? sanitize(parsed) : []
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
      localStorage.setItem(KEY, JSON.stringify(sanitize(items)))
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
