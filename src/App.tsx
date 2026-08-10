import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { HomePage } from './pages/HomePage'
import { CatalogPage } from './pages/CatalogPage'
import { CoursePage } from './pages/CoursePage'
import { LearnPage } from './pages/LearnPage'
import { AuthPage } from './pages/AuthPage'
import { AdminPage } from './pages/AdminPage'
import { MyPage } from './pages/MyPage'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<CatalogPage />} />
          <Route path="/course/:id" element={<CoursePage />} />
          <Route path="/learn/:chapterKey" element={<LearnPage />} />
          <Route path="/my" element={<MyPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
