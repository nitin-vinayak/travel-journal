import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined)       // undefined = loading
  const [username, setUsername] = useState(undefined) // undefined = loading, null = no username

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser ?? null)
      if (firebaseUser) {
        setUsername(undefined) // reset to loading while we fetch
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        setUsername(snap.exists() ? snap.data().username : null)
      } else {
        setUsername(null)
      }
    })
    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, username, setUsername }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
