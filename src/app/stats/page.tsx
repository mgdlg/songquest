'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import Link from 'next/link'
import type {
  DailyHistoryEntry,
  DailyModeRecord,
  PersistedState,
  RankTier,
} from '@/types/domain'
import {
  defaultPersistedState,
  loadState,
  resetState,
} from '@/lib/storage/persistence'
import { averageScore, currentStreak, winRate } from '@/lib/storage/stats'
import { rankProgress } from '@/lib/game/ranks'
import { todayKey } from '@/lib/game/daily'
import { Panel } from '@/components/ui/Panel'
import { Button } from '@/components/ui/Button'
import { Seal } from '@/components/ui/Seal'
import { AvatarFrame } from '@/components/ui/AvatarFrame'
import { Skeleton } from '@/components/ui/Skeleton'
import styles from './page.module.css'

type Track = 'standard' | 'hardcore'

const TRACKS: { id: Track; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'hardcore', label: 'Hardcore' },
]

const ATTEMPTS: readonly (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
const HISTORY_DAYS = 365
const DAY_MS = 86_400_000

/**
 * `winRate()` and `rankProgress().pct` are specified without a unit. Accept
 * either convention — a value at or below 1 is read as a fraction, anything
 * larger as an already-scaled percentage — and clamp into 0–100.
 */
function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  const scaled = value <= 1 ? value * 100 : value
  return Math.min(100, Math.max(0, scaled))
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('en-US')
}

/** Tolerates a distribution object that survived a corrupt or older payload. */
function bucketCount(
  distribution: Record<1 | 2 | 3 | 4, number>,
  attempt: 1 | 2 | 3 | 4,
): number {
  const raw = distribution[attempt]
  return Number.isFinite(raw) ? raw : 0
}

/** Roman suffix where the tier has one ("Field Guide II" → "II"). */
function tierGlyph(tier: RankTier): string {
  const match = /\s(I{1,3})$/.exec(tier)
  if (match && match[1]) return match[1]
  return tier.charAt(0)
}

/** UTC-only arithmetic, so the strip never skips or doubles a day on a DST shift. */
function lastDayKeys(endKey: string, count: number): string[] {
  const end = Date.parse(`${endKey}T00:00:00Z`)
  if (!Number.isFinite(end)) return []

  const keys: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10))
  }
  return keys
}

function entryClass(entry: DailyHistoryEntry | undefined): string {
  if (!entry) return styles.cellEmpty
  if (!entry.won || entry.attempt === null) return styles.cellLost
  switch (entry.attempt) {
    case 1:
      return styles.cellOne
    case 2:
      return styles.cellTwo
    case 3:
      return styles.cellThree
    default:
      return styles.cellFour
  }
}

function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={styles.tile}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileValue}>{value}</p>
      <p className={styles.tileNote}>{note}</p>
    </div>
  )
}

function StreakBlock({
  label,
  record,
  today,
}: {
  label: string
  record: DailyModeRecord
  today: string
}) {
  return (
    <div className={styles.streakBlock}>
      <p className={styles.streakLabel}>{label}</p>
      <div className={styles.streakPair}>
        <div>
          <span className={styles.streakValue}>
            {formatNumber(currentStreak(record, today))}
          </span>
          <span className={styles.streakCaption}>Current</span>
        </div>
        <div>
          <span className={styles.streakValue}>{formatNumber(record.bestStreak)}</span>
          <span className={styles.streakCaption}>Best</span>
        </div>
      </div>
    </div>
  )
}

function Histogram({ record }: { record: DailyModeRecord }) {
  const counts = ATTEMPTS.map((attempt) => ({
    attempt,
    count: bucketCount(record.guessDistribution, attempt),
  }))
  const total = counts.reduce((sum, row) => sum + row.count, 0)
  const peak = counts.reduce((max, row) => Math.max(max, row.count), 0)

  if (total === 0) {
    return (
      <p className={styles.empty}>
        No solved rounds recorded on this track yet. The distribution fills in as you
        play.
      </p>
    )
  }

  let modalAttempt: 1 | 2 | 3 | 4 | null = null
  let modalCount = 0
  for (const row of counts) {
    if (row.count > modalCount) {
      modalCount = row.count
      modalAttempt = row.attempt
    }
  }

  return (
    <ul className={styles.histogram}>
      {counts.map((row) => {
        const isModal = row.attempt === modalAttempt
        const width = peak > 0 ? (row.count / peak) * 100 : 0

        return (
          <li key={row.attempt} className={styles.histRow}>
            <span className={styles.histAttempt}>{row.attempt}</span>
            <span className={styles.histTrack}>
              <span
                className={`${styles.histBar} ${isModal ? styles.histBarModal : ''}`}
                style={{ width: `${width}%` }}
                aria-hidden="true"
              />
            </span>
            <span className={styles.histCount}>
              {formatNumber(row.count)}
              <span className="srOnly">
                {` solved on attempt ${row.attempt}`}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function HistoryStrip({ record, today }: { record: DailyModeRecord; today: string }) {
  const days = useMemo(() => {
    return lastDayKeys(today, HISTORY_DAYS).map((date) => {
      const entry: DailyHistoryEntry | undefined = record.history[date]
      return { date, entry }
    })
  }, [record, today])

  const played = days.reduce((sum, day) => (day.entry ? sum + 1 : sum), 0)

  return (
    <div>
      <p className={styles.stripSummary}>
        {played === 0
          ? 'No daily results archived on this track yet.'
          : `${formatNumber(played)} of the last ${HISTORY_DAYS} days played on this track.`}
      </p>

      <div className={styles.strip} role="img" aria-label={`Daily results for the last ${HISTORY_DAYS} days: ${played} played.`}>
        {days.map((day) => (
          <span key={day.date} className={`${styles.cell} ${entryClass(day.entry)}`} />
        ))}
      </div>

      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={`${styles.cell} ${styles.cellOne}`} aria-hidden="true" /> First
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.cell} ${styles.cellTwo}`} aria-hidden="true" /> Second
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.cell} ${styles.cellThree}`} aria-hidden="true" /> Third
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.cell} ${styles.cellFour}`} aria-hidden="true" /> Fourth
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.cell} ${styles.cellLost}`} aria-hidden="true" /> Missed
        </li>
        <li className={styles.legendItem}>
          <span className={`${styles.cell} ${styles.cellEmpty}`} aria-hidden="true" /> Unplayed
        </li>
      </ul>
    </div>
  )
}

function LoadingRecord() {
  return (
    <div className={styles.loading} aria-hidden="true">
      <Skeleton height="10rem" />
      <Skeleton height="7rem" />
      <Skeleton height="13rem" />
      <Skeleton height="9rem" />
    </div>
  )
}

export default function StatsPage() {
  // localStorage is read after mount only: SSR has none, and a render-time read
  // would hydrate to a different tree.
  const [snapshot, setSnapshot] = useState<{ state: PersistedState; today: string } | null>(
    null,
  )
  const [track, setTrack] = useState<Track>('standard')
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')
  const confirmRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setSnapshot({ state: loadState(), today: todayKey() })
  }, [])

  useEffect(() => {
    if (confirming && confirmRef.current) {
      confirmRef.current.focus()
    }
  }, [confirming])

  function handleReset() {
    resetState()
    setSnapshot({ state: defaultPersistedState(), today: todayKey() })
    setConfirming(false)
    setNotice('Every streak, rank, and archived result has been erased.')
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          <span aria-hidden="true">&larr;</span> All modes
        </Link>
        <h1 className={styles.title}>Your Record</h1>
        <p className={styles.lede}>
          Kept in this browser and nowhere else. Clearing site data clears the lot.
        </p>
        <hr className={`ruleDouble ${styles.rule}`} />
      </header>

      {snapshot === null ? (
        <>
          <p className="srOnly" role="status">
            Loading your saved record.
          </p>
          <LoadingRecord />
        </>
      ) : (
        <StatsBody
          state={snapshot.state}
          today={snapshot.today}
          track={track}
          onTrackChange={setTrack}
          confirming={confirming}
          onConfirmingChange={setConfirming}
          confirmRef={confirmRef}
          notice={notice}
          onReset={handleReset}
        />
      )}
    </div>
  )
}

function StatsBody({
  state,
  today,
  track,
  onTrackChange,
  confirming,
  onConfirmingChange,
  confirmRef,
  notice,
  onReset,
}: {
  state: PersistedState
  today: string
  track: Track
  onTrackChange: (next: Track) => void
  confirming: boolean
  onConfirmingChange: (next: boolean) => void
  confirmRef: RefObject<HTMLDivElement | null>
  notice: string
  onReset: () => void
}) {
  const { profile, daily, practice } = state
  const record = daily[track]
  const progress = rankProgress(profile.eloRating)
  const pct = toPercent(progress.pct)
  const rate = toPercent(winRate(record))
  const average = averageScore(record)
  const trackLabel = track === 'standard' ? 'Standard' : 'Hardcore'

  return (
    <>
      <section aria-labelledby="rank-heading" className={styles.section}>
        <h2 id="rank-heading" className={styles.sectionHeading}>
          Standing
        </h2>

        <Panel raised className={styles.rankPanel}>
          <div className={styles.rankBody}>
            <div className={styles.medallion}>
              <Seal size={116} tone="brass">
                {profile.avatarUrl ? (
                  <AvatarFrame src={profile.avatarUrl} alt="" size={88} />
                ) : (
                  <span className={styles.sealGlyph}>{tierGlyph(progress.tier)}</span>
                )}
              </Seal>
            </div>

            <div className={styles.rankText}>
              <p className={styles.rankTier}>{progress.tier}</p>
              <p className={styles.rankElo}>
                {formatNumber(profile.eloRating)}
                <span className={styles.rankEloUnit}> Elo</span>
              </p>

              <div
                className={styles.eloTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
                aria-valuetext={
                  progress.next
                    ? `${Math.round(pct)} percent toward ${progress.next}`
                    : 'Highest rank attained'
                }
                aria-label="Progress toward the next rank"
              >
                <span className={styles.eloFill} style={{ width: `${pct}%` }} />
              </div>

              <p className={styles.rankNext}>
                {progress.next
                  ? `${Math.round(pct)}% toward ${progress.next}`
                  : 'Top of the guide — nothing left above this.'}
              </p>
              <p className={styles.rankGames}>
                {formatNumber(profile.stats.gamesPlayed)} rounds played in all.
              </p>
            </div>
          </div>
        </Panel>
      </section>

      <section aria-labelledby="streak-heading" className={styles.section}>
        <h2 id="streak-heading" className={styles.sectionHeading}>
          Daily streaks
        </h2>

        <Panel className={styles.streakPanel}>
          <div className={styles.streaks}>
            <StreakBlock label="Standard" record={daily.standard} today={today} />
            <span className={styles.streakDivider} aria-hidden="true" />
            <StreakBlock label="Hardcore" record={daily.hardcore} today={today} />
          </div>
          <p className={styles.streakNote}>
            A streak survives only if the previous UTC day was played. Hardcore keeps its
            own count and its own bird.
          </p>
        </Panel>
      </section>

      <section aria-labelledby="track-heading" className={styles.section}>
        <div className={styles.trackHeader}>
          <h2 id="track-heading" className={styles.sectionHeading}>
            {trackLabel} daily
          </h2>
          <div className={styles.toggle} role="group" aria-label="Choose a daily track">
            {TRACKS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`${styles.toggleButton} ${
                  track === option.id ? styles.toggleButtonOn : ''
                }`}
                aria-pressed={track === option.id}
                onClick={() => onTrackChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.trackGrid}>
          <Panel label="Guess distribution" className={styles.histPanel}>
            <Histogram record={record} />
          </Panel>

          <div className={styles.tiles}>
            <StatTile
              label="Win rate"
              value={`${Math.round(rate)}%`}
              note={`${formatNumber(record.gamesWon)} of ${formatNumber(
                record.gamesPlayed,
              )} rounds`}
            />
            <StatTile
              label="Average score"
              value={formatNumber(average)}
              note="Points per completed round"
            />
          </div>
        </div>

        <p className={styles.practiceNote}>
          Practice: {formatNumber(practice.roundsPlayed)} rounds,{' '}
          {formatNumber(practice.roundsWon)} solved, {formatNumber(practice.averageScore)}{' '}
          average. Unranked, and never counted toward a streak.
        </p>
      </section>

      <section aria-labelledby="history-heading" className={styles.section}>
        <h2 id="history-heading" className={styles.sectionHeading}>
          The last year
        </h2>
        <Panel className={styles.stripPanel}>
          <HistoryStrip record={record} today={today} />
        </Panel>
      </section>

      <section aria-labelledby="reset-heading" className={styles.section}>
        <h2 id="reset-heading" className={styles.sectionHeading}>
          Start over
        </h2>

        <Panel tone="clay" className={styles.resetPanel}>
          {confirming ? (
            <div
              className={styles.confirm}
              ref={confirmRef}
              tabIndex={-1}
              role="group"
              aria-label="Confirm erasing all saved data"
            >
              <p className={styles.confirmText}>
                This erases your rank, both streaks, the guess distribution, and every
                archived day. It cannot be undone.
              </p>
              <div className={styles.confirmActions}>
                <Button variant="danger" onClick={onReset}>
                  Yes, erase everything
                </Button>
                <Button variant="ghost" onClick={() => onConfirmingChange(false)}>
                  Keep my record
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.resetIdle}>
              <p className={styles.resetText}>
                Reset all saved data — rank, streaks, distribution, and the year of
                results.
              </p>
              <Button variant="secondary" onClick={() => onConfirmingChange(true)}>
                Reset all data
              </Button>
            </div>
          )}

          <p className={styles.notice} role="status" aria-live="polite">
            {notice}
          </p>
        </Panel>
      </section>
    </>
  )
}
