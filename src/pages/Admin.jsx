import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { uploadImage } from '../utils/uploadImage'
import { uploadVideo } from '../utils/uploadVideo'
import { loadGoogleMaps } from '../utils/loadGoogleMaps'
import { useMapCoords } from '../context/MapCoordsContext'
import styles from './Admin.module.css'

const EMPTY_FORM = { title: '', date: '', locationName: '', notes: '' }

// Each mediaItem: { src, type: 'image'|'video', saved: bool, file?: File }

export default function Admin() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { setCoords } = useMapCoords()

  const [form, setForm] = useState(EMPTY_FORM)
  const [mediaItems, setMediaItems] = useState([])
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [locationCoords, setLocationCoords] = useState({ lat: null, lng: null })
  const debounceRef = useRef(null)
  const fileInputRef = useRef()
  const dragIndexRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isEdit) setCoords({ lat: null, lng: null })
  }, [])

  useEffect(() => {
    if (!isEdit) return
    async function load() {
      const snap = await getDoc(doc(db, 'entries', id))
      if (snap.exists()) {
        const data = snap.data()
        setForm({
          title: data.title ?? '',
          date: data.date.toDate().toISOString().split('T')[0],
          locationName: data.locationName ?? '',
          notes: data.notes ?? '',
        })
        // Support both new media array and legacy photos/videos arrays
        const saved = data.media ?? [
          ...(data.photos ?? []).map(url => ({ src: url, type: 'image', saved: true })),
          ...(data.videos ?? []).map(url => ({ src: url, type: 'video', saved: true })),
        ]
        setMediaItems(saved)
        const coords = { lat: data.lat ?? null, lng: data.lng ?? null }
        setLocationCoords(coords)
        setCoords(coords)
      }
      setLoading(false)
    }
    load()
  }, [id, isEdit])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (e.target.name === 'locationName') {
      setLocationCoords({ lat: null, lng: null })
      setCoords({ lat: null, lng: null })
      const value = e.target.value
      clearTimeout(debounceRef.current)
      if (value.length < 3) { setLocationSuggestions([]); return }
      debounceRef.current = setTimeout(async () => {
        await loadGoogleMaps()
        const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: value })
        setLocationSuggestions(suggestions ?? [])
      }, 400)
    }
  }

  async function selectLocation(suggestion) {
    setLocationSuggestions([])
    const prediction = suggestion.placePrediction
    setForm(prev => ({ ...prev, locationName: prediction.text.toString() }))
    const place = prediction.toPlace()
    await place.fetchFields({ fields: ['location'] })
    const coords = { lat: place.location.lat(), lng: place.location.lng() }
    setLocationCoords(coords)
    setCoords(coords)
  }

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  function addFiles(files) {
    const newItems = Array.from(files)
      .filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
      .map(f => ({
        src: URL.createObjectURL(f),
        type: f.type.startsWith('image/') ? 'image' : 'video',
        saved: false,
        file: f,
      }))
    setMediaItems(prev => [...prev, ...newItems])
  }

  function handleFileInput(e) { addFiles(e.target.files); e.target.value = '' }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    // Only handle external file drops (not internal reorder drags)
    if (dragIndexRef.current !== null) return
    addFiles(e.dataTransfer.files)
  }

  function removeItem(index) {
    setMediaItems(prev => {
      const item = prev[index]
      if (!item.saved) URL.revokeObjectURL(item.src)
      return prev.filter((_, i) => i !== index)
    })
  }

  // Drag-to-reorder handlers
  function onItemDragStart(e, index) {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
  }

  function onItemDragEnter(index) {
    if (dragIndexRef.current === null || dragIndexRef.current === index) return
    setMediaItems(prev => {
      const next = [...prev]
      const [item] = next.splice(dragIndexRef.current, 1)
      next.splice(index, 0, item)
      dragIndexRef.current = index
      return next
    })
  }

  function onItemDragEnd() {
    dragIndexRef.current = null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const media = await Promise.all(
        mediaItems.map(async item => {
          if (item.saved) return { url: item.src, type: item.type }
          const url = item.type === 'image'
            ? await uploadImage(item.file)
            : await uploadVideo(item.file)
          return { url, type: item.type }
        })
      )
      const entryData = {
        title: form.title,
        date: Timestamp.fromDate(new Date(form.date)),
        locationName: form.locationName,
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        notes: form.notes,
        media,
      }
      if (isEdit) {
        await updateDoc(doc(db, 'entries', id), entryData)
        navigate(`/entry/${id}`)
      } else {
        await addDoc(collection(db, 'entries'), { ...entryData, createdAt: Timestamp.now() })
        mediaItems.filter(i => !i.saved).forEach(i => URL.revokeObjectURL(i.src))
        navigate('/journal')
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await signOut(auth)
    navigate('/journal')
  }

  if (loading) return <div className={styles.loadingPage}>Loading…</div>

  return (
    <main className={styles.formCol}>
      <div className={styles.headerActions}>
        <button onClick={() => navigate('/journal')} className={styles.navBtn}>Journal</button>
        <button onClick={handleLogout} className={styles.logoutBtn}>Sign out</button>
      </div>

      <h2 className={styles.heading}>{isEdit ? 'Edit Entry' : 'New Entry'}</h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Title</label>
          <input name="title" value={form.title} onChange={handleChange} className={styles.input} placeholder="e.g. First morning in Kyoto" required />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Date</label>
            <input type="date" name="date" value={form.date} onChange={handleChange} className={styles.input} required />
          </div>
          <div className={styles.field} style={{ position: 'relative' }}>
            <label className={styles.label}>Location</label>
            <input
              name="locationName"
              value={form.locationName}
              onChange={handleChange}
              onBlur={() => setTimeout(() => setLocationSuggestions([]), 200)}
              className={styles.input}
              placeholder="e.g. Kyoto, Japan"
              autoComplete="off"
            />
            {locationSuggestions.length > 0 && (
              <ul className={styles.suggestions}>
                {locationSuggestions.map((s, i) => (
                  <li key={i} className={styles.suggestion} onMouseDown={() => selectLocation(s)}>
                    {s.placePrediction.text.toString()}
                  </li>
                ))}
              </ul>
            )}
            {locationCoords.lat && <span className={styles.locationConfirmed}>✓ confirmed</span>}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Notes</label>
          <textarea name="notes" value={form.notes} onChange={handleChange} className={styles.textarea} placeholder="Write about your day…" rows={6} />
        </div>

        {/* Media */}
        <div className={styles.field}>
          <label className={styles.label}>Media</label>
          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileInput} className={styles.hiddenInput} />
          <div
            className={`${styles.dropZone} ${dragging ? styles.dragging : ''}`}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            {mediaItems.length === 0 ? (
              <span className={styles.dropText}>Drop photos or videos here or click to add</span>
            ) : (
              <div className={styles.previewList}>
                {mediaItems.map((item, i) => (
                  <div
                    key={i}
                    className={styles.previewItem}
                    draggable
                    onDragStart={e => { e.stopPropagation(); onItemDragStart(e, i) }}
                    onDragEnter={e => { e.stopPropagation(); onItemDragEnter(i) }}
                    onDragOver={e => e.preventDefault()}
                    onDragEnd={onItemDragEnd}
                    onClick={e => e.stopPropagation()}
                  >
                    {item.type === 'image'
                      ? <img src={item.src} alt="" className={styles.previewImg} />
                      : <video src={item.src} className={styles.previewImg} muted />
                    }
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={e => { e.stopPropagation(); removeItem(i) }}
                    >×</button>
                  </div>
                ))}
                <div className={styles.addMore} onClick={() => fileInputRef.current.click()}>+ Add more</div>
              </div>
            )}
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitBtn} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Entry'}
          </button>
          {isEdit && (
            <button type="button" className={styles.cancelBtn} onClick={() => navigate(`/entry/${id}`)}>Cancel</button>
          )}
        </div>
      </form>
    </main>
  )
}
