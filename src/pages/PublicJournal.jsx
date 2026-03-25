import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useMapCoords } from '../context/MapCoordsContext'
import styles from './Journal.module.css'

export default function PublicJournal() {
  const { username } = useParams()
  const { user } = useAuth()
  const { setCoords } = useMapCoords()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const hoverTimer = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    setCoords({ lat: null, lng: null })
    async function fetchEntries() {
      // Look up uid from username
      const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', username)))
      if (userSnap.empty) { setNotFound(true); setLoading(false); return }
      const uid = userSnap.docs[0].id
      const q = query(collection(db, 'entries'), where('uid', '==', uid), orderBy('date', 'desc'))
      const snapshot = await getDocs(q)
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    fetchEntries()
  }, [username])

  function formatDate(timestamp) {
    return timestamp.toDate().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }

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
          <span className={styles.logo}>{username}</span>
          {user && (
            <button onClick={() => navigate('/journal')} className={styles.navBtn}>Admin</button>
          )}
        </div>

        <div className={styles.scrollable}>
          {loading && <div className={styles.loading}>Loading…</div>}


          {entries.length > 0 && (
            <div className={styles.feed}>
              {entries.map(entry => (
                <article
                  key={entry.id}
                  className={styles.entry}
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
                  <div className={styles.timeline}>
                    <div className={styles.node} />
                  </div>
                  <div className={styles.entryContent}>
                    {entry.locationName && (
                      <span className={styles.location}>{entry.locationName}</span>
                    )}
                    <h2
                      className={styles.title}
                      onClick={() => navigate(`/u/${username}/entry/${entry.id}`)}
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
