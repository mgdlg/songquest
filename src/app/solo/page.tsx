'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { speciesCountForRegion } from '@/data/master-list'
import { getRegion, type Region } from '@/lib/regions'
import { loadBeginner, loadRegion, saveBeginner } from '@/lib/storage/region'

import styles from './page.module.css'

function CalendarMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="15"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M3.5 10.5h17" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 3.5v4M16 3.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="15.5" r="1.6" fill="currentColor" />
    </svg>
  )
}

function LoopMark() {
  return (
    <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7.5 15.5c2.5 0 4-7 9-7a3.5 3.5 0 0 1 0 7c-5 0-6.5-7-9-7a3.5 3.5 0 0 0 0 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function SoloPage() {
  const [hardcore, setHardcore] = useState(false)
  const [beginner, setBeginner] = useState(false)
  const [region, setRegion] = useState<Region | null>(null)
  const [restored, setRestored] = useState(false)

  // After mount only — localStorage is absent on the server, and reading it in
  // the render body would hydrate to a different tree.
  useEffect(() => {
    setRegion(getRegion(loadRegion()))
    setBeginner(loadBeginner())
    setRestored(true)
  }, [])

  useEffect(() => {
    if (restored) saveBeginner(beginner)
  }, [beginner, restored])

  const beginnerCount = region ? speciesCountForRegion('curated', region.id, { beginner: true }) : 0

  // The toggle picks the route rather than being carried as state into the
  // round: /play/[mode] already owns every rule, so the menu only has to choose
  // which of the four it opens.
  const dailyHref = hardcore ? '/play/daily-hardcore' : '/play/daily-standard'
  const practiceHref = hardcore ? '/play/practice-hardcore' : '/play/practice-standard'

  return (
    <div className={styles.screen}>
      <Link className={styles.back} href="/">
        ← Region
      </Link>

      <h1 className={styles.heading}>Solo</h1>

      {/* The region is a standing choice, so it reads as a setting you can see
          and change rather than a step you have to walk back through. */}
      <Link className={styles.regionChip} href="/">
        <span className={styles.regionLabel}>Birding in</span>
        <span className={styles.regionName}>{region ? region.label : '—'}</span>
        <span className={styles.regionChange}>Change</span>
      </Link>

      <div className={styles.choices}>
        <Link className={styles.choice} href={dailyHref}>
          <CalendarMark />
          <span className={styles.choiceLabel}>Daily</span>
          <span className={styles.choiceNote}>One bird, everyone, today</span>
        </Link>

        <Link className={styles.choice} href={practiceHref}>
          <LoopMark />
          <span className={styles.choiceLabel}>Practice</span>
          <span className={styles.choiceNote}>Endless, unrecorded</span>
        </Link>
      </div>

      {/* Beginner narrows *which* birds; hardcore changes *how* they are asked.
          They compose, so both are switches rather than one difficulty dial. */}
      <button
        className={styles.toggle}
        type="button"
        role="switch"
        aria-checked={beginner}
        data-tone="beginner"
        onClick={() => setBeginner((on) => !on)}
      >
        <span className={styles.toggleText}>
          <span className={styles.toggleLabel}>Beginner</span>
          <span className={styles.toggleNote}>
            {beginner
              ? `The ${beginnerCount} most-observed birds here`
              : 'Every bird in the region, common or not'}
          </span>
        </span>
        <span className={styles.track} data-on={beginner} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </button>

      <button
        className={styles.toggle}
        type="button"
        role="switch"
        aria-checked={hardcore}
        onClick={() => setHardcore((on) => !on)}
      >
        <span className={styles.toggleText}>
          <span className={styles.toggleLabel}>Hardcore</span>
          <span className={styles.toggleNote}>
            {hardcore ? 'One clip · 15s a guess · full list' : 'Three clips · no clock · curated list'}
          </span>
        </span>
        <span className={styles.track} data-on={hardcore} aria-hidden="true">
          <span className={styles.thumb} />
        </span>
      </button>

      <Link className={styles.quiet} href="/stats">
        Your record
      </Link>
    </div>
  )
}
