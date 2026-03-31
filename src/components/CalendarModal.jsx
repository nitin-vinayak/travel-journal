import { useEffect, useState } from 'react'
import styles from './CalendarModal.module.css'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export default function CalendarModal({ closing, onClose, onAnimationEnd, onSelectDate }) {
  const today = new Date()
  const [display, setDisplay] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [view, setView] = useState('calendar') // 'calendar' | 'monthPicker' | 'yearPicker'
  const [yearPickerReturn, setYearPickerReturn] = useState('calendar')
  const [decadeStart, setDecadeStart] = useState(() => Math.floor(today.getFullYear() / 12) * 12)

  const { year, month } = display

  const firstDay = new Date(year, month, 1)
  const totalDays = new Date(year, month + 1, 0).getDate()
  let startDow = firstDay.getDay()
  startDow = (startDow + 6) % 7

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length < 42) cells.push(null)

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const monthLabel = MONTH_NAMES[month].toUpperCase()
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const yearGrid = Array.from({ length: 12 }, (_, i) => decadeStart + i)

  function prevMonth() {
    setDisplay(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    )
  }

  function nextMonth() {
    setDisplay(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    )
  }

  function selectMonth(m) {
    setDisplay(d => ({ ...d, month: m }))
    setView('calendar')
  }

  function selectYear(y) {
    setDisplay(d => ({ ...d, year: y }))
    setView(yearPickerReturn)
  }

  function openYearPicker(from) {
    setDecadeStart(Math.floor(year / 12) * 12)
    setYearPickerReturn(from)
    setView('yearPicker')
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (view === 'yearPicker') { setView(yearPickerReturn); return }
        if (view === 'monthPicker') { setView('calendar'); return }
        onClose()
      }
      if (view === 'calendar') {
        if (e.key === 'ArrowLeft') prevMonth()
        if (e.key === 'ArrowRight') nextMonth()
      }
      if (view === 'yearPicker') {
        if (e.key === 'ArrowLeft') setDecadeStart(s => s - 12)
        if (e.key === 'ArrowRight') setDecadeStart(s => s + 12)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, view, yearPickerReturn])

  return (
    <div className={`${styles.overlay} ${closing ? styles.overlayClosing : ''}`} onAnimationEnd={closing ? onAnimationEnd : undefined}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          {view === 'calendar' && (
            <>
              <button className={styles.backBtn} onClick={onClose}>Back</button>
              <div className={styles.navGroup}>
                <span className={styles.monthName} onClick={() => setView('monthPicker')}>{monthLabel}</span>
                <span className={styles.yearName} onClick={() => openYearPicker('calendar')}>{year}</span>
              </div>
            </>
          )}

          {view === 'monthPicker' && (
            <>
              <button className={styles.backBtn} onClick={() => setView('calendar')}>Back</button>
              <span
                className={styles.yearName}
                onClick={() => openYearPicker('monthPicker')}
              >
                {year}
              </span>
            </>
          )}

          {view === 'yearPicker' && (
            <>
              <button className={styles.backBtn} onClick={() => setView(yearPickerReturn)}>Back</button>
              <div className={styles.navGroup}>
                <span className={styles.monthName}>{monthLabel}</span>
                <span className={styles.decadeRange}>{decadeStart} – {decadeStart + 11}</span>
              </div>
            </>
          )}
        </div>

        <div className={styles.gridWrap}>
          {view === 'calendar' && (
            <div className={styles.grid}>
              {dayNames.map(d => (
                <div key={d} className={`${styles.cell} ${styles.headCell}`}>
                  <span className={styles.dayName}>{d}</span>
                </div>
              ))}
              {cells.map((day, i) => (
                <div
                  key={i}
                  className={`${styles.cell} ${isCurrentMonth && day === today.getDate() ? styles.today : ''} ${day ? styles.clickable : ''}`}
                  onClick={day ? () => onSelectDate(new Date(year, month, day)) : undefined}
                >
                  {day && (
                    <span className={styles.dayNum}>{day}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {view === 'monthPicker' && (
            <div className={styles.yearGrid}>
              {MONTH_NAMES.map((name, i) => (
                <div
                  key={name}
                  className={styles.yearCell}
                  onClick={() => selectMonth(i)}
                >
                  <span className={styles.yearCellNum}>{name.slice(0, 3).toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}

          {view === 'yearPicker' && (
            <div className={styles.yearGrid}>
              {yearGrid.map(y => (
                <div
                  key={y}
                  className={styles.yearCell}
                  onClick={() => selectYear(y)}
                >
                  <span className={styles.yearCellNum}>{y}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
