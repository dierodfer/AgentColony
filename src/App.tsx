import { useMemo, useState } from 'react'
import { useOfficeData } from './hooks/useOfficeData'
import { useOfficeRun } from './hooks/useOfficeRun'
import { useHistory } from './hooks/useHistory'
import { HeroPrompt } from './components/HeroPrompt'
import { AgentGrid } from './components/AgentGrid'
import { AgentMapView } from './components/AgentMap/AgentMapView'
import { TemplatesView } from './components/TemplatesView'
import { Sidebar, type SectionId } from './components/Sidebar'
import { AgentEditor } from './components/AgentEditor'
import { UsageSummary } from './components/UsageSummary'
import { ACCENTS } from './components/AgentIdentity'
import type { AgentConfig, AgentDraft, AgentStatus } from './types'

const MAX_AGENTS = 8
const AGENT_NAMES = [
  'Neon', 'Cipher', 'Vortex', 'Specter', 'Raven', 'Onyx', 'Nyx', 'Quasar',
  'Helix', 'Pulsar', 'Glitch', 'Cobalt', 'Aether', 'Zenith', 'Krypt', 'Vesper',
  'Synth', 'Axon', 'Rune', 'Halcyon', 'Mirage', 'Nova', 'Echo', 'Phantom',
]

type Editing = { mode: 'new' } | { mode: 'edit'; agent: AgentConfig } | null

const WORKING: AgentStatus[] = ['starting', 'thinking', 'responding']

export default function App() {
  const data = useOfficeData()
  const { runtime, totalAic, totalTokens, requestCount, runHistory, isRunning, run, cancel } = useOfficeRun()
  const history = useHistory()
  const [editing, setEditing] = useState<Editing>(null)
  const [question, setQuestion] = useState('')
  const [view, setView] = useState<SectionId>('agentes')
  const [pendingPrompt, setPendingPrompt] = useState('')

  // Modelo por defecto del formulario de creación: preferimos un "GPT mini" si
  // Copilot lo ofrece; si no, el primero disponible. Se resuelve una vez
  // consultados los modelos a Copilot y se guarda en esta variable de la vista.
  const defaultModel = useMemo(() => {
    const gptMini = data.models.find((m) => /gpt.*mini/i.test(m.id))
    return gptMini?.id ?? data.models[0]?.id ?? 'auto'
  }, [data.models])

  const handleAsk = (prompt: string) => {
    setQuestion(prompt)
    history.add(prompt)
    run(prompt, data.agents.map((a) => a.id))
  }

  const openCreate = () => {
    void data.reloadCatalogs()
    setEditing({ mode: 'new' })
  }
  const openEdit = (agent: AgentConfig) => {
    void data.reloadCatalogs()
    setEditing({ mode: 'edit', agent })
  }

  const usedNames = new Set(data.agents.map((a) => a.name.trim().toLowerCase()))
  const usedAvatars = new Set(data.agents.map((a) => a.avatar))

  const newDraft = (): AgentDraft => {
    const freeName =
      AGENT_NAMES.find((n) => !usedNames.has(n.toLowerCase())) ?? `Unit-${data.agents.length + 1}`
    const freeAvatar =
      ACCENTS.find((a) => !usedAvatars.has(a.id))?.id ?? ACCENTS[data.agents.length % ACCENTS.length].id
    return {
      name: freeName,
      avatar: freeAvatar,
      agentFile: data.templates[0]?.file ?? '',
      model: defaultModel,
      skills: [],
    }
  }

  const saveAgent = async (draft: AgentDraft) => {
    if (editing?.mode === 'edit') await data.updateAgent(editing.agent.id, draft)
    else await data.createAgent(draft)
    setEditing(null)
  }

  const states = data.agents.map((a) => runtime[a.id]?.status ?? 'idle')
  const total = data.agents.length
  const workingCount = states.filter((s) => WORKING.includes(s)).length
  const doneCount = states.filter((s) => s === 'finished').length
  const errorCount = states.filter((s) => s === 'error').length

  const runtimeValues = Object.values(runtime)
  const finishedRts = runtimeValues.filter((rt) => rt.elapsedMs != null)
  const avgElapsedMs = finishedRts.length > 0
    ? finishedRts.reduce((sum, rt) => sum + rt.elapsedMs!, 0) / finishedRts.length
    : null

  return (
    <div className="app-shell flex h-screen overflow-hidden text-white/90">
      <Sidebar
        active={view}
        agentCount={total}
        onNavigate={setView}
      />

      {view === 'agentes' && (
        <main className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">
            <HeroPrompt
              onAsk={handleAsk}
              onCancel={cancel}
              isRunning={isRunning}
              disabled={data.agents.length === 0}
              externalValue={pendingPrompt}
            />

            <section className="mt-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/30">
                Petición
              </p>
              <h1 className="mt-2 max-w-4xl text-2xl font-semibold leading-snug tracking-tight text-white/90">
                {question || 'Plantea una petición y observa a tus especialistas colaborar.'}
              </h1>
              {workingCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-st-thinking">
                    <span className="h-1.5 w-1.5 rounded-full bg-st-thinking status-pulse" />
                    {workingCount} trabajando
                  </span>
                  {errorCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-0.5 text-st-error">
                      <span className="h-1.5 w-1.5 rounded-full bg-st-error" />
                      {errorCount} con error
                    </span>
                  )}
                </div>
              )}
              <UsageSummary
                totalAic={totalAic}
                completedCount={doneCount}
                totalAgents={total}
                totalTokens={totalTokens}
                avgElapsedMs={avgElapsedMs}
                requestCount={requestCount}
                runHistory={runHistory}
                history={history.items}
                onSelectPrompt={setPendingPrompt}
              />
            </section>

            <section className="mt-8">
              <AgentGrid
                agents={data.agents}
                runtime={runtime}
                templates={data.templates}
                models={data.models}
                loading={data.loading}
                canAdd={data.agents.length < MAX_AGENTS}
                onAdd={openCreate}
                onEdit={openEdit}
                onDelete={(agent) => data.deleteAgent(agent.id)}
              />
            </section>

            {data.error && (
              <div className="mt-6 rounded-xl border border-st-error/30 bg-st-error/10 px-4 py-3 text-center text-sm text-st-error">
                {data.error}
              </div>
            )}
          </div>
        </main>
      )}

      {view === 'mapa' && (
        <main className="flex-1 overflow-hidden">
          <AgentMapView
            agents={data.agents}
            runtime={runtime}
            onAsk={handleAsk}
            onCancel={cancel}
            isRunning={isRunning}
            disabled={data.agents.length === 0}
            pendingPrompt={pendingPrompt}
          />
        </main>
      )}

      {view === 'templates' && (
        <main className="scroll-thin flex-1 overflow-y-auto">
          <TemplatesView
            templates={data.templates}
            skills={data.skills}
            onReload={data.reloadCatalogs}
          />
        </main>
      )}

      {editing && (
        <AgentEditor
          initial={editing.mode === 'edit'
            ? { name: editing.agent.name, avatar: editing.agent.avatar, agentFile: editing.agent.agentFile, model: editing.agent.model, skills: [...editing.agent.skills] }
            : newDraft()}
          isNew={editing.mode === 'new'}
          models={data.models}
          onReloadModels={data.refreshModels}
          skills={data.skills}
          templates={data.templates}
          takenNames={data.agents
            .filter((a) => editing.mode !== 'edit' || a.id !== editing.agent.id)
            .map((a) => a.name.trim().toLowerCase())}
          takenAvatars={data.agents
            .filter((a) => editing.mode !== 'edit' || a.id !== editing.agent.id)
            .map((a) => a.avatar)}
          onCancel={() => setEditing(null)}
          onSave={saveAgent}
          onCreateSkill={data.createSkill}
          onCreateTemplate={data.createTemplate}
        />
      )}
    </div>
  )
}
