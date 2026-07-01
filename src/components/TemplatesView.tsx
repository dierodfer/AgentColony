import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../api'
import type { AgentTemplate, SkillInfo } from '../types'

const fieldCls =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-white/85 outline-none transition-colors placeholder:text-white/25 focus:border-accent/50'

// ---- Template item ----------------------------------------------------------

function TemplateItem({ tpl, onReload }: { tpl: AgentTemplate; onReload: () => void }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [name, setName] = useState(tpl.name)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    if (!open) {
      setLoading(true)
      try {
        const res = await api.getTemplateBody(tpl.file)
        setBody(res.body)
        setName(tpl.name)
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    setOpen(!open)
    setConfirming(false)
  }

  const save = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.updateTemplate(tpl.file, { name, body })
      onReload()
      setOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.deleteTemplate(tpl.file)
      onReload()
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/[0.03]"
      >
        <span className={`text-white/40 transition-transform ${open ? 'rotate-90' : ''}`}>&#9654;</span>
        <span className="font-medium text-white/80">{tpl.name}</span>
        <span className="ml-auto text-xs text-white/25">{tpl.file}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4">
              {error && <p className="text-xs text-st-error">{error}</p>}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre"
                className={fieldCls}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                placeholder="Instrucciones del agente (markdown)"
                className={`resize-y font-mono text-xs ${fieldCls}`}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={loading || !name.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
                >
                  {loading ? 'Guardando…' : 'Guardar'}
                </button>
                {confirming ? (
                  <>
                    <button
                      onClick={remove}
                      className="rounded-lg bg-st-error/15 px-3 py-1.5 text-xs font-medium text-st-error transition-colors hover:bg-st-error/25"
                    >
                      Confirmar eliminación
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="px-2 py-1.5 text-xs text-white/50 hover:text-white/80"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="px-2 py-1.5 text-xs text-white/35 transition-colors hover:text-st-error"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Skill item -------------------------------------------------------------

function SkillItem({ skill, onReload }: { skill: SkillInfo; onReload: () => void }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [name, setName] = useState(skill.name)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    if (!open) {
      setLoading(true)
      try {
        const res = await api.getSkillBody(skill.id)
        setBody(res.body)
        setName(skill.name)
        setError(null)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }
    setOpen(!open)
    setConfirming(false)
  }

  const save = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.updateSkill(skill.id, { name, body })
      onReload()
      setOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const remove = async () => {
    setLoading(true)
    setError(null)
    try {
      await api.deleteSkill(skill.id)
      onReload()
    } catch (e) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-white/[0.03]"
      >
        <span className={`text-white/40 transition-transform ${open ? 'rotate-90' : ''}`}>&#9654;</span>
        <span className="font-medium text-white/80">{skill.name}</span>
        <span className="ml-auto text-xs text-white/25">{skill.id}.md</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4">
              {error && <p className="text-xs text-st-error">{error}</p>}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre"
                className={fieldCls}
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Contenido de la skill (markdown)"
                className={`resize-y font-mono text-xs ${fieldCls}`}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={loading || !name.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
                >
                  {loading ? 'Guardando…' : 'Guardar'}
                </button>
                {confirming ? (
                  <>
                    <button
                      onClick={remove}
                      className="rounded-lg bg-st-error/15 px-3 py-1.5 text-xs font-medium text-st-error transition-colors hover:bg-st-error/25"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="px-2 py-1.5 text-xs text-white/50 hover:text-white/80"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(true)}
                    className="px-2 py-1.5 text-xs text-white/35 transition-colors hover:text-st-error"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Create forms -----------------------------------------------------------

function CreateTemplateForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.createTemplate({ name, body })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-accent/25 bg-accent-weak p-3">
      <p className="text-xs font-medium text-accent">Nueva plantilla de agente</p>
      {error && <p className="text-xs text-st-error">{error}</p>}
      <input
        autoFocus
        placeholder="Nombre (p. ej. Security Auditor)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={fieldCls}
      />
      <textarea
        placeholder="Instrucciones del agente (markdown)"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={`resize-none ${fieldCls}`}
      />
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1 text-xs text-white/55 hover:text-white/85">Cancelar</button>
        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-40"
        >
          {busy ? 'Creando…' : 'Crear'}
        </button>
      </div>
    </div>
  )
}

function GenerateTemplateForm({ onDone }: { onDone: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.generateTemplate({ prompt })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-st-thinking/25 bg-st-thinking/[0.06] p-3">
      <p className="text-xs font-medium text-st-thinking">Generar plantilla con IA</p>
      <p className="text-[11px] text-white/40">
        Describe el tipo de especialista y Copilot generará las instrucciones del agente con best practices.
      </p>
      {error && <p className="text-xs text-st-error">{error}</p>}
      <textarea
        autoFocus
        placeholder="Ej: un especialista en seguridad web que audite código buscando vulnerabilidades OWASP"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className={`resize-none ${fieldCls}`}
      />
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1 text-xs text-white/55 hover:text-white/85">Cancelar</button>
        <button
          onClick={submit}
          disabled={!prompt.trim() || busy}
          className="rounded-lg bg-st-thinking px-3 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? 'Generando…' : 'Generar'}
        </button>
      </div>
    </div>
  )
}

function GenerateSkillForm({ onDone }: { onDone: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.generateSkill({ prompt })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-st-thinking/25 bg-st-thinking/[0.06] p-3">
      <p className="text-xs font-medium text-st-thinking">Generar skill con IA</p>
      <p className="text-[11px] text-white/40">
        Describe la competencia o área de conocimiento y Copilot generará la skill con best practices.
      </p>
      {error && <p className="text-xs text-st-error">{error}</p>}
      <textarea
        autoFocus
        placeholder="Ej: testing con Vitest y React Testing Library, cubriendo edge cases y accesibilidad"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className={`resize-none ${fieldCls}`}
      />
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1 text-xs text-white/55 hover:text-white/85">Cancelar</button>
        <button
          onClick={submit}
          disabled={!prompt.trim() || busy}
          className="rounded-lg bg-st-thinking px-3 py-1 text-xs font-medium text-white hover:brightness-110 disabled:opacity-40"
        >
          {busy ? 'Generando…' : 'Generar'}
        </button>
      </div>
    </div>
  )
}

function CreateSkillForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.createSkill({ name, body })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-accent/25 bg-accent-weak p-3">
      <p className="text-xs font-medium text-accent">Nueva skill</p>
      {error && <p className="text-xs text-st-error">{error}</p>}
      <input
        autoFocus
        placeholder="Nombre (p. ej. Accesibilidad)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={fieldCls}
      />
      <textarea
        placeholder="Contenido de la skill (markdown)"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={`resize-none ${fieldCls}`}
      />
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="px-3 py-1 text-xs text-white/55 hover:text-white/85">Cancelar</button>
        <button
          onClick={submit}
          disabled={!name.trim() || busy}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-strong disabled:opacity-40"
        >
          {busy ? 'Creando…' : 'Crear'}
        </button>
      </div>
    </div>
  )
}

// ---- Main view --------------------------------------------------------------

export function TemplatesView({
  templates,
  skills,
  onReload,
}: {
  templates: AgentTemplate[]
  skills: SkillInfo[]
  onReload: () => Promise<void>
}) {
  const [creatingTpl, setCreatingTpl] = useState(false)
  const [generatingTpl, setGeneratingTpl] = useState(false)
  const [creatingSkill, setCreatingSkill] = useState(false)
  const [generatingSkill, setGeneratingSkill] = useState(false)

  const reload = () => { void onReload() }
  const finishCreateTpl = () => { setCreatingTpl(false); reload() }
  const finishGenerateTpl = () => { setGeneratingTpl(false); reload() }
  const finishCreateSkill = () => { setCreatingSkill(false); reload() }
  const finishGenerateSkill = () => { setGeneratingSkill(false); reload() }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">
      <h1 className="text-2xl font-semibold tracking-tight text-white/90">Templates & Skills</h1>
      <p className="mt-1 text-sm text-white/40">Gestiona las plantillas de agente y skills reutilizables.</p>

      <div className="mt-8 space-y-10">
        {/* Agent Templates */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/50">Agent Templates</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setGeneratingTpl(!generatingTpl); setCreatingTpl(false) }}
                className="rounded-lg border border-st-thinking/30 bg-st-thinking/[0.08] px-3 py-1.5 text-xs font-medium text-st-thinking transition-colors hover:bg-st-thinking/[0.15]"
              >
                Generar con IA
              </button>
              <button
                onClick={() => { setCreatingTpl(!creatingTpl); setGeneratingTpl(false) }}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-white/65 transition-colors hover:border-line-strong hover:text-white/90"
              >
                + Nueva plantilla
              </button>
            </div>
          </div>

          {generatingTpl && <div className="mb-3"><GenerateTemplateForm onDone={finishGenerateTpl} /></div>}
          {creatingTpl && <div className="mb-3"><CreateTemplateForm onDone={finishCreateTpl} /></div>}

          {templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-6 text-center text-sm text-white/40">
              No hay plantillas de agente.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {templates.map((tpl) => (
                <TemplateItem key={tpl.file} tpl={tpl} onReload={reload} />
              ))}
            </div>
          )}
        </div>

        {/* Skills */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/50">Skills</h2>
            <div className="flex gap-2">
              <button
                onClick={() => { setGeneratingSkill(!generatingSkill); setCreatingSkill(false) }}
                className="rounded-lg border border-st-thinking/30 bg-st-thinking/[0.08] px-3 py-1.5 text-xs font-medium text-st-thinking transition-colors hover:bg-st-thinking/[0.15]"
              >
                Generar con IA
              </button>
              <button
                onClick={() => { setCreatingSkill(!creatingSkill); setGeneratingSkill(false) }}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-white/65 transition-colors hover:border-line-strong hover:text-white/90"
              >
                + Nueva skill
              </button>
            </div>
          </div>

          {generatingSkill && <div className="mb-3"><GenerateSkillForm onDone={finishGenerateSkill} /></div>}
          {creatingSkill && <div className="mb-3"><CreateSkillForm onDone={finishCreateSkill} /></div>}

          {skills.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-surface/40 px-4 py-6 text-center text-sm text-white/40">
              No hay skills.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              {skills.map((skill) => (
                <SkillItem key={skill.id} skill={skill} onReload={reload} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
