import { PointPreview } from '../points/PointPreview'
import { Loading } from '../ui/primitives'
import { IconAlert } from '../ui/icons'
import { IMAGE_QUERY_SEED_ID } from '../../lib/graphConstants'
import {
  GRAPH_POINT_PANEL_TITLE,
  GraphPanelHeader,
  GraphPointEmpty,
} from './GraphEmptyPane'
import type { PointStruct } from '../../lib/qdrant'

function QueryImagePreview({ previewUrl }: { previewUrl: string }) {
  return (
    <div className="flex flex-col items-center py-6">
      <button
        type="button"
        className="relative size-[300px] shrink-0 cursor-pointer overflow-hidden rounded-[5px] border border-[var(--color-line-strong)] bg-surface-2"
        title="查询图"
      >
        <img src={previewUrl} alt="查询图" className="size-full object-contain" />
      </button>
    </div>
  )
}

function GraphPointLoadError() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphPanelHeader title={GRAPH_POINT_PANEL_TITLE} subdued />
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-[var(--color-danger-soft)]">
          <IconAlert className="text-[20px] text-[var(--color-danger)]" />
        </div>
        <p className="font-display text-[14px] font-semibold text-ink">无法加载点数据</p>
        <p className="mt-1.5 text-center text-[12.5px] text-muted">请稍后重试。</p>
      </div>
    </div>
  )
}

export function GraphPointPanel({
  collectionName,
  activeNodeId,
  point,
  loading,
  queryPreview,
  hasGraph,
}: {
  collectionName: string
  activeNodeId: string | null
  point: PointStruct | null
  loading: boolean
  queryPreview: string | null
  hasGraph: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {!activeNodeId && <GraphPointEmpty hasGraph={hasGraph} />}

      {activeNodeId === IMAGE_QUERY_SEED_ID && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <GraphPanelHeader title="查询图" />
          {queryPreview ? (
            <QueryImagePreview previewUrl={queryPreview} />
          ) : (
            <p className="px-4 py-3 text-[13px] text-muted">以图搜图起点</p>
          )}
        </div>
      )}

      {activeNodeId && activeNodeId !== IMAGE_QUERY_SEED_ID && loading && (
        <div className="flex flex-1 items-center justify-center p-6">
          <Loading label="正在读取点数据…" />
        </div>
      )}

      {activeNodeId && activeNodeId !== IMAGE_QUERY_SEED_ID && !loading && point && (
        <PointPreview point={point} collectionName={collectionName} />
      )}

      {activeNodeId && activeNodeId !== IMAGE_QUERY_SEED_ID && !loading && !point && (
        <GraphPointLoadError />
      )}
    </div>
  )
}
