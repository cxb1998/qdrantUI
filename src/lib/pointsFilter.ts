/** payload 过滤解析；支持精确匹配与数值范围（>, >=, <, <=） */

export type RangeCompareOp = 'gt' | 'gte' | 'lt' | 'lte'

export interface PayloadFilterCondition {
  key: string
  value: string | number | boolean | null
  isIdFilter?: boolean
  /** 数值范围比较；与 value 组合为 Qdrant range 条件 */
  rangeOp?: RangeCompareOp
}

const RANGE_OP_SYMBOL: Record<RangeCompareOp, string> = {
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
}

const RANGE_OP_BY_SYMBOL: Record<string, RangeCompareOp> = {
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
}

const NUMERIC_RANGE_TYPES = new Set(['integer', 'int', 'float', 'datetime'])

type PayloadSchema = Record<string, { data_type?: string } | unknown>

function normalizeValueBySchema(valueString: string, key: string, payloadSchema: PayloadSchema) {
  const schemaEntry = payloadSchema[key] as { data_type?: string } | undefined
  if (!schemaEntry) return valueString

  const dataType = schemaEntry.data_type
  const lowered = valueString.toLowerCase()

  if (dataType === 'bool' && (lowered === 'true' || lowered === 'false')) {
    return lowered === 'true'
  }
  if ((dataType === 'integer' || dataType === 'int') && valueString !== '') {
    const n = Number(valueString)
    return Number.isNaN(n) ? valueString : n
  }
  if (dataType === 'float' && valueString !== '') {
    const n = parseFloat(valueString)
    return Number.isNaN(n) ? valueString : n
  }
  return valueString
}

/** 入库写入前：schema 中有定义的字段按 data_type 转换，否则保持字符串 */
export function coercePayloadValueBySchema(
  key: string,
  raw: unknown,
  payloadSchema: PayloadSchema = {},
): unknown {
  if (raw === null || raw === undefined) return raw
  if (typeof raw === 'boolean' || typeof raw === 'number') return raw
  const text = String(raw)
  if (text === 'null') return null
  if (text === '(empty)') return ''
  const trimmed = text.trim()
  if (trimmed === '') return ''
  if (!payloadSchema[key]) return text
  return normalizeValueBySchema(trimmed, key, payloadSchema)
}

const SCHEMA_TYPE_LABELS: Record<string, string> = {
  integer: '整数',
  int: '整数',
  float: '浮点数',
  bool: '布尔',
  keyword: 'keyword',
  text: 'text',
  uuid: 'uuid',
  datetime: 'datetime',
}

export function schemaDataTypeLabel(dataType: string): string {
  return SCHEMA_TYPE_LABELS[dataType] ?? dataType
}

export function actualPayloadValueTypeLabel(value: unknown): string {
  if (typeof value === 'boolean') return '布尔'
  if (typeof value === 'number') return Number.isInteger(value) ? '整数' : '浮点数'
  if (value === null) return 'null'
  return '文本'
}

function formatMismatchSample(value: unknown): string {
  const text = value === null ? 'null' : String(value)
  return text.length > 48 ? `${text.slice(0, 45)}…` : text
}

/** 判断 payload 值是否符合 schema 声明的 data_type */
export function valueMatchesPayloadSchemaType(value: unknown, dataType: string | undefined): boolean {
  if (!dataType) return true
  switch (dataType) {
    case 'bool':
      return typeof value === 'boolean'
    case 'integer':
    case 'int':
      return typeof value === 'number' && Number.isInteger(value)
    case 'float':
      return typeof value === 'number' && Number.isFinite(value)
    case 'keyword':
    case 'text':
    case 'uuid':
    case 'datetime':
      return typeof value === 'string'
    default:
      return true
  }
}

export interface PayloadTypeMismatch {
  key: string
  expectedType: string
  actualType: string
  sampleValue: string
}

/** 检测 payload 中与 payload_schema 类型不一致的字段 */
export function findPayloadTypeMismatches(
  payload: Record<string, unknown>,
  payloadSchema: PayloadSchema = {},
): PayloadTypeMismatch[] {
  const issues: PayloadTypeMismatch[] = []
  for (const [key, value] of Object.entries(payload)) {
    const dataType = (payloadSchema[key] as { data_type?: string } | undefined)?.data_type
    if (!dataType || valueMatchesPayloadSchemaType(value, dataType)) continue
    issues.push({
      key,
      expectedType: schemaDataTypeLabel(dataType),
      actualType: actualPayloadValueTypeLabel(value),
      sampleValue: formatMismatchSample(value),
    })
  }
  return issues
}

function parseNumericForRange(numStr: string, dataType: string | undefined): number | null {
  const n = dataType === 'float' ? parseFloat(numStr) : Number(numStr)
  if (!Number.isFinite(n)) return null
  if ((dataType === 'integer' || dataType === 'int') && !Number.isInteger(n)) return null
  return n
}

function tryParseRangeCondition(
  key: string,
  rawValue: string,
  payloadSchema: PayloadSchema,
): PayloadFilterCondition | null {
  const match = rawValue.match(/^(>=|<=|>|<)(-?\d+(?:\.\d+)?)$/)
  if (!match) return null

  const rangeOp = RANGE_OP_BY_SYMBOL[match[1]]
  const numStr = match[2]
  const dataType = (payloadSchema[key] as { data_type?: string } | undefined)?.data_type

  if (dataType && !NUMERIC_RANGE_TYPES.has(dataType)) return null

  const num = parseNumericForRange(numStr, dataType)
  if (num === null) return null

  return { key, value: num, rangeOp }
}

function filterConditionIdentity(condition: PayloadFilterCondition): string {
  return `${condition.isIdFilter ? 'id' : condition.key}:${condition.rangeOp ?? 'eq'}:${condition.value}`
}

function parseIdValue(rawValue: string): string | number {
  const numericValue = Number(rawValue)
  if (!Number.isNaN(numericValue) && Number.isInteger(numericValue)) return numericValue
  return rawValue
}

export function normalizeFilterInput(filterText: string): string {
  return filterText.replace(/:\s+/g, ':')
}

function readableFilterValue(value: PayloadFilterCondition['value']): string {
  if (value === null) return 'null'
  if (value === '') return '(empty)'
  return String(value)
}

/** 单条筛选条件的可读标签（用于 Tag / 摘要展示） */
export function formatFilterConditionLabel(condition: PayloadFilterCondition): string {
  if (condition.isIdFilter) return `id: ${condition.value}`
  if (condition.rangeOp) {
    return `${condition.key}: ${RANGE_OP_SYMBOL[condition.rangeOp]} ${condition.value}`
  }
  return `${condition.key}: ${readableFilterValue(condition.value)}`
}

/** 将已应用的条件还原为过滤框文本 */
export function buildFilterInputFromConditions(conditions: PayloadFilterCondition[]): string {
  return conditions
    .map((condition) => {
      if (condition.isIdFilter) return `id:${condition.value}`
      if (condition.rangeOp) {
        return `${condition.key}:${RANGE_OP_SYMBOL[condition.rangeOp]}${condition.value}`
      }
      return `${condition.key}:${readableFilterValue(condition.value)}`
    })
    .join(' ')
}

/** 光标处正在输入的词（到上一个空白为止） */
export function getCurrentWord(text: string, cursorPos: number): string {
  const beforeCursor = text.slice(0, cursorPos)
  const match = beforeCursor.match(/(\S+)$/)
  return match ? match[1] : ''
}

/** 当前词在文本中的起始位置 */
export function getCurrentWordStart(text: string, cursorPos: number): number {
  const beforeCursor = text.slice(0, cursorPos)
  const wordMatch = beforeCursor.match(/(\S*)$/)
  return wordMatch ? cursorPos - wordMatch[1].length : cursorPos
}

/** 自动补全浮层相对输入框左侧的水平偏移（px） */
export function calculateFilterAutocompleteOffset(text: string, wordStart: number): number {
  const textBeforeWord = text.slice(0, wordStart)
  if (typeof document === 'undefined') return 32

  let canvas = (calculateFilterAutocompleteOffset as { _canvas?: HTMLCanvasElement })._canvas
  if (!canvas) {
    canvas = document.createElement('canvas')
    ;(calculateFilterAutocompleteOffset as { _canvas?: HTMLCanvasElement })._canvas = canvas
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return 32
  ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  return ctx.measureText(textBeforeWord).width + 32
}

export function parseFilterString(
  filterText: string,
  payloadSchema: PayloadSchema = {},
): PayloadFilterCondition[] {
  const tokens = filterText.match(/\S+/g) || []
  const parsed: PayloadFilterCondition[] = []

  for (const token of tokens) {
    const colonIndex = token.indexOf(':')
    if (colonIndex === -1) continue

    const key = token.slice(0, colonIndex).trim()
    const rawValue = token.slice(colonIndex + 1).trim()
    if (!key || !rawValue) continue

    if (key.toLowerCase() === 'id') {
      parsed.push({ key: 'id', value: parseIdValue(rawValue), isIdFilter: true })
      continue
    }

    const rangeCondition = tryParseRangeCondition(key, rawValue, payloadSchema)
    if (rangeCondition) {
      parsed.push(rangeCondition)
      continue
    }

    let value: string | number | boolean | null
    if (rawValue.toLowerCase() === 'null') value = null
    else if (rawValue === '(empty)') value = ''
    else value = normalizeValueBySchema(rawValue, key, payloadSchema)

    parsed.push({ key, value })
  }

  return parsed
}

export function uniqFilters(list: PayloadFilterCondition[]): PayloadFilterCondition[] {
  return list.filter(
    (item, index) =>
      list.findIndex((c) => filterConditionIdentity(c) === filterConditionIdentity(item)) ===
      index,
  )
}

/** 将解析后的条件转为 Qdrant scroll/query 用的 filter */
export function filtersToQdrantFilter(
  filters: PayloadFilterCondition[],
  payloadSchema: PayloadSchema = {},
): unknown | undefined {
  if (!filters.length) return undefined

  const idFilters = filters.filter((f) => f.isIdFilter)
  const payloadFilters = filters.filter((f) => !f.isIdFilter)

  const rangeByKey = new Map<string, Partial<Record<RangeCompareOp, number>>>()
  const conditions: unknown[] = []

  for (const filter of payloadFilters) {
    if (filter.rangeOp) {
      const bounds = rangeByKey.get(filter.key) ?? {}
      bounds[filter.rangeOp] = filter.value as number
      rangeByKey.set(filter.key, bounds)
      continue
    }

    if (filter.value === null || filter.value === undefined) {
      conditions.push({ is_null: { key: filter.key } })
      continue
    }
    if (filter.value === '') {
      conditions.push({ is_empty: { key: filter.key } })
      continue
    }
    const entry = payloadSchema[filter.key] as { data_type?: string } | undefined
    if (entry?.data_type === 'text') {
      conditions.push({ key: filter.key, match: { text: filter.value } })
      continue
    }
    conditions.push({ key: filter.key, match: { value: filter.value } })
  }

  for (const [key, bounds] of rangeByKey) {
    const range: Record<string, number> = {}
    if (bounds.gt !== undefined) range.gt = bounds.gt
    if (bounds.gte !== undefined) range.gte = bounds.gte
    if (bounds.lt !== undefined) range.lt = bounds.lt
    if (bounds.lte !== undefined) range.lte = bounds.lte
    if (Object.keys(range).length > 0) {
      conditions.push({ key, range })
    }
  }

  if (idFilters.length > 0) {
    conditions.push({ has_id: idFilters.map((f) => f.value) })
  }

  return { must: conditions }
}

/** order_by 分页：排除已返回的点 ID（与 Qdrant 官方推荐一致） */
export function mergeFilterWithExcludedIds(
  filter: unknown | undefined,
  excludedIds: (string | number)[],
): unknown | undefined {
  if (excludedIds.length === 0) return filter

  const exclude = { has_id: excludedIds }
  if (!filter) return { must_not: [exclude] }

  const f = filter as { must?: unknown[]; must_not?: unknown[]; should?: unknown[] }
  return {
    ...f,
    must_not: [...(f.must_not ?? []), exclude],
  }
}

type PayloadSchemaEntry = {
  data_type?: string
  params?: { range?: boolean }
}

/** Qdrant order_by 需要支持 Range 的 payload 索引（见官方文档） */
export function payloadIndexSupportsOrderBy(entry: unknown): boolean {
  const meta = entry as PayloadSchemaEntry | undefined
  const dt = meta?.data_type
  if (!dt) return false
  if (dt !== 'integer' && dt !== 'int' && dt !== 'float' && dt !== 'datetime') return false
  if (meta?.params?.range === false) return false
  return true
}

/** Qdrant scroll order_by 支持的 payload 字段（需 range 索引） */
export function getSortablePayloadKeys(schema: PayloadSchema = {}): string[] {
  return Object.entries(schema)
    .filter(([, entry]) => payloadIndexSupportsOrderBy(entry))
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b))
}

export type PointsSort =
  | { mode: 'default' }
  | { mode: 'payload'; key: string; direction: 'asc' | 'desc' }

export function parseSortValue(value: string): PointsSort {
  if (value === 'default') return { mode: 'default' }
  const [key, dir] = value.split(':')
  if (key && (dir === 'asc' || dir === 'desc')) {
    return { mode: 'payload', key, direction: dir }
  }
  return { mode: 'default' }
}

export function sortToValue(sort: PointsSort): string {
  if (sort.mode === 'default') return 'default'
  return `${sort.key}:${sort.direction}`
}

export function sortToOrderBy(sort: PointsSort): unknown | undefined {
  if (sort.mode === 'default') return undefined
  return { key: sort.key, direction: sort.direction }
}
