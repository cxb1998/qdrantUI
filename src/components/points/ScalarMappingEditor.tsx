import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/fields'
import { IconClose } from '../ui/icons'
import {
  parseUrlTemplateBase,
  SCALAR_SOURCE_OPTIONS,
  type ScalarMapping,
  type ScalarSourceKind,
} from '../../lib/ingestMapping'

function emptyMapping(): ScalarMapping {
  return { key: '', source: 'filename' }
}

function PathLevelInput({
  value,
  onChange,
}: {
  value: number
  onChange: (level: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  function commitDraft(raw: string) {
    const n = Math.max(1, Number.parseInt(raw, 10) || 1)
    setDraft(String(n))
    onChange(n)
  }

  return (
    <Input
      type="number"
      min={1}
      step={1}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        if (raw === '') return
        const n = Number(raw)
        if (Number.isFinite(n) && n >= 1) onChange(Math.floor(n))
      }}
      onBlur={() => commitDraft(draft)}
      className="w-full font-mono text-[12.5px]"
    />
  )
}

export function ScalarMappingEditor({
  mappings,
  onChange,
  schemaKeys,
}: {
  mappings: ScalarMapping[]
  onChange: (next: ScalarMapping[]) => void
  schemaKeys: string[]
}) {
  function updateRow(index: number, patch: Partial<ScalarMapping>) {
    onChange(mappings.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    onChange(mappings.filter((_, i) => i !== index))
  }

  function addRow() {
    const suggested = schemaKeys.find((k) => !mappings.some((m) => m.key === k))
    onChange([...mappings, suggested ? { key: suggested, source: 'filename' } : emptyMapping()])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink">标量映射</span>
        <Button size="sm" variant="ghost" onClick={addRow}>
          添加字段
        </Button>
      </div>

      <div className="space-y-2">
        {mappings.map((row, index) => {
          return (
            <div key={index} className="space-y-2 rounded-lg border bg-surface-2 p-2.5">
              <div className="grid gap-2 sm:grid-cols-[1fr_1.1fr_auto]">
                <Field label="标量名">
                  <Input
                    list={schemaKeys.length ? `ingest-schema-${index}` : undefined}
                    value={row.key}
                    onChange={(e) => updateRow(index, { key: e.target.value })}
                    placeholder="file_name"
                    spellCheck={false}
                    className="font-mono text-[12.5px]"
                  />
                  {schemaKeys.length > 0 && (
                    <datalist id={`ingest-schema-${index}`}>
                      {schemaKeys.map((k) => (
                        <option key={k} value={k} />
                      ))}
                    </datalist>
                  )}
                </Field>

                <Field label="取值方式">
                  <Select
                    value={row.source}
                    onChange={(e) => {
                      const source = e.target.value as ScalarSourceKind
                      updateRow(index, {
                        source,
                        ...(source === 'url_template'
                          ? { template: parseUrlTemplateBase(row.template) }
                          : {}),
                      })
                    }}
                  >
                    {SCALAR_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="flex items-start justify-end pt-6">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={mappings.length <= 1}
                    className="grid size-8 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="删除映射"
                  >
                    <IconClose className="text-base" />
                  </button>
                </div>
              </div>

              {row.source === 'path_level' && (
                <Field label="目录层级 N">
                  <PathLevelInput
                    value={row.level ?? 1}
                    onChange={(level) => updateRow(index, { level })}
                  />
                </Field>
              )}
              {row.source === 'constant' && (
                <Field label="固定值">
                  <Input
                    value={row.constant ?? ''}
                    onChange={(e) => updateRow(index, { constant: e.target.value })}
                    spellCheck={false}
                  />
                </Field>
              )}
              {row.source === 'url_template' && (
                <Field label="URL 拼接">
                  <Input
                    value={row.template ?? ''}
                    onChange={(e) => updateRow(index, { template: e.target.value })}
                    placeholder="https://cdn.example.com/dataset/"
                    spellCheck={false}
                    className="w-full font-mono text-[12.5px]"
                  />
                </Field>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
