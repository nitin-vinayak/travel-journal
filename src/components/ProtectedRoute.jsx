import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user } = useAuth()

  if (user === undefined) {
    // Still checking auth state — don't flash the login page
    return null
  }

  if (!user) {
    return <Navigate to="/journal" replace />
  }

  return children
}
