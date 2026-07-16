import { Dialog } from './Dialog'
import { Button } from './Button'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = '确认',
  danger,
  loading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  message: React.ReactNode
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      width={420}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-center font-sans text-[15px] leading-relaxed text-ink">{message}</div>
    </Dialog>
  )
}
