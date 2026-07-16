import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ForceGraph2D from 'react-force-graph-2d'
import { Group, Panel, useDefaultLayout } from 'react-resizable-panels'
import type { CollectionInfo, PointStruct, ScoredPoint } from '../../lib/qdrant'
import { primaryVectorParams, qdrant } from '../../lib/qdrant'
import { GraphPointPanel } from '../../components/graph/GraphPointPanel'
import { GraphCanvasEmpty } from '../../components/graph/GraphEmptyPane'
import { GraphFilterBar } from '../../components/graph/GraphFilterBar'
import { GraphPanelSeparator } from '../../components/graph/GraphPanelSeparator'
import { IMAGE_QUERY_SEED_ID } from '../../lib/graphConstants'
import { createLinkScoreStyle, LINK_COLOR, LINK_STYLE_LEGEND } from '../../lib/graphLinkStyle'
import { persistImagePreviewUrl } from '../../lib/imageSearch'
import {
  filtersToQdrantFilter,
  type PayloadFilterCondition,
} from '../../lib/pointsFilter'
import { useViewportFillHeight } from '../../hooks/useViewportFillHeight'
import { Loading } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'

interface GNode {
  id: string
  seed?: boolean
  expanded?: boolean
}
interface GLink {
  source: string
  target: string
  score: number
}

const MAX_NODES = 220
const NEIGHBORS = 6
const NODE_R = 4
const GRAPH_MIN_HEIGHT = 360

/** 与官方 qdrant-web-ui GraphVisualisation 默认配色一致 */
const GRAPH_COLORS = {
  nodeDefault: '#2cb',
  nodeClicked: '#e94',
  nodeHighlightRing: '#817',
  linkDefault: '#a6a6a6',
} as const

export type GraphNavState = {
  seedId?: string
  vectorName?: string | null
  newInitNode?: { id: string | number }
  seedVector?: number[]
  seedLabel?: string
  previewUrl?: string
  filters?: PayloadFilterCondition[]
}

type GraphSeed =
  | { kind: 'point'; id: string }
  | { kind: 'vector'; vector: number[] }

const GRAPH_PANEL_IDS = ['graph-canvas', 'graph-point-panel'] as const

function filtersEqual(a: PayloadFilterCondition[], b: PayloadFilterCondition[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** undefined = 使用 appliedFilters；null = 明确不加 filter */
function resolveQueryFilter(
  override: Record<string, unknown> | null | undefined,
  applied: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (override !== undefined) return override ?? undefined
  return applied
}

export function GraphTab({ name, info }: { name: string; info: CollectionInfo }) {
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const navState = location.state as GraphNavState | null
  const navSeed = navState?.seedId ?? (navState?.newInitNode ? String(navState.newInitNode.id) : undefined)
  const navSeedVector = navState?.seedVector
  const navVectorName = navState?.vectorName ?? null
  const defaultVectorName = useMemo(() => primaryVectorParams(info.config).named[0], [info])
  const payloadSchema = info.payload_schema ?? {}
  const navFilters = navState?.filters ?? []
  const navFiltersKey = JSON.stringify(navFilters)
  const [usingName, setUsingName] = useState<string | undefined>(defaultVectorName)
  const [draftFilters, setDraftFilters] = useState<PayloadFilterCondition[]>(navFilters)
  const [appliedFilters, setAppliedFilters] = useState<PayloadFilterCondition[]>(navFilters)
  const graphSeedRef = useRef<GraphSeed | null>(null)
  const skipNavFilterSyncRef = useRef(false)

  const qdrantFilter = useMemo(
    () => filtersToQdrantFilter(appliedFilters, payloadSchema) as Record<string, unknown> | undefined,
    [appliedFilters, payloadSchema],
  )
  const filterDirty = !filtersEqual(draftFilters, appliedFilters)

  useEffect(() => {
    if (navVectorName) setUsingName(navVectorName)
    else if (navSeed) setUsingName(undefined)
  }, [navSeed, navVectorName])

  const [nodes, setNodes] = useState<GNode[]>([])
  const [links, setLinks] = useState<GLink[]>([])
  const [loading, setLoading] = useState(false)
  const [queryPreview, setQueryPreview] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [previewPoint, setPreviewPoint] = useState<PointStruct | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewReqRef = useRef(0)
  const shellRef = useRef<HTMLDivElement>(null)
  const graphWrapRef = useRef<HTMLDivElement>(null)
  const canvasHeight = useViewportFillHeight(shellRef, GRAPH_MIN_HEIGHT)
  const [graphSize, setGraphSize] = useState({ width: 640, height: GRAPH_MIN_HEIGHT })
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `graph-layout-v2-${name}`,
    panelIds: [...GRAPH_PANEL_IDS],
    storage: localStorage,
  })

  useEffect(() => {
    const el = graphWrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setGraphSize({
        width: Math.max(width, 280),
        height: Math.max(height, GRAPH_MIN_HEIGHT),
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!selectedNodeId || selectedNodeId === IMAGE_QUERY_SEED_ID) {
      setPreviewPoint(null)
      setPreviewLoading(false)
      return
    }

    const reqId = ++previewReqRef.current
    setPreviewLoading(true)
    setPreviewPoint(null)

    const pointId = /^\d+$/.test(selectedNodeId) ? Number(selectedNodeId) : selectedNodeId
    qdrant
      .getPoint(name, pointId)
      .then((p) => {
        if (previewReqRef.current === reqId) {
          setPreviewPoint(p)
          setPreviewLoading(false)
        }
      })
      .catch(() => {
        if (previewReqRef.current === reqId) {
          setPreviewPoint(null)
          setPreviewLoading(false)
        }
      })
  }, [selectedNodeId, name])

  function nodeFill(node: GNode): string {
    return node.seed || node.expanded ? GRAPH_COLORS.nodeClicked : GRAPH_COLORS.nodeDefault
  }

  function focusNode(nodeId: string) {
    setSelectedNodeId(nodeId)
  }

  function hoverNode(nodeId: string | null) {
    setHoveredNodeId(nodeId)
    if (nodeId) setSelectedNodeId(nodeId)
  }

  async function queryNeighborsByVector(
    vector: number[],
    filter?: Record<string, unknown> | null,
  ): Promise<ScoredPoint[]> {
    const body: Record<string, unknown> = {
      query: vector,
      limit: NEIGHBORS,
      with_payload: false,
      with_vector: false,
    }
    if (usingName) body.using = usingName
    const activeFilter = resolveQueryFilter(filter, qdrantFilter)
    if (activeFilter) body.filter = activeFilter
    const res = await qdrant.queryPoints(name, body)
    return res.points.slice(0, NEIGHBORS)
  }

  async function queryNeighbors(
    pointId: string | number,
    filter?: Record<string, unknown> | null,
  ): Promise<ScoredPoint[]> {
    const body: Record<string, unknown> = {
      query: pointId,
      limit: NEIGHBORS + 1,
      with_payload: false,
      with_vector: false,
    }
    if (usingName) body.using = usingName
    const activeFilter = resolveQueryFilter(filter, qdrantFilter)
    if (activeFilter) body.filter = activeFilter
    const res = await qdrant.queryPoints(name, body)
    return res.points.filter((p) => String(p.id) !== String(pointId)).slice(0, NEIGHBORS)
  }

  useEffect(() => {
    if (!navSeed && !navSeedVector?.length) return
    if (skipNavFilterSyncRef.current) {
      skipNavFilterSyncRef.current = false
      return
    }

    const incoming = navState?.filters ?? []
    setDraftFilters(incoming)
    setAppliedFilters(incoming)

    const filter = incoming.length
      ? (filtersToQdrantFilter(incoming, payloadSchema) as Record<string, unknown>)
      : null
    if (navSeedVector?.length) {
      const rawPreview = navState?.previewUrl ?? null
      if (rawPreview) {
        void persistImagePreviewUrl(rawPreview)
          .then(setQueryPreview)
          .catch(() => setQueryPreview(rawPreview))
      } else {
        setQueryPreview(null)
      }
      void startFromVector(navSeedVector, filter)
    } else if (navSeed) {
      setQueryPreview(null)
      void startFromPoint(navSeed, filter)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navSeed, navSeedVector, navFiltersKey])

  async function startFromVector(
    vector: number[],
    filter?: Record<string, unknown> | null,
  ) {
    setLoading(true)
    graphSeedRef.current = { kind: 'vector', vector }
    try {
      const neighbors = await queryNeighborsByVector(vector, filter)
      const seedId = IMAGE_QUERY_SEED_ID
      const seedNode: GNode = { id: seedId, seed: true, expanded: true }
      const nMap = new Map<string, GNode>([[seedId, seedNode]])
      const lArr: GLink[] = []
      for (const nb of neighbors) {
        const id = String(nb.id)
        nMap.set(id, { id })
        lArr.push({ source: seedId, target: id, score: nb.score })
      }
      setNodes(Array.from(nMap.values()))
      setLinks(lArr)
      focusNode(seedId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成图谱失败')
    } finally {
      setLoading(false)
    }
  }

  async function startFromPoint(seedId: string, filter?: Record<string, unknown> | null) {
    setLoading(true)
    setQueryPreview(null)
    graphSeedRef.current = { kind: 'point', id: seedId }
    try {
      await qdrant.getPoint(name, /^\d+$/.test(seedId) ? Number(seedId) : seedId)
      const neighbors = await queryNeighbors(/^\d+$/.test(seedId) ? Number(seedId) : seedId, filter)
      const seedNode: GNode = { id: seedId, seed: true, expanded: true }
      const nMap = new Map<string, GNode>([[seedId, seedNode]])
      const lArr: GLink[] = []
      for (const nb of neighbors) {
        const id = String(nb.id)
        nMap.set(id, { id })
        lArr.push({ source: seedId, target: id, score: nb.score })
      }
      setNodes(Array.from(nMap.values()))
      setLinks(lArr)
      focusNode(seedId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成图谱失败')
    } finally {
      setLoading(false)
    }
  }

  async function expand(node: GNode) {
    if (node.id === IMAGE_QUERY_SEED_ID || node.expanded || nodes.length >= MAX_NODES) return
    try {
      const neighbors = await queryNeighbors(/^\d+$/.test(node.id) ? Number(node.id) : node.id)
      if (neighbors.length === 0) {
        toast.info('当前筛选下没有更多近邻')
        return
      }
      setNodes((prev) => {
        const map = new Map(prev.map((n) => [n.id, n]))
        const self = map.get(node.id)
        if (self) self.expanded = true
        for (const nb of neighbors) {
          const id = String(nb.id)
          if (!map.has(id) && map.size < MAX_NODES) {
            map.set(id, { id })
          }
        }
        return Array.from(map.values())
      })
      setLinks((prev) => {
        const seen = new Set(prev.map((l) => `${l.source}>${l.target}`))
        const next = [...prev]
        for (const nb of neighbors) {
          const key = `${node.id}>${String(nb.id)}`
          if (!seen.has(key)) {
            seen.add(key)
            next.push({ source: node.id, target: String(nb.id), score: nb.score })
          }
        }
        return next
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '展开失败')
    }
  }

  async function applyGraphFilter() {
    const nextFilter = draftFilters.length
      ? (filtersToQdrantFilter(draftFilters, payloadSchema) as Record<string, unknown>)
      : null
    setAppliedFilters(draftFilters)
    const seed = graphSeedRef.current
    if (!seed) return
    if (seed.kind === 'point') await startFromPoint(seed.id, nextFilter)
    else await startFromVector(seed.vector, nextFilter)
  }

  async function clearGraphFilter() {
    setDraftFilters([])
    setAppliedFilters([])

    if (navState?.filters?.length) {
      skipNavFilterSyncRef.current = true
      navigate(location.pathname, {
        replace: true,
        state: { ...navState, filters: [] },
      })
    }

    const seed = graphSeedRef.current
    if (!seed) return
    if (seed.kind === 'point') await startFromPoint(seed.id, null)
    else await startFromVector(seed.vector, null)
  }

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])
  const linkScoreStyle = useMemo(
    () => createLinkScoreStyle(links.map((l) => l.score)),
    [links],
  )
  const hasGraph = nodes.length > 0

  return (
    <div ref={shellRef} className="h-full w-full min-h-0" style={{ height: canvasHeight }}>
      <Group
        id={`graph-layout-v2-${name}`}
        orientation="horizontal"
        className="h-full w-full"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel id="graph-canvas" defaultSize="62" minSize="35" className="min-h-0 min-w-0">
          <div ref={graphWrapRef} className="relative h-full min-h-0 bg-white">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/75">
                <Loading label="正在生成图谱…" />
              </div>
            )}

            {hasGraph && (
              <GraphFilterBar
                collectionName={name}
                payloadSchema={payloadSchema}
                draftFilters={draftFilters}
                appliedFilters={appliedFilters}
                dirty={filterDirty}
                applying={loading}
                onDraftFiltersChange={setDraftFilters}
                onApply={() => void applyGraphFilter()}
                onClear={() => void clearGraphFilter()}
              />
            )}

            {hasGraph && (
              <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md bg-white/90 px-3 py-2 text-[11px] text-muted shadow-sm">
                <div className="mb-1.5 font-medium text-ink">相似度</div>
                <div className="flex items-center gap-3">
                  {LINK_STYLE_LEGEND.map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block rounded-full"
                        style={{ width: 20, height: item.width, backgroundColor: LINK_COLOR }}
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-muted-soft">相对当前图谱；悬停查看分数</p>
              </div>
            )}

            {hasGraph ? (
              <ForceGraph2D
                width={graphSize.width}
                height={graphSize.height}
                graphData={graphData}
                backgroundColor="#ffffff"
                cooldownTicks={80}
                linkColor={() => LINK_COLOR}
                linkWidth={(l: object) => linkScoreStyle((l as GLink).score).width}
                linkDirectionalArrowLength={(l: object) =>
                  linkScoreStyle((l as GLink).score).arrowLength
                }
                linkLabel={(l: object) => {
                  const score = (l as GLink).score
                  return typeof score === 'number' ? score.toFixed(4) : ''
                }}
                nodeRelSize={NODE_R}
                onNodeClick={(n: object) => expand(n as GNode)}
                onNodeHover={(node: object | null) => {
                  hoverNode(node ? (node as GNode).id : null)
                  if (graphWrapRef.current) {
                    graphWrapRef.current.style.cursor = node ? 'pointer' : 'default'
                  }
                }}
                nodeCanvasObject={(node: object, ctx: CanvasRenderingContext2D) => {
                  const n = node as GNode & { x: number; y: number }

                  if (n.id === hoveredNodeId) {
                    ctx.beginPath()
                    ctx.arc(n.x, n.y, NODE_R * 1.4, 0, 2 * Math.PI)
                    ctx.fillStyle = GRAPH_COLORS.nodeHighlightRing
                    ctx.fill()
                  }

                  ctx.beginPath()
                  ctx.arc(n.x, n.y, NODE_R, 0, 2 * Math.PI)
                  ctx.fillStyle = nodeFill(n)
                  ctx.fill()
                }}
              />
            ) : (
              !loading && <GraphCanvasEmpty />
            )}
          </div>
        </Panel>

        <GraphPanelSeparator />

        <Panel
          id="graph-point-panel"
          defaultSize="38"
          minSize={320}
          maxSize="55"
          className="min-h-0 min-w-0 bg-[var(--color-surface-2)]"
        >
          <GraphPointPanel
            collectionName={name}
            activeNodeId={selectedNodeId}
            point={previewPoint}
            loading={previewLoading}
            queryPreview={queryPreview}
            hasGraph={hasGraph}
          />
        </Panel>
      </Group>
    </div>
  )
}
