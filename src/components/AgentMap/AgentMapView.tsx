import { useEffect, useMemo, useRef, useState } from 'react'
import { HeroPrompt } from '../HeroPrompt'
import { UsageSummary } from '../UsageSummary'
import { SynthesisPanel } from '../SynthesisPanel'
import { MapBackground } from './MapBackground'
import { AgentNode } from './AgentNode'
import { AgentBubble } from './AgentBubble'
import { AgentInfoPanel } from './AgentInfoPanel'
import { accentOf } from '../AgentIdentity'
import { computeHomePositions, depthOf } from '../../lib/nodeLayout'
import type { NodePos } from '../../lib/nodeLayout'
import type { RunEntry } from '../../hooks/useOfficeRun'
import type { CliAvailability } from '../../api'
import type { AgentCli, AgentConfig, AgentRuntime, AgentTemplate, MemoryLink, ModelOption } from '../../types'

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
  memoryLinks,
  onSaveMemoryLinks,
  cliStatus,
  question,
  answers,
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
  memoryLinks: MemoryLink[]
  onSaveMemoryLinks: (links: MemoryLink[]) => void
  cliStatus: Record<AgentCli, CliAvailability> | null
  question: string
  answers: { name: string; text: string }[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [overrides, setOverrides] = useState<Record<string, NodePos>>({})
  const [openInfoId, setOpenInfoId] = useState<string | null>(null)
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null)
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

  // Posición en píxeles de cada agente (override manual o posición "home").
  const positions = useMemo(() => {
    const out: Record<string, NodePos> = {}
    for (const a of agents) {
      const frac = overrides[a.id] ?? homePositions[a.id]
      if (frac) out[a.id] = { x: frac.x * size.width, y: frac.y * size.height }
    }
    return out
  }, [agents, overrides, homePositions, size])

  const linkKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const startLink = (id: string) => setLinkingFrom((cur) => (cur === id ? null : id))

  const linkTarget = (id: string) => {
    if (!linkingFrom) return
    if (id === linkingFrom) {
      setLinkingFrom(null)
      return
    }
    const key = linkKey(linkingFrom, id)
    const exists = memoryLinks.some(([a, b]) => linkKey(a, b) === key)
    const next = exists
      ? memoryLinks.filter(([a, b]) => linkKey(a, b) !== key)
      : [...memoryLinks, [linkingFrom, id] as MemoryLink]
    onSaveMemoryLinks(next)
    setLinkingFrom(null)
  }

  // Esc cancela el modo enlace.
  useEffect(() => {
    if (!linkingFrom) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLinkingFrom(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [linkingFrom])

  const availabilityOf = (cli: AgentCli): boolean | undefined =>
    cliStatus ? cliStatus[cli]?.available : undefined

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
        {answers.length >= 2 && (
          <div className="pointer-events-auto mt-3">
            <SynthesisPanel question={question} answers={answers} />
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        onMouseMove={onMouseMove}
        onClick={() => linkingFrom && setLinkingFrom(null)}
        className="relative flex-1 overflow-hidden"
      >
        <MapBackground />

        {/* Capa de hilos de memoria entre agentes enlazados. */}
        {size.width > 0 && memoryLinks.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0"
            width={size.width}
            height={size.height}
          >
            {memoryLinks.map(([a, b]) => {
              const pa = positions[a]
              const pb = positions[b]
              if (!pa || !pb) return null
              const agentA = agents.find((ag) => ag.id === a)
              const stroke = agentA ? accentOf(agentA.avatar) : '#7C93FF'
              return (
                <g key={linkKey(a, b)}>
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={stroke}
                    strokeOpacity={0.18}
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                  <line
                    x1={pa.x}
                    y1={pa.y}
                    x2={pb.x}
                    y2={pb.y}
                    stroke={stroke}
                    strokeOpacity={0.7}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeDasharray="5 6"
                  >
                    <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.1s" repeatCount="indefinite" />
                  </line>
                </g>
              )
            })}
          </svg>
        )}

        {/* Botón de eliminar en el punto medio de cada conexión. */}
        {size.width > 0 &&
          memoryLinks.map(([a, b]) => {
            const pa = positions[a]
            const pb = positions[b]
            if (!pa || !pb) return null
            return (
              <button
                key={`unlink-${linkKey(a, b)}`}
                onClick={(e) => {
                  e.stopPropagation()
                  const key = linkKey(a, b)
                  onSaveMemoryLinks(memoryLinks.filter(([x, y]) => linkKey(x, y) !== key))
                }}
                title="Eliminar esta conexión de memoria"
                className="absolute z-20 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-st-error/50 bg-elevated/90 text-sm leading-none text-st-error opacity-40 shadow-md shadow-black/40 backdrop-blur transition-all hover:scale-110 hover:opacity-100"
                style={{ left: (pa.x + pb.x) / 2, top: (pa.y + pb.y) / 2 }}
              >
                ×
              </button>
            )
          })}

        {/* Aviso de modo enlace. */}
        {linkingFrom && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-4">
            <div className="pointer-events-auto rounded-full border border-st-thinking/40 bg-elevated/90 px-4 py-1.5 text-xs font-medium text-white/80 shadow-lg shadow-black/40 backdrop-blur">
              Elige otro robot para compartir memoria · pulsa de nuevo para desconectar ·
              <span className="text-white/50"> Esc para cancelar</span>
            </div>
          </div>
        )}

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
            const anchorPx = positions[agent.id]
            if (!anchorPx) return null
            const rt = runtime[agent.id] ?? EMPTY_RUNTIME
            const accent = accentOf(agent.avatar)
            const depth = depthOf(agent.id)
            const side: 'left' | 'right' = anchorPx.x < size.width / 2 ? 'left' : 'right'

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
                  available={availabilityOf(agent.cli)}
                  linking={linkingFrom === agent.id}
                  linkingActive={linkingFrom !== null}
                  onStartLink={() => startLink(agent.id)}
                  onLinkTarget={() => linkTarget(agent.id)}
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
