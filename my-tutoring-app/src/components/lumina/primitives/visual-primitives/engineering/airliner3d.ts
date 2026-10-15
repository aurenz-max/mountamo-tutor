/**
 * A stylized two-engine regional jet on a display base, built in code with three.js (no model files).
 * Ported from the user's E175 diorama artifact (2026-10-14). Pure scene construction plus a per-frame
 * `tick`: the React layer (`AirplaneScene.tsx`) owns the canvas, the camera and the taps.
 *
 * Every pickable mesh carries `userData.part` (an `AirplanePart`); the fuselage is split by position
 * (`partFromHit`). Things that only decorate (the base, cones, the marshaller, the radar sweep) carry no
 * part, so a tap on them is not an answer.
 */
import * as THREE from 'three';
import type { AirplanePart } from './airplaneModel';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;
const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const ease = (x: number) => x * x * (3 - 2 * x);

// ── Geometry constants (aircraft frame: +x forward, +y up, wings along z) ──────
const XN = 15.84, XT = -15.84, R = 1.5, L = XN - XT;
export const GROUND = -2.9;
const BASE_R = 24;

function fusR(x: number): number {
  if (x >= XN) return 0;
  if (x > 10.6) { const t = (x - 10.6) / (XN - 10.6); return R * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.4))); }
  if (x < -8.5) { const t = (-8.5 - x) / (-8.5 - XT); return 0.28 + (R - 0.28) * (1 - Math.pow(t, 1.7)); }
  return R;
}
function fusY(x: number): number {
  if (x > 10.6) { const t = (x - 10.6) / (XN - 10.6); return -0.32 * t * t; }
  if (x < -8.5) { const t = (-8.5 - x) / (-8.5 - XT); return 1.05 * Math.pow(t, 1.6); }
  return 0;
}

/** Where the camera looks for each part (aircraft frame): target, azimuth, polar angle, distance. */
export const PART_VIEWS: Record<AirplanePart | 'overview', { t: THREE.Vector3; th: number; ph: number; r: number }> = {
  overview: { t: V(0, 0.5, 0), th: 0.75, ph: 1.17, r: 48 },
  nose: { t: V(13.8, -0.4, 0), th: 0.95, ph: 1.4, r: 10 },
  cockpit: { t: V(12.9, 0.7, 0), th: 1.3, ph: 1.05, r: 8 },
  cabin: { t: V(3, 0.3, 1.4), th: 0.18, ph: 1.42, r: 13 },
  wings: { t: V(-1.5, -0.3, 6.5), th: 0.3, ph: 0.62, r: 22 },
  engines: { t: V(2.6, -1.62, 4.05), th: 1.1, ph: 1.5, r: 8 },
  tail: { t: V(-12.5, 2.8, 0), th: -0.75, ph: 1.22, r: 18 },
  gear: { t: V(3, -2.0, 0), th: 0.35, ph: 1.6, r: 14 },
};

// ── Textures ───────────────────────────────────────────────────────────────────

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, aniso: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

const FONT = '"Barlow Semi Condensed","Arial Narrow",Arial,sans-serif';

function paintLivery(airline: string) {
  return (g: CanvasRenderingContext2D, W: number, H: number) => {
    const pxL = H / L, pxA = W / (TAU * R);
    const cy = (x: number) => (1 - (x - XT) / L) * H;
    g.fillStyle = '#f6f8fa'; g.fillRect(0, 0, W, H);
    const grd = g.createLinearGradient(0.10 * W, 0, 0.40 * W, 0);
    grd.addColorStop(0, '#f6f8fa'); grd.addColorStop(0.2, '#dde2e8'); grd.addColorStop(0.8, '#dde2e8'); grd.addColorStop(1, '#f6f8fa');
    g.fillStyle = grd; g.fillRect(0.10 * W, 0, 0.30 * W, H);
    g.fillStyle = '#e8ebef'; g.fillRect(0, 0, W, cy(14.95));
    g.fillStyle = 'rgba(80,90,105,0.35)'; g.fillRect(0, cy(14.95) - 1.5, W, 3);
    const poly = (pts: [number, number][], fill: string) => {
      g.beginPath();
      pts.forEach(([u, x], i) => { const X = u * W, Y = cy(x); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.closePath(); g.fillStyle = fill; g.fill();
    };
    const sweepR: [number, number][] = [[0.975, 12.6], [0.975, -6.5], [0.80, -15.9], [0.993, -15.9], [0.993, 12.15]];
    poly(sweepR, '#14264a'); poly(sweepR.map(([u, x]) => [1.5 - u, x] as [number, number]), '#14264a');
    poly([[0.996, 12.0], [0.996, -15.9], [1.0, -15.9], [1.0, 11.95]], '#19b3a6');
    poly([[0, 11.95], [0, -15.9], [0.004, -15.9], [0.004, 11.9]], '#19b3a6');
    poly([[0.496, 11.9], [0.496, -15.9], [0.504, -15.9], [0.504, 12.0]], '#19b3a6');
    poly([[0.9935, 11.2], [0.9935, -15.9], [0.9955, -15.9], [0.9955, 11.2]], '#ffb04a');
    poly([[0.5045, 11.2], [0.5045, -15.9], [0.5065, -15.9], [0.5065, 11.2]], '#ffb04a');
    const text = (str: string, xAft: number, side: 1 | -1, sizeM: number, color: string, u: number) => {
      g.save();
      g.font = `700 ${sizeM * pxL}px ${FONT}`;
      const wM = g.measureText(str).width / pxL;
      const x0 = side > 0 ? xAft : xAft + wM;
      g.translate(u * W, cy(x0));
      g.rotate(side > 0 ? -Math.PI / 2 : Math.PI / 2);
      g.scale(1, pxA / pxL);
      g.fillStyle = color; g.textBaseline = 'middle';
      g.fillText(str, 0, 0);
      g.restore();
    };
    const name = airline.toUpperCase();
    const size = name.length > 8 ? 0.8 * 8 / name.length : 0.8;
    text(name, 3.0, 1, size, '#14264a', 0.866);
    text(name, 3.0, -1, size, '#14264a', 1.5 - 0.866);
    const mapRS = (x: number, y: number, side: number): [number, number] => {
      const s = clamp(y / R, -1, 1);
      const u = side > 0 ? Math.asin(-s) / TAU : (Math.PI + Math.asin(s)) / TAU;
      return [u * W, cy(x)];
    };
    const door = (x0: number, x1: number, y0: number, y1: number, side: number) => {
      const pts: [number, number][] = [], N = 16;
      const edge = (ax: number, ay: number, bx: number, by: number) => {
        for (let i = 0; i < N; i++) { const t = i / N; pts.push(mapRS(lerp(ax, bx, t), lerp(ay, by, t), side)); }
      };
      edge(x0, y0, x1, y0); edge(x1, y0, x1, y1); edge(x1, y1, x0, y1); edge(x0, y1, x0, y0);
      for (const sh of side > 0 ? [0, W] : [0]) {
        g.beginPath(); pts.forEach(([X, Y], i) => { if (i) g.lineTo(X + sh, Y); else g.moveTo(X + sh, Y); }); g.closePath();
        g.lineWidth = 2.5; g.strokeStyle = 'rgba(55,66,84,0.55)'; g.stroke();
      }
    };
    door(10.05, 10.9, -0.85, 0.95, -1); door(10.1, 10.85, -0.7, 0.85, 1);
    door(-8.15, -7.4, -0.8, 0.9, -1); door(-8.1, -7.45, -0.7, 0.8, 1);
    for (const s of [1, -1]) { door(0.49, 1.03, 0.08, 0.85, s); door(-0.25, 0.29, 0.08, 0.85, s); }
    door(5.6, 6.9, -1.15, -0.35, 1); door(-4.6, -3.4, -1.15, -0.4, 1);
  };
}

function paintFin(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#14264a'; g.fillRect(0, 0, W, H);
  ['#19b3a6', '#6fe3b4', '#ffb04a'].forEach((c, i) => {
    g.beginPath(); g.lineWidth = 26; g.lineCap = 'round'; g.strokeStyle = c;
    g.arc(W * 0.95, H * 1.02, W * (0.42 + i * 0.13), Math.PI * 1.06, Math.PI * 1.52); g.stroke();
  });
  g.fillStyle = '#ffffff'; g.beginPath();
  const cx = W * 0.40, cyy = H * 0.26, r1 = 20, r2 = 7;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU - Math.PI / 2, r = i % 2 ? r2 : r1;
    const X = cx + Math.cos(a) * r, Y = cyy + Math.sin(a) * r;
    if (i) g.lineTo(X, Y); else g.moveTo(X, Y);
  }
  g.closePath(); g.fill();
}
function paintSpin(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#2b2f35'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath();
  for (let i = 0; i <= 40; i++) { const v = i / 40, x = (0.08 + v * 0.55) * W, y = (1 - v) * H; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke();
}
function paintBlur(g: CanvasRenderingContext2D, W: number, H: number) {
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 180; i++) {
    const a = Math.random() * TAU;
    g.strokeStyle = `rgba(210,216,224,${0.05 + Math.random() * 0.12})`; g.lineWidth = 1 + Math.random() * 2;
    g.beginPath(); g.arc(W / 2, H / 2, W * 0.14 + Math.random() * W * 0.35, a, a + 0.4 + Math.random() * 1.2); g.stroke();
  }
}
function paintGlow(g: CanvasRenderingContext2D, W: number, H: number) {
  const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function paintTarmac(code: string) {
  return (g: CanvasRenderingContext2D, W: number, H: number) => {
    g.fillStyle = '#767b82'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 16000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    const ppm = W / (2 * BASE_R);
    g.strokeStyle = 'rgba(38,42,48,0.45)'; g.lineWidth = 2;
    for (let m = -BASE_R; m <= BASE_R; m += 6) { const p = (m + BASE_R) * ppm; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.moveTo(0, p); g.lineTo(W, p); g.stroke(); }
    const cxz = (z: number) => (0.5 + z / (2 * BASE_R)) * W, cyx = (x: number) => (0.5 - x / (2 * BASE_R)) * H;
    g.fillStyle = '#1d1f22'; g.fillRect(cxz(-0.2), 0, cxz(0.2) - cxz(-0.2), H);
    g.fillStyle = '#f2c318'; g.fillRect(cxz(-0.08), 0, cxz(0.08) - cxz(-0.08), H);
    g.fillStyle = '#1d1f22'; g.fillRect(cxz(-2.3), cyx(12.3) - 7, cxz(2.3) - cxz(-2.3), 14);
    g.fillStyle = '#f2c318'; g.fillRect(cxz(-2.2), cyx(12.3) - 4, cxz(2.2) - cxz(-2.2), 8);
    g.font = `700 70px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f2c318'; g.fillText(code, cxz(0), cyx(13.8));
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 7; g.setLineDash([34, 24]);
    g.beginPath(); g.arc(W / 2, H / 2, W / 2 * 0.955, 0, TAU); g.stroke(); g.setLineDash([]);
  };
}

// ── Lofting ────────────────────────────────────────────────────────────────────

type Profile = [number, number][];
interface Station { le: THREE.Vector3; c: number; td: THREE.Vector3; ts: number; cd: THREE.Vector3 }

/** NACA 4-digit section between chord fractions a..b, as a closed loop. */
function airfoil(t: number, m: number, p: number, a: number, b: number, n: number): Profile {
  const yt = (x: number) => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
  const yc = (x: number) => (m === 0 ? 0 : x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) * (1 - p)) * ((1 - 2 * p) + 2 * p * x - x * x));
  const xs: number[] = [];
  for (let i = 0; i <= n; i++) { const bta = i / n * Math.PI; xs.push(a + (b - a) * (1 - Math.cos(bta)) / 2); }
  const loop: Profile = [];
  for (let i = n; i >= 0; i--) { const x = xs[i]; loop.push([x, yc(x) + yt(x)]); }
  for (let i = a === 0 ? 1 : 0; i <= n; i++) { const x = xs[i]; loop.push([x, yc(x) - yt(x)]); }
  return loop;
}
const UP = V(0, 1, 0), NZ = V(0, 0, -1), NX = V(-1, 0, 0);
function st(x: number, y: number, z: number, c: number, td?: THREE.Vector3, ts?: number, cd?: THREE.Vector3): Station {
  return { le: V(x, y, z), c, td: (td || UP).clone().normalize(), ts: ts || 1, cd: (cd || NX).clone() };
}
function mirror(ss: Station[]): Station[] {
  return ss.map(s => ({ le: V(s.le.x, s.le.y, -s.le.z), c: s.c, td: V(s.td.x, s.td.y, -s.td.z), ts: s.ts, cd: V(s.cd.x, s.cd.y, -s.cd.z) }));
}
function loft(stations: Station[], prof: Profile): THREE.BufferGeometry {
  const P: number[] = [], UV: number[] = [], I: number[] = [], np = prof.length, ns = stations.length;
  stations.forEach((s, si) => {
    for (const [xc, yc] of prof) {
      const p = s.le.clone().addScaledVector(s.cd, xc * s.c).addScaledVector(s.td, yc * s.c * s.ts);
      P.push(p.x, p.y, p.z); UV.push(xc, si / (ns - 1));
    }
  });
  for (let s = 0; s < ns - 1; s++) for (let k = 0; k < np; k++) {
    const k2 = (k + 1) % np;
    const a = s * np + k, b = s * np + k2, c = (s + 1) * np + k, d = (s + 1) * np + k2;
    I.push(a, c, b, b, c, d);
  }
  for (const si of [0, ns - 1]) {
    const base = P.length / 3; let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < np; k++) {
      const j = (si * np + k) * 3;
      P.push(P[j], P[j + 1], P[j + 2]); UV.push(UV[(si * np + k) * 2], UV[(si * np + k) * 2 + 1]);
      cx += P[j]; cy += P[j + 1]; cz += P[j + 2];
    }
    const ci = P.length / 3; P.push(cx / np, cy / np, cz / np); UV.push(0.5, si / (ns - 1));
    for (let k = 0; k < np; k++) I.push(ci, base + k, base + (k + 1) % np);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  return g;
}
function latheAxial(pairs: [number, number][], seg = 48) {
  const g = new THREE.LatheGeometry(pairs.map(([a, r]) => new THREE.Vector2(r, -a)), seg);
  g.rotateZ(-Math.PI / 2); return g;
}
function rrShape(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ── The diorama ────────────────────────────────────────────────────────────────

interface Hinged { grp: THREE.Group; pivot: THREE.Vector3; axis: THREE.Vector3; side?: number }

export interface JetState {
  /** The part showing what it does (after a right tap), or null. */
  showing: AirplanePart | null;
  /** The finale: engines up, climb, gear away. */
  flying: boolean;
}

export interface Airliner {
  /** Everything: base, props, lights and the jet. Add to the scene. */
  root: THREE.Group;
  /** The jet alone (for picking and focus). */
  aircraft: THREE.Group;
  tick(dt: number, state: JetState): void;
  /** The part a ray hit names, or null for scenery, an invisible mesh, or a miss. */
  partFromHit(object: THREE.Object3D, point: THREE.Vector3): AirplanePart | null;
  dispose(): void;
}

export function buildAirliner(opts: { airline: string; code: string; anisotropy?: number }): Airliner {
  const aniso = opts.anisotropy ?? 4;
  const mats: THREE.MeshStandardMaterial[] = [];
  const textures: THREE.Texture[] = [];
  const std = (hex: number, rough: number, metal: number, extra?: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, metalness: metal, side: THREE.DoubleSide, ...extra });
    mats.push(m); return m;
  };
  const tex = (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const t = canvasTex(w, h, draw, aniso); textures.push(t); return t;
  };

  const liveryTex = tex(1024, 2048, paintLivery(opts.airline));
  const finTex = tex(512, 512, paintFin);
  const spinTex = tex(256, 256, paintSpin);
  const blurTex = tex(256, 256, paintBlur);
  const glowTex = tex(128, 128, paintGlow);
  const tarmacTex = tex(2048, 2048, paintTarmac(opts.code));

  const M = {
    paint: std(0xffffff, 0.3, 0.12, { map: liveryTex }),
    belly: std(0xdde2e8, 0.35, 0.15),
    plain: std(0xf2f4f6, 0.35, 0.15),
    wing: std(0xd3d8de, 0.42, 0.35),
    wingDark: std(0xbac1c9, 0.45, 0.4),
    navy: std(0x14264a, 0.35, 0.3),
    fin: std(0xffffff, 0.35, 0.25, { map: finTex }),
    lip: std(0xe2e7ed, 0.15, 1.0),
    duct: std(0x14161a, 0.8, 0.3),
    fan: std(0xb2b8bf, 0.26, 0.95),
    core: std(0x5b6068, 0.45, 0.85),
    plug: std(0x3a3d42, 0.5, 0.8),
    spinner: std(0xffffff, 0.3, 0.55, { map: spinTex }),
    teal: std(0x19b3a6, 0.35, 0.3),
    glass: std(0x0c1828, 0.05, 0.9, { transparent: true, opacity: 0.86 }),
    winGlass: std(0x101a26, 0.08, 0.7, { emissive: new THREE.Color(0xffc983), emissiveIntensity: 0 }),
    frame: std(0xc9d0d8, 0.4, 0.3),
    gear: std(0xe6e9ec, 0.5, 0.3),
    chrome: std(0xf2f4f6, 0.1, 1.0),
    rubber: std(0x18191b, 0.85, 0.0),
    hub: std(0xb8bec6, 0.35, 0.9),
    dark: std(0x2b2e33, 0.6, 0.5),
  };

  const root = new THREE.Group();
  const ac = new THREE.Group(); root.add(ac);

  const tag = <T extends THREE.Object3D>(o: T, part: AirplanePart): T => {
    o.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.userData.part = part; c.castShadow = true; c.receiveShadow = true; } });
    return o;
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, part: AirplanePart, parent: THREE.Object3D = ac) => {
    const m = new THREE.Mesh(geo, mat); tag(m, part); parent.add(m); return m;
  };

  // Fuselage, tagged 'cabin'; `partFromHit` splits it into nose / cockpit / cabin / tail by position.
  function fusSection(x0: number, x1: number, phiStart: number, phiLen: number, off: number, nphi: number) {
    const xs: number[] = [];
    if (x0 === XT && x1 === XN) {
      for (let x = XT; x < 14.6; x += 0.12) xs.push(x);
      for (let i = 0; i <= 36; i++) { const s = i / 36; xs.push(XN - (XN - 14.6) * (1 - s) * (1 - s)); }
    } else {
      const n = Math.max(4, Math.ceil((x1 - x0) / 0.08));
      for (let i = 0; i <= n; i++) xs.push(x0 + (x1 - x0) * i / n);
    }
    const g = new THREE.LatheGeometry(xs.map(x => new THREE.Vector2(Math.max(0.0001, fusR(x) + (fusR(x) > 0.05 ? off : 0)), x)), nphi, phiStart, phiLen);
    g.rotateZ(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + fusY(x)); uv.setY(i, (x - XT) / L); }
    p.needsUpdate = true; uv.needsUpdate = true;
    return g;
  }
  const fuselage = mesh(fusSection(XT, XN, 0, TAU, 0, 72), M.paint, 'cabin');
  fuselage.userData.fuselage = true;

  {
    const cy = fusY(XT);
    const cap = mesh(new THREE.CircleGeometry(0.285, 32), M.dark, 'tail'); cap.rotation.y = -Math.PI / 2; cap.position.set(XT + 0.002, cy, 0);
    const apu = mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.32, 24, 1, true), M.core, 'tail'); apu.rotation.z = Math.PI / 2; apu.position.set(XT - 0.1, cy, 0);
  }
  { const bf = mesh(new THREE.SphereGeometry(1, 40, 20), M.belly, 'cabin'); bf.scale.set(4.4, 0.62, 1.55); bf.position.set(-0.3, -1.2, 0); }

  // Cabin windows (instanced).
  {
    const glassGeo = new THREE.ShapeGeometry(rrShape(0.25, 0.35, 0.1), 6);
    const fs = rrShape(0.34, 0.45, 0.14); fs.holes.push(rrShape(0.25, 0.35, 0.1));
    const frameGeo = new THREE.ShapeGeometry(fs, 6);
    const xs: number[] = []; for (let x = 8.9; x > -7.0; x -= 0.74) xs.push(x);
    const n = xs.length * 2;
    const gI = new THREE.InstancedMesh(glassGeo, M.winGlass, n), fI = new THREE.InstancedMesh(frameGeo, M.frame, n);
    const d = new THREE.Object3D(); let k = 0;
    const wy = 0.45, wz = Math.sqrt(R * R - wy * wy);
    for (const s of [1, -1]) for (const x of xs) {
      const nrm = V(0, wy / R, s * wz / R);
      d.position.set(x, wy, s * wz).addScaledVector(nrm, 0.017); d.lookAt(d.position.clone().add(nrm)); d.updateMatrix(); gI.setMatrixAt(k, d.matrix);
      d.position.set(x, wy, s * wz).addScaledVector(nrm, 0.010); d.updateMatrix(); fI.setMatrixAt(k, d.matrix); k++;
    }
    [gI, fI].forEach(m => { m.frustumCulled = false; tag(m, 'cabin'); ac.add(m); });
  }
  // Cockpit windshield panes.
  {
    const top = 1.5 * Math.PI;
    ([[top - 0.72, 0.68, 12.85, 13.55], [top + 0.04, 0.68, 12.85, 13.55], [top - 1.30, 0.50, 12.15, 12.95], [top + 0.80, 0.50, 12.15, 12.95]] as const)
      .forEach(([p0, pl, x0, x1]) => mesh(fusSection(x0, x1, p0, pl, 0.012, 12), M.glass, 'cockpit'));
  }
  // Pitot probes.
  for (const s of [1, -1]) for (const dx of [0, 0.4]) {
    const p = mesh(new THREE.CylinderGeometry(0.016, 0.024, 0.3, 8), M.chrome, 'nose');
    p.rotation.x = s * Math.PI / 2; p.position.set(13.65 - dx, -0.28 + dx * 0.1, s * 1.4);
  }
  // Antennas.
  {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.42, 0); sh.lineTo(0.14, 0.32); sh.lineTo(0.02, 0.32); sh.closePath();
    const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }); ag.translate(-0.21, 0, -0.015);
    ([[4.2, 1], [-4.8, 1], [6.4, -1]] as const).forEach(([x, s]) => {
      const a = mesh(ag, M.plain, 'cabin'); a.position.set(x, s * (R - 0.02), 0); if (s < 0) a.rotation.x = Math.PI;
    });
  }

  // Wings, flaps, ailerons, winglets.
  function wingAt(z: number) {
    const K = [[0, 5.6], [1.2, 5.1], [4.5, 3.6], [12.2, 1.25]];
    let c = 1.25;
    for (let i = 0; i < K.length - 1; i++) {
      if (z <= K[i + 1][0]) { const f = (z - K[i][0]) / (K[i + 1][0] - K[i][0]); c = K[i][1] + f * (K[i + 1][1] - K[i][1]); break; }
    }
    return { x: 2.2 - 0.47 * z, y: -0.95 + 0.0875 * z, c };
  }
  const wst = (z: number) => { const w = wingAt(z); return st(w.x, w.y, z, w.c, UP, 1.15 - 0.35 * z / 12.2); };
  const boxProf = airfoil(0.12, 0.02, 0.4, 0, 0.74, 26);
  const csProf = airfoil(0.12, 0.02, 0.4, 0.765, 1, 8);
  function hinged(stations: Station[], prof: Profile, hingeFrac: number, mat: THREE.Material, part: AirplanePart): Hinged {
    const g = loft(stations, prof);
    const s0 = stations[0], s1 = stations[stations.length - 1];
    const hp = (s: Station) => s.le.clone().addScaledVector(s.cd, hingeFrac * s.c);
    const p0 = hp(s0), p1 = hp(s1);
    const axis = p1.clone().sub(p0).normalize();
    const big = Math.abs(axis.z) >= Math.abs(axis.y) ? axis.z : axis.y;
    if (big < 0) axis.negate();
    g.translate(-p0.x, -p0.y, -p0.z);
    const grp = new THREE.Group(); grp.position.copy(p0);
    const m = new THREE.Mesh(g, mat); tag(m, part); grp.add(m); ac.add(grp);
    return { grp, pivot: p0.clone(), axis };
  }
  function setHinge(cs: Hinged, angle: number, slide: number) {
    cs.grp.position.copy(cs.pivot); cs.grp.position.x -= slide; cs.grp.position.y -= slide * 0.28;
    cs.grp.quaternion.setFromAxisAngle(cs.axis, angle);
  }
  const flaps: Hinged[] = [], ailerons: Hinged[] = [], elevators: Hinged[] = [];
  const wingletSt = [
    st(-3.45, 0.10, 11.95, 1.32, UP, 0.9),
    st(-3.72, 0.30, 12.47, 1.12, V(0, 1, -1), 0.9),
    st(-3.97, 0.74, 12.68, 0.95, V(0, 0.25, -1), 0.9),
    st(-4.55, 1.85, 12.80, 0.58, NZ, 0.9),
  ];
  for (const s of [1, -1]) {
    const ms = (arr: Station[]) => (s > 0 ? arr : mirror(arr));
    mesh(loft(ms([0, 1.2, 4.5, 8, 12.2].map(wst)), boxProf), M.wing, 'wings');
    flaps.push(hinged(ms([1.0, 1.2, 4.45].map(wst)), csProf, 0.765, M.wingDark, 'wings'));
    flaps.push(hinged(ms([4.55, 8.0, 8.55].map(wst)), csProf, 0.765, M.wingDark, 'wings'));
    const ai = hinged(ms([8.7, 12.15].map(wst)), csProf, 0.765, M.wingDark, 'wings'); ai.side = s; ailerons.push(ai);
    mesh(loft(ms(wingletSt), airfoil(0.10, 0.015, 0.4, 0, 1, 20)), M.navy, 'wings');
    for (const z of [2.7, 5.6, 7.6]) {
      const w = wingAt(z);
      const f = mesh(new THREE.SphereGeometry(1, 18, 10), M.wing, 'wings');
      f.scale.set(1.5, 0.17, 0.14); f.position.set(w.x - w.c + 0.35, w.y - 0.2, s * z);
    }
  }

  // Tail: stabilizers with elevators, fin with rudder, dorsal fairing.
  let rudder: Hinged;
  {
    const hs = [st(-12.1, 0.36, 0, 2.9, UP, 1), st(-15.25, 0.88, 5.0, 1.15, UP, 0.9)];
    for (const s of [1, -1]) {
      const ss = s > 0 ? hs : mirror(hs);
      mesh(loft(ss, airfoil(0.10, 0, 0.4, 0, 0.72, 20)), M.wing, 'tail');
      const el = hinged(ss, airfoil(0.10, 0, 0.4, 0.74, 1, 8), 0.74, M.wingDark, 'tail'); el.side = s; elevators.push(el);
    }
    const vt = [st(-10.2, 1.3, 0, 4.6, NZ, 1), st(-14.16, 6.95, 0, 2.1, NZ, 0.95)];
    mesh(loft(vt, airfoil(0.11, 0, 0.4, 0, 0.71, 22)), M.fin, 'tail');
    rudder = hinged(vt, airfoil(0.11, 0, 0.4, 0.73, 1, 8), 0.73, M.fin, 'tail');
    mesh(loft([st(-8.0, 1.40, 0, 2.9, NZ, 1), st(-10.35, 2.15, 0, 0.55, NZ, 1)], airfoil(0.07, 0, 0.4, 0, 1, 14)), M.navy, 'tail');
  }

  // Engines.
  const ENG = { x: 2.9, y: -1.62, z: 4.05 };
  const fans: THREE.Group[] = [];
  const bladeGeo = new THREE.BoxGeometry(0.025, 0.44, 0.17);
  const spinGeo = new THREE.ConeGeometry(0.16, 0.36, 32); spinGeo.rotateZ(-Math.PI / 2);
  const blurGeo = new THREE.RingGeometry(0.16, 0.59, 48, 1); blurGeo.rotateY(Math.PI / 2);
  const blurMat = new THREE.MeshBasicMaterial({ map: blurTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const g = new THREE.Group(); g.position.set(ENG.x, ENG.y, s * ENG.z); ac.add(g);
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => mesh(geo, mat, 'engines', g);
    add(latheAxial([[0.5, 0.598], [0.2, 0.603], [0.06, 0.622], [0, 0.66], [0.02, 0.705], [0.1, 0.737], [0.28, 0.758]]), M.lip);
    add(latheAxial([[0.28, 0.758], [0.8, 0.773], [1.5, 0.773], [2.2, 0.745], [2.7, 0.68], [2.98, 0.60]]), M.navy);
    add(latheAxial([[0.98, 0.779], [1.10, 0.779]]), M.teal);
    add(latheAxial([[2.98, 0.60], [2.995, 0.578], [2.7, 0.572]]), M.duct);
    add(latheAxial([[0.5, 0.598], [1.4, 0.59], [2.4, 0.575], [2.7, 0.572]]), M.duct);
    add(latheAxial([[1.0, 0.30], [1.6, 0.44], [2.4, 0.47], [2.98, 0.455], [3.42, 0.37]]), M.core);
    add(latheAxial([[3.42, 0.37], [3.43, 0.345], [3.25, 0.34]]), M.duct);
    add(latheAxial([[3.25, 0.30], [3.45, 0.285], [3.72, 0.16], [3.95, 0.02]]), M.plug);
    const cf = add(new THREE.CircleGeometry(0.59, 40), M.duct); cf.rotation.y = Math.PI / 2; cf.position.x = -1.0;
    const fan = new THREE.Group(); fan.position.x = -0.55; g.add(fan);
    for (let i = 0; i < 24; i++) {
      const piv = new THREE.Group(); piv.rotation.x = i / 24 * TAU;
      const b = new THREE.Mesh(bladeGeo, M.fan); b.position.y = 0.37; b.rotation.y = 0.62; tag(b, 'engines');
      piv.add(b); fan.add(piv);
    }
    const sp = new THREE.Mesh(spinGeo, M.spinner); sp.position.x = 0.17; tag(sp, 'engines'); fan.add(sp);
    const blur = new THREE.Mesh(blurGeo, blurMat); blur.position.x = -0.5; blur.userData.part = 'engines'; g.add(blur);
    fans.push(fan);
    mesh(loft([st(ENG.x - 0.35, -1.0, s * ENG.z, 3.3, NZ, 1), st(0.6, -0.56, s * ENG.z, 2.7, NZ, 1)], airfoil(0.13, 0, 0.4, 0, 1, 16)), M.wing, 'engines');
  }

  // Landing gear.
  const cyl = (r1: number, r2: number, h: number, mat: THREE.Material) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), mat);
  const wheel = (r: number, tube: number, hubR: number, width: number) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 14, 36), M.rubber));
    const h = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, width, 24), M.hub); h.rotation.x = Math.PI / 2; g.add(h);
    return g;
  };
  const gearLegs: { p: THREE.Group; type: 'main' | 'nose'; s: number }[] = [];
  for (const s of [1, -1]) {
    const p = new THREE.Group(); p.position.set(-1.05, -0.98, s * 2.55); ac.add(p);
    const up = cyl(0.11, 0.11, 0.85, M.gear); up.position.y = -0.42; p.add(up);
    const lo = cyl(0.075, 0.075, 0.62, M.chrome); lo.position.y = -1.14; p.add(lo);
    const ax = cyl(0.06, 0.06, 0.74, M.dark); ax.rotation.x = Math.PI / 2; ax.position.y = -1.46; p.add(ax);
    for (const dz of [-0.3, 0.3]) { const w = wheel(0.33, 0.13, 0.25, 0.24); w.position.set(0, -1.46, dz); p.add(w); }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 0.03), M.plain); door.position.set(0, -0.55, s * 0.16); p.add(door);
    const brace = cyl(0.04, 0.04, 1.0, M.gear); brace.position.set(0.25, -0.4, -s * 0.3); brace.rotation.x = s * 0.6; p.add(brace);
    tag(p, 'gear'); gearLegs.push({ p, type: 'main', s });
  }
  {
    const p = new THREE.Group(); p.position.set(12.0, -1.1, 0); ac.add(p);
    const up = cyl(0.09, 0.09, 0.8, M.gear); up.position.y = -0.4; p.add(up);
    const lo = cyl(0.06, 0.06, 0.67, M.chrome); lo.position.y = -1.13; p.add(lo);
    const ax = cyl(0.045, 0.045, 0.5, M.dark); ax.rotation.x = Math.PI / 2; ax.position.y = -1.49; p.add(ax);
    for (const dz of [-0.2, 0.2]) { const w = wheel(0.22, 0.09, 0.16, 0.16); w.position.set(0, -1.49, dz); p.add(w); }
    tag(p, 'gear'); gearLegs.push({ p, type: 'nose', s: 0 });
  }

  // Navigation lights.
  const blinkers: { m: THREE.Mesh; sp: THREE.Sprite; kind: 'steady' | 'strobe' | 'beacon'; size: number }[] = [];
  const navLight = (pos: THREE.Vector3, hex: number, kind: 'steady' | 'strobe' | 'beacon', size = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) }));
    m.position.copy(pos); ac.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.copy(pos); sp.raycast = () => {}; ac.add(sp);
    blinkers.push({ m, sp, kind, size });
  };
  navLight(V(-3.3, 0.08, 12.22), 0x39ff7a, 'steady');
  navLight(V(-3.3, 0.08, -12.22), 0xff3040, 'steady');
  navLight(V(-3.6, 0.1, 12.3), 0xffffff, 'strobe', 1.3);
  navLight(V(-3.6, 0.1, -12.3), 0xffffff, 'strobe', 1.3);
  navLight(V(-16.0, 1.18, 0), 0xffffff, 'steady');
  navLight(V(-2, 1.54, 0), 0xff2a2a, 'beacon', 1.2);
  navLight(V(1, -1.53, 0), 0xff2a2a, 'beacon', 1.2);

  // Interior, seen through the skin when the cockpit or the cabin shows itself.
  const cabinInside = new THREE.Group(); cabinInside.visible = false; ac.add(cabinInside);
  const cockpitInside = new THREE.Group(); cockpitInside.visible = false; ac.add(cockpitInside);
  const screenMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fd6ff) });
  {
    const seatM = std(0x1f3b6b, 0.7, 0.05), headM = std(0xe9edf2, 0.8, 0), binM = std(0xeef1f4, 0.6, 0.05), floorM = std(0x6b6f75, 0.9, 0), panelM = std(0x22252a, 0.6, 0.3);
    const add = (parent: THREE.Group, part: AirplanePart, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData.part = part; parent.add(m); return m;
    };
    add(cabinInside, 'cabin', new THREE.BoxGeometry(20.6, 0.06, 2.6), floorM, 1.3, -0.6, 0);
    const rows = 19, zs = [-0.95, -0.47, 0.47, 0.95];
    const cushion = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), seatM, rows * 4);
    const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.62, 0.44), seatM, rows * 4);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.16, 0.4), headM, rows * 4);
    const d = new THREE.Object3D(); let k = 0;
    for (let r = 0; r < rows; r++) for (const z of zs) {
      const x = 8.3 - r * 0.8;
      d.rotation.set(0, 0, 0); d.position.set(x, -0.15, z); d.updateMatrix(); cushion.setMatrixAt(k, d.matrix);
      d.position.set(x - 0.24, 0.17, z); d.rotation.z = 0.12; d.updateMatrix(); back.setMatrixAt(k, d.matrix);
      d.position.set(x - 0.28, 0.43, z); d.updateMatrix(); head.setMatrixAt(k, d.matrix); k++;
    }
    [cushion, back, head].forEach(m => { m.frustumCulled = false; m.userData.part = 'cabin'; cabinInside.add(m); });
    for (const s of [1, -1]) add(cabinInside, 'cabin', new THREE.BoxGeometry(17.5, 0.34, 0.5), binM, 1.2, 0.98, s * 0.98);
    add(cabinInside, 'cabin', new THREE.BoxGeometry(0.9, 1.6, 1.0), binM, 9.6, 0.2, 0.7);
    add(cabinInside, 'cabin', new THREE.BoxGeometry(0.9, 1.6, 1.0), binM, -7.0, 0.2, -0.6);
    for (const s of [1, -1]) {
      add(cockpitInside, 'cockpit', new THREE.BoxGeometry(0.5, 0.12, 0.5), seatM, 12.7, -0.25, s * 0.45);
      add(cockpitInside, 'cockpit', new THREE.BoxGeometry(0.1, 0.75, 0.5), seatM, 12.45, 0.12, s * 0.45);
    }
    add(cockpitInside, 'cockpit', new THREE.BoxGeometry(0.35, 0.45, 1.6), panelM, 13.7, 0.2, 0);
    [-0.62, -0.31, 0, 0.31, 0.62].forEach(z => {
      const sc = add(cockpitInside, 'cockpit', new THREE.PlaneGeometry(0.26, 0.22), screenMat, 13.52, 0.25, z); sc.rotation.y = -Math.PI / 2;
    });
  }

  // The nose's weather radar, shown as a sweep in front of the radome.
  const radarMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5fe0ff), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const radarGeo = new THREE.ConeGeometry(3.2, 9, 40, 1, true); radarGeo.rotateZ(Math.PI / 2);
  const radar = new THREE.Mesh(radarGeo, radarMat); radar.position.set(XN + 4.5, -0.3, 0); radar.visible = false; radar.raycast = () => {};
  ac.add(radar);

  // Base and props (no part: scenery).
  const scenery: THREE.Object3D[] = [];
  {
    const baseMats = [std(0x2a221d, 0.55, 0.15), std(0xffffff, 0.85, 0.05, { map: tarmacTex }), std(0x1a1512, 0.8, 0.1)];
    const base = new THREE.Mesh(new THREE.CylinderGeometry(BASE_R, BASE_R + 1, 1.4, 120, 1), baseMats);
    base.position.y = GROUND - 0.7; base.receiveShadow = true; root.add(base); scenery.push(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(BASE_R + 0.02, 0.09, 10, 160), std(0xc9a45c, 0.25, 1));
    rim.rotation.x = Math.PI / 2; rim.position.y = GROUND; root.add(rim); scenery.push(rim);
  }
  const orange = std(0xff6a1a, 0.6, 0), white = std(0xf5f5f5, 0.5, 0), yellow = std(0xf2c318, 0.6, 0.1);
  const cone = (x: number, z: number) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.62, 20), orange); c.position.y = 0.36;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), orange); b.position.y = 0.025;
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.088, 0.12, 20), white); w.position.y = 0.42;
    g.add(c, b, w); g.position.set(x, GROUND, z); g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    root.add(g); scenery.push(g);
  };
  ([[-3.8, 13.4], [-3.8, -13.4], [-17.2, 0], [4.9, 5.3], [4.9, -5.3]] as const).forEach(([x, z]) => cone(x, z));
  const chocks = new THREE.Group(); root.add(chocks); scenery.push(chocks);
  ([[12.45, 0.2], [11.55, 0.2], [12.45, -0.2], [11.55, -0.2]] as const).forEach(([x, z]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.3), yellow); c.position.set(x, GROUND + 0.08, z); c.castShadow = true; chocks.add(c);
  });
  for (const s of [1, -1]) for (const dx of [0.58, -0.58]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.95), yellow); c.position.set(-1.05 + dx, GROUND + 0.1, s * 2.55); c.castShadow = true; chocks.add(c);
  }
  // A marshaller waving wands, for scale.
  const arms: { ag: THREE.Group; s: number }[] = [];
  {
    const g = new THREE.Group(); g.position.set(19.8, GROUND, 0); g.rotation.y = Math.PI; root.add(g); scenery.push(g);
    const vest = std(0xd9f227, 0.6, 0), navyC = std(0x1d2a44, 0.8, 0), skin = std(0xc4906c, 0.7, 0);
    const wandM = std(0xff7a1a, 0.4, 0, { emissive: new THREE.Color(0xff5a00), emissiveIntensity: 0.6 });
    const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.86, 16), navyC); legs.position.y = 0.43;
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 16), vest); torso.position.y = 1.17;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin); head.position.y = 1.62;
    const muffs = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.035, 8, 20, Math.PI), orange); muffs.position.y = 1.64; muffs.rotation.y = Math.PI / 2;
    g.add(legs, torso, head, muffs);
    for (const s of [1, -1]) {
      const ag = new THREE.Group(); ag.position.set(0, 1.44, s * 0.25);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.6, 10), vest); arm.position.y = -0.3;
      const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 10), wandM); wand.position.y = -0.78;
      ag.add(arm, wand); g.add(ag); arms.push({ ag, s });
    }
    g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
  }

  // Lights.
  const hemi = new THREE.HemisphereLight(new THREE.Color(0xdcecff), new THREE.Color(0x7d838b), 0.8); root.add(hemi);
  const sun = new THREE.DirectionalLight(new THREE.Color(0xfff0da), 2.3);
  sun.position.set(22, 34, 18); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 110 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  root.add(sun); root.add(sun.target);

  // ── Animation state ────────────────────────────────────────────────────────
  const s = { t: 0, spool: 0, alt: 0, gear: 1, flap: 0, slide: 0, xray: 0, showT: 0, shown: null as AirplanePart | null };
  const SKIN = [M.paint, M.belly];
  const setSkin = (opacity: number) => {
    for (const m of SKIN) {
      const see = opacity < 0.999;
      if (m.transparent !== see) { m.transparent = see; m.depthWrite = !see; m.needsUpdate = true; }
      m.opacity = opacity;
    }
  };

  function tick(dtRaw: number, state: JetState) {
    const dt = Math.min(0.05, dtRaw);
    s.t += dt; const t = s.t;
    if (state.showing !== s.shown) { s.shown = state.showing; s.showT = 0; } else s.showT += dt;
    const show = s.shown;

    // Engines: spool up while they show, or to fly.
    const engOn = state.flying || show === 'engines';
    s.spool = approach(s.spool, engOn ? 1 : 0, dt * (engOn ? 0.35 : 0.14));
    const sp = Math.pow(s.spool, 1.3);
    fans.forEach(f => { f.rotation.x += (sp * 24 + (s.alt > 0.5 && !engOn ? 1.5 : 0)) * dt; });
    blurMat.opacity = clamp((s.spool - 0.35) * 0.9, 0, 0.55);

    // The finale: climb, then tuck the gear.
    if (state.flying) { s.alt = approach(s.alt, 1, dt * 0.26); if (s.alt > 0.22) s.gear = approach(s.gear, 0, dt * 0.4); }
    else { s.gear = approach(s.gear, 1, dt * 0.45); if (s.gear > 0.98) s.alt = approach(s.alt, 0, dt * 0.24); }
    const a = ease(s.alt);
    // The gear shows itself by bouncing the jet on its shock absorbers.
    const bounce = show === 'gear' ? 0.16 * Math.exp(-s.showT * 1.1) * Math.sin(s.showT * 7.5) - 0.05 * Math.exp(-s.showT * 1.1) : 0;
    ac.position.y = a * 4.4 + a * 0.25 * Math.sin(t * 0.9) + bounce;
    ac.rotation.x = a * 0.1 * Math.sin(t * 0.45);
    ac.rotation.z = a * 0.07 + a * 0.015 * Math.sin(t * 0.7);
    ac.updateMatrixWorld(true);

    // Wings: flaps down and ailerons rocking; tail: rudder and elevators move.
    const wingShow = show === 'wings';
    const ailA = a * 0.2 * Math.cos(t * 0.45) + (wingShow ? 0.28 * Math.sin(s.showT * 2.4) : 0);
    ailerons.forEach(c => setHinge(c, (c.side ?? 1) * ailA, 0));
    const flapGoal = wingShow ? 35 : 0, slideGoal = wingShow ? 0.48 : 0;
    s.flap = approach(s.flap, flapGoal, dt * 14);
    s.slide = approach(s.slide, slideGoal, dt * 0.25);
    flaps.forEach(c => setHinge(c, s.flap * Math.PI / 180, s.slide));
    const tailShow = show === 'tail';
    setHinge(rudder, tailShow ? 0.38 * Math.sin(s.showT * 2.2) : 0, 0);
    elevators.forEach(c => setHinge(c, tailShow ? 0.3 * Math.sin(s.showT * 2.2 + 1.2) : 0, 0));

    const ge = ease(s.gear);
    gearLegs.forEach(g => {
      if (g.type === 'main') g.p.rotation.x = g.s * (1 - ge) * 1.62; else g.p.rotation.z = (1 - ge) * 1.6;
      g.p.visible = s.gear > 0.02;
    });
    chocks.visible = s.alt < 0.001 && s.gear > 0.99;
    arms.forEach(({ ag, s: side }) => { ag.rotation.x = -side * (2.3 + 0.45 * Math.sin(t * 3.2)); });

    // Cockpit and cabin: see through the skin.
    const inside = show === 'cockpit' || show === 'cabin';
    s.xray = approach(s.xray, inside ? 1 : 0, dt * 2.2);
    setSkin(1 - 0.84 * s.xray);
    cockpitInside.visible = s.xray > 0.02 && show === 'cockpit';
    cabinInside.visible = s.xray > 0.02 && show === 'cabin';
    M.winGlass.emissiveIntensity = show === 'cabin' ? 1.1 * s.xray : 0;
    screenMat.color.setHex(show === 'cockpit' && Math.sin(t * 6) > 0.6 ? 0xbff0ff : 0x7fd6ff);

    // Nose: the radar sweep pulses ahead of the radome.
    radar.visible = show === 'nose';
    if (radar.visible) {
      const ph = (s.showT * 0.8) % 1;
      radarMat.opacity = 0.32 * (1 - ph);
      radar.scale.set(0.3 + 0.7 * ph, 0.3 + 0.7 * ph, 0.3 + 0.7 * ph);
      radar.position.x = XN + 4.5 * (0.3 + 0.7 * ph);
    }

    blinkers.forEach(b => {
      let k = 1;
      if (b.kind === 'beacon') k = (t % 1.1) < 0.14 ? 1 : 0.08;
      if (b.kind === 'strobe') { const ph = t % 1.3; k = (ph < 0.05 || (ph > 0.14 && ph < 0.19)) ? 1.8 : 0; }
      if (b.kind !== 'steady' && !engOn && !tailShow) k *= b.kind === 'beacon' ? 0.4 : 0;
      const sc = 0.6 * k * b.size * (tailShow && b.kind !== 'steady' ? 1.6 : 1);
      b.sp.scale.set(sc, sc, sc); b.sp.visible = sc > 0.01;
      b.m.visible = b.kind !== 'strobe' || k > 0;
    });
  }

  const local = new THREE.Vector3();
  function partFromHit(object: THREE.Object3D, point: THREE.Vector3): AirplanePart | null {
    let o: THREE.Object3D | null = object;
    for (let p: THREE.Object3D | null = object; p; p = p.parent) if (!p.visible) return null;
    while (o && !o.userData.part) o = o.parent;
    if (!o) return null;
    const part = o.userData.part as AirplanePart;
    if (!o.userData.fuselage) return part;
    local.copy(point); ac.worldToLocal(local);
    return local.x > 14.3 ? 'nose' : local.x > 11.6 ? (local.y > 0.15 ? 'cockpit' : 'nose') : local.x < -9.5 ? 'tail' : 'cabin';
  }

  function dispose() {
    root.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose();
    });
    textures.forEach(t => t.dispose());
  }

  void scenery;
  return { root, aircraft: ac, tick, partFromHit, dispose };
}

/** A sky-gradient environment for reflections, made once per renderer. */
export function makeSkyEnvironment(gl: THREE.WebGLRenderer): THREE.Texture {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(50, 48, 24);
  const pos = geo.attributes.position, cs: number[] = [];
  const cT = new THREE.Color(0x6fa8dc), cH = new THREE.Color(0xf2f6fa), cB = new THREE.Color(0x565b62), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50;
    if (y >= 0) tmp.copy(cH).lerp(cT, Math.pow(y, 0.6)); else tmp.copy(cH).lerp(cB, Math.pow(-y, 0.4));
    cs.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  s.add(sky);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(6) }));
  sun.position.set(28, 30, 22); s.add(sun);
  const pm = new THREE.PMREMGenerator(gl);
  const rt = pm.fromScene(s, 0.03);
  pm.dispose(); geo.dispose(); (sky.material as THREE.Material).dispose(); sun.geometry.dispose(); (sun.material as THREE.Material).dispose();
  return rt.texture;
}
