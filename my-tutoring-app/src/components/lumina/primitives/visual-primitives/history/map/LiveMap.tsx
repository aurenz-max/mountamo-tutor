'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as MlMap, Marker as MlMarker, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { geoContains } from 'd3-geo';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  CONTINENT_FEATURES, CONTINENT_FILL, REGION_ANCHOR, REGION_NAME, WATER_FEATURES, isContinent,
  type ContinentId, type RegionId, type WaterId,
} from './mapGeo';
import { PLACE_EMOJI, type TownMap } from './mapModel';

/** Free vector tiles, no key (openfreemap.org; data © OpenStreetMap contributors). */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Point-of-interest layers in that style: hidden, so the lesson's own pins are the only places on the map. */
const POI_LAYERS = /^(poi|airport)/;
/** The whole globe fits the frame. */
const WORLD_ZOOM = 0.9;

export interface LiveMapProps {
  /** world: the globe with bright continents and no names; town: the real city with the lesson's places. */
  view: 'world' | 'town';
  town?: TownMap;
  /** Changes whenever an ask opens: the camera moves to frame it. */
  viewKey: string;
  /** Town: the map's bearing when the ask opens (0 = north up). */
  bearing: number;
  /** World: names drawn on the globe. */
  labels: ReadonlySet<RegionId>;
  /** World: the continent the ask starts from, outlined in yellow. */
  highlightRegion?: RegionId | null;
  /** World: regions found this session, outlined in white. */
  found?: ReadonlySet<RegionId>;
  flash?: { id: string; correct: boolean; key: string } | null;
  /** World: turn to face this point (after a find). */
  focus?: { lon: number; lat: number; key: string } | null;
  /** Town: taps on pins are answers. */
  placesTappable?: boolean;
  /** Town: the place the ask names (yellow ring) and the answer once found (green ring). */
  highlightPlaceId?: string | null;
  foundPlaceId?: string | null;
  /** build_route: the planned flight and how far along it the helicopter is. */
  flight?: { points: { lat: number; lng: number }[]; at: number } | null;
  disabled?: boolean;
  onTapRegion?: (id: ContinentId | WaterId) => void;
  onTapPlace?: (id: string, viewBearing: number) => void;
  /** The map's bearing, whenever the learner turns it. */
  onBearing?: (bearing: number) => void;
  className?: string;
}

/** The water a world tap landed on, from the ocean regions (seas drawn last win). */
function waterAt(lng: number, lat: number): WaterId | null {
  for (const w of [...WATER_FEATURES].reverse()) if (geoContains(w.geometry, [lng, lat])) return w.id;
  return null;
}

const continentsGeoJSON = {
  type: 'FeatureCollection' as const,
  features: CONTINENT_FEATURES.map(f => ({ ...f, properties: { id: f.properties.id, fill: CONTINENT_FILL[f.properties.id] } })),
};
const waterGeoJSON = {
  type: 'FeatureCollection' as const,
  features: WATER_FEATURES.filter(w => w.id !== 'sea').map(w => ({ type: 'Feature' as const, properties: { id: w.id }, geometry: w.geometry })),
};

/**
 * A real map, from space to the street: MapLibre GL with a globe projection over OpenFreeMap's OpenStreetMap
 * tiles. Drag to spin or pan, scroll or pinch to zoom, right-drag or twist to turn the map. Land and water
 * taps are answers on the world; the lesson's places are buttons pinned at their true coordinates in a city.
 */
export function LiveMap(props: LiveMapProps) {
  const { view, town, viewKey, bearing, labels, highlightRegion, found, flash, focus, placesTappable, highlightPlaceId,
    foundPlaceId, flight, disabled, className } = props;
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tilt, setTilt] = useState(false);
  const latest = useRef(props); latest.current = props;
  const placeMarkers = useRef<Map<string, { marker: MlMarker; el: HTMLButtonElement }>>(new Map());
  const labelMarkers = useRef<MlMarker[]>([]);
  const heli = useRef<MlMarker | null>(null);

  // ── Create the map once ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lib = await import('maplibre-gl');
        if (cancelled || !host.current) return;
        libRef.current = lib;
        const start = view === 'town' && town ? { center: [town.center.lng, town.center.lat] as [number, number], zoom: 1.6 }
          : { center: [10, 18] as [number, number], zoom: WORLD_ZOOM };
        const map = new lib.Map({
          container: host.current, style: STYLE_URL, ...start, attributionControl: { compact: true },
          dragRotate: true, touchPitch: false, maxPitch: 60, renderWorldCopies: false,
        });
        mapRef.current = map;
        // Browser drives reach the map through its container (they project a continent to a screen point to tap it).
        (host.current as HTMLDivElement & { __map?: MlMap }).__map = map;
        map.on('style.load', () => {
          map.setProjection({ type: 'globe' });
          map.addSource('continents', { type: 'geojson', data: continentsGeoJSON });
          map.addSource('water', { type: 'geojson', data: waterGeoJSON });
          map.addSource('flight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          const fade = ['interpolate', ['linear'], ['zoom'], 3, 0.9, 5, 0] as const;
          map.addLayer({ id: 'continents-fill', type: 'fill', source: 'continents',
            paint: { 'fill-color': ['get', 'fill'], 'fill-opacity': fade as never } });
          map.addLayer({ id: 'continents-found', type: 'line', source: 'continents', filter: ['in', ['get', 'id'], ['literal', []]],
            paint: { 'line-color': '#ffffff', 'line-width': 2.5 } });
          map.addLayer({ id: 'water-found', type: 'line', source: 'water', filter: ['in', ['get', 'id'], ['literal', []]],
            paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [3, 3] } });
          map.addLayer({ id: 'continents-highlight', type: 'line', source: 'continents', filter: ['==', ['get', 'id'], ''],
            paint: { 'line-color': '#facc15', 'line-width': 4 } });
          map.addLayer({ id: 'flash-land', type: 'fill', source: 'continents', filter: ['==', ['get', 'id'], ''],
            paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.7 } });
          map.addLayer({ id: 'flash-water', type: 'fill', source: 'water', filter: ['==', ['get', 'id'], ''],
            paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.45 } });
          map.addLayer({ id: 'flight-line', type: 'line', source: 'flight',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-dasharray': [0.5, 2] } });
          setReady(true);
        });
        map.on('rotate', () => latest.current.onBearing?.(map.getBearing()));
        map.on('click', (e: MapMouseEvent) => {
          const p = latest.current;
          if (p.view !== 'world' || p.disabled || !p.onTapRegion) return;
          const hit = map.queryRenderedFeatures(e.point, { layers: ['continents-fill'] })[0];
          const id = (hit?.properties?.id as ContinentId | undefined) ?? waterAt(e.lngLat.lng, e.lngLat.lat);
          if (id) p.onTapRegion(id);
        });
      } catch (err) {
        console.warn('[MapExplorer] map unavailable:', err);
        if (!cancelled) setFailed('This map needs WebGL, which this browser does not have.');
      }
    })();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Which base-map labels show: none on the world (they would name the answers); streets in a city ──
  // The world is a deep-blue globe; a city keeps the street map's own pale water.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const layer of map.getStyle().layers ?? []) {
      if (layer.type !== 'symbol') continue;
      const show = view === 'town' && !POI_LAYERS.test(layer.id);
      map.setLayoutProperty(layer.id, 'visibility', show ? 'visible' : 'none');
    }
    if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color',
      ['interpolate', ['linear'], ['zoom'], 3, '#1d4ed8', 6, 'rgb(158,189,255)'] as never);
  }, [ready, view]);

  // ── Camera: frame each ask ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, lib = libRef.current;
    if (!ready || !map || !lib) return;
    if (view === 'world') {
      if (map.getZoom() > 3) map.flyTo({ center: [10, 18], zoom: WORLD_ZOOM, bearing: 0, pitch: 0, duration: 2500 });
      else map.easeTo({ bearing: 0, pitch: 0, duration: 600 });
      return;
    }
    if (!town?.places.length) return;
    const bounds = new lib.LngLatBounds();
    town.places.forEach(p => bounds.extend([p.lng, p.lat]));
    const cam = map.cameraForBounds(bounds, { padding: 70, bearing });
    if (!cam) return;
    // From space the first time: a long flight down to the city.
    const fromSpace = map.getZoom() < 6;
    map.flyTo({ ...cam, bearing, pitch: tilt ? 50 : 0, duration: fromSpace ? 4200 : 1200, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, view, viewKey]);

  // Only a toggle eases the pitch: an ease started beside a camera flight would cancel the flight.
  const lastTilt = useRef(tilt);
  useEffect(() => {
    const map = mapRef.current;
    if (lastTilt.current === tilt) return;
    lastTilt.current = tilt;
    if (ready && map && view === 'town') map.easeTo({ pitch: tilt ? 50 : 0, duration: 800 });
  }, [ready, tilt, view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus || view !== 'world') return;
    map.easeTo({ center: [focus.lon, Math.max(-60, Math.min(60, focus.lat))], duration: 1400 });
  }, [ready, focus?.key, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── World overlays: found, highlight, flash, names ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, lib = libRef.current;
    if (!ready || !map || !lib) return;
    const foundIds = Array.from(found ?? []);
    map.setFilter('continents-found', ['in', ['get', 'id'], ['literal', foundIds.filter(isContinent)]]);
    map.setFilter('water-found', ['in', ['get', 'id'], ['literal', foundIds.filter(id => !isContinent(id))]]);
    map.setFilter('continents-highlight', ['==', ['get', 'id'], view === 'world' ? highlightRegion ?? '' : '']);
    labelMarkers.current.forEach(m => m.remove());
    labelMarkers.current = view !== 'world' ? [] : Array.from(labels).map(id => {
      const el = document.createElement('div');
      const ocean = !isContinent(id);
      el.textContent = REGION_NAME[id].replace(/^the /, '');
      el.className = ocean
        ? 'pointer-events-none select-none text-[13px] font-semibold italic text-sky-100 [text-shadow:0_1px_3px_rgba(2,6,23,.9)]'
        : 'pointer-events-none select-none rounded-full bg-white/85 px-2 py-0.5 text-[13px] font-extrabold text-slate-900 shadow';
      return new lib.Marker({ element: el, opacityWhenCovered: '0' } as never).setLngLat(REGION_ANCHOR[id]).addTo(map);
    });
  }, [ready, view, labels, found, highlightRegion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !flash) return;
    const land = isContinent(flash.id);
    const layer = land ? 'flash-land' : 'flash-water';
    map.setPaintProperty(layer, land ? 'fill-color' : 'fill-color', flash.correct ? '#ffffff' : '#f43f5e');
    map.setFilter(layer, ['==', ['get', 'id'], flash.id]);
    const t = setTimeout(() => { if (mapRef.current) map.setFilter(layer, ['==', ['get', 'id'], '']); }, 900);
    return () => clearTimeout(t);
  }, [ready, flash?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── City pins: the lesson's places, at their true coordinates ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, lib = libRef.current;
    if (!ready || !map || !lib) return;
    placeMarkers.current.forEach(({ marker }) => marker.remove());
    placeMarkers.current.clear();
    if (view !== 'town' || !town) return;
    for (const p of town.places) {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('data-pip-object', p.id);
      el.setAttribute('aria-label', p.name);
      el.innerHTML = `<span class="lm-pin-icon"><span class="lm-pin-glyph">${PLACE_EMOJI[p.kind]}</span></span><span class="lm-pin-name"></span>`;
      (el.querySelector('.lm-pin-name') as HTMLElement).textContent = p.name;
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        const cur = latest.current;
        if (cur.placesTappable && !cur.disabled) cur.onTapPlace?.(p.id, mapRef.current?.getBearing() ?? 0);
      });
      const marker = new lib.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map);
      placeMarkers.current.set(p.id, { marker, el });
    }
  }, [ready, view, town]);

  useEffect(() => {
    placeMarkers.current.forEach(({ el }, id) => {
      el.className = [
        'lm-pin', placesTappable && !disabled ? 'lm-pin-tappable' : '',
        id === foundPlaceId ? 'lm-pin-found' : id === highlightPlaceId ? 'lm-pin-start' : '',
        flash?.id === id ? (flash.correct ? 'lm-pin-right' : 'lm-pin-wrong') : '',
      ].join(' ');
      el.disabled = !placesTappable || !!disabled;
    });
  });

  // ── The helicopter's flight ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, lib = libRef.current;
    if (!ready || !map || !lib) return;
    const pts = flight?.points ?? [];
    (map.getSource('flight') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: pts.length > 1
      ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts.map(p => [p.lng, p.lat]) } }] : [] });
    if (!flight || !pts.length || view !== 'town') { heli.current?.remove(); heli.current = null; return; }
    const at = pts[Math.min(flight.at, pts.length - 1)];
    if (!heli.current) {
      const el = document.createElement('div');
      el.className = 'lm-heli';
      el.textContent = '🚁';
      heli.current = new lib.Marker({ element: el, anchor: 'center' }).setLngLat([at.lng, at.lat]).addTo(map);
    } else heli.current.setLngLat([at.lng, at.lat]);
  }, [ready, view, flight]);

  return (
    <div className={`relative overflow-hidden rounded-xl ${className ?? ''}`}>
      <style>{`
        .lm-pin { display:flex; flex-direction:column; align-items:center; gap:2px; background:none; border:0; padding:0; cursor:default; }
        .lm-pin-tappable { cursor:pointer; }
        .lm-pin-icon { display:flex; align-items:center; justify-content:center; width:46px; height:46px; font-size:26px;
          border-radius:50% 50% 50% 6px; transform:rotate(-45deg); background:#fff; border:3px solid #0f172a;
          box-shadow:0 4px 10px rgba(2,6,23,.45); transition:transform .15s ease; }
        .lm-pin-icon { line-height:1; }
        .lm-pin-glyph { display:block; transform:rotate(45deg); line-height:1; }
        .lm-pin-tappable:hover .lm-pin-icon { transform:rotate(-45deg) scale(1.12); }
        .lm-pin-name { font: 800 13px/1.15 system-ui, sans-serif; color:#0f172a; background:rgba(255,255,255,.95);
          padding:2px 7px; border-radius:999px; box-shadow:0 1px 4px rgba(2,6,23,.35); white-space:nowrap; max-width:160px;
          overflow:hidden; text-overflow:ellipsis; }
        .lm-pin-start .lm-pin-icon { border-color:#facc15; box-shadow:0 0 0 5px rgba(250,204,21,.45), 0 4px 10px rgba(2,6,23,.45); }
        .lm-pin-found .lm-pin-icon { border-color:#22c55e; box-shadow:0 0 0 6px rgba(34,197,94,.5), 0 4px 10px rgba(2,6,23,.45); }
        .lm-pin-wrong .lm-pin-icon { animation: lm-shake .45s ease; border-color:#f43f5e; }
        @keyframes lm-shake { 0%,100% { margin-left:0 } 25% { margin-left:-6px } 75% { margin-left:6px } }
        .lm-heli { font-size:34px; filter: drop-shadow(0 6px 6px rgba(2,6,23,.5)); transition: transform .35s ease; }
      `}</style>
      <div ref={host} className="h-full w-full" data-live-map={view} />
      {failed && <div className="absolute inset-0 flex items-center justify-center bg-slate-900 p-6 text-center text-slate-300">{failed}</div>}
      {!ready && !failed && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-400">Loading the map…</div>}
      {view === 'town' && ready && (
        <button type="button" onClick={() => setTilt(t => !t)}
          className="absolute left-2 top-2 rounded-lg border border-white/20 bg-slate-900/75 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800">
          {tilt ? 'Flat view' : '3D view'}
        </button>
      )}
    </div>
  );
}

export default LiveMap;
