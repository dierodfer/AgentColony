import { AnimatePresence, motion } from 'framer-motion'
import { AgentCard } from './AgentCard'
import { accentOf } from './AgentIdentity'
import type { CliAvailability } from '../api'
import type { AgentCli, AgentConfig, AgentRuntime, AgentTemplate, ModelOption } from '../types'

const MAX_AGENTS = 8

/**
 * Cuadrícula de agentes. Todos visibles a la vez (sin carrusel, paginación ni
 * tabs). Hasta 4 columnas en pantallas anchas.
 */
export function AgentGrid({
  agents,
  runtime,
  templates,
  models,
  cliStatus,
  loading,
  canAdd,
  onAdd,
  onEdit,
  onDelete,
}: {
  agents: AgentConfig[]
  runtime: Record<string, AgentRuntime>
  templates: AgentTemplate[]
  models: ModelOption[]
  cliStatus: Record<AgentCli, CliAvailability> | null
  loading: boolean
  canAdd: boolean
  onAdd: () => void
  onEdit: (agent: AgentConfig) => void
  onDelete: (agent: AgentConfig) => void
}) {
  const templateNameOf = (file: string) =>
    templates.find((t) => t.file === file)?.name ?? 'Especialista'
  const modelLabelOf = (id: string) => models.find((m) => m.id === id)?.label ?? id

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-line bg-surface/60"
          />
        ))}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-surface/40 px-6 py-16 text-center">
        <h3 className="text-base font-semibold text-white/80">Aún no hay especialistas</h3>
        <p className="max-w-sm text-sm text-white/45">
          Añade hasta {MAX_AGENTS} agentes especializados para verlos colaborar en paralelo sobre
          una misma petición.
        </p>
        <button
          onClick={onAdd}
          className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
        >
          Añadir especialista
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-x-4 gap-y-16 pt-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AnimatePresence mode="popLayout">
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            templateName={templateNameOf(agent.agentFile)}
            model={modelLabelOf(agent.model)}
            accent={accentOf(agent.avatar)}
            runtime={runtime[agent.id]}
            available={cliStatus ? cliStatus[agent.cli]?.available : undefined}
            onEdit={() => onEdit(agent)}
            onDelete={() => onDelete(agent)}
          />
        ))}
      </AnimatePresence>

      {canAdd && (
        <motion.button
          layout
          onClick={onAdd}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-transparent text-white/40 transition-colors duration-200 hover:border-accent/50 hover:bg-accent-weak hover:text-accent"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong text-lg leading-none">
            +
          </span>
          <span className="text-sm font-medium">Añadir especialista</span>
          <span className="text-[11px] text-white/30">{MAX_AGENTS - agents.length} disponibles</span>
        </motion.button>
      )}
    </div>
  )
}
