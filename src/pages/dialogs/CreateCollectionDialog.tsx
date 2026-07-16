import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { Button } from '../../components/ui/Button'
import { Field, Input, Select, Toggle } from '../../components/ui/fields'
import { useCreateCollection } from '../../hooks/useQdrant'
import { useToast } from '../../components/ui/Toast'
import type { Distance } from '../../lib/qdrant'

const DISTANCES: { value: Distance; label: string }[] = [
  { value: 'Cosine', label: '余弦相似度 Cosine' },
  { value: 'Dot', label: '点积 Dot' },
  { value: 'Euclid', label: '欧氏距离 Euclid' },
  { value: 'Manhattan', label: '曼哈顿距离 Manhattan' },
]

export function CreateCollectionDialog({
  open,
  onOpenChange,
  existingNames,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  existingNames: string[]
}) {
  const toast = useToast()
  const create = useCreateCollection()
  const [name, setName] = useState('')
  const [size, setSize] = useState('512')
  const [distance, setDistance] = useState<Distance>('Cosine')
  const [onDiskVectors, setOnDiskVectors] = useState(false)
  const [onDiskPayload, setOnDiskPayload] = useState(true)

  const nameError =
    name && existingNames.includes(name.trim()) ? '已存在同名集合' : ''
  const sizeNum = Number(size)
  const sizeError = size && (!Number.isInteger(sizeNum) || sizeNum < 1) ? '维度需为正整数' : ''
  const valid = name.trim() && !nameError && sizeNum >= 1 && !sizeError

  function reset() {
    setName('')
    setSize('512')
    setDistance('Cosine')
    setOnDiskVectors(false)
    setOnDiskPayload(true)
  }

  async function submit() {
    if (!valid) return
    try {
      await create.mutateAsync({
        name: name.trim(),
        body: {
          vectors: { size: sizeNum, distance, on_disk: onDiskVectors },
          on_disk_payload: onDiskPayload,
        },
      })
      toast.success(`集合「${name.trim()}」已创建`)
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
      title="创建集合"
      description="定义向量维度与距离度量，创建后即可写入点数据。"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={submit} loading={create.isPending} disabled={!valid}>
            创建集合
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="集合名称" hint={nameError || '只用于标识，创建后不可修改'}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如 image_embeddings"
            autoFocus
            spellCheck={false}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="向量维度" hint={sizeError}>
            <Input
              type="number"
              min={1}
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="距离度量">
            <Select value={distance} onChange={(e) => setDistance(e.target.value as Distance)}>
              {DISTANCES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="space-y-2.5 rounded-lg border bg-surface-2 px-3.5 py-3">
          <Toggle checked={onDiskVectors} onChange={setOnDiskVectors} label="向量存储于磁盘（省内存）" />
          <Toggle checked={onDiskPayload} onChange={setOnDiskPayload} label="Payload 存储于磁盘" />
        </div>
      </div>
    </Dialog>
  )
}
