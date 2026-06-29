import { useState } from 'react'
import type { RunEntry } from '../hooks/useOfficeRun'

function fmtDuration(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.round(s - m * 60)}s`
}

function AicIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <path d="M10 2l2.5 5.5H18l-4.5 3.5 1.7 5.5L10 13l-5.2 3.5L6.5 11 2 7.5h5.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 10.5l2.5 2.5 4-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function TokensIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <ellipse cx="10" cy="5" rx="6" ry="2.4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5v10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4" stroke="currentColor" strokeWidth="1.5" />
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
function RequestsIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden>
      <path d="M3 5h14M3 10h14M3 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Stat({
  icon, value, label, color = 'text-white/85', iconColor = 'text-white/40', onClick,
}: {
  icon: React.ReactNode
  value: string
  label: string
  color?: string
  iconColor?: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className={`shrink-0 ${iconColor}`}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-base font-semibold tabular-nums ${color}`}>{value}</p>
        <p className="text-[11px] text-white/35">{label}</p>
      </div>
    </>
  )
  return (
    <div className="flex flex-1 items-center gap-3 px-4 py-3">
      {onClick
        ? <button onClick={onClick} className="flex w-full items-center gap-3 text-left transition-opacity hover:opacity-75">{inner}</button>
        : inner}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line-strong bg-elevated p-5 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/90">{title}</h3>
          <button onClick={onClose} className="text-lg leading-none text-white/40 transition-colors hover:text-white/80">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

type ModalKey = 'aic' | 'tokens' | 'requests' | null

export function UsageSummary({
  totalAic, completedCount: _c, totalAgents, totalTokens,
  avgElapsedMs, requestCount, runHistory, history, onSelectPrompt,
}: {
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
  const [modal, setModal] = useState<ModalKey>(null)

  return (
    <>
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap divide-x divide-line">
          <Stat
            icon={<AicIcon />}
            value={totalAic.toFixed(2)}
            label="AIC total"
            color="text-accent"
            iconColor="text-accent/70"
            onClick={runHistory.length > 0 ? () => setModal('aic') : undefined}
          />
          <Stat
            icon={<CheckIcon />}
            value={String(totalAgents)}
            label="Agentes disponibles"
            color="text-st-finished"
            iconColor="text-st-finished/70"
          />
          <Stat
            icon={<TokensIcon />}
            value={totalTokens.toLocaleString()}
            label="Tokens totales"
            iconColor="text-st-thinking/70"
            onClick={runHistory.length > 0 ? () => setModal('tokens') : undefined}
          />
          <Stat
            icon={<ClockIcon />}
            value={avgElapsedMs != null ? fmtDuration(avgElapsedMs) : '—'}
            label="Tiempo medio"
            color="text-yellow-400"
            iconColor="text-yellow-400/70"
          />
          <Stat
            icon={<RequestsIcon />}
            value={String(requestCount)}
            label="Peticiones lanzadas"
            onClick={() => setModal('requests')}
          />
        </div>
      </div>

      {modal === 'aic' && (
        <Modal title="AIC por petición" onClose={() => setModal(null)}>
          <div className="space-y-1.5">
            {runHistory.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
                <span className="truncate text-[13px] text-white/60" title={r.prompt}>#{i + 1} {r.prompt}</span>
                <span className="shrink-0 font-semibold text-accent">{r.aic.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm">
            <span className="text-white/45">Total</span>
            <span className="font-semibold text-accent">{totalAic.toFixed(2)}</span>
          </div>
        </Modal>
      )}

      {modal === 'tokens' && (
        <Modal title="Tokens por petición" onClose={() => setModal(null)}>
          <div className="space-y-1.5">
            {runHistory.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
                <span className="truncate text-[13px] text-white/60" title={r.prompt}>#{i + 1} {r.prompt}</span>
                <span className="shrink-0 font-semibold text-white/85">{r.tokens.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-3 text-sm">
            <span className="text-white/45">Total</span>
            <span className="font-semibold text-white/85">{totalTokens.toLocaleString()}</span>
          </div>
        </Modal>
      )}

      {modal === 'requests' && (
        <Modal title="Peticiones anteriores" onClose={() => setModal(null)}>
          {history.length === 0 ? (
            <p className="text-sm text-white/40">Sin peticiones aún.</p>
          ) : (
            <div className="space-y-2">
              {history.map((q, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3">
                  <p className="flex-1 text-[13px] leading-snug text-white/70">{q}</p>
                  <button
                    onClick={() => { onSelectPrompt(q); setModal(null) }}
                    className="shrink-0 rounded-lg bg-accent/15 px-2.5 py-1 text-[12px] font-medium text-accent transition-colors hover:bg-accent/25"
                  >
                    Usar
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
