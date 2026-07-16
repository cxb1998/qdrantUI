import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/fields'
import { useCreateSnapshot } from '../../hooks/useQdrant'
import { setSnapshotNote } from '../../lib/snapshotNotes'
import { useToast } from '../../components/ui/Toast'

export function CreateBackupDialog({
  open,
  onOpenChange,
  collectionName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  onCreated?: () => void
}) {
  const toast = useToast()
  const create = useCreateSnapshot(collectionName)
  const [note, setNote] = useState('')

  function reset() {
    setNote('')
  }

  async function submit() {
    try {
      const snap = await create.mutateAsync()
      if (note.trim()) setSnapshotNote(collectionName, snap.name, note.trim())
      toast.success(`备份「${snap.name}」已创建`)
      onCreated?.()
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
      title="创建备份"
      description="备份名称由系统自动生成。可填写备注，方便日后识别用途。"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={submit} loading={create.isPending}>
            开始创建
          </Button>
        </>
      }
    >
      <Field label="备注（选填）" hint="仅保存在本浏览器，不会写入备份文件">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：上线前备份、迁移前留档"
          maxLength={200}
        />
      </Field>
    </Dialog>
  )
}
