import { useEffect, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, where, deleteDoc, doc, writeBatch, updateDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { db, auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useMapCoords } from '../context/MapCoordsContext'
import styles from './Journal.module.css'
import CalendarModal from '../components/CalendarModal'

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
  const [collectionView, setCollectionView] = useState(location.state?.collection ?? null)
  const [collectionEditMode, setCollectionEditMode] = useState(false)
  const [collectionNameInput, setCollectionNameInput] = useState(location.state?.collection ?? '')
  const [collectionNameEditing, setCollectionNameEditing] = useState(false)
  const [collectionSelected, setCollectionSelected] = useState(new Set())
  const [savingCollection, setSavingCollection] = useState(false)
  const [confirmCollectionDelete, setConfirmCollectionDelete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [profileUid, setProfileUid] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarClosing, setCalendarClosing] = useState(false)
  const [dateFilter, setDateFilter] = useState(null)
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
    setCollectionView(location.state?.collection ?? null)
    setCollectionNameInput(location.state?.collection ?? '')
    setCollectionEditMode(false)
    setCollectionNameEditing(false)
    setCollectionSelected(new Set())
    setSearch('')
    async function fetchEntries() {
      const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', profileUsername)))
      if (userSnap.empty) { setNotFound(true); setLoading(false); return }
      const uid = userSnap.docs[0].id
      setProfileUid(uid)
      const q = query(collection(db, 'entries'), where('uid', '==', uid), orderBy('date', 'desc'))
      const snapshot = await getDocs(q)
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      const myUid = auth.currentUser?.uid
      const ownerViewing = myUid === uid
      setEntries(all.filter(e => !e.draft && (!e.private || ownerViewing || (myUid && (e.tags ?? []).some(t => t.uid === myUid)))))
      setDrafts(all.filter(e => e.draft))
      setLoading(false)
    }
    fetchEntries()
  }, [profileUsername])

  useEffect(() => {
    if (!collectionView || loading) return
    const hasEntries = entries.some(e => e.collection === collectionView)
    if (!hasEntries) {
      setCollectionView(null)
      setCollectionNameInput('')
      setShowCollections(true)
    }
  }, [entries, collectionView, loading])

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
    setConfirmDelete(false)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleEditMode() {
    setEditMode(v => !v)
    setSelected(new Set())
    setConfirmDelete(false)
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

  function openCollectionView(name) {
    setCollectionView(name)
    setCollectionNameInput(name)
    setShowCollections(false)
    setCollectionEditMode(false)
    setCollectionNameEditing(false)
    setCollectionSelected(new Set())
  }

  function closeCollectionView() {
    setCollectionView(null)
    setCollectionEditMode(false)
    setCollectionNameEditing(false)
    setCollectionSelected(new Set())
    setShowCollections(true)
  }

  function toggleCollectionSelect(id) {
    setConfirmCollectionDelete(false)
    setCollectionSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function saveCollectionName() {
    const newName = collectionNameInput.trim()
    setCollectionNameEditing(false)
    if (!newName || newName === collectionView) {
      setCollectionNameInput(collectionView)
      return
    }
    const batch = writeBatch(db)
    entries
      .filter(e => e.collection === collectionView)
      .forEach(e => batch.update(doc(db, 'entries', e.id), { collection: newName }))
    await batch.commit()
    setEntries(prev => prev.map(e => e.collection === collectionView ? { ...e, collection: newName } : e))
    setCollectionView(newName)
    setCollectionNameInput(newName)
  }

  async function removeFromCollection() {
    setSavingCollection(true)
    const batch = writeBatch(db)
    collectionSelected.forEach(id => batch.update(doc(db, 'entries', id), { collection: null }))
    await batch.commit()
    const remaining = entries.filter(e => e.collection === collectionView && !collectionSelected.has(e.id))
    setEntries(prev => prev.map(e => collectionSelected.has(e.id) ? { ...e, collection: null } : e))
    setCollectionEditMode(false)
    setCollectionSelected(new Set())
    setSavingCollection(false)
    if (remaining.length === 0) {
      setCollectionView(null)
      const hasOtherCollections = entries.some(e => e.collection && e.collection !== collectionView && !collectionSelected.has(e.id))
      setShowCollections(hasOtherCollections)
    }
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
                {collectionView ? (
                  <button onClick={closeCollectionView} className={styles.navBtn}>Back</button>
                ) : !editMode && (showDrafts || showCollections
                  ? <button onClick={() => { setShowDrafts(false); setShowCollections(false); setSearch('') }} className={styles.navBtn}>Back</button>
                  : <button onClick={() => navigate('/admin')} className={styles.navBtn}>New Entry</button>
                )}
                {!editMode && !collectionView && drafts.length > 0 && !showDrafts && !showCollections && (
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
                {collectionView ? (
                  collectionEditMode ? (
                    <>
                      {collectionSelected.size > 0 && (
                        confirmCollectionDelete ? (
                          <>
                            <button onClick={removeFromCollection} className={styles.deleteBtn} disabled={savingCollection}>
                              {savingCollection ? 'Removing…' : 'Confirm Remove'}
                            </button>
                            <button onClick={() => setConfirmCollectionDelete(false)} className={styles.cancelBtn}>Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmCollectionDelete(true)} className={styles.deleteBtn}>
                            {`Remove ${collectionSelected.size}`}
                          </button>
                        )
                      )}
                      {!confirmCollectionDelete && (
                        <button onClick={() => { setCollectionEditMode(false); setCollectionSelected(new Set()); setConfirmCollectionDelete(false) }} className={styles.cancelBtn}>Cancel</button>
                      )}
                    </>
                  ) : (
                    <>
                      <button onClick={() => setCollectionEditMode(true)} className={styles.editModeBtn}>Edit</button>
                      <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
                    </>
                  )
                ) : editMode ? (
                  <>
                    {selected.size > 0 && (
                      confirmDelete ? (
                        <>
                          <button onClick={deleteSelected} className={styles.deleteBtn} disabled={deleting}>
                            {deleting ? 'Deleting…' : 'Confirm Delete'}
                          </button>
                          <button onClick={() => setConfirmDelete(false)} className={styles.cancelBtn}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => setConfirmDelete(true)} className={styles.deleteBtn}>
                          {`Delete ${selected.size}`}
                        </button>
                      )
                    )}
                    {!confirmDelete && (
                      <button onClick={toggleEditMode} className={styles.cancelBtn}>Cancel</button>
                    )}
                  </>
                ) : (
                  <>
                    {!showDrafts && !showCollections && (
                      <>
                        <button onClick={() => { setShowCollections(true); setSearch('') }} className={styles.navBtn}>Collections</button>
                        <button onClick={() => setShowCalendar(true)} className={styles.navBtn}>Cal</button>
                      </>
                    )}
                    {!showCollections && <button onClick={toggleEditMode} className={styles.editModeBtn}>Edit</button>}
                    <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className={styles.headerLeft}>
                {(showCollections || collectionView) && (
                  <button onClick={() => { collectionView ? closeCollectionView() : setShowCollections(false); setSearch('') }} className={styles.navBtn}>Back</button>
                )}
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
                {!showCollections && !collectionView && (
                  <>
                    <button onClick={() => { setShowCollections(true); setSearch('') }} className={styles.navBtn}>Collections</button>
                    <button onClick={() => setShowCalendar(true)} className={styles.navBtn}>Cal</button>
                  </>
                )}
                {user
                  ? (myUsername && <button onClick={() => navigate(`/${myUsername}`)} className={styles.navBtn}>My Journal</button>)
                  : <button onClick={() => navigate('/login')} className={styles.navBtn}>Login</button>
                }
              </div>
            </>
          )}
        </div>

        <div className={styles.scrollable}>
          {collectionView ? (
            <div className={styles.feed}>
              {collectionNameEditing
                ? <input
                    className={styles.collectionTitle}
                    value={collectionNameInput}
                    onChange={e => setCollectionNameInput(e.target.value)}
                    onBlur={saveCollectionName}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setCollectionNameInput(collectionView); setCollectionNameEditing(false) } }}
                    autoFocus
                  />
                : <h2 className={`${styles.collectionTitle} ${isOwner ? styles.collectionTitleClickable : ''}`} onClick={() => isOwner && !collectionEditMode && setCollectionNameEditing(true)}>{collectionView}</h2>
              }

              {entries.filter(e => {
                if (e.collection !== collectionView) return false
                if (!search.trim()) return true
                const q = search.toLowerCase()
                return e.title.toLowerCase().includes(q) ||
                  (e.locationName ?? '').toLowerCase().includes(q) ||
                  formatDate(e.date).toLowerCase().includes(q)
              }).map(entry => (
                <article
                  key={entry.id}
                  className={`${styles.entry} ${collectionEditMode ? styles.editMode : ''} ${collectionEditMode && collectionSelected.has(entry.id) ? styles.selected : ''}`}
                  onClick={collectionEditMode ? () => toggleCollectionSelect(entry.id) : undefined}
                >
                  <div className={styles.timeline}><div className={styles.node} /></div>
                  <div className={styles.entryContent}>
                    {entry.locationName && <span className={styles.location}>{entry.locationName}</span>}
                    <h2
                      className={styles.title}
                      onClick={!collectionEditMode ? () => navigate(`/${profileUsername}/entry/${entry.id}`, { state: { collection: collectionView } }) : undefined}
                      onMouseEnter={() => {
                        clearTimeout(hoverTimer.current)
                        hoverTimer.current = setTimeout(() => setCoords({ lat: entry.lat ?? null, lng: entry.lng ?? null }), 400)
                      }}
                      onMouseLeave={() => {
                        clearTimeout(hoverTimer.current)
                        hoverTimer.current = setTimeout(() => setCoords({ lat: null, lng: null }), 150)
                      }}
                    >{entry.title}</h2>
                    <span className={styles.date}>
                      {formatDate(entry.date)}
                      {isOwner && entry.private && <span className={styles.privateLabel}> · Private</span>}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : search.startsWith('@') && !showCollections && !collectionView ? (
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
          ) : showDrafts && !search.startsWith('@') ? (
            <div key="drafts" className={styles.feed}>
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
          ) : showCollections ? (
            <div key="collections" className={styles.feed}>
              {(() => {
                const colMap = {}
                entries.forEach(e => { if (e.collection) colMap[e.collection] = (colMap[e.collection] || 0) + 1 })
                const cols = Object.entries(colMap).filter(([name]) => !search.trim() || name.toLowerCase().includes(search.toLowerCase()))
                return cols.length === 0
                  ? <span className={styles.noResults}>No collections yet</span>
                  : cols.map(([name, count]) => (
                    <div key={name} className={styles.userCard} onClick={() => openCollectionView(name)}>
                      <span className={styles.userCardName}>{name}</span>
                      <span className={styles.collectionCount}>{count} {count === 1 ? 'entry' : 'entries'}</span>
                    </div>
                  ))
              })()}
            </div>
          ) : entries.length > 0 && (() => {
            const filtered = entries.filter(entry => {
              if (activeCollection && entry.collection !== activeCollection) return false
              if (dateFilter) {
                const d = entry.date.toDate()
                if (d.getFullYear() !== dateFilter.getFullYear() ||
                    d.getMonth() !== dateFilter.getMonth() ||
                    d.getDate() !== dateFilter.getDate()) return false
              }
              if (!search.trim()) return true
              const q = search.toLowerCase()
              return entry.title.toLowerCase().includes(q) ||
                (entry.locationName ?? '').toLowerCase().includes(q) ||
                formatDate(entry.date).toLowerCase().includes(q) ||
                (entry.collection ?? '').toLowerCase().includes(q)
            })
            return (
            <div key={`feed-${dateFilter?.getTime() ?? 'all'}`} className={styles.feed}>
              {dateFilter && (
                <div className={styles.activeCollection}>
                  {dateFilter.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  <button className={styles.clearCollection} onClick={() => setDateFilter(null)}>×</button>
                </div>
              )}
              {activeCollection && (
                <div className={styles.activeCollection}>
                  {activeCollection}
                  <button className={styles.clearCollection} onClick={() => setActiveCollection(null)}>×</button>
                </div>
              )}
              <span className={styles.resultCount} style={{ visibility: search.trim() || activeCollection || dateFilter ? 'visible' : 'hidden' }}>
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
                      {isOwner && entry.private && <span className={styles.privateLabel}> · Private</span>}
                    </span>
                  </div>
                </article>
              ))}
            </div>
            )
          })()}
        </div>

      </div>

      {showCalendar && (
        <CalendarModal
          closing={calendarClosing}
          onClose={() => setCalendarClosing(true)}
          onAnimationEnd={() => { setShowCalendar(false); setCalendarClosing(false) }}
          onSelectDate={date => { setDateFilter(date); setCalendarClosing(true) }}
        />
      )}
    </main>
  )
}
