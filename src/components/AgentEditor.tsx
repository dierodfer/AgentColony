import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ACCENTS, AgentRobot } from './AgentIdentity'
import type {
  AgentDraft,
  AgentTemplate,
  ModelOption,
  SkillInfo,
} from '../types'

interface Props {
  initial: AgentDraft
  isNew: boolean
  models: ModelOption[]
  /** Recarga los modelos desde Copilot (`/model`) y devuelve la nueva lista. */
  onReloadModels: () => Promise<ModelOption[]>
  skills: SkillInfo[]
  templates: AgentTemplate[]
  /** Nombres (lowercase) de OTROS agentes — no se pueden repetir. */
  takenNames: string[]
  /** Ids de identidad/icono de OTROS agentes — no se pueden repetir. */
  takenAvatars: string[]
  onCancel: () => void
  onSave: (draft: AgentDraft) => void
  onCreateSkill: (data: { name: string; body?: string; applyTo?: string }) => Promise<SkillInfo>
  onCreateTemplate: (data: { name: string; body?: string }) => Promise<AgentTemplate>
}

const RANDOM_NAMES = [
  'Atlas', 'Nova', 'Orion', 'Echo', 'Lyra', 'Vega', 'Clio', 'Iris',
  'Axel', 'Luna', 'Bolt', 'Pixel', 'Sage', 'Wren', 'Finn', 'Mira',
  'Cruz', 'Zara', 'Rex', 'Enzo',
]

function ReloadIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5a5.5 5.5 0 0 1 3.89 1.61L13.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.5 2.5v3h-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const labelCls = 'mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-white/40'
const fieldCls =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white/85 outline-none transition-colors placeholder:text-white/25 focus:border-accent/50'

function AvatarPicker({
  value,
  takenAvatars,
  onChange,
}: {
  value: string
  takenAvatars: string[]
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-2xl p-1 transition hover:bg-white/[0.06]"
      >
        <AgentRobot id={value} size={52} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 z-10 mt-2 flex w-max max-w-xs flex-wrap gap-1.5 rounded-xl border border-line-strong bg-elevated p-3 shadow-xl shadow-black/40"
          >
            {ACCENTS.map((ac) => {
              const used = takenAvatars.includes(ac.id)
              const selected = ac.id === value
              return (
                <button
                  key={ac.id}
                  onClick={() => { if (!used) { onChange(ac.id); setOpen(false) } }}
                  disabled={used}
                  className={`rounded-xl p-1 transition ${
                    selected
                      ? 'ring-2 ring-offset-2 ring-offset-elevated'
                      : used
                        ? 'cursor-not-allowed opacity-25'
                        : 'opacity-75 hover:bg-white/[0.05] hover:opacity-100'
                  }`}
                  style={selected ? ({ ['--tw-ring-color' as string]: ac.color }) : undefined}
                >
                  <AgentRobot id={ac.id} size={36} />
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Modal de creación/edición de un agente, con creación inline de skills/plantillas. */
export function AgentEditor({
  initial,
  isNew,
  models,
  onReloadModels,
  skills,
  templates,
  takenNames,
  takenAvatars,
  onCancel,
  onSave,
  onCreateSkill,
  onCreateTemplate,
}: Props) {
  const [draft, setDraft] = useState<AgentDraft>(initial)
  const nameTaken = takenNames.includes(draft.name.trim().toLowerCase())

  const randomize = () => {
    const freeAvatars = ACCENTS.map((a) => a.id).filter((id) => !takenAvatars.includes(id))
    const newAvatar = freeAvatars.length > 0
      ? freeAvatars[Math.floor(Math.random() * freeAvatars.length)]
      : draft.avatar
    const freeNames = RANDOM_NAMES.filter((n) => !takenNames.includes(n.toLowerCase()))
    const pool = freeNames.length > 0 ? freeNames : RANDOM_NAMES
    const newName = pool[Math.floor(Math.random() * pool.length)]
    setDraft((d) => ({ ...d, avatar: newAvatar, name: newName }))
  }
  const [newSkill, setNewSkill] = useState<{ name: string; body: string; applyTo: string } | null>(null)
  const [newTemplate, setNewTemplate] = useState<{ name: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)

  const reloadModels = async () => {
    setLoadingModels(true)
    setError(null)
    try {
      const list = await onReloadModels()
      // Si el modelo actual quedó fuera de la nueva lista, elige un GPT mini si
      // lo hay; si no, el primero disponible.
      setDraft((d) =>
        list.some((m) => m.id === d.model)
          ? d
          : { ...d, model: list.find((m) => /gpt.*mini/i.test(m.id))?.id ?? list[0]?.id ?? d.model },
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingModels(false)
    }
  }

  const toggleSkill = (id: string) =>
    setDraft((d) => ({
      ...d,
      skills: d.skills.includes(id) ? d.skills.filter((s) => s !== id) : [...d.skills, id],
    }))

  const submitNewSkill = async () => {
    if (!newSkill?.name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await onCreateSkill({ name: newSkill.name, body: newSkill.body, applyTo: newSkill.applyTo })
      setDraft((d) => ({ ...d, skills: [...d.skills, created.id] }))
      setNewSkill(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitNewTemplate = async () => {
    if (!newTemplate?.name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const created = await onCreateTemplate({
        name: newTemplate.name,
        body: newTemplate.body,
      })
      setDraft((d) => ({ ...d, agentFile: created.file }))
      setNewTemplate(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="scroll-thin max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line-strong bg-elevated p-6 shadow-2xl shadow-black/40"
      >
        <h3 className="mb-5 text-base font-semibold text-white/90">
          {isNew ? 'Nuevo especialista' : 'Editar especialista'}
        </h3>

        {error && (
          <div className="mb-4 rounded-lg border border-st-error/30 bg-st-error/10 px-3 py-2 text-xs text-st-error">
            {error}
          </div>
        )}

        {/* Avatar: icono + nombre en la misma fila */}
        <div className={`flex items-center gap-3 ${nameTaken ? 'mb-1.5' : 'mb-4'}`}>
          <AvatarPicker
            value={draft.avatar}
            takenAvatars={takenAvatars}
            onChange={(id) => setDraft((d) => ({ ...d, avatar: id }))}
          />
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className={`${nameTaken ? 'border-st-error/50' : ''} ${fieldCls}`}
          />
          <button
            onClick={randomize}
            title="Nombre e icono aleatorio"
            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-line text-white/40 transition-colors hover:border-line-strong hover:text-white/80"
          >
            <ReloadIcon />
          </button>
        </div>
        {nameTaken && (
          <p className="mb-4 text-xs text-st-error">Ya existe un especialista con ese nombre.</p>
        )}

        {/* Modelo */}
        <div className="mb-1.5 flex items-center justify-between">
          <label className={labelCls.replace('mb-1.5 ', '')}>Modelo</label>
          <button
            type="button"
            onClick={reloadModels}
            disabled={loadingModels}
            title="Recargar modelos desde Copilot (/model)"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] font-medium text-white/55 transition-colors hover:border-line-strong hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={loadingModels ? 'inline-block animate-spin' : 'inline-block'}>
              <ReloadIcon />
            </span>
            {loadingModels ? 'Recargando…' : 'Recargar modelos'}
          </button>
        </div>
        <select
          value={draft.model}
          onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
          disabled={models.length === 0}
          className={`mb-1 ${fieldCls} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {models.length === 0 && (
            <option value={draft.model} className="bg-elevated">
              {draft.model || 'Sin modelos — pulsa «Recargar modelos»'}
            </option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id} className="bg-elevated">
              {m.label}
            </option>
          ))}
        </select>
        {models.length === 0 && (
          <p className="mb-4 text-[11px] text-white/35">
            Los modelos se obtienen de Copilot al pulsar «Recargar modelos».
          </p>
        )}
        {models.length > 0 && <div className="mb-4" />}

        {/* Agentes Plantilla */}
        <div className="mb-2 flex items-center justify-between">
          <label className={labelCls + ' mb-0'}>Agentes Plantilla</label>
          <button
            onClick={() => setNewTemplate({ name: '', body: '' })}
            className="text-xs font-medium text-accent transition-colors hover:text-accent-strong"
          >
            + Nuevo
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {templates.length === 0 && <span className="text-sm text-white/35">No hay agentes plantilla disponibles.</span>}
          {templates.map((t) => {
            const on = draft.agentFile === t.file
            return (
              <button
                key={t.file}
                onClick={() => setDraft((d) => ({ ...d, agentFile: on ? '' : t.file }))}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  on
                    ? 'bg-accent text-white'
                    : 'border border-line bg-surface text-white/60 hover:border-line-strong hover:text-white/85'
                }`}
              >
                {t.name}
              </button>
            )
          })}
        </div>

        {newTemplate && (
          <InlineCreate
            title="Nuevo agente plantilla"
            busy={busy}
            onCancel={() => setNewTemplate(null)}
            onSubmit={submitNewTemplate}
            disabled={!newTemplate.name.trim()}
          >
            <input
              autoFocus
              placeholder="Nombre (p. ej. Data Scientist)"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate((t) => t && { ...t, name: e.target.value })}
              className={fieldCls}
            />
            <textarea
              placeholder="Instrucciones del perfil (opcional)"
              rows={3}
              value={newTemplate.body}
              onChange={(e) => setNewTemplate((t) => t && { ...t, body: e.target.value })}
              className={`resize-none ${fieldCls}`}
            />
          </InlineCreate>
        )}

        {/* Skills */}
        <div className="mb-2 flex items-center justify-between">
          <label className={labelCls + ' mb-0'}>Skills</label>
          <button
            onClick={() => setNewSkill({ name: '', body: '', applyTo: '' })}
            className="text-xs font-medium text-accent transition-colors hover:text-accent-strong"
          >
            + Nueva
          </button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {skills.length === 0 && <span className="text-sm text-white/35">No hay skills detectadas.</span>}
          {skills.map((s) => {
            const on = draft.skills.includes(s.id)
            return (
              <button
                key={s.id}
                onClick={() => toggleSkill(s.id)}
                title={s.applyTo ? `Aplica a: ${s.applyTo}` : undefined}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  on
                    ? 'bg-accent text-white'
                    : 'border border-line bg-surface text-white/60 hover:border-line-strong hover:text-white/85'
                }`}
              >
                {s.name}
              </button>
            )
          })}
        </div>

        {newSkill && (
          <InlineCreate
            title="Nueva skill"
            busy={busy}
            onCancel={() => setNewSkill(null)}
            onSubmit={submitNewSkill}
            disabled={!newSkill.name.trim()}
          >
            <input
              autoFocus
              placeholder="Nombre (p. ej. Accesibilidad)"
              value={newSkill.name}
              onChange={(e) => setNewSkill((s) => s && { ...s, name: e.target.value })}
              className={fieldCls}
            />
            <input
              placeholder="Aplica a (glob, opcional): **/*.java, **/pom.xml"
              value={newSkill.applyTo}
              onChange={(e) => setNewSkill((s) => s && { ...s, applyTo: e.target.value })}
              className={`font-mono ${fieldCls}`}
            />
            <textarea
              placeholder="Contenido de la skill (opcional)"
              rows={3}
              value={newSkill.body}
              onChange={(e) => setNewSkill((s) => s && { ...s, body: e.target.value })}
              className={`resize-none ${fieldCls}`}
            />
          </InlineCreate>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/85"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave({ ...draft, name: draft.name.trim() })}
            disabled={!draft.name.trim() || !draft.agentFile || nameTaken}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/30"
          >
            Guardar
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/** Mini-formulario inline para crear una skill o plantilla. */
function InlineCreate({
  title,
  busy,
  disabled,
  onCancel,
  onSubmit,
  children,
}: {
  title: string
  busy: boolean
  disabled: boolean
  onCancel: () => void
  onSubmit: () => void
  children: ReactNode
}) {
  return (
    <div className="mb-4 space-y-2 rounded-xl border border-accent/25 bg-accent-weak p-3">
      <p className="text-xs font-medium text-accent">{title}</p>
      {children}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1 text-xs font-medium text-white/55 transition-colors hover:text-white/85"
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          disabled={disabled || busy}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          {busy ? 'Creando…' : 'Crear'}
        </button>
      </div>
    </div>
  )
}
