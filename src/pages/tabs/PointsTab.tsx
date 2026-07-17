import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { qdrant, type CollectionInfo, type ScoredPoint } from '../../lib/qdrant'
import { queryByVector, persistImagePreviewUrl, primaryVectorName } from '../../lib/imageSearch'
import {
  filtersToQdrantFilter,
  getSortablePayloadKeys,
  mergeFilterWithExcludedIds,
  parseSortValue,
  sortToOrderBy,
  sortToValue,
  type PayloadFilterCondition,
  type PointsSort,
} from '../../lib/pointsFilter'
import { Button } from '../../components/ui/Button'
import { usePermissions } from '../../hooks/useAuth'
import { Card, Loading, ErrorState, EmptyState, Tag } from '../../components/ui/primitives'
import { PointCard } from '../../components/points/PointCard'
import { PayloadFilterField } from '../../components/points/PayloadFilterField'
import { ImageSearchPanel } from '../../components/points/ImageSearchPanel'
import { BatchPayloadDialog } from '../../components/points/BatchPayloadDialog'
import { IngestDialog } from '../../components/points/IngestDialog'
import {
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconClose,
  IconGraph,
  IconUpload,
} from '../../components/ui/icons'

const PAGE_SIZE = 10

type OffsetValue = string | number | null | undefined

/** scroll 分页游标：默认按 ID；payload 排序时用 has_id 排除已读 */
type PageCursor =
  | { kind: 'id'; offset: OffsetValue }
  | { kind: 'order'; excludedIds: (string | number)[] }
  | { kind: 'page' }

function initialPageStack(sort: PointsSort): PageCursor[] {
  if (sort.mode === 'payload') return [{ kind: 'order', excludedIds: [] }]
  return [{ kind: 'id', offset: undefined }]
}

interface ImageSearchState {
  previewUrl: string
  vector: number[]
  mocked: boolean
}

export function PointsTab({ name, info }: { name: string; info: CollectionInfo }) {
  const navigate = useNavigate()
  const { canWrite } = usePermissions()
  const [filters, setFilters] = useState<PayloadFilterCondition[]>([])
  const [similarIds, setSimilarIds] = useState<(string | number)[]>([])
  const [usingVector, setUsingVector] = useState<string | null>(null)
  const [sort, setSort] = useState<PointsSort>({ mode: 'default' })
  const [pageStack, setPageStack] = useState<PageCursor[]>(() => initialPageStack({ mode: 'default' }))
  const [imageSearch, setImageSearch] = useState<ImageSearchState | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageMode, setImageMode] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [ingestOpen, setIngestOpen] = useState(false)

  const payloadSchema = info.payload_schema ?? {}
  const sortableKeys = useMemo(() => getSortablePayloadKeys(payloadSchema), [payloadSchema])

  useEffect(() => {
    if (sort.mode === 'payload' && !sortableKeys.includes(sort.key)) {
      setSort({ mode: 'default' })
      setPageStack(initialPageStack({ mode: 'default' }))
    }
  }, [sort, sortableKeys])

  const imageActive = imageSearch != null
  const similarActive = similarIds.length > 0 && !imageActive
  const filterActive = filters.length > 0
  const currentCursor = pageStack[pageStack.length - 1]
  const pageIndex = pageStack.length - 1
  const queryKey = JSON.stringify({ filters, similarIds, usingVector, sort })

  const qdrantFilter = useMemo(
    () => filtersToQdrantFilter(filters, payloadSchema),
    [filters, payloadSchema],
  )

  const scrollBody = useMemo(() => {
    const body: Record<string, unknown> = {
      limit: PAGE_SIZE,
      with_payload: true,
      with_vector: false,
    }
    const orderBy = sortToOrderBy(sort)
    if (sort.mode === 'payload' && orderBy) {
      body.order_by = orderBy
      const excluded =
        currentCursor.kind === 'order' ? currentCursor.excludedIds : []
      const filter = mergeFilterWithExcludedIds(qdrantFilter, excluded)
      if (filter) body.filter = filter
    } else {
      body.offset = currentCursor.kind === 'id' ? (currentCursor.offset ?? null) : null
      if (qdrantFilter) body.filter = qdrantFilter
    }
    return body
  }, [currentCursor, qdrantFilter, sort])

  const similarBody = useMemo(() => {
    const body: Record<string, unknown> = {
      query: { recommend: { positive: similarIds } },
      limit: PAGE_SIZE,
      offset: pageIndex * PAGE_SIZE,
      with_payload: true,
      with_vector: false,
    }
    if (usingVector) body.using = usingVector
    if (qdrantFilter) body.filter = qdrantFilter
    return body
  }, [similarIds, pageIndex, usingVector, qdrantFilter])

  const scrollQuery = useQuery({
    queryKey: ['points', name, queryKey, pageStack],
    queryFn: ({ signal }) => qdrant.scrollPoints(name, scrollBody, signal),
    enabled: !similarActive && !imageActive,
  })

  const similarQuery = useQuery({
    queryKey: ['points-similar', name, queryKey, pageIndex],
    queryFn: ({ signal }) => qdrant.queryPoints(name, similarBody, signal),
    enabled: similarActive && !imageActive,
  })

  const imageQuery = useQuery({
    queryKey: ['points-image', name, queryKey, imageSearch?.previewUrl, pageIndex],
    queryFn: ({ signal }) =>
      queryByVector(name, info, imageSearch!.vector, {
        limit: PAGE_SIZE,
        offset: pageIndex * PAGE_SIZE,
        filters,
        signal,
      }),
    enabled: imageActive,
  })

  const activeQuery = imageActive ? imageQuery : similarActive ? similarQuery : scrollQuery

  const listPoints: ScoredPoint[] = useMemo(() => {
    const data = activeQuery.data
    if (!data) return []
    if (imageActive) return data as ScoredPoint[]
    return (data as { points: ScoredPoint[] }).points
  }, [activeQuery.data, imageActive])

  function clearImageSearch() {
    setImageSearch((prev) => {
      if (prev?.previewUrl.startsWith('blob:')) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
    setImageLoading(false)
  }

  function cancelImageMode() {
    setImageMode(false)
  }

  async function openQueryGraph() {
    if (!imageSearch) return
    let previewUrl = imageSearch.previewUrl
    try {
      previewUrl = await persistImagePreviewUrl(previewUrl)
    } catch {
      // 保留 blob URL 作为兜底
    }
    navigate(`/collections/${encodeURIComponent(name)}/graph`, {
      state: {
        seedVector: imageSearch.vector,
        seedLabel: '查询图',
        previewUrl,
        vectorName: primaryVectorName(info) ?? null,
        filters,
      },
    })
  }

  function exitImageMode() {
    setImageMode(false)
    clearImageSearch()
    setPageStack(initialPageStack(sort))
  }

  function enterImageMode() {
    setImageMode(true)
    setBatchOpen(false)
    setIngestOpen(false)
    setSimilarIds([])
    setUsingVector(null)
    setPageStack([{ kind: 'page' }])
  }

  function handleFiltersChange(newFilters: PayloadFilterCondition[]) {
    setFilters(newFilters)
    setPageStack(initialPageStack(sort))
  }

  function handleSortChange(value: string) {
    const nextSort = parseSortValue(value)
    setSort(nextSort)
    setPageStack(initialPageStack(nextSort))
  }

  function clearAll() {
    setFilters([])
    setSimilarIds([])
    setUsingVector(null)
    setImageMode(false)
    clearImageSearch()
    setSort({ mode: 'default' })
    setPageStack(initialPageStack({ mode: 'default' }))
  }

  function findSimilar(id: string | number, vectorName?: string | null) {
    setSimilarIds([/^\d+$/.test(String(id)) ? Number(id) : id])
    setUsingVector(vectorName ?? null)
    exitImageMode()
    setPageStack([{ kind: 'page' }])
  }

  function nextPage() {
    if (similarActive || imageActive) {
      if (listPoints.length < PAGE_SIZE) return
      setPageStack((s) => [...s, { kind: 'page' }])
      return
    }
    if (sort.mode === 'payload') {
      if (listPoints.length < PAGE_SIZE) return
      const prevExcluded = currentCursor.kind === 'order' ? currentCursor.excludedIds : []
      const excludedIds = [...prevExcluded, ...listPoints.map((p) => p.id)]
      setPageStack((s) => [...s, { kind: 'order', excludedIds }])
      return
    }
    const next = scrollQuery.data?.next_page_offset
    if (next == null) return
    setPageStack((s) => [...s, { kind: 'id', offset: next }])
  }

  function prevPage() {
    setPageStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
  }

  const orderByActive = sort.mode === 'payload'
  const batchScopeReady = !similarActive && !imageActive && !imageMode
  const hasNext = similarActive || imageActive || orderByActive
    ? listPoints.length >= PAGE_SIZE
    : scrollQuery.data?.next_page_offset != null
  const hasPrev = pageStack.length > 1

  return (
    <div className="space-y-4">
      <Card padded className="space-y-3">
        {canWrite && (
          <button
            type="button"
            onClick={() => setIngestOpen(true)}
            className="dot-grid group flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3.5 transition hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]/40"
          >
            <IconUpload className="text-xl text-muted transition group-hover:text-[var(--color-indigo)]" />
            <span className="text-[14px] font-medium text-ink">数据入库</span>
          </button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <PayloadFilterField
            collectionName={name}
            filters={filters}
            onFiltersChange={handleFiltersChange}
            payloadSchema={payloadSchema}
          />
          {imageMode && (
            <ImageSearchPanel
              info={info}
              onSearchStart={() => {
                setImageLoading(true)
                setSimilarIds([])
                setUsingVector(null)
                setImageSearch(null)
                setPageStack([{ kind: 'page' }])
              }}
              onSearchDone={(result) => {
                setImageSearch(result)
                setImageLoading(false)
                setImageMode(false)
                setPageStack([{ kind: 'page' }])
              }}
              onClear={clearImageSearch}
            />
          )}
          {!similarActive && (
            <Button
              variant={imageMode || imageActive ? 'primary' : 'secondary'}
              size="md"
              onClick={() => (imageMode ? cancelImageMode() : enterImageMode())}
            >
              以图搜图
            </Button>
          )}
          {batchScopeReady && canWrite && (
            <Button variant="secondary" size="md" onClick={() => setBatchOpen(true)}>
              批量修改
            </Button>
          )}
          {!similarActive && !imageActive && !imageMode && (
            <select
              aria-label="排序方式"
              value={sortToValue(sort)}
              onChange={(e) => handleSortChange(e.target.value)}
              className="h-9.5 max-w-[11rem] shrink-0 cursor-pointer truncate rounded-lg border bg-surface px-2 font-mono text-[13px] text-ink"
            >
              <option value="default">默认顺序</option>
              {sortableKeys.map((key) => (
                <optgroup key={key} label={key}>
                  <option value={`${key}:asc`}>{key} ↑</option>
                  <option value={`${key}:desc`}>{key} ↓</option>
                </optgroup>
              ))}
            </select>
          )}
          {(filterActive || similarActive || imageActive || imageMode || sort.mode !== 'default') && (
            <Button variant="ghost" size="md" onClick={clearAll}>
              清除
            </Button>
          )}
        </div>

        {similarActive && (
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="indigo">
              相似于 {similarIds.map(String).join(', ')}
              {usingVector ? ` · ${usingVector}` : ''}
            </Tag>
            <button
              type="button"
              onClick={() => {
                setSimilarIds([])
                setUsingVector(null)
                setPageStack(initialPageStack(sort))
              }}
              className="inline-flex items-center gap-0.5 text-[12px] text-muted transition hover:text-ink"
            >
              <IconClose className="text-sm" />
              清除相似
            </button>
          </div>
        )}

        {imageActive && imageSearch && (
          <div className="flex flex-wrap items-center gap-2">
            <img
              src={imageSearch.previewUrl}
              alt=""
              className="size-9 rounded-md border object-cover"
            />
            <Tag tone="indigo">以图搜图</Tag>
            <Button variant="secondary" size="sm" icon={<IconGraph />} onClick={openQueryGraph}>
              打开图谱
            </Button>
            <button
              type="button"
              onClick={exitImageMode}
              className="inline-flex items-center gap-0.5 text-[12px] text-muted transition hover:text-ink"
            >
              <IconClose className="text-sm" />
              退出
            </button>
          </div>
        )}
      </Card>

      <IngestDialog
        open={ingestOpen}
        onOpenChange={setIngestOpen}
        collectionName={name}
        info={info}
      />

      <BatchPayloadDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        collectionName={name}
        filters={filters}
        qdrantFilter={qdrantFilter as Record<string, unknown> | null | undefined}
      />

      {imageLoading ? (
        <Loading label="正在提取向量…" />
      ) : activeQuery.error ? (
        <ErrorState message={(activeQuery.error as Error).message} onRetry={() => activeQuery.refetch()} />
      ) : activeQuery.isLoading ? (
        <Loading label={imageActive ? '正在检索相似点…' : '正在读取点数据…'} />
      ) : listPoints.length === 0 ? (
        <EmptyState
          title="没有点数据"
          desc={
            filterActive || similarActive || imageActive
              ? '当前条件下没有匹配的点。'
              : '该集合暂无数据。'
          }
        />
      ) : (
        <div className="flex flex-col gap-4" role="list">
          {listPoints.map((p) => (
            <PointCard
              key={String(p.id)}
              point={p}
              collectionName={name}
              info={info}
              score={'score' in p ? (p as ScoredPoint).score : undefined}
              onFindSimilar={findSimilar}
              onDeleted={() => activeQuery.refetch()}
              graphFilters={filters}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          icon={<IconRefresh />}
          onClick={() => activeQuery.refetch()}
        >
          刷新
        </Button>
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<IconChevronLeft />} disabled={!hasPrev} onClick={prevPage}>
            上一页
          </Button>
          <span className="text-[12.5px] text-muted tnum">第 {pageStack.length} 页</span>
          <Button size="sm" disabled={!hasNext} onClick={nextPage}>
            下一页
            <IconChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
