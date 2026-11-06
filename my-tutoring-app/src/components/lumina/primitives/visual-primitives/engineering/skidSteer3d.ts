/**
 * A skid steer yard built in code with three.js (no model files): a skid steer loader on four wheels, a fenced dirt
 * yard, concrete barriers, and the thing the learner turns to face. Pure scene construction plus a per-frame `tick`
 * and a `play` for one move; the React layer (`SkidSteerScene.tsx`) owns the canvas, the camera and the lever state.
 *
 * The machine's motion comes from `poseAt` in `skidSteerModel.ts`, the same exact arcs the check uses, so what the
 * learner sees is what was judged. Each side's wheels turn by the distance that side travels. Tyres leave marks on the
 * dirt only while the machine moves: the marks are a result of Go, never a preview.
 *
 * Attachments hang on the quick-attach plate at the arm tips; one shows at a time (none: a bare plate). A job item
 * builds the job in front of the machine; Do the job drives up to it and the tool either does it or visibly cannot.
 *
 * Frame: model (x, y) is three (x, 0, -y); a model heading `th` is `rotation.y = th`; the machine faces -z at rest.
 */
import * as THREE from 'three';
import {
  FRONT, HALF_W, poseAt, START, STRAIGHT, TRACK,
  type Attachment, type Barrier, type GoalThing, type Job, type Lever, type Levers, type MoveResult, type Pose, type Side,
} from './skidSteerModel';

export { makeSkyEnvironment } from './airliner3d';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (x: number) => x * x * (3 - 2 * x);
const YARD = 13;
const WHEEL_R = 0.42;
/** Where the thing to face sits, beside the machine. */
export const GOAL_OFFSET = 6.5;

/** The start view: behind and above the machine, so its left and right are the learner's. */
export const YARD_VIEW = { t: new THREE.Vector3(0, 0.4, -1.6), th: 0, ph: 0.5, r: 15.5 };

export type YardItem =
  | { kind: 'turn'; goal: GoalThing; side: Side; barriers: Barrier[] }
  | { kind: 'job'; job: Job };

/** Where a job sits: straight ahead of the machine. */
const JOB_Y = 4.0;

export interface SkidYard {
  root: THREE.Group;
  /** A new item: the thing, the barriers, the machine back at the start, the dirt smooth again. */
  setItem(item: YardItem): void;
  /** The machine back at the start and the marks raked away (Try again). */
  reset(): void;
  /** Run one move to its end (or to the bump), then `onDone`. A right move lifts the bucket to celebrate. */
  play(levers: Levers, result: MoveResult, correct: boolean, onDone: () => void): void;
  /** Click a tool onto the quick-attach plate (null: a bare plate). */
  setTool(tool: Attachment | null): void;
  /** Drive up to the job and try it with the tool on the plate, then `onDone`. */
  playJob(job: Job, tool: Attachment, correct: boolean, onDone: () => void): void;
  /** Tilt the lever handles in the cab to show the current setting. */
  showLevers(levers: Levers): void;
  tick(dt: number): void;
  busy(): boolean;
  dispose(): void;
}

const FONT = '"Barlow Semi Condensed","Arial Narrow",Arial,sans-serif';

function paintGround(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#a07e55'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 26000; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.45 ? 'rgba(60,40,20,0.10)' : v < 0.9 ? 'rgba(255,240,210,0.07)' : 'rgba(40,30,20,0.22)';
    const s = Math.random() < 0.97 ? 2 : 5;
    g.fillRect(Math.random() * W, Math.random() * H, s, s);
  }
  // Old ruts from other jobs, away from the machine's spot so they never read as a path.
  g.strokeStyle = 'rgba(60,42,25,0.16)'; g.lineWidth = 18;
  for (const [x0, y0, x1, y1] of [[0.05, 0.12, 0.35, 0.02], [0.7, 0.95, 0.98, 0.7], [0.02, 0.8, 0.22, 0.98]]) {
    g.beginPath(); g.moveTo(x0 * W, y0 * H); g.lineTo(x1 * W, y1 * H); g.stroke();
  }
}

function paintStripes(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#f2b21b'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d2433';
  for (let x = -H; x < W + H; x += H * 1.2) {
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.6, H); g.lineTo(x + H * 1.2, 0); g.lineTo(x + H * 0.6, 0); g.fill();
  }
}

function paintDecal(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#1d2433'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffffff'; g.font = `800 ${Math.floor(H * 0.62)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('SKID STEER', W / 2, H * 0.55);
}

export function buildSkidYard(opts: { anisotropy?: number } = {}): SkidYard {
  const aniso = opts.anisotropy ?? 4;
  const textures: THREE.Texture[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const std = (hex: number, rough: number, metal: number, extra?: THREE.MeshStandardMaterialParameters) =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, ...extra });
  const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); if (g) draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    textures.push(t); return t;
  };

  const M = {
    yellow: std(0xf2b21b, 0.42, 0.15),
    yellowDark: std(0xd29512, 0.5, 0.15),
    dark: std(0x2b2e33, 0.6, 0.4),
    steel: std(0x8a9099, 0.35, 0.85),
    rubber: std(0x1b1c1e, 0.92, 0.0),
    hub: std(0x5b5f66, 0.45, 0.7),
    glass: std(0x16283a, 0.08, 0.6, { transparent: true, opacity: 0.55 }),
    seat: std(0x222222, 0.8, 0.0),
    lamp: std(0xfff4d0, 0.3, 0.1, { emissive: new THREE.Color(0xfff0c0), emissiveIntensity: 0.5 }),
    tail: std(0xc81e1e, 0.3, 0.1, { emissive: new THREE.Color(0x900000), emissiveIntensity: 0.4 }),
    beacon: std(0xff9a1a, 0.3, 0.1, { emissive: new THREE.Color(0xff7a00), emissiveIntensity: 0.9 }),
    concrete: std(0xb9b5ad, 0.92, 0.0),
    stripe: std(0xffffff, 0.6, 0.0, { map: tex(256, 32, paintStripes) }),
    decal: std(0xffffff, 0.5, 0.1, { map: tex(256, 48, paintDecal) }),
    dirt: std(0x7a5230, 0.97, 0.0),
    hay: std(0xd9b45a, 0.95, 0.0),
    twine: std(0x8a5a2b, 0.9, 0.0),
    wood: std(0xb08752, 0.85, 0.0),
    brick: std(0xa8432f, 0.85, 0.0),
    bark: std(0x6b4a2e, 0.95, 0.0),
    logEnd: std(0xd7b07a, 0.85, 0.0),
    leaf: std(0x3f8f3a, 0.8, 0.0),
    burlap: std(0x9c7a4c, 0.95, 0.0),
    orange: std(0xe8661c, 0.45, 0.15),
    post: std(0x9aa0a6, 0.4, 0.8),
    mesh: std(0xff7a1a, 0.7, 0.0, { transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    cone: std(0xff6a00, 0.5, 0.0),
    snow: std(0xf7fbff, 0.7, 0.0),
    asphalt: std(0x4a4d52, 0.95, 0.0),
    slab: std(0xc9c4ba, 0.9, 0.0),
    leafA: std(0xc8742a, 0.9, 0.0, { side: THREE.DoubleSide }),
    leafB: std(0xe0b23a, 0.9, 0.0, { side: THREE.DoubleSide }),
    dustPatch: std(0x9a8162, 1.0, 0.0),
    bristle: std(0x3b3226, 0.95, 0.0),
    hole: new THREE.MeshBasicMaterial({ color: 0x24170c }),
    stake: std(0xff6a00, 0.5, 0.0),
    mark: new THREE.MeshBasicMaterial({ color: 0x3d2a18, transparent: true, opacity: 0.55, depthWrite: false }),
    dust: new THREE.MeshBasicMaterial({ color: 0xc9a77a, transparent: true, opacity: 0.6, depthWrite: false }),
  };

  const root = new THREE.Group();
  const geo = <G extends THREE.BufferGeometry>(g: G) => { geometries.push(g); return g; };
  const mesh = (g: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo(g), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w: number, h: number, d: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) =>
    mesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z);

  // ── The yard ─────────────────────────────────────────────────────────────────────────────────────────
  {
    const groundTex = tex(2048, 2048, paintGround);
    const top = std(0xffffff, 0.96, 0.0, { map: groundTex });
    const side = std(0x4a3524, 0.85, 0.05);
    const base = new THREE.Mesh(geo(new THREE.BoxGeometry(YARD * 2, 1, YARD * 2)), [side, side, top, side, side, side]);
    base.position.y = -0.5; base.receiveShadow = true; root.add(base);
    // A site fence: steel posts with orange safety mesh, open toward the camera.
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8);
    for (const [ax, az, bx, bz] of [[-YARD, -YARD, YARD, -YARD], [-YARD, -YARD, -YARD, YARD * 0.4], [YARD, -YARD, YARD, YARD * 0.4]]) {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 2.6);
      for (let i = 0; i <= n; i++) mesh(postGeo, M.post, root, ax + (bx - ax) * i / n, 0.8, az + (bz - az) * i / n);
      const net = mesh(new THREE.PlaneGeometry(len, 1.2), M.mesh, root, (ax + bx) / 2, 0.85, (az + bz) / 2);
      net.rotation.y = -Math.atan2(bz - az, bx - ax);
      net.castShadow = false;
    }
    // Traffic cones in the far corners.
    const coneGeo = new THREE.ConeGeometry(0.28, 0.75, 16);
    for (const [x, z] of [[-11.5, -11.5], [-10.6, -11.6], [11.4, -11.3], [11.6, -10.4]]) mesh(coneGeo, M.cone, root, x, 0.37, z);
  }

  // ── The skid steer ───────────────────────────────────────────────────────────────────────────────────
  const ss = new THREE.Group(); root.add(ss);
  const wheels: Record<Side, THREE.Object3D[]> = { left: [], right: [] };
  const arms = new THREE.Group(); // pivots at the back of the cab: rotation.x lifts the bucket
  const bucket = new THREE.Group(); // curls about the bucket pins at the arm tips
  const leverHandles: Record<Side, THREE.Object3D | null> = { left: null, right: null };
  {
    const wx = TRACK / 2, wz = 0.62;
    // Wheels: tyres with chunky tread lugs, steel hubs.
    const tyreGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.34, 28);
    const lugGeo = new THREE.BoxGeometry(0.36, 0.06, 0.1);
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.36, 16);
    for (const side of ['left', 'right'] as Side[]) for (const z of [-wz, wz]) {
      const holder = new THREE.Group(); holder.position.set(side === 'left' ? -wx : wx, WHEEL_R, z); ss.add(holder);
      const spin = new THREE.Group(); holder.add(spin);
      const tyre = mesh(tyreGeo, M.rubber, spin); tyre.rotation.z = Math.PI / 2;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        const lug = mesh(lugGeo, M.rubber, spin, 0, Math.sin(a) * WHEEL_R, Math.cos(a) * WHEEL_R);
        lug.rotation.x = -a;
      }
      const hub = mesh(hubGeo, M.hub, spin); hub.rotation.z = Math.PI / 2;
      wheels[side].push(spin);
    }
    // Chassis: the chain cases between the wheels, the belly, and fenders over the tyres.
    for (const s of [-1, 1]) {
      box(0.18, 0.5, 1.75, M.dark, ss, s * 0.53, 0.5, 0);
      box(0.42, 0.06, 1.95, M.yellowDark, ss, s * wx, 0.92, 0);
    }
    box(0.9, 0.45, 2.2, M.yellow, ss, 0, 0.7, 0.05);
    // Engine bay behind the cab, with a grille, tail lights and a counterweight.
    box(1.3, 0.62, 0.95, M.yellow, ss, 0, 1.2, 0.72);
    box(1.32, 0.06, 0.97, M.yellowDark, ss, 0, 1.53, 0.72);
    box(1.0, 0.36, 0.04, M.dark, ss, 0, 1.15, 1.21);
    box(1.4, 0.32, 0.18, M.dark, ss, 0, 0.6, 1.2);
    for (const s of [-1, 1]) box(0.14, 0.1, 0.03, M.tail, ss, s * 0.55, 1.42, 1.21);
    const decal = mesh(new THREE.PlaneGeometry(0.9, 0.17), M.decal, ss, 0.66, 1.2, 0.72); decal.rotation.y = Math.PI / 2;
    const decal2 = mesh(new THREE.PlaneGeometry(0.9, 0.17), M.decal, ss, -0.66, 1.2, 0.72); decal2.rotation.y = -Math.PI / 2;
    // The cab: a steel cage with a glass door in front, a seat and the two drive levers inside.
    const cz0 = -0.62, cz1 = 0.25, cy0 = 0.92, cy1 = 2.05, cx = 0.52;
    const postV = new THREE.BoxGeometry(0.08, cy1 - cy0, 0.08);
    for (const x of [-cx, cx]) for (const z of [cz0, cz1]) mesh(postV, M.dark, ss, x, (cy0 + cy1) / 2, z);
    box(cx * 2 + 0.12, 0.08, cz1 - cz0 + 0.12, M.yellow, ss, 0, cy1, (cz0 + cz1) / 2); // roof
    for (const x of [-cx, cx]) for (let i = 1; i < 5; i++) box(0.03, 0.03, cz1 - cz0, M.dark, ss, x, cy0 + (cy1 - cy0) * i / 5, (cz0 + cz1) / 2);
    box(cx * 2, cy1 - cy0 - 0.1, 0.02, M.glass, ss, 0, (cy0 + cy1) / 2, cz0 - 0.01).castShadow = false;
    box(0.6, 0.12, 0.5, M.seat, ss, 0, 1.15, 0.0);
    box(0.6, 0.6, 0.1, M.seat, ss, 0, 1.45, 0.2);
    for (const side of ['left', 'right'] as Side[]) {
      const pivot = new THREE.Group(); pivot.position.set(side === 'left' ? -0.3 : 0.3, 1.1, -0.32); ss.add(pivot);
      mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 8), M.dark, pivot, 0, 0.21, 0);
      mesh(new THREE.SphereGeometry(0.055, 12, 8), M.beacon, pivot, 0, 0.44, 0);
      leverHandles[side] = pivot;
    }
    mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 16), M.beacon, ss, 0.35, cy1 + 0.11, 0.1);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.16, 0.12, 0.06), M.lamp, ss, s * 0.45, cy1 - 0.12, cz0 - 0.05);

    // Lift arms: pinned at the back of the cab, outside it, reaching down to the bucket pins at the front.
    const PIN = new THREE.Vector3(0, 1.75, 0.55), TIP = new THREE.Vector3(0, 0.36, -1.38);
    arms.position.copy(PIN); ss.add(arms);
    const armLen = PIN.distanceTo(TIP), armAngle = Math.atan2(PIN.y - TIP.y, PIN.z - TIP.z);
    for (const s of [-1, 1]) {
      const a = box(0.14, 0.24, armLen, M.yellow, arms, s * 0.8, 0, 0);
      a.position.set(s * 0.8, -(PIN.y - TIP.y) / 2, -(PIN.z - TIP.z) / 2);
      a.rotation.x = -armAngle;
    }
    box(1.74, 0.14, 0.14, M.yellowDark, arms, 0, -(PIN.y - TIP.y) + 0.15, -(PIN.z - TIP.z) + 0.2); // cross tube
    bucket.position.set(0, -(PIN.y - TIP.y), -(PIN.z - TIP.z)); arms.add(bucket);
    // The quick-attach plate every tool hooks onto. Its centre sits at the arm tips, 0.36 m above the ground.
    box(1.5, 0.62, 0.06, M.dark, bucket, 0, 0.22, 0.02);
    for (const s of [-1, 1]) box(0.08, 0.1, 0.1, M.steel, bucket, s * 0.6, 0.5, 0.04);
  }

  // ── Attachments (one shows at a time) ────────────────────────────────────────────────────────────────
  const tools = {} as Record<Attachment, THREE.Group>;
  const toolGroup = (a: Attachment) => { const g = new THREE.Group(); g.visible = false; bucket.add(g); tools[a] = g; return g; };
  const bucketLoad = new THREE.Group();
  let augerBit: THREE.Group, brush: THREE.Group, claw: THREE.Group, bladePile: THREE.Mesh;
  {
    // Bucket: a floor, a back, two sides and a steel cutting edge; a mound of dirt shows in it once it scoops.
    const g = toolGroup('bucket');
    const bw = HALF_W * 2 + 0.06, depth = FRONT - 1.38 - 0.02;
    box(bw, 0.05, depth, M.yellowDark, g, 0, -0.06, -depth / 2);
    box(bw, 0.62, 0.05, M.yellowDark, g, 0, 0.24, -0.02);
    for (const s of [-1, 1]) box(0.05, 0.55, depth, M.yellowDark, g, s * bw / 2, 0.2, -depth / 2);
    box(bw, 0.05, 0.08, M.steel, g, 0, -0.05, -depth);
    const mound = mesh(new THREE.SphereGeometry(0.55, 20, 10, 0, TAU, 0, Math.PI / 2), M.dirt, bucketLoad, 0, -0.04, -depth / 2);
    mound.scale.set(1.5, 0.55, 0.55);
    bucketLoad.visible = false; g.add(bucketLoad);
  }
  {
    // Pallet forks: a carriage with two uprights and two long tines near the ground.
    const g = toolGroup('forks');
    box(1.3, 0.08, 0.08, M.dark, g, 0, 0.5, -0.06);
    box(1.3, 0.08, 0.08, M.dark, g, 0, -0.05, -0.06);
    for (const s of [-1, 1]) {
      box(0.1, 0.62, 0.08, M.dark, g, s * 0.45, 0.22, -0.08);
      box(0.13, 0.05, 1.15, M.steel, g, s * 0.45, -0.3, -0.65);
    }
  }
  {
    // Auger: a motor hanging from the plate and a spiral bit that spins.
    const g = toolGroup('auger');
    box(0.18, 0.12, 0.5, M.dark, g, 0, 0.42, -0.25);
    box(0.34, 0.36, 0.34, M.orange, g, 0, 0.3, -0.55);
    augerBit = new THREE.Group(); augerBit.position.set(0, 0.12, -0.55); g.add(augerBit);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 10), M.steel, augerBit, 0, -0.31, 0);
    for (let i = 0; i < 12; i++) {
      const f = mesh(new THREE.BoxGeometry(0.26, 0.025, 0.07), M.steel, augerBit, 0, -0.08 - i * 0.042, 0);
      f.rotation.y = i * 0.9; f.rotation.z = 0.35;
    }
    mesh(new THREE.ConeGeometry(0.06, 0.12, 10), M.steel, augerBit, 0, -0.68, 0).rotation.x = Math.PI;
  }
  {
    // Broom: a round brush under a hood, spinning to sweep.
    const g = toolGroup('broom');
    const hood = mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.0, 18, 1, true, 0, Math.PI), M.yellowDark, g, 0, -0.02, -0.5);
    hood.rotation.z = Math.PI / 2; hood.rotation.y = Math.PI / 2; (hood.material as THREE.Material).side = THREE.DoubleSide;
    brush = new THREE.Group(); brush.position.set(0, -0.04, -0.5); g.add(brush);
    const core = mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.9, 18), M.bristle, brush); core.rotation.z = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const band = mesh(new THREE.BoxGeometry(1.9, 0.04, 0.05), M.dark, brush, 0, Math.sin(i / 10 * TAU) * 0.33, Math.cos(i / 10 * TAU) * 0.33);
      band.rotation.x = -(i / 10) * TAU;
    }
  }
  {
    // Snow blade: a wide curved moldboard with a steel edge; a snow pile builds up in front of it while it pushes.
    const g = toolGroup('snow_blade');
    box(0.18, 0.12, 0.4, M.dark, g, 0, 0.3, -0.2);
    const low = box(2.4, 0.38, 0.05, M.orange, g, 0, -0.12, -0.5); low.rotation.x = 0.38;
    const high = box(2.4, 0.38, 0.05, M.orange, g, 0, 0.24, -0.5); high.rotation.x = -0.25;
    box(2.4, 0.05, 0.1, M.steel, g, 0, -0.31, -0.58);
    bladePile = mesh(new THREE.SphereGeometry(0.6, 18, 10, 0, TAU, 0, Math.PI / 2), M.snow, g, 0, -0.36, -0.95);
    bladePile.scale.set(1.8, 0.01, 0.6);
  }
  {
    // Grapple: a row of lower tines and a claw on top that opens and clamps down.
    const g = toolGroup('grapple');
    for (let i = 0; i < 5; i++) {
      const x = -0.8 + i * 0.4;
      box(0.08, 0.06, 0.95, M.dark, g, x, -0.3, -0.5);
      box(0.08, 0.5, 0.06, M.dark, g, x, -0.05, -0.04);
    }
    claw = new THREE.Group(); claw.position.set(0, 0.55, -0.08); g.add(claw);
    for (const x of [-0.55, 0, 0.55]) {
      box(0.09, 0.08, 0.75, M.yellowDark, claw, x, 0, -0.37);
      const tip = box(0.09, 0.4, 0.08, M.yellowDark, claw, x, -0.18, -0.74); tip.rotation.x = 0.3;
    }
    claw.rotation.x = -0.55; // open
  }
  const setTool = (a: Attachment | null) => { (Object.keys(tools) as Attachment[]).forEach(k => { tools[k].visible = k === a; }); };
  setTool('bucket');

  // ── Barriers and the thing to face (rebuilt each item) ───────────────────────────────────────────────
  const itemGroup = new THREE.Group(); root.add(itemGroup);
  const disposeGroup = (g: THREE.Object3D) => {
    g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !geometries.includes(m.geometry)) m.geometry.dispose(); });
    g.clear();
  };
  const local = (parent: THREE.Object3D) => ({
    box: (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    },
    add: (g: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    },
  });

  function buildBarrier(b: Barrier) {
    const g = new THREE.Group(); itemGroup.add(g);
    const along = b.hx >= b.hy ? 'x' : 'z';
    const len = 2 * Math.max(b.hx, b.hy), thick = 2 * Math.min(b.hx, b.hy);
    g.position.set(b.cx, 0, -b.cy);
    if (along === 'z') g.rotation.y = Math.PI / 2;
    // Jersey barrier sections: a wide foot, a sloped face, a narrow top, a striped band.
    const L = local(g), sections = Math.max(1, Math.round(len / 2));
    const seg = len / sections;
    for (let i = 0; i < sections; i++) {
      const x = -len / 2 + seg * (i + 0.5);
      L.box(seg - 0.04, 0.22, thick, M.concrete, x, 0.11, 0);
      L.box(seg - 0.04, 0.4, thick * 0.7, M.concrete, x, 0.42, 0);
      L.box(seg - 0.04, 0.2, thick * 0.45, M.concrete, x, 0.72, 0);
      L.box(seg - 0.05, 0.08, thick * 0.46, M.stripe, x, 0.85, 0);
    }
  }

  function buildGoal(goal: GoalThing, side: Side) {
    const g = new THREE.Group(); itemGroup.add(g);
    g.position.set(side === 'left' ? -GOAL_OFFSET : GOAL_OFFSET, 0, -0.4);
    const L = local(g);
    switch (goal) {
      case 'dirt pile': {
        const sg = new THREE.SphereGeometry(1.7, 40, 20, 0, TAU, 0, Math.PI / 2);
        const p = sg.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const n = 1 + 0.08 * Math.sin(x * 2.3 + z * 1.4) + 0.05 * Math.sin(z * 3.9 - x);
          p.setXYZ(i, x * n, y * 0.6 * n, z * n);
        }
        sg.computeVertexNormals();
        L.add(sg, M.dirt);
        break;
      }
      case 'hay bale': {
        for (const [x, z] of [[0, 0.75], [0, -0.75]]) {
          const b = L.add(new THREE.CylinderGeometry(0.72, 0.72, 1.3, 28), M.hay, x, 0.72, z); b.rotation.z = Math.PI / 2;
          for (const dx of [-0.35, 0.35]) { const t = L.add(new THREE.TorusGeometry(0.73, 0.025, 6, 32), M.twine, dx, 0.72, z); t.rotation.y = Math.PI / 2; }
        }
        break;
      }
      case 'pallet of bricks': {
        for (const z of [-0.5, 0, 0.5]) L.box(1.2, 0.12, 0.12, M.wood, 0, 0.06, z);
        for (let i = 0; i < 6; i++) L.box(0.16, 0.03, 1.2, M.wood, -0.5 + i * 0.2, 0.135, 0);
        for (let y = 0; y < 5; y++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          L.box(0.36, 0.13, 0.55, M.brick, -0.4 + i * 0.4, 0.22 + y * 0.14, -0.29 + j * 0.58);
        }
        break;
      }
      case 'log pile': {
        const rows = [[-0.62, 0, 0.62], [-0.31, 0.31], [0]];
        rows.forEach((row, r) => row.forEach(x => {
          const lg = L.add(new THREE.CylinderGeometry(0.3, 0.3, 2.2, 18), M.bark, x, 0.3 + r * 0.52, 0);
          lg.rotation.x = Math.PI / 2;
          for (const s of [-1, 1]) { const e = L.add(new THREE.CircleGeometry(0.29, 18), M.logEnd, x, 0.3 + r * 0.52, s * 1.101); e.rotation.y = s > 0 ? 0 : Math.PI; }
        }));
        break;
      }
      case 'dump truck': {
        g.rotation.y = Math.PI / 2;
        L.box(1.3, 1.1, 1.2, M.orange, 0, 1.15, -1.5);
        L.box(1.25, 0.45, 0.04, M.glass, 0, 1.4, -2.1);
        L.box(2.0, 0.9, 2.8, M.yellow, 0, 1.25, 0.6);
        L.box(2.1, 0.15, 4.4, M.dark, 0, 0.62, -0.1);
        for (const z of [-1.5, 0.4, 1.4]) for (const s of [-1, 1]) {
          const w = L.add(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 22), M.rubber, s * 0.95, 0.45, z); w.rotation.z = Math.PI / 2;
        }
        break;
      }
      case 'little tree': {
        L.add(new THREE.SphereGeometry(0.55, 20, 14), M.burlap, 0, 0.45, 0).scale.set(1, 0.8, 1);
        L.add(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 10), M.bark, 0, 1.3, 0);
        L.add(new THREE.ConeGeometry(0.8, 1.6, 16), M.leaf, 0, 2.2, 0);
        L.add(new THREE.ConeGeometry(0.6, 1.2, 16), M.leaf, 0, 2.8, 0);
        break;
      }
    }
  }

  // ── Jobs (built in front of the machine) ────────────────────────────────────────────────────────────
  interface JobParts { thing: THREE.Object3D; patches: THREE.Mesh[]; hole?: THREE.Mesh; stake?: THREE.Object3D }
  let jobParts: JobParts | null = null;
  const carried: THREE.Object3D[] = [];

  function buildJob(job: Job): JobParts {
    const g = new THREE.Group(); itemGroup.add(g);
    g.position.set(0, 0, -JOB_Y);
    const L = local(g);
    const patches: THREE.Mesh[] = [];
    switch (job) {
      case 'scoop_dirt': {
        const sg = new THREE.SphereGeometry(1.1, 36, 18, 0, TAU, 0, Math.PI / 2);
        const p = sg.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          const n = 1 + 0.08 * Math.sin(x * 3.1 + z * 1.7) + 0.05 * Math.sin(z * 4.3 - x);
          p.setXYZ(i, x * n, y * 0.62 * n, z * n);
        }
        sg.computeVertexNormals();
        return { thing: L.add(sg, M.dirt, 0, 0, -0.2), patches };
      }
      case 'move_pallet': {
        const pal = new THREE.Group(); g.add(pal); pal.position.z = 0.1;
        const P = local(pal);
        for (const x of [-0.5, 0, 0.5]) P.box(0.12, 0.12, 1.2, M.wood, x, 0.06, 0);
        for (let i = 0; i < 6; i++) P.box(1.2, 0.03, 0.16, M.wood, 0, 0.135, -0.5 + i * 0.2);
        for (let y = 0; y < 4; y++) for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
          P.box(0.55, 0.13, 0.36, M.brick, -0.29 + i * 0.58, 0.22 + y * 0.14, -0.4 + j * 0.4);
        }
        return { thing: pal, patches };
      }
      case 'plant_tree': {
        const tree = new THREE.Group(); g.add(tree); tree.position.set(2.1, 0, 0.2);
        const T = local(tree);
        T.add(new THREE.SphereGeometry(0.45, 18, 12), M.burlap, 0, 0.38, 0).scale.set(1, 0.8, 1);
        T.add(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 10), M.bark, 0, 1.1, 0);
        T.add(new THREE.ConeGeometry(0.65, 1.3, 16), M.leaf, 0, 1.9, 0);
        const stake = new THREE.Group(); g.add(stake); stake.position.set(0, 0, 0.6);
        const S = local(stake);
        S.add(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), M.wood, 0, 0.45, 0);
        S.box(0.3, 0.18, 0.02, M.stake, 0.15, 0.82, 0);
        const hole = L.add(new THREE.CircleGeometry(0.36, 24), M.hole, 0, 0.015, 0.6);
        hole.rotation.x = -Math.PI / 2; hole.scale.setScalar(0.01); hole.visible = false; hole.castShadow = false;
        return { thing: tree, patches, hole, stake };
      }
      case 'sweep_path':
      case 'push_snow': {
        const snow = job === 'push_snow';
        const slab = L.box(2.8, 0.06, 5.2, snow ? M.asphalt : M.slab, 0, 0.03, -1.2);
        slab.castShadow = false;
        for (let i = 0; i < (snow ? 46 : 60); i++) {
          const x = (Math.random() - 0.5) * 2.4, z = 1.2 - Math.random() * 4.8;
          const m = snow
            ? L.add(new THREE.SphereGeometry(0.34 + Math.random() * 0.2, 12, 8, 0, TAU, 0, Math.PI / 2), M.snow, x, 0.06, z)
            : L.add(new THREE.CircleGeometry(0.09 + Math.random() * 0.1, 7), [M.leafA, M.leafB, M.dustPatch][i % 3], x, 0.075, z);
          if (snow) m.scale.y = 0.45 + Math.random() * 0.3; else { m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 3; m.castShadow = false; }
          patches.push(m);
        }
        return { thing: slab, patches };
      }
      case 'grab_branches': {
        const pile = new THREE.Group(); g.add(pile); pile.position.z = 0.3;
        const B = local(pile);
        for (let i = 0; i < 8; i++) {
          const br = B.add(new THREE.CylinderGeometry(0.05, 0.08, 2.0 + Math.random() * 0.6, 7), M.bark,
            (Math.random() - 0.5) * 0.5, 0.1 + (i % 3) * 0.1, (Math.random() - 0.5) * 0.4);
          br.rotation.z = Math.PI / 2 + (Math.random() - 0.5) * 0.5; br.rotation.y = (Math.random() - 0.5) * 0.6;
          if (i % 2) { const twig = B.add(new THREE.CylinderGeometry(0.02, 0.03, 0.6, 5), M.bark, br.position.x + 0.3, br.position.y + 0.15, br.position.z); twig.rotation.z = 0.8; }
        }
        return { thing: pile, patches };
      }
    }
  }

  // ── Skid marks: dark scuffs the tyres leave while the machine moves ──────────────────────────────────
  const MARKS = 2400;
  const marks = new THREE.InstancedMesh(geo(new THREE.PlaneGeometry(0.3, 0.16)), M.mark, MARKS);
  marks.count = 0; marks.renderOrder = 1; root.add(marks);
  const lastMark: Array<THREE.Vector3 | null> = [null, null, null, null];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1), upX = new THREE.Euler();
  function layMarks(p: Pose) {
    const f = { x: -Math.sin(p.th), y: Math.cos(p.th) }, r = { x: Math.cos(p.th), y: Math.sin(p.th) };
    let k = 0;
    for (const s of [-1, 1]) for (const w of [-0.62, 0.62]) {
      const mx = p.x + r.x * s * TRACK / 2 - f.x * w, my = p.y + r.y * s * TRACK / 2 - f.y * w;
      const at = new THREE.Vector3(mx, 0.012, -my);
      const prev = lastMark[k];
      if (!prev || prev.distanceTo(at) > 0.12) {
        if (marks.count < MARKS) {
          upX.set(-Math.PI / 2, 0, 0); tmpQ.setFromEuler(upX);
          tmpQ.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.th + Math.PI / 2));
          tmpM.compose(at, tmpQ, tmpS); marks.setMatrixAt(marks.count++, tmpM); marks.instanceMatrix.needsUpdate = true;
        }
        lastMark[k] = at;
      }
      k++;
    }
  }
  const clearMarks = () => { marks.count = 0; lastMark.fill(null); };

  // Dust puffs on a bump.
  const puffs: Array<{ m: THREE.Mesh; t: number; v: THREE.Vector3 }> = [];
  const puffGeo = geo(new THREE.SphereGeometry(0.25, 10, 8));
  function puff(at: THREE.Vector3) {
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(puffGeo, M.dust.clone()); m.position.copy(at); root.add(m);
      puffs.push({ m, t: 0, v: new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6) });
    }
  }

  // ── Lights ─────────────────────────────────────────────────────────────────────────────────────────────
  root.add(new THREE.HemisphereLight(new THREE.Color(0xdcecff), new THREE.Color(0x8a7a66), 0.85));
  const sun = new THREE.DirectionalLight(new THREE.Color(0xfff0da), 2.4);
  sun.position.set(14, 28, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 5, far: 80 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  root.add(sun); root.add(sun.target);

  // ── Motion ─────────────────────────────────────────────────────────────────────────────────────────────
  const place = (p: Pose) => { ss.position.set(p.x, 0, -p.y); ss.rotation.set(0, p.th, 0); };
  place(START);
  const LEVER_SPEED: Record<Lever, number> = { fwd: 1, stop: 0, back: -1 };
  const LEVER_TILT: Record<Lever, number> = { fwd: -0.5, stop: 0, back: 0.5 };
  let leverTarget: Levers = { left: 'stop', right: 'stop' };
  interface Run { levers: Levers; result: MoveResult; correct: boolean; t: number; dur: number; phase: 'move' | 'bump' | 'lift'; pt: number; done: () => void }
  let run: Run | null = null;
  let beaconT = 0;

  /** How far each side's wheels roll over a whole move: the wheel line's own path length. */
  function sideTravel(l: Levers, s: Side): number {
    const v = LEVER_SPEED[l[s]];
    const other = LEVER_SPEED[l[s === 'left' ? 'right' : 'left']];
    if (v === 0) return 0;
    if (v === other) return v * STRAIGHT;
    return v * (Math.PI / 2) * (other === 0 ? TRACK : TRACK / 2);
  }

  interface JobRun { job: Job; tool: Attachment; correct: boolean; phase: 'approach' | 'act'; t: number; done: () => void; attached: boolean }
  let jobRun: JobRun | null = null;
  const SWEEPS = new Set<Job>(['sweep_path', 'push_snow']);
  const approachFor = (job: Job) => (SWEEPS.has(job) ? 0.5 : 1.3);
  const actFor = (r: JobRun) => (!r.correct ? 0.9 : SWEEPS.has(r.job) ? 3.0 : 2.0);
  const driveTo = (y: number) => {
    place({ x: 0, y, th: 0 }); layMarks({ x: 0, y, th: 0 });
    wheels.left.concat(wheels.right).forEach(w => { w.rotation.x = -y / WHEEL_R; });
  };

  function playJob(job: Job, t: Attachment, correct: boolean, onDone: () => void) {
    clearMarks(); setTool(t);
    jobRun = { job, tool: t, correct, phase: 'approach', t: 0, done: onDone, attached: false };
  }

  function tickJob(dt: number) {
    const r = jobRun!;
    const parts = jobParts;
    if (r.phase === 'approach') {
      r.t = Math.min(1, r.t + dt / 1.2);
      driveTo(approachFor(r.job) * ease(r.t));
      if (r.t >= 1) { r.phase = 'act'; r.t = 0; }
      return;
    }
    r.t = Math.min(1, r.t + dt / actFor(r));
    const u = r.t, base = approachFor(r.job);
    if (!r.correct) {
      // The tool cannot do it: a dip, a jolt, a puff, and the job stays as it was.
      arms.rotation.x = -0.08 * Math.sin(u * Math.PI);
      ss.position.x = Math.sin(u * 50) * 0.05 * (1 - u);
      if (u > 0.2 && u - dt / actFor(r) <= 0.2) puff(new THREE.Vector3(0, 0.4, -(base + FRONT + 0.3)));
    } else if (r.tool === 'bucket' || r.tool === 'forks' || r.tool === 'grapple') {
      // Scoop, slide under or clamp, then lift.
      if (r.tool === 'grapple') claw.rotation.x = -0.55 + 0.75 * clamp(u / 0.3, 0, 1);
      if (!r.attached && u >= 0.3 && parts) {
        r.attached = true;
        if (r.tool === 'bucket') { parts.thing.scale.multiplyScalar(0.45); bucketLoad.visible = true; }
        else { bucket.attach(parts.thing); carried.push(parts.thing); }
      }
      const lift = clamp((u - 0.3) / 0.7, 0, 1);
      arms.rotation.x = 0.6 * ease(lift);
      bucket.rotation.x = -0.6 * ease(lift) + (r.tool === 'bucket' ? -0.3 * ease(lift) : 0);
    } else if (r.tool === 'auger') {
      augerBit.rotation.y += dt * 18;
      arms.rotation.x = -0.12 * Math.sin(u * Math.PI);
      if (parts?.hole) { parts.hole.visible = u > 0.25; parts.hole.scale.setScalar(clamp((u - 0.25) / 0.5, 0.01, 1)); }
      if (parts?.stake && u > 0.3) parts.stake.visible = false;
    } else {
      // Broom or blade: drive along the path; what the tool passes over is swept up or pushed ahead.
      const y = base + 2.6 * ease(u);
      driveTo(y);
      if (r.tool === 'broom') brush.rotation.x -= dt * 20;
      const front = y + FRONT - 0.3;
      if (parts) for (const p of parts.patches) {
        const py = JOB_Y - p.position.z;
        if (py < front) {
          if (r.tool === 'snow_blade') { p.position.z = JOB_Y - (front + 0.4); p.scale.multiplyScalar(0.94); }
          else p.scale.multiplyScalar(0.8);
        }
      }
      if (r.tool === 'snow_blade') bladePile.scale.set(1.8, 0.05 + 0.75 * u, 0.6 + 0.4 * u);
    }
    if (u >= 1) { ss.position.x = 0; const done = r.done; jobRun = null; done(); }
  }

  function play(levers: Levers, result: MoveResult, correct: boolean, onDone: () => void) {
    clearMarks();
    const kind = result.move.kind;
    const dur = kind === 'straight' ? 2.0 : kind === 'spin' ? 1.6 : 2.4;
    run = { levers, result, correct, t: 0, dur: dur * Math.max(0.15, result.reached), phase: 'move', pt: 0, done: onDone };
  }

  function tick(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.05);
    beaconT += dt;
    // Lever handles ease toward their setting.
    for (const s of ['left', 'right'] as Side[]) {
      const h = leverHandles[s];
      if (h) h.rotation.x += (LEVER_TILT[leverTarget[s]] - h.rotation.x) * Math.min(1, dt * 10);
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.t += dt;
      p.m.position.addScaledVector(p.v, dt); p.m.scale.setScalar(1 + p.t * 2.5);
      (p.m.material as THREE.MeshBasicMaterial).opacity = clamp(0.6 * (1 - p.t / 1.2), 0, 1);
      if (p.t > 1.2) { root.remove(p.m); (p.m.material as THREE.Material).dispose(); puffs.splice(i, 1); }
    }
    if (jobRun) { tickJob(dt); return; }
    if (!run) return;
    const r = run;
    if (r.phase === 'move') {
      r.t = Math.min(r.dur, r.t + dt);
      const k = ease(r.t / r.dur) * r.result.reached;
      const p = poseAt(START, r.levers, k);
      place(p); layMarks(p);
      for (const s of ['left', 'right'] as Side[]) {
        const turn = (sideTravel(r.levers, s) * k) / WHEEL_R;
        wheels[s].forEach(w => { w.rotation.x = -turn; });
      }
      if (r.t >= r.dur) {
        if (r.result.bumped) {
          r.phase = 'bump'; r.pt = 0;
          const f = { x: -Math.sin(r.result.end.th), y: Math.cos(r.result.end.th) };
          const lead = r.result.bumpedWith === 'front' ? FRONT : -1.3;
          puff(new THREE.Vector3(r.result.end.x + f.x * lead, 0.4, -(r.result.end.y + f.y * lead)));
        } else if (r.correct) { r.phase = 'lift'; r.pt = 0; } else { run = null; r.done(); }
      }
    } else if (r.phase === 'bump') {
      r.pt += dt;
      const shake = Math.sin(r.pt * 60) * 0.06 * Math.max(0, 1 - r.pt / 0.4);
      place(r.result.end); ss.position.x += shake; ss.rotation.z = shake * 0.5;
      if (r.pt >= 0.5) { ss.rotation.z = 0; run = null; r.done(); }
    } else {
      // A right turn: the arms lift the bucket and set it down again.
      r.pt += dt;
      const u = clamp(r.pt / 1.6, 0, 1), lift = Math.sin(u * Math.PI);
      arms.rotation.x = 0.75 * lift;
      bucket.rotation.x = -0.75 * lift + 0.3 * Math.sin(u * TAU) * lift;
      if (u >= 1) { arms.rotation.x = 0; bucket.rotation.x = 0; run = null; r.done(); }
    }
  }

  function reset() {
    run = null; jobRun = null; place(START); clearMarks(); arms.rotation.x = 0; bucket.rotation.x = 0;
    claw.rotation.x = -0.55; bucketLoad.visible = false; bladePile.scale.set(1.8, 0.01, 0.6);
    wheels.left.concat(wheels.right).forEach(w => { w.rotation.x = 0; });
  }

  function setItem(item: YardItem) {
    carried.splice(0).forEach(o => { o.removeFromParent(); disposeGroup(o); });
    disposeGroup(itemGroup);
    jobParts = null;
    if (item.kind === 'turn') {
      item.barriers.forEach(buildBarrier);
      buildGoal(item.goal, item.side);
    } else jobParts = buildJob(item.job);
    reset();
  }

  function dispose() {
    disposeGroup(itemGroup);
    root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && !geometries.includes(m.geometry)) m.geometry.dispose(); });
    geometries.forEach(g => g.dispose());
    Object.values(M).forEach(m => m.dispose());
    textures.forEach(t => t.dispose());
    puffs.forEach(p => (p.m.material as THREE.Material).dispose());
  }

  return {
    root, setItem, reset, play, playJob, setTool, tick, dispose,
    showLevers: (l: Levers) => { leverTarget = l; },
    busy: () => !!run || !!jobRun,
  };
}
