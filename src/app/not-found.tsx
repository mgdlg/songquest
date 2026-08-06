import Link from 'next/link'
import styles from './not-found.module.css'

export default function NotFound() {
  return (
    <div className={styles.page}>
      <p className={`fieldLabel ${styles.eyebrow}`}>Plate 404 · Specimen absent</p>

      <h1 className={styles.title}>Not in this guide</h1>

      <hr className={`ruleDouble ${styles.rule}`} />

      <p className={styles.body}>
        Whatever you were looking for was never bound into this volume. Either the
        address is mistyped, or the page has been withdrawn from the collection.
      </p>

      <p className={styles.body}>
        The four game modes and your record are still where you left them.
      </p>

      <div className={styles.actions}>
        <Link href="/" className={styles.action}>
          Back to the modes
        </Link>
        <Link href="/stats" className={styles.actionQuiet}>
          Your record
        </Link>
      </div>
    </div>
  )
}
