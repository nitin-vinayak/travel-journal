import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, deleteDoc, doc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import MapboxViz from '../components/MapboxViz'
import styles from './Journal.module.css'

export default function Journal() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [hoveredCoords, setHoveredCoords] = useState({ lat: null, lng: null })
  const hoverTimer = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchEntries() {
      const q = query(collection(db, 'entries'), orderBy('date', 'desc'))
      const snapshot = await getDocs(q)
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      setLoading(false)
    }
    fetchEntries()
  }, [])

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
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
    <div className={styles.page}>
      <div className={styles.layout}>
        <main className={styles.feedCol}>
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
                      setHoveredCoords({ lat: entry.lat ?? null, lng: entry.lng ?? null })
                    }, 400)
                  }}
                  onMouseLeave={() => {
                    clearTimeout(hoverTimer.current)
                    hoverTimer.current = setTimeout(() => {
                      setHoveredCoords({ lat: null, lng: null })
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
        </main>

        <div className={styles.mapCol}>
          <MapboxViz lat={hoveredCoords.lat} lng={hoveredCoords.lng} />
        </div>

      </div>
    </div>
  )
}
