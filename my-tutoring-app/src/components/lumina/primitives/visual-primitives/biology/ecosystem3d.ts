/**
 * The ecosystem diorama, built in code with three.js (no model files): a glass tank on a wooden table, water with
 * fish and swaying weed, and an island with a grassy hill, a leafy tree, a pine, flowers, a crab on the beach, a
 * bird overhead, and a shade hut on the sand. The sun travels an arc over the tank and is the light that casts
 * every shadow. Pure scene construction plus a per-frame `tick`; the React layer (`EcosystemScene.tsx`) owns the
 * canvas, the camera, the taps and dragging the sun.
 *
 * sun_test props: two test things on the sand (or one in the hut), each with a picture thermometer beside it, a
 * guess flag, heat shimmer that grows with the reading, and a ring on the one the learner picked.
 *
 * Tappable meshes carry `userData.target` ('left' | 'right' | 'sun'). Glass, water, the hut and the animals carry
 * 'pass' so a tap goes through them to what is behind; the island and scenery carry none (no target).
 */
import * as THREE from 'three';
import { sunAngle, sunStrength, type Side, type Spot, type TestThing } from './ecosystemModel';
import { buildLife, type LifeState } from './ecosystemLife3d';
import type { Animal, WinterPlace } from './ecosystemLife';

export { makeSkyEnvironment } from '../engineering/airliner3d';

export type EcoTarget = Side | 'sun' | `animal:${Animal}` | `place:${WinterPlace}`;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

// ── Layout (world frame: table top at y = 0, the tank centred on the origin, +z toward the viewer) ─────────────
const TANK = { hx: 10.5, hz: 6.5, h: 10 };
const FLOOR = 0.25;
export const WATER = 3.2;
const BEACH = WATER + 0.55;
const ISLAND = { x: 0, z: -0.3, rx: 7.6, rz: 4.7 };
const HILL = { x: -3.4, z: -2.6, a: 2.1, s: 1.9 };
const RIDGE = { x: 3.6, z: -2.8, a: 1.2, s: 1.6 };
/** The sun's arc: a circle in the plane z = SUN.z, centred above the tank. */
const SUN = { x: 0, y: 2, z: -1, r: 14 };
export const SPOTS: Record<Spot, { x: number; z: number }> = {
  sunLeft: { x: -4.4, z: 2.6 }, hut: { x: -0.25, z: -0.5 }, sunRight: { x: 4.2, z: 2.6 },
};
/** The shade hut: walls on the sunrise and sunset sides and at the back, eaves at `h`, a ridge at `ridge`. */
const HUT = { x: -0.2, z: -0.4, w: 2.9, d: 2.3, h: 2.35, ridge: 3.1 };
/** The hut stands in the meadow behind the open-sand spots: the sun crosses left to right, so its shadow never reaches them. */
const inHut = (x: number, z: number) => Math.abs(x - HUT.x) < HUT.w / 2 + 0.7 && Math.abs(z - HUT.z) < HUT.d / 2 + 0.7;
/** Every test thing (and its thermometer) is drawn at this scale, big enough for a young child to read. */
const STATION_SCALE = 1.35;
/** Where a thermometer stands from its thing, in station units. */
const THERMO_AT = { x: 0.8, z: 0.45 };
/** The thermometer card's height and centre (station units); the tube runs over 72% of it. Short enough to stand under the hut roof. */
const THERMO_H = 1.6, THERMO_Y = 1.15, TUBE_H = THERMO_H * 0.72;

/** The island's surface height at (x, z): a flat sandy top, a hill and a ridge at the back, sloping under the water. */
export function groundY(x: number, z: number): number {
  const u = Math.hypot((x - ISLAND.x) / ISLAND.rx, (z - ISLAND.z) / ISLAND.rz);
  const plate = u < 1 ? Math.sqrt(1 - u * u) : 0;
  const shelf = smooth(Math.min(1, plate * 2.4));
  const g = (c: { x: number; z: number; a: number; s: number }) => c.a * Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (2 * c.s * c.s));
  const n = 0.05 * Math.sin(x * 1.7 + z * 0.9) + 0.04 * Math.sin(z * 2.3 - x * 1.1);
  return Math.max(FLOOR + 0.05, FLOOR + 0.4 + (BEACH - FLOOR - 0.4) * shelf + (g(HILL) + g(RIDGE)) * shelf + n * (0.4 + shelf));
}

export function sunPosition(p: number): THREE.Vector3 {
  const a = sunAngle(p);
  return V(SUN.x + SUN.r * Math.cos(a), SUN.y + SUN.r * Math.sin(a), SUN.z);
}

/** Camera presets: close on the test (guess, read), and wide enough to see the sun's whole path (run). */
export const TANK_VIEWS = {
  test: { t: V(0, 4.6, 1.0), th: 0.1, ph: 1.08, r: 22 },
  sky: { t: V(0, 7.2, 0), th: 0.1, ph: 1.2, r: 42 },
  island: { t: V(-0.5, 4.6, -0.4), th: 0.05, ph: 1.0, r: 30 },
} as const;
/** The open sand at the front of the beach, where the plant pot and the keep-it-cool thing stand. */
const FRONT_SPOT = { x: 0.1, z: 2.75 };
export type TankFocus = keyof typeof TANK_VIEWS;

// ── Textures ─────────────────────────────────────────────────────────────────────────────────────────────────
const FONT = '"Fredoka","Baloo 2","Arial Rounded MT Bold",Arial,sans-serif';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, aniso: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

function paintWood(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#8a5a35'; g.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 2) {
    const v = Math.sin(y * 0.05) * 0.5 + Math.sin(y * 0.013 + 1) * 0.5;
    g.fillStyle = `rgba(${v > 0 ? '60,35,18' : '200,150,100'},${0.06 + Math.abs(v) * 0.08})`;
    g.fillRect(0, y, W, 2);
  }
  for (let i = 0; i < 9; i++) {
    g.strokeStyle = 'rgba(50,28,14,0.25)'; g.lineWidth = 3;
    const y = (i + 0.5) * H / 9;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
}

/** The thermometer card: a snowflake at the cold end, a sun at the hot end, five tick marks between. */
function paintThermoCard(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#fbfaf5'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#2d3a4a'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  // tube zone: y from 0.86H (bulb top) to 0.14H (full)
  const yAt = (f: number) => H * (0.86 - 0.72 * f);
  g.strokeStyle = '#2d3a4a'; g.lineWidth = 5;
  for (let k = 1; k <= 5; k++) {
    const y = yAt(k / 5);
    g.beginPath(); g.moveTo(W * 0.12, y); g.lineTo(W * 0.32, y); g.moveTo(W * 0.68, y); g.lineTo(W * 0.88, y); g.stroke();
  }
  // sun (hot) at the top
  g.fillStyle = '#ffb21a'; g.beginPath(); g.arc(W / 2, H * 0.065, W * 0.13, 0, TAU); g.fill();
  g.strokeStyle = '#ffb21a'; g.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * W * 0.17, H * 0.065 + Math.sin(a) * W * 0.17);
    g.lineTo(W / 2 + Math.cos(a) * W * 0.25, H * 0.065 + Math.sin(a) * W * 0.25); g.stroke();
  }
  // snowflake (cold) at the bottom
  g.strokeStyle = '#3a8fd9'; g.lineWidth = 5;
  const cy = H * 0.955;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3;
    g.beginPath(); g.moveTo(W / 2 - Math.cos(a) * W * 0.16, cy - Math.sin(a) * W * 0.16);
    g.lineTo(W / 2 + Math.cos(a) * W * 0.16, cy + Math.sin(a) * W * 0.16); g.stroke();
  }
}

function paintGlow(g: CanvasRenderingContext2D, W: number, H: number) {
  const r = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  r.addColorStop(0, 'rgba(255,240,180,1)'); r.addColorStop(0.25, 'rgba(255,210,90,0.55)');
  r.addColorStop(0.6, 'rgba(255,180,60,0.12)'); r.addColorStop(1, 'rgba(255,170,50,0)');
  g.fillStyle = r; g.fillRect(0, 0, W, H);
}

function paintShimmer(g: CanvasRenderingContext2D, W: number, H: number) {
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = `rgba(255,${200 - i * 25},${120 - i * 20},0.55)`; g.lineWidth = 6;
    g.beginPath();
    for (let y = 0; y <= H; y += 4) {
      const x = W * (0.2 + i * 0.2) + Math.sin(y * 0.06 + i) * W * 0.06;
      if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  const fade = g.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.7, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
}

function paintFlag(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, H / 2); g.lineTo(0, H); g.closePath(); g.fill();
  g.fillStyle = '#5a3d00'; g.font = `800 ${Math.floor(H * 0.62)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('?', W * 0.33, H * 0.54);
}

function paintSign(name: string) {
  return (g: CanvasRenderingContext2D, W: number, H: number) => {
    g.fillStyle = '#b07a45'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 3) { g.fillStyle = `rgba(60,30,10,${0.05 + 0.05 * Math.sin(y * 0.3)})`; g.fillRect(0, y, W, 2); }
    g.strokeStyle = '#5c3a1c'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
    g.fillStyle = '#fff7e6'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = name;
    g.font = `800 ${label.length > 14 ? Math.floor(58 * 14 / label.length) : 58}px ${FONT}`;
    g.fillText(label, W / 2, H / 2 + 3);
  };
}

// ── The world ────────────────────────────────────────────────────────────────────────────────────────────────

export interface EcoState {
  /** The two things on test, or null between tests. */
  test: { left: TestThing; right: TestThing } | null;
  /** Thermometer fills, 0.1 (cool) to 1 (hot). */
  fills: { left: number; right: number };
  /** Day progress, 0 (morning) to 1 (mid-afternoon). */
  sunP: number;
  guess: Side | null;
  picked: Side | null;
  verdict: 'correct' | 'incorrect' | null;
  /** The sun may be dragged now: it pulses and its path shows. */
  sunActive: boolean;
  /** Every test is done. */
  finale: boolean;
  /** The living layer: weather, winter, animals, the plant, the keep-it-cool thing. */
  life: LifeState;
}

export interface EcosystemWorld {
  root: THREE.Group;
  tick(dt: number, state: EcoState, camera: THREE.Camera): void;
  /** Build the two test things (and their thermometers) for a new test; null clears them. */
  setTest(test: { left: TestThing; right: TestThing } | null): void;
  /** The target a ray hit names; null for the island or scenery; 'pass' for glass, water, the hut and animals. */
  targetFromHit(object: THREE.Object3D): EcoTarget | 'pass' | null;
  /** A world point on each target, for drives. */
  pickPoint(target: EcoTarget): THREE.Vector3;
  /** Day progress for a pointer ray dragging the sun along its arc, or null when the ray misses the arc's plane. */
  sunParamFromRay(ray: THREE.Ray): number | null;
  dispose(): void;
}

export function buildEcosystem(opts: { islandName: string; anisotropy?: number }): EcosystemWorld {
  const aniso = opts.anisotropy ?? 4;
  const textures: THREE.Texture[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const std = (hex: number, rough: number, metal = 0, extra?: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, ...extra });
    mats.push(m); return m;
  };
  const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const t = canvasTex(w, h, draw, aniso); textures.push(t); return t;
  };
  const geo = <G extends THREE.BufferGeometry>(g: G) => { geos.push(g); return g; };

  const root = new THREE.Group();
  const mesh = (g: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const tag = (o: THREE.Object3D, t: EcoTarget | 'pass') => o.traverse(c => { c.userData.target = t; });

  const M = {
    trunk: std(0x6b4423, 0.9),
    leaf: std(0x4e9a3a, 0.8, 0, { flatShading: true }),
    leafLight: std(0x6dbb4a, 0.8, 0, { flatShading: true }),
    pine: std(0x2f6b3a, 0.85, 0, { flatShading: true }),
    rock: std(0x8b8780, 0.9, 0, { flatShading: true }),
    thatch: std(0xc9a25a, 0.95),
    thatchDark: std(0xa47e3e, 0.95),
    post: std(0x7a5230, 0.85),
    stem: std(0x3f8a3a, 0.8),
    crab: std(0xe0502e, 0.55),
    eye: std(0x111111, 0.3),
    white: std(0xffffff, 0.4),
    bird: std(0x3e7fd6, 0.6),
    beak: std(0xf2a71b, 0.5),
    weed: std(0x3f9a5a, 0.7, 0, { side: THREE.DoubleSide }),
    frame: std(0x1f2328, 0.45, 0.6),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8eef5, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.11,
      depthWrite: false, side: THREE.DoubleSide }),
    water: new THREE.MeshStandardMaterial({ color: 0x3aa6c4, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.3,
      depthWrite: false }),
    waterTop: new THREE.MeshStandardMaterial({ color: 0x5cc2dc, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.55,
      depthWrite: false, side: THREE.DoubleSide }),
  };
  mats.push(M.glass, M.water, M.waterTop);

  let islandGeometry: THREE.BufferGeometry = new THREE.BufferGeometry();
  // ── Table ──────────────────────────────────────────────────────────────────────────────────────────────────
  {
    const wood = tex(1024, 512, paintWood);
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    const table = mesh(geo(new THREE.BoxGeometry(32, 0.8, 20)), std(0xffffff, 0.7, 0, { map: wood }), root, 0, -0.4, 0);
    table.castShadow = false;
  }

  // ── Island and tank floor: one displaced surface, coloured by height and place ─────────────────────────────
  {
    const g = geo(new THREE.PlaneGeometry(TANK.hx * 2 - 0.1, TANK.hz * 2 - 0.1, 210, 130));
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols: number[] = [];
    const sand = new THREE.Color(0xe9d4a0), wetSand = new THREE.Color(0xcdb17a), floor = new THREE.Color(0xb9a27a);
    const grass = new THREE.Color(0x67a84a), grassDark = new THREE.Color(0x4f8c3a), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = groundY(x, z);
      p.setY(i, y);
      const n = Math.sin(x * 9.1 + z * 4.3) * 0.5 + Math.sin(x * 3.3 - z * 7.7) * 0.5;
      if (y < WATER - 0.15) c.copy(floor).lerp(wetSand, 0.3 + 0.3 * n).multiplyScalar(0.92 + 0.08 * Math.sin(x * 23 + z * 17));
      else {
        // Grass on the back of the island and up the hill; sand on the beach in front.
        const grassy = smooth((0.9 - z) / 1.6) * smooth((y - WATER - 0.25) / 0.3);
        c.copy(y < WATER + 0.25 ? wetSand : sand).lerp(n > 0 ? grass : grassDark, grassy * (0.9 + 0.1 * n));
      }
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const island = mesh(g, std(0xffffff, 0.95, 0, { vertexColors: true }), root);
    island.castShadow = false;
    islandGeometry = g;
  }

  // ── Water: a clear body, a moving surface, weed and fish ───────────────────────────────────────────────────
  const water = new THREE.Group(); root.add(water); tag(water, 'pass');
  mesh(geo(new THREE.BoxGeometry(TANK.hx * 2 - 0.12, WATER - FLOOR, TANK.hz * 2 - 0.12)), M.water, water, 0, (WATER + FLOOR) / 2, 0)
    .castShadow = false;
  const surfGeo = geo(new THREE.PlaneGeometry(TANK.hx * 2 - 0.12, TANK.hz * 2 - 0.12, 84, 52));
  surfGeo.rotateX(-Math.PI / 2);
  const surf = mesh(surfGeo, M.waterTop, water, 0, WATER, 0);
  surf.castShadow = false;
  const surfBase = Float32Array.from(surfGeo.attributes.position.array as ArrayLike<number>);
  tag(water, 'pass');

  const weeds: THREE.Object3D[][] = [];
  {
    const segGeo = geo(new THREE.BoxGeometry(0.16, 0.42, 0.03));
    const spots = [[-8.6, -4.8], [-7.8, 4.9], [8.4, -4.6], [9.0, 3.8], [-9.2, 0.6], [6.8, 5.4], [-4.5, 5.5], [2.5, -5.6]];
    for (const [x, z] of spots) {
      let parent: THREE.Object3D = root;
      const chain: THREE.Object3D[] = [];
      const base = new THREE.Group(); base.position.set(x, FLOOR, z); base.rotation.y = Math.random() * TAU; root.add(base); parent = base;
      for (let k = 0; k < 6; k++) {
        const seg = new THREE.Group(); seg.position.y = k === 0 ? 0 : 0.4; parent.add(seg);
        mesh(segGeo, M.weed, seg, 0, 0.2, 0).scale.set(1 - k * 0.1, 1, 1);
        chain.push(seg); parent = seg;
      }
      tag(base, 'pass'); weeds.push(chain);
    }
  }

  type Fish = { g: THREE.Group; tail: THREE.Object3D; rx: number; rz: number; y: number; speed: number; phase: number };
  const fish: Fish[] = [];
  {
    const bodyGeo = geo(new THREE.SphereGeometry(0.5, 20, 14));
    const tailGeo = geo(new THREE.ConeGeometry(0.28, 0.42, 4));
    const eyeGeo = geo(new THREE.SphereGeometry(0.06, 8, 6));
    const colours = [0xff8a1f, 0xffc93a, 0x3ab5ff, 0xff5f7a];
    colours.forEach((col, i) => {
      const g = new THREE.Group(); root.add(g);
      const body = mesh(bodyGeo, std(col, 0.45, 0.1), g); body.scale.set(1, 0.55, 0.36);
      const tail = new THREE.Group(); tail.position.x = -0.45; g.add(tail);
      const t = mesh(tailGeo, std(col, 0.5), tail, -0.16, 0, 0); t.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) mesh(eyeGeo, M.eye, g, 0.3, 0.07, 0.15 * s);
      g.scale.setScalar(0.7 + (i % 2) * 0.25);
      tag(g, 'pass');
      fish.push({ g, tail, rx: 9.6 - (i % 2) * 0.5, rz: 5.9 - (i % 2) * 0.35, y: 1.0 + i * 0.45, speed: 0.16 + i * 0.03, phase: i * 1.7 });
    });
  }

  // Bubbles from a stone in the back corner.
  const bubbles: THREE.Mesh[] = [];
  {
    const bGeo = geo(new THREE.SphereGeometry(0.07, 8, 6));
    const bMat = new THREE.MeshStandardMaterial({ color: 0xeefcff, roughness: 0.1, transparent: true, opacity: 0.6, depthWrite: false });
    mats.push(bMat);
    for (let i = 0; i < 14; i++) {
      const b = mesh(bGeo, bMat, root, 9.3, FLOOR + (i / 14) * (WATER - FLOOR), -5.3); b.castShadow = false;
      b.userData.target = 'pass'; bubbles.push(b);
    }
    mesh(geo(new THREE.DodecahedronGeometry(0.35, 0)), M.rock, root, 9.3, FLOOR + 0.15, -5.3);
  }

  // ── Plants and rocks on the island ─────────────────────────────────────────────────────────────────────────
  const scenery = new THREE.Group(); root.add(scenery);
  const leafy = new THREE.Group(); scenery.add(leafy);
  const leafPuffs: THREE.Mesh[] = [];
  {
    const x = HILL.x + 0.2, z = HILL.z + 0.2, y = groundY(x, z);
    leafy.position.set(x, y, z);
    const tr = mesh(geo(new THREE.CylinderGeometry(0.22, 0.34, 2.6, 10)), M.trunk, leafy, 0, 1.3, 0);
    tr.rotation.z = 0.04;
    const blob = geo(new THREE.IcosahedronGeometry(1, 1));
    const puffs: [number, number, number, number][] = [[0, 3.2, 0, 1.5], [1.0, 2.9, 0.3, 1.1], [-1.0, 2.9, -0.2, 1.15], [0.3, 2.8, 1.0, 1.05],
      [-0.4, 2.85, -1.0, 1.1], [0.2, 4.0, 0.1, 1.05], [0.9, 3.6, -0.6, 0.9]];
    puffs.forEach(([px, py, pz, s], i) => {
      const m = mesh(blob, std(i % 2 ? 0x6dbb4a : 0x4e9a3a, 0.8, 0, { flatShading: true }), leafy, px, py, pz);
      m.scale.setScalar(s); m.userData.baseScale = s; leafPuffs.push(m);
    });
  }
  {
    const x = RIDGE.x, z = RIDGE.z, y = groundY(x, z);
    const pine = new THREE.Group(); pine.position.set(x, y, z); scenery.add(pine);
    mesh(geo(new THREE.CylinderGeometry(0.16, 0.24, 1.2, 8)), M.trunk, pine, 0, 0.6, 0);
    [[1.6, 1.8, 1.2], [1.25, 1.6, 2.2], [0.9, 1.4, 3.1]].forEach(([r, h, yy]) => mesh(geo(new THREE.ConeGeometry(r, h, 9)), M.pine, pine, 0, yy, 0));
  }
  {
    // Bushes, flowers and grass tufts on the grassy back of the island.
    const bushGeo = geo(new THREE.IcosahedronGeometry(0.55, 1));
    for (const [x, z] of [[-6.0, -1.4], [-1.6, -2.9], [1.6, -3.2], [5.8, -1.6], [-5.2, -3.0]]) {
      mesh(bushGeo, M.leafLight, scenery, x, groundY(x, z) + 0.25, z).scale.set(1.1, 0.8, 1);
    }
    const stemGeo = geo(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5));
    const headGeo = geo(new THREE.IcosahedronGeometry(0.12, 1));
    const petals = [0xff6fae, 0xffd23f, 0xb084ff, 0xffffff, 0xff8a3d].map(c => std(c, 0.6));
    for (let i = 0; i < 26; i++) {
      const x = -6.2 + Math.random() * 12.4, z = -3.6 + Math.random() * 3.6;
      const y = groundY(x, z);
      if (y < WATER + 0.5 || inHut(x, z)) continue;
      mesh(stemGeo, M.stem, scenery, x, y + 0.25, z);
      mesh(headGeo, petals[i % petals.length], scenery, x, y + 0.52, z);
    }
    const tuftGeo = geo(new THREE.ConeGeometry(0.06, 0.38, 4));
    const tufts = new THREE.InstancedMesh(tuftGeo, M.stem, 520);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), pv = new THREE.Vector3();
    let n = 0;
    for (let tries = 0; n < 520 && tries < 4000; tries++) {
      const x = -7 + Math.random() * 14, z = -4.4 + Math.random() * 5.2;
      const y = groundY(x, z);
      if (y < WATER + 0.55 || z > 0.6 || inHut(x, z)) continue;
      e.set((Math.random() - 0.5) * 0.4, Math.random() * TAU, (Math.random() - 0.5) * 0.4); q.setFromEuler(e);
      s.setScalar(0.7 + Math.random() * 0.8); pv.set(x, y + 0.15, z);
      tufts.setMatrixAt(n++, m4.compose(pv, q, s));
    }
    tufts.count = n; tufts.receiveShadow = true; scenery.add(tufts);
    // Rocks along the shore.
    const rockGeo = geo(new THREE.DodecahedronGeometry(0.4, 0));
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * TAU + 0.2;
      if (Math.sin(a) > 0.55 && Math.abs(Math.cos(a)) < 0.6) continue; // keep the front beach clear
      const x = ISLAND.x + Math.cos(a) * ISLAND.rx * 0.93, z = ISLAND.z + Math.sin(a) * ISLAND.rz * 0.93;
      const r = mesh(rockGeo, M.rock, scenery, x, groundY(x, z) + 0.1, z);
      r.scale.set(0.8 + Math.random() * 0.9, 0.6 + Math.random() * 0.6, 0.8 + Math.random() * 0.9);
      r.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    }
  }

  // The island sign.
  {
    const x = 2.6, z = -1.0, y = groundY(x, z);
    const sign = new THREE.Group(); sign.position.set(x, y, z); sign.rotation.y = -0.15; scenery.add(sign);
    mesh(geo(new THREE.BoxGeometry(0.12, 1.5, 0.12)), M.post, sign, 0, 0.75, 0);
    mesh(geo(new THREE.BoxGeometry(2.0, 0.6, 0.08)), [M.post, M.post, M.post, M.post,
      std(0xffffff, 0.8, 0, { map: tex(512, 160, paintSign(opts.islandName)) }), M.post], sign, 0, 1.45, 0.02);
  }

  // ── The shade hut: a pitched thatched roof on posts, walled on the sunrise and sunset sides and at the back ──
  {
    const hut = new THREE.Group(); hut.position.set(HUT.x, groundY(HUT.x, HUT.z), HUT.z); root.add(hut);
    const postGeo = geo(new THREE.CylinderGeometry(0.09, 0.1, HUT.h, 8));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(postGeo, M.post, hut, sx * HUT.w / 2, HUT.h / 2, sz * HUT.d / 2);
    // Two roof slopes meeting at a ridge that runs left to right, overhanging the posts.
    const over = 0.45, run = HUT.d / 2 + over, rise = HUT.ridge - HUT.h;
    const slope = Math.hypot(run, rise), tilt = Math.atan2(rise, run);
    const panelGeo = geo(new THREE.BoxGeometry(HUT.w + 0.9, 0.14, slope));
    for (const s of [-1, 1]) {
      const panel = mesh(panelGeo, s < 0 ? M.thatch : M.thatchDark, hut, 0, HUT.h + rise / 2 - 0.02, s * run / 2);
      panel.rotation.x = s * tilt;
      // Thatch bundles: ridges of straw across each slope.
      for (let k = 1; k < 5; k++) {
        const f = k / 5;
        const bundle = mesh(geo(new THREE.CylinderGeometry(0.07, 0.07, HUT.w + 0.9, 6)), M.thatchDark, hut,
          0, HUT.h + rise * (1 - f) + 0.07, s * run * f);
        bundle.rotation.z = Math.PI / 2;
      }
    }
    mesh(geo(new THREE.CylinderGeometry(0.12, 0.12, HUT.w + 1.0, 8)), M.post, hut, 0, HUT.ridge + 0.05, 0).rotation.z = Math.PI / 2;
    // Woven walls: sunrise and sunset sides, and the back.
    const weave = std(0xb98d4c, 0.95);
    const wallGeo = geo(new THREE.BoxGeometry(0.1, HUT.h, HUT.d));
    for (const sx of [-1, 1]) mesh(wallGeo, weave, hut, sx * HUT.w / 2, HUT.h / 2, 0);
    mesh(geo(new THREE.BoxGeometry(HUT.w, HUT.h, 0.1)), weave, hut, 0, HUT.h / 2, -HUT.d / 2);
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) {
      mesh(geo(new THREE.BoxGeometry(0.12, 0.05, HUT.d + 0.02)), M.thatchDark, hut, sx * HUT.w / 2, 0.35 + k * 0.45, 0);
    }
    tag(hut, 'pass');
  }

  const thermoCard = tex(160, 600, paintThermoCard);
  const life = buildLife({
    root, groundY, islandGeometry, leafPuffs, leafyTree: leafy, frontSpot: FRONT_SPOT, hutSpot: SPOTS.hut, water: WATER,
    tank: { hx: TANK.hx, hz: TANK.hz, top: FLOOR + TANK.h - 0.25 }, thermoTexture: thermoCard,
  });

  // ── The crab on the beach and the bird overhead ───────────────────────────────────────────────────────────
  const crab = new THREE.Group(); root.add(crab);
  const crabLegs: THREE.Object3D[] = [];
  {
    const body = mesh(geo(new THREE.SphereGeometry(0.32, 16, 10)), M.crab, crab, 0, 0.2, 0); body.scale.set(1.25, 0.55, 0.9);
    const legGeo = geo(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5));
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const leg = new THREE.Group(); leg.position.set(-0.18 + k * 0.18, 0.18, 0.24 * s); crab.add(leg);
      const l = mesh(legGeo, M.crab, leg, 0, -0.1, 0.12 * s); l.rotation.x = 1.0 * s;
      crabLegs.push(leg);
    }
    for (const s of [-1, 1]) {
      mesh(geo(new THREE.SphereGeometry(0.11, 10, 8)), M.crab, crab, 0.42, 0.3, 0.2 * s).scale.set(1.3, 0.8, 0.9);
      mesh(geo(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 5)), M.crab, crab, 0.12, 0.38, 0.1 * s);
      mesh(geo(new THREE.SphereGeometry(0.045, 8, 6)), M.eye, crab, 0.12, 0.48, 0.1 * s);
    }
    crab.rotation.y = -Math.PI / 2; // claws toward the viewer; it walks sideways along x
    tag(crab, 'pass');
  }
  const bird = new THREE.Group(); root.add(bird);
  const wings: THREE.Object3D[] = [];
  {
    const body = mesh(geo(new THREE.SphereGeometry(0.3, 14, 10)), M.bird, bird); body.scale.set(1.5, 0.8, 0.8);
    mesh(geo(new THREE.SphereGeometry(0.2, 12, 8)), M.bird, bird, 0.42, 0.14, 0);
    const beak = mesh(geo(new THREE.ConeGeometry(0.06, 0.2, 6)), M.beak, bird, 0.64, 0.12, 0); beak.rotation.z = -Math.PI / 2;
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.set(0, 0.08, 0.15 * s); bird.add(w);
      const wm = mesh(geo(new THREE.BoxGeometry(0.42, 0.04, 0.8)), M.bird, w, 0, 0, 0.4 * s);
      wm.castShadow = true; wings.push(w);
      mesh(geo(new THREE.SphereGeometry(0.04, 6, 6)), M.eye, bird, 0.5, 0.2, 0.1 * s);
    }
    tag(bird, 'pass');
  }

  const rim: { mesh: THREE.Mesh; normal: THREE.Vector3; mat: THREE.MeshStandardMaterial }[] = [];
  // ── The glass tank ────────────────────────────────────────────────────────────────────────────────────────
  {
    const tank = new THREE.Group(); root.add(tank);
    const { hx, hz, h } = TANK, cy = FLOOR + h / 2 - 0.25;
    mesh(geo(new THREE.PlaneGeometry(hx * 2, h)), M.glass, tank, 0, cy, hz).castShadow = false;
    mesh(geo(new THREE.PlaneGeometry(hx * 2, h)), M.glass, tank, 0, cy, -hz).castShadow = false;
    const side = geo(new THREE.PlaneGeometry(hz * 2, h));
    for (const s of [-1, 1]) { const m = mesh(side, M.glass, tank, s * hx, cy, 0); m.rotation.y = Math.PI / 2; m.castShadow = false; }
    const t = 0.16;
    const xBar = geo(new THREE.BoxGeometry(hx * 2 + t, t, t)), zBar = geo(new THREE.BoxGeometry(t, t, hz * 2 + t)), yBar = geo(new THREE.BoxGeometry(t, h, t));
    for (const s of [-1, 1]) { mesh(xBar, M.frame, tank, 0, cy - h / 2, s * hz); mesh(zBar, M.frame, tank, s * hx, cy - h / 2, 0); }
    // The top rim: each bar fades when it faces the camera, so the near rim never cuts across the island.
    for (const s of [-1, 1]) {
      for (const [g, x, z, n] of [[xBar, 0, s * hz, V(0, 0, s)], [zBar, s * hx, 0, V(s, 0, 0)]] as const) {
        const mat = std(0x1f2328, 0.45, 0.6, { transparent: true });
        rim.push({ mesh: mesh(g, mat, tank, x, cy + h / 2, z), normal: n, mat });
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(yBar, M.frame, tank, sx * hx, cy, sz * hz);
    tank.traverse(c => { if ((c as THREE.Mesh).isMesh) c.castShadow = false; });
    tag(tank, 'pass');
  }

  // ── The sun: a glowing ball on its arc, the light that casts every shadow ──────────────────────────────────
  const sun = new THREE.Group(); root.add(sun);
  const sunBall = mesh(geo(new THREE.SphereGeometry(1.0, 32, 20)),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.82, 0.3).multiplyScalar(1.6), toneMapped: false }), sun);
  sunBall.castShadow = false; sunBall.receiveShadow = false;
  mats.push(sunBall.material as THREE.Material);
  const glowMat = new THREE.SpriteMaterial({ map: tex(256, 256, paintGlow), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  mats.push(glowMat);
  const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(7); sun.add(glow);
  const sunHit = mesh(geo(new THREE.SphereGeometry(2.4, 12, 8)),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }), sun);
  mats.push(sunHit.material as THREE.Material);
  sunHit.castShadow = false;
  tag(sun, 'sun');

  // The path the sun travels: a dotted arc, shown while the sun can be moved.
  const pathMat = new THREE.LineDashedMaterial({ color: 0xffd35a, dashSize: 0.45, gapSize: 0.35, transparent: true, opacity: 0 });
  mats.push(pathMat);
  const pathGeo = geo(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 81 }, (_, i) => sunPosition(i / 80))));
  const path = new THREE.Line(pathGeo, pathMat); path.computeLineDistances(); root.add(path);
  tag(path, 'pass');

  const light = new THREE.DirectionalLight(0xfff4dc, 2.4);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.left = -13; light.shadow.camera.right = 13; light.shadow.camera.top = 13; light.shadow.camera.bottom = -13;
  light.shadow.camera.near = 1; light.shadow.camera.far = 60;
  light.shadow.bias = -0.0004; light.shadow.normalBias = 0.03;
  light.target.position.set(0, WATER, 0);
  root.add(light, light.target);
  const hemi = new THREE.HemisphereLight(0xdcefff, 0x8a6a40, 0.55); root.add(hemi);

  // ── The test things ───────────────────────────────────────────────────────────────────────────────────────
  type Station = {
    side: Side; group: THREE.Group; thing: THREE.Group; fill: THREE.Mesh; fillNow: number;
    flag: THREE.Object3D; ring: THREE.Mesh; shimmer: THREE.Mesh[]; thermo: THREE.Group; pick: THREE.Vector3;
  };
  let stations: Station[] = [];
  const thermoTex = thermoCard;
  const flagTex = tex(128, 96, paintFlag);
  const shimmerTex = tex(128, 256, paintShimmer);
  shimmerTex.wrapT = THREE.RepeatWrapping;
  const testMats: THREE.Material[] = [];
  const testGeos: THREE.BufferGeometry[] = [];
  const tstd = (hex: number, rough: number, extra?: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, ...extra }); testMats.push(m); return m;
  };
  const tgeo = <G extends THREE.BufferGeometry>(g: G) => { testGeos.push(g); return g; };

  const THING_COLOUR: Record<TestThing['kind'], Record<TestThing['colour'], number>> = {
    paper: { dark: 0x1c1c22, light: 0xf6f4ec, natural: 0xc7a273 },
    stone: { dark: 0x2a2a30, light: 0xeee8d8, natural: 0x8e8a82 },
    water: { dark: 0x1a1a1f, light: 0xf4f4f0, natural: 0xffffff },
    sand: { dark: 0x1a1a1f, light: 0xf4f4f0, natural: 0xffffff },
  };

  function buildThing(t: TestThing): THREE.Group {
    const g = new THREE.Group();
    const colour = THING_COLOUR[t.kind][t.colour];
    if (t.kind === 'paper') {
      const sheet = new THREE.PlaneGeometry(1.25, 1.0, 10, 8); testGeos.push(sheet);
      const p = sheet.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, 0.05 * Math.cos(x * 2.4)); }
      sheet.computeVertexNormals();
      const m = mesh(sheet, tstd(colour, 0.85, { side: THREE.DoubleSide }), g, 0, 0.06, 0);
      m.rotation.x = -Math.PI / 2; m.rotation.z = 0.12;
    } else if (t.kind === 'stone') {
      const s = tgeo(new THREE.IcosahedronGeometry(0.5, 3));
      const p = s.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
        const n = 1 + 0.08 * Math.sin(v.x * 7 + v.z * 3) + 0.05 * Math.sin(v.y * 9);
        p.setXYZ(i, v.x * n * 1.15, v.y * n * 0.62, v.z * n);
      }
      s.computeVertexNormals();
      mesh(s, tstd(colour, t.colour === 'light' ? 0.6 : 0.75), g, 0, 0.27, 0);
    } else {
      // A cup: black, white, or clear glass (natural), holding water or sand.
      const clear = t.colour === 'natural';
      const cupMat = clear
        ? tstd(0xe8f6fb, 0.05, { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })
        : tstd(colour, 0.35, { side: THREE.DoubleSide });
      mesh(tgeo(new THREE.CylinderGeometry(0.42, 0.34, 0.85, 32, 1, true)), cupMat, g, 0, 0.43, 0);
      mesh(tgeo(new THREE.CircleGeometry(0.34, 32)), cupMat, g, 0, 0.02, 0).rotation.x = -Math.PI / 2;
      if (t.kind === 'water') {
        const w = mesh(tgeo(new THREE.CylinderGeometry(0.39, 0.34, 0.62, 32)), tstd(0x4fb3dc, 0.1, { transparent: true, opacity: clear ? 0.75 : 0.9 }), g, 0, 0.33, 0);
        w.castShadow = false;
      } else {
        mesh(tgeo(new THREE.CylinderGeometry(0.39, 0.34, 0.62, 32)), tstd(0xd9b56e, 0.95), g, 0, 0.33, 0);
      }
    }
    return g;
  }

  function buildStation(t: TestThing, side: Side): Station {
    const spot = SPOTS[t.spot];
    const group = new THREE.Group(); group.position.set(spot.x, groundY(spot.x, spot.z), spot.z); group.scale.setScalar(STATION_SCALE); root.add(group);
    const thing = buildThing(t); group.add(thing);
    // The thermometer stands just right of and in front of the thing, facing the viewer.
    const thermo = new THREE.Group(); thermo.position.set(THERMO_AT.x, 0, THERMO_AT.z); group.add(thermo);
    mesh(tgeo(new THREE.BoxGeometry(0.06, 0.4, 0.06)), M.post, thermo, 0, 0.2, 0);
    const card = mesh(tgeo(new THREE.BoxGeometry(0.6, THERMO_H, 0.05)), [M.post, M.post, M.post, M.post,
      tstd(0xffffff, 0.7, { map: thermoTex }), M.post], thermo, 0, THERMO_Y, 0);
    card.castShadow = true;
    const tubeY0 = THERMO_Y - THERMO_H / 2 + THERMO_H * (1 - 0.86);
    const tube = mesh(tgeo(new THREE.CylinderGeometry(0.085, 0.085, TUBE_H, 16)),
      tstd(0xffffff, 0.05, { transparent: true, opacity: 0.35, depthWrite: false }), thermo, 0, tubeY0 + TUBE_H / 2, 0.07);
    tube.castShadow = false;
    const fillGeo = tgeo(new THREE.CylinderGeometry(0.062, 0.062, 1, 12)); fillGeo.translate(0, 0.5, 0);
    const fill = mesh(fillGeo, tstd(0xe8322a, 0.4, { emissive: new THREE.Color(0xff2a10), emissiveIntensity: 0.35 }), thermo, 0, tubeY0, 0.07);
    fill.scale.y = 0.1 * TUBE_H;
    mesh(tgeo(new THREE.SphereGeometry(0.15, 16, 12)), fill.material as THREE.Material, thermo, 0, tubeY0 - 0.08, 0.07);
    // The guess flag.
    const flag = new THREE.Group(); flag.position.set(-0.75, 0, -0.35); group.add(flag);
    mesh(tgeo(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6)), M.white, flag, 0, 0.65, 0);
    const banner = mesh(tgeo(new THREE.PlaneGeometry(0.62, 0.46)), tstd(0xffffff, 0.6, { map: flagTex, transparent: true, side: THREE.DoubleSide }), flag, 0.32, 1.06, 0);
    banner.castShadow = false;
    flag.visible = false;
    // The ring that marks the learner's pick.
    const ring = mesh(tgeo(new THREE.TorusGeometry(0.78, 0.06, 10, 48)), tstd(0x3ddc84, 0.4, { emissive: new THREE.Color(0x1aa860), emissiveIntensity: 0.8 }), group, 0, 0.05, 0);
    ring.rotation.x = Math.PI / 2; ring.visible = false; ring.castShadow = false;
    // Heat shimmer over the thing.
    const shimmer: THREE.Mesh[] = [];
    for (let k = 0; k < 2; k++) {
      const sm = new THREE.MeshBasicMaterial({ map: shimmerTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      testMats.push(sm);
      const s = mesh(tgeo(new THREE.PlaneGeometry(0.9, 1.5)), sm, group, 0, 1.1, 0); s.castShadow = false; s.rotation.y = k * Math.PI / 2;
      shimmer.push(s);
    }
    tag(group, side);
    return { side, group, thing, fill, fillNow: 0.1, flag, ring, shimmer, thermo, pick: new THREE.Vector3(spot.x, groundY(spot.x, spot.z) + 0.4 * STATION_SCALE, spot.z) };
  }

  function clearTest() {
    for (const s of stations) root.remove(s.group);
    stations = [];
    testMats.forEach(m => m.dispose()); testMats.length = 0;
    testGeos.forEach(g => g.dispose()); testGeos.length = 0;
  }

  let clock = 0, sunShown = 0;
  const camPos = new THREE.Vector3();

  return {
    root,
    setTest(test) {
      clearTest();
      if (!test) return;
      stations = [buildStation(test.left, 'left'), buildStation(test.right, 'right')];
    },
    tick(dt, state, camera) {
      clock += dt;
      // The sun and its light.
      sunShown = lerp(sunShown, state.sunP, 1 - Math.exp(-dt * 10));
      const sp = sunPosition(sunShown);
      sun.position.copy(sp);
      const pulse = state.sunActive ? 1 + 0.08 * Math.sin(clock * 4) : 1;
      sunBall.scale.setScalar(pulse);
      glow.scale.setScalar(7 * pulse + (state.finale ? 1.5 * (1 + Math.sin(clock * 3)) : 0));
      pathMat.opacity = lerp(pathMat.opacity, state.sunActive ? 0.85 : 0.18, 1 - Math.exp(-dt * 4));
      const strength = sunStrength(sunShown) * life.sunlight(state.life);
      light.position.copy(sp);
      light.intensity = 0.5 + 2.3 * strength;
      sunBall.visible = state.life.weather == null || state.life.weather === 'sunny' || state.life.weather === 'windy';
      glow.visible = sunBall.visible;
      light.color.setRGB(1, 0.86 + 0.12 * strength, 0.7 + 0.25 * strength);
      hemi.intensity = 0.4 + 0.3 * strength;

      // Water surface ripples.
      const pos = surfGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = surfBase[i * 3], z = surfBase[i * 3 + 2];
        pos.setY(i, 0.035 * Math.sin(x * 1.3 + clock * 1.6) + 0.025 * Math.sin(z * 1.9 - clock * 1.2));
      }
      pos.needsUpdate = true;

      // Weed sways; fish swim the ring of water around the island; bubbles rise.
      weeds.forEach((chain, j) => chain.forEach((seg, k) => {
        seg.rotation.z = 0.12 * Math.sin(clock * 1.1 + j + k * 0.6); seg.rotation.x = 0.08 * Math.sin(clock * 0.8 + j * 2 + k * 0.5);
      }));
      for (const f of fish) {
        const a = f.phase + clock * f.speed;
        const x = Math.cos(a) * f.rx, z = Math.sin(a) * f.rz;
        f.g.position.set(x, f.y + 0.15 * Math.sin(clock * 0.9 + f.phase), z);
        f.g.rotation.y = Math.atan2(-Math.cos(a) * f.rz, -Math.sin(a) * f.rx) + (state.finale ? 0.3 * Math.sin(clock * 6) : 0);
        f.tail.rotation.y = 0.45 * Math.sin(clock * 9 + f.phase);
      }
      bubbles.forEach((b, i) => {
        const t = ((clock * 0.35 + i / bubbles.length) % 1);
        b.position.set(9.3 + 0.12 * Math.sin(clock * 3 + i), FLOOR + 0.3 + t * (WATER - FLOOR - 0.3), -5.3 + 0.1 * Math.cos(clock * 2 + i));
      });

      // The crab scuttles along the front beach; the bird circles the island.
      const cx = 0.6 + 2.0 * Math.sin(clock * 0.35);
      crab.position.set(cx, groundY(cx, 3.9), 3.9);
      crabLegs.forEach((l, i) => { l.rotation.x = 0.35 * Math.sin(clock * 14 + i * 1.3); });
      const ba = clock * 0.32;
      bird.position.set(Math.cos(ba) * 5.2, 8.0 + 0.4 * Math.sin(clock * 0.9), -0.6 + Math.sin(ba) * 3.0);
      bird.rotation.y = -ba - Math.PI / 2;
      bird.rotation.z = state.finale ? 0.4 * Math.sin(clock * 2) : 0.1;
      wings.forEach((w, i) => { w.rotation.x = (i ? 1 : -1) * 0.55 * Math.sin(clock * 7); });

      // The test stations.
      camera.getWorldPosition(camPos);
      life.tick(dt, state.life, clock, camPos);
      bird.visible = !state.life.animals;
      for (const r of rim) {
        const facing = r.normal.x * camPos.x + r.normal.z * camPos.z > (r.normal.x ? TANK.hx : TANK.hz) && camPos.y > 2;
        r.mat.opacity = lerp(r.mat.opacity, facing ? 0.08 : 1, 1 - Math.exp(-dt * 8));
        r.mat.depthWrite = r.mat.opacity > 0.9;
      }
      for (const s of stations) {
        const target = state.fills[s.side];
        s.fillNow = lerp(s.fillNow, target, 1 - Math.exp(-dt * 6));
        s.fill.scale.y = Math.max(0.02, s.fillNow * TUBE_H);
        // The thermometer turns to face the viewer (about the vertical only).
        const wp = s.group.position;
        s.thermo.rotation.y = Math.atan2(camPos.x - (wp.x + THERMO_AT.x * STATION_SCALE), camPos.z - (wp.z + THERMO_AT.z * STATION_SCALE));
        s.flag.visible = state.guess === s.side;
        if (s.flag.visible) s.flag.rotation.y = 0.15 * Math.sin(clock * 2.2);
        s.ring.visible = state.picked === s.side;
        if (s.ring.visible) {
          (s.ring.material as THREE.MeshStandardMaterial).color.setHex(state.verdict === 'incorrect' ? 0xffb020 : 0x3ddc84);
          (s.ring.material as THREE.MeshStandardMaterial).emissive.setHex(state.verdict === 'incorrect' ? 0xb06a00 : 0x1aa860);
          s.ring.scale.setScalar(1 + 0.05 * Math.sin(clock * 5));
        }
        const heat = clamp((s.fillNow - 0.3) * 1.6, 0, 0.85);
        s.shimmer.forEach((m, k) => {
          const mm = m.material as THREE.MeshBasicMaterial;
          mm.opacity = heat * (0.75 + 0.25 * Math.sin(clock * 5 + k));
          mm.map!.offset.y = -clock * 0.4;
          m.lookAt(camPos.x, m.getWorldPosition(new THREE.Vector3()).y, camPos.z);
          if (k) m.rotateY(Math.PI / 5);
        });
      }
    },
    targetFromHit(object) {
      let o: THREE.Object3D | null = object;
      while (o) { if (o.userData.target) return o.userData.target as EcoTarget | 'pass'; o = o.parent; }
      return null;
    },
    pickPoint(target) {
      if (target === 'sun') return sun.position.clone();
      if (target.startsWith('animal:') || target.startsWith('place:')) return life.pickPoint(target) ?? new THREE.Vector3();
      const s = stations.find(x => x.side === target);
      return s ? s.pick.clone() : new THREE.Vector3();
    },
    sunParamFromRay(ray) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -SUN.z);
      const hit = ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return null;
      let a = Math.atan2(hit.y - SUN.y, hit.x - SUN.x);
      if (a < 0) a = hit.x > SUN.x ? 0 : Math.PI;
      return clamp((a / Math.PI - 0.18) / 0.64, 0, 1);
    },
    dispose() {
      clearTest();
      life.dispose();
      textures.forEach(t => t.dispose());
      geos.forEach(g => g.dispose());
      mats.forEach(m => m.dispose());
    },
  };
}
