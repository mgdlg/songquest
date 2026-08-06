'use client';

import { useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import type {
  AudioCredit,
  ClipKind,
  HintStage as HintStageId,
  ModeConfig,
  SpeciesDossier,
} from '@/types/domain';
import { Panel } from '@/components/ui';
import { AudioClipPlayer } from '@/components/audio';
import { RangeMap } from '@/components/map';
import { BlurredPhoto, RedactedText, TaxonomyPanel } from '@/components/species';
import { useGame } from '@/state/GameContext';
import styles from './HintStage.module.css';

interface StageMeta {
  /** Engraved plate label. */
  label: string;
  /** Spoken form for the unlock announcement. */
  spoken: string;
  /** One line of what the closed panel is withholding. */
  teaser: string;
}

const STAGE_META: Record<HintStageId, StageMeta> = {
  audio: {
    label: 'I · VOCALISATIONS',
    spoken: 'Clue one, vocalisations',
    teaser: 'Field recordings — song, and where available call and alarm.',
  },
  geography: {
    label: 'II · DISTRIBUTION',
    spoken: 'Clue two, distribution',
    teaser: 'A density map of verified occurrences across the range.',
  },
  taxonomy: {
    label: 'III · TAXONOMY',
    spoken: 'Clue three, taxonomy',
    teaser: 'Order, family, and genus — the species withheld.',
  },
  visual: {
    label: 'IV · FIELD MARKS',
    spoken: 'Clue four, field marks',
    teaser: 'A blurred plate and an account with every name struck out.',
  },
};

const CLIP_LABEL: Record<ClipKind, string> = {
  song: 'Song',
  call: 'Call',
  alarm: 'Alarm',
};

function Absent({ children }: { children: ReactNode }): JSX.Element {
  return <p className={styles.absent}>{children}</p>;
}

function AudioStage({
  species,
  config,
  onFirstPlay,
}: {
  species: SpeciesDossier;
  config: ModeConfig;
  onFirstPlay: () => void;
}): JSX.Element {
  // Only what exists. Most species are not recorded in all three voices, and a
  // row of "no alarm recording archived" notices tells the player nothing about
  // the bird — it just makes a complete round look broken.
  const available = (
    [
      { kind: 'song', src: species.audioClips.songUrl, credit: species.audioCredits.song },
      { kind: 'call', src: species.audioClips.callUrl, credit: species.audioCredits.call },
      { kind: 'alarm', src: species.audioClips.alarmUrl, credit: species.audioCredits.alarm },
    ] as { kind: ClipKind; src: string; credit: AudioCredit | null }[]
  ).filter((clip) => clip.src !== '');

  // Hardcore exposes one clip, and it must be one that exists — slicing the
  // fixed song/call/alarm order would hand back an empty song slot for a
  // species recorded only calling, and the attempt would open in silence.
  const clips = config.clipsOnFirstAttempt === 1 ? available.slice(0, 1) : available;

  if (clips.length === 0) {
    return <Absent>No openly licensed recording is archived for this species.</Absent>;
  }

  return (
    <div className={styles.clips}>
      {clips.map(({ kind, src, credit }) => (
        <div key={kind} className={styles.clip}>
          <span className={styles.clipLabel}>{CLIP_LABEL[kind]}</span>
          <AudioClipPlayer src={src} kind={kind} credit={credit} onFirstPlay={onFirstPlay} />
        </div>
      ))}
    </div>
  );
}

function GeographyStage({ species }: { species: SpeciesDossier }): JSX.Element {
  if (!species.rangeMapTileUrl) {
    return <Absent>No occurrence tiles are published for this taxon.</Absent>;
  }
  return (
    <figure className={styles.figure}>
      {/* Navigable: the opening frame is a trimmed percentile of the
          occurrence sample, so a player who wants the vagrant records at the
          edges — often the most diagnostic thing on the plate — has to be able
          to pan and zoom out to them. */}
      <RangeMap
        tileUrl={species.rangeMapTileUrl}
        center={species.rangeCenter ?? undefined}
        bounds={species.rangeBounds ?? undefined}
        interactive
        className={styles.map}
      />
      <figcaption className={styles.caption}>
        Occurrence density from GBIF. Darker cells hold more verified records.
        Drag to pan; click the map to enable wheel zoom.
      </figcaption>
    </figure>
  );
}

function VisualStage({
  species,
  blurPx = 16,
}: {
  species: SpeciesDossier
  blurPx?: number
}): JSX.Element {
  return (
    <div className={styles.visual}>
      {species.photo.url ? (
        <BlurredPhoto
          src={species.photo.url}
          alt={
            blurPx > 0
              ? 'Photograph of the mystery species, blurred to obscure its field marks'
              : 'Photograph of the mystery species'
          }
          blurPx={blurPx}
          revealed={blurPx <= 0}
          attribution={species.photo.attribution}
          license={species.photo.license}
        />
      ) : (
        <Absent>No openly licensed photograph is available for this species.</Absent>
      )}

      {species.descriptionSnippet ? (
        <RedactedText text={species.descriptionSnippet} className={styles.account} />
      ) : (
        <Absent>No account text could be retrieved.</Absent>
      )}
    </div>
  );
}

export function HintStage(props: {
  stage: HintStageId;
  species: SpeciesDossier;
  unlocked: boolean;
  config: ModeConfig;
  /**
   * Blur radius for the field-marks plate. The plate is on screen from the
   * first attempt, so the difficulty lives in how hard it is to read rather
   * than in whether it is there — the caller sharpens it as attempts are spent.
   */
  photoBlurPx?: number;
  /** Suppresses the engraved header, for a stage that owns its own frame. */
  bare?: boolean;
}): JSX.Element {
  const { stage, species, unlocked, config, photoBlurPx, bare = false } = props;
  const meta = STAGE_META[stage];

  // Only for `startRound`: the round clock must begin on the first audio play,
  // not on mount. HintStage is always rendered inside GameProvider by GameBoard.
  const { startRound } = useGame();

  const [announcement, setAnnouncement] = useState('');
  const wasUnlocked = useRef(unlocked);

  useEffect(() => {
    // Announce the transition only — never the stages that were already open
    // when the board mounted, or four clues would speak at once.
    if (unlocked && !wasUnlocked.current) {
      setAnnouncement(`${meta.spoken} unlocked.`);
    }
    wasUnlocked.current = unlocked;
  }, [unlocked, meta.spoken]);

  const body = (
    <>
      {stage === 'audio' ? (
        <AudioStage species={species} config={config} onFirstPlay={startRound} />
      ) : null}
      {stage === 'geography' ? <GeographyStage species={species} /> : null}
      {stage === 'taxonomy' ? (
        // No `scientificName`, no reveal: the binomial is the answer.
        <TaxonomyPanel taxonomy={species.taxonomy} revealSpecies={false} />
      ) : null}
      {stage === 'visual' ? <VisualStage species={species} blurPx={photoBlurPx} /> : null}
    </>
  );

  if (bare) return body;

  return (
    <>
      {unlocked ? (
        <Panel label={meta.label} tone="paper" raised className={styles.stage}>
          {body}
        </Panel>
      ) : (
        <Panel label={meta.label} tone="warm" className={styles.locked}>
          <div className={styles.lockedRow}>
            <svg
              className={styles.lockGlyph}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
              <path d="M8.25 10.5V7.5a3.75 3.75 0 0 1 7.5 0v3" />
            </svg>
            <p className={styles.teaser}>
              <span className="srOnly">Locked. </span>
              {meta.teaser}
            </p>
          </div>
        </Panel>
      )}

      {/* Present in both states: a live region inserted together with its text
          is unreliable — it must already be in the DOM when the text arrives. */}
      <div className="srOnly" role="status" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
