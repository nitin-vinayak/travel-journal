import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Help.module.css'

export default function Help() {
  const navigate = useNavigate()
  const { username } = useAuth()

  return (
    <main className={styles.helpCol}>
      <div className={styles.headerActions}>
        <button onClick={() => navigate(username ? `/${username}` : '/login')} className={styles.navBtn}>Back</button>
      </div>
      <div className={styles.scrollable}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>New Entry</h2>
          <p className={styles.sectionText}>Tap <strong>New Entry</strong> to start writing. Each entry has a title, date, and location. You can write notes using our rich text editor, which supports headers, bold, italic, and more.</p>
          <p className={styles.sectionText}>Attach photos and videos to your entry. Assign it to a collection to keep your journal organised.</p>
          <p className={styles.sectionText}>You can also tag other users in your entries.</p>
          <p className={styles.sectionText}>Mark an entry as private to hide it from your public journal. Private entries will only be visible to you and users tagged in it.</p>
          <p className={styles.sectionText}>When you're done, publish it to your journal or save it as a draft to finish later.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Entry Detail</h2>
          <p className={styles.sectionText}>Tap on any entry title to open it. Here you can read your full notes, view attached photos and videos, and see the entry's location on the map.</p>
          <p className={styles.sectionText}>If you own the entry, you can edit or delete it from this view.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Search</h2>
          <p className={styles.sectionText}>Use the search bar at the top of your journal to find entries by title, location or date.</p>
          <p className={styles.sectionText}>Type <strong>@</strong> followed by a username to search for other users and visit their public journal.</p>
          <p className={styles.sectionText}>Search also works when browsing drafts, collections and other users' public journals.</p>
          <p className={styles.sectionText}>Press <strong>Tab</strong> to jump straight to the search bar.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Edit Mode</h2>
          <p className={styles.sectionText}>Tap <strong>Edit</strong> to enter edit mode. Select entries to delete them from your journal. Tap <strong>Confirm Delete</strong> to permanently remove the selected entries.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Drafts</h2>
          <p className={styles.sectionText}>When writing an entry, you can save it as a draft to finish later. Drafts are only visible to you and won't appear on your public journal.</p>
          <p className={styles.sectionText}>Access your drafts from the <strong>Drafts</strong> button at the top of your journal. Tap a draft to continue editing it.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Collections</h2>
          <p className={styles.sectionText}>Collections let you group related entries together like a trip or a theme. You can assign an entry to a collection when creating or editing it.</p>
          <p className={styles.sectionText}>Access your collections from the <strong>Menu</strong>. Tap a collection to browse its entries. You can rename a collection by tapping its title and remove entries from it using the <strong>Edit</strong> button.</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Calendar</h2>
          <p className={styles.sectionText}>Use the calendar to filter your journal entries by date. Access it from the <strong>Menu</strong> and select a day to see all entries from that date.</p>
          <p className={styles.sectionText}>To clear the filter, tap the <strong>×</strong> next to the date at the top of your journal.</p>
        </section>
      </div>
    </main>
  )
}
