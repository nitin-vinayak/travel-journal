import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, where, deleteDoc, doc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useMapCoords } from '../context/MapCoordsContext'
import styles from './Journal.module.css'

export default function Journal() {
  const { username: profileUsername } = useParams()
  const { user, username: myUsername } = useAuth()
  const { setCoords } = useMapCoords()
  const location = useLocation()
  const [entries, setEntries] = useState([])
  const [drafts, setDrafts] = useState([])
  const [showDrafts, setShowDrafts] = useState(!!location.state?.drafts)
  const [showCollections, setShowCollections] = useState(false)
  const [activeCollection, setActiveCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [profileUid, setProfileUid] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [userResults, setUserResults] = useState([])
  const [userSearching, setUserSearching] = useState(false)
  const userSearchTimer = useRef(null)
  const searchRef = useRef(null)
  const hoverTimer = useRef(null)
  const navigate = useNavigate()

  const isOwner = user && profileUid && user.uid === profileUid

  useEffect(() => {
    setCoords({ lat: null, lng: null })
    setLoading(true)
    setNotFound(false)
    setProfileUid(null)
    setEntries([])
    setDrafts([])
    setShowDrafts(!!location.state?.drafts)
    setShowCollections(false)
    setActiveCollection(null)
    setSearch('')
    async function fetchEntries() {
      const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', profileUsername)))
      if (userSnap.empty) { setNotFound(true); setLoading(false); return }
      const uid = userSnap.docs[0].id
      setProfileUid(uid)
      const q = query(collection(db, 'entries'), where('uid', '==', uid), orderBy('date', 'desc'))
      const snapshot = await getDocs(q)
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setEntries(all.filter(e => !e.draft))
      setDrafts(all.filter(e => e.draft))
      setLoading(false)
    }
    fetchEntries()
  }, [profileUsername])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Tab') {
        e.preventDefault()
        if (document.activeElement === searchRef.current) {
          searchRef.current?.blur()
        } else {
          searchRef.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!search.startsWith('@')) { setUserResults([]); return }
    const prefix = search.slice(1).toLowerCase().trim()
    clearTimeout(userSearchTimer.current)
    if (!prefix) { setUserResults([]); setUserSearching(false); return }
    setUserSearching(true)
    userSearchTimer.current = setTimeout(async () => {
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('username', '>=', prefix),
        where('username', '<=', prefix + '\uf8ff'),
      ))
      setUserResults(snap.docs
        .filter(d => d.id !== user?.uid)
        .map(d => ({ uid: d.id, username: d.data().username }))
      )
      setUserSearching(false)
    }, 300)
  }, [search])

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
    setDrafts(prev => {
      const remaining = prev.filter(e => !selected.has(e.id))
      if (remaining.length === 0) setShowDrafts(false)
      return remaining
    })
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
            <>
              <div className={styles.headerLeft}>
                {!editMode && (showDrafts || showCollections
                  ? <button onClick={() => { setShowDrafts(false); setShowCollections(false); setSearch('') }} className={styles.navBtn}>Back</button>
                  : <button onClick={() => navigate('/admin')} className={styles.navBtn}>New Entry</button>
                )}
                {!editMode && drafts.length > 0 && !showDrafts && !showCollections && (
                  <button onClick={() => { setShowDrafts(true); setSearch('') }} className={styles.navBtn}>
                    Drafts ({drafts.length})
                  </button>
                )}
                <input
                  ref={searchRef}
                  className={styles.searchInput}
                  placeholder="Search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.headerRight}>
                {editMode ? (
                  <>
                    {selected.size > 0 && (
                      <button onClick={deleteSelected} className={styles.deleteBtn} disabled={deleting}>
                        {deleting ? 'Deleting…' : `Delete ${selected.size}`}
                      </button>
                    )}
                    <button onClick={toggleEditMode} className={styles.cancelBtn}>Cancel</button>
                  </>
                ) : (
                  <>
                    {!showDrafts && !showCollections && (
                      <button onClick={() => { setShowCollections(true); setActiveCollection(null); setSearch('') }} className={styles.navBtn}>Collections</button>
                    )}
                    <button onClick={toggleEditMode} className={styles.editModeBtn}>Edit</button>
                    <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={styles.headerLeft}>
                <span className={styles.logo}>{profileUsername}</span>
                <input
                  ref={searchRef}
                  className={styles.searchInput}
                  placeholder="Search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className={styles.headerRight}>
                {user
                  ? (myUsername && <button onClick={() => navigate(`/${myUsername}`)} className={styles.navBtn}>My Journal</button>)
                  : <button onClick={() => navigate('/login')} className={styles.navBtn}>Login</button>
                }
              </div>
            </>
          )}
        </div>

        <div className={styles.scrollable}>
          {showDrafts && !search.startsWith('@') ? (
            <div className={styles.feed}>
              {drafts.length === 0 ? (
                <span className={styles.noResults}>No drafts</span>
              ) : drafts.filter(entry => {
                if (!search.trim()) return true
                const q = search.toLowerCase()
                return entry.title.toLowerCase().includes(q) ||
                  (entry.locationName ?? '').toLowerCase().includes(q) ||
                  formatDate(entry.date).toLowerCase().includes(q) ||
                  (entry.collection ?? '').toLowerCase().includes(q)
              }).map(entry => (
                <article
                  key={entry.id}
                  className={`${styles.entry} ${styles.draftEntry} ${editMode ? styles.editMode : ''} ${editMode && selected.has(entry.id) ? styles.selected : ''}`}
                  onClick={editMode ? () => toggleSelect(entry.id) : () => navigate(`/admin/edit/${entry.id}`)}
                >
                  <div className={styles.timeline}>
                    <div className={styles.node} />
                  </div>
                  <div className={styles.entryContent}>
                    {entry.locationName && <span className={styles.location}>{entry.locationName}</span>}
                    <h2
                      className={styles.title}
                      onMouseEnter={() => {
                        if (entry.lat == null || entry.lng == null) return
                        clearTimeout(hoverTimer.current)
                        hoverTimer.current = setTimeout(() => {
                          setCoords({ lat: entry.lat, lng: entry.lng })
                        }, 400)
                      }}
                      onMouseLeave={() => {
                        clearTimeout(hoverTimer.current)
                        hoverTimer.current = setTimeout(() => {
                          setCoords({ lat: null, lng: null })
                        }, 150)
                      }}
                    >{entry.title || <em className={styles.untitled}>Untitled</em>}</h2>
                    <span className={styles.date}>
                      {entry.date ? formatDate(entry.date) : '—'}
                      {entry.collection && <span className={styles.entryCollection}> · {entry.collection}</span>}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : search.startsWith('@') ? (
            <div className={styles.feed}>
              <span className={styles.resultCount} style={{ visibility: !userSearching && userResults.length > 0 ? 'visible' : 'hidden' }}>
                {userResults.length} {userResults.length === 1 ? 'user' : 'users'}
              </span>
              {userResults.map(u => (
                <div key={u.uid} className={styles.userCard} onClick={() => navigate(`/${u.username}`)}>
                  <span className={styles.userCardName}>@{u.username}</span>
                </div>
              ))}
              {!userSearching && search.length > 1 && userResults.length === 0 && (
                <span className={styles.noResults}>No users found</span>
              )}
            </div>
          ) : showCollections ? (
            <div className={styles.feed}>
              {(() => {
                const colMap = {}
                entries.forEach(e => { if (e.collection) colMap[e.collection] = (colMap[e.collection] || 0) + 1 })
                const cols = Object.entries(colMap).filter(([name]) => !search.trim() || name.toLowerCase().includes(search.toLowerCase()))
                return cols.length === 0
                  ? <span className={styles.noResults}>No collections yet</span>
                  : cols.map(([name, count]) => (
                    <div key={name} className={styles.userCard} onClick={() => { setActiveCollection(name); setShowCollections(false); setSearch('') }}>
                      <span className={styles.userCardName}>{name}</span>
                      <span className={styles.collectionCount}>{count} {count === 1 ? 'entry' : 'entries'}</span>
                    </div>
                  ))
              })()}
            </div>
          ) : entries.length > 0 && (() => {
            const filtered = entries.filter(entry => {
              if (activeCollection && entry.collection !== activeCollection) return false
              if (!search.trim()) return true
              const q = search.toLowerCase()
              return entry.title.toLowerCase().includes(q) ||
                (entry.locationName ?? '').toLowerCase().includes(q) ||
                formatDate(entry.date).toLowerCase().includes(q) ||
                (entry.collection ?? '').toLowerCase().includes(q)
            })
            return (
            <div className={styles.feed}>
              {activeCollection && (
                <div className={styles.activeCollection}>
                  {activeCollection}
                  <button className={styles.clearCollection} onClick={() => setActiveCollection(null)}>×</button>
                </div>
              )}
              <span className={styles.resultCount} style={{ visibility: search.trim() || activeCollection ? 'visible' : 'hidden' }}>
                {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
              </span>
              {filtered.map(entry => (
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
                    <span className={styles.date}>
                      {formatDate(entry.date)}
                      {entry.collection && <span className={styles.entryCollection}> · {entry.collection}</span>}
                    </span>
                  </div>
                </article>
              ))}
            </div>
            )
          })()}
        </div>

      </div>
    </main>
  )
}
