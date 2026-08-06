'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';

import { RangeLegend } from './RangeLegend';
import { BASE_TILE_ATTRIBUTION, BASE_TILE_URL, MAP_DEFAULTS } from './mapConfig';
import styles from './RangeMap.module.css';

/**
 * GBIF's terms require the source credit wherever their data is rendered. It
 * lives here rather than in mapConfig because it belongs to the overlay layer,
 * and Leaflet concatenates every layer's attribution into one control.
 */
const DENSITY_ATTRIBUTION =
  'Occurrences &copy; <a href="https://www.gbif.org" target="_blank" rel="noreferrer">GBIF</a>';

/** Own pane so the overlay can be filtered and blended without touching tiles. */
const DENSITY_PANE = 'songquestDensity';

/**
 * Leaflet's internal scale: tilePane 200, overlayPane 400, markerPane 600.
 * 350 puts the density wash above the basemap and below anything interactive.
 */
const DENSITY_PANE_Z = '350';

const DENSITY_OPACITY = 0.75;

/** Web Mercator degenerates past this latitude; Leaflet clamps, we pre-empt. */
const MAX_ABS_LAT = 85;

function safeCenter(lat: number, lng: number): [number, number] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return MAP_DEFAULTS.center;
  if (Math.abs(lat) > MAX_ABS_LAT) return MAP_DEFAULTS.center;
  return [lat, lng];
}

function safeZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MAP_DEFAULTS.zoom;
  return Math.min(MAP_DEFAULTS.maxZoom, Math.max(MAP_DEFAULTS.minZoom, zoom));
}

/**
 * A species distribution plate: CARTO's label-free basemap under a GBIF
 * occurrence-density wash, framed like a printed figure.
 *
 * Leaflet reads `window` at module scope, so it is imported inside the effect;
 * nothing here runs during SSR or the first client render.
 */
export function RangeMap(props: {
  /** GBIF density tile template. Empty string renders the base plate alone. */
  tileUrl: string;
  center?: [number, number];
  /** `[[south, west], [north, east]]`. Takes precedence over centre + zoom. */
  bounds?: [[number, number], [number, number]];
  zoom?: number;
  className?: string;
  interactive?: boolean;
}) {
  const {
    tileUrl,
    center,
    bounds,
    zoom = MAP_DEFAULTS.zoom,
    className,
    interactive = false,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  /** Undoes the DOM listeners React does not own. */
  const disposeRef = useRef<(() => void) | null>(null);

  const [painted, setPainted] = useState(false);

  // Arrays are a fresh reference every render; depend on the numbers instead.
  const lat = center ? center[0] : MAP_DEFAULTS.center[0];
  const lng = center ? center[1] : MAP_DEFAULTS.center[1];
  const south = bounds ? bounds[0][0] : null;
  const west = bounds ? bounds[0][1] : null;
  const north = bounds ? bounds[1][0] : null;
  const east = bounds ? bounds[1][1] : null;

  useEffect(() => {
    // StrictMode invokes this twice in development. The cleanup below always
    // nulls `mapRef`, so a surviving instance means an unbalanced pass —
    // initialising over it throws "Map container is being reused".
    if (mapRef.current) return;
    if (!containerRef.current) return;

    let cancelled = false;
    setPainted(false);

    void (async () => {
      const mod = (await import('leaflet')) as unknown as typeof import('leaflet') & {
        default?: typeof import('leaflet');
      };
      // Leaflet is UMD: bundlers hand back either the namespace or an interop
      // wrapper with the namespace on `.default`. Both are the same object.
      const L = mod.default ?? mod;
      await import('leaflet/dist/leaflet.css');

      // The effect can be torn down mid-import; the container may already be
      // detached, and Leaflet cannot mount into a node React has discarded.
      const el = containerRef.current;
      if (cancelled || mapRef.current || !el || !el.isConnected) return;

      const map = L.map(el, {
        center: safeCenter(lat, lng),
        zoom: safeZoom(zoom),
        minZoom: MAP_DEFAULTS.minZoom,
        maxZoom: MAP_DEFAULTS.maxZoom,
        zoomControl: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        // Always off at mount. Hijacking the wheel on a scrolling page traps
        // the reader; interactive maps arm it on deliberate focus or click.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;

      // Frame the range rather than the globe. `fitBounds` overrides the centre
      // and zoom passed to the constructor, so a species with a known extent
      // opens on its own distribution instead of a world view with a smudge in
      // one corner.
      if (south !== null && west !== null && north !== null && east !== null) {
        try {
          map.fitBounds(
            [
              [south, west],
              [north, east],
            ],
            { padding: [12, 12], animate: false },
          );
        } catch {
          // A degenerate box (a species with one site) can throw; the
          // constructor's centre and zoom already stand as the fallback.
        }
      }

      // Leaflet's own flag is chrome, not a licence term.
      map.attributionControl.setPrefix('');

      const base = L.tileLayer(BASE_TILE_URL, {
        attribution: BASE_TILE_ATTRIBUTION,
        subdomains: 'abcd',
        minZoom: MAP_DEFAULTS.minZoom,
        maxZoom: MAP_DEFAULTS.maxZoom,
        noWrap: true,
      });

      // Either event clears the shimmer: a painted tile, or a failure that
      // means no tile is coming. A stuck skeleton is worse than an empty plate.
      base.once('tileload', () => {
        if (!cancelled) setPainted(true);
      });
      base.once('tileerror', () => {
        if (!cancelled) setPainted(true);
      });
      base.addTo(map);

      if (tileUrl) {
        map.createPane(DENSITY_PANE);
        const pane = map.getPane(DENSITY_PANE);
        if (pane) {
          pane.style.zIndex = DENSITY_PANE_Z;
          pane.classList.add(styles.densityPane);
        }

        L.tileLayer(tileUrl, {
          attribution: DENSITY_ATTRIBUTION,
          pane: DENSITY_PANE,
          opacity: DENSITY_OPACITY,
          minZoom: MAP_DEFAULTS.minZoom,
          maxZoom: MAP_DEFAULTS.maxZoom,
          noWrap: true,
        }).addTo(map);
      }

      const armWheel = () => {
        map.scrollWheelZoom.enable();
      };
      const disarmWheel = () => {
        map.scrollWheelZoom.disable();
      };

      if (interactive) {
        // `focus` does not bubble; `focusin` catches the zoom buttons too.
        el.addEventListener('focusin', armWheel);
        el.addEventListener('focusout', disarmWheel);
        map.on('click', armWheel);
        map.on('mouseout', disarmWheel);

        disposeRef.current = () => {
          el.removeEventListener('focusin', armWheel);
          el.removeEventListener('focusout', disarmWheel);
        };
      }

      // The frame is fluid; Leaflet caches pixel dimensions at mount.
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          if (!cancelled) map.invalidateSize({ animate: false });
        });
        observer.observe(el);
        observerRef.current = observer;
      }
    })();

    return () => {
      cancelled = true;

      observerRef.current?.disconnect();
      observerRef.current = null;

      disposeRef.current?.();
      disposeRef.current = null;

      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [tileUrl, lat, lng, south, west, north, east, zoom, interactive]);

  const label = 'Occurrence range map';

  return (
    <figure className={className ? `${styles.plate} ${className}` : styles.plate}>
      <div className={styles.frame} aria-busy={!painted}>
        <div
          ref={containerRef}
          className={interactive ? styles.canvas : `${styles.canvas} ${styles.static}`}
          // A static plate is a picture; an interactive one is a region whose
          // zoom buttons must stay reachable, so it keeps its children exposed.
          role={interactive ? 'region' : 'img'}
          aria-label={label}
          tabIndex={interactive ? 0 : -1}
        />
        <div
          className={painted ? `${styles.skeleton} ${styles.skeletonDone}` : styles.skeleton}
          aria-hidden="true"
        />
      </div>

      {interactive ? (
        <p className="srOnly">
          Use the plus and minus buttons to zoom, or the arrow keys to pan.
          Scroll-wheel zoom activates only after you click or focus the map.
        </p>
      ) : null}

      <figcaption className={styles.caption}>
        <RangeLegend />
      </figcaption>
    </figure>
  );
}
