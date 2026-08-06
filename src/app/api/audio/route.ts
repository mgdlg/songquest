/**
 * GET /api/audio?src=<url-encoded Xeno-canto file URL>
 *
 * A deliberately narrow streaming proxy. Xeno-canto does not send permissive
 * CORS headers, so recordings cannot be fetched from the browser; this route
 * relays them.
 *
 * SECURITY: this must never become an open proxy. The upstream host is
 * allow-listed to `xeno-canto.org` and its subdomains, https only, and the
 * allow-list is re-checked against the *final* URL after redirects — an open
 * redirect upstream must not be able to launder a third-party response through
 * us. Content types are constrained to audio so the route cannot be used to
 * serve attacker-chosen HTML from our origin.
 *
 * The upstream body is handed straight to the Response. Recordings run to tens
 * of megabytes and must never be buffered into memory.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Reads the inbound `Range` header, so the response can never be statically cached. */
export const dynamic = 'force-dynamic';

const ALLOWED_HOST = 'xeno-canto.org';

/** Statuses that carry meaning for an `<audio>` element and are relayed verbatim. */
const RELAYED_STATUSES = new Set([200, 206, 304, 416]);

/** Xeno-canto serves mp3; the wider set covers ogg/wav uploads and bare octet-stream. */
const AUDIO_CONTENT_TYPE = /^(audio\/|application\/(octet-stream|ogg))/i;

const RELAYED_HEADERS = [
  'content-type',
  'content-length',
  'accept-ranges',
  'content-range',
  'last-modified',
  'etag',
] as const;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * `URL.hostname` is already lowercased and punycode-normalised by the WHATWG
 * parser, so a suffix check here cannot be defeated by casing or unicode
 * look-alikes. The leading dot on the suffix test is what stops
 * `evil-xeno-canto.org` from matching.
 */
function isAllowedUpstream(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return host === ALLOWED_HOST || host.endsWith(`.${ALLOWED_HOST}`);
}

/** Drains and discards a body we have decided not to relay, so the socket is freed. */
async function discard(body: Response['body']): Promise<void> {
  if (!body) return;
  try {
    await body.cancel();
  } catch {
    // A cancel failure only leaks a socket for this request; nothing to report.
  }
}

export async function GET(request: Request): Promise<Response> {
  let params: URLSearchParams;
  try {
    params = new URL(request.url).searchParams;
  } catch {
    return jsonError('Malformed request URL.', 400);
  }

  const src = params.get('src');
  if (!src) {
    return jsonError('Parameter "src" is required.', 400);
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(src);
  } catch {
    return jsonError('Parameter "src" is not a valid absolute URL.', 400);
  }

  if (!isAllowedUpstream(upstreamUrl)) {
    return jsonError('Only https Xeno-canto recordings may be proxied.', 400);
  }

  const outboundHeaders = new Headers({
    accept: 'audio/*;q=0.9,*/*;q=0.5',
    'user-agent': 'SongQuest/1.0 (bird-song identification game; CC-licensed data)',
  });

  // Forwarded so the player can scrub without re-downloading the whole file.
  const range = request.headers.get('range');
  if (range) outboundHeaders.set('range', range);

  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) outboundHeaders.set('if-none-match', ifNoneMatch);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      headers: outboundHeaders,
      // No explicit timeout: a legitimate recording can take a long time on a
      // slow connection, and aborting mid-stream would truncate playback.
      redirect: 'follow',
      cache: 'no-store',
    });
  } catch {
    return jsonError('The recording could not be retrieved.', 502);
  }

  // Xeno-canto redirects download URLs to its file host. Re-checking the final
  // URL keeps an open redirect from turning this into a general-purpose proxy.
  if (upstream.url) {
    let finalUrl: URL | null = null;
    try {
      finalUrl = new URL(upstream.url);
    } catch {
      finalUrl = null;
    }
    if (!finalUrl || !isAllowedUpstream(finalUrl)) {
      await discard(upstream.body);
      return jsonError('The recording could not be retrieved.', 502);
    }
  }

  if (upstream.status === 404 || upstream.status === 410) {
    await discard(upstream.body);
    return jsonError('Recording not found.', 404);
  }

  if (!RELAYED_STATUSES.has(upstream.status)) {
    await discard(upstream.body);
    return jsonError('The recording could not be retrieved.', 502);
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  if (contentType && !AUDIO_CONTENT_TYPE.test(contentType)) {
    // An HTML error page reaching the client would execute on our origin.
    await discard(upstream.body);
    return jsonError('The recording could not be retrieved.', 502);
  }

  const headers = new Headers();
  for (const name of RELAYED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('content-type')) headers.set('content-type', 'audio/mpeg');
  if (!headers.has('accept-ranges')) headers.set('accept-ranges', 'bytes');

  headers.set('cache-control', 'public, max-age=86400, immutable');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-security-policy', "default-src 'none'; sandbox");
  // Partial responses differ by the requested byte range; without this a shared
  // cache could hand a 206 to a client that asked for the whole file.
  headers.set('vary', 'Range');

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
