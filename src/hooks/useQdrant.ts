import {
  useMutation,
  useQuery,
  useQueryClient,
  useQueries,
} from '@tanstack/react-query'
import { qdrant, type CollectionInfo, type OptimizationsResponse } from '../lib/qdrant'
import { hasActiveOptimization } from '../lib/optimizations'

export const qk = {
  health: ['health'] as const,
  collections: ['collections'] as const,
  collection: (name: string) => ['collection', name] as const,
  optimizations: (name: string) => ['optimizations', name] as const,
  cluster: (name: string) => ['cluster', name] as const,
  snapshots: (name: string) => ['snapshots', name] as const,
  collectionMemory: (name: string) => ['collection-memory', name] as const,
  processMemory: ['process-memory'] as const,
  telemetry: ['telemetry'] as const,
}

export interface CollectionRow {
  name: string
  info?: CollectionInfo
  error?: string
}

/** 列表 + 每个集合的详情（并行拉取） */
export function useCollectionRows() {
  const listQuery = useQuery({
    queryKey: qk.collections,
    queryFn: ({ signal }) => qdrant.listCollections(signal),
    refetchInterval: 15_000,
  })

  const names = (listQuery.data?.collections ?? []).map((c) => c.name).sort()

  const detailQueries = useQueries({
    queries: names.map((name) => ({
      queryKey: qk.collection(name),
      queryFn: ({ signal }: { signal: AbortSignal }) => qdrant.getCollection(name, signal),
    })),
  })

  const rows: CollectionRow[] = names.map((name, i) => ({
    name,
    info: detailQueries[i]?.data,
    error: detailQueries[i]?.error instanceof Error ? detailQueries[i].error!.message : undefined,
  }))

  async function refetchAll() {
    await listQuery.refetch()
    await Promise.all(detailQueries.map((q) => q.refetch()))
  }

  return {
    rows,
    names,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching || detailQueries.some((q) => q.isFetching),
    error: listQuery.error as Error | null,
    refetch: listQuery.refetch,
    refetchAll,
  }
}

export function useCollection(name: string, refetchInterval?: number) {
  return useQuery({
    queryKey: qk.collection(name),
    queryFn: ({ signal }) => qdrant.getCollection(name, signal),
    refetchInterval,
    enabled: !!name,
  })
}

export function useOptimizations(name: string, info?: CollectionInfo) {
  return useQuery({
    queryKey: qk.optimizations(name),
    queryFn: ({ signal }) => qdrant.getOptimizations(name, signal),
    enabled: !!name,
    refetchInterval: (query) => {
      const data = query.state.data as OptimizationsResponse | undefined
      if ((data?.running?.length ?? 0) > 0) return 1000
      if (info?.status === 'yellow') return 2000
      if (hasActiveOptimization(data, info?.status ?? 'green')) return 2000
      return 15_000
    },
    retry: (count, error) => {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
        return false
      }
      return count < 2
    },
  })
}

export function useCluster(name: string) {
  return useQuery({
    queryKey: qk.cluster(name),
    queryFn: ({ signal }) => qdrant.getCluster(name, signal),
    enabled: !!name,
  })
}

export function useSnapshots(name: string) {
  return useQuery({
    queryKey: qk.snapshots(name),
    queryFn: ({ signal }) => qdrant.listSnapshots(name, signal),
    enabled: !!name,
  })
}

export function useCollectionMemory(name: string) {
  return useQuery({
    queryKey: qk.collectionMemory(name),
    queryFn: ({ signal }) => qdrant.getCollectionMemory(name, signal),
    enabled: !!name,
    refetchInterval: 20_000,
    retry: (count, error) => {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
        return false
      }
      return count < 2
    },
  })
}

export function useProcessMemoryMetrics() {
  return useQuery({
    queryKey: qk.processMemory,
    queryFn: ({ signal }) => qdrant.getProcessMemoryMetrics(signal),
    refetchInterval: 20_000,
  })
}

export function useTelemetry(enabled = true) {
  return useQuery({
    queryKey: qk.telemetry,
    queryFn: ({ signal }) => qdrant.telemetry(3, signal),
    enabled,
    refetchInterval: 20_000,
  })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, body }: { name: string; body: Record<string, unknown> }) =>
      qdrant.createCollection(name, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collections }),
  })
}

export function useDeleteCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => qdrant.deleteCollection(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collections }),
  })
}

export function useUpdateCollection(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => qdrant.updateCollection(name, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.collection(name) })
      qc.invalidateQueries({ queryKey: qk.optimizations(name) })
    },
  })
}

export function useTriggerOptimizers(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => qdrant.triggerOptimizers(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.collection(name) })
      qc.invalidateQueries({ queryKey: qk.optimizations(name) })
    },
  })
}

export function useUploadSnapshot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) =>
      qdrant.uploadSnapshot(name, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.collections }),
  })
}

export function useCreateSnapshot(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => qdrant.createSnapshot(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.snapshots(name) }),
  })
}

export function useDeleteSnapshot(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (snapshot: string) => qdrant.deleteSnapshot(name, snapshot),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.snapshots(name) }),
  })
}

export function useCreatePayloadIndex(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ field, schema }: { field: string; schema: string }) =>
      qdrant.createPayloadIndex(name, field, schema),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.collection(name) })
      qc.invalidateQueries({ queryKey: qk.optimizations(name) })
    },
  })
}

export function useDeletePayloadIndex(name: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (field: string) => qdrant.deletePayloadIndex(name, field),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.collection(name) })
      qc.invalidateQueries({ queryKey: qk.optimizations(name) })
    },
  })
}
