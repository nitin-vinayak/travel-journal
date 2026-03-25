import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import MapLayout from './layouts/MapLayout'
import Journal from './pages/Journal'
import Admin from './pages/Admin'
import Entry from './pages/Entry'
import PublicJournal from './pages/PublicJournal'
import PublicEntry from './pages/PublicEntry'
import SetUsername from './pages/SetUsername'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/journal" replace />} />
          <Route path="/login" element={<Navigate to="/journal" replace />} />

          {/* Routes that share the persistent globe layout */}
          <Route element={<MapLayout />}>
            {/* Username setup */}
            <Route path="/setup" element={
              <ProtectedRoute><SetUsername /></ProtectedRoute>
            } />

            {/* Public read-only routes */}
            <Route path="/u/:username" element={<PublicJournal />} />
            <Route path="/u/:username/entry/:id" element={<PublicEntry />} />

            {/* Private admin routes */}
            <Route path="/journal" element={<Journal />} />
            <Route path="/admin" element={
              <ProtectedRoute><Admin /></ProtectedRoute>
            } />
            <Route path="/admin/edit/:id" element={
              <ProtectedRoute><Admin /></ProtectedRoute>
            } />
            <Route path="/admin/entry/:id" element={
              <ProtectedRoute><Entry /></ProtectedRoute>
            } />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
