import { useEffect, useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Field, Input, Toggle } from '../ui/fields'
import { loadConnection, saveConnection, type EmbedSettings } from '../../lib/config'
import { qdrant } from '../../lib/qdrant'
import { embedHealth } from '../../lib/embed'
import { useToast } from '../ui/Toast'
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
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [embed, setEmbed] = useState<EmbedSettings>({
    url: 'http://localhost:8765',
    apiKey: '',
    useMock: true,
  })
  const [qdrantTest, setQdrantTest] = useState<TestState>('idle')
  const [qdrantTestMsg, setQdrantTestMsg] = useState('')
  const [embedTest, setEmbedTest] = useState<TestState>('idle')
  const [embedTestMsg, setEmbedTestMsg] = useState('')

  useEffect(() => {
    if (open) {
      const c = loadConnection()
      setUrl(c.url)
      setApiKey(c.apiKey)
      setEmbed(c.embed)
      setQdrantTest('idle')
      setQdrantTestMsg('')
      setEmbedTest('idle')
      setEmbedTestMsg('')
    }
  }, [open])

  function draftConnection() {
    return { url, apiKey, embed }
  }

  async function runQdrantTest() {
    const prev = loadConnection()
    saveConnection(draftConnection())
    setQdrantTest('testing')
    try {
      await qdrant.health()
      setQdrantTest('ok')
      setQdrantTestMsg('连接正常')
    } catch (e) {
      setQdrantTest('fail')
      setQdrantTestMsg(e instanceof Error ? e.message : '连接失败')
      saveConnection(prev)
    }
  }

  async function runEmbedTest() {
    const prev = loadConnection()
    saveConnection(draftConnection())
    setEmbedTest('testing')
    try {
      await embedHealth()
      setEmbedTest('ok')
      setEmbedTestMsg(embed.useMock ? 'Mock 模式已启用' : '向量服务连接正常')
    } catch (e) {
      setEmbedTest('fail')
      setEmbedTestMsg(e instanceof Error ? e.message : '连接失败')
      saveConnection(prev)
    }
  }

  function save() {
    saveConnection(draftConnection())
    toast.success('连接设置已保存')
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="连接设置"
      description="Qdrant 与向量服务（如 DINOv3）可分别配置。"
      width={520}
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
        <div className="space-y-4">
          <div className="text-[12.5px] font-medium text-ink">Qdrant</div>
          <Field label="服务地址" hint="形如 http://localhost:6333">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:6333"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>
          <Field label="API Key（可选）">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="未设置"
              autoComplete="off"
            />
          </Field>
          <TestRow state={qdrantTest} msg={qdrantTestMsg} onTest={runQdrantTest} />
        </div>

        <div className="space-y-4 border-t pt-4">
          <div className="text-[12.5px] font-medium text-ink">向量服务（DINOv3）</div>
          <Toggle
            checked={embed.useMock}
            onChange={(useMock) => setEmbed((e) => ({ ...e, useMock }))}
            label="使用 Mock（浏览器内伪向量，无需真实服务）"
          />
          {!embed.useMock && (
            <>
              <Field label="服务地址" hint="POST /embed/image，返回 { vector, payload?: { patch_num, ... } }">
                <Input
                  value={embed.url}
                  onChange={(e) => setEmbed((s) => ({ ...s, url: e.target.value }))}
                  placeholder="http://localhost:8765"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              <Field label="API Key（可选）">
                <Input
                  type="password"
                  value={embed.apiKey}
                  onChange={(e) => setEmbed((s) => ({ ...s, apiKey: e.target.value }))}
                  placeholder="未设置"
                  autoComplete="off"
                />
              </Field>
            </>
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
