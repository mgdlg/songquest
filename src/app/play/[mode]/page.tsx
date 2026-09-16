import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ModeConfig } from '@/types/domain'
import { MODE_ORDER, getMode } from '@/lib/modes'
import { GameProvider } from '@/state/GameContext'
import { GameBoard } from '@/components/game/GameBoard'
import styles from './page.module.css'

/** Next 15 hands route params to the page as a promise. */
interface PlayPageProps {
  params: Promise<{ mode: string }>
}

/**
 * A static export has to know every page at build time, so the four modes are
 * enumerated here and written out as four HTML files. Any other `/play/…` path
 * does not exist on disk and the host serves the 404 page.
 */
export function generateStaticParams(): { mode: string }[] {
  return MODE_ORDER.map((mode) => ({ mode }))
}

export const dynamicParams = false

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
  const clips = config.clipsOnFirstAttempt === 1 ? 'One clip' : 'Every clip'
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
          {/* The modes live on /solo since the region picker took over the
              front page; linking to "/" would drop the player at the map. */}
          <Link href="/solo" className={styles.back}>
            <span aria-hidden="true">&larr;</span> Modes
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
