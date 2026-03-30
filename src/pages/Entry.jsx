import { useEffect, useState } from 'react'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useMapCoords } from '../context/MapCoordsContext'
import ReactMarkdown from 'react-markdown'
import styles from './Entry.module.css'

export default function Entry() {
  const { username, id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { setCoords } = useMapCoords()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isOwner = user && entry && user.uid === entry.uid

  useEffect(() => {
    async function fetchEntry() {
      const snap = await getDoc(doc(db, 'entries', id))
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setEntry(data)
        setCoords({ lat: data.lat ?? null, lng: data.lng ?? null })
      }
      setLoading(false)
    }
    fetchEntry()
  }, [id])

  useEffect(() => {
    function onKey(e) {
      if (lightbox === null) return
      if (e.key === 'ArrowRight') setLightbox(i => Math.min(i + 1, lbPhotos.length - 1))
      if (e.key === 'ArrowLeft')  setLightbox(i => Math.max(i - 1, 0))
      if (e.key === 'Escape')     setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, entry])

  const backState = location.state?.collection ? { state: { collection: location.state.collection } } : undefined

  async function handleDelete() {
    await deleteDoc(doc(db, 'entries', id))
    navigate(`/${username}`, backState)
  }

  function formatDate(timestamp) {
    return timestamp.toDate().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  const isTagged = (entry?.tags ?? []).some(t => t.uid === user?.uid)

  if (loading) return <div className={styles.loading}>Loading…</div>
  if (!entry)  return <div className={styles.loading}>Entry not found.</div>
  if (entry.private && !isOwner && !isTagged) return <div className={styles.loading}>Entry not found.</div>

  const media = entry.media ?? [
    ...(entry.photos ?? []).map(url => ({ url, type: 'image' })),
    ...(entry.videos ?? []).map(url => ({ url, type: 'video' })),
  ]

  const lbPhotos = media.filter(m => m.type === 'image').map(m => m.url)

  return (
    <main className={styles.entryCol}>

      <div className={styles.fixedActions}>
        <div className={styles.headerLeft}>
          <button onClick={() => navigate(`/${username}`, backState)} className={styles.backBtn}>Back</button>
        </div>
        <div className={styles.headerRight}>
          {isOwner && (
            <>
              {confirmDelete ? (
                <>
                  <button onClick={handleDelete} className={styles.deleteConfirmBtn}>Confirm Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className={styles.cancelBtn}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => setConfirmDelete(true)} className={styles.deleteBtn}>Delete</button>
                  <button onClick={() => navigate(`/admin/edit/${id}`, { state: { from: 'entry', collection: location.state?.collection ?? null } })} className={styles.editBtn}>Edit</button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className={styles.scrollable}>
        <div className={styles.meta}>
          <span className={styles.date}>{formatDate(entry.date)}</span>
          {entry.locationName && <span className={styles.location}>{entry.locationName}</span>}
        </div>

        <h1 className={styles.title}>{entry.title}</h1>

        {entry.tags?.length > 0 && (
          <p className={styles.taggedUsers}>
            with {entry.tags.map((t, i) => (
              <span key={t.uid}>
                <Link to={`/${t.username}`} className={styles.tagLink}>@{t.username}</Link>
                {i < entry.tags.length - 1 && ', '}
              </span>
            ))}
          </p>
        )}

        {entry.notes && (
          <div className={styles.notes}>
            <ReactMarkdown>{entry.notes}</ReactMarkdown>
          </div>
        )}

        {media.length > 0 && (
          <div className={styles.photos}>
            {media.map((item, i) => {
              if (item.type === 'video') {
                return (
                  <div key={i} className={styles.imgBlock}>
                    <video src={item.url} className={styles.img} controls />
                  </div>
                )
              }
              const lbIndex = lbPhotos.indexOf(item.url)
              return (
                <div key={i} className={styles.imgBlock} onClick={() => setLightbox(lbIndex)}>
                  <img src={item.url} alt="" className={styles.img} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {lightbox !== null && (
        <div className={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <button className={`${styles.lbNav} ${styles.lbPrev}`}
            onClick={e => { e.stopPropagation(); setLightbox(i => Math.max(i - 1, 0)) }}
            disabled={lightbox === 0}>‹</button>
          <img src={lbPhotos[lightbox]} alt="" className={styles.lbImg} onClick={e => e.stopPropagation()} />
          <button className={`${styles.lbNav} ${styles.lbNext}`}
            onClick={e => { e.stopPropagation(); setLightbox(i => Math.min(i + 1, lbPhotos.length - 1)) }}
            disabled={lightbox === lbPhotos.length - 1}>›</button>
          <button className={styles.lbClose} onClick={() => setLightbox(null)}>×</button>
          <span className={styles.lbCounter}>{lightbox + 1} / {lbPhotos.length}</span>
        </div>
      )}
    </main>
  )
}
