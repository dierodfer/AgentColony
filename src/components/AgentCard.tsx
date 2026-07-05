import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AgentRobot } from './AgentIdentity'
import { CliBadge } from './CliBadge'
import { StatusBadge } from './StatusBadge'
import { cleanText } from '../lib/text'
import type { AgentConfig, AgentRuntime } from '../types'

const IDLE: AgentRuntime = { status: 'idle', text: '', aic: 0, inputTokens: 0, outputTokens: 0, startedAt: null, elapsedMs: null }

/** Formatea una duración en ms como "1m 24s" o "8.4s". */
function fmtDuration(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s - m * 60)}s`
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Pensando">
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/40" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/40" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white/40" />
    </span>
  )
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden>
      <path
        d="M11.5 2.5l2 2L6 12l-2.7.7L4 10l7.5-7.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden>
      <path
        d="M3 4.5h10M6.5 4V3h3v1M5 4.5l.5 8h5l.5-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SparkleIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden style={{ color }}>
      <path
        d="M8 1.5l1.4 3.7L13 6.5l-3.6 1.3L8 11.5 6.6 7.8 3 6.5l3.6-1.3z"
        fill="currentColor"
      />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.5V10l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <ellipse cx="10" cy="5" rx="6" ry="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5v10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** Cuerpo de la respuesta, renderizado dentro de la propia tarjeta. */
function ResponseBody({ runtime }: { runtime: AgentRuntime }) {
  const { status, text, error } = runtime
  const isWorking = status === 'starting' || status === 'thinking'
  const display = cleanText(text)

  if (status === 'error') {
    return <p className="text-[13px] leading-relaxed text-st-error">{error || 'Algo salió mal.'}</p>
  }
  if (display) {
    return (
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-white/75">
        {display}
        {status === 'responding' && <span className="stream-caret ml-0.5 text-accent">▍</span>}
      </p>
    )
  }
  if (isWorking) return <TypingDots />
  return <p className="text-[13px] leading-relaxed text-white/30">A la espera de la consulta.</p>
}

/**
 * Tarjeta premium de un agente: identidad, especialidad, modelo, estado, skills
 * y su respuesta — todo visible simultáneamente, sin paneles ni modales.
 */
export function AgentCard({
  agent,
  templateName,
  model,
  accent,
  runtime,
  available,
  onEdit,
  onDelete,
}: {
  agent: AgentConfig
  templateName: string
  model: string
  accent: string
  runtime: AgentRuntime | undefined
  available?: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const rt = runtime ?? IDLE
  const [confirming, setConfirming] = useState(false)
  const [tokensOpen, setTokensOpen] = useState(false)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [minimalBadge, setMinimalBadge] = useState(false)

  const [liveMs, setLiveMs] = useState<number | null>(null)
  useEffect(() => {
    if (rt.startedAt == null || rt.elapsedMs != null) { setLiveMs(null); return }
    setLiveMs(Date.now() - rt.startedAt)
    const id = setInterval(() => setLiveMs(Date.now() - rt.startedAt!), 200)
    return () => clearInterval(id)
  }, [rt.startedAt, rt.elapsedMs])

  useEffect(() => {
    if (rt.status !== 'finished') { setMinimalBadge(false); return }
    const id = setTimeout(() => setMinimalBadge(true), 10000)
    return () => clearTimeout(id)
  }, [rt.status])

  const displayMs = rt.elapsedMs ?? liveMs

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  return (
    <motion.div
      layout
      onMouseMove={onMouseMove}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{ ['--card-accent' as string]: accent }}
      className="card-spotlight group relative flex h-full flex-col overflow-visible rounded-2xl border border-line bg-surface px-5 pb-5 pt-5 transition-colors duration-200 hover:border-transparent hover:bg-surface-2"
    >
      {/* Estado en esquina superior derecha */}
      <div className="absolute right-4 top-3 z-20">
        {minimalBadge ? (
          <div className="group/badge relative -m-1.5 cursor-default p-1.5">
            <span
              className="block h-2 w-2 rounded-full"
              style={{ backgroundColor: 'var(--color-st-finished)' }}
            />
            <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/badge:opacity-100">
              <StatusBadge status={rt.status} />
            </div>
          </div>
        ) : (
          <StatusBadge status={rt.status} />
        )}
      </div>

      {/* Robot prominente sobresaliendo de la card */}
      <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2">
        <div className="relative">
          <AgentRobot id={agent.avatar} status={rt.status} size={89} />
          <span className="absolute -bottom-0.5 -right-0.5">
            <CliBadge cli={agent.cli} size={26} available={available} />
          </span>
        </div>
      </div>

      {/* Nombre + controles */}
      <div className="mt-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold leading-tight text-white/95">{agent.name}</p>
          <p className="truncate text-sm font-medium text-white/45">{templateName}</p>
        </div>

        {confirming ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                setConfirming(false)
                onDelete()
              }}
              className="rounded-md bg-st-error/15 px-2.5 py-1.5 text-[11px] font-medium text-st-error transition-colors hover:bg-st-error/25"
            >
              Eliminar
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-md px-2 py-1.5 text-[11px] font-medium text-white/55 transition-colors hover:text-white/80"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onEdit}
              title="Editar agente"
              aria-label="Editar agente"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-white/45 transition-colors hover:border-line-strong hover:bg-white/[0.06] hover:text-white/85"
            >
              <PencilIcon />
            </button>
            <button
              onClick={() => setConfirming(true)}
              title="Eliminar agente"
              aria-label="Eliminar agente"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-st-error/25 bg-st-error/10 text-st-error transition-colors hover:bg-st-error/20"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {/* Modelo + skills */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-[12px] font-medium text-white/75">
          <SparkleIcon color={accent} />
          {model}
        </span>
        {agent.skills.length > 0 && (
          skillsOpen ? (
            <>
              {agent.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-[12px] font-medium text-white/55"
                >
                  {s}
                </span>
              ))}
              <button
                onClick={() => setSkillsOpen(false)}
                className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-[12px] font-medium text-white/35 hover:text-white/60"
              >
                ↑
              </button>
            </>
          ) : (
            <button
              onClick={() => setSkillsOpen(true)}
              className="rounded-lg border border-line bg-white/[0.03] px-2.5 py-1 text-[12px] font-medium text-white/55 hover:text-white/80"
            >
              {agent.skills.length} skill{agent.skills.length !== 1 ? 's' : ''} ▾
            </button>
          )
        )}
      </div>

      <div className="my-4 h-px bg-line" />

      {/* Respuesta dentro de la tarjeta */}
      <div className="scroll-thin max-h-56 min-h-[5.5rem] flex-1 overflow-y-auto rounded-xl bg-white/[0.025] p-3">
        <ResponseBody runtime={rt} />
      </div>

      {/* Stats: duración + tokens */}
      <div className="mt-3 flex items-stretch rounded-xl bg-white/[0.025] p-3">
          <div className="flex flex-1 items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <ClockIcon />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-white/40">Duración</p>
              <p className="text-base font-semibold tabular-nums text-accent">
                {displayMs != null ? fmtDuration(displayMs) : '—'}
              </p>
            </div>
          </div>
          <div className="w-px self-stretch bg-line" />
          <div className="relative flex flex-1 items-center gap-3 pl-3">
            <button
              onClick={() => setTokensOpen((v) => !v)}
              className="flex w-full items-center gap-3 text-left"
              title="Ver desglose de tokens"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-st-thinking/10 text-st-thinking">
                <DatabaseIcon />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-white/40">Tokens</p>
                <p className="text-base font-semibold text-white/85">
                  {(rt.inputTokens + rt.outputTokens).toLocaleString()}
                </p>
              </div>
            </button>
            {tokensOpen && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-44 rounded-xl border border-line bg-surface-2 p-3 shadow-lg">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">Desglose</p>
                {rt.inputTokens > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-white/55">In</span>
                    <span className="font-medium text-white/85">{rt.inputTokens.toLocaleString()}</span>
                  </div>
                )}
                <div className={`flex justify-between text-[12px] ${rt.inputTokens > 0 ? 'mt-1' : ''}`}>
                  <span className="text-white/55">Out</span>
                  <span className="font-medium text-white/85">{rt.outputTokens.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>

    </motion.div>
  )
}
