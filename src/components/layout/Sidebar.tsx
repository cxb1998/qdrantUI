import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconCollections,
  IconBook,
  IconDataset,
  IconSettings,
  IconLock,
} from '../ui/icons'
import { useConnection } from '../../hooks/useConnection'
import { SettingsDialog } from './SettingsDialog'

const CONN_LABEL = {
  checking: { text: '连接中…', color: 'var(--color-warn)' },
  online: { text: '已连接', color: 'var(--color-ok)' },
  offline: { text: '未连接', color: 'var(--color-danger)' },
}

const EMBED_LABEL = {
  mock: { text: 'Mock', color: 'var(--color-indigo)' },
  checking: { text: '连接中…', color: 'var(--color-warn)' },
  online: { text: '已连接', color: 'var(--color-ok)' },
  offline: { text: '未连接', color: 'var(--color-danger)' },
}

export function Sidebar() {
  const { conn, state, embedState } = useConnection()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const c = CONN_LABEL[state]
  const e = EMBED_LABEL[embedState]
  const qdrantHost = conn.url.replace(/^https?:\/\//, '')
  const embedHost = conn.embed.useMock
    ? '浏览器内伪向量'
    : conn.embed.url.replace(/^https?:\/\//, '') || '未配置'

  return (
    <aside className="flex h-full w-[var(--sidebar-width)] shrink-0 flex-col border-r bg-surface">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
        <BrandMark />
        <div className="leading-tight">
          <div className="font-display text-[15px] font-semibold text-ink">向量库控制台</div>
          <div className="text-[11px] text-muted">向量集合管理</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2">
        <div className="px-2 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-soft">
          管理
        </div>
        <NavItem to="/collections" icon={<IconCollections />} label="集合管理" />

        <div className="px-2 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-soft">
          即将上线
        </div>
        <LockedItem icon={<IconBook />} label="教程" />
        <LockedItem icon={<IconDataset />} label="数据集" />
      </nav>

      <div className="space-y-2 border-t px-3 py-3">
        <ConnRow label="Qdrant" status={c.text} color={c.color} host={qdrantHost} ping={state === 'online'} />
        <ConnRow
          label="Embedding"
          status={e.text}
          color={e.color}
          host={embedHost}
          ping={embedState === 'online' || embedState === 'mock'}
        />
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] text-muted transition hover:bg-[var(--color-line)]/60 hover:text-ink"
        >
          <IconSettings className="text-[17px]" />
          连接设置
        </button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  )
}

function ConnRow({
  label,
  status,
  color,
  host,
  ping,
}: {
  label: string
  status: string
  color: string
  host: string
  ping: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
      <span className="relative flex size-2 shrink-0">
        {ping && (
          <span
            className="absolute inline-flex size-2 animate-ping rounded-full opacity-60"
            style={{ background: color }}
          />
        )}
        <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-medium text-muted">{label}</span>
          <span className="text-[12px] font-medium text-ink">{status}</span>
        </div>
        <div className="truncate font-mono text-[10.5px] text-muted" title={host}>
          {host}
        </div>
      </div>
    </div>
  )
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition ${
          isActive
            ? 'bg-[var(--color-indigo-soft)] text-[var(--color-indigo-deep)]'
            : 'text-ink-soft hover:bg-[var(--color-line)]/60'
        }`
      }
    >
      <span className="text-[18px]">{icon}</span>
      {label}
    </NavLink>
  )
}

function LockedItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-muted-soft"
      title="即将上线"
    >
      <span className="text-[18px]">{icon}</span>
      <span className="flex-1">{label}</span>
      <IconLock className="text-[13px] opacity-70" />
    </div>
  )
}

function BrandMark() {
  return (
    <div className="grid size-9 place-items-center rounded-xl bg-[var(--color-ink)]">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="7" cy="8" r="2" fill="var(--color-near)" />
        <circle cx="17" cy="7" r="2" fill="var(--color-far)" />
        <circle cx="14" cy="17" r="2" fill="#fff" />
        <path d="M8.5 8.6 15.4 15.8M9 8l6.4-.6" stroke="#fff" strokeWidth="1.2" opacity="0.55" />
      </svg>
    </div>
  )
}
