import { useEffect, useMemo, useRef, useState } from 'react'
import { HeroPrompt } from '../HeroPrompt'
import { UsageSummary } from '../UsageSummary'
import { MapBackground } from './MapBackground'
import { AgentNode } from './AgentNode'
import { AgentBubble } from './AgentBubble'
import { AgentInfoPanel } from './AgentInfoPanel'
import { accentOf } from '../AgentIdentity'
import { computeHomePositions, depthOf } from '../../lib/nodeLayout'
import type { NodePos } from '../../lib/nodeLayout'
import type { RunEntry } from '../../hooks/useOfficeRun'
import type { AgentConfig, AgentRuntime, AgentTemplate, ModelOption } from '../../types'

const EMPTY_RUNTIME: AgentRuntime = {
  status: 'idle',
  text: '',
  aic: 0,
  inputTokens: 0,
  outputTokens: 0,
  startedAt: null,
  elapsedMs: null,
}

/**
 * Vista alternativa: mapa conceptual donde cada agente flota semifijo en el
 * espacio (posición determinista + bobbing continuo, reposicionable con
 * drag) y sus respuestas aparecen como bocadillos de diálogo. Puramente de
 * presentación: reutiliza los mismos datos/acciones que la vista de grid.
 */
export function AgentMapView({
  agents,
  runtime,
  templates,
  models,
  onAsk,
  onCancel,
  isRunning,
  disabled,
  pendingPrompt,
  totalAic,
  completedCount,
  totalAgents,
  totalTokens,
  avgElapsedMs,
  requestCount,
  runHistory,
  history,
  onSelectPrompt,
}: {
  agents: AgentConfig[]
  runtime: Record<string, AgentRuntime>
  templates: AgentTemplate[]
  models: ModelOption[]
  onAsk: (prompt: string) => void
  onCancel: () => void
  isRunning: boolean
  disabled: boolean
  pendingPrompt: string
  totalAic: number
  completedCount: number
  totalAgents: number
  totalTokens: number
  avgElapsedMs: number | null
  requestCount: number
  runHistory: RunEntry[]
  history: string[]
  onSelectPrompt: (p: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [overrides, setOverrides] = useState<Record<string, NodePos>>({})
  const [openInfoId, setOpenInfoId] = useState<string | null>(null)
  const rafPending = useRef(false)

  const templateNameOf = (file: string) =>
    templates.find((t) => t.file === file)?.name ?? 'Especialista'
  const modelLabelOf = (id: string) => models.find((m) => m.id === id)?.label ?? id

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) setSize({ width: box.width, height: box.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const homePositions = useMemo(() => computeHomePositions(agents.map((a) => a.id)), [agents])

  const onNodeDragEnd = (agentId: string, nextPx: NodePos) => {
    if (size.width === 0 || size.height === 0) return
    const x = Math.min(Math.max(nextPx.x / size.width, 0.04), 0.96)
    const y = Math.min(Math.max(nextPx.y / size.height, 0.06), 0.94)
    setOverrides((prev) => ({ ...prev, [agentId]: { x, y } }))
  }

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (rafPending.current) return
    rafPending.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width - 0.5) * 2
    const my = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    requestAnimationFrame(() => {
      containerRef.current?.style.setProperty('--mx', mx.toFixed(3))
      containerRef.current?.style.setProperty('--my', my.toFixed(3))
      rafPending.current = false
    })
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-5 z-40 flex flex-col items-center px-4">
        <div className="pointer-events-auto w-full max-w-2xl">
          <HeroPrompt
            onAsk={onAsk}
            onCancel={onCancel}
            isRunning={isRunning}
            disabled={disabled}
            externalValue={pendingPrompt}
          />
        </div>
        <div className="pointer-events-auto w-full max-w-3xl">
          <UsageSummary
            totalAic={totalAic}
            completedCount={completedCount}
            totalAgents={totalAgents}
            totalTokens={totalTokens}
            avgElapsedMs={avgElapsedMs}
            requestCount={requestCount}
            runHistory={runHistory}
            history={history}
            onSelectPrompt={onSelectPrompt}
          />
        </div>
      </div>

      <div ref={containerRef} onMouseMove={onMouseMove} className="relative flex-1 overflow-hidden">
        <MapBackground />

        {agents.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <h3 className="text-base font-semibold text-white/80">Aún no hay especialistas</h3>
            <p className="max-w-sm text-sm text-white/45">
              Añade agentes desde la sección «Agentes» para verlos aparecer aquí, flotando.
            </p>
          </div>
        )}

        {size.width > 0 &&
          agents.map((agent) => {
            const anchorFrac = overrides[agent.id] ?? homePositions[agent.id]
            if (!anchorFrac) return null
            const anchorPx: NodePos = { x: anchorFrac.x * size.width, y: anchorFrac.y * size.height }
            const rt = runtime[agent.id] ?? EMPTY_RUNTIME
            const accent = accentOf(agent.avatar)
            const depth = depthOf(agent.id)
            const side: 'left' | 'right' = anchorFrac.x < 0.5 ? 'left' : 'right'

            return (
              <div key={agent.id}>
                <AgentNode
                  agent={agent}
                  status={rt.status}
                  accent={accent}
                  anchor={anchorPx}
                  depth={depth}
                  containerRef={containerRef}
                  onDragEnd={onNodeDragEnd}
                  infoOpen={openInfoId === agent.id}
                  onToggleInfo={() => setOpenInfoId((id) => (id === agent.id ? null : agent.id))}
                />
                <AgentBubble
                  accent={accent}
                  name={agent.name}
                  runtime={rt}
                  anchor={anchorPx}
                  side={side}
                  bounds={size}
                />
                {openInfoId === agent.id && (
                  <AgentInfoPanel
                    accent={accent}
                    name={agent.name}
                    avatar={agent.avatar}
                    templateName={templateNameOf(agent.agentFile)}
                    model={modelLabelOf(agent.model)}
                    skills={agent.skills}
                    anchor={anchorPx}
                    side={side === 'right' ? 'left' : 'right'}
                    bounds={size}
                    onClose={() => setOpenInfoId(null)}
                  />
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
