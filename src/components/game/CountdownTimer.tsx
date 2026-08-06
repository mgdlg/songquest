'use client';

import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import styles from './CountdownTimer.module.css';

export function CountdownTimer(props: {
  secondsRemaining: number;
  total: number;
  warnAt?: number;
}): JSX.Element {
  const warnAt = props.warnAt ?? 5;
  const total = Number.isFinite(props.total) && props.total > 0 ? props.total : 0;
  const raw = Number.isFinite(props.secondsRemaining) ? props.secondsRemaining : 0;
  const seconds = Math.max(0, Math.min(Math.ceil(raw), total || Math.ceil(raw)));
  const fraction = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const warning = seconds <= warnAt;

  /**
   * `role="timer"` with a per-second live region would make a screen reader
   * recite every tick. The visible readout stays silent (`aria-live="off"`)
   * and a separate polite region speaks exactly once, when the clock crosses
   * the warning threshold.
   */
  const [announcement, setAnnouncement] = useState('');
  const announcedRef = useRef(false);

  useEffect(() => {
    if (seconds > warnAt) {
      // The clock was refilled for a new attempt; re-arm the single warning.
      announcedRef.current = false;
      setAnnouncement('');
      return;
    }
    if (seconds <= 0) {
      if (!announcedRef.current) return;
      setAnnouncement('Time expired.');
      return;
    }
    if (!announcedRef.current) {
      announcedRef.current = true;
      setAnnouncement(`${seconds} seconds remaining.`);
    }
  }, [seconds, warnAt]);

  return (
    <div className={`${styles.timer} ${warning ? styles.warn : ''}`}>
      <div
        role="timer"
        aria-live="off"
        aria-label={`Time remaining on this attempt: ${seconds} seconds`}
        className={styles.readout}
      >
        <span className={styles.numerals} aria-hidden="true">
          {seconds}
        </span>
        <span className={styles.unit} aria-hidden="true">
          sec
        </span>
      </div>

      <div className={styles.track} aria-hidden="true">
        <div className={styles.fill} style={{ transform: `scaleX(${fraction})` }} />
      </div>

      <div className="srOnly" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
