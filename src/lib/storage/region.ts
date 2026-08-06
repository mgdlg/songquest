/**
 * The chosen region, kept under its own key rather than inside the versioned
 * `PersistedState` blob.
 *
 * It is a preference, not a record: it has no bearing on streaks or rank, it
 * changes far more often than the stats do, and folding it into that payload
 * would mean a schema bump and a migration every time the region tree grows.
 */

import { DEFAULT_REGION, isRegionId, type RegionId } from '@/lib/regions'

export const REGION_KEY = 'songquest.region'

export function loadRegion(): RegionId {
  if (typeof window === 'undefined') return DEFAULT_REGION
  try {
    const raw = window.localStorage.getItem(REGION_KEY)
    return raw && isRegionId(raw) ? raw : DEFAULT_REGION
  } catch {
    // Private browsing and blocked storage both throw here. A default region is
    // a perfectly playable game; a crash on load is not.
    return DEFAULT_REGION
  }
}

export function saveRegion(id: RegionId): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(REGION_KEY, id)
  } catch {
    // Nothing to do: the session simply will not remember the choice.
  }
}

/* ------------------------------------------------------------------ */
/* Beginner mode                                                       */
/* ------------------------------------------------------------------ */

export const BEGINNER_KEY = 'songquest.beginner'

/** Same reasoning as the region: a preference, not a record. */
export function loadBeginner(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(BEGINNER_KEY) === '1'
  } catch {
    return false
  }
}

export function saveBeginner(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BEGINNER_KEY, on ? '1' : '0')
  } catch {
    // Ignored: the session simply will not remember the choice.
  }
}
