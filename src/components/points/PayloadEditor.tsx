import { useEffect, useState } from 'react'
import { qdrant } from '../../lib/qdrant'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/fields'
import { useToast } from '../ui/Toast'

export function PayloadEditor({
  open,
  onOpenChange,
  collectionName,
  pointId,
  payload,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  pointId: string | number
  payload: Record<string, unknown>
  onSaved: (payload: Record<string, unknown>) => void
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setText(JSON.stringify(payload, null, 2))
      setError('')
    }
  }, [open, payload])

  async function save() {
    setError('')
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('标量必须是 JSON 对象')
        return
      }
    } catch {
      setError('不是合法的 JSON')
      return
    }

    setLoading(true)
    try {
      await qdrant.overwritePayload(collectionName, parsed, [pointId])
      toast.success('标量已保存')
      onSaved(parsed)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="编辑标量"
      description={`点 ${pointId}`}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button variant="primary" onClick={save} loading={loading}>
            保存
          </Button>
        </>
      }
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        spellCheck={false}
        className="font-mono text-[12.5px]"
      />
      {error && <p className="mt-2 text-[12px] text-[var(--color-danger)]">{error}</p>}
    </Dialog>
  )
}
