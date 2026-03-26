import { useEffect, useState } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import styles from './Journal.module.css'

export default function Login() {
  const { user, username } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (user && username === null) navigate('/setup')
    if (user && username) navigate(`/${username}`)
  }, [user, username])

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
        try {
          await createUserWithEmailAndPassword(auth, email, password)
        } catch (createErr) {
          setError(createErr.code === 'auth/weak-password'
            ? 'Password must be at least 6 characters.'
            : 'Invalid email or password.')
        }
      } else {
        setError('Invalid email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className={styles.feedCol}>
      <div className={styles.loginWrap}>
        <h1 className={styles.loginTitle}>Field Notes</h1>
        <p className={styles.loginSub}>Sign in to continue</p>
        <form onSubmit={handleLogin} className={styles.loginForm}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={styles.loginInput}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>
          <div className={styles.loginField}>
            <label className={styles.loginLabel}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={styles.loginInput}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className={styles.loginError}>{error}</p>}
          <button type="submit" className={styles.loginBtn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
