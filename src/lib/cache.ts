/**
 * Server-side warm cache, plus the shared HTTP helper every API client uses.
 *
 * The cache is a per-process `Map`, so it is a latency optimisation and never a
 * correctness guarantee: serverless instances come and go, and two instances
 * disagree freely. Nothing may depend on a value surviving.
 *
 * `fetchJson` lives here rather than in its own `http.ts` because the build
 * partitions file ownership per agent and this module is the one shared home
 * the API clients are all permitted to import.
 */

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

interface CacheEntry {
  value: unknown;
  /** Epoch ms. */
  expiresAt: number;
}

/** Bounded so a long-lived instance cannot grow without limit. */
const MAX_ENTRIES = 500;

const store = new Map<string, CacheEntry>();

/**
 * Promises for keys currently being fetched. Two concurrent `cached()` calls
 * for one key must issue a single upstream request — Xeno-canto and iNaturalist
 * both rate-limit anonymous traffic, and a cold start can fan out four
 * identical dossier requests at once.
 */
const inflight = new Map<string, Promise<unknown>>();

export const TTL: {
  readonly SPECIES: number;
  readonly SEARCH: number;
  readonly DAILY: number;
} = {
  SPECIES: 6 * 60 * 60 * 1000,
  SEARCH: 30 * 60 * 1000,
  DAILY: 24 * 60 * 60 * 1000,
};

/**
 * Distinguishes "absent" from "present and legitimately null" — `cacheGet`
 * cannot, because its contract collapses both onto `null`.
 */
function lookup(key: string): { hit: true; value: unknown } | { hit: false } {
  const entry = store.get(key);
  if (entry === undefined) return { hit: false };
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return { hit: false };
  }
  return { hit: true, value: entry.value };
}

export function cacheGet<T>(key: string): T | null {
  const found = lookup(key);
  return found.hit ? (found.value as T) : null;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  // Re-inserting moves the key to the back of the iteration order, which is
  // what makes eviction-by-oldest-write correct.
  store.delete(key);
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (store.size > MAX_ENTRIES) evict();
}

function evict(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
  // `Map` iterates in insertion order, so the front of the key iterator is the
  // oldest write. Deleting during iteration of a Map is well defined.
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (oldest.done === true) break;
    store.delete(oldest.value);
  }
}

/**
 * Read-through cache with in-flight de-duplication.
 *
 * A rejected `fn` is deliberately *not* cached: transient upstream failures
 * would otherwise poison the key for a full TTL. Callers that want a failure to
 * degrade rather than propagate should attach their own `.catch`.
 */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const found = lookup(key);
  if (found.hit) return Promise.resolve(found.value as T);

  const existing = inflight.get(key);
  if (existing !== undefined) return existing as Promise<T>;

  const pending = (async () => {
    const value = await fn();
    cacheSet(key, value, ttlMs);
    return value;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, pending);
  return pending;
}

/** Test/maintenance seam: drops every entry and forgets in-flight work. */
export function cacheClear(): void {
  store.clear();
  inflight.clear();
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

/**
 * Upstream budget. A route handler blocked on a slow third party is worse than
 * a route handler that degrades, so this is deliberately short.
 */
export const DEFAULT_TIMEOUT_MS = 8_000;

export type FetchOutcome<T> =
  | { ok: true; status: number; data: T; error: null }
  | { ok: false; status: number; data: null; error: string };

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Caller-supplied cancellation, combined with the timeout. */
  signal?: AbortSignal;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'unknown network error';
}

/**
 * GETs JSON with a hard timeout and a typed result.
 *
 * This function never rejects. Every failure mode — DNS, timeout, non-200,
 * truncated or malformed body — comes back as `{ ok: false }`, so no upstream
 * hiccup can surface as an unhandled rejection inside a route handler.
 */
export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<FetchOutcome<T>> {
  const { headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = (): void => controller.abort();

  if (signal !== undefined) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...headers },
      signal: controller.signal,
      redirect: 'follow',
      // Our own cache is the caching layer; Next's data cache would only
      // duplicate it with a different, invisible TTL.
      cache: 'no-store',
    });

    if (!res.ok) {
      // Drain the body so the connection returns to the pool.
      await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`,
      };
    }

    const text = await res.text();
    if (text.trim() === '') {
      return { ok: false, status: res.status, data: null, error: 'empty response body' };
    }

    try {
      return { ok: true, status: res.status, data: JSON.parse(text) as T, error: null };
    } catch {
      return { ok: false, status: res.status, data: null, error: 'malformed JSON response' };
    }
  } catch (err) {
    const timedOut = controller.signal.aborted;
    return {
      ok: false,
      status: 0,
      data: null,
      error: timedOut ? `request aborted after ${timeoutMs}ms` : messageOf(err),
    };
  } finally {
    clearTimeout(timer);
    if (signal !== undefined) signal.removeEventListener('abort', forwardAbort);
  }
}
