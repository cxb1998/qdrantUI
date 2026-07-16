import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { CollectionsPage } from './pages/CollectionsPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'

export default function App() {
  return (
    <div className="flex h-full overflow-hidden">
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
  )
}
