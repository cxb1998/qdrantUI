import { PayloadFilterField } from '../points/PayloadFilterField'
import { Button } from '../ui/Button'
import { Tag } from '../ui/primitives'
import {
  formatFilterConditionLabel,
  type PayloadFilterCondition,
} from '../../lib/pointsFilter'

export function GraphFilterBar({
  collectionName,
  payloadSchema,
  draftFilters,
  appliedFilters,
  dirty,
  applying,
  onDraftFiltersChange,
  onApply,
  onClear,
}: {
  collectionName: string
  payloadSchema: Record<string, unknown>
  draftFilters: PayloadFilterCondition[]
  appliedFilters: PayloadFilterCondition[]
  dirty: boolean
  applying: boolean
  onDraftFiltersChange: (filters: PayloadFilterCondition[]) => void
  onApply: () => void
  onClear: () => void
}) {
  const appliedCount = appliedFilters.length

  return (
    <div className="absolute inset-x-3 top-3 z-20 max-w-[min(100%,52rem)] rounded-lg border border-[var(--color-line)] bg-white/94 px-2.5 py-2 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <PayloadFilterField
          collectionName={collectionName}
          filters={draftFilters}
          onFiltersChange={onDraftFiltersChange}
          payloadSchema={payloadSchema}
        />
        <Button
          size="sm"
          variant="primary"
          onClick={onApply}
          loading={applying}
          disabled={!dirty}
        >
          应用
        </Button>
        {appliedCount > 0 && (
          <Button size="sm" variant="ghost" onClick={onClear} disabled={applying}>
            清除
          </Button>
        )}
        {dirty && appliedCount > 0 && (
          <span className="text-[11px] text-[var(--color-warn)]">未应用</span>
        )}
      </div>
      {appliedCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line)]/70 pt-2">
          <span className="shrink-0 text-[11px] font-medium text-muted">当前筛选</span>
          {appliedFilters.map((condition) => (
            <Tag
              key={`${condition.isIdFilter ? 'id' : condition.key}:${String(condition.value)}`}
              tone="indigo"
            >
              <span className="block max-w-[14rem] truncate font-mono text-[11px]">
                {formatFilterConditionLabel(condition)}
              </span>
            </Tag>
          ))}
        </div>
      )}
    </div>
  )
}
