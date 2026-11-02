/**
 * The kitchen volcano table, built in code with three.js (no model files): a wooden table with two clay volcanoes, A on
 * the left and B on the right, each with a measuring stick of four coloured marks behind it. An erupted volcano's foam
 * rises out of its crater to the mark `volcanoModel.ts` computes, then spills down the sides. The scene never decides
 * a height the model did not.
 */
import * as THREE from 'three';
import { MAX_AMOUNT } from './volcanoModel';
import type { Outcome } from './magmaModel';

export interface VolcanoSceneState {
  /** Each volcano's foam marks (from the model) and whether it has erupted. */
  a: { marks: number; erupted: boolean };
  b: { marks: number; erupted: boolean };
}

export interface VolcanoWorld {
  root: THREE.Group;
  tick(dt: number, state: VolcanoSceneState): void;
  dispose(): void;
}

export const VOLCANO_VIEW = { t: new THREE.Vector3(0, 1.4, 0), r: 13, ph: 1.05, th: 0 };

const CONE_H = 1.6;
/** World height of one foam mark above the crater. */
const MARK = 0.55;
const MARK_COLORS = [0x5ec26a, 0xa6d44a, 0xf2c230, 0xf08a2c, 0xe0483a];

function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = 'rgba(15,23,42,0.8)'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fde68a'; g.font = 'bold 80px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(0.7, 0.7, 1);
  return s;
}

export function buildKitchenTable(): VolcanoWorld {
  const root = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  const top = new THREE.Mesh(keep(new THREE.BoxGeometry(12, 0.4, 6)), keep(new THREE.MeshStandardMaterial({ color: 0xb98652, roughness: 0.85 })));
  top.position.y = -0.2; top.receiveShadow = true;
  root.add(top);
  root.add(new THREE.HemisphereLight(0xffffff, 0x8a6a4a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 9, 6); sun.castShadow = true;
  root.add(sun);

  const clay = keep(new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.95, flatShading: true }));
  const foamMat = keep(new THREE.MeshStandardMaterial({ color: 0xfbe9ef, roughness: 0.6, emissive: 0xff8a65, emissiveIntensity: 0.12 }));
  const coneGeo = keep(new THREE.CylinderGeometry(0.35, 1.5, CONE_H, 18, 1, true));
  const craterGeo = keep(new THREE.CircleGeometry(0.35, 18));
  const columnGeo = keep(new THREE.CylinderGeometry(0.3, 0.34, 1, 16));
  const blobGeo = keep(new THREE.SphereGeometry(0.22, 12, 10));

  interface Volcano { column: THREE.Mesh; cap: THREE.Mesh; drips: THREE.Mesh[]; level: number; t: number }
  const make = (x: number, name: string): Volcano => {
    const g = new THREE.Group();
    g.position.x = x;
    const cone = new THREE.Mesh(coneGeo, clay);
    cone.position.y = CONE_H / 2; cone.castShadow = true;
    const crater = new THREE.Mesh(craterGeo, keep(new THREE.MeshStandardMaterial({ color: 0x3d2516 })));
    crater.rotation.x = -Math.PI / 2; crater.position.y = CONE_H - 0.01;
    g.add(cone, crater);
    // The measuring stick behind: four coloured marks, one per foam mark.
    for (let i = 0; i < MAX_AMOUNT; i++) {
      const m = new THREE.Mesh(keep(new THREE.BoxGeometry(0.25, MARK * 0.92, 0.08)), keep(new THREE.MeshStandardMaterial({ color: MARK_COLORS[i] })));
      m.position.set(0, CONE_H + MARK * (i + 0.5), -1.2);
      g.add(m);
    }
    const stick = new THREE.Mesh(keep(new THREE.BoxGeometry(0.08, CONE_H, 0.08)), keep(new THREE.MeshStandardMaterial({ color: 0x5b4636 })));
    stick.position.set(0, CONE_H / 2, -1.2);
    g.add(stick);
    const label = labelSprite(name);
    label.position.set(0, 0.5, 1.7);
    disposables.push(label.material.map!, label.material);
    g.add(label);
    const column = new THREE.Mesh(columnGeo, foamMat);
    column.visible = false;
    const cap = new THREE.Mesh(blobGeo, foamMat);
    cap.scale.setScalar(1.6); cap.visible = false;
    const drips = Array.from({ length: 8 }, () => { const d = new THREE.Mesh(blobGeo, foamMat); d.visible = false; g.add(d); return d; });
    g.add(column, cap);
    root.add(g);
    return { column, cap, drips, level: 0, t: 0 };
  };
  const volcanoes = { a: make(-2.4, 'A'), b: make(2.4, 'B') };

  const step = (v: Volcano, s: { marks: number; erupted: boolean }, dt: number) => {
    const target = s.erupted ? s.marks * MARK : 0;
    v.level = s.erupted ? Math.min(target, v.level + dt * 1.4) : 0;
    v.t = s.erupted ? v.t + dt : 0;
    const on = v.level > 0.01;
    v.column.visible = on; v.cap.visible = on;
    if (on) {
      v.column.scale.y = v.level;
      v.column.position.y = CONE_H + v.level / 2;
      v.cap.position.y = CONE_H + v.level + 0.1 * Math.sin(v.t * 6);
    }
    // Once it has risen, foam spills down the sides.
    const spill = s.erupted && v.level >= target - 0.01 && target > 0 ? Math.min(1, (v.t - target / 1.4) / 1.5) : 0;
    v.drips.forEach((d, i) => {
      d.visible = spill > 0;
      if (!d.visible) return;
      const ang = (i / v.drips.length) * Math.PI * 2;
      const down = spill * (0.4 + 0.6 * ((i * 37) % 10) / 10);
      const r = 0.35 + 1.1 * down;
      d.position.set(Math.cos(ang) * r, CONE_H - CONE_H * down * 0.85 + 0.15, Math.sin(ang) * r);
    });
  };

  return {
    root,
    tick(dt, s) { step(volcanoes.a, s.a, dt); step(volcanoes.b, s.b, dt); },
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}

// ============================================================================
// The island (runny_or_sticky): a volcano mountain by the sea with a village at its foot
// ============================================================================

export interface IslandSceneState {
  /** The eruption on now (from `magmaModel.ts`), and a key that restarts it. */
  eruption: Outcome | null;
  eruptionKey: string;
}

export const ISLAND_VIEW = { t: new THREE.Vector3(0, 3.2, 0), r: 24, ph: 1.08, th: 0.25 };

const PEAK = 4.2, BASE_R = 5.2, CRATER_R = 0.8;

export function buildIsland(): { root: THREE.Group; tick(dt: number, s: IslandSceneState): void; dispose(): void } {
  const root = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  root.add(new THREE.HemisphereLight(0xdff2ff, 0x6a5a40, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(6, 12, 8); sun.castShadow = true;
  root.add(sun);

  const sea = new THREE.Mesh(keep(new THREE.CircleGeometry(30, 48)), keep(new THREE.MeshStandardMaterial({ color: 0x2f7fb8, roughness: 0.3 })));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.05;
  const land = new THREE.Mesh(keep(new THREE.CylinderGeometry(9, 9.6, 0.4, 40)), keep(new THREE.MeshStandardMaterial({ color: 0x6fae4a, roughness: 0.95 })));
  land.position.y = 0.1; land.receiveShadow = true;
  const mountain = new THREE.Mesh(keep(new THREE.CylinderGeometry(CRATER_R, BASE_R, PEAK, 32, 1, true)),
    keep(new THREE.MeshStandardMaterial({ color: 0x6b5446, roughness: 1, flatShading: true })));
  mountain.position.y = 0.3 + PEAK / 2; mountain.castShadow = true;
  const crater = new THREE.Mesh(keep(new THREE.CircleGeometry(CRATER_R, 24)), keep(new THREE.MeshStandardMaterial({ color: 0x2a1a12 })));
  crater.rotation.x = -Math.PI / 2; crater.position.y = 0.3 + PEAK - 0.02;
  root.add(sea, land, mountain, crater);

  // A village at the foot, toward the camera.
  const wall = keep(new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.9 }));
  const roof = keep(new THREE.MeshStandardMaterial({ color: 0xc0503a, roughness: 0.8 }));
  for (let i = 0; i < 5; i++) {
    const a = 0.9 + i * 0.28, r = 7.2;
    const h = new THREE.Group();
    const box = new THREE.Mesh(keep(new THREE.BoxGeometry(0.7, 0.5, 0.7)), wall);
    box.position.y = 0.55;
    const cap = new THREE.Mesh(keep(new THREE.ConeGeometry(0.6, 0.45, 4)), roof);
    cap.position.y = 1.02; cap.rotation.y = Math.PI / 4;
    h.add(box, cap);
    h.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    root.add(h);
  }

  // Lava rivers (flows): ribbons from the crater down the slopes, revealed over time.
  const lavaMat = keep(new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3d00, emissiveIntensity: 1.2, roughness: 0.6 }));
  const rivers: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -0.4 + i * 1.3;
    const pts = Array.from({ length: 12 }, (_, k) => {
      const f = k / 11, r = CRATER_R + (BASE_R + 1.6 - CRATER_R) * f;
      const y = Math.max(0.35, 0.3 + PEAK * (1 - Math.min(1, (r - CRATER_R) / (BASE_R - CRATER_R)))) + 0.08;
      const w = a + 0.25 * Math.sin(f * 6 + i);
      return new THREE.Vector3(Math.cos(w) * r, y, Math.sin(w) * r);
    });
    const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.16, 6, false)), lavaMat);
    tube.visible = false;
    rivers.push(tube); root.add(tube);
  }
  // Ash cloud (explodes): grey puffs rising and spreading.
  const ashMat = keep(new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1, transparent: true, opacity: 0.85 }));
  const puffGeo = keep(new THREE.SphereGeometry(0.6, 12, 10));
  const puffs = Array.from({ length: 28 }, (_, i) => {
    const p = new THREE.Mesh(puffGeo, ashMat);
    p.userData.dir = new THREE.Vector3(Math.cos(i * 2.4) * (0.2 + (i % 5) * 0.12), 1, Math.sin(i * 2.4) * (0.2 + (i % 5) * 0.12));
    p.userData.delay = (i % 7) * 0.12;
    p.visible = false; root.add(p);
    return p;
  });
  const flash = new THREE.PointLight(0xff6a1a, 0, 30);
  flash.position.set(0, PEAK + 1, 0);
  root.add(flash);
  // Lava dome (dome): a lumpy mound growing in the crater.
  const dome = new THREE.Mesh(keep(new THREE.IcosahedronGeometry(1.1, 1)), keep(new THREE.MeshStandardMaterial({ color: 0x5a2a1a, emissive: 0xff3d00, emissiveIntensity: 0.35, roughness: 1, flatShading: true })));
  dome.position.y = 0.3 + PEAK; dome.visible = false;
  root.add(dome);

  let key = '', t = 0;
  return {
    root,
    tick(dt, s) {
      if (s.eruptionKey !== key) { key = s.eruptionKey; t = 0; }
      t += dt;
      const f = Math.min(1, t / 3);
      rivers.forEach(r => {
        r.visible = s.eruption === 'flows';
        if (r.visible) r.geometry.setDrawRange(0, Math.floor((r.geometry.index?.count ?? 0) * f));
      });
      puffs.forEach(p => {
        const tt = Math.max(0, t - p.userData.delay);
        p.visible = s.eruption === 'explodes' && tt > 0;
        if (!p.visible) return;
        const d = p.userData.dir as THREE.Vector3;
        // The cloud billows up about its own height and spreads, staying in view above the mountain.
        const h = Math.min(tt, 3);
        p.position.set(d.x * h * 2.2, 0.3 + PEAK + 0.4 + d.y * h * 1.15, d.z * h * 2.2);
        p.scale.setScalar(0.7 + h * 0.55);
      });
      flash.intensity = s.eruption === 'explodes' ? Math.max(0, 40 * (1 - t / 1.5)) : s.eruption === 'flows' ? 8 : 0;
      dome.visible = s.eruption === 'dome';
      if (dome.visible) { const g = Math.min(1, t / 3); dome.scale.set(0.3 + g, 0.15 + g * 0.6, 0.3 + g); }
    },
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}
