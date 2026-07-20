import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconCollections,
  IconBook,
  IconDataset,
  IconSettings,
  IconLock,
  IconLogOut,
} from '../ui/icons'
import { useConnection } from '../../hooks/useConnection'
import { useAuthOptional, usePermissions } from '../../hooks/useAuth'
import { SettingsDialog } from './SettingsDialog'
import { QDRANT_API_BASE } from '../../lib/config'

type ConnState = 'checking' | 'online' | 'offline'

const CONN_META: Record<ConnState, { text: string; color: string }> = {
  checking: { text: '连接中', color: 'var(--color-warn)' },
  online: { text: '已连接', color: 'var(--color-ok)' },
  offline: { text: '未连接', color: 'var(--color-danger)' },
}

const EMBED_META = CONN_META

export function Sidebar() {
  const auth = useAuthOptional()
  const { role, username } = usePermissions()
  const { state, embedState } = useConnection()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const roleLabel = role === 'admin' ? '管理员' : '只读'
  const embedHint = '经 BFF 代理'

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

      {username && (
        <div className="border-t bg-gradient-to-b from-transparent to-[var(--color-surface-2)] px-3 py-3">
          <div className="overflow-hidden rounded-[12px] border border-[var(--color-line)] bg-surface shadow-[0_1px_3px_rgba(18,20,26,0.04)]">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <div
                className="grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-[var(--color-indigo-deep)]"
                style={{ background: 'var(--color-indigo-soft)' }}
                aria-hidden
              >
                {username[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium leading-tight text-ink">{username}</div>
                <span
                  className={`mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[10.5px] font-medium leading-none ${
                    role === 'admin'
                      ? 'bg-[var(--color-indigo-soft)] text-[var(--color-indigo-deep)]'
                      : 'bg-[var(--color-line)]/50 text-muted'
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
            </div>

            <div className="border-t border-[var(--color-line)]/70 px-3 py-2">
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-soft">
                服务状态
              </div>
              <div className="space-y-1">
                <StatusRow
                  label="Qdrant"
                  hint={QDRANT_API_BASE}
                  meta={CONN_META[state]}
                  active={state === 'online'}
                />
                <StatusRow
                  label="向量服务"
                  hint={embedHint}
                  meta={EMBED_META[embedState]}
                  active={embedState === 'online'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-[var(--color-line)]/70">
              <FooterAction icon={<IconSettings />} label="设置" onClick={() => setSettingsOpen(true)} />
              <FooterAction
                icon={<IconLogOut />}
                label="退出"
                onClick={() => void auth?.logout()}
                className="border-l border-[var(--color-line)]/70"
              />
            </div>
          </div>
        </div>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </aside>
  )
}

function StatusRow({
  label,
  hint,
  meta,
  active,
}: {
  label: string
  hint: string
  meta: { text: string; color: string }
  active: boolean
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-1 py-0.5"
      title={hint}
    >
      <span className="relative flex size-1.5 shrink-0">
        {active && (
          <span
            className="absolute -inset-0.5 animate-ping rounded-full opacity-40"
            style={{ background: meta.color }}
          />
        )}
        <span className="relative size-1.5 rounded-full" style={{ background: meta.color }} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{label}</span>
      <span className="shrink-0 text-[11.5px] font-medium tabular-nums" style={{ color: meta.color }}>
        {meta.text}
      </span>
    </div>
  )
}

function FooterAction({
  icon,
  label,
  onClick,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 px-2 py-2.5 text-[12.5px] font-medium text-muted transition hover:bg-[var(--color-line)]/35 hover:text-ink ${className}`}
    >
      <span className="text-[15px]">{icon}</span>
      {label}
    </button>
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
