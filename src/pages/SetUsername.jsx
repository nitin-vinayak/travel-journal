import { useState } from 'react'
import { doc, setDoc, getDocs, collection, query, where, Timestamp } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import styles from './Journal.module.css'

export default function SetUsername() {
  const { setUsername } = useAuth()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const valid = /^[a-z0-9_-]{3,20}$/.test(value)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    setError('')
    try {
      const taken = await getDocs(query(collection(db, 'users'), where('username', '==', value)))
      if (!taken.empty) {
        setError('Username already taken.')
        setSaving(false)
        return
      }
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        username: value,
        createdAt: Timestamp.now(),
      })
      setUsername(value)
      navigate(`/${value}`)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleBack() {
    await signOut(auth)
    navigate('/login')
  }

  return (
    <main className={styles.feedCol}>
      <div className={styles.loginWrap}>
        <h1 className={styles.loginTitle}>Pick a username</h1>
        <p className={styles.loginSub}>This will be your public journal URL.</p>
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel}>Username</label>
            <input
              className={styles.loginInput}
              value={value}
              onChange={e => { setValue(e.target.value.toLowerCase()); setError('') }}
              placeholder="yourname"
              autoFocus
              spellCheck={false}
            />
          </div>
          {error && <p className={styles.loginError}>{error}</p>}
          <button type="submit" className={styles.loginBtn} disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Continue'}
          </button>
          <button type="button" onClick={handleBack} className={styles.loginBackBtn}>Back</button>
        </form>
      </div>
    </main>
  )
}
