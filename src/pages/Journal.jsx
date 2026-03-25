import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useMapCoords } from '../context/MapCoordsContext'
import styles from './Journal.module.css'

export default function Journal() {
  const { user } = useAuth()
  const { setCoords } = useMapCoords()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const hoverTimer = useRef(null)
  const navigate = useNavigate()

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    async function fetchEntries() {
      const q = query(collection(db, 'entries'), orderBy('date', 'desc'))
      const snapshot = await getDocs(q)
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    fetchEntries()
  }, [user])

  // Reset globe when journal mounts
  useEffect(() => {
    setCoords({ lat: null, lng: null })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setLoginError('Invalid email or password.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleLogout() {
    await signOut(auth)
    setEntries([])
    setEditMode(false)
    setSelected(new Set())
    setCoords({ lat: null, lng: null })
  }

  function formatDate(timestamp) {
    return timestamp.toDate().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleEditMode() {
    setEditMode(v => !v)
    setSelected(new Set())
  }

  async function deleteSelected() {
    if (selected.size === 0) return
    setDeleting(true)
    await Promise.all([...selected].map(id => deleteDoc(doc(db, 'entries', id))))
    setEntries(prev => prev.filter(e => !selected.has(e.id)))
    setSelected(new Set())
    setEditMode(false)
    setDeleting(false)
  }

  return (
    <main className={styles.feedCol}>

      {/* ── Not logged in: show login form ── */}
      {user === null && (
        <div className={styles.loginWrap}>
          <h1 className={styles.loginTitle}>Travel Journal</h1>
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
            {loginError && <p className={styles.loginError}>{loginError}</p>}
            <button type="submit" className={styles.loginBtn} disabled={loginLoading}>
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      )}

      {/* ── Logged in: show entries ── */}
      {user && (
        <>
          <div className={styles.headerActions}>
            {!editMode ? (
              <>
                <button onClick={() => navigate('/admin')} className={styles.navBtn}>New Entry</button>
                <button onClick={toggleEditMode} className={styles.editModeBtn}>Edit</button>
                <button onClick={handleLogout} className={styles.logoutBtn}>Sign out</button>
              </>
            ) : (
              <>
                {selected.size > 0 && (
                  <button onClick={deleteSelected} className={styles.deleteBtn} disabled={deleting}>
                    {deleting ? 'Deleting…' : `Delete ${selected.size}`}
                  </button>
                )}
                <button onClick={toggleEditMode} className={styles.cancelBtn}>Cancel</button>
              </>
            )}
          </div>

          <div className={styles.scrollable}>
            {loading && <p className={styles.loading}>Loading…</p>}

            {!loading && entries.length === 0 && (
              <div className={styles.empty}>
                <p className={styles.emptyText}>No entries yet.</p>
                <button onClick={() => navigate('/admin')} className={styles.emptyBtn}>
                  Write your first entry
                </button>
              </div>
            )}

            {!loading && entries.length > 0 && (
              <div className={styles.feed}>
                {entries.map(entry => (
                  <article
                    key={entry.id}
                    className={`${styles.entry} ${editMode && selected.has(entry.id) ? styles.selected : ''}`}
                    onClick={editMode ? () => toggleSelect(entry.id) : undefined}
                    onMouseEnter={() => {
                      clearTimeout(hoverTimer.current)
                      hoverTimer.current = setTimeout(() => {
                        setCoords({ lat: entry.lat ?? null, lng: entry.lng ?? null })
                      }, 400)
                    }}
                    onMouseLeave={() => {
                      clearTimeout(hoverTimer.current)
                      hoverTimer.current = setTimeout(() => {
                        setCoords({ lat: null, lng: null })
                      }, 150)
                    }}
                  >
                    {editMode && (
                      <div className={styles.checkbox}>
                        <div style={{ width: 10, height: 10, background: selected.has(entry.id) ? '#000' : 'transparent' }} />
                      </div>
                    )}
                    <div className={styles.meta}>
                      <span className={styles.date}>{formatDate(entry.date)}</span>
                      {entry.locationName && (
                        <span className={styles.location}>{entry.locationName}</span>
                      )}
                    </div>
                    <h2
                      className={styles.title}
                      onClick={!editMode ? () => navigate(`/entry/${entry.id}`) : undefined}
                    >
                      {entry.title}
                    </h2>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  )
}
