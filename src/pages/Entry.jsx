import { useEffect, useState } from 'react'
import { doc, getDoc, deleteDoc } from 'firebase/firestore'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../firebase/config'
import { useMapCoords } from '../context/MapCoordsContext'
import styles from './Entry.module.css'

export default function Entry() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setCoords } = useMapCoords()
  const [entry, setEntry] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
      if (e.key === 'ArrowRight') setLightbox(i => Math.min(i + 1, entry.photos.length - 1))
      if (e.key === 'ArrowLeft')  setLightbox(i => Math.max(i - 1, 0))
      if (e.key === 'Escape')     setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, entry])

  async function handleDelete() {
    await deleteDoc(doc(db, 'entries', id))
    navigate('/journal')
  }

  function formatDate(timestamp) {
    return timestamp.toDate().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  if (loading) return <div className={styles.loading}>Loading…</div>
  if (!entry)  return <div className={styles.loading}>Entry not found.</div>

  const photos = entry.photos ?? []

  return (
    <main className={styles.entryCol}>

      {/* Fixed action buttons */}
      <div className={styles.fixedActions}>
        <button onClick={() => navigate('/journal')} className={styles.backBtn}>Journal</button>
        <button onClick={() => navigate(`/admin/edit/${id}`)} className={styles.editBtn}>Edit</button>
        {confirmDelete ? (
          <>
            <button onClick={handleDelete} className={styles.deleteConfirmBtn}>Delete</button>
            <button onClick={() => setConfirmDelete(false)} className={styles.cancelBtn}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={styles.deleteBtn}>Delete</button>
        )}
      </div>

      {/* Scrollable content */}
      <div className={styles.scrollable}>
        <div className={styles.meta}>
          <span className={styles.date}>{formatDate(entry.date)}</span>
          {entry.locationName && <span className={styles.location}>{entry.locationName}</span>}
        </div>

        <h1 className={styles.title}>{entry.title}</h1>

        {entry.notes && (
          <div className={styles.notes}>
            {entry.notes.split('\n').map((para, i) =>
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            )}
          </div>
        )}

        {photos.length > 0 && (
          <div className={styles.photos}>
            {photos.map((url, i) => (
              <div key={i} className={styles.imgBlock} onClick={() => setLightbox(i)}>
                <img src={url} alt="" className={styles.img} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <button className={`${styles.lbNav} ${styles.lbPrev}`}
            onClick={e => { e.stopPropagation(); setLightbox(i => Math.max(i - 1, 0)) }}
            disabled={lightbox === 0}>‹</button>
          <img src={photos[lightbox]} alt="" className={styles.lbImg} onClick={e => e.stopPropagation()} />
          <button className={`${styles.lbNav} ${styles.lbNext}`}
            onClick={e => { e.stopPropagation(); setLightbox(i => Math.min(i + 1, photos.length - 1)) }}
            disabled={lightbox === photos.length - 1}>›</button>
          <button className={styles.lbClose} onClick={() => setLightbox(null)}>×</button>
          <span className={styles.lbCounter}>{lightbox + 1} / {photos.length}</span>
        </div>
      )}
    </main>
  )
}
