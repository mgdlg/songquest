/**
 * GET /api/species?id=<inatTaxonId>
 * GET /api/species?name=<scientificName>
 *
 * Returns a fully assembled `SpeciesDossier`. Redaction of the description
 * snippet happens server-side (ARCHITECTURE §3.3) so the puzzle text is never
 * shipped un-redacted in the field the UI renders during play.
 */

import { NextResponse } from 'next/server';

import { buildDossier, toErrorResponse } from '../../../lib/api/speciesService';

export const runtime = 'nodejs';

/** Binomials are Latin; the range stays deliberately narrow to reject junk early. */
const SCIENTIFIC_NAME = /^[A-Za-z\u00c0-\u00ff][A-Za-z\u00c0-\u00ff .'-]{2,79}$/;
const TAXON_ID = /^[0-9]{1,9}$/;

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request): Promise<Response> {
  let params: URLSearchParams;
  try {
    params = new URL(request.url).searchParams;
  } catch {
    return badRequest('Malformed request URL.');
  }

  const rawId = (params.get('id') ?? '').trim();
  const rawName = (params.get('name') ?? '').trim();

  if (!rawId && !rawName) {
    return badRequest('Supply either ?id=<iNaturalist taxon id> or ?name=<scientific name>.');
  }
  if (rawId && !TAXON_ID.test(rawId)) {
    return badRequest('Parameter "id" must be a positive iNaturalist taxon id.');
  }
  if (rawName && !SCIENTIFIC_NAME.test(rawName)) {
    return badRequest('Parameter "name" must be a scientific name, 3–80 letters.');
  }

  const inatTaxonId = rawId ? Number.parseInt(rawId, 10) : undefined;
  if (inatTaxonId !== undefined && (!Number.isSafeInteger(inatTaxonId) || inatTaxonId <= 0)) {
    return badRequest('Parameter "id" must be a positive iNaturalist taxon id.');
  }

  try {
    const species = await buildDossier({
      inatTaxonId,
      scientificName: rawName || undefined,
    });

    return NextResponse.json(species, {
      status: 200,
      headers: {
        // Dossiers are assembled from CC data that changes on the scale of
        // months; a long shared cache keeps us polite to iNaturalist and
        // Xeno-canto without the client ever seeing a stale round.
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    console.error('[songquest] /api/species failed', err);
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
