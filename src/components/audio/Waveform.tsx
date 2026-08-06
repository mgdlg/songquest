'use client';

import type * as React from 'react';
import { useCallback, useMemo, useRef } from 'react';
import styles from './Waveform.module.css';

export interface WaveformProps {
  /** 0–1. Values outside the range are clamped rather than rejected. */
  progress: number;
  bars?: number;
  /** Deterministic silhouette: the same seed always draws the same bird. */
  seed?: string;
  playing?: boolean;
  tone?: 'sage' | 'slate' | 'clay';
  /** Receives a 0–1 fraction. Absent => the waveform is display-only. */
  onScrub?: (fraction: number) => void;
}

/* The SVG is drawn in an abstract unit box and stretched by CSS; no DPR
   handling, no resize observer, no layout reads on paint. */
const VIEW_W = 1000;
const VIEW_H = 100;

/** Fraction of each slot occupied by the bar itself; the rest is the gap. */
const BAR_DUTY = 0.56;

/** How many song "phrases" the envelope groups the noise into. */
const PHRASE_COUNT = 3.5;

const MIN_AMP = 0.07;
const KEY_STEP = 0.02;
const KEY_STEP_LARGE = 0.1;

const TONE_CLASS: Record<NonNullable<WaveformProps['tone']>, string> = {
  sage: styles.toneSage,
  slate: styles.toneSlate,
  clay: styles.toneClay,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * FNV-1a over the seed string. Reimplemented here rather than imported from
 * the game layer: the waveform is a presentation concern and must not depend
 * on the daily-puzzle module.
 */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — local copy, same algorithm the daily picker uses. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Centre of the bar as a 0–1 fraction of the clip. */
  at: number;
}

/**
 * Seeded noise shaped by a slow sine and a global taper, so the silhouette
 * reads as phrases with breaths between them rather than as static.
 */
function buildBars(bars: number, seed: string): Bar[] {
  const count = Math.max(1, Math.floor(bars));
  const rand = mulberry32(hashSeed(seed));
  const slot = VIEW_W / count;
  const w = slot * BAR_DUTY;
  const out: Bar[] = [];

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const phrase = 0.4 + 0.6 * Math.abs(Math.sin(Math.PI * (t * PHRASE_COUNT + 0.12))) ** 1.4;
    const taper = Math.sin(Math.PI * t) ** 0.3;
    const jitter = 0.32 + 0.68 * rand();
    const amp = Math.max(MIN_AMP, Math.min(1, phrase * taper * jitter));
    const h = amp * VIEW_H;
    out.push({
      x: i * slot + (slot - w) / 2,
      y: (VIEW_H - h) / 2,
      w,
      h,
      at: (i + 0.5) / count,
    });
  }

  return out;
}

export function Waveform({
  progress,
  bars = 64,
  seed = 'songquest',
  playing = false,
  tone = 'sage',
  onScrub,
}: WaveformProps): React.JSX.Element {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const shape = useMemo(() => buildBars(bars, seed), [bars, seed]);
  const value = clamp01(progress);
  const percent = Math.round(value * 100);
  const interactive = typeof onScrub === 'function';

  const fractionFromClientX = useCallback((clientX: number): number => {
    const el = wrapRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onScrub) return;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      onScrub(fractionFromClientX(e.clientX));
    },
    [fractionFromClientX, onScrub],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onScrub || !draggingRef.current) return;
      onScrub(fractionFromClientX(e.clientX));
    },
    [fractionFromClientX, onScrub],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onScrub) return;
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = value + KEY_STEP;
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          next = value - KEY_STEP;
          break;
        case 'PageUp':
          next = value + KEY_STEP_LARGE;
          break;
        case 'PageDown':
          next = value - KEY_STEP_LARGE;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      onScrub(clamp01(next));
    },
    [onScrub, value],
  );

  const a11y = interactive
    ? ({
        role: 'slider',
        tabIndex: 0,
        'aria-label': 'Seek within the recording',
        'aria-orientation': 'horizontal' as const,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': percent,
        'aria-valuetext': `${percent} percent through the recording`,
      } as const)
    : ({
        role: 'progressbar',
        'aria-label': 'Playback position',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': percent,
      } as const);

  return (
    <div
      ref={wrapRef}
      className={[styles.wrap, TONE_CLASS[tone], interactive ? styles.interactive : '', playing ? styles.playing : '']
        .filter(Boolean)
        .join(' ')}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onPointerMove={interactive ? handlePointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      {...a11y}
    >
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect className={styles.axis} x={0} y={VIEW_H / 2 - 0.6} width={VIEW_W} height={1.2} />
        {shape.map((bar, i) => (
          <rect
            key={i}
            className={bar.at <= value ? `${styles.bar} ${styles.barOn}` : styles.bar}
            x={bar.x}
            y={bar.y}
            width={bar.w}
            height={bar.h}
            rx={bar.w / 2}
          />
        ))}
        <rect className={styles.head} x={value * VIEW_W - 0.9} y={0} width={1.8} height={VIEW_H} />
      </svg>
    </div>
  );
}
