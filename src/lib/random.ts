/**
 * Aleatoriedad basada en `crypto.getRandomValues` en lugar de `Math.random()`,
 * que no garantiza impredecibilidad. Se usa para elegir avatares y nombres
 * libres, donde una colisión predecible daría siempre el mismo agente.
 */

/** Entero aleatorio en el rango [0, max). Devuelve 0 si `max` no es positivo. */
export function randomInt(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 0
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % Math.floor(max)
}

/** Elemento aleatorio de un array. Devuelve `undefined` si está vacío. */
export function randomItem<T>(items: readonly T[]): T | undefined {
  return items.length > 0 ? items[randomInt(items.length)] : undefined
}
