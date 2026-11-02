/**
 * The buoyancy harbor, built in code with three.js (no model files): a wooden pier by the sea with a lighthouse, a
 * glass test tank of water on the pier, and the things to test lined up on the pier in front of it.
 *
 * Each thing is a body with a height and a density from `buoyancyModel.ts`. Dropped, it flies over the tank and falls
 * in; in the water it feels weight down and a push up equal to the water it pushes aside, so it bobs to rest at the
 * depth its density sets, or sinks to the floor. The scene never decides a result the model did not.
 *
 * A built boat sits on the yellow stand; launched, it floats at the draft `boatModel.ts` computes for its load of
 * pennies, or sinks when the load is more than the water it can push aside.
 *
 * Lever drawings (`buoyancyLevers.ts`): x-ray arrows on everything in the water (red, the weight down; blue, the water's
 * push up, its length the push over the weight, so a floater's two match and a sinker's push is short), a material tag
 * over each thing on the pier, a pair of extra things dropped at the back of the tank, and model boats at its sides.
 *
 * Salt water: each spoon stirred in makes the water heavier (`saltModel.ts`), so it pushes up harder on every food in it;
 * a food on the bottom rises once the water outweighs it. The water clouds a little with each spoon.
 *
 * Tappable things carry `userData.target` ('thing:<i>', in the order the item lists them). The tank's glass and water
 * carry 'water': a tap there drops the chosen thing in, unless a thing in the tank is behind it (`BuoyancyScene`).
 */
import * as THREE from 'three';
import { MATERIAL_WORD, densityOf, type HarborThing, type Material } from './buoyancyModel';
import { MAX_SPOONS, waterDensity } from './saltModel';
import { MAX_PENNIES, PENNY, draft, floatsWith, hasSides, hullMass, maxDisplaced, type BoatBuild } from './boatModel';

export type HarborTarget = `thing:${number}` | 'water';
/** A thing's place in the item's list (and on the pier). */
export type Slot = number;

/** The tank: floor at y = 0 on the pier deck, water up to WATER. */
export const TANK = { hx: 5.6, hz: 2.6, h: 5.0 };
export const WATER = 3.4;
const DECK_Z = 4.6;

/** Where the things stand on the pier, where they land in the tank, and which stand on a yellow stand. */
interface PierLayout { x: number[]; tankX: number[]; stand: boolean[]; turn: boolean }
/**
 * Without stands, the drop test's three: the tests at the sides and the mystery on the stand in the middle (a salt
 * item's foods take the same places). With stands, a row of up to five, the stands' things on yellow stands; long things
 * are turned end-on so neighbours do not touch, and they land spread across the tank.
 */
export function pierLayout(n: number, stands?: readonly number[]): PierLayout {
  if (!stands) return { x: [-3.3, 3.3, 0], tankX: [-3.6, 3.6, 0], stand: [false, false, true], turn: false };
  const step = n > 1 ? Math.min(2.8, 11.2 / (n - 1)) : 0;
  const x = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
  return { x, tankX: x.map(v => v * 0.66), stand: x.map((_, i) => stands.includes(i)), turn: true };
}
const G = 9;

export const HARBOR_VIEWS = {
  start: { t: new THREE.Vector3(0, 1.6, 1.6), r: 19, ph: 1.12, th: 0.18 },
  /** Further back, so a row of five on the pier fits beside the tank. */
  row: { t: new THREE.Vector3(0, 1.4, 2.4), r: 23, ph: 1.1, th: 0.12 },
  /** Close over the tank, looking down into a launched boat so its pennies show. */
  boat: { t: new THREE.Vector3(0, 3.0, 0), r: 12.5, ph: 0.8, th: 0.15 },
};
export type HarborView = keyof typeof HARBOR_VIEWS;

export interface HarborState {
  /** Which things are dropped (in the tank), in the item's order. */
  dropped: readonly boolean[];
  /** Marked by the learner: the selected test (white arrow) and the evidence (amber arrow). */
  selected: Slot | null;
  evidence: 0 | 1 | null;
  finale: boolean;
  /** The boat being built (null: none yet), whether it is in the tank, and the pennies in it. */
  boat?: { build: BoatBuild | null; launched: boolean; pennies: number };
  /** Lever drawings: force arrows, material tags, extra things dropped at the back, model boats at the sides. */
  xray?: boolean;
  tags?: boolean;
  extras?: readonly HarborThing[] | null;
  modelBoats?: ReadonlyArray<{ build: BoatBuild; pennies: number }> | null;
  /** Spoons of salt stirred into the tank (0 or absent: fresh water). */
  spoons?: number;
}

interface Body {
  thing: HarborThing;
  group: THREE.Group;
  h: number;
  y: number;
  v: number;
  phase: 'dock' | 'flying' | 'falling';
  fly: number;
  wobble: number;
  /** How much of it is under the water (0-1), from the last step. */
  sub: number;
}

export interface HarborWorld {
  root: THREE.Group;
  /** Put out a new item's things on the pier (null clears); `stands` puts them in a row with those on yellow stands. */
  setThings(things: readonly HarborThing[] | null, stands?: readonly number[]): void;
  tick(dt: number, state: HarborState, camera: THREE.Camera): void;
  pickPoint(target: HarborTarget): THREE.Vector3;
  targetFromHit(obj: THREE.Object3D): HarborTarget | 'pass' | null;
  dispose(): void;
}

// ── Materials ────────────────────────────────────────────────────────────────────────────────────────────────
function materialFor(t: HarborThing): THREE.MeshStandardMaterial {
  const c = t.color;
  switch (t.material) {
    case 'wood': return new THREE.MeshStandardMaterial({ color: 0xa86f3a, roughness: 0.82 });
    case 'cork': return new THREE.MeshStandardMaterial({ color: 0xc89c63, roughness: 0.97 });
    case 'foam': return new THREE.MeshStandardMaterial({ color: c ?? 0xf3efe4, roughness: 1 });
    case 'wax': return new THREE.MeshStandardMaterial({ color: c ?? 0xfff1c9, roughness: 0.55 });
    case 'ice': return new THREE.MeshStandardMaterial({ color: 0xe2f5ff, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.72 });
    case 'steel': return new THREE.MeshStandardMaterial({ color: 0xa9b2bc, roughness: 0.28, metalness: 0.88 });
    case 'stone': return new THREE.MeshStandardMaterial({ color: 0x8b857c, roughness: 0.96, flatShading: true });
    case 'glass': return new THREE.MeshStandardMaterial({ color: 0x7ccbe6, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.62 });
    case 'rubber': return new THREE.MeshStandardMaterial({ color: c ?? 0x5a5f66, roughness: 0.9 });
    case 'food': return new THREE.MeshStandardMaterial({ color: c ?? 0xe9d39a, roughness: t.key === 'grape' || t.key === 'egg' ? 0.35 : 0.8 });
  }
}

/** One thing's meshes, centred on its middle, and its height (what the water acts on). */
function buildThing(t: HarborThing): { group: THREE.Group; h: number } {
  const g = new THREE.Group();
  const m = materialFor(t);
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, mat: THREE.Material = m) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const H = Math.PI / 2;
  let h = 0.5;
  switch (t.key) {
    case 'twig': add(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 8), 0, 0, 0, 0, 0.3, H); h = 0.14; break;
    case 'birthday-candle':
      add(new THREE.CylinderGeometry(0.07, 0.07, 0.75, 10), 0, 0, 0, 0, 0, H);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), 0.43, 0, 0, 0, 0, H, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      h = 0.14; break;
    case 'wood-block': add(new THREE.BoxGeometry(1.0, 0.7, 0.7)); h = 0.7; break;
    case 'eraser': add(new THREE.BoxGeometry(0.55, 0.24, 0.32)); h = 0.24; break;
    case 'doorstop': add(new THREE.BoxGeometry(1.0, 0.42, 0.6)); h = 0.42; break;
    case 'log':
      add(new THREE.CylinderGeometry(0.55, 0.58, 3.0, 16), 0, 0, 0, 0, 0, H);
      for (const s of [-1, 1]) add(new THREE.CircleGeometry(0.5, 16), s * 1.51, 0, 0, 0, s * H, 0, new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: 0.9 }));
      h = 1.14; break;
    case 'cork': add(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 14)); h = 0.42; break;
    case 'cork-board': add(new THREE.BoxGeometry(2.4, 0.18, 1.5)); h = 0.18; break;
    case 'foam-peanut': add(new THREE.CapsuleGeometry(0.1, 0.24, 4, 8), 0, 0, 0, 0, 0, H); h = 0.2; break;
    case 'foam-ball': add(new THREE.SphereGeometry(0.5, 20, 14)); h = 1.0; break;
    case 'pool-noodle': add(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 14), 0, 0, 0, 0, 0, H); h = 0.6; break;
    case 'big-candle':
      add(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 20));
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), 0, 0.74, 0, 0, 0, 0, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      h = 1.3; break;
    case 'ice-cube': add(new THREE.BoxGeometry(0.45, 0.45, 0.45)); h = 0.45; break;
    case 'ice-block': add(new THREE.BoxGeometry(1.7, 1.5, 1.4)); h = 1.5; break;
    case 'paper-clip': {
      const ring = new THREE.TorusGeometry(0.16, 0.022, 6, 24); ring.scale(1.9, 1, 1);
      add(ring, 0, 0, 0, H); h = 0.05; break;
    }
    case 'nail':
      add(new THREE.CylinderGeometry(0.04, 0.02, 0.8, 8), 0, 0, 0, 0, 0, H);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), -0.41, 0, 0, 0, 0, H);
      h = 0.2; break;
    case 'key':
      add(new THREE.BoxGeometry(0.5, 0.05, 0.1), 0.15, 0, 0);
      add(new THREE.TorusGeometry(0.13, 0.05, 8, 18), -0.22, 0, 0, H);
      add(new THREE.BoxGeometry(0.06, 0.05, 0.14), 0.33, 0, 0.08);
      h = 0.1; break;
    case 'metal-spoon': {
      add(new THREE.BoxGeometry(1.0, 0.05, 0.12), 0.35, 0, 0);
      const bowl = new THREE.SphereGeometry(0.24, 16, 10); bowl.scale(1.3, 0.35, 1);
      add(bowl, -0.35, 0, 0); h = 0.17; break;
    }
    case 'wrench':
      add(new THREE.BoxGeometry(1.9, 0.14, 0.24));
      for (const s of [-1, 1]) add(new THREE.TorusGeometry(0.26, 0.09, 8, 18, Math.PI * 1.5), s * 1.08, 0, 0, H, 0, s > 0 ? 0.8 : 3.9);
      h = 0.2; break;
    case 'pebble': case 'rock': case 'boulder': {
      const r = t.key === 'pebble' ? 0.22 : t.key === 'rock' ? 0.5 : 1.0;
      const geo = new THREE.DodecahedronGeometry(r, 1); geo.scale(1.15, 0.75, 1);
      add(geo); h = 2 * r * 0.75; break;
    }
    case 'marble': add(new THREE.SphereGeometry(0.17, 16, 12)); h = 0.34; break;
    case 'paperweight': {
      const geo = new THREE.SphereGeometry(0.48, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2); geo.translate(0, -0.24, 0);
      add(geo); h = 0.48; break;
    }
    case 'egg': {
      const geo = new THREE.SphereGeometry(0.42, 22, 16); geo.scale(1, 1.3, 1);
      add(geo, 0, 0, 0, 0, 0, H); h = 0.84; break;
    }
    case 'sweet-potato': {
      const geo = new THREE.SphereGeometry(0.55, 20, 14); geo.scale(2.2, 0.9, 0.95);
      add(geo); h = 0.99; break;
    }
    case 'potato': {
      const geo = new THREE.DodecahedronGeometry(0.45, 1); geo.scale(1.2, 0.85, 1);
      add(geo); h = 0.77; break;
    }
    case 'baby-carrot':
      add(new THREE.CylinderGeometry(0.11, 0.06, 0.7, 12), 0, 0, 0, 0, 0, H);
      add(new THREE.SphereGeometry(0.11, 12, 8), 0.35, 0, 0);
      h = 0.22; break;
    case 'grape': {
      const geo = new THREE.SphereGeometry(0.2, 18, 12); geo.scale(1, 1.15, 1);
      add(geo); h = 0.46; break;
    }
    default: add(new THREE.BoxGeometry(0.5, 0.5, 0.5)); h = 0.5;
  }
  // Small things drawn true to scale are specks from the camera; enlarge them, still well under the big ones.
  if (t.size === 'small') { g.scale.setScalar(1.6); h *= 1.6; }
  return { group: g, h };
}

// ── Lever drawings ────────────────────────────────────────────────────────────────────────────────────────
const TAG_COLOR: Record<Material, string> = {
  wood: '#a86f3a', cork: '#c89c63', foam: '#e9e3d2', wax: '#f7d9a8', ice: '#bfe8ff', steel: '#9aa6b2', stone: '#8b857c',
  glass: '#7ccbe6', rubber: '#e57aa5', food: '#f2c879',
};

/** A label sprite with the material's word on its colour, drawn on top of everything. */
function materialTag(m: Material): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 96;
  const g = canvas.getContext('2d');
  if (g) {
    g.fillStyle = TAG_COLOR[m];
    g.beginPath(); g.roundRect(6, 6, 244, 84, 40); g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(20,30,40,0.55)'; g.stroke();
    g.fillStyle = '#14202b'; g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(MATERIAL_WORD[m], 128, 50);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.5, 0.56, 1); sprite.renderOrder = 12; sprite.visible = false;
  sprite.userData.target = 'pass';
  return sprite;
}

/** One force arrow, one unit long along +y from its base; scaled in y to its length. */
function forceArrow(mat: THREE.Material, shaft: THREE.BufferGeometry, head: THREE.BufferGeometry): THREE.Group {
  const a = new THREE.Group();
  const s = new THREE.Mesh(shaft, mat); s.position.y = 0.5; s.renderOrder = 11;
  const h = new THREE.Mesh(head, mat); h.renderOrder = 11;
  a.add(s, h); a.visible = false; a.userData.head = h;
  a.traverse(o => { o.userData.target = 'pass'; });
  return a;
}

// ── The boat ───────────────────────────────────────────────────────────────────────────────────────────────
const PENNY_R = 0.13, PENNY_H = 0.045, PENNY_STEP = 0.3;

/** A boat's meshes with the origin at the middle of its bottom, its height, and where its pennies rest. */
function buildBoat(b: BoatBuild): { group: THREE.Group; h: number; spots: THREE.Vector3[] } {
  const g = new THREE.Group();
  const L = b.size === 'big' ? 3.2 : 1.8, W = 1.4;
  const mat = b.material === 'foil' ? new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.22, metalness: 0.75, emissive: 0x2a3440, emissiveIntensity: 0.35, side: THREE.DoubleSide })
    : b.material === 'clay' ? new THREE.MeshStandardMaterial({ color: 0xc4683f, roughness: 0.92 })
      : new THREE.MeshStandardMaterial({ color: 0xd8b27a, roughness: 0.85 });
  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = mat) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
  };
  /** Craft sticks laid side by side along x, as a slab of the given size. */
  const sticks = (len: number, wid: number, th: number, y: number) => {
    const n = Math.max(2, Math.round(wid / 0.2));
    for (let i = 0; i < n; i++) add(new THREE.BoxGeometry(len, th, wid / n - 0.02), 0, y, -wid / 2 + (i + 0.5) * (wid / n));
  };
  let h: number;
  if (b.shape === 'ball') {
    const r = b.size === 'big' ? 0.62 : 0.48;
    if (b.material === 'sticks') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2, rr = i === 6 ? 0 : r * 0.55;
        const c = add(new THREE.CylinderGeometry(0.11, 0.11, r * 3, 8), 0, r, 0); c.rotation.z = Math.PI / 2;
        c.position.set(0, r + Math.sin(a) * rr, Math.cos(a) * rr);
      }
      add(new THREE.TorusGeometry(r * 0.75, 0.04, 6, 20), 0, r, 0, new THREE.MeshStandardMaterial({ color: 0xc23b3b })).rotation.y = Math.PI / 2;
    } else {
      const geo = b.material === 'foil' ? new THREE.IcosahedronGeometry(r, 1) : new THREE.SphereGeometry(r, 20, 14);
      if (b.material === 'foil') {
        const p = geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.3 * Math.abs(Math.sin(i * 12.9898) * 0.6); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
        geo.computeVertexNormals();
      }
      add(geo, 0, r, 0);
    }
    h = 2 * r;
    return { group: g, h, spots: [new THREE.Vector3(0, h + PENNY_H / 2, 0)] };
  }
  if (b.shape === 'flat') {
    h = b.material === 'foil' ? 0.03 : 0.14;
    if (b.material === 'sticks') sticks(L, W, h, h / 2);
    else add(new THREE.BoxGeometry(L, h, W), 0, h / 2, 0);
  } else {
    h = b.shape === 'tall_sides' ? 0.9 : 0.45;
    const t = b.material === 'foil' ? 0.025 : b.material === 'clay' ? 0.1 : 0.08;
    if (b.material === 'sticks') {
      sticks(L, W, t, t / 2);
      // Each wall is a stack of sticks laid along it.
      for (const s of [-1, 1]) {
        const wall = new THREE.Group();
        const n = Math.max(2, Math.round(h / 0.2));
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(L, h / n - 0.015, t), mat); m.position.set(0, (i + 0.5) * (h / n), s * (W / 2 - t / 2)); m.castShadow = true; wall.add(m);
          const e = new THREE.Mesh(new THREE.BoxGeometry(t, h / n - 0.015, W), mat); e.position.set(s * (L / 2 - t / 2), (i + 0.5) * (h / n), 0); e.castShadow = true; wall.add(e);
        }
        g.add(wall);
      }
    } else {
      add(new THREE.BoxGeometry(L, t, W), 0, t / 2, 0);
      for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(L, h, t), 0, h / 2, s * (W / 2 - t / 2));
        add(new THREE.BoxGeometry(t, h, W - 2 * t), s * (L / 2 - t / 2), h / 2, 0);
      }
    }
  }
  // Penny spots on the floor (or the top of a flat), filled row by row and then stacked.
  const floorY = (hasSides(b) ? (b.material === 'foil' ? 0.025 : 0.1) : h) + PENNY_H / 2;
  const cols = Math.max(1, Math.floor((L - 0.3) / PENNY_STEP)), rows = Math.max(1, Math.floor((W - 0.3) / PENNY_STEP));
  const spots: THREE.Vector3[] = [];
  for (let layer = 0; spots.length < MAX_PENNIES; layer++) {
    for (let r = 0; r < rows && spots.length < MAX_PENNIES; r++) for (let c = 0; c < cols && spots.length < MAX_PENNIES; c++) {
      spots.push(new THREE.Vector3((c - (cols - 1) / 2) * PENNY_STEP, floorY + layer * PENNY_H, (r - (rows - 1) / 2) * PENNY_STEP));
    }
  }
  return { group: g, h, spots };
}

// ── The world ────────────────────────────────────────────────────────────────────────────────────────────────
export function buildHarbor(opts: { anisotropy?: number } = {}): HarborWorld {
  const root = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const tag = (o: THREE.Object3D, target: string) => o.traverse(c => { c.userData.target = target; });

  // Light
  root.add(new THREE.HemisphereLight(0xdcefff, 0x8a6a48, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(10, 18, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 });
  root.add(sun);

  // Sea and pier
  const sea = new THREE.Mesh(keep(new THREE.CircleGeometry(120, 48)), keep(new THREE.MeshStandardMaterial({ color: 0x2e7fa6, roughness: 0.35, metalness: 0.1 })));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -2.4; sea.receiveShadow = true; root.add(sea);
  const plankMat = keep(new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.9 }));
  if (opts.anisotropy) plankMat.needsUpdate = true;
  const plankGeo = keep(new THREE.BoxGeometry(1.0, 0.3, 11));
  for (let i = -8; i <= 8; i++) {
    const p = new THREE.Mesh(plankGeo, plankMat);
    p.position.set(i * 1.04, -0.15, 1.2); p.receiveShadow = true; p.castShadow = true; root.add(p);
  }
  const postGeo = keep(new THREE.CylinderGeometry(0.22, 0.22, 3, 10));
  for (const x of [-8, -2.7, 2.7, 8]) for (const z of [-4, 6.4]) {
    const post = new THREE.Mesh(postGeo, plankMat); post.position.set(x, -1.6, z); root.add(post);
  }

  // Lighthouse on a far rock
  const lh = new THREE.Group(); lh.position.set(-22, -2.4, -26); root.add(lh);
  const rockMat = keep(new THREE.MeshStandardMaterial({ color: 0x6f6a63, roughness: 1, flatShading: true }));
  lh.add(new THREE.Mesh(keep(new THREE.DodecahedronGeometry(4.5, 0)), rockMat));
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(keep(new THREE.CylinderGeometry(1.3 - i * 0.12, 1.42 - i * 0.12, 1.6, 16)),
      keep(new THREE.MeshStandardMaterial({ color: i % 2 ? 0xffffff : 0xd8333a, roughness: 0.6 })));
    seg.position.y = 3.2 + i * 1.6; lh.add(seg);
  }
  const lamp = new THREE.Mesh(keep(new THREE.SphereGeometry(0.75, 12, 8)), keep(new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe066, emissiveIntensity: 1.2 })));
  lamp.position.y = 11.6; lh.add(lamp);

  // The tank
  const glassMat = keep(new THREE.MeshStandardMaterial({ color: 0xd8eef5, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  const waterMat = keep(new THREE.MeshStandardMaterial({ color: 0x3aa6c4, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false }));
  const waterTopMat = keep(new THREE.MeshStandardMaterial({ color: 0x6cc8e0, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  const frameMat = keep(new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.5, metalness: 0.6 }));
  const tank = new THREE.Group(); root.add(tank);
  const { hx, hz, h } = TANK;
  const front = keep(new THREE.PlaneGeometry(hx * 2, h)), side = keep(new THREE.PlaneGeometry(hz * 2, h));
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(front, glassMat); f.position.set(0, h / 2, s * hz); tank.add(f);
    const sd = new THREE.Mesh(side, glassMat); sd.position.set(s * hx, h / 2, 0); sd.rotation.y = Math.PI / 2; tank.add(sd);
  }
  const base = new THREE.Mesh(keep(new THREE.BoxGeometry(hx * 2 + 0.3, 0.12, hz * 2 + 0.3)), frameMat); base.position.y = 0.06; base.receiveShadow = true; tank.add(base);
  const sand = new THREE.Mesh(keep(new THREE.BoxGeometry(hx * 2 - 0.1, 0.06, hz * 2 - 0.1)), keep(new THREE.MeshStandardMaterial({ color: 0xe6d3a3, roughness: 1 })));
  sand.position.y = 0.15; sand.receiveShadow = true; tank.add(sand);
  const rimGeo = keep(new THREE.BoxGeometry(hx * 2 + 0.2, 0.1, 0.1)), rimSide = keep(new THREE.BoxGeometry(0.1, 0.1, hz * 2 + 0.2));
  for (const s of [-1, 1]) {
    const r1 = new THREE.Mesh(rimGeo, frameMat); r1.position.set(0, h, s * hz); tank.add(r1);
    const r2 = new THREE.Mesh(rimSide, frameMat); r2.position.set(s * hx, h, 0); tank.add(r2);
  }
  const water = new THREE.Mesh(keep(new THREE.BoxGeometry(hx * 2 - 0.08, WATER - 0.18, hz * 2 - 0.08)), waterMat);
  water.position.y = (WATER + 0.18) / 2; water.renderOrder = 2; tank.add(water);
  const surfGeo = keep(new THREE.PlaneGeometry(hx * 2 - 0.08, hz * 2 - 0.08, 48, 20));
  const surf = new THREE.Mesh(surfGeo, waterTopMat); surf.rotation.x = -Math.PI / 2; surf.position.y = WATER; surf.renderOrder = 3; tank.add(surf);
  const surfBase = Float32Array.from(surfGeo.attributes.position.array as Float32Array);
  tag(tank, 'water'); // after its meshes exist
  const FRESH = new THREE.Color(0x3aa6c4), SALTY = new THREE.Color(0xb9dbe3);

  // Salt grains: a shower from above the middle of the tank each time a spoon goes in.
  const GRAINS = 160;
  const grainGeo = keep(new THREE.BufferGeometry());
  const grainPos = new Float32Array(GRAINS * 3), grainVel = new Float32Array(GRAINS);
  grainGeo.setAttribute('position', new THREE.BufferAttribute(grainPos, 3));
  const grains = new THREE.Points(grainGeo, keep(new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.95, depthWrite: false })));
  grains.visible = false; grains.renderOrder = 6; grains.userData.target = 'pass'; root.add(grains);
  let grainT = 1, lastSpoons = 0;
  const pourSalt = () => {
    for (let i = 0; i < GRAINS; i++) {
      grainPos[i * 3] = (Math.random() - 0.5) * 1.2; grainPos[i * 3 + 1] = TANK.h + 1.2 + Math.random() * 0.8; grainPos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      grainVel[i] = 3 + Math.random() * 2;
    }
    grainT = 0; grains.visible = true;
  };
  const tickSalt = (dt: number, spoons: number) => {
    if (spoons > lastSpoons) pourSalt();
    lastSpoons = spoons;
    waterMat.color.copy(FRESH).lerp(SALTY, Math.min(1, spoons / MAX_SPOONS) * 0.55);
    waterMat.opacity = 0.32 + 0.12 * Math.min(1, spoons / MAX_SPOONS);
    if (grainT >= 1) { grains.visible = false; return; }
    grainT = Math.min(1, grainT + dt / 1.6);
    for (let i = 0; i < GRAINS; i++) {
      const y = grainPos[i * 3 + 1];
      // Grains fall fast in air and drift slowly once in the water, fading as they dissolve.
      grainPos[i * 3 + 1] = Math.max(0.2, y - dt * (y > WATER ? grainVel[i] : 0.6));
    }
    (grains.material as THREE.PointsMaterial).opacity = 0.95 * (1 - grainT);
    grainGeo.attributes.position.needsUpdate = true;
  };

  // The yellow stands on the pier: the mystery's (and the boat's) in the middle, or one under each thing a row puts on one.
  const standGeo = keep(new THREE.CylinderGeometry(0.9, 1.0, 0.25, 24));
  const standMat = keep(new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.6 }));
  const stands = Array.from({ length: 5 }, () => {
    const m = new THREE.Mesh(standGeo, standMat); m.receiveShadow = true; m.visible = false; root.add(m); return m;
  });
  let layout = pierLayout(3);
  const placeStands = () => {
    const xs = layout.x.filter((_, i) => layout.stand[i]);
    stands.forEach((m, i) => { m.visible = i < xs.length; if (m.visible) m.position.set(xs[i], 0.12, DECK_Z); });
  };
  placeStands();

  // Splash rings and marker arrows
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  const rings: Array<{ mesh: THREE.Mesh; t: number }> = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(keep(new THREE.RingGeometry(0.4, 0.55, 32)), ringMat.clone());
    keep(r.material as THREE.Material); r.rotation.x = -Math.PI / 2; r.visible = false; r.renderOrder = 4; tank.add(r);
    r.userData.target = 'pass';
    rings.push({ mesh: r, t: 1 });
  }
  const arrowGeo = keep(new THREE.ConeGeometry(0.22, 0.5, 12)); arrowGeo.rotateX(Math.PI);
  const arrows = { selected: new THREE.Mesh(arrowGeo, keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }))),
    evidence: new THREE.Mesh(arrowGeo, keep(new THREE.MeshStandardMaterial({ color: 0xffb627, emissive: 0xffa000, emissiveIntensity: 0.6 }))) };
  arrows.selected.userData.target = 'pass'; arrows.evidence.userData.target = 'pass';
  root.add(arrows.selected, arrows.evidence);

  let bodies: Array<Body | null> = [];
  const thingRoot = new THREE.Group(); root.add(thingRoot);

  // The boat: built on the stand, launched into the middle of the tank.
  interface BoatBody { key: string; build: BoatBuild; group: THREE.Group; h: number; pennies: THREE.Mesh[]; spots: THREE.Vector3[]; shownAt: number[]; phase: 'dock' | 'flying' | 'water'; fly: number; y: number }
  let boat: BoatBody | null = null;
  const boatRoot = new THREE.Group(); root.add(boatRoot);
  const pennyGeo = keep(new THREE.CylinderGeometry(PENNY_R, PENNY_R, PENNY_H, 18));
  // Pennies sit in the boat's dry inside: drawn after the water (which writes no depth) so its surface does not tint them.
  const pennyMat = keep(new THREE.MeshStandardMaterial({ color: 0xc9783a, roughness: 0.35, metalness: 0.7, emissive: 0x7a3a10, emissiveIntensity: 0.45, transparent: true, opacity: 1 }));
  const clearBoat = () => {
    if (!boat) return;
    boatRoot.remove(boat.group);
    boat.group.traverse(o => { if (o instanceof THREE.Mesh && o.geometry !== pennyGeo) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    boat = null;
  };
  const STAND_TOP = 0.25;

  // X-ray arrows: a pool of (down, up) pairs placed each frame on whatever is in the water.
  const shaftGeo = keep(new THREE.CylinderGeometry(0.07, 0.07, 1, 10));
  const headGeo = keep(new THREE.ConeGeometry(0.2, 0.4, 14));
  const downMat = keep(new THREE.MeshBasicMaterial({ color: 0xff4d4d, depthTest: false, transparent: true, opacity: 0.95 }));
  const upMat = keep(new THREE.MeshBasicMaterial({ color: 0x3fa9ff, depthTest: false, transparent: true, opacity: 0.95 }));
  const arrowPairs = Array.from({ length: 8 }, () => {
    const down = forceArrow(downMat, shaftGeo, headGeo), up = forceArrow(upMat, shaftGeo, headGeo);
    root.add(down, up);
    return { down, up };
  });
  const ARROW = 1.3;
  /** Place pair i at a centre: the weight down, the push up `ratio` times as long. */
  const setArrows = (i: number, at: THREE.Vector3, ratio: number) => {
    const pair = arrowPairs[i];
    if (!pair) return;
    const put = (a: THREE.Group, dir: 1 | -1, len: number, dx: number) => {
      a.visible = len > 0.02;
      a.position.set(at.x + dx, at.y, at.z + 0.9);
      a.rotation.set(0, 0, dir > 0 ? 0 : Math.PI);
      const shaft = Math.max(0.01, len - 0.4);
      (a.children[0] as THREE.Mesh).scale.set(1, shaft, 1);
      (a.children[0] as THREE.Mesh).position.y = shaft / 2;
      (a.userData.head as THREE.Mesh).position.y = shaft + 0.2;
    };
    put(pair.down, -1, ARROW, 0.28);
    put(pair.up, 1, ARROW * Math.min(2, ratio), -0.28);
  };

  // Material tags over the things.
  let tags: Array<THREE.Sprite | null> = [];
  const tagRoot = new THREE.Group(); root.add(tagRoot);

  // Extra things (a lever's pair), dropped at the back of the tank.
  let extras: Body[] = [];
  let extrasKey = '';
  const EXTRA_X = [-2.2, 2.2];
  const EXTRA_Z = -1.3;

  // Model boats at the sides of the tank.
  interface ModelBoat { group: THREE.Group; build: BoatBuild; h: number; y: number; pennies: number }
  let modelBoats: ModelBoat[] = [];
  let modelKey = '';
  const MODEL_X = [-2.8, 2.8];

  const restOnDock = (b: Body, slot: Slot) => {
    b.phase = 'dock'; b.v = 0; b.y = b.h / 2 + (layout.stand[slot] ? 0.25 : 0); b.fly = 0; b.wobble = 0; b.sub = 0;
    b.group.position.set(layout.x[slot], b.y, DECK_Z); b.group.rotation.set(0, layout.turn ? Math.PI / 2 : 0, 0);
  };

  const setThings = (things: readonly HarborThing[] | null, standAt?: readonly number[]) => {
    for (const b of bodies) if (b) {
      thingRoot.remove(b.group);
      b.group.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    }
    tags.forEach(t => { if (t) { tagRoot.remove(t); t.material.map?.dispose(); t.material.dispose(); } });
    const shown = things?.slice(0, 5) ?? [];
    layout = pierLayout(shown.length, standAt);
    placeStands();
    bodies = shown.map(() => null);
    tags = shown.map(() => null);
    shown.forEach((t, i) => {
      if (typeof document !== 'undefined') { const tag = materialTag(t.material); tagRoot.add(tag); tags[i] = tag; }
      const { group, h: th } = buildThing(t);
      tag(group, `thing:${i}`);
      thingRoot.add(group);
      const b: Body = { thing: t, group, h: th, y: 0, v: 0, phase: 'dock', fly: 0, wobble: 0, sub: 0 };
      restOnDock(b, i as Slot);
      bodies[i] = b;
    });
  };

  const splash = (x: number) => {
    const r = rings.find(q => q.t >= 1) ?? rings[0];
    r.t = 0; r.mesh.visible = true; r.mesh.position.set(x, WATER + 0.02, 0);
  };

  const tickBoat = (dt: number, sb: HarborState['boat']) => {
    const key = sb?.build ? `${sb.build.material}/${sb.build.shape}/${sb.build.size}` : '';
    if ((boat?.key ?? '') !== key) {
      clearBoat();
      if (sb?.build) {
        const { group, h, spots } = buildBoat(sb.build);
        const pennies = spots.map(p => { const m = new THREE.Mesh(pennyGeo, pennyMat); m.position.copy(p); m.visible = false; m.castShadow = true; m.renderOrder = 5; group.add(m); return m; });
        boatRoot.add(group);
        boat = { key, build: sb.build, group, h, pennies, spots, shownAt: spots.map(() => -1), phase: 'dock', fly: 0, y: STAND_TOP };
      }
    }
    if (!boat || !sb) return;
    const b = boat;
    const load = sb.launched ? sb.pennies : 0;
    if (!sb.launched) {
      b.phase = 'dock'; b.y = STAND_TOP;
      b.group.position.set(0, STAND_TOP, DECK_Z); b.group.rotation.set(0, 0, 0);
    } else if (b.phase === 'dock' || b.phase === 'flying') {
      if (b.phase === 'dock') { b.phase = 'flying'; b.fly = 0; }
      b.fly = Math.min(1, b.fly + dt / 0.8);
      const k = b.fly * b.fly * (3 - 2 * b.fly);
      const top = TANK.h + 0.8;
      b.y = STAND_TOP + (top - STAND_TOP) * Math.sin(k * Math.PI * 0.5);
      b.group.position.set(0, b.y, DECK_Z * (1 - k));
      if (b.fly >= 1) b.phase = 'water';
    } else {
      // Floating: the bottom rests as far under the surface as its load needs. Sinking: down through the water to the sand.
      const floats = floatsWith(b.build, load);
      const before = b.y;
      if (floats) {
        const target = WATER - Math.min(1, draft(b.build, load)) * b.h;
        b.y += (target - b.y) * Math.min(1, dt * (b.y > target ? 3 : 1.5));
        b.group.rotation.z *= 0.9;
      } else {
        b.y = Math.max(0.18, b.y - dt * (b.y > WATER ? 4 : 1.3));
        b.group.rotation.z += (0.3 - b.group.rotation.z) * Math.min(1, dt * 1.5);
      }
      if (before > WATER && b.y <= WATER) splash(0);
      const bob = floats ? Math.sin(clock * 1.6) * 0.025 : 0;
      b.group.position.set(0, b.y + bob, 0);
    }
    b.pennies.forEach((m, i) => {
      const on = i < load;
      if (on && b.shownAt[i] < 0) b.shownAt[i] = clock;
      if (!on) b.shownAt[i] = -1;
      m.visible = on;
      if (on) m.position.y = b.spots[i].y + Math.max(0, 1 - (clock - b.shownAt[i]) / 0.35) * 1.4;
    });
  };

  /**
   * In the tank: weight down, the water's push up on the part under the surface, and water drag. Small fixed steps keep
   * a slow device (a few frames a second) in real time without the bob blowing up.
   */
  /** The water's density (1 fresh, more with salt), set each frame. */
  let wd = 1;
  /**
   * A thing's density over the water's. A food is within a tenth of the water's, so it would rise or sink at a crawl;
   * its gap is drawn 30 times wider, so a food sinks or rises within a few seconds of a spoon and floats proud once the salt
   * outweighs it. The side of 1 it is on, which decides float or sink, is the model's.
   */
  const relDensity = (t: HarborThing) => { const r = densityOf(t) / wd; return t.density != null ? Math.min(3, Math.max(0.35, 1 + (r - 1) * 30)) : r; };
  const stepInWater = (b: Body, dt: number) => {
    const rho = relDensity(b.thing);
    const floor = 0.18 + b.h / 2;
    const steps = Math.max(1, Math.ceil(dt / 0.016));
    let sub = 0;
    for (let k = 0; k < steps; k++) {
      const h = dt / steps;
      const prevSub = Math.max(0, Math.min(1, (WATER - (b.y - b.h / 2)) / b.h));
      // Per unit volume, against the water's density: weight rho, push up sub. The water dragged along adds half its own mass
      // under the surface, so a very light thing (foam) bobs instead of launching out.
      const a = (G * (prevSub - rho) - 2.4 * b.v * prevSub) / (rho + 0.5 * prevSub) - 0.05 * b.v;
      b.v += a * h;
      b.y += b.v * h;
      if (b.y < floor) { b.y = floor; b.v = Math.abs(b.v) > 0.6 ? -b.v * 0.15 : 0; }
      sub = Math.max(0, Math.min(1, (WATER - (b.y - b.h / 2)) / b.h));
      if (prevSub === 0 && sub > 0 && b.v < -1) splash(b.group.position.x);
    }
    b.sub = sub;
    if (sub > 0 && rho < 1) b.wobble += dt;
    b.group.position.y = b.y;
    b.group.rotation.z = rho < 1 && sub > 0 ? Math.sin(b.wobble * 1.8) * 0.05 : b.group.rotation.z * 0.9;
  };

  const disposeGroup = (g: THREE.Group) => g.traverse(o => {
    if (o instanceof THREE.Mesh && o.geometry !== pennyGeo) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
  });

  const tickExtras = (dt: number, things: readonly HarborThing[] | null | undefined) => {
    const key = things?.map(t => t.key).join('+') ?? '';
    if (key !== extrasKey) {
      extras.forEach(b => { thingRoot.remove(b.group); disposeGroup(b.group); });
      extras = (things ?? []).slice(0, 2).map((t, i) => {
        const { group, h } = buildThing(t);
        tag(group, 'pass');
        thingRoot.add(group);
        const y = TANK.h + 0.6 + h / 2;
        group.position.set(EXTRA_X[i], y, EXTRA_Z);
        return { thing: t, group, h, y, v: 0, phase: 'falling', fly: 1, wobble: 0, sub: 0 } as Body;
      });
      extrasKey = key;
    }
    extras.forEach(b => stepInWater(b, dt));
  };

  const tickModels = (dt: number, models: HarborState['modelBoats']) => {
    const key = models?.map(m => `${m.build.material}/${m.build.shape}/${m.build.size}/${m.pennies}`).join('+') ?? '';
    if (key !== modelKey) {
      modelBoats.forEach(m => { boatRoot.remove(m.group); disposeGroup(m.group); });
      modelBoats = (models ?? []).slice(0, 2).map((m, i) => {
        const { group, h, spots } = buildBoat(m.build);
        spots.slice(0, m.pennies).forEach(p => { const c = new THREE.Mesh(pennyGeo, pennyMat); c.position.copy(p); c.renderOrder = 5; group.add(c); });
        tag(group, 'pass');
        group.position.set(MODEL_X[i], WATER + 0.3, 0);
        boatRoot.add(group);
        return { group, build: m.build, h, y: WATER + 0.3, pennies: m.pennies };
      });
      modelKey = key;
    }
    modelBoats.forEach(m => {
      if (floatsWith(m.build, m.pennies)) m.y += (WATER - Math.min(1, draft(m.build, m.pennies)) * m.h - m.y) * Math.min(1, dt * 2);
      else m.y = Math.max(0.18, m.y - dt * 1.3);
      m.group.position.y = m.y + (floatsWith(m.build, m.pennies) ? Math.sin(clock * 1.6 + 1) * 0.02 : 0);
    });
  };

  /** The x-ray arrows on everything in the water; hidden when x-ray is off. */
  const tickXray = (s: HarborState) => {
    let i = 0;
    const centre = new THREE.Vector3();
    if (s.xray) {
      for (const b of [...bodies, ...extras]) {
        if (!b || b.phase !== 'falling' || b.sub <= 0) continue;
        b.group.getWorldPosition(centre);
        // A food on the bottom: the true push over weight, its gap from 1 drawn 6 times longer, so every spoon of salt
        // visibly lengthens the blue arrow (the clamped drawn density would hide the first spoons).
        const sunkFood = b.thing.density != null && densityOf(b.thing) >= wd;
        setArrows(i++, centre, sunkFood ? Math.max(0.15, 1 + (wd / densityOf(b.thing) - 1) * 6) : b.sub / relDensity(b.thing));
      }
      const boatRatio = (build: BoatBuild, n: number) => (floatsWith(build, n) ? 1 : maxDisplaced(build) / (hullMass(build) + n * PENNY));
      if (boat && boat.phase === 'water' && s.boat?.launched && boat.y < WATER + 0.05) {
        centre.set(boat.group.position.x, boat.y + boat.h / 2, boat.group.position.z);
        setArrows(i++, centre, boatRatio(boat.build, s.boat.pennies));
      }
      for (const m of modelBoats) {
        centre.set(m.group.position.x, m.y + m.h / 2, m.group.position.z);
        setArrows(i++, centre, boatRatio(m.build, m.pennies));
      }
    }
    for (; i < arrowPairs.length; i++) { arrowPairs[i].down.visible = false; arrowPairs[i].up.visible = false; }
  };

  let clock = 0;
  const tick = (dt: number, s: HarborState) => {
    clock += dt;
    wd = waterDensity(s.spoons ?? 0);
    tickSalt(dt, s.spoons ?? 0);
    tickBoat(dt, s.boat);
    // The water surface ripples a little.
    const pos = surfGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = surfBase[i * 3], y = surfBase[i * 3 + 1];
      pos.setZ(i, Math.sin(x * 1.3 + clock * 1.6) * 0.025 + Math.cos(y * 1.7 + clock * 1.2) * 0.02);
    }
    pos.needsUpdate = true;

    bodies.forEach((b, i) => {
      if (!b) return;
      const slot = i as Slot;
      if (!s.dropped[slot]) { if (b.phase !== 'dock') restOnDock(b, slot); return; }
      if (b.phase === 'dock') { b.phase = 'flying'; b.fly = 0; }
      if (b.phase === 'flying') {
        b.fly = Math.min(1, b.fly + dt / 0.7);
        const k = b.fly * b.fly * (3 - 2 * b.fly);
        const top = TANK.h + 1.4 + b.h / 2;
        const x = layout.x[slot] + (layout.tankX[slot] - layout.x[slot]) * k;
        b.group.position.set(x, b.h / 2 + (top - b.h / 2) * Math.sin(k * Math.PI * 0.5), DECK_Z * (1 - k));
        if (b.fly >= 1) { b.phase = 'falling'; b.y = top; b.v = 0; }
        return;
      }
      stepInWater(b, dt);
    });

    for (const r of rings) {
      if (r.t >= 1) { r.mesh.visible = false; continue; }
      r.t = Math.min(1, r.t + dt / 0.9);
      const sc = 1 + r.t * 3;
      r.mesh.scale.set(sc, sc, sc);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - r.t);
    }

    tickExtras(dt, s.extras);
    tickModels(dt, s.modelBoats);
    tickXray(s);
    tags.forEach((t, i) => {
      const b = bodies[i];
      if (!t) return;
      t.visible = !!s.tags && !!b && !s.finale;
      if (b) { const p = b.group.position; t.position.set(p.x, p.y + b.h / 2 + 1.25, p.z); }
    });

    const place = (arrow: THREE.Mesh, slot: Slot | null) => {
      const b = slot == null ? null : bodies[slot];
      arrow.visible = !!b && !s.finale;
      if (!b) return;
      const p = b.group.position;
      arrow.position.set(p.x, p.y + b.h / 2 + 0.7 + Math.sin(clock * 3) * 0.12, p.z);
    };
    place(arrows.selected, s.selected);
    place(arrows.evidence, s.evidence);
    if (s.evidence != null && s.selected === s.evidence) arrows.selected.visible = false;
  };

  const pickPoint = (target: HarborTarget) => {
    if (target === 'water') return tank.localToWorld(new THREE.Vector3(0, WATER * 0.6, 0));
    const b = bodies[Number(target.slice(6))];
    return b ? b.group.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);
  };

  const targetFromHit = (obj: THREE.Object3D): HarborTarget | 'pass' | null => {
    const t = obj.userData?.target as string | undefined;
    if (t === 'pass') return 'pass';
    if (t === 'water') return 'water';
    if (t && t.startsWith('thing:')) return t as HarborTarget;
    return null;
  };

  const dispose = () => {
    setThings(null);
    clearBoat();
    tickExtras(0, null);
    tickModels(0, null);
    for (const d of disposables) d.dispose();
  };

  return { root, setThings, tick, pickPoint, targetFromHit, dispose };
}
