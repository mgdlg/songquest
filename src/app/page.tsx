'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { RegionMap } from '@/components/region'
import { speciesCountForRegion } from '@/data/master-list'
import {
  DEFAULT_REGION,
  ROOT_REGIONS,
  REGIONS,
  childrenOf,
  lineageOf,
  type Region,
  type RegionId,
} from '@/lib/regions'
import { loadRegion, saveRegion } from '@/lib/storage/region'

import styles from './page.module.css'

export default function RegionPage() {
  /** The region whose children are on offer; null means "pick a continent". */
  const [openId, setOpenId] = useState<RegionId | null>(null)
  const [selected, setSelected] = useState<RegionId>(DEFAULT_REGION)
  const [restored, setRestored] = useState(false)

  // Read after mount, never during render: localStorage does not exist on the
  // server and reading it in the body would hydrate to a different tree.
  useEffect(() => {
    const saved = loadRegion()
    setSelected(saved)
    const lineage = lineageOf(saved)
    setOpenId(lineage.length > 1 ? (lineage[lineage.length - 2]?.id ?? null) : null)
    setRestored(true)
  }, [])

  useEffect(() => {
    if (restored) saveRegion(selected)
  }, [selected, restored])

  const options = useMemo<Region[]>(
    () => (openId === null ? ROOT_REGIONS.map((id) => REGIONS[id]) : childrenOf(openId)),
    [openId],
  )

  const frame = openId === null ? null : REGIONS[openId].bounds
  const trail = useMemo(() => (openId === null ? [] : lineageOf(openId)), [openId])

  const handleSelect = useCallback((id: RegionId) => {
    setSelected(id)
    // Selecting a region that has finer regions inside it opens them; the same
    // click both chooses and drills, so nothing needs a second "go deeper".
    setOpenId((current) => (childrenOf(id).length > 0 ? id : current))
  }, [])

  const region = REGIONS[selected]
  const curated = speciesCountForRegion('curated', selected)
  const master = speciesCountForRegion('master', selected)

  return (
    <div className={styles.screen}>
      <header className={styles.lockup}>
        <h1 className={styles.wordmark}>Song Quest</h1>
        <p className={styles.tagline}>Name the bird from its voice.</p>
      </header>

      <p className={styles.prompt}>Where are you birding?</p>

      <nav className={styles.trail} aria-label="Region breadcrumb">
        <button
          className={styles.crumb}
          type="button"
          onClick={() => setOpenId(null)}
          disabled={openId === null}
        >
          World
        </button>
        {trail.map((step) => (
          <span key={step.id} className={styles.crumbGroup}>
            <span className={styles.crumbSep} aria-hidden="true">
              ›
            </span>
            <button
              className={styles.crumb}
              type="button"
              onClick={() => setOpenId(step.id)}
              disabled={step.id === openId}
            >
              {step.label}
            </button>
          </span>
        ))}
      </nav>

      <RegionMap
        options={options}
        frame={frame}
        selected={selected}
        onSelect={handleSelect}
        className={styles.map}
      />

      {/* The map is the primary control, but a polygon is a poor keyboard
          target, so every region is also a real button below it. */}
      <ul className={styles.zoneList}>
        {options.map((option) => (
          <li key={option.id}>
            <button
              className={styles.zoneButton}
              type="button"
              data-selected={option.id === selected}
              style={{ ['--zone-tone' as string]: `var(${option.tone})` }}
              onClick={() => handleSelect(option.id)}
            >
              <span className={styles.swatch} aria-hidden="true" />
              <span className={styles.zoneName}>{option.label}</span>
              <span className={styles.zoneBlurb}>{option.blurb}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className={styles.confirm}>
        <p className={styles.chosen}>
          <span className={styles.chosenLabel}>Selected</span>
          <span className={styles.chosenName}>{region.label}</span>
          <span className={styles.chosenCount}>
            {curated} common · {master} with the full list
          </span>
        </p>
        <Link className={styles.play} href="/solo">
          Play here →
        </Link>
      </div>
    </div>
  )
}
