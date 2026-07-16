import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { IconCheck, IconAlert, IconClose } from './icons'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, kind, message }])
      window.setTimeout(() => remove(id), kind === 'error' ? 6000 : 3500)
    },
    [remove],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed top-6 z-[100] flex w-[min(360px,calc(100vw-var(--sidebar-width)-2rem))] -translate-x-1/2 flex-col gap-2 left-[calc(var(--sidebar-width)/2+50vw)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-surface px-3.5 py-2.5 shadow-[0_8px_30px_-8px_rgba(18,20,26,0.25)]"
            style={{ animation: 'toast-in 180ms ease-out' }}
          >
            <span
              className="grid size-5 shrink-0 place-items-center rounded-full text-[13px] text-white"
              style={{
                background:
                  t.kind === 'success'
                    ? 'var(--color-ok)'
                    : t.kind === 'error'
                      ? 'var(--color-danger)'
                      : 'var(--color-indigo)',
              }}
            >
              {t.kind === 'error' ? <IconAlert /> : <IconCheck />}
            </span>
            <p className="flex-1 py-0.5 text-[13px] leading-snug text-ink">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              className="grid size-5 shrink-0 place-items-center text-muted-soft transition hover:text-ink"
              aria-label="关闭提示"
            >
              <IconClose className="text-base" />
            </button>
          </div>
        ))}
      </div>
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </ToastContext.Provider>
  )
}
