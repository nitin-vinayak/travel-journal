import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { uploadImage } from '../utils/uploadImage'
import { uploadVideo } from '../utils/uploadVideo'
import { loadGoogleMaps } from '../utils/loadGoogleMaps'
import { useMapCoords } from '../context/MapCoordsContext'
import { useAuth } from '../context/AuthContext'
import RichTextEditor from '../components/RichTextEditor'
import styles from './Admin.module.css'

const EMPTY_FORM = { title: '', date: '', locationName: '', notes: '', collection: '' }

// Each mediaItem: { src, type: 'image'|'video', saved: bool, file?: File }

export default function Admin() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const location = useLocation()
  const fromEntry = location.state?.from === 'entry'
  const fromCollection = location.state?.collection ?? null
  const { setCoords } = useMapCoords()
  const { username } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY_FORM)
  const [mediaItems, setMediaItems] = useState([])
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [isDraft, setIsDraft] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [error, setError] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [locationCoords, setLocationCoords] = useState({ lat: null, lng: null })
  const [existingCollections, setExistingCollections] = useState([])
  const [collectionSuggestions, setCollectionSuggestions] = useState([])
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState([])
  const debounceRef = useRef(null)
  const tagDebounceRef = useRef(null)
  const fileInputRef = useRef()
  const dragIndexRef = useRef(null)

  useEffect(() => {
    if (username === null) navigate('/setup')
  }, [username])

  useEffect(() => {
    if (!isEdit) setCoords({ lat: null, lng: null })
    async function fetchCollections() {
      if (!auth.currentUser) return
      const snap = await getDocs(query(collection(db, 'entries'), where('uid', '==', auth.currentUser.uid)))
      const cols = [...new Set(snap.docs.map(d => d.data().collection).filter(Boolean))]
      setExistingCollections(cols)
    }
    fetchCollections()
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
          collection: data.collection ?? '',
        })
        // Support both new media array and legacy photos/videos arrays
        const saved = data.media
          ? data.media.map(m => ({ src: m.url, type: m.type, saved: true }))
          : [
              ...(data.photos ?? []).map(url => ({ src: url, type: 'image', saved: true })),
              ...(data.videos ?? []).map(url => ({ src: url, type: 'video', saved: true })),
            ]
        setMediaItems(saved)
        setIsDraft(data.draft === true)
        setIsPrivate(data.private === true)
        setTags(data.tags ?? [])
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
    if (e.target.name === 'collection') {
      const val = e.target.value.trim().toLowerCase()
      setCollectionSuggestions(val ? existingCollections.filter(c => c.toLowerCase().includes(val) && c.toLowerCase() !== val) : [])
    }
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

  useEffect(() => () => { clearTimeout(debounceRef.current); clearTimeout(tagDebounceRef.current) }, [])

  function handleTagInput(e) {
    const val = e.target.value
    setTagInput(val)
    clearTimeout(tagDebounceRef.current)
    const prefix = val.replace(/^@/, '').toLowerCase().trim()
    if (!prefix) { setTagSuggestions([]); return }
    tagDebounceRef.current = setTimeout(async () => {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('username', '>=', prefix),
        where('username', '<=', prefix + '\uf8ff'),
      ))
      setTagSuggestions(snap.docs
        .filter(d => d.id !== auth.currentUser?.uid && !tags.some(t => t.uid === d.id))
        .map(d => ({ uid: d.id, username: d.data().username }))
      )
    }, 300)
  }

  function selectTag(tag) {
    setTags(prev => [...prev, tag])
    setTagInput('')
    setTagSuggestions([])
  }

  function removeTag(uid) {
    setTags(prev => prev.filter(t => t.uid !== uid))
  }

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
        collection: form.collection.trim() || null,
        media,
        draft: false,
        private: isPrivate,
        tags,
      }
      if (isEdit) {
        await updateDoc(doc(db, 'entries', id), entryData)
        navigate(`/${username}`, isDraft ? undefined : fromCollection ? { state: { collection: fromCollection } } : undefined)
      } else {
        await addDoc(collection(db, 'entries'), { ...entryData, createdAt: Timestamp.now(), uid: auth.currentUser.uid })
        mediaItems.filter(i => !i.saved).forEach(i => URL.revokeObjectURL(i.src))
        navigate(`/${username}`)
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDraft() {
    setError('')
    setSavingDraft(true)
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
        date: form.date ? Timestamp.fromDate(new Date(form.date)) : Timestamp.now(),
        locationName: form.locationName,
        lat: locationCoords.lat,
        lng: locationCoords.lng,
        notes: form.notes,
        collection: form.collection.trim() || null,
        media,
        draft: true,
        private: isPrivate,
        tags,
      }
      if (isEdit) {
        await updateDoc(doc(db, 'entries', id), entryData)
      } else {
        await addDoc(collection(db, 'entries'), { ...entryData, createdAt: Timestamp.now(), uid: auth.currentUser.uid })
        mediaItems.filter(i => !i.saved).forEach(i => URL.revokeObjectURL(i.src))
      }
      navigate(`/${username}`, isEdit && isDraft ? { state: { drafts: true } } : undefined)
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSavingDraft(false)
    }
  }

  async function handleDeleteDraft() {
    await deleteDoc(doc(db, 'entries', id))
    const remaining = await getDocs(query(
      collection(db, 'entries'),
      where('uid', '==', auth.currentUser.uid),
      where('draft', '==', true)
    ))
    navigate(`/${username}`, remaining.size > 0 ? { state: { drafts: true } } : undefined)
  }

  async function handleLogout() {
    await signOut(auth)
    navigate('/login')
  }

  if (loading) return <div className={styles.loadingPage}>Loading…</div>

  return (
    <main className={styles.formCol}>
      <div className={styles.headerActions}>
        <div className={styles.headerLeft}>
          <button onClick={() => fromEntry ? navigate(`/${username}/entry/${id}`, fromCollection ? { state: { collection: fromCollection } } : undefined) : navigate(`/${username}`, isDraft ? { state: { drafts: true } } : undefined)} className={styles.navBtn}>Back</button>
        </div>
        <div className={styles.headerRight}>
          {isEdit && isDraft
            ? <button onClick={handleDeleteDraft} className={styles.logoutBtn}>Delete</button>
            : <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
          }
        </div>
      </div>

      <div className={styles.scrollable}>
      <h2 className={styles.heading}>{isEdit ? (isDraft ? 'Edit Draft' : 'Edit Entry') : 'New Entry'}</h2>

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
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Notes</label>
          <RichTextEditor
            initialContent={form.notes}
            onChange={v => setForm(prev => ({ ...prev, notes: v }))}
          />
        </div>

        <div className={styles.field} style={{ position: 'relative' }}>
          <label className={styles.label}>Collection <span className={styles.optional}>(optional)</span></label>
          <input
            name="collection"
            value={form.collection}
            onChange={handleChange}
            onBlur={() => setTimeout(() => setCollectionSuggestions([]), 200)}
            className={styles.input}
            placeholder="e.g. Japan 2025, Weekend Hikes…"
            autoComplete="off"
          />
          {collectionSuggestions.length > 0 && (
            <ul className={styles.suggestions}>
              {collectionSuggestions.map((c, i) => (
                <li key={i} className={styles.suggestion} onMouseDown={() => { setForm(prev => ({ ...prev, collection: c })); setCollectionSuggestions([]) }}>
                  {c}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.field} style={{ position: 'relative' }}>
          <label className={styles.label}>People <span className={styles.optional}>(optional)</span></label>
          {tags.length > 0 && (
            <div className={styles.tagChips}>
              {tags.map(t => (
                <span key={t.uid} className={styles.tagChip}>
                  @{t.username}
                  <button type="button" className={styles.tagChipRemove} onClick={() => removeTag(t.uid)}>×</button>
                </span>
              ))}
            </div>
          )}
          <input
            value={tagInput}
            onChange={handleTagInput}
            onBlur={() => setTimeout(() => setTagSuggestions([]), 200)}
            className={styles.input}
            placeholder="Search by username…"
            autoComplete="off"
          />
          {tagSuggestions.length > 0 && (
            <ul className={styles.suggestions}>
              {tagSuggestions.map(t => (
                <li key={t.uid} className={styles.suggestion} onMouseDown={() => selectTag(t)}>
                  @{t.username}
                </li>
              ))}
            </ul>
          )}
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
          <button type="submit" className={styles.submitBtn} disabled={saving || savingDraft}>
            {saving ? 'Saving…' : isEdit && !isDraft ? 'Save Changes' : 'Publish'}
          </button>
          <button type="button" className={styles.draftBtn} disabled={saving || savingDraft} onClick={handleSaveDraft}>
            {savingDraft ? 'Saving…' : isEdit && !isDraft ? 'Move to Drafts' : 'Save Draft'}
          </button>
          <button type="button" className={`${styles.privateBtn} ${isPrivate ? styles.privateBtnActive : ''}`} onClick={() => setIsPrivate(v => !v)}>
            Private
          </button>
        </div>
      </form>
      </div>
    </main>
  )
}
