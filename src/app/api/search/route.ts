/**
 * GET /api/search?q=<prefix>&pool=curated|master
 *
 * Typeahead source for the guess input. Backed entirely by the bundled species
 * lists — no upstream call, so it can answer on every keystroke.
 */

import { NextResponse } from 'next/server';

import { searchSpecies } from '../../../data/master-list';
import type { SpeciesOption } from '../../../types/domain';

export const runtime = 'nodejs';

const MAX_RESULTS = 12;
const MAX_QUERY_LENGTH = 64;

/** Control characters have no place in a species query and usually mean a probe. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

const POOLS = ['curated', 'master'] as const;
type Pool = (typeof POOLS)[number];

function isPool(value: string): value is Pool {
  return (POOLS as readonly string[]).includes(value);
}

export async function GET(request: Request): Promise<Response> {
  let params: URLSearchParams;
  try {
    params = new URL(request.url).searchParams;
  } catch {
    return NextResponse.json({ error: 'Malformed request URL.' }, { status: 400 });
  }

  const rawPool = (params.get('pool') ?? 'curated').trim();
  if (!isPool(rawPool)) {
    return NextResponse.json(
      { error: 'Parameter "pool" must be curated or master.' },
      { status: 400 },
    );
  }

  const q = (params.get('q') ?? '').trim();
  if (q.length > MAX_QUERY_LENGTH || CONTROL_CHARS.test(q)) {
    return NextResponse.json(
      { error: `Parameter "q" must be plain text of at most ${MAX_QUERY_LENGTH} characters.` },
      { status: 400 },
    );
  }

  // An empty prefix is the input's resting state, not an error — a typeahead
  // that 400s while the field is empty would flood the console on mount.
  let options: SpeciesOption[] = [];

  if (q.length > 0) {
    try {
      options = searchSpecies(q, rawPool, MAX_RESULTS)
        .slice(0, MAX_RESULTS)
        .map((seed) => ({
          id: seed.id,
          commonName: seed.commonName,
          scientificName: seed.scientificName,
          family: seed.family || null,
        }));
    } catch (err) {
      console.error('[songquest] /api/search failed', err);
      return NextResponse.json({ error: 'Species search is unavailable.' }, { status: 502 });
    }
  }

  return NextResponse.json(options, {
    status: 200,
    headers: {
      // The lists are compiled into the bundle, so results only change on deploy.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}
