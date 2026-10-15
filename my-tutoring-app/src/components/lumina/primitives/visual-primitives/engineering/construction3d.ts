/**
 * A construction site diorama built in code with three.js (no model files): a tracked excavator, a dump truck,
 * a pile of material and a dirt base. Pure scene construction plus a per-frame `tick` and a `run` for one
 * excavator action; the React layer (`ConstructionScene.tsx`) owns the canvas, the camera and the taps.
 *
 * The excavator arm is a real 2-link chain (boom, stick) solved by inverse kinematics for a wrist point, with the
 * bucket's angle set on top, so every pose the animation asks for is one the arm can reach. The hydraulic
 * cylinders are re-aimed between their two anchors every frame.
 *
 * Tappable meshes carry `userData.target` ('pile' | 'truck'). The excavator and the scenery carry none: a tap on
 * the arm passes through to what is behind it, and a tap on the ground is no target.
 */
import * as THREE from 'three';
import { BED_SLOTS, type Material } from './constructionModel';

export { makeSkyEnvironment } from './airliner3d';

export type SiteTarget = 'pile' | 'truck';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (x: number) => x * x * (3 - 2 * x);

// ── Layout (world frame: ground at y = 0, the excavator at the origin facing +x at swing 0) ─────────────────
const BASE_R = 16;
/** Swing angle (house rotation about y) that faces the pile and the truck bed. */
const HEADING: Record<SiteTarget, number> = { pile: 0.9, truck: -0.9 };
/** Both sit 6.3 m from the excavator, in reach of the arm. */
const WORK_R = 6.3;
const at = (heading: number, r: number) => V(r * Math.cos(heading), 0, -r * Math.sin(heading));
export const PILE_POS = at(HEADING.pile, WORK_R);
const BED_POS = at(HEADING.truck, WORK_R);
/** Truck frame: +x forward. The bed hinge sits at the back; the bed's centre is 2.2 m ahead of the hinge. */
const HINGE_X = -3.25, BED_LEN = 4.4, BED_W = 2.2;
const TRUCK_POS = V(BED_POS.x - (HINGE_X + BED_LEN / 2), 0, BED_POS.z);

const MATERIAL_COLOR: Record<Material, number> = { dirt: 0x7a5230, sand: 0xd8b36e, gravel: 0x8f8e8a, rocks: 0x6c6862 };
const CHUNKY: Record<Material, boolean> = { dirt: false, sand: false, gravel: true, rocks: true };

// ── Arm geometry (house frame: +x forward, +y up) ─────────────────────────────────────────────────────────
const BOOM_PIVOT = V(1.2, 0.85, -0.35);
const L1 = 3.6, L2 = 2.6;
const HOUSE_Y = 1.12;

/** Elbow-up 2-link IK: boom and stick angles that put the wrist at (r, h) from the boom pivot. */
function solveArm(r: number, h: number): [number, number] {
  const d = clamp(Math.hypot(r, h), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.01);
  const c2 = clamp((d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1);
  const q2 = -Math.acos(c2);
  const q1 = Math.atan2(h, r) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
  return [q1, q2];
}

/** One excavator pose: swing, wrist reach and height from the boom pivot, and the bucket's angle (0 = cup up). */
interface Pose { s: number; r: number; h: number; phi: number }
interface Segment { to: Partial<Pose>; dur: number; from?: Pose; t: number; then?: () => void }

const CARRY: Omit<Pose, 's'> = { r: 4.2, h: 2.6, phi: 0.4 };
/** Wrist heights for working each target (the bucket hangs about a metre below the wrist when it digs). */
const WORK = {
  pile: { open: 0.9, dig: 0.05, curl: 0.45, over: 1.9 },
  truck: { open: 1.6, dig: 0.65, curl: 1.0, over: 2.4 },
} as const;

// ── Textures ─────────────────────────────────────────────────────────────────────────────────────────────
const FONT = '"Barlow Semi Condensed","Arial Narrow",Arial,sans-serif';

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, aniso: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}

/** The dirt base: packed earth, tyre tracks, and the haul road the truck drives along. */
function paintGround(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#9a7a52'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 22000; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.45 ? 'rgba(60,40,20,0.10)' : v < 0.9 ? 'rgba(255,240,210,0.07)' : 'rgba(40,30,20,0.25)';
    const s = Math.random() < 0.97 ? 2 : 4;
    g.fillRect(Math.random() * W, Math.random() * H, s, s);
  }
  const px = (x: number) => (0.5 + x / (2 * BASE_R)) * W, pz = (z: number) => (0.5 + z / (2 * BASE_R)) * H;
  // The haul road (plane uv: u = x, v = z).
  g.fillStyle = 'rgba(70,55,40,0.35)'; g.fillRect(0, pz(TRUCK_POS.z - 1.5), W, pz(TRUCK_POS.z + 1.5) - pz(TRUCK_POS.z - 1.5));
  g.strokeStyle = 'rgba(45,32,20,0.35)'; g.lineWidth = 10; g.setLineDash([14, 10]);
  for (const dz of [-0.95, 0.95]) { g.beginPath(); g.moveTo(0, pz(TRUCK_POS.z + dz)); g.lineTo(W, pz(TRUCK_POS.z + dz)); g.stroke(); }
  // Excavator track marks around the machine.
  g.setLineDash([8, 8]); g.lineWidth = 16; g.strokeStyle = 'rgba(55,40,25,0.25)';
  for (const r of [2.4, 3.1]) { g.beginPath(); g.arc(px(0), pz(0), (r / (2 * BASE_R)) * W, 0, TAU); g.stroke(); }
  g.setLineDash([]);
}

function paintDoor(name: string) {
  return (g: CanvasRenderingContext2D, W: number, H: number) => {
    g.fillStyle = '#e8661c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1d2433'; g.fillRect(0, H * 0.62, W, H * 0.06);
    const label = name.toUpperCase();
    g.font = `800 ${label.length > 9 ? Math.floor(H * 0.34 * 9 / label.length) : Math.floor(H * 0.34)}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
    g.fillText(label, W / 2, H * 0.36);
    g.font = `700 ${Math.floor(H * 0.16)}px ${FONT}`; g.fillStyle = '#1d2433';
    g.fillText('HAULING', W / 2, H * 0.83);
  };
}

function paintSign(name: string) {
  return (g: CanvasRenderingContext2D, W: number, H: number) => {
    g.fillStyle = '#f2b21b'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#1d2433'; g.lineWidth = 14; g.strokeRect(10, 10, W - 20, H - 20);
    g.fillStyle = '#1d2433'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const label = name.toUpperCase();
    g.font = `800 ${label.length > 10 ? Math.floor(70 * 10 / label.length) : 70}px ${FONT}`;
    g.fillText(label, W / 2, H * 0.38);
    g.font = `700 40px ${FONT}`; g.fillText('WORK SITE', W / 2, H * 0.72);
  };
}

function drawPlate(g: CanvasRenderingContext2D, W: number, H: number, tons: number | null) {
  g.clearRect(0, 0, W, H);
  if (tons == null) return;
  g.fillStyle = '#f5f5f0'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1d2433'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
  g.fillStyle = '#1d2433'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${Math.floor(H * 0.28)}px ${FONT}`; g.fillText('MAX LOAD', W / 2, H * 0.3);
  g.font = `800 ${Math.floor(H * 0.42)}px ${FONT}`; g.fillText(`${tons} TONS`, W / 2, H * 0.68);
}

// ── The site ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SiteState {
  material: Material;
  /** Mounds in the bed (scoops loaded). */
  loaded: number;
  /** Scoops that missed the bed because it was full. */
  spilled: number;
  /** The bucket holds a scoop (kept in step with the scene when no action is running). */
  holding: boolean;
  /** The truck's limit painted on its bed (tons asks), or null. */
  capacityTons: number | null;
  /** The loaded truck drives off. */
  departing: boolean;
  /** The truck was sent too heavy: it squats on its springs. */
  squash: boolean;
  /** Every load is done: the excavator waves its bucket. */
  finale: boolean;
}

export interface SiteAction { kind: 'dig' | 'dump'; at: SiteTarget }

export interface ConstructionSite {
  root: THREE.Group;
  tick(dt: number, state: SiteState): void;
  /**
   * Start one excavator action. `onMoment` fires when the scoop changes hands (the bucket curls full, or the
   * dumped scoop lands); `onIdle` when the arm is back at rest. Returns false while another action runs.
   */
  run(action: SiteAction, state: SiteState, cb: { onMoment: () => void; onIdle: () => void }): boolean;
  /** A new, empty truck rolls in. */
  newTruck(): void;
  busy(): boolean;
  /** The target a ray hit names; null for the ground, scenery or a hidden mesh; 'pass' for the excavator. */
  targetFromHit(object: THREE.Object3D): SiteTarget | 'pass' | null;
  /** A world point on each target, for drives. */
  pickPoint(target: SiteTarget): THREE.Vector3;
  dispose(): void;
}

export const SITE_VIEW = { t: V(2.6, 1.2, 0), th: 1.22, ph: 0.98, r: 22 };

export function buildConstructionSite(opts: { company: string; anisotropy?: number }): ConstructionSite {
  const aniso = opts.anisotropy ?? 4;
  const textures: THREE.Texture[] = [];
  const std = (hex: number, rough: number, metal: number, extra?: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, ...extra });
  const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const t = canvasTex(w, h, draw, aniso); textures.push(t); return t;
  };

  const M = {
    yellow: std(0xf2b21b, 0.45, 0.15),
    yellowDark: std(0xd99a10, 0.5, 0.15),
    orange: std(0xe8661c, 0.45, 0.15),
    dark: std(0x2b2e33, 0.6, 0.4, { side: THREE.DoubleSide }),
    steel: std(0x8a9099, 0.35, 0.85),
    chrome: std(0xe6e9ec, 0.12, 1.0),
    rubber: std(0x1b1c1e, 0.9, 0.0),
    glass: std(0x16283a, 0.08, 0.6, { transparent: true, opacity: 0.78 }),
    grille: std(0x3a3d42, 0.5, 0.7),
    lamp: std(0xfff4d0, 0.3, 0.1, { emissive: new THREE.Color(0xfff0c0), emissiveIntensity: 0.6 }),
    beacon: std(0xff9a1a, 0.3, 0.1, { emissive: new THREE.Color(0xff7a00), emissiveIntensity: 0.9 }),
    load: std(MATERIAL_COLOR.dirt, 0.95, 0.0),
    loadChunky: std(MATERIAL_COLOR.dirt, 0.9, 0.0, { flatShading: true }),
    skin: std(0xc4906c, 0.7, 0),
    vest: std(0xd9f227, 0.6, 0),
    navy: std(0x1d2a44, 0.8, 0),
  };

  const root = new THREE.Group();
  const shadow = (o: THREE.Object3D) => { o.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) =>
    mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z);
  const tagTarget = (o: THREE.Object3D, t: SiteTarget) => o.traverse(c => { c.userData.target = t; });

  // ── Base ──────────────────────────────────────────────────────────────────────────────────────────────
  {
    const groundTex = tex(2048, 2048, paintGround);
    const top = std(0xffffff, 0.95, 0.0, { map: groundTex });
    const side = std(0x4a3524, 0.85, 0.05);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(BASE_R, BASE_R + 0.8, 1.2, 120, 1), [side, top, side]);
    base.position.y = -0.6; base.receiveShadow = true; root.add(base);
    // Cylinder cap uv runs u along x, v along -z; flip so the road lands under the truck.
    groundTex.center.set(0.5, 0.5); groundTex.repeat.set(1, -1);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(BASE_R + 0.02, 0.09, 10, 160), std(0xc9a45c, 0.25, 1));
    rim.rotation.x = Math.PI / 2; root.add(rim);
  }

  // ── The pile ──────────────────────────────────────────────────────────────────────────────────────────
  const pile = new THREE.Group(); pile.position.copy(PILE_POS); root.add(pile);
  const pileMat = std(MATERIAL_COLOR.dirt, 0.95, 0.0);
  {
    const geo = new THREE.SphereGeometry(2.3, 48, 24, 0, TAU, 0, Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + 0.07 * Math.sin(x * 2.1 + z * 1.3) + 0.05 * Math.sin(z * 3.7 - x * 0.9) + 0.03 * Math.sin(x * 7 + z * 5);
      p.setXYZ(i, x * n, y * 0.62 * n, z * n);
    }
    geo.computeVertexNormals();
    mesh(geo, pileMat, pile);
  }
  const pileRocks = new THREE.Group(); pile.add(pileRocks);
  {
    const rockGeo = new THREE.DodecahedronGeometry(0.16, 0);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * 2.05;
      const y = 1.43 * Math.sqrt(Math.max(0, 1 - (rr / 2.3) ** 2)) * 0.98;
      const m = mesh(rockGeo, M.loadChunky, pileRocks, Math.cos(a) * rr, y, Math.sin(a) * rr);
      m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      m.scale.setScalar(0.7 + Math.random() * 0.8);
    }
  }
  tagTarget(pile, 'pile');

  // ── The excavator ─────────────────────────────────────────────────────────────────────────────────────
  const exc = new THREE.Group(); root.add(exc);
  exc.userData.excavator = true;
  {
    // Tracks: a stadium loop each side, with pads, a sprocket and an idler.
    const tl = 3.6, th = 0.85, tw = 0.62, rad = th / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-tl / 2 + rad, -rad); shape.lineTo(tl / 2 - rad, -rad);
    shape.absarc(tl / 2 - rad, 0, rad, -Math.PI / 2, Math.PI / 2, false);
    shape.lineTo(-tl / 2 + rad, rad);
    shape.absarc(-tl / 2 + rad, 0, rad, Math.PI / 2, Math.PI * 1.5, false);
    const trackGeo = new THREE.ExtrudeGeometry(shape, { depth: tw, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 18 });
    trackGeo.translate(0, 0, -tw / 2);
    const padGeo = new THREE.BoxGeometry(0.16, 0.05, tw + 0.08);
    const discGeo = new THREE.CylinderGeometry(rad - 0.06, rad - 0.06, 0.08, 28); discGeo.rotateX(Math.PI / 2);
    for (const side of [1, -1]) {
      const z = side * 1.15;
      mesh(trackGeo, M.rubber, exc, 0, rad, z);
      for (let i = 0; i < 13; i++) {
        const x = -tl / 2 + rad + (i / 12) * (tl - 2 * rad);
        mesh(padGeo, M.dark, exc, x, th + 0.02, z); mesh(padGeo, M.dark, exc, x, -0.0, z);
      }
      for (const x of [tl / 2 - rad, -tl / 2 + rad]) mesh(discGeo, M.steel, exc, x, rad, z + side * (tw / 2 + 0.03));
      for (const x of [-0.75, 0, 0.75]) {
        const roller = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 18), M.steel, exc, x, 0.24, z + side * (tw / 2 + 0.03));
        roller.rotation.x = Math.PI / 2;
      }
    }
    box(2.2, 0.45, 1.7, M.dark, exc, 0, 0.62, 0);
    mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.26, 40), M.dark, exc, 0, 0.98, 0);
  }
  const house = new THREE.Group(); house.position.y = HOUSE_Y; exc.add(house);
  {
    box(3.0, 1.0, 2.3, M.yellow, house, -0.1, 0.5, 0);
    // Counterweight: a rounded block at the back.
    const cw = mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.95, 40, 1, false, Math.PI, Math.PI), M.dark, house, -1.6, 0.52, 0);
    cw.scale.set(0.45, 1, 1);
    box(1.3, 0.32, 1.25, M.yellowDark, house, -0.85, 1.16, -0.45);
    for (let i = 0; i < 5; i++) box(0.06, 0.02, 1.0, M.grille, house, -1.3 + i * 0.22, 1.33, -0.45);
    const stack = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 14), M.dark, house, -0.5, 1.55, -0.95);
    stack.castShadow = true;
    // Cab: glass box with a yellow frame and roof, and an operator inside.
    const cab = new THREE.Group(); cab.position.set(0.55, 1.0, 0.6); house.add(cab);
    box(1.2, 1.4, 0.95, M.glass, cab, 0, 0.72, 0);
    box(1.28, 0.1, 1.02, M.yellow, cab, 0, 1.46, 0);
    for (const [x, z] of [[0.6, 0.47], [0.6, -0.47], [-0.6, 0.47], [-0.6, -0.47]] as const) box(0.08, 1.42, 0.08, M.yellow, cab, x, 0.72, z);
    box(1.22, 0.32, 0.97, M.yellow, cab, 0, 0.16, 0);
    const seat = box(0.4, 0.5, 0.45, M.dark, cab, -0.2, 0.55, 0);
    void seat;
    mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.42, 14), M.vest, cab, 0.0, 0.78, 0);
    mesh(new THREE.SphereGeometry(0.12, 16, 12), M.skin, cab, 0.02, 1.08, 0);
    mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, TAU, 0, Math.PI / 2), M.yellow, cab, 0.02, 1.13, 0);
    const beacon = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 14), M.beacon, cab, -0.4, 1.57, 0.3);
    void beacon;
    box(0.12, 0.08, 0.2, M.lamp, cab, 0.62, 1.38, 0.3);
  }

  // Arm: boom pivot → stick pivot → bucket pivot.
  const boomP = new THREE.Group(); boomP.position.copy(BOOM_PIVOT); house.add(boomP);
  {
    const s = new THREE.Shape();
    s.moveTo(0, 0.3); s.lineTo(1.75, 0.85); s.lineTo(L1 + 0.15, 0.22); s.lineTo(L1 + 0.15, -0.22);
    s.lineTo(1.8, 0.38); s.lineTo(0, -0.32); s.lineTo(-0.2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 });
    g.translate(0, 0, -0.25);
    mesh(g, M.yellow, boomP);
    const pin = new THREE.CylinderGeometry(0.12, 0.12, 0.66, 16); pin.rotateX(Math.PI / 2);
    mesh(pin, M.steel, boomP); mesh(pin, M.steel, boomP, L1, 0, 0);
  }
  const stickP = new THREE.Group(); stickP.position.set(L1, 0, 0); boomP.add(stickP);
  {
    const s = new THREE.Shape();
    s.moveTo(-0.55, 0.32); s.lineTo(L2 + 0.1, 0.16); s.lineTo(L2 + 0.1, -0.16); s.lineTo(-0.55, -0.24);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1 });
    g.translate(0, 0, -0.19);
    mesh(g, M.yellow, stickP);
    const pin = new THREE.CylinderGeometry(0.09, 0.09, 0.56, 14); pin.rotateX(Math.PI / 2);
    mesh(pin, M.steel, stickP, L2, 0, 0);
  }
  const bucketP = new THREE.Group(); bucketP.position.set(L2, 0, 0); stickP.add(bucketP);
  const bucketLoad = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 12), M.load);
  {
    // Cup cross-section: open toward +y at phi = 0, reaching forward from the hinge to the teeth.
    const outer = new THREE.Shape();
    outer.moveTo(0, 0.05); outer.quadraticCurveTo(-0.2, -0.65, 0.4, -0.8); outer.quadraticCurveTo(1.0, -0.75, 1.15, 0.05);
    outer.lineTo(1.05, 0.05); outer.quadraticCurveTo(0.92, -0.62, 0.42, -0.68); outer.quadraticCurveTo(-0.06, -0.55, 0.1, 0.05);
    const shell = new THREE.ExtrudeGeometry(outer, { depth: 1.0, bevelEnabled: false, curveSegments: 16 });
    shell.translate(0, 0, -0.5);
    mesh(shell, M.dark, bucketP);
    const sideS = new THREE.Shape();
    sideS.moveTo(0, 0.05); sideS.quadraticCurveTo(-0.2, -0.65, 0.4, -0.8); sideS.quadraticCurveTo(1.0, -0.75, 1.15, 0.05); sideS.lineTo(0, 0.05);
    const sideG = new THREE.ShapeGeometry(sideS, 12);
    for (const z of [0.5, -0.5]) mesh(sideG, M.dark, bucketP, 0, 0, z);
    for (let i = 0; i < 5; i++) {
      const tooth = mesh(new THREE.ConeGeometry(0.06, 0.24, 8), M.steel, bucketP, 1.17, 0.12, -0.4 + i * 0.2);
      tooth.rotation.z = -0.25;
    }
    bucketLoad.position.set(0.55, -0.2, 0); bucketLoad.scale.set(1.05, 0.62, 0.95);
    bucketLoad.visible = false; bucketLoad.castShadow = true; bucketP.add(bucketLoad);
    const pin = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 14); pin.rotateX(Math.PI / 2);
    mesh(pin, M.steel, bucketP);
  }
  // Hydraulic cylinders, re-aimed every frame between anchors on two links.
  interface Ram { a: THREE.Object3D; pa: THREE.Vector3; b: THREE.Object3D; pb: THREE.Vector3; barrel: THREE.Mesh; rod: THREE.Mesh }
  const rams: Ram[] = [];
  const unitCyl = (r: number) => new THREE.CylinderGeometry(r, r, 1, 14);
  const ram = (a: THREE.Object3D, pa: THREE.Vector3, b: THREE.Object3D, pb: THREE.Vector3, r: number) => {
    const barrel = mesh(unitCyl(r), M.yellowDark, root), rod = mesh(unitCyl(r * 0.55), M.chrome, root);
    rams.push({ a, pa, b, pb, barrel, rod });
  };
  ram(house, V(1.75, 0.35, BOOM_PIVOT.z + 0.36), boomP, V(1.55, 0.25, 0.36), 0.12);
  ram(house, V(1.75, 0.35, BOOM_PIVOT.z - 0.36), boomP, V(1.55, 0.25, -0.36), 0.12);
  ram(boomP, V(1.65, 0.95, 0), stickP, V(-0.5, 0.42, 0), 0.11);
  ram(stickP, V(0.5, 0.3, 0), bucketP, V(-0.15, 0.2, 0), 0.09);
  shadow(exc);

  // ── The dump truck ────────────────────────────────────────────────────────────────────────────────────
  const truck = new THREE.Group(); truck.position.copy(TRUCK_POS); root.add(truck);
  const body = new THREE.Group(); truck.add(body);
  const wheels: THREE.Mesh[] = [];
  const doorTex = tex(512, 256, paintDoor(opts.company));
  {
    const tyre = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 28); tyre.rotateX(Math.PI / 2);
    const hub = new THREE.CylinderGeometry(0.28, 0.28, 0.47, 18); hub.rotateX(Math.PI / 2);
    for (const x of [2.55, -1.4, -2.55]) for (const z of [0.95, -0.95]) {
      const w = new THREE.Group(); w.position.set(x, 0.55, z); truck.add(w);
      const t = mesh(tyre, M.rubber, w); mesh(hub, M.steel, w);
      for (let i = 0; i < 6; i++) { const lug = box(0.06, 0.06, 0.48, M.dark, w, Math.cos(i * TAU / 6) * 0.18, Math.sin(i * TAU / 6) * 0.18, 0); void lug; }
      wheels.push(t);
      (w as THREE.Object3D).userData.wheel = true;
    }
    box(6.3, 0.22, 1.2, M.dark, body, -0.15, 1.03, 0);
    // Cab, hood, grille, bumper, lamps.
    box(1.5, 1.5, 2.1, M.orange, body, 2.15, 1.95, 0);
    box(0.05, 0.72, 1.8, M.glass, body, 2.91, 2.28, 0);
    for (const s of [1, -1]) {
      box(1.0, 0.58, 0.04, M.glass, body, 2.2, 2.3, s * 1.06);
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), std(0xffffff, 0.5, 0.1, { map: doorTex }));
      door.position.set(2.1, 1.68, s * 1.056); if (s < 0) door.rotation.y = Math.PI; body.add(door);
      box(0.3, 0.12, 0.6, M.orange, body, -1.95, 1.2, s * 0.95); // mudguards
      box(0.3, 0.12, 0.6, M.orange, body, -2.0, 1.2, s * 0.95);
      box(0.06, 0.22, 0.06, M.dark, body, 2.9, 2.3, s * 1.15); // mirror
      box(0.04, 0.3, 0.22, M.chrome, body, 2.93, 2.35, s * 1.24);
    }
    box(0.72, 0.8, 1.8, M.orange, body, 3.25, 1.55, 0);
    box(0.05, 0.6, 1.4, M.grille, body, 3.62, 1.55, 0);
    for (let i = 0; i < 5; i++) box(0.06, 0.04, 1.36, M.chrome, body, 3.65, 1.32 + i * 0.12, 0);
    box(0.22, 0.24, 2.2, M.dark, body, 3.72, 0.98, 0);
    for (const s of [1, -1]) box(0.06, 0.18, 0.3, M.lamp, body, 3.66, 1.72, s * 0.72);
    mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 14), M.chrome, body, 1.3, 2.35, -0.85);
    const tank = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20), M.chrome, body, 0.75, 0.95, 0.82);
    tank.rotation.z = Math.PI / 2;
    box(0.1, 0.1, 2.1, M.beacon, body, 1.42, 2.75, 0);
  }
  const bed = new THREE.Group(); bed.position.set(HINGE_X, 1.2, 0); body.add(bed);
  const plateCanvas = document.createElement('canvas'); plateCanvas.width = 512; plateCanvas.height = 256;
  const plateTex = new THREE.CanvasTexture(plateCanvas); plateTex.colorSpace = THREE.SRGBColorSpace; textures.push(plateTex);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), std(0xffffff, 0.6, 0.0, { map: plateTex }));
  let plateTons: number | null | undefined;
  const mounds: THREE.Mesh[] = [];
  const moundSmooth = new THREE.SphereGeometry(0.5, 20, 12, 0, TAU, 0, Math.PI / 2);
  const moundChunky = new THREE.IcosahedronGeometry(0.5, 1);
  const SLOT_COLS = 4, SLOT_ROWS = 3;
  const slotLocal = (i: number) => {
    const c = i % SLOT_COLS, r = Math.floor(i / SLOT_COLS) % SLOT_ROWS;
    return V(0.6 + c * ((BED_LEN - 1.2) / (SLOT_COLS - 1)), 0.14, -0.66 + r * 0.66);
  };
  {
    box(BED_LEN, 0.12, BED_W, M.orange, bed, BED_LEN / 2, 0.06, 0);
    for (const s of [1, -1]) {
      box(BED_LEN, 1.0, 0.1, M.orange, bed, BED_LEN / 2, 0.62, s * (BED_W / 2));
      for (let i = 0; i < 4; i++) box(0.08, 1.0, 0.06, M.yellowDark, bed, 0.5 + i * 1.15, 0.62, s * (BED_W / 2 + 0.07));
      box(BED_LEN, 0.1, 0.16, M.yellowDark, bed, BED_LEN / 2, 1.12, s * (BED_W / 2));
    }
    box(0.12, 1.62, BED_W, M.orange, bed, BED_LEN, 0.87, 0);
    box(0.75, 0.08, BED_W, M.orange, bed, BED_LEN + 0.38, 1.66, 0); // cab protector
    box(0.1, 1.0, BED_W, M.yellowDark, bed, 0, 0.62, 0); // tailgate
    plate.position.set(BED_LEN / 2, 0.62, BED_W / 2 + 0.06); bed.add(plate);
    for (let i = 0; i < BED_SLOTS; i++) {
      const m = mesh(moundSmooth, M.load, bed);
      m.position.copy(slotLocal(i)); m.scale.set(1.15, 0.8, 1.0); m.rotation.y = i * 1.7; m.visible = false; mounds.push(m);
    }
  }
  const hoist = { barrel: mesh(unitCyl(0.11), M.dark, root), rod: mesh(unitCyl(0.06), M.chrome, root) };
  shadow(truck);
  tagTarget(truck, 'truck');

  // Scoops that missed the bed lie on the ground beside it (spill is not load).
  const spillGroup = new THREE.Group(); root.add(spillGroup);
  const spills: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const m = mesh(moundSmooth, M.load, spillGroup, BED_POS.x - 1.2 + (i % 4) * 0.8, 0, BED_POS.z - BED_W / 2 - 0.55 - Math.floor(i / 4) * 0.7);
    m.scale.set(0.9, 0.5, 0.9); m.visible = false; spills.push(m);
  }

  // The falling scoop.
  const clump = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), M.load);
  clump.scale.set(1, 0.75, 1); clump.visible = false; clump.castShadow = true; root.add(clump);
  let fall: { from: THREE.Vector3; to: THREE.Vector3; t: number; land: () => void } | null = null;

  // ── Scenery: cones, a sign with the company name, a worker for scale ────────────────────────────────────
  {
    const coneM = std(0xff6a1a, 0.6, 0), white = std(0xf5f5f5, 0.5, 0);
    const cone = (x: number, z: number) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
      mesh(new THREE.ConeGeometry(0.2, 0.7, 20), coneM, g, 0, 0.4, 0);
      mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), coneM, g, 0, 0.025, 0);
      mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.13, 20), white, g, 0, 0.47, 0);
    };
    ([[-5.5, 6.5], [-7.5, 3], [-7.8, -2.5], [-5.5, -7], [10.5, -2.2], [10.5, 2.2]] as const).forEach(([x, z]) => cone(x, z));
    const signTex = tex(512, 256, paintSign(opts.company));
    const sign = new THREE.Group(); sign.position.set(-4.6, 0, -9.2); sign.rotation.y = 0.95; root.add(sign);
    for (const z of [-1.1, 1.1]) mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 10), M.steel, sign, 0, 1.3, z);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 2.6), [M.yellow, M.yellow, M.yellow, M.yellow, std(0xffffff, 0.6, 0, { map: signTex }), M.yellow]);
    board.position.set(0, 2.2, 0); board.rotation.y = Math.PI / 2; board.castShadow = true; sign.add(board);
    const worker = new THREE.Group(); worker.position.set(-3.2, 0, 7.4); worker.rotation.y = -0.6; root.add(worker);
    mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.86, 16), M.navy, worker, 0, 0.43, 0);
    mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 16), M.vest, worker, 0, 1.17, 0);
    mesh(new THREE.SphereGeometry(0.12, 16, 12), M.skin, worker, 0, 1.62, 0);
    mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, TAU, 0, Math.PI / 2), M.yellow, worker, 0, 1.68, 0);
    for (let i = 0; i < 7; i++) {
      const a = 2.4 + i * 0.35, rr = BASE_R - 1.2;
      const b = mesh(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.15, 0), std(0x8a8378, 0.9, 0, { flatShading: true }), root,
        Math.cos(a) * rr, 0.2, Math.sin(a) * rr);
      b.rotation.set(i, i * 2, 0);
    }
  }

  // Lights.
  const hemi = new THREE.HemisphereLight(new THREE.Color(0xdcecff), new THREE.Color(0x8a7a66), 0.85); root.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color(0xfff0da), 2.4);
  sun.position.set(18, 30, 14); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 5, far: 90 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  root.add(sun); root.add(sun.target);

  // ── Animation ─────────────────────────────────────────────────────────────────────────────────────────
  const cur: Pose = { s: 0, ...CARRY };
  const queue: Segment[] = [];
  let holding = false;
  let idleCb: (() => void) | null = null;
  let material: Material = 'dirt';
  let t = 0;
  const truckMove = { offset: -20, v: 0, arriving: true, p: 0 };
  let squash = 0;

  const seg = (to: Partial<Pose>, dur: number, then?: () => void) => queue.push({ to, dur, t: 0, then });

  function applyPose(p: Pose) {
    house.rotation.y = p.s;
    const [q1, q2] = solveArm(p.r, p.h);
    boomP.rotation.z = q1; stickP.rotation.z = q2; bucketP.rotation.z = p.phi - q1 - q2;
  }

  function setMaterial(m: Material) {
    if (m === material) return;
    material = m;
    const c = MATERIAL_COLOR[m];
    pileMat.color.setHex(c); M.load.color.setHex(c); M.loadChunky.color.setHex(c);
    const chunky = CHUNKY[m];
    pileRocks.visible = chunky; pileRocks.scale.setScalar(m === 'rocks' ? 1.6 : 1);
    for (const x of [...mounds, ...spills]) { x.geometry = chunky ? moundChunky : moundSmooth; x.material = chunky ? M.loadChunky : M.load; }
    bucketLoad.material = chunky ? M.loadChunky : M.load; clump.material = chunky ? M.loadChunky : M.load;
  }
  pileRocks.visible = false;

  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), dir = new THREE.Vector3(), Y = V(0, 1, 0);
  function aim(barrel: THREE.Mesh, rod: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    dir.subVectors(b, a); const len = dir.length(); dir.normalize();
    const lb = len * 0.62, lr = len * 0.6;
    barrel.position.copy(a).addScaledVector(dir, lb / 2); barrel.quaternion.setFromUnitVectors(Y, dir); barrel.scale.set(1, lb, 1);
    rod.position.copy(b).addScaledVector(dir, -lr / 2); rod.quaternion.setFromUnitVectors(Y, dir); rod.scale.set(1, lr, 1);
  }

  const bucketWorld = new THREE.Vector3();
  function release(target: SiteTarget, state: SiteState, done: () => void) {
    bucketLoad.visible = false; holding = false;
    bucketLoad.getWorldPosition(bucketWorld);
    let to: THREE.Vector3;
    if (target === 'pile') to = PILE_POS.clone().add(V(0, 1.2, 0));
    else if (state.loaded < BED_SLOTS) to = bed.localToWorld(slotLocal(state.loaded).add(V(0, 0.2, 0)));
    else to = spills[Math.min(state.spilled, spills.length - 1)].getWorldPosition(new THREE.Vector3()).add(V(0, 0.2, 0));
    clump.position.copy(bucketWorld); clump.visible = true;
    fall = { from: bucketWorld.clone(), to, t: 0, land: done };
  }

  function run(action: SiteAction, state: SiteState, cb: { onMoment: () => void; onIdle: () => void }): boolean {
    if (queue.length || fall) return false;
    const H = HEADING[action.at], w = WORK[action.at];
    idleCb = cb.onIdle;
    seg({ ...CARRY }, 0.45);
    seg({ s: H }, Math.max(0.35, Math.abs(H - cur.s) * 0.55));
    if (action.kind === 'dig') {
      seg({ r: 5.5, h: w.open, phi: -1.4 }, 0.55);
      seg({ r: 5.05, h: w.dig, phi: -1.0 }, 0.4);
      seg({ r: 4.55, h: w.curl, phi: 0.45 }, 0.5, () => { bucketLoad.visible = true; holding = true; cb.onMoment(); });
      seg({ ...CARRY, s: H }, 0.55);
    } else {
      seg({ r: 5.05, h: w.over, phi: 0.4 }, 0.5);
      seg({ phi: -1.0 }, 0.28, () => release(action.at, state, cb.onMoment));
      seg({ phi: -2.1 }, 0.3);
      seg({ phi: 0.4, h: w.over + 0.3 }, 0.45);
      seg({ ...CARRY, s: H }, 0.4);
    }
    return true;
  }

  function newTruck() { truckMove.offset = -20; truckMove.v = 0; truckMove.arriving = true; truckMove.p = 0; squash = 0; }

  function tick(dtRaw: number, state: SiteState) {
    const dt = Math.min(0.05, dtRaw);
    t += dt;
    setMaterial(state.material);

    // The excavator: the action queue, or a wave at the finale.
    const active = queue[0];
    if (active) {
      if (!active.from) active.from = { ...cur };
      active.t = Math.min(1, active.t + dt / active.dur);
      const k = ease(active.t), f = active.from, to = { ...f, ...active.to };
      cur.s = lerp(f.s, to.s, k); cur.r = lerp(f.r, to.r, k); cur.h = lerp(f.h, to.h, k); cur.phi = lerp(f.phi, to.phi, k);
      if (active.t >= 1) { queue.shift(); active.then?.(); }
    } else if (!fall) {
      bucketLoad.visible = holding = state.holding;
      if (idleCb) { const cb = idleCb; idleCb = null; cb(); }
    }
    const shown = { ...cur };
    if (!active && !fall && state.finale) {
      shown.s = cur.s + 0.25 * Math.sin(t * 1.3); shown.h = cur.h + 0.6 + 0.35 * Math.sin(t * 3.2); shown.phi = 0.4 + 0.6 * Math.sin(t * 3.2);
    }
    applyPose(shown);
    house.position.y = HOUSE_Y + 0.006 * Math.sin(t * 38);

    if (fall) {
      fall.t = Math.min(1, fall.t + dt / 0.5);
      const k = fall.t;
      clump.position.lerpVectors(fall.from, fall.to, k);
      clump.position.y = lerp(fall.from.y, fall.to.y, k * k) + Math.sin(k * Math.PI) * 0.25;
      if (fall.t >= 1) { clump.visible = false; const land = fall.land; fall = null; land(); }
    }

    // The bed: one mound per scoop, popping in as it lands.
    mounds.forEach((m, i) => {
      const want = i < state.loaded;
      if (want && !m.visible) { m.visible = true; m.userData.pop = 0; }
      if (!want) m.visible = false;
      if (m.visible) { m.userData.pop = Math.min(1, (m.userData.pop ?? 1) + dt * 5); const p = ease(m.userData.pop); m.scale.set(1.15 * p, 0.8 * p, 1.0 * p); }
    });
    spills.forEach((m, i) => { m.visible = i < state.spilled; });
    if (state.capacityTons !== plateTons) {
      plateTons = state.capacityTons;
      const g = plateCanvas.getContext('2d');
      if (g) drawPlate(g, plateCanvas.width, plateCanvas.height, plateTons);
      plateTex.needsUpdate = true; plate.visible = plateTons != null;
    }

    // The truck: roll in, sag with the load, squat when overloaded, drive off when sent.
    if (truckMove.arriving) {
      truckMove.p = Math.min(1, truckMove.p + dt / 2.6);
      const prev = truckMove.offset;
      truckMove.offset = -20 * (1 - ease(truckMove.p));
      truckMove.v = (truckMove.offset - prev) / Math.max(dt, 1e-4);
      if (truckMove.p >= 1) { truckMove.arriving = false; truckMove.v = 0; }
    } else if (state.departing) {
      truckMove.v = Math.min(9, truckMove.v + dt * 4);
      truckMove.offset += truckMove.v * dt;
    } else if (truckMove.offset > 0) {
      truckMove.offset = 0; truckMove.v = 0;
    }
    truck.position.x = TRUCK_POS.x + truckMove.offset;
    const fade = truckMove.offset < 0 ? clamp((truckMove.offset + 20) / 5, 0, 1) : clamp(1 - (truckMove.offset - 8) / 5, 0, 1);
    truck.scale.setScalar(Math.max(0.001, ease(fade)));
    truck.visible = fade > 0.001;
    wheels.forEach(w => { w.rotation.z -= (truckMove.v * dt) / 0.55; });
    squash = lerp(squash, state.squash ? 1 : 0, Math.min(1, dt * 6));
    body.position.y = -0.012 * Math.min(state.loaded, BED_SLOTS) - 0.22 * squash + (state.departing ? 0.015 * Math.sin(t * 22) : 0);

    root.updateMatrixWorld(true);
    for (const r of rams) aim(r.barrel, r.rod, r.a.localToWorld(tmpA.copy(r.pa)), r.b.localToWorld(tmpB.copy(r.pb)));
    hoist.barrel.visible = hoist.rod.visible = truck.visible && fade > 0.99;
    if (hoist.barrel.visible) aim(hoist.barrel, hoist.rod, body.localToWorld(tmpA.set(-0.9, 1.05, 0)), bed.localToWorld(tmpB.set(2.9, 0.02, 0)));
  }

  function targetFromHit(object: THREE.Object3D): SiteTarget | 'pass' | null {
    for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return 'pass';
    for (let p: THREE.Object3D | null = object; p; p = p.parent) if (p.userData.excavator) return 'pass';
    if (rams.some(r => r.barrel === object || r.rod === object) || object === hoist.barrel || object === hoist.rod || object === clump
      || spills.includes(object as THREE.Mesh)) return 'pass';
    return (object.userData.target as SiteTarget | undefined) ?? null;
  }

  function pickPoint(target: SiteTarget): THREE.Vector3 {
    root.updateMatrixWorld(true);
    return target === 'pile' ? PILE_POS.clone().add(V(0.4, 1.0, 0.9)) : bed.localToWorld(V(BED_LEN / 2 + 0.6, 0.35, BED_W / 2 + 0.07));
  }

  function dispose() {
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose();
    });
    Object.values(M).forEach(m => m.dispose());
    moundSmooth.dispose(); moundChunky.dispose();
    textures.forEach(x => x.dispose());
  }

  applyPose(cur);
  return { root, tick, run, newTruck, busy: () => queue.length > 0 || !!fall, targetFromHit, pickPoint, dispose };
}
