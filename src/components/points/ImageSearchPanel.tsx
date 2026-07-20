import { useRef, useState } from 'react'
import { embedImage } from '../../lib/embed'
import { expectedVectorSize } from '../../lib/imageSearch'
import type { CollectionInfo } from '../../lib/qdrant'
import { Button } from '../ui/Button'
import { useToast } from '../ui/Toast'
import { IconClose, IconSearch, IconUpload } from '../ui/icons'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const MAX_MB = 10

export function ImageSearchPanel({
  info,
  onSearchStart,
  onSearchDone,
  onClear,
}: {
  info: CollectionInfo
  onSearchStart: () => void
  onSearchDone: (result: { previewUrl: string; vector: number[] }) => void
  onClear: () => void
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const dim = expectedVectorSize(info)

  function revokePreview(url: string | null) {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }

  function resetFileInput() {
    if (inputRef.current) inputRef.current.value = ''
  }

  function pickImage(f: File | null) {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`图片不能超过 ${MAX_MB} MB`)
      return
    }
    setFile(f)
    setPreviewUrl((prev) => {
      revokePreview(prev)
      return URL.createObjectURL(f)
    })
    onClear()
  }

  async function runSearch() {
    if (!file) {
      toast.error('请先选择图片')
      return
    }
    if (dim == null) {
      toast.error('无法读取集合向量维度')
      return
    }
    if (!previewUrl) return

    setLoading(true)
    onSearchStart()
    try {
      const embedded = await embedImage(file, dim)
      onSearchDone({ previewUrl, vector: embedded.vector })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '以图搜图失败')
      onClear()
    } finally {
      setLoading(false)
    }
  }

  function clearImage() {
    setFile(null)
    setPreviewUrl((prev) => {
      revokePreview(prev)
      return null
    })
    resetFileInput()
    onClear()
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-lg border bg-surface-2/50 py-1 pl-1 pr-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="选择图片"
        className="flex h-9.5 w-9.5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border bg-surface transition hover:border-[var(--color-indigo)]"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <IconUpload className="text-[17px] text-muted" />
        )}
      </button>
      <Button
        variant="primary"
        size="md"
        icon={<IconSearch />}
        loading={loading}
        disabled={!file}
        onClick={runSearch}
      >
        检索
      </Button>
      {file && (
        <button
          type="button"
          title="清除图片"
          aria-label="清除图片"
          onClick={clearImage}
          className="grid size-9.5 shrink-0 cursor-pointer place-items-center rounded-md text-muted transition hover:bg-surface hover:text-ink"
        >
          <IconClose className="text-[17px]" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          pickImage(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </div>
  )
}
