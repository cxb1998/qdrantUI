import { coercePayloadValueBySchema, findPayloadTypeMismatches, type PayloadTypeMismatch } from './pointsFilter'

export type { PayloadTypeMismatch }

export interface IngestTypeMismatchIssue extends PayloadTypeMismatch {
  affectedCount: number
}

export function collectIngestTypeMismatchIssues(
  files: File[],
  mappings: ScalarMapping[],
  payloadSchema: Record<string, unknown>,
  overridesForFile?: (file: File) => Record<string, string> | undefined,
): IngestTypeMismatchIssue[] {
  const byKey = new Map<string, IngestTypeMismatchIssue>()
  for (const file of files) {
    const ctx = ingestFileContext(file)
    const overrides = overridesForFile?.(file)
    const payload = buildPayloadFromMappings(mappings, ctx, overrides, payloadSchema)
    for (const issue of findPayloadTypeMismatches(payload, payloadSchema)) {
      const existing = byKey.get(issue.key)
      if (existing) {
        existing.affectedCount += 1
      } else {
        byKey.set(issue.key, { ...issue, affectedCount: 1 })
      }
    }
  }
  return [...byKey.values()]
}

export type ScalarSourceKind =
  | 'filename'
  | 'path_level'
  | 'constant'
  | 'url_template'

export interface ScalarMapping {
  key: string
  source: ScalarSourceKind
  /** path_level 时使用，从 1 开始 */
  level?: number
  constant?: string
  template?: string
}

export const SCALAR_SOURCE_OPTIONS: { value: ScalarSourceKind; label: string; hint?: string }[] = [
  { value: 'filename', label: '文件名' },
  { value: 'path_level', label: '路径第 N 级目录', hint: '从所选文件夹根目录算起，不含文件名' },
  { value: 'constant', label: '固定值' },
  {
    value: 'url_template',
    label: 'URL 拼接',
    hint: '填写 http(s) 起至所选上传目录为止的地址，自动拼接相对路径',
  },
]

/** 入库 URL 映射固定后缀（仅用于迁移旧模板） */
const URL_TEMPLATE_RELATIVE_SUFFIX = '/{relative_path}'

/** 从存储值或粘贴内容中解析 URL 前缀（仅去掉固定的 /{relative_path} 后缀） */
export function parseUrlTemplateBase(template?: string): string {
  const raw = (template ?? '').trim()
  if (!raw || raw === '{relative_path}') return ''
  if (raw.endsWith(URL_TEMPLATE_RELATIVE_SUFFIX)) {
    return raw.slice(0, -URL_TEMPLATE_RELATIVE_SUFFIX.length)
  }
  if (raw.endsWith('{relative_path}')) {
    return raw.slice(0, -'{relative_path}'.length)
  }
  return raw
}

export function buildImageUrlFromBase(base: string, relativePath: string): string {
  const rel = relativePath.replace(/^[/\\]+/, '').trim()
  const prefix = (base ?? '').trim()
  if (!rel) return prefix
  if (!prefix) return rel
  const left = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  return `${left}/${rel}`
}

export function normalizeIngestMappings(mappings: ScalarMapping[]): ScalarMapping[] {
  return mappings.map((m) => {
    const source = m.source as string
    if (source === 'parent_dir') {
      return { ...m, source: 'path_level', level: m.level ?? 1 }
    }
    if (source === 'relative_path') {
      return { ...m, source: 'url_template', template: '' }
    }
    if (source === 'filename_stem') {
      return { ...m, source: 'filename' }
    }
    if (m.source === 'url_template') {
      return { ...m, template: parseUrlTemplateBase(m.template) }
    }
    return m
  })
}

export function generateIngestPointId(): string {
  return crypto.randomUUID()
}

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif)$/i

export function isIngestImageFile(file: File): boolean {
  return IMAGE_TYPES.test(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)
}

export function getRelativePath(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath?.trim()
  return rel || file.name
}

export function pathParts(relativePath: string): string[] {
  return relativePath.split(/[/\\]/).filter(Boolean)
}

export function basename(relativePath: string): string {
  const parts = pathParts(relativePath)
  return parts[parts.length - 1] ?? relativePath
}

export function pathDirLevel(relativePath: string, level: number): string {
  const parts = pathParts(relativePath)
  const dirs = parts.length > 1 ? parts.slice(0, -1) : []
  return dirs[level - 1] ?? ''
}

export interface IngestFileContext {
  file: File
  relativePath: string
}

export function ingestFileContext(file: File): IngestFileContext {
  return { file, relativePath: getRelativePath(file) }
}

export function resolveScalarValue(mapping: ScalarMapping, ctx: IngestFileContext): string {
  const rel = ctx.relativePath
  switch (mapping.source) {
    case 'filename':
      return basename(rel)
    case 'path_level':
      return pathDirLevel(rel, mapping.level ?? 1)
    case 'constant':
      return mapping.constant ?? ''
    case 'url_template':
      return buildImageUrlFromBase(mapping.template ?? '', ctx.relativePath)
    default:
      return ''
  }
}

export function buildPayloadFromMappings(
  mappings: ScalarMapping[],
  ctx: IngestFileContext,
  overrides?: Record<string, string>,
  payloadSchema: Record<string, unknown> = {},
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  function setField(key: string, raw: unknown) {
    const coerced = coercePayloadValueBySchema(key, raw, payloadSchema)
    if (coerced === '' || coerced === null || coerced === undefined) return
    payload[key] = coerced
  }

  for (const mapping of mappings) {
    const key = mapping.key.trim()
    if (!key) continue
    if (overrides && key in overrides) {
      setField(key, overrides[key])
      continue
    }
    const value = resolveScalarValue(mapping, ctx)
    if (value !== '') setField(key, value)
  }
  for (const [key, raw] of Object.entries(overrides ?? {})) {
    const trimmedKey = key.trim()
    if (!trimmedKey || trimmedKey in payload) continue
    setField(trimmedKey, raw)
  }
  return payload
}

/** 合并映射标量与向量服务 payload；同名字段以向量服务为准 */
export function mergeIngestPayload(
  localPayload: Record<string, unknown>,
  embedPayload: Record<string, unknown> | undefined,
  payloadSchema: Record<string, unknown> = {},
): Record<string, unknown> {
  const merged = { ...localPayload }
  if (!embedPayload) return merged

  for (const [key, raw] of Object.entries(embedPayload)) {
    const coerced = coercePayloadValueBySchema(key, raw, payloadSchema)
    if (coerced === '' || coerced === null || coerced === undefined) continue
    merged[key] = coerced
  }
  return merged
}

export function defaultMappingsForSchema(schemaKeys: string[]): ScalarMapping[] {
  const mappings: ScalarMapping[] = []
  if (schemaKeys.includes('file_name')) {
    mappings.push({ key: 'file_name', source: 'filename' })
  }
  if (schemaKeys.includes('image_url')) {
    mappings.push({ key: 'image_url', source: 'url_template', template: '' })
  }
  if (mappings.length === 0 && schemaKeys.length > 0) {
    mappings.push({ key: schemaKeys[0], source: 'filename' })
  }
  if (mappings.length === 0) {
    return [{ key: '', source: 'filename' }]
  }
  return mappings
}

export function filterImageFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter(isIngestImageFile)
}
