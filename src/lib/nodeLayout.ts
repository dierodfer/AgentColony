/** Posición "home" de un nodo, fraccional (0..1) respecto al contenedor. */
export interface NodePos {
  x: number
  y: number
}

/**
 * Calcula posiciones "home" deterministas y sin solapes para hasta 8 agentes,
 * distribuidos en uno o dos anillos concéntricos alrededor del centro. El
 * jitter por agente usa la misma técnica de seed que `AgentRobot`
 * (suma de charCodes del id) para que la disposición sea siempre la misma
 * mientras no cambie la lista de agentes, sin depender de estado externo.
 * El centro se desplaza hacia abajo (cy > 0.5) para dejar hueco arriba al
 * toolbox flotante (prompt + estadísticas).
 */
export function computeHomePositions(agentIds: string[], jitterRadius = 0.06): Record<string, NodePos> {
  const n = agentIds.length
  const positions: Record<string, NodePos> = {}
  const cx = 0.5
  const cy = 0.66
  const outerCount = n <= 6 ? n : Math.ceil(n / 2)
  const innerCount = n <= 6 ? 0 : Math.floor(n / 2)

  agentIds.forEach((id, i) => {
    const ring = i < outerCount ? 0 : 1
    const ringCount = ring === 0 ? outerCount : innerCount
    const idxInRing = ring === 0 ? i : i - outerCount
    const baseRadius = ring === 0 ? 0.32 : 0.16
    const angleStep = (2 * Math.PI) / Math.max(ringCount, 1)
    const phase = ring === 1 ? angleStep / 2 : 0
    const angle = idxInRing * angleStep + phase - Math.PI / 2

    const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0)
    const jitterAngle = ((seed % 100) / 100 - 0.5) * 0.35
    const jitterR = (((seed * 7) % 100) / 100 - 0.5) * jitterRadius

    const radius = baseRadius + jitterR
    positions[id] = {
      x: cx + Math.cos(angle + jitterAngle) * radius,
      y: cy + Math.sin(angle + jitterAngle) * radius * 0.72,
    }
  })

  return positions
}

/** Profundidad simulada (0.7..1) derivada del id, estable entre renders. */
export function depthOf(id: string): number {
  const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0)
  return 0.7 + (seed % 30) / 100
}
