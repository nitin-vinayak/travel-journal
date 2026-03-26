import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, where, deleteDoc, doc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useMapCoords } from '../context/MapCoordsContext'
import styles from './Journal.module.css'

export default function Journal() {
  const { username: profileUsername } = useParams()
  const { user, username: myUsername } = useAuth()
  const { setCoords } = useMapCoords()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [profileUid, setProfileUid] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const hoverTimer = useRef(null)
  const navigate = useNavigate()

  const isOwner = user && profileUid && user.uid === profileUid

  useEffect(() => {
    setCoords({ lat: null, lng: null })
    setLoading(true)
    setNotFound(false)
    setProfileUid(null)
    setEntries([])
    async function fetchEntries() {
      const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', profileUsername)))
      if (userSnap.empty) { setNotFound(true); setLoading(false); return }
      const uid = userSnap.docs[0].id
      setProfileUid(uid)
      const q = query(collection(db, 'entries'), where('uid', '==', uid), orderBy('date', 'desc'))
      const snapshot = await getDocs(q)
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    fetchEntries()
  }, [profileUsername])

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

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  if (loading) return <main className={styles.feedCol} />

  if (notFound) return (
    <main className={styles.feedCol}>
      <div className={styles.headerActions}>
        <span className={styles.navBtn}>Journal not found.</span>
      </div>
    </main>
  )

  return (
    <main className={styles.feedCol}>
      <div className={styles.loggedIn}>
        <div className={styles.headerActions}>
          {isOwner ? (
            !editMode ? (
              <>
                <button onClick={() => navigate('/admin')} className={styles.navBtn}>New Entry</button>
                <button onClick={toggleEditMode} className={styles.editModeBtn}>Edit</button>
                <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
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
            )
          ) : (
            <>
              <span className={styles.logo}>{profileUsername}</span>
              {user
                ? (myUsername && <button onClick={() => navigate(`/${myUsername}`)} className={styles.navBtn}>My Journal</button>)
                : <button onClick={() => navigate('/login')} className={styles.navBtn}>Login</button>
              }
            </>
          )}
        </div>

        <div className={styles.scrollable}>
          {entries.length > 0 && (
            <div className={styles.feed}>
              {entries.map(entry => (
                <article
                  key={entry.id}
                  className={`${styles.entry} ${editMode ? styles.editMode : ''} ${editMode && selected.has(entry.id) ? styles.selected : ''}`}
                  onClick={editMode ? () => toggleSelect(entry.id) : undefined}
                >
                  <div className={styles.timeline}>
                    <div className={styles.node} />
                  </div>
                  <div className={styles.entryContent}>
                    {entry.locationName && (
                      <span className={styles.location}>{entry.locationName}</span>
                    )}
                    <h2
                      className={styles.title}
                      onClick={!editMode ? () => navigate(`/${profileUsername}/entry/${entry.id}`) : undefined}
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
                      {entry.title}
                    </h2>
                    <span className={styles.date}>{formatDate(entry.date)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
