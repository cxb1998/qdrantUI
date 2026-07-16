import type { ReactNode } from 'react'
import { IconGraph } from '../ui/icons'

export const GRAPH_POINT_PANEL_TITLE = '点预览'

function IconGlow({ children }: { children: ReactNode }) {
  return (
    <div className="relative mb-5">
      <div
        className="absolute -inset-3 rounded-full opacity-70 blur-2xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--color-indigo) 18%, transparent) 0%, transparent 70%)',
        }}
      />
      <div className="relative grid size-[52px] place-items-center rounded-[14px] border border-[var(--color-line)] bg-surface shadow-[0_8px_24px_-12px_rgba(75,72,214,0.35)]">
        {children}
      </div>
    </div>
  )
}

function PreviewGhost() {
  return (
    <div className="mt-8 w-full max-w-[260px] select-none opacity-90" aria-hidden>
      <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-surface">
        <div className="h-9 border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-paper)_70%,white)]" />
        <div className="space-y-2.5 p-3">
          <div className="mx-auto size-[88px] rounded-md border border-dashed border-[var(--color-line-strong)] bg-[var(--color-paper)]" />
          <div className="space-y-1.5 pt-1">
            <div className="h-2 w-full rounded bg-[var(--color-line)]/70" />
            <div className="h-2 w-[88%] rounded bg-[var(--color-line)]/55" />
            <div className="h-2 w-[72%] rounded bg-[var(--color-line)]/40" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function GraphPanelHeader({
  title,
  subdued = false,
}: {
  title: string
  subdued?: boolean
}) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-[var(--color-line)] bg-[color-mix(in_srgb,var(--color-paper)_80%,transparent)] px-4">
      <span
        className={`font-mono ${subdued ? 'text-[13px] text-muted' : 'text-[15px] font-semibold text-ink'}`}
      >
        {title}
      </span>
    </header>
  )
}

/** 左侧画布：无图谱时展示入口说明（唯一一处操作指引） */
export function GraphCanvasEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 pb-12 pt-6">
      <IconGlow>
        <IconGraph className="text-[22px] text-[var(--color-indigo)]" />
      </IconGlow>
      <h4 className="font-display text-[15px] font-semibold tracking-tight text-ink">从数据管理进入</h4>
      <p className="mt-2 whitespace-nowrap text-center text-[12.5px] leading-relaxed text-muted">
        点击某个点或以图搜图后的「打开图谱」进入
      </p>
    </div>
  )
}

/** 右侧点预览：仅结构与占位，不重复左侧说明 */
export function GraphPointEmpty({ hasGraph }: { hasGraph: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphPanelHeader title={GRAPH_POINT_PANEL_TITLE} subdued />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-10 pt-4">
        {!hasGraph ? (
          <p className="text-[12.5px] text-muted-soft">等待图谱</p>
        ) : (
          <p className="font-display text-[14px] font-medium text-muted">悬停节点</p>
        )}
        <PreviewGhost />
      </div>
    </div>
  )
}
