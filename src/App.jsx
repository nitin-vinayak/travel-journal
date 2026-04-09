import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import MapLayout from './layouts/MapLayout'
import Journal from './pages/Journal'
import Admin from './pages/Admin'
import Entry from './pages/Entry'
import Login from './pages/Login'
import SetUsername from './pages/SetUsername'
import Help from './pages/Help'

function RootRedirect() {
  const { user, username } = useAuth()
  if (user === undefined || (user && username === undefined)) return null
  if (user && username) return <Navigate to={`/${username}`} replace />
  if (user && username === null) return <Navigate to="/setup" replace />
  return <Navigate to="/login" replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

          <Route element={<MapLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={
              <ProtectedRoute><SetUsername /></ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute><Admin /></ProtectedRoute>
            } />
            <Route path="/admin/edit/:id" element={
              <ProtectedRoute><Admin /></ProtectedRoute>
            } />
            <Route path="/help" element={<Help />} />
            <Route path="/:username" element={<Journal />} />
            <Route path="/:username/entry/:id" element={<Entry />} />
          </Route>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
