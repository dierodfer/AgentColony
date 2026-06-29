import { useState } from 'react'
import type { ReactNode } from 'react'

export type SectionId = 'agentes' | 'templates'

function BrandMark() {
  return (
    <svg viewBox="0 0 28 28" width="22" height="22" fill="none" aria-hidden>
      <path d="M14 6.5L7 19.5h14L14 6.5z" stroke="var(--color-accent)" strokeWidth="1.4" strokeLinejoin="round" opacity="0.5" />
      <circle cx="14" cy="6.5" r="2.4" fill="var(--color-accent)" />
      <circle cx="7" cy="19.5" r="2.4" fill="#2DD4A7" />
      <circle cx="21" cy="19.5" r="2.4" fill="#A78BFA" />
    </svg>
  )
}

function AgentsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function TemplatesIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden>
      <path d="M4 2.5h8a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5H4A1.5 1.5 0 012.5 12V4A1.5 1.5 0 014 2.5z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 6h5M5.5 8.5h3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ right }: { right: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
      <path
        d={right ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NavItem({
  label,
  count,
  active,
  icon,
  collapsed,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  icon: ReactNode
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`flex w-full items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150 ${
        collapsed ? 'justify-center' : 'gap-2.5'
      } ${
        active
          ? 'bg-white/[0.06] text-white/90'
          : 'text-white/55 hover:bg-white/[0.04] hover:text-white/80'
      }`}
    >
      <span className={active ? 'text-accent' : 'text-white/40'}>{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {count !== undefined && (
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-medium text-white/45">
              {count}
            </span>
          )}
        </>
      )}
    </button>
  )
}

export function Sidebar({
  active,
  agentCount,
  onNavigate,
}: {
  active: SectionId
  agentCount: number
  onNavigate: (id: SectionId) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-line bg-surface/40 px-2 py-5 transition-[width] duration-200 md:flex ${
        collapsed ? 'w-14' : 'w-[224px]'
      }`}
    >
      {/* Header: logo + toggle */}
      <div className={`flex items-center px-0.5 ${collapsed ? 'justify-center' : 'justify-between px-2.5'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white/90">Multiagent</p>
              <p className="text-[11px] text-white/35">Especialistas IA</p>
            </div>
          </div>
        )}
        {collapsed && <BrandMark />}
        <button
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? 'Expandir' : 'Colapsar'}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70 ${collapsed ? 'mt-1' : ''}`}
        >
          <ChevronIcon right={collapsed} />
        </button>
      </div>

      <nav className="mt-7 flex flex-col gap-0.5">
        <NavItem
          label="Agentes"
          icon={<AgentsIcon />}
          count={agentCount}
          active={active === 'agentes'}
          collapsed={collapsed}
          onClick={() => onNavigate('agentes')}
        />
        <NavItem
          label="Templates & Skills"
          icon={<TemplatesIcon />}
          active={active === 'templates'}
          collapsed={collapsed}
          onClick={() => onNavigate('templates')}
        />
      </nav>
    </aside>
  )
}
