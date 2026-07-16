import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCollection } from '../hooks/useQdrant'
import { StatusDot, Loading, ErrorState } from '../components/ui/primitives'
import {
  IconChevronLeft,
  IconPoints,
  IconSliders,
  IconMemory,
  IconTarget,
  IconCamera,
  IconGraph,
} from '../components/ui/icons'
import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { PointsTab } from './tabs/PointsTab'
import { OptimizationsTab } from './tabs/OptimizationsTab'
import { MemoryTab } from './tabs/MemoryTab'
import { RecallTab } from './tabs/RecallTab'
import { SnapshotsTab } from './tabs/SnapshotsTab'

const GraphTab = lazy(() => import('./tabs/GraphTab').then((m) => ({ default: m.GraphTab })))

const TABS: { id: string; label: string; icon: ReactNode }[] = [
  { id: 'points', label: '数据管理', icon: <IconPoints /> },
  { id: 'optimizations', label: '优化&配置', icon: <IconSliders /> },
  { id: 'memory', label: '资源占用', icon: <IconMemory /> },
  { id: 'recall', label: '检索评测', icon: <IconTarget /> },
  { id: 'snapshots', label: '备份&恢复', icon: <IconCamera /> },
  { id: 'graph', label: '图谱', icon: <IconGraph /> },
]

function TabPanel({
  id,
  active,
  mounted,
  children,
}: {
  id: string
  active: boolean
  mounted: boolean
  children: ReactNode
}) {
  if (!mounted) return null
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} hidden={!active} aria-hidden={!active}>
      {children}
    </div>
  )
}

export function CollectionDetailPage() {
  const { name = '', tab = 'points' } = useParams()
  const navigate = useNavigate()
  const { data: info, isLoading, error, refetch } = useCollection(name, 12_000)

  const activeTab = TABS.some((t) => t.id === tab) ? tab : 'points'
  const isGraphTab = activeTab === 'graph'
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set([activeTab]))

  useEffect(() => {
    setMountedTabs(new Set([activeTab]))
  }, [name])

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])

  return (
    <div
      className={
        isGraphTab
          ? 'flex min-h-full flex-col'
          : 'mx-auto w-full max-w-[1120px] px-8 py-8'
      }
    >
      <div className={isGraphTab ? 'shrink-0 px-8 pt-8' : undefined}>
        <Link
          to="/collections"
          className="mb-5 inline-flex items-center gap-1 text-[13px] text-muted transition hover:text-ink"
        >
          <IconChevronLeft className="text-base" />
          返回集合
        </Link>

        <header className={isGraphTab ? 'mb-5' : 'mb-6'}>
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-[28px] font-semibold leading-none tracking-tight text-ink">
              {name}
            </h1>
            {info && <StatusDot status={info.status} showLabel size="lg" />}
          </div>
        </header>
      </div>

      <div
        className={`tab-nav flex shrink-0 gap-1 border-b ${
          isGraphTab ? 'px-8' : 'mb-6'
        }`}
      >
        {TABS.map((t) => {
          const isActive = t.id === activeTab
          return (
            <button
              key={t.id}
              onClick={() => navigate(`/collections/${encodeURIComponent(name)}/${t.id}`)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-1 text-[13.5px] font-medium transition ${
                isActive ? 'text-ink' : 'text-muted hover:text-ink-soft'
              }`}
            >
              <span className="text-[16px]">{t.icon}</span>
              {t.label}
              {isActive && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--color-indigo)]" />
              )}
            </button>
          )
        })}
      </div>

      <div className={isGraphTab ? 'min-h-0 flex-1' : undefined}>
      {error ? (
        <div className={isGraphTab ? 'px-8 py-8' : undefined}>
          <ErrorState message={error.message} onRetry={() => refetch()} />
        </div>
      ) : isLoading || !info ? (
        <div className={isGraphTab ? 'px-8 py-8' : undefined}>
          <Loading label="正在读取集合信息…" />
        </div>
      ) : (
        <>
          <TabPanel id="points" active={activeTab === 'points'} mounted={mountedTabs.has('points')}>
            <PointsTab key={name} name={name} info={info} />
          </TabPanel>
          <TabPanel
            id="optimizations"
            active={activeTab === 'optimizations'}
            mounted={mountedTabs.has('optimizations')}
          >
            <OptimizationsTab key={name} name={name} info={info} />
          </TabPanel>
          <TabPanel id="memory" active={activeTab === 'memory'} mounted={mountedTabs.has('memory')}>
            <MemoryTab key={name} name={name} info={info} />
          </TabPanel>
          <TabPanel id="recall" active={activeTab === 'recall'} mounted={mountedTabs.has('recall')}>
            <RecallTab key={name} name={name} info={info} />
          </TabPanel>
          <TabPanel id="snapshots" active={activeTab === 'snapshots'} mounted={mountedTabs.has('snapshots')}>
            <SnapshotsTab key={name} name={name} />
          </TabPanel>
          <TabPanel id="graph" active={activeTab === 'graph'} mounted={mountedTabs.has('graph')}>
            <Suspense fallback={<Loading label="正在加载图谱组件…" />}>
              <GraphTab key={name} name={name} info={info} />
            </Suspense>
          </TabPanel>
        </>
      )}
      </div>
    </div>
  )
}
