'use client';

import type * as React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { AudioClipPlayer } from '@/components/audio';
import { Button } from '@/components/ui/Button';
import { Seal } from '@/components/ui/Seal';
import type {
  AttemptNumber,
  AudioCredit,
  ClipKind,
  ModeConfig,
  RoundResult,
  SpeciesDossier,
} from '@/types/domain';

import { BlurredPhoto } from './BlurredPhoto';
import { RedactedText } from './RedactedText';
import { ScoreBreakdownPanel, formatPoints } from './ScoreBreakdownPanel';
import { TaxonomyPanel } from './TaxonomyPanel';

import styles from './SpeciesCard.module.css';

export interface SpeciesCardProps {
  species: SpeciesDossier;
  result: RoundResult;
  mode: ModeConfig;
  onNext?: () => void;
  onShare?: () => void;
}

/** The seal stamps the attempt as a numeral; a loss gets a struck rule. */
const ATTEMPT_NUMERALS: Readonly<Record<AttemptNumber, string>> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
};

const TOTAL_ATTEMPTS = 4;

/* Sage square for the attempt that landed, clay for one spent, blank for one
   never used. Written as code points so the file stays ASCII-safe. */
const SQUARE_SOLVED = String.fromCodePoint(0x1f7e9);
const SQUARE_SPENT = String.fromCodePoint(0x1f7e7);
const SQUARE_UNUSED = String.fromCodePoint(0x2b1c);

/** How long the "copied" confirmation stays up before the region clears. */
const COPIED_NOTICE_MS = 2200;

const CLIP_LABELS: Readonly<Record<ClipKind, string>> = {
  song: 'Song',
  call: 'Call',
  alarm: 'Alarm',
};

interface CardClip {
  kind: ClipKind;
  url: string;
  credit: AudioCredit | null;
}

function isPresent(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Upstream records occasionally carry an empty URL; an `href=""` would link
    back to the game and lose the player's round. */
function CreditLink({
  href,
  children,
}: {
  href: string | null | undefined;
  children: React.ReactNode;
}): React.JSX.Element {
  if (!isPresent(href)) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/** Spoiler-free by construction: squares and a tally, never the bird. */
function buildShareText(args: {
  modeLabel: string;
  solvedOnAttempt: AttemptNumber | null;
  total: number;
  elapsedMs: number;
}): string {
  const cells: string[] = [];
  for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt += 1) {
    if (args.solvedOnAttempt === null || attempt < args.solvedOnAttempt) {
      cells.push(SQUARE_SPENT);
    } else if (attempt === args.solvedOnAttempt) {
      cells.push(SQUARE_SOLVED);
    } else {
      cells.push(SQUARE_UNUSED);
    }
  }

  const scoreLine = [
    `${args.solvedOnAttempt ?? 'X'}/${TOTAL_ATTEMPTS}`,
    `${formatPoints(args.total)} pts`,
    formatDuration(args.elapsedMs),
  ].join(' · ');

  return `SONG QUEST · ${args.modeLabel}\n${scoreLine}\n${cells.join('')}`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied permission or an insecure context — fall through to the legacy path.
    }
  }

  if (typeof document === 'undefined' || document.body === null) return false;

  const scratch = document.createElement('textarea');
  scratch.value = text;
  scratch.setAttribute('readonly', '');
  scratch.style.position = 'fixed';
  scratch.style.top = '0';
  scratch.style.left = '-9999px';
  document.body.appendChild(scratch);
  scratch.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(scratch);
  return copied;
}

export function SpeciesCard({
  species,
  result,
  mode,
  onNext,
  onShare,
}: SpeciesCardProps): React.JSX.Element {
  const titleId = useId();
  const notesId = useId();
  const audioId = useId();
  const creditsId = useId();

  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const noticeTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const clips = useMemo<CardClip[]>(() => {
    const candidates: { kind: ClipKind; url: string | undefined; credit: AudioCredit | null }[] = [
      { kind: 'song', url: species.audioClips?.songUrl, credit: species.audioCredits?.song ?? null },
      { kind: 'call', url: species.audioClips?.callUrl, credit: species.audioCredits?.call ?? null },
      {
        kind: 'alarm',
        url: species.audioClips?.alarmUrl,
        credit: species.audioCredits?.alarm ?? null,
      },
    ];

    const present: CardClip[] = [];
    for (const candidate of candidates) {
      if (isPresent(candidate.url)) {
        present.push({ kind: candidate.kind, url: candidate.url, credit: candidate.credit });
      }
    }
    return present;
  }, [species]);

  const shareText = useMemo(
    () =>
      buildShareText({
        modeLabel: mode.label,
        solvedOnAttempt: result.solvedOnAttempt,
        total: result.score?.total ?? 0,
        elapsedMs: result.elapsedMs,
      }),
    [mode.label, result.solvedOnAttempt, result.score?.total, result.elapsedMs],
  );

  const handleShare = useCallback(() => {
    void (async () => {
      const copied = await copyToClipboard(shareText);
      setShareState(copied ? 'copied' : 'failed');
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      // A failed copy leaves the grid on screen to be selected by hand, so only
      // the success confirmation is transient.
      if (copied) {
        noticeTimer.current = window.setTimeout(() => setShareState('idle'), COPIED_NOTICE_MS);
      }
      onShare?.();
    })();
  }, [shareText, onShare]);

  /* The full description is only sent once the round resolves; falling back to
     the redacted snippet keeps the card readable if the service degraded it. */
  const description = isPresent(species.descriptionFull)
    ? species.descriptionFull
    : species.descriptionSnippet;

  const solvedOn = result.solvedOnAttempt;
  const outcomeLine = result.won && solvedOn !== null
    ? `Identified on attempt ${solvedOn} of ${TOTAL_ATTEMPTS}`
    : 'Not identified';

  const photoCredit = [species.photo?.attribution, species.photo?.license]
    .filter(isPresent)
    .join(' · ');

  /* Attribution is a licence term. The block is only omitted when there is
     genuinely nothing to attribute — never to save space. */
  const hasCredits =
    clips.some((clip) => clip.credit !== null) ||
    photoCredit.length > 0 ||
    isPresent(species.wikipediaUrl);

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.seal}>
        <Seal tone={result.won ? 'brass' : 'clay'} size={52}>
          <span className={styles.sealMark} aria-hidden="true">
            {result.won && solvedOn !== null ? ATTEMPT_NUMERALS[solvedOn] : '—'}
          </span>
        </Seal>
        <span className="srOnly">{outcomeLine}</span>
      </div>

      <div className={styles.plate}>
        <BlurredPhoto
          src={species.photo?.url ?? ''}
          alt={`${species.commonName} (${species.scientificName})`}
          revealed
        />
      </div>

      <header className={styles.header}>
        <p className={`fieldLabel ${styles.eyebrow}`}>
          {mode.label} · {outcomeLine}
        </p>
        <h2 id={titleId} className={styles.commonName}>
          {species.commonName}
        </h2>
        <hr className={styles.brassRule} />
        <p className={`binomial ${styles.binomial}`}>{species.scientificName}</p>
        {isPresent(species.conservationStatus) ? (
          <p className={styles.status}>
            <span className="fieldLabel">Status</span>
            <span>{species.conservationStatus}</span>
          </p>
        ) : null}
      </header>

      <section className={styles.section}>
        <TaxonomyPanel
          taxonomy={species.taxonomy}
          scientificName={species.scientificName}
          revealSpecies
        />
      </section>

      <section className={styles.section} aria-labelledby={notesId}>
        <h3 id={notesId} className={`fieldLabel ${styles.sectionLabel}`}>
          <span>Field notes</span>
        </h3>
        <RedactedText text={description} />
      </section>

      <section className={styles.section} aria-labelledby={audioId}>
        <h3 id={audioId} className={`fieldLabel ${styles.sectionLabel}`}>
          <span>Recordings</span>
        </h3>
        {clips.length > 0 ? (
          <ul className={styles.soundboard}>
            {clips.map((clip) => (
              <li key={clip.kind} className={styles.clip}>
                <AudioClipPlayer src={clip.url} kind={clip.kind} credit={clip.credit} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.absent}>No recordings are available for this species.</p>
        )}
      </section>

      <section className={styles.section}>
        <ScoreBreakdownPanel score={result.score} />
      </section>

      <div className={`${styles.actions} noPrint`}>
        <Button variant="secondary" onClick={handleShare}>
          Share result
        </Button>
        {onNext ? (
          <Button variant="primary" onClick={onNext}>
            Next bird
          </Button>
        ) : null}
      </div>

      <p className={styles.notice} role="status" aria-live="polite">
        {shareState === 'copied' ? 'Result copied to the clipboard.' : null}
        {shareState === 'failed' ? 'Clipboard unavailable — copy the grid below.' : null}
      </p>

      {shareState === 'failed' ? (
        <pre className={`${styles.shareFallback} noPrint`}>{shareText}</pre>
      ) : null}

      {hasCredits ? (
        <footer className={styles.attribution} aria-labelledby={creditsId}>
          <h3 id={creditsId} className={`fieldLabel ${styles.sectionLabel}`}>
            <span>Credits</span>
          </h3>
          <ul className={styles.creditList}>
            {clips.map((clip) =>
              clip.credit ? (
                <li key={`credit-${clip.kind}`}>
                  <span className={styles.creditKind}>{CLIP_LABELS[clip.kind]}</span>{' '}
                  <CreditLink href={clip.credit.sourceUrl}>{clip.credit.catalogueId}</CreditLink>{' '}
                  recorded by {clip.credit.recordist}
                  {isPresent(clip.credit.country) ? `, ${clip.credit.country}` : ''} ·{' '}
                  <CreditLink href={clip.credit.licenseUrl}>{clip.credit.license}</CreditLink>
                </li>
              ) : null,
            )}
            {photoCredit.length > 0 ? (
              <li key="credit-photo">
                <span className={styles.creditKind}>Photograph</span> {photoCredit}
              </li>
            ) : null}
            {isPresent(species.wikipediaUrl) ? (
              <li key="credit-text">
                <span className={styles.creditKind}>Text</span> adapted from{' '}
                <CreditLink href={species.wikipediaUrl}>Wikipedia</CreditLink>
              </li>
            ) : null}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
