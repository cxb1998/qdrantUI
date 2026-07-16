import type { ScalarMapping } from './ingestMapping'

export interface IngestTemplate {
  id: string
  name: string
  collectionName: string
  mappings: ScalarMapping[]
  updatedAt: number
}

const STORAGE_KEY = 'ingest-templates-v1'

function loadAll(): IngestTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as IngestTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAll(templates: IngestTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function listIngestTemplates(collectionName: string): IngestTemplate[] {
  return loadAll()
    .filter((t) => t.collectionName === collectionName)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function saveIngestTemplate(
  collectionName: string,
  name: string,
  mappings: ScalarMapping[],
  existingId?: string,
): IngestTemplate {
  const all = loadAll()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('请输入模板名称')

  const template: IngestTemplate = {
    id: existingId ?? crypto.randomUUID(),
    name: trimmed,
    collectionName,
    mappings: mappings.map((m) => ({ ...m })),
    updatedAt: Date.now(),
  }

  const idx = all.findIndex((t) => t.id === template.id)
  if (idx >= 0) all[idx] = template
  else all.push(template)

  saveAll(all)
  return template
}

export function deleteIngestTemplate(id: string) {
  saveAll(loadAll().filter((t) => t.id !== id))
}
