import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { IconClose } from './icons'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className="fixed inset-0 z-50 bg-[var(--color-ink)]/35 backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out"
        />
        <RadixDialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-surface shadow-[0_24px_60px_-16px_rgba(18,20,26,0.4)] data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out"
          style={{ maxWidth: width }}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <RadixDialog.Title className="font-display text-[16px] font-semibold text-ink">
                {title}
              </RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="mt-0.5 text-[12.5px] text-muted">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              className="rounded-lg p-1 text-muted-soft transition hover:bg-[var(--color-line)]/60 hover:text-ink"
              aria-label="关闭"
            >
              <IconClose className="text-lg" />
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex justify-end gap-2 border-t bg-surface-2 px-5 py-3.5">{footer}</div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
