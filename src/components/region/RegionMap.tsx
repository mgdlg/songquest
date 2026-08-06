'use client'

import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Path } from 'leaflet'

import { BASE_TILE_ATTRIBUTION, BASE_TILE_URL } from '@/components/map/mapConfig'
import { getRegion, type Region, type RegionId } from '@/lib/regions'

import styles from './RegionMap.module.css'

export interface RegionMapProps {
  /** The regions offered at this step. */
  options: readonly Region[]
  /** Frames the map; usually the parent region, or the world at the first step. */
  frame: readonly [readonly [number, number], readonly [number, number]] | null
  selected: RegionId | null
  onSelect: (id: RegionId) => void
  className?: string
}

/** Reads a pastel fill off the cascade so the palette stays in globals.css. */
function toneValue(token: string): string {
  if (typeof window === 'undefined') return '#cccccc'
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return value || '#cccccc'
}

/**
 * A pastel selection plate. Real coastlines come from the basemap; the regions
 * are schematic polygons laid over it, so the player recognises the shape of
 * the world without the polygons pretending to be borders.
 */
export function RegionMap({ options, frame, selected, onSelect, className }: RegionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const layersRef = useRef<Map<RegionId, Path>>(new Map())
  /** Latest callback, so the click handler never closes over a stale one. */
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // Options and frame are fresh arrays each render; key the effect on their
  // content so it re-runs when the step changes and not on every parent render.
  const optionKey = options.map((o) => o.id).join(',')
  const frameKey = frame ? frame.flat().join(',') : 'world'

  useEffect(() => {
    if (mapRef.current) return
    if (!containerRef.current) return

    let cancelled = false

    void (async () => {
      const mod = (await import('leaflet')) as unknown as typeof import('leaflet') & {
        default?: typeof import('leaflet')
      }
      const L = mod.default ?? mod
      await import('leaflet/dist/leaflet.css')

      const el = containerRef.current
      if (cancelled || mapRef.current || !el || !el.isConnected) return

      const map = L.map(el, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: true,
        // The polygons are the interface; panning would only let the player
        // lose the very shapes they are meant to be choosing between.
        worldCopyJump: false,
      })
      mapRef.current = map

      L.tileLayer(BASE_TILE_URL, {
        attribution: BASE_TILE_ATTRIBUTION,
        maxZoom: 8,
        minZoom: 1,
      }).addTo(map)

      if (!cancelled) setReady(true)
    })()

    return () => {
      cancelled = true
      layersRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Polygons are rebuilt per step rather than mutated: each step offers a
  // different set, and reconciling additions against removals costs more than
  // redrawing a dozen rings.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    let cancelled = false

    void (async () => {
      const mod = (await import('leaflet')) as unknown as typeof import('leaflet') & {
        default?: typeof import('leaflet')
      }
      const L = mod.default ?? mod
      if (cancelled || !mapRef.current) return

      for (const layer of layersRef.current.values()) layer.remove()
      layersRef.current.clear()

      for (const region of options) {
        const fill = toneValue(region.tone)
        const polygon = L.polygon(region.shape as [number, number][], {
          color: fill,
          weight: 1.5,
          opacity: 0.9,
          fillColor: fill,
          fillOpacity: 0.55,
          className: styles.zone as string,
        })

        polygon.on('click', () => onSelectRef.current(region.id))
        polygon.on('mouseover', () => polygon.setStyle({ fillOpacity: 0.78, weight: 2.5 }))
        polygon.on('mouseout', () =>
          polygon.setStyle({
            fillOpacity: region.id === selected ? 0.8 : 0.55,
            weight: region.id === selected ? 2.5 : 1.5,
          }),
        )

        polygon.bindTooltip(region.label, {
          permanent: true,
          direction: 'center',
          className: styles.zoneLabel as string,
        })

        polygon.addTo(map)
        layersRef.current.set(region.id, polygon)
      }

      const target = frame ?? [
        [-56, -170],
        [72, 60],
      ]
      try {
        map.fitBounds(target as [[number, number], [number, number]], {
          padding: [16, 16],
          animate: false,
        })
      } catch {
        map.setView([30, -40], 2)
      }
      map.invalidateSize()
    })()

    return () => {
      cancelled = true
    }
  }, [optionKey, frameKey, ready, options, frame, selected])

  // Selection styling is its own pass so choosing a region does not redraw the
  // polygons — a redraw would drop the tooltips and flicker the whole plate.
  useEffect(() => {
    for (const [id, layer] of layersRef.current) {
      const isSelected = id === selected
      layer.setStyle({
        fillOpacity: isSelected ? 0.8 : 0.55,
        weight: isSelected ? 2.5 : 1.5,
      })
    }
  }, [selected])

  return (
    <div className={className ? `${styles.frame} ${className}` : styles.frame}>
      <div ref={containerRef} className={styles.canvas} role="application" aria-label="Region map" />
      {!ready ? <div className={styles.shimmer} aria-hidden="true" /> : null}
    </div>
  )
}

/** Convenience for callers that hold an id rather than a Region. */
export function regionOrNull(id: string | null): Region | null {
  return id ? getRegion(id) : null
}
