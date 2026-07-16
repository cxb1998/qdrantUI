import { useRef, useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/fields'
import { useUploadSnapshot } from '../../hooks/useQdrant'
import { useToast } from '../../components/ui/Toast'
import { IconUpload } from '../../components/ui/icons'
import { formatBytes } from '../../lib/format'

export function UploadSnapshotDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const toast = useToast()
  const upload = useUploadSnapshot()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function reset() {
    setName('')
    setFile(null)
  }

  function pickFile(f: File | null) {
    setFile(f)
    if (f && !name) {
      // 默认用文件名（去掉 .snapshot 后缀与时间戳）作为集合名
      const base = f.name.replace(/\.snapshot$/i, '').replace(/-\d{6,}$/, '')
      setName(base)
    }
  }

  async function submit() {
    if (!file || !name.trim()) return
    try {
      await upload.mutateAsync({ name: name.trim(), file })
      toast.success(`已从备份恢复到集合「${name.trim()}」`)
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
      title="从备份恢复"
      description="选择 .snapshot 备份文件，恢复为一个集合。若同名集合已存在，将被覆盖。"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={upload.isPending}
            disabled={!file || !name.trim()}
          >
            上传并恢复
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="目标集合名称" hint="备份将恢复到该集合">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 image_embeddings"
            spellCheck={false}
          />
        </Field>
        <Field label="备份文件">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="dot-grid flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed py-6 text-center transition hover:border-[var(--color-indigo)]"
          >
            <IconUpload className="text-xl text-muted" />
            {file ? (
              <span className="text-[13px] text-ink">
                {file.name}
                <span className="ml-2 font-mono text-[11.5px] text-muted">{formatBytes(file.size)}</span>
              </span>
            ) : (
              <span className="text-[13px] text-muted">点击选择 .snapshot 备份文件</span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".snapshot"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
    </Dialog>
  )
}
