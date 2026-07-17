import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  AUTH_REQUIRED_EVENT,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  type AuthUser,
} from '../lib/auth'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe()
      setUser(me)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const me = await fetchMe()
        if (!cancelled) setUser(me)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onAuthRequired = () => setUser(null)
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const me = await apiLogin(username, password)
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthUser {
  const ctx = useContext(AuthContext)
  if (!ctx?.user) throw new Error('useAuth 需要已登录用户')
  return ctx.user
}

export function useAuthOptional() {
  return useContext(AuthContext)
}

export function usePermissions() {
  const ctx = useContext(AuthContext)
  return {
    canWrite: ctx?.user?.canWrite ?? false,
    canAdmin: ctx?.user?.canAdmin ?? false,
    role: ctx?.user?.role ?? null,
    username: ctx?.user?.user ?? null,
  }
}
