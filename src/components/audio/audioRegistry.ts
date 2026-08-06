/**
 * Module-scope registry of every mounted <audio> element in the app.
 *
 * A round can show three clips at once and a species card shows three more.
 * Without a single owner of "who is allowed to make noise", two recordings
 * overlap and the player cannot tell song from call — which is the entire
 * skill the game tests. Every player registers on mount and MUST unregister
 * on unmount: a detached media element left in the Set keeps its decoder and
 * buffer alive for the lifetime of the tab, and rounds cycle often.
 *
 * Not exported as a React context on purpose — the seam is one element per
 * player and nothing else needs to observe it.
 */

const elements = new Set<HTMLAudioElement>();

export function registerAudio(el: HTMLAudioElement): void {
  elements.add(el);
}

export function unregisterAudio(el: HTMLAudioElement): void {
  elements.delete(el);
}

/**
 * Pause every registered element except `except`. Safe to call before a
 * play() that may still reject; pausing an already-paused element is a no-op
 * and never throws.
 */
export function pauseOthers(except?: HTMLAudioElement | null): void {
  elements.forEach((el) => {
    if (el === except) return;
    if (!el.paused) el.pause();
  });
}

/** Silence everything — used when a round resolves and the surface changes. */
export function pauseAllAudio(): void {
  pauseOthers(null);
}

/** Number of live players. Exposed for assertions in development only. */
export function registeredAudioCount(): number {
  return elements.size;
}
