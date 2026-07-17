import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { CollectionsPage } from './pages/CollectionsPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { LoginPage } from './pages/LoginPage'
import { useAuthOptional } from './hooks/useAuth'
import { Loading } from './components/ui/primitives'

import { usePermissions } from './hooks/useAuth'

function AppShell() {
  const { canWrite } = usePermissions()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {!canWrite && (
        <div className="shrink-0 border-b border-[var(--color-indigo)]/20 bg-[var(--color-indigo-soft)]/60 px-4 py-2 text-center text-[12.5px] text-[var(--color-indigo-deep)]">
          当前为只读账号，无法入库、修改或删除数据
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/collections" replace />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:name" element={<Navigate to="points" replace />} />
          <Route path="/collections/:name/:tab" element={<CollectionDetailPage />} />
          <Route path="*" element={<Navigate to="/collections" replace />} />
        </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const auth = useAuthOptional()

  if (!auth || auth.loading) {
    return (
      <div className="grid h-full place-items-center bg-paper">
        <Loading label="正在验证登录…" />
      </div>
    )
  }

  if (!auth.user) {
    return <LoginPage />
  }

  return <AppShell />
}
