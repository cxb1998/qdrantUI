import { useState, type FormEvent } from 'react'
import { AuthError } from '../lib/auth'
import { useAuthOptional } from '../hooks/useAuth'
import { Input, PasswordInput } from '../components/ui/fields'
import { Button } from '../components/ui/Button'
import { IconSpinner } from '../components/ui/icons'

export function LoginPage() {
  const auth = useAuthOptional()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!auth) return
    setError('')
    setLoading(true)
    try {
      await auth.login(username.trim(), password)
    } catch (err) {
      setError(err instanceof AuthError ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-scene relative flex min-h-full items-center justify-center overflow-hidden px-6 py-12">
      <div className="login-aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="login-grid pointer-events-none absolute inset-0 opacity-[0.45]" aria-hidden />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-[var(--color-ink)] shadow-[0_20px_50px_-20px_rgba(18,20,26,0.55)]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="7" cy="8" r="2" fill="var(--color-near)" />
              <circle cx="17" cy="7" r="2" fill="var(--color-far)" />
              <circle cx="14" cy="17" r="2" fill="#fff" />
              <path
                d="M8.5 8.6 15.4 15.8M9 8l6.4-.6"
                stroke="#fff"
                strokeWidth="1.2"
                opacity="0.55"
              />
            </svg>
          </div>
          <h1 className="font-title text-[28px] font-medium tracking-wide text-ink">向量库控制台</h1>
          <p className="mt-2 text-[13.5px] text-muted">登录以访问集合与向量数据</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="login-card rounded-[18px] border border-white/60 bg-white/75 p-7 shadow-[0_24px_80px_-32px_rgba(59,56,184,0.35)] backdrop-blur-xl"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink">用户名</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                spellCheck={false}
                className="bg-white/90"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink">密码</span>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="bg-white/90"
              />
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-6 w-full"
            disabled={loading || !username.trim() || !password}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <IconSpinner /> 登录中…
              </span>
            ) : (
              '进入控制台'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11.5px] leading-relaxed text-muted-soft">
          首次部署请使用管理员创建的账号。
          <br />
          只读账号仅可浏览与检索，无法修改数据。
        </p>
      </div>
    </div>
  )
}
