/**
 * Deterministic daily selection.
 *
 * The bird of the day is derived, never stored: the same UTC date produces the
 * same index on every device with no server round-trip and no shared state. All
 * date arithmetic is UTC — a player in Auckland and a player in Los Angeles are
 * looking at the same specimen at the same instant.
 */

/** Salt that makes the hardcore daily draw a different bird from the standard one. */
export const HARDCORE_SALT = 'hardcore';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * `"2026-08-02"`, always UTC.
 *
 * Built from the UTC getters rather than `toISOString().split('T')` so nothing
 * can silently reintroduce the local timezone, and so an unparseable Date fails
 * to a fixed key instead of throwing mid-render.
 */
export function todayKey(now: Date = new Date()): string {
  const ms = now.getTime();
  const d = Number.isNaN(ms) ? new Date(0) : now;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function isDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const parsed = parseDateKey(value);
  // Rejects "2026-02-31", which Date.UTC would happily roll into March.
  return parsed !== null && todayKey(parsed) === value;
}

/** Midnight UTC on the given key, or null if the key is malformed. */
export function parseDateKey(key: string): Date | null {
  if (!DATE_KEY_PATTERN.test(key)) return null;
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const day = Number(key.slice(8, 10));
  const ms = Date.UTC(year, month - 1, day);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** The key for the UTC day before `key`; used by streak arithmetic. */
export function previousDateKey(key: string): string | null {
  const date = parseDateKey(key);
  if (date === null) return null;
  return todayKey(new Date(date.getTime() - 86_400_000));
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a over UTF-16 code units, finished with the Murmur3 `fmix32` avalanche.
 *
 * The finaliser is not optional. Plain FNV-1a over two consecutive date keys
 * differs by a *constant* — the prime times the XOR delta of the final byte —
 * which survives `% poolSize` as a fixed stride, and a fixed stride through a
 * species list is exactly the pattern a daily player notices by week two.
 */
export function hashDate(dateKey: string, salt = ''): number {
  const input = salt.length > 0 ? `${dateKey}|${salt}` : dateKey;

  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h = Math.imul(h ^ (code & 0xff), FNV_PRIME) >>> 0;
    if (code > 0xff) {
      h = Math.imul(h ^ (code >>> 8), FNV_PRIME) >>> 0;
    }
  }

  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;

  return h >>> 0;
}

/**
 * Mulberry32. Every step is forced back into uint32 space with `>>> 0`, which is
 * what makes the sequence identical across engines; a 32-bit state that drifts
 * into float territory would desynchronise devices.
 */
export function mulberry32(seed: number): () => number {
  let state = (Number.isFinite(seed) ? seed : 0) >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UINT32_RANGE = 4294967296;

/**
 * Uniform index into a pool of `poolSize`.
 *
 * Rejection-sampled rather than plain modulo: with 2^32 draws and a pool in the
 * hundreds the modulo bias is tiny, but "tiny" compounds over a year of dailies
 * and this costs one extra draw in the worst case.
 */
export function pickDailyIndex(dateKey: string, poolSize: number, salt = ''): number {
  if (!Number.isFinite(poolSize) || poolSize < 1) return 0;

  const size = Math.floor(poolSize);
  if (size === 1) return 0;

  const next = mulberry32(hashDate(dateKey, salt));
  const limit = Math.floor(UINT32_RANGE / size) * size;

  let draw = 0;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    draw = Math.floor(next() * UINT32_RANGE) >>> 0;
    if (draw < limit) break;
  }

  return draw % size;
}
