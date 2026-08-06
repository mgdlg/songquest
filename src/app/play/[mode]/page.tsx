import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ModeConfig } from '@/types/domain'
import { getMode } from '@/lib/modes'
import { GameProvider } from '@/state/GameContext'
import { GameBoard } from '@/components/game/GameBoard'
import styles from './page.module.css'

/** Next 15 hands route params to the page as a promise. */
interface PlayPageProps {
  params: Promise<{ mode: string }>
}

export async function generateMetadata({ params }: PlayPageProps): Promise<Metadata> {
  const { mode } = await params
  const config = getMode(mode)

  if (!config) {
    return {
      title: 'Unknown mode — Song Quest',
      description: 'That mode is not part of this guide.',
    }
  }

  return {
    title: `${config.label} — Song Quest`,
    description: config.blurb,
  }
}

function summarise(config: ModeConfig): string {
  const clips = config.clipsOnFirstAttempt === 1 ? 'One clip' : 'Three clips'
  const clock =
    config.secondsPerAttempt === null
      ? 'untimed'
      : `${config.secondsPerAttempt}s per attempt`
  const pool = config.pool === 'curated' ? 'curated set' : 'master list'
  const stakes = config.affectsStats ? 'ranked' : 'unrecorded'

  return `${clips} · ${clock} · ${pool} · ${stakes}`
}

/**
 * Stays a server component on purpose: everything stateful lives inside
 * GameProvider, so the shell, metadata, and 404 all resolve without JS.
 */
export default async function PlayPage({ params }: PlayPageProps) {
  const { mode } = await params
  const config = getMode(mode)

  if (!config) {
    notFound()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <Link href="/" className={styles.back}>
            <span aria-hidden="true">&larr;</span> All modes
          </Link>
          <Link href="/stats" className={styles.back}>
            Your record
          </Link>
        </div>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>{config.label}</h1>
          <p className={styles.summary}>{summarise(config)}</p>
        </div>

        <hr className="rule" />
      </header>

      {/* layout.tsx already owns the page's <main>; this is a plain region. */}
      <div className={styles.board}>
        <GameProvider mode={config.id}>
          <GameBoard />
        </GameProvider>
      </div>
    </div>
  )
}
