import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CollectionInfo, PointStruct } from '../../lib/qdrant'
import { primaryVectorParams, qdrant } from '../../lib/qdrant'
import type { PayloadFilterCondition } from '../../lib/pointsFilter'
import { Button } from '../ui/Button'
import { Tag } from '../ui/primitives'
import { useToast } from '../ui/Toast'
import { IconGraph, IconSearch } from '../ui/icons'

function extractVector(vector: NonNullable<PointStruct['vector']>, key: string): number[] | null {
  if (Array.isArray(vector)) return key === '' ? vector : null
  const named = vector as Record<string, number[]>
  return key === '' ? named[''] ?? null : named[key] ?? null
}

export function PointVectors({
  point,
  info,
  onFindSimilar,
  graphFilters,
}: {
  point: PointStruct
  info: CollectionInfo
  onFindSimilar?: (id: string | number, vectorName?: string | null) => void
  graphFilters?: PayloadFilterCondition[]
}) {
  const navigate = useNavigate()
  const { name = '' } = useParams()
  const toast = useToast()
  const [copyingKey, setCopyingKey] = useState<string | null>(null)

  const vectorRows = useMemo(() => {
    const params = primaryVectorParams(info.config)
    if (point.vector != null) {
      const normalized = Array.isArray(point.vector)
        ? { '': point.vector }
        : (point.vector as Record<string, number[]>)
      return Object.entries(normalized).map(([key, vec]) => ({
        key,
        length: vec.length,
      }))
    }
    if (params.named.length > 0) {
      const vectors = info.config.params.vectors as Record<string, { size: number }>
      return params.named.map((key) => ({ key, length: vectors[key]?.size ?? params.size ?? 0 }))
    }
    if (params.size != null) {
      return [{ key: '', length: params.size }]
    }
    return []
  }, [point.vector, info.config])

  if (vectorRows.length === 0) return null

  async function copyVector(key: string) {
    setCopyingKey(key)
    try {
      let vec: number[] | null =
        point.vector != null ? extractVector(point.vector, key) : null
      if (!vec) {
        const fetched = await qdrant.getPoint(name, point.id)
        if (fetched.vector == null) {
          toast.error('无法读取向量')
          return
        }
        vec = extractVector(fetched.vector, key)
      }
      if (!vec) {
        toast.error('未找到该向量')
        return
      }
      await navigator.clipboard.writeText(JSON.stringify(vec))
      toast.success('向量已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    } finally {
      setCopyingKey(null)
    }
  }

  function openGraph(vectorName: string) {
    navigate(`/collections/${encodeURIComponent(name)}/graph`, {
      state: {
        seedId: String(point.id),
        vectorName: vectorName === '' ? null : vectorName,
        filters: graphFilters ?? [],
      },
    })
  }

  return (
    <div className="space-y-3">
      <span className="text-[13px] font-semibold text-ink">向量：</span>
      {vectorRows.map(({ key, length }) => (
        <div
          key={key || '__default'}
          className="grid grid-cols-1 items-center gap-y-2 md:grid-cols-12 md:gap-x-4"
        >
          <div className="flex items-center gap-2 md:col-span-4">
            <span className="shrink-0 text-[12.5px] text-muted">类型</span>
            <Tag tone={key === '' ? 'neutral' : 'indigo'}>{key === '' ? '默认向量' : key}</Tag>
          </div>
          <div className="flex items-center gap-2 md:col-span-4 md:my-1">
            <span className="shrink-0 text-[12.5px] text-muted">长度</span>
            <Tag tone="neutral">{length}</Tag>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:col-span-4 md:justify-end">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copyVector(key)}
              loading={copyingKey === key}
            >
              复制向量
            </Button>
            <Button size="sm" variant="secondary" icon={<IconGraph />} onClick={() => openGraph(key)}>
              打开图谱
            </Button>
            {onFindSimilar && (
              <Button
                size="sm"
                variant="secondary"
                icon={<IconSearch />}
                onClick={() => onFindSimilar(point.id, key === '' ? null : key)}
              >
                查找相似
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
