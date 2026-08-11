import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'

const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const CatalogPage = lazy(() => import('./pages/CatalogPage').then(m => ({ default: m.CatalogPage })))
const CoursePage = lazy(() => import('./pages/CoursePage').then(m => ({ default: m.CoursePage })))
const LearnPage = lazy(() => import('./pages/LearnPage').then(m => ({ default: m.LearnPage })))
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))
const MyPage = lazy(() => import('./pages/MyPage').then(m => ({ default: m.MyPage })))
const CertificatePage = lazy(() => import('./pages/CertificatePage').then(m => ({ default: m.CertificatePage })))

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="route-loading" role="status">頁面載入中…</div>}><Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<CatalogPage />} />
          <Route path="/course/:id" element={<CoursePage />} />
          <Route path="/learn/:chapterKey" element={<LearnPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/certificate/:code" element={<CertificatePage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
