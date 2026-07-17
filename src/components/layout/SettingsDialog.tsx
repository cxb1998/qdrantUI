import { useEffect, useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Field, Toggle } from '../ui/fields'
import { loadConnection, saveEmbedSettings, type EmbedSettings } from '../../lib/config'
import { qdrant } from '../../lib/qdrant'
import { embedHealth } from '../../lib/embed'
import { useToast } from '../ui/Toast'
import { usePermissions } from '../../hooks/useAuth'
import { IconCheck, IconAlert, IconSpinner } from '../ui/icons'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const toast = useToast()
  const { role, username } = usePermissions()
  const [embed, setEmbed] = useState<EmbedSettings>({ useMock: true })
  const [qdrantTest, setQdrantTest] = useState<TestState>('idle')
  const [qdrantTestMsg, setQdrantTestMsg] = useState('')
  const [embedTest, setEmbedTest] = useState<TestState>('idle')
  const [embedTestMsg, setEmbedTestMsg] = useState('')

  useEffect(() => {
    if (open) {
      setEmbed(loadConnection().embed)
      setQdrantTest('idle')
      setQdrantTestMsg('')
      setEmbedTest('idle')
      setEmbedTestMsg('')
    }
  }, [open])

  async function runQdrantTest() {
    setQdrantTest('testing')
    try {
      await qdrant.health()
      setQdrantTest('ok')
      setQdrantTestMsg('连接正常')
    } catch (e) {
      setQdrantTest('fail')
      setQdrantTestMsg(e instanceof Error ? e.message : '连接失败')
    }
  }

  async function runEmbedTest() {
    const prev = loadConnection().embed
    saveEmbedSettings(embed)
    setEmbedTest('testing')
    try {
      await embedHealth()
      setEmbedTest('ok')
      setEmbedTestMsg(embed.useMock ? 'Mock 模式已启用' : '向量服务连接正常')
    } catch (e) {
      setEmbedTest('fail')
      setEmbedTestMsg(e instanceof Error ? e.message : '连接失败')
      saveEmbedSettings(prev)
    }
  }

  function save() {
    saveEmbedSettings(embed)
    toast.success('设置已保存')
    onOpenChange(false)
  }

  const roleLabel = role === 'admin' ? '管理员' : role === 'viewer' ? '只读' : '—'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="设置"
      description="Qdrant 与向量服务由服务端代理，无需在浏览器填写密钥。"
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={save}>
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-lg border bg-surface-2 px-3 py-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted">当前用户</span>
            <span className="font-medium text-ink">{username ?? '—'}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-muted">权限</span>
            <span className="font-medium text-ink">{roleLabel}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[12.5px] font-medium text-ink">Qdrant</div>
          <Field label="连接方式" hint="经 BFF 安全代理，密钥保存在服务端">
            <div className="rounded-lg border bg-surface-2 px-3 py-2 font-mono text-[12.5px] text-muted">
              /api/qdrant
            </div>
          </Field>
          <TestRow state={qdrantTest} msg={qdrantTestMsg} onTest={runQdrantTest} />
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="text-[12.5px] font-medium text-ink">向量服务</div>
          <Toggle
            checked={embed.useMock}
            onChange={(useMock) => setEmbed((e) => ({ ...e, useMock }))}
            label="使用 Mock（浏览器内伪向量，无需真实服务）"
          />
          {!embed.useMock && (
            <p className="text-[12px] text-muted">
              真实服务地址由服务端环境变量 <span className="font-mono">EMBED_URL</span> 配置。
            </p>
          )}
          <TestRow state={embedTest} msg={embedTestMsg} onTest={runEmbedTest} />
        </div>
      </div>
    </Dialog>
  )
}

function TestRow({
  state,
  msg,
  onTest,
}: {
  state: TestState
  msg: string
  onTest: () => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" size="sm" onClick={onTest} loading={state === 'testing'}>
        测试连接
      </Button>
      {state === 'ok' && (
        <span className="inline-flex items-center gap-1 text-[13px] text-[var(--color-ok)]">
          <IconCheck /> {msg}
        </span>
      )}
      {state === 'fail' && (
        <span className="inline-flex items-center gap-1 text-[13px] text-[var(--color-danger)]">
          <IconAlert /> {msg}
        </span>
      )}
      {state === 'testing' && (
        <span className="inline-flex items-center gap-1 text-[13px] text-muted">
          <IconSpinner /> 探测中…
        </span>
      )}
    </div>
  )
}
