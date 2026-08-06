/**
 * GET /api/daily?mode=daily-standard|daily-hardcore
 *
 * The bird of the day. The index is derived purely from the UTC date via
 * `pickDailyIndex`, so every device computes the same puzzle without any shared
 * state; hardcore salts the hash so it draws a different species from the
 * larger pool on the same date.
 */

import { NextResponse } from 'next/server';

import { speciesForRegion } from '../../../data/master-list';
import {
  DEFAULT_REGION,
  getRegion,
  isRegionId,
  type RegionId,
} from '../../../lib/regions';
import {
  buildDossier,
  SpeciesServiceError,
  toErrorResponse,
} from '../../../lib/api/speciesService';
import { pickDailyIndex, todayKey } from '../../../lib/game/daily';
import type { SpeciesDossier } from '../../../types/domain';

export const runtime = 'nodejs';

const DAILY_MODES = ['daily-standard', 'daily-hardcore'] as const;
type DailyMode = (typeof DAILY_MODES)[number];

const HARDCORE_SALT = 'hardcore';

/** Below this a region borrows its continent's pool. Mirrors GameContext. */
const MIN_REGION_POOL = 12;

/**
 * How many consecutive pool entries may be tried before giving up.
 *
 * A seed occasionally has no licence-clean song on Xeno-canto, which would
 * otherwise take the whole day's puzzle offline. The walk is deterministic
 * (index, index+1, …) so two players who hit the same missing recording still
 * land on the same replacement bird.
 */
const MAX_SEED_ATTEMPTS = 4;

const MS_PER_DAY = 86_400_000;

function isDailyMode(value: string): value is DailyMode {
  return (DAILY_MODES as readonly string[]).includes(value);
}

/** A seed whose audio simply does not exist is worth skipping; a flaky network is not. */
function isSkippableSeed(err: unknown): boolean {
  return (
    err instanceof SpeciesServiceError && (err.code === 'no-audio' || err.code === 'not-found')
  );
}

/** Seconds remaining until the puzzle rolls over, floored so a CDN never overshoots. */
function secondsUntilUtcMidnight(now: number): number {
  const remaining = MS_PER_DAY - (now % MS_PER_DAY);
  return Math.max(60, Math.floor(remaining / 1000));
}

export async function GET(request: Request): Promise<Response> {
  let params: URLSearchParams;
  try {
    params = new URL(request.url).searchParams;
  } catch {
    return NextResponse.json({ error: 'Malformed request URL.' }, { status: 400 });
  }

  const mode = (params.get('mode') ?? '').trim();
  if (!isDailyMode(mode)) {
    return NextResponse.json(
      { error: 'Parameter "mode" must be daily-standard or daily-hardcore.' },
      { status: 400 },
    );
  }

  const hardcore = mode === 'daily-hardcore';

  // An unknown or missing region is not an error: it predates the region
  // picker, or the player cleared storage. Fall back to the whole continent.
  const requested = (params.get('region') ?? '').trim();
  const region: RegionId = isRegionId(requested) ? requested : DEFAULT_REGION;

  const beginner = params.get('beginner') === '1';
  const tier = hardcore ? 'master' : 'curated';
  const regional = speciesForRegion(tier, region, { beginner });

  // A thin region borrows its continent's pool rather than serving the same
  // handful of birds every day. The same threshold governs practice.
  const pool =
    regional.length >= MIN_REGION_POOL
      ? regional
      : speciesForRegion(
          tier,
          getRegion(region)?.continent === 'eu' ? 'europe' : 'north-america',
          { beginner },
        );

  if (pool.length === 0) {
    console.error('[songquest] /api/daily has an empty species pool for mode', mode);
    return NextResponse.json(
      { error: "Today's puzzle is unavailable." },
      { status: 502 },
    );
  }

  const date = todayKey();
  // The region joins the salt, so two players in different regions get
  // different birds on the same date while each stays deterministic for
  // everyone birding the same place.
  const salt = `${region}${hardcore ? `|${HARDCORE_SALT}` : ''}`;
  const index = pickDailyIndex(date, pool.length, salt);

  let species: SpeciesDossier | null = null;
  let lastError: unknown = null;

  for (let step = 0; step < MAX_SEED_ATTEMPTS && step < pool.length; step += 1) {
    const seed = pool[(((index + step) % pool.length) + pool.length) % pool.length];
    if (!seed) continue;
    try {
      species = await buildDossier({
        inatTaxonId: seed.inatTaxonId ?? undefined,
        scientificName: seed.scientificName,
      });
      break;
    } catch (err) {
      lastError = err;
      if (!isSkippableSeed(err)) break;
      console.error(
        `[songquest] daily seed "${seed.scientificName}" has no usable audio; advancing`,
      );
    }
  }

  if (!species) {
    console.error('[songquest] /api/daily failed', lastError);
    const { status, body } = toErrorResponse(lastError);
    return NextResponse.json(body, { status });
  }

  return NextResponse.json(
    { date, species },
    {
      status: 200,
      headers: {
        // Shared caches may hold today's puzzle, but only until UTC midnight —
        // after that the date key changes and so does the answer.
        'Cache-Control':
          `public, max-age=0, s-maxage=${secondsUntilUtcMidnight(Date.now())}, ` +
          'stale-while-revalidate=60',
      },
    },
  );
}
