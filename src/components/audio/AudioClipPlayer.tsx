'use client';

import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioCredit, ClipKind } from '@/types/domain';
import { Seal } from '@/components/ui/Seal';
import { pauseOthers, registerAudio, unregisterAudio } from './audioRegistry';
import { Waveform } from './Waveform';
import styles from './AudioClipPlayer.module.css';

export interface AudioClipPlayerProps {
  /** Already proxied through /api/audio — never a raw upstream URL. */
  src: string;
  kind: ClipKind;
  credit?: AudioCredit | null;
  /** Hardcore withholds clips 2 and 3; a locked player mounts no audio at all. */
  locked?: boolean;
  autoFocus?: boolean;
  /** Starts the scored round clock. Fired at most once per mounted player. */
  onFirstPlay?: () => void;
  volume?: number;
}

/** Displayed as an engraved label; uppercased by the stylesheet. */
const KIND_LABEL: Record<ClipKind, string> = {
  song: 'Song',
  call: 'Call',
  alarm: 'Alarm · Territorial',
};

/** Spoken form — the interpunct in the visible label does not read aloud well. */
const KIND_SPOKEN: Record<ClipKind, string> = {
  song: 'song',
  call: 'call',
  alarm: 'alarm or territorial call',
};

const KIND_TONE: Record<ClipKind, 'sage' | 'slate' | 'clay'> = {
  song: 'sage',
  call: 'slate',
  alarm: 'clay',
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function clampVolume(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 1;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function AudioClipPlayer({
  src,
  kind,
  credit,
  locked = false,
  autoFocus = false,
  onFirstPlay,
  volume,
}: AudioClipPlayerProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  /* The clock may only be started once: a second call would re-stamp the round
     start and silently inflate every score after it. A ref, not state, because
     the latch must close synchronously inside the media event handler. */
  const firstPlayFired = useRef(false);
  /* Kept in a ref so a new closure identity from the parent never re-subscribes
     the media listeners — re-subscribing is what would let the latch reopen. */
  const onFirstPlayRef = useRef<(() => void) | undefined>(onFirstPlay);

  const autoFocusDone = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(Number.NaN);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);

  const hasSource = typeof src === 'string' && src.length > 0;
  const unavailable = failed || (!locked && !hasSource);

  useEffect(() => {
    onFirstPlayRef.current = onFirstPlay;
  }, [onFirstPlay]);

  useEffect(() => {
    const el = audioRef.current;
    if (locked || !hasSource || !el) return;

    const onLoadedMetadata = () => {
      setDuration(el.duration);
      setFailed(false);
    };
    const onDurationChange = () => setDuration(el.duration);
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onPlay = () => {
      setIsPlaying(true);
      if (!firstPlayFired.current) {
        firstPlayFired.current = true;
        onFirstPlayRef.current?.();
      }
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      el.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      setBuffering(false);
    };
    const onError = () => {
      setFailed(true);
      setIsPlaying(false);
      setBuffering(false);
    };
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onPlaying = () => setBuffering(false);
    const onStalled = () => setBuffering(true);

    el.addEventListener('loadedmetadata', onLoadedMetadata);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    el.addEventListener('waiting', onWaiting);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('stalled', onStalled);
    registerAudio(el);

    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.removeEventListener('waiting', onWaiting);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('stalled', onStalled);
      unregisterAudio(el);
      /* A detached element keeps decoding; rounds cycle, so pause explicitly. */
      el.pause();
    };
  }, [hasSource, locked, src]);

  /* New source: the previous clip's timings are meaningless. */
  useEffect(() => {
    setDuration(Number.NaN);
    setCurrentTime(0);
    setIsPlaying(false);
    setBuffering(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = clampVolume(volume);
  }, [volume, locked, src]);

  useEffect(() => {
    if (!autoFocus || locked || autoFocusDone.current) return;
    autoFocusDone.current = true;
    buttonRef.current?.focus();
  }, [autoFocus, locked]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      pauseOthers(el);
      const started = el.play();
      if (started && typeof started.catch === 'function') {
        started.catch(() => {
          /* Autoplay policy or a decode failure: leave the control un-pressed
             and let the `error` event decide whether the clip is dead. */
          setIsPlaying(false);
        });
      }
    } else {
      el.pause();
    }
  }, []);

  const handleScrub = useCallback((fraction: number) => {
    const el = audioRef.current;
    if (!el) return;
    const total = el.duration;
    if (!Number.isFinite(total) || total <= 0) return;
    const next = Math.min(total, Math.max(0, fraction * total));
    el.currentTime = next;
    setCurrentTime(next);
  }, []);

  const label = KIND_LABEL[kind];
  const tone = KIND_TONE[kind];
  const knownDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progress = knownDuration > 0 ? Math.min(1, currentTime / knownDuration) : 0;
  const waveSeed = credit?.catalogueId ?? `${kind}:${src}`;

  const attribution =
    credit != null ? (
      <p className={styles.credit}>
        Recorded by {credit.recordist} ·{' '}
        <a
          className={styles.creditLink}
          href={credit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {credit.catalogueId}
        </a>{' '}
        ·{' '}
        <a
          className={styles.creditLink}
          href={credit.licenseUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {credit.license}
        </a>
      </p>
    ) : null;

  if (locked) {
    /* No <audio> is rendered — not hidden, not muted, not present. Hardcore
       withholds the recording, and a hidden element is reachable from devtools. */
    return (
      <figure className={`${styles.player} ${styles.sealedPlayer}`}>
        <div className={styles.row}>
          <div className={styles.sealSlot}>
            <Seal size={48} tone="brass">
              <svg
                className={styles.lockGlyph}
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <rect
                  x="5.25"
                  y="10.5"
                  width="13.5"
                  height="9.5"
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </Seal>
          </div>
          <div className={styles.sealedRule} />
        </div>
        <figcaption className={styles.meta}>
          <span className={styles.kindLabel}>{label}</span>
          <span className={styles.sealedText}>Sealed — hardcore</span>
        </figcaption>
        <p className="srOnly">
          This {KIND_SPOKEN[kind]} recording is withheld in hardcore mode and cannot be played.
        </p>
      </figure>
    );
  }

  return (
    <figure className={styles.player}>
      {hasSource ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- a birdsong clip has no dialogue to caption; the kind label and attribution carry the description.
        <audio ref={audioRef} src={src} preload="metadata" className={styles.media} />
      ) : null}

      <div className={styles.row}>
        <button
          ref={buttonRef}
          type="button"
          className={styles.disc}
          onClick={toggle}
          disabled={unavailable}
          aria-pressed={isPlaying}
          aria-label={`Play the ${KIND_SPOKEN[kind]} recording`}
        >
          <span className={isPlaying ? styles.glyph : `${styles.glyph} ${styles.glyphPlay}`} aria-hidden="true">
            {isPlaying ? '❚❚' : '▶'}
          </span>
        </button>

        {unavailable ? (
          <div className={styles.deadRule} />
        ) : (
          <div className={buffering ? `${styles.wave} ${styles.waveBuffering}` : styles.wave}>
            <Waveform
              progress={progress}
              seed={waveSeed}
              playing={isPlaying}
              tone={tone}
              onScrub={handleScrub}
            />
          </div>
        )}

        <p className={styles.time}>
          <span className={styles.timeNow}>{formatTime(unavailable ? Number.NaN : currentTime)}</span>
          <span className={styles.timeSep} aria-hidden="true">
            /
          </span>
          <span className={styles.timeTotal}>
            {formatTime(unavailable ? Number.NaN : knownDuration || credit?.duration || Number.NaN)}
          </span>
        </p>
      </div>

      <figcaption className={styles.meta}>
        <span className={styles.kindLabel}>{label}</span>
        {unavailable ? (
          <span className={styles.unavailable} role="status">
            Recording unavailable
          </span>
        ) : null}
      </figcaption>

      {attribution}
    </figure>
  );
}
