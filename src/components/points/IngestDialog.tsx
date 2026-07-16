import { useCallback, useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CollectionInfo } from '../../lib/qdrant'
import { qdrant } from '../../lib/qdrant'
import {
  buildPayloadFromMappings,
  collectIngestTypeMismatchIssues,
  defaultMappingsForSchema,
  filterImageFiles,
  ingestFileContext,
  normalizeIngestMappings,
  type IngestTypeMismatchIssue,
  type ScalarMapping,
} from '../../lib/ingestMapping'
import {
  ingestSinglePoint,
  previewPayloadRows,
  runBatchIngest,
  type IngestProgress,
} from '../../lib/ingestRun'
import {
  deleteIngestTemplate,
  listIngestTemplates,
  saveIngestTemplate,
  type IngestTemplate,
} from '../../lib/ingestTemplates'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/fields'
import { useToast } from '../ui/Toast'
import { ScalarMappingEditor } from './ScalarMappingEditor'
import { IconUpload } from '../ui/icons'
import { qk } from '../../hooks/useQdrant'
import { formatInt } from '../../lib/format'

type IngestMode = 'single' | 'batch'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const TYPE_MISMATCH_SCAN_LIMIT = 50
const PICKER_ZONE_CLS =
  'dot-grid flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 text-center transition hover:border-[var(--color-indigo)]'

function warnTypeMismatches(
  issues: IngestTypeMismatchIssue[],
  toast: { info: (message: string) => void },
) {
  if (!issues.length) return
  const fields = issues.map((i) => i.key).join('、')
  toast.info(
    issues.length === 1
      ? `字段「${fields}」类型与 schema 不一致，筛选可能异常`
      : `${issues.length} 个字段（${fields}）类型与 schema 不一致，筛选可能异常`,
  )
}

function IngestSchemaTypeWarnings({
  issues,
  sampled,
  total,
}: {
  issues: IngestTypeMismatchIssue[]
  sampled?: boolean
  total?: number
}) {
  if (!issues.length) return null
  return (
    <div className="rounded-lg border border-[var(--color-warn)]/40 bg-[var(--color-warn-soft)] px-3 py-2.5 text-[12.5px]">
      <p className="font-medium text-[var(--color-warn)]">类型与 schema 不一致</p>
      <p className="mt-1 text-muted">
        以下字段无法按 schema 类型写入，仍将作为文本入库，筛选或索引可能异常。
      </p>
      {sampled && total != null && total > TYPE_MISMATCH_SCAN_LIMIT && (
        <p className="mt-1 text-[11.5px] text-muted-soft">
          已检测前 {TYPE_MISMATCH_SCAN_LIMIT} / {formatInt(total)} 个文件
        </p>
      )}
      <ul className="mt-2 space-y-1.5">
        {issues.map((issue) => (
          <li key={issue.key} className="font-mono text-[12px] text-ink">
            <span className="font-semibold">{issue.key}</span>
            <span className="text-muted">
              {' '}
              · 应为 {issue.expectedType}，当前为 {issue.actualType}
            </span>
            {issue.sampleValue && (
              <span className="text-muted-soft"> · 例：{issue.sampleValue}</span>
            )}
            {issue.affectedCount > 1 && (
              <span className="text-muted"> · {formatInt(issue.affectedCount)} 条</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function IngestDialog({
  open,
  onOpenChange,
  collectionName,
  info,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  info: CollectionInfo
}) {
  const toast = useToast()
  const qc = useQueryClient()
  const schemaKeys = useMemo(() => Object.keys(info.payload_schema ?? {}), [info.payload_schema])
  const payloadSchema = info.payload_schema ?? {}

  const [mode, setMode] = useState<IngestMode>('batch')
  const [mappings, setMappings] = useState<ScalarMapping[]>(() =>
    defaultMappingsForSchema(schemaKeys),
  )
  const [templates, setTemplates] = useState<IngestTemplate[]>([])
  const [templateId, setTemplateId] = useState('')
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateNameDraft, setTemplateNameDraft] = useState('')
  const [saveTemplateError, setSaveTemplateError] = useState('')
  const [deleteTemplateOpen, setDeleteTemplateOpen] = useState(false)

  const [singleFile, setSingleFile] = useState<File | null>(null)
  const [singlePreview, setSinglePreview] = useState<string | null>(null)
  const [payloadOverrides, setPayloadOverrides] = useState<Record<string, string>>({})

  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<IngestProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const singleInputRef = useRef<HTMLInputElement>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)

  const reloadTemplates = useCallback(() => {
    setTemplates(listIngestTemplates(collectionName))
  }, [collectionName])

  useEffect(() => {
    if (!open) return
    reloadTemplates()
    setMode('batch')
    setMappings(defaultMappingsForSchema(schemaKeys))
    setTemplateId('')
    setSingleFile(null)
    setSinglePreview(null)
    setPayloadOverrides({})
    setBatchFiles([])
    setProgress(null)
    setLoading(false)
    setSaveTemplateOpen(false)
    setDeleteTemplateOpen(false)
    setTemplateNameDraft('')
    setSaveTemplateError('')
  }, [open, collectionName, schemaKeys, reloadTemplates])

  useEffect(() => {
    if (!saveTemplateOpen) return
    const id = window.setTimeout(() => {
      const el = document.getElementById('ingest-template-name') as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 0)
    return () => window.clearTimeout(id)
  }, [saveTemplateOpen])

  useEffect(() => {
    return () => {
      if (singlePreview) URL.revokeObjectURL(singlePreview)
    }
  }, [singlePreview])

  useEffect(() => {
    setPayloadOverrides({})
  }, [singleFile])

  const mappingPreview = useMemo(() => {
    if (!singleFile) return {} as Record<string, string>
    const ctx = ingestFileContext(singleFile)
    const payload = buildPayloadFromMappings(mappings, ctx, undefined, payloadSchema)
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(payload)) {
      out[k] = v === null ? 'null' : String(v)
    }
    return out
  }, [singleFile, mappings, payloadSchema])

  const previewKeys = useMemo(() => {
    const keys = new Set([...Object.keys(mappingPreview), ...Object.keys(payloadOverrides)])
    return [...keys]
  }, [mappingPreview, payloadOverrides])

  function applyTemplate(id: string) {
    setTemplateId(id)
    if (!id) return
    const tpl = templates.find((t) => t.id === id)
    if (!tpl) return
    setMappings(normalizeIngestMappings(tpl.mappings.map((m) => ({ ...m }))))
  }

  function openSaveTemplateDialog() {
    const existing = templates.find((t) => t.id === templateId)
    setTemplateNameDraft(existing?.name ?? '')
    setSaveTemplateError('')
    setSaveTemplateOpen(true)
  }

  function confirmSaveTemplate() {
    const name = templateNameDraft.trim()
    if (!name) {
      setSaveTemplateError('请输入模板名称')
      return
    }
    try {
      const saved = saveIngestTemplate(
        collectionName,
        name,
        normalizeIngestMappings(mappings),
        templateId || undefined,
      )
      reloadTemplates()
      setTemplateId(saved.id)
      setSaveTemplateOpen(false)
      toast.success(templateId ? `已更新模板「${saved.name}」` : `已保存模板「${saved.name}」`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    }
  }

  function openDeleteTemplateDialog() {
    if (!templateId) return
    setDeleteTemplateOpen(true)
  }

  function confirmDeleteTemplate() {
    if (!templateId) return
    deleteIngestTemplate(templateId)
    setTemplateId('')
    setDeleteTemplateOpen(false)
    reloadTemplates()
    toast.success('模板已删除')
  }

  function pickSingle(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    setSingleFile(file)
    setSinglePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  function clearSingleSelection() {
    setSingleFile(null)
    setSinglePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setPayloadOverrides({})
    if (singleInputRef.current) singleInputRef.current.value = ''
  }

  function pickBatch(fileList: FileList | null) {
    if (!fileList?.length) return
    const images = filterImageFiles(fileList)
    if (!images.length) {
      toast.error('所选文件夹中没有支持的图片')
      return
    }
    setBatchFiles(images)
  }

  function clearBatchSelection() {
    setBatchFiles([])
    if (batchInputRef.current) batchInputRef.current.value = ''
  }

  const batchPreview = useMemo(
    () => previewPayloadRows(batchFiles, mappings, payloadSchema, 5),
    [batchFiles, mappings, payloadSchema],
  )

  const typeMismatchIssues = useMemo(() => {
    if (mode === 'single') {
      if (!singleFile) return []
      return collectIngestTypeMismatchIssues(
        [singleFile],
        mappings,
        payloadSchema,
        () => payloadOverrides,
      )
    }
    if (!batchFiles.length) return []
    return collectIngestTypeMismatchIssues(
      batchFiles.slice(0, TYPE_MISMATCH_SCAN_LIMIT),
      mappings,
      payloadSchema,
    )
  }, [mode, singleFile, batchFiles, mappings, payloadSchema, payloadOverrides])

  function scanAllTypeMismatches(): IngestTypeMismatchIssue[] {
    if (mode === 'single') {
      if (!singleFile) return []
      return collectIngestTypeMismatchIssues(
        [singleFile],
        mappings,
        payloadSchema,
        () => payloadOverrides,
      )
    }
    if (!batchFiles.length) return []
    return collectIngestTypeMismatchIssues(batchFiles, mappings, payloadSchema)
  }

  async function invalidateAfterIngest() {
    await qc.invalidateQueries({ queryKey: qk.collection(collectionName) })
    await qc.invalidateQueries({ queryKey: ['points', collectionName] })
  }

  async function handleSingleIngest() {
    if (!singleFile) {
      toast.error('请先选择图片')
      return
    }
    warnTypeMismatches(scanAllTypeMismatches(), toast)
    setLoading(true)
    abortRef.current = new AbortController()
    try {
      const point = await ingestSinglePoint({
        collectionName,
        info,
        file: singleFile,
        mappings,
        payloadOverrides,
        signal: abortRef.current.signal,
      })
      await qdrant.upsertPoints(collectionName, [point])
      await invalidateAfterIngest()
      toast.success(`已入库实例 ${String(point.id)}`)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '入库失败')
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  async function handleBatchIngest() {
    if (!batchFiles.length) {
      toast.error('请先选择包含图片的文件夹')
      return
    }
    warnTypeMismatches(scanAllTypeMismatches(), toast)
    setLoading(true)
    abortRef.current = new AbortController()
    try {
      const result = await runBatchIngest({
        collectionName,
        info,
        files: batchFiles,
        mappings,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      })
      await invalidateAfterIngest()
      if (result.succeeded > 0) {
        toast.success(`已成功入库 ${formatInt(result.succeeded)} 个实例`)
      }
      if (result.errors.length) {
        toast.error(result.errors.slice(0, 2).join('；'))
      }
      if (result.succeeded > 0) onOpenChange(false)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error(e instanceof Error ? e.message : '批量入库失败')
      }
    } finally {
      setLoading(false)
      setProgress(null)
      abortRef.current = null
    }
  }

  const selectedTemplate = templates.find((t) => t.id === templateId)
  const isUpdatingTemplate = Boolean(templateId && selectedTemplate)

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) abortRef.current?.abort()
        onOpenChange(next)
      }}
      title="数据入库"
      description="图片自动向量化；标量由映射规则生成，并与向量服务返回的 payload 合并（同名字段以向量服务为准）"
      width={680}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          {mode === 'single' ? (
            <Button
              variant="primary"
              onClick={handleSingleIngest}
              loading={loading}
              disabled={!singleFile}
            >
              入库
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleBatchIngest}
              loading={loading}
              disabled={!batchFiles.length}
            >
              {loading && progress
                ? progress.phase === 'embedding'
                  ? `向量化 ${progress.done}/${progress.total}`
                  : `写入 ${progress.done}/${progress.total}`
                : `批量入库（${formatInt(batchFiles.length)}）`}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={mode === 'batch' ? 'primary' : 'secondary'}
            onClick={() => setMode('batch')}
          >
            批量入库
          </Button>
          <Button
            size="sm"
            variant={mode === 'single' ? 'primary' : 'secondary'}
            onClick={() => setMode('single')}
          >
            单图入库
          </Button>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-surface-2 px-3 py-2.5">
          <div className="min-w-[10rem] flex-1">
            <Field label="入库模板">
              <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">不使用模板</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button size="sm" variant="secondary" onClick={openSaveTemplateDialog}>
            {isUpdatingTemplate ? '更新模板' : '保存模板'}
          </Button>
          {templateId && (
            <Button size="sm" variant="ghost" onClick={openDeleteTemplateDialog}>
              删除模板
            </Button>
          )}
        </div>

        {mode === 'single' ? (
          <SingleIngestSection
            file={singleFile}
            previewUrl={singlePreview}
            previewKeys={previewKeys}
            mappingPreview={mappingPreview}
            payloadOverrides={payloadOverrides}
            onPayloadOverrideChange={(key, value) =>
              setPayloadOverrides((prev) => ({ ...prev, [key]: value }))
            }
            onPickFile={pickSingle}
            onClear={clearSingleSelection}
            inputRef={singleInputRef}
          />
        ) : (
          <BatchIngestSection
            files={batchFiles}
            preview={batchPreview}
            onPickFolder={pickBatch}
            onClear={clearBatchSelection}
            inputRef={batchInputRef}
          />
        )}

        <IngestSchemaTypeWarnings
          issues={typeMismatchIssues}
          sampled={mode === 'batch'}
          total={mode === 'batch' ? batchFiles.length : undefined}
        />

        <p className="text-[12px] leading-relaxed text-muted">
          Embedding 服务自带的标量入库时自动合并，无需在下方映射中配置。
        </p>

        <ScalarMappingEditor
          mappings={mappings}
          onChange={setMappings}
          schemaKeys={schemaKeys}
        />
      </div>
    </Dialog>

    <Dialog
      open={saveTemplateOpen}
      onOpenChange={setSaveTemplateOpen}
      title={isUpdatingTemplate ? '更新入库模板' : '保存入库模板'}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={() => setSaveTemplateOpen(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={confirmSaveTemplate}>
            {isUpdatingTemplate ? '更新' : '保存'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="模板名称">
          <Input
            id="ingest-template-name"
            value={templateNameDraft}
            onChange={(e) => {
              setTemplateNameDraft(e.target.value)
              if (saveTemplateError) setSaveTemplateError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmSaveTemplate()
              }
            }}
            placeholder="输入模板名称"
            spellCheck={false}
            autoComplete="off"
          />
        </Field>
        {saveTemplateError && (
          <p className="text-[12px] text-[var(--color-danger)]">{saveTemplateError}</p>
        )}
      </div>
    </Dialog>

    <ConfirmDialog
      open={deleteTemplateOpen}
      onOpenChange={setDeleteTemplateOpen}
      title="删除入库模板"
      danger
      confirmLabel="删除"
      message={
        selectedTemplate ? (
          <>
            确定删除模板 <span className="font-mono">{selectedTemplate.name}</span>？
            <br />
            <span className="text-[13px] text-muted">删除后无法恢复。</span>
          </>
        ) : (
          '确定删除该模板？'
        )
      }
      onConfirm={confirmDeleteTemplate}
    />
    </>
  )
}

function SingleIngestSection({
  file,
  previewUrl,
  previewKeys,
  mappingPreview,
  payloadOverrides,
  onPayloadOverrideChange,
  onPickFile,
  onClear,
  inputRef,
}: {
  file: File | null
  previewUrl: string | null
  previewKeys: string[]
  mappingPreview: Record<string, string>
  payloadOverrides: Record<string, string>
  onPayloadOverrideChange: (key: string, value: string) => void
  onPickFile: (f: File | null) => void
  onClear: () => void
  inputRef: RefObject<HTMLInputElement | null>
}) {
  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      {!file ? (
        <button type="button" onClick={openPicker} className={`${PICKER_ZONE_CLS} py-10`}>
          <IconUpload className="text-2xl text-muted" />
          <span className="text-[13px] text-muted">选择图片</span>
        </button>
      ) : (
        <div className="dot-grid border-b border-dashed bg-surface-2 px-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={openPicker}
              className="rounded-lg transition hover:opacity-90"
              title="点击更换图片"
            >
              <img
                src={previewUrl ?? ''}
                alt=""
                className="max-h-28 max-w-full rounded-md object-contain shadow-sm"
              />
            </button>
            <p className="max-w-full truncate font-mono text-[12px] text-muted" title={file.name}>
              {file.name}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={openPicker}>
                更换图片
              </Button>
              <Button size="sm" variant="ghost" onClick={onClear}>
                清除
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewKeys.length > 0 && (
        <div className="space-y-2 bg-surface px-3 py-3">
          <div className="text-[12.5px] font-medium text-ink">标量预览</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {previewKeys.map((key) => (
              <Field key={key} label={key}>
                <Input
                  value={
                    key in payloadOverrides ? payloadOverrides[key] : (mappingPreview[key] ?? '')
                  }
                  onChange={(e) => onPayloadOverrideChange(key, e.target.value)}
                  spellCheck={false}
                  className="font-mono text-[12.5px]"
                />
              </Field>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BatchIngestSection({
  files,
  preview,
  onPickFolder,
  onClear,
  inputRef,
}: {
  files: File[]
  preview: { relativePath: string; payload: Record<string, unknown> }[]
  onPickFolder: (list: FileList | null) => void
  onClear: () => void
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const hasFiles = files.length > 0

  function openPicker() {
    inputRef.current?.click()
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        multiple
        {...({ webkitdirectory: '', directory: '' } as InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          onPickFolder(e.target.files)
          e.target.value = ''
        }}
      />

      {!hasFiles ? (
        <button type="button" onClick={openPicker} className={`${PICKER_ZONE_CLS} py-10`}>
          <IconUpload className="text-2xl text-muted" />
          <span className="text-[13px] text-muted">选择文件夹</span>
        </button>
      ) : (
        <div className="dot-grid border-b border-dashed bg-surface-2 px-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <IconUpload className="text-2xl text-[var(--color-indigo)]" />
            <div className="text-center">
              <p className="text-[13px] text-ink">
                已选择{' '}
                <span className="font-semibold text-[var(--color-indigo)]">
                  {formatInt(files.length)}
                </span>{' '}
                张图片
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={openPicker}>
                重新选择
              </Button>
              <Button size="sm" variant="ghost" onClick={onClear}>
                清除
              </Button>
            </div>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="space-y-2 bg-surface px-3 py-3">
          <div className="text-[12.5px] font-medium text-ink">标量预览（前 {preview.length} 条）</div>
          <div className="overflow-x-auto rounded-lg border bg-surface-2">
            <table className="w-full min-w-[360px] text-left text-[12px]">
              <thead className="border-b text-muted">
                <tr>
                  <th className="px-2.5 py-2 font-medium">路径</th>
                  <th className="px-2.5 py-2 font-medium">标量</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.relativePath} className="border-b last:border-b-0">
                    <td
                      className="max-w-[200px] truncate px-2.5 py-2 font-mono text-ink"
                      title={row.relativePath}
                    >
                      {row.relativePath}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-muted">
                      {JSON.stringify(row.payload)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
