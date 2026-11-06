/**
 * The circuit workbench, built in code with three.js (no model files): a wooden table with a battery lying in its holder
 * and one or two bulbs in holders, each part with clip posts a wire can join. Wires are drawn as curved tubes between
 * two posts. A bulb glows when `circuitModel.ts` says it is lit; the battery glows orange when the model says it is
 * shorted. The scene never decides what lights.
 *
 * A conductor item adds a test gap: two wires end in clips on a pad at the front of the table, one from the bulb and one
 * from the battery's − end; the thing being tested lies across the pad between them.
 *
 * A magnet-poles item replaces the circuit with two bar magnets lying end to end: the left one stays put, the right one
 * turns round when tapped and slides up to the left one when the left one is tapped; `poleModel.ts` says whether they
 * snap together or push apart.
 *
 * A magnet-distance item puts one or two rulers on the table, each with a bar magnet at its near end and a steel ball
 * that goes on a mark; tried, the magnet rolls the ball to itself if it pulls it (`distanceModel.ts`).
 * Tappable posts carry `userData.target` ('clip:<clip>'), the magnets 'mag:a' and 'mag:b', a ruler's marks 'mark:<ruler>:<mark>'; everything else is looked through.
 */
import * as THREE from 'three';
import { isBulb, type BulbColor, type Clip, type Wire } from './circuitModel';
import type { CondThing } from './conductorModel';
import type { MagnetThing } from './magnetModel';
import type { Pole, PoleResult } from './poleModel';
import { MARKS, type MagnetSize } from './distanceModel';
import { buildElectroBench, type ElectroBench, type ElectroSceneState, type ElectroTarget } from './electro3d';

export type CircuitTarget = `clip:${Clip}` | 'mag:a' | 'mag:b' | `mark:${number}:${number}` | ElectroTarget;

export interface CircuitSceneState {
  bulbs: readonly BulbColor[];
  wires: readonly Wire[];
  /** The battery is in: lit bulbs glow, a short warms the battery. */
  powered: boolean;
  lit: readonly BulbColor[];
  short: boolean;
  /** The clip tapped first, waiting for its second clip. */
  selected: Clip | null;
  /** A wire whose clip came off (find_the_break): drawn from its first clip to the table beside its second. */
  loose?: Wire | null;
  /** The thing lying across the test gap (conductor_test), or none. */
  inGap?: CondThing | null;
  /** The magnet test: the thing under the magnet, and whether the magnet pulls it up. */
  held?: MagnetThing | null;
  stuck?: boolean;
  /** Magnet poles: the right magnet's real pole facing the left one, and the last test (a new `n` slides it up). */
  poles?: { facing: Pole; test: { n: number; result: PoleResult } | null } | null;
  /** Magnet distance: each ruler's ball (its mark, or off the ruler; stuck = pulled to the magnet), the last try (a new
   *  `n` jiggles that magnet), and the pull-marks lever's coloured marks. */
  dist?: { balls: ReadonlyArray<{ mark: number | null; stuck: boolean }>; test: { n: number; ruler: number } | null;
    marks: ReadonlyArray<{ ruler: number; mark: number; pulled: boolean }> | null } | null;
  /** The electromagnet bench (`electro3d.ts`). */
  electro?: ElectroSceneState | null;
  /** The switch (add_a_switch): on = closed, its lever down on the far clip. */
  switchOn?: boolean;
  /** Lit bulbs that glow dimly (in a row), and bulbs taken out of their holders. */
  dim?: readonly BulbColor[];
  out?: readonly BulbColor[];
  /** The x-ray lever: the clips electricity reaches from the + end, and whether it flows (a closed loop or a short). */
  xray?: { reached: readonly Clip[]; flowing: boolean; fast: boolean } | null;
}

export interface CircuitWorld {
  root: THREE.Group;
  tick(dt: number, state: CircuitSceneState): void;
  pickPoint(target: CircuitTarget): THREE.Vector3;
  targetFromHit(obj: THREE.Object3D): CircuitTarget | null;
  dispose(): void;
}

export const CIRCUIT_VIEW = { t: new THREE.Vector3(0.3, 0.4, 0.2), r: 17.5, ph: 0.85, th: 0.0 };

const POST_TOP = 0.75;
const BATTERY = { x: -3.4, z: -0.2 };
/** Where each load's holder stands, by its place in the list and how many loads are on the table. */
const SLOTS: Record<number, Array<[number, number]>> = { 1: [[2.4, -0.4]], 2: [[1.4, -1.6], [4.0, 1.2]], 3: [[0.9, -1.9], [3.8, -1.2], [4.0, 1.5]] };
function bulbPlace(bulbs: readonly BulbColor[], b: BulbColor): THREE.Vector3 {
  const [x, z] = (SLOTS[bulbs.length] ?? SLOTS[3])[Math.max(0, bulbs.indexOf(b))];
  return new THREE.Vector3(x, 0, z);
}
const SWITCH_AT = new THREE.Vector3(-0.4, 0, 1.9);
/** A clip post's base on the table. */
function postAt(bulbs: readonly BulbColor[], clip: Clip): THREE.Vector3 {
  if (clip === 'sw.left' || clip === 'sw.right') return SWITCH_AT.clone().add(new THREE.Vector3(clip === 'sw.left' ? -0.8 : 0.8, 0, 0.45));
  if (clip === 'bat+') return new THREE.Vector3(BATTERY.x + 1.55, 0, BATTERY.z + 1.05);
  if (clip === 'bat-') return new THREE.Vector3(BATTERY.x - 1.55, 0, BATTERY.z + 1.05);
  const [b, side] = clip.split('.') as [BulbColor, 'left' | 'right'];
  return bulbPlace(bulbs, b).add(new THREE.Vector3(side === 'left' ? -0.75 : 0.75, 0, 0.55));
}

const GLASS: Partial<Record<BulbColor, number>> = { red: 0xff6b5e, blue: 0x6aa8ff };
const WIRE_COLORS = [0x2fb34a, 0xf2c230, 0xef7f2c, 0x9b5cd6, 0x3fb7c9];

function labelSprite(text: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = 'rgba(15,23,42,0.75)'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = color; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(0.55, 0.55, 1);
  return s;
}

/** One test thing's meshes, lying flat, centred on the pad. */
function buildCondThing(t: Pick<CondThing, 'shape' | 'color'> & { shiny?: boolean; material: string }): THREE.Group {
  const g = new THREE.Group();
  const metal = ['metal', 'iron', 'aluminium', 'copper', 'brass'].includes(t.material);
  const m = new THREE.MeshStandardMaterial({ color: t.color, roughness: t.shiny ?? metal ? 0.22 : 0.85, metalness: metal ? 0.85 : 0.1 });
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); mesh.castShadow = true; g.add(mesh);
  };
  const H = Math.PI / 2;
  switch (t.shape) {
    case 'spoon': add(new THREE.SphereGeometry(0.3, 16, 10).scale(1, 0.25, 0.7), -0.55, 0.06); add(new THREE.BoxGeometry(1.1, 0.06, 0.12), 0.3, 0.06); break;
    case 'coin': add(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 24), 0, 0.04); break;
    case 'key': add(new THREE.TorusGeometry(0.2, 0.07, 8, 16), -0.5, 0.06, 0, H); add(new THREE.BoxGeometry(0.9, 0.06, 0.12), 0.2, 0.06); break;
    case 'foil': add(new THREE.IcosahedronGeometry(0.4, 0).scale(1.6, 0.25, 1), 0, 0.1); break;
    case 'clip': add(new THREE.TorusGeometry(0.28, 0.04, 6, 20).scale(1.8, 1, 1), 0, 0.05, 0, H); break;
    case 'nail': add(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 10), 0, 0.08, 0, 0, 0, H); add(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14), -0.66, 0.08, 0, 0, 0, H); break;
    case 'eraser': add(new THREE.BoxGeometry(0.9, 0.25, 0.45), 0, 0.13); break;
    case 'block': add(new THREE.BoxGeometry(1.0, 0.4, 0.5), 0, 0.2); break;
    case 'straw': add(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 10), 0, 0.08, 0, 0, 0, H); break;
    case 'button': add(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), 0, 0.05); break;
    case 'card': add(new THREE.BoxGeometry(1.2, 0.02, 0.7), 0, 0.02); break;
    case 'yarn': add(new THREE.TorusGeometry(0.35, 0.05, 6, 24).scale(2, 1, 1), 0, 0.05, 0, H); break;
    case 'marble': add(new THREE.SphereGeometry(0.28, 20, 14), 0, 0.28); break;
    case 'lead': add(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 8), 0, 0.06, 0, 0, 0, H); break;
  }
  return g;
}

/** The test gap's two clips on the pad (conductor_test). */
export const GAP = { a: new THREE.Vector3(-0.85, 0, 2.3), b: new THREE.Vector3(0.85, 0, 2.3) };

/** Two bar magnets end to end (magnet_poles); the right magnet's striped end, when its letters rubbed off. */
export interface PoleBench { aEnd: Pole; mystery: boolean; striped?: Pole }
const POLE = { z: 0.6, y: 0.4, half: 1.7, aX: -2.6, rest: 3.4, near: 2.2 };
const POLE_TOUCH = POLE.aX + 2 * POLE.half + 0.02;

/** One or two rulers, each with a bar magnet (magnet_distance). */
export interface DistBench { magnets: ReadonlyArray<{ size: MagnetSize }> }
const DIST = { magEnd: -3.0, step: 1.3, park: 5.6, ballR: 0.42 };
const distLanes = (n: number) => (n > 1 ? [-0.9, 2.1] : [0.6]);
const markX = (mark: number) => DIST.magEnd + DIST.step * mark;
const magHalf = (size: MagnetSize) => (size === 'big' ? 1.4 : 0.75);

export function buildWorkbench(bulbs: readonly BulbColor[], opts: { gap?: boolean; switch?: boolean; magnet?: boolean; poles?: PoleBench | null; dist?: DistBench | null; electro?: ElectroBench | null } = {}): CircuitWorld {
  const root = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  // Table and light.
  const wood = keep(new THREE.MeshStandardMaterial({ color: 0xb98652, roughness: 0.85 }));
  const top = new THREE.Mesh(keep(new THREE.BoxGeometry(13, 0.4, 7.5)), wood);
  top.position.y = -0.2; top.receiveShadow = true;
  root.add(top);
  root.add(new THREE.HemisphereLight(0xffffff, 0x8a6a4a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(4, 9, 6); sun.castShadow = true;
  root.add(sun);

  // Battery in its holder.
  const battery = new THREE.Group();
  battery.position.set(BATTERY.x, 0.62, BATTERY.z);
  const body = keep(new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.3, emissive: 0x000000 }));
  const cell = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 28)), body);
  cell.rotation.z = Math.PI / 2; cell.castShadow = true;
  battery.add(cell);
  const band = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.56, 0.56, 0.8, 28)), keep(new THREE.MeshStandardMaterial({ color: 0xc7862f, metalness: 0.6, roughness: 0.3 })));
  band.rotation.z = Math.PI / 2; band.position.x = 0.9;
  battery.add(band);
  const nub = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 16)), keep(new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.9, roughness: 0.2 })));
  nub.rotation.z = Math.PI / 2; nub.position.x = 1.37;
  battery.add(nub);
  const holder = new THREE.Mesh(keep(new THREE.BoxGeometry(3.4, 0.25, 1.3)), keep(new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.7 })));
  holder.position.set(BATTERY.x, 0.12, BATTERY.z); holder.receiveShadow = true;
  root.add(holder, battery);
  // A magnet item has no circuit: the battery stays off the table.
  const noCircuit = !!opts.magnet || !!opts.poles || !!opts.dist || !!opts.electro;
  holder.visible = battery.visible = !noCircuit;
  const plusLabel = labelSprite('+', '#ff6b6b'), minusLabel = labelSprite('−', '#e2e8f0');
  plusLabel.position.set(BATTERY.x + 1.0, 1.55, BATTERY.z); minusLabel.position.set(BATTERY.x - 1.0, 1.55, BATTERY.z);
  root.add(plusLabel, minusLabel);
  plusLabel.visible = minusLabel.visible = !noCircuit;
  disposables.push(plusLabel.material.map!, plusLabel.material, minusLabel.material.map!, minusLabel.material);

  // Bulbs in holders.
  const bulbParts = new Map<BulbColor, { glass: THREE.MeshStandardMaterial; light: THREE.PointLight; bulb: THREE.Mesh; filament: THREE.Mesh }>();
  const oneBulb = bulbs.filter(isBulb).length === 1;
  /** A motor's fan (spins while on) and a buzzer's disc (shakes while on). */
  const movers = new Map<BulbColor, THREE.Object3D>();
  for (const b of bulbs.filter(x => !isBulb(x))) {
    const at = bulbPlace(bulbs, b);
    const base = new THREE.Mesh(keep(new THREE.BoxGeometry(2.0, 0.3, 1.5)), keep(new THREE.MeshStandardMaterial({ color: 0x4a5160, roughness: 0.7 })));
    base.position.set(at.x, 0.15, at.z + 0.2); base.receiveShadow = true;
    root.add(base);
    if (b === 'motor') {
      const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 20)), keep(new THREE.MeshStandardMaterial({ color: 0xc7862f, metalness: 0.6, roughness: 0.35 })));
      // The motor points at the viewer, so its fan faces the camera.
      body.rotation.x = Math.PI / 2; body.position.set(at.x, 1.1, at.z);
      const fan = new THREE.Group();
      fan.position.set(at.x, 1.1, at.z + 0.5);
      const bladeGeo = keep(new THREE.BoxGeometry(0.26, 0.8, 0.04)), bladeMat = keep(new THREE.MeshStandardMaterial({ color: 0x3fb7c9 }));
      for (let k = 0; k < 3; k++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 0.38; const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI * 2) / 3; arm.add(blade); fan.add(arm);
      }
      const stand = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 12)), keep(new THREE.MeshStandardMaterial({ color: 0x5a6070 })));
      stand.position.set(at.x, 0.7, at.z);
      root.add(stand, body, fan);
      movers.set(b, fan);
    } else {
      const disc = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 24)), keep(new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.6 })));
      disc.position.set(at.x, 0.5, at.z);
      const grille = new THREE.Mesh(keep(new THREE.TorusGeometry(0.3, 0.04, 6, 20)), keep(new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7 })));
      grille.rotation.x = Math.PI / 2; grille.position.set(at.x, 0.66, at.z);
      const g = new THREE.Group(); g.add(disc, grille);
      root.add(g);
      movers.set(b, g);
    }
  }
  for (const b of bulbs.filter(isBulb)) {
    const at = bulbPlace(bulbs, b);
    const base = new THREE.Mesh(keep(new THREE.BoxGeometry(2.0, 0.3, 1.5)), keep(new THREE.MeshStandardMaterial({ color: 0x4a5160, roughness: 0.7 })));
    base.position.set(at.x, 0.15, at.z + 0.2); base.receiveShadow = true;
    const socket = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 20)), keep(new THREE.MeshStandardMaterial({ color: 0xc0c6cc, metalness: 0.85, roughness: 0.25 })));
    socket.position.set(at.x, 0.55, at.z);
    const glass = keep(new THREE.MeshStandardMaterial({ color: oneBulb ? 0xfff4d6 : GLASS[b]!, transparent: true, opacity: 0.55,
      roughness: 0.05, emissive: oneBulb ? 0xffd46b : GLASS[b]!, emissiveIntensity: 0 }));
    const bulb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.55, 28, 20)), glass);
    bulb.position.set(at.x, 1.25, at.z); bulb.castShadow = true;
    const filament = new THREE.Mesh(keep(new THREE.TorusGeometry(0.14, 0.02, 6, 16)), keep(new THREE.MeshBasicMaterial({ color: 0x5c4a2a })));
    filament.position.set(at.x, 1.2, at.z);
    const light = new THREE.PointLight(oneBulb ? 0xffd46b : GLASS[b]!, 0, 7);
    light.position.set(at.x, 1.3, at.z);
    root.add(base, socket, bulb, filament, light);
    bulbParts.set(b, { glass, light, bulb, filament });
  }

  // Clip posts: the tappable things.
  const clips: Clip[] = noCircuit ? [] : ['bat+', 'bat-', ...bulbs.flatMap(b => [`${b}.left`, `${b}.right`] as Clip[]), ...(opts.switch ? ['sw.left', 'sw.right'] as Clip[] : [])];
  const postGeo = keep(new THREE.CylinderGeometry(0.2, 0.24, POST_TOP, 16));
  const postMats = {
    'bat+': keep(new THREE.MeshStandardMaterial({ color: 0xd8423a, roughness: 0.4, metalness: 0.3 })),
    'bat-': keep(new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.4, metalness: 0.3 })),
    bulb: keep(new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.3, metalness: 0.8 })),
  };
  const posts = new Map<Clip, THREE.Mesh>();
  for (const clip of clips) {
    const mat = clip === 'bat+' ? postMats['bat+'] : clip === 'bat-' ? postMats['bat-'] : postMats.bulb;
    const post = new THREE.Mesh(postGeo, mat);
    const at = postAt(bulbs, clip);
    post.position.set(at.x, POST_TOP / 2, at.z);
    post.userData.target = `clip:${clip}`;
    post.castShadow = true;
    root.add(post);
    posts.set(clip, post);
  }
  const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.36, 0.06, 8, 28)), keep(new THREE.MeshBasicMaterial({ color: 0xfff27a })));
  ring.rotation.x = Math.PI / 2; ring.visible = false;
  root.add(ring);

  // The switch: a base, and a metal lever hinged on its left clip that drops onto the right clip when on.
  const lever = new THREE.Group();
  if (opts.switch) {
    const base = new THREE.Mesh(keep(new THREE.BoxGeometry(2.3, 0.2, 1.3)), keep(new THREE.MeshStandardMaterial({ color: 0x2f5f8a, roughness: 0.7 })));
    base.position.set(SWITCH_AT.x, 0.1, SWITCH_AT.z + 0.3); base.receiveShadow = true;
    const hinge = postAt(bulbs, 'sw.left');
    lever.position.set(hinge.x, POST_TOP + 0.05, hinge.z);
    const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(1.7, 0.08, 0.2)), keep(new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.9, roughness: 0.2 })));
    bar.position.x = 0.8; bar.castShadow = true;
    const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.16, 14, 10)), keep(new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.6 })));
    knob.position.x = 1.65;
    lever.add(bar, knob);
    root.add(base, lever);
  }

  // The test gap: a pad, two clips, and the fixed wires to them from the bulb's right clip and the battery's − end.
  const gapThing = new THREE.Group();
  root.add(gapThing);
  let gapKey = '';
  if (opts.gap) {
    const pad = new THREE.Mesh(keep(new THREE.BoxGeometry(2.6, 0.08, 1.1)), keep(new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.9 })));
    pad.position.set(0, 0.04, GAP.a.z); pad.receiveShadow = true;
    root.add(pad);
    const jaw = keep(new THREE.MeshStandardMaterial({ color: 0xc0c6cc, metalness: 0.85, roughness: 0.25 }));
    const fixed: Array<[THREE.Vector3, THREE.Vector3, number]> = [
      // The battery's − end is on the left and the bulb on the right, so each goes to its own side of the pad.
      [postAt(bulbs, `${bulbs[0]}.right` as Clip).setY(POST_TOP), GAP.b.clone().setY(0.15), 0x2fb34a],
      [postAt(bulbs, 'bat-').setY(POST_TOP), GAP.a.clone().setY(0.15), 0xf2c230],
    ];
    for (const [a, b, color] of fixed) {
      const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 0.9;
      const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 32, 0.07, 8, false)),
        keep(new THREE.MeshStandardMaterial({ color, roughness: 0.5 })));
      const clipJaw = new THREE.Mesh(keep(new THREE.BoxGeometry(0.42, 0.16, 0.22)), jaw);
      clipJaw.position.copy(b);
      root.add(tube, clipJaw);
    }
  }
  // The magnet test: a pad with a red horseshoe magnet held above it.
  const MAG_Y = 2.2;
  if (opts.magnet) {
    const pad = new THREE.Mesh(keep(new THREE.BoxGeometry(2.6, 0.08, 1.4)), keep(new THREE.MeshStandardMaterial({ color: 0xe8dfc8, roughness: 0.9 })));
    pad.position.set(0, 0.04, GAP.a.z); pad.receiveShadow = true;
    const red = keep(new THREE.MeshStandardMaterial({ color: 0xd8423a, roughness: 0.4 })), tip = keep(new THREE.MeshStandardMaterial({ color: 0xc9d1d9, metalness: 0.8, roughness: 0.3 }));
    const arc = new THREE.Mesh(keep(new THREE.TorusGeometry(0.5, 0.16, 10, 24, Math.PI)), red);
    arc.position.set(0, MAG_Y + 0.75, GAP.a.z);
    const legGeo = keep(new THREE.BoxGeometry(0.32, 0.6, 0.32)), tipGeo = keep(new THREE.BoxGeometry(0.32, 0.18, 0.32));
    for (const x of [-0.5, 0.5]) {
      const leg = new THREE.Mesh(legGeo, red); leg.position.set(x, MAG_Y + 0.45, GAP.a.z);
      const end = new THREE.Mesh(tipGeo, tip); end.position.set(x, MAG_Y + 0.08, GAP.a.z);
      root.add(leg, end);
    }
    root.add(pad, arc);
  }
  // Magnet poles: two bar magnets, N half red and S half blue with their letters; the right one's letters rubbed off on a
  // mystery item (both halves grey, a yellow stripe on one end).
  const poleA = new THREE.Group(), poleB = new THREE.Group();
  if (opts.poles) {
    const P = opts.poles;
    const halfGeo = keep(new THREE.BoxGeometry(POLE.half, 0.7, 0.95));
    const mats = { N: keep(new THREE.MeshStandardMaterial({ color: 0xd8423a, roughness: 0.45 })), S: keep(new THREE.MeshStandardMaterial({ color: 0x3a6fd8, roughness: 0.45 })),
      plain: keep(new THREE.MeshStandardMaterial({ color: 0x8c949c, roughness: 0.4, metalness: 0.5 })) };
    /** A bar magnet whose local +x end is `front`. */
    const bar = (g: THREE.Group, front: Pole, target: CircuitTarget, plain: boolean) => {
      for (const [p, sx] of [[front, 1], [front === 'N' ? 'S' : 'N', -1]] as Array<[Pole, number]>) {
        const m = new THREE.Mesh(halfGeo, plain ? mats.plain : mats[p]);
        m.position.x = (sx * POLE.half) / 2; m.castShadow = true; m.userData.target = target;
        g.add(m);
        if (plain) continue;
        const label = labelSprite(p, '#ffffff');
        label.position.set((sx * POLE.half) / 2, 0.75, 0); label.scale.setScalar(0.8);
        disposables.push(label.material.map!, label.material);
        g.add(label);
      }
    };
    bar(poleA, P.aEnd, 'mag:a', false);
    poleA.position.set(POLE.aX, POLE.y, POLE.z);
    // The right magnet: N at local +x; turned (rotation.y = pi) its N end faces the left magnet.
    bar(poleB, 'N', 'mag:b', P.mystery);
    if (P.mystery && P.striped) {
      const stripe = new THREE.Mesh(keep(new THREE.BoxGeometry(0.2, 0.72, 0.97)), keep(new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 })));
      stripe.position.x = (P.striped === 'N' ? 1 : -1) * (POLE.half - 0.3);
      stripe.userData.target = 'mag:b';
      poleB.add(stripe);
    }
    poleB.position.set(POLE.rest, POLE.y, POLE.z);
    root.add(poleA, poleB);
  }
  let poleTestN = -1, poleT = 0;
  // Magnet distance: per ruler a bar magnet (N red, S blue; the big one longer and taller), the ruler with a plate per
  // mark and its number, and a steel ball.
  const distMags: THREE.Group[] = [], distBalls: THREE.Mesh[] = [], distPlates: THREE.MeshStandardMaterial[][] = [];
  const ballV: number[] = [];
  if (opts.dist) {
    const lanes = distLanes(opts.dist.magnets.length);
    const red = keep(new THREE.MeshStandardMaterial({ color: 0xd8423a, roughness: 0.45 })), blue = keep(new THREE.MeshStandardMaterial({ color: 0x3a6fd8, roughness: 0.45 }));
    const rulerMat = keep(new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.8 }));
    const steel = keep(new THREE.MeshStandardMaterial({ color: 0xe3e8ee, metalness: 0.45, roughness: 0.25 }));
    const plateGeo = keep(new THREE.BoxGeometry(0.7, 0.05, 1.0)), ballGeo = keep(new THREE.SphereGeometry(DIST.ballR, 24, 16));
    opts.dist.magnets.forEach((m, r) => {
      const z = lanes[r];
      const half = magHalf(m.size), h = m.size === 'big' ? 1.0 : 0.55, d = m.size === 'big' ? 1.2 : 0.7;
      const g = new THREE.Group(), halfGeo = keep(new THREE.BoxGeometry(half, h, d));
      for (const [p, sx] of [['N', 1], ['S', -1]] as Array<[Pole, number]>) {
        const mesh = new THREE.Mesh(halfGeo, p === 'N' ? red : blue);
        mesh.position.set((sx * half) / 2, h / 2, 0); mesh.castShadow = true; mesh.userData.target = r ? 'mag:b' : 'mag:a';
        const label = labelSprite(p, '#ffffff');
        label.position.set((sx * half) / 2, h + 0.3, 0); label.scale.setScalar(m.size === 'big' ? 0.9 : 0.65);
        disposables.push(label.material.map!, label.material);
        g.add(mesh, label);
      }
      g.position.set(DIST.magEnd - half, 0, z);
      const ruler = new THREE.Mesh(keep(new THREE.BoxGeometry(markX(MARKS) - DIST.magEnd + 0.5, 0.05, 1.2)), rulerMat);
      ruler.position.set((DIST.magEnd + markX(MARKS) + 0.5) / 2, 0.025, z); ruler.receiveShadow = true;
      const plates: THREE.MeshStandardMaterial[] = [];
      for (let k = 1; k <= MARKS; k++) {
        const mat = keep(new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.7 }));
        const plate = new THREE.Mesh(plateGeo, mat);
        plate.position.set(markX(k), 0.06, z); plate.userData.target = `mark:${r}:${k}`;
        const num = labelSprite(String(k), '#fde68a');
        num.position.set(markX(k), 0.3, z + 1.0); num.scale.setScalar(0.7);
        disposables.push(num.material.map!, num.material);
        plates.push(mat); root.add(plate, num);
      }
      const ball = new THREE.Mesh(ballGeo, steel);
      ball.position.set(DIST.park, DIST.ballR + 0.05, z); ball.castShadow = true;
      distMags.push(g); distBalls.push(ball); distPlates.push(plates); ballV.push(0);
      root.add(g, ruler, ball);
    });
  }
  let distTestN = -1, distT = 9;
  // The electromagnet bench draws its own battery, switch and wires.
  const electro = opts.electro ? buildElectroBench(opts.electro, keep) : null;
  if (electro) root.add(electro.root);

  function setGapThing(t: CondThing | MagnetThing | null | undefined) {
    const key = t?.key ?? '';
    if (key === gapKey) return;
    gapKey = key;
    for (const child of [...gapThing.children]) {
      gapThing.remove(child);
      child.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    }
    if (t) { const g = buildCondThing(t); g.position.set(0, 0.08, GAP.a.z); gapThing.add(g); }
  }

  // Wires: rebuilt when the set changes.
  const wireGroup = new THREE.Group();
  root.add(wireGroup);
  let wiresKey = '';
  /** Each drawn wire's curve and clips, for the x-ray dots. */
  let curves: Array<{ curve: THREE.Curve<THREE.Vector3>; clips: Wire }> = [];
  const dotGroup = new THREE.Group();
  root.add(dotGroup);
  const dotGeo = keep(new THREE.SphereGeometry(0.075, 10, 8));
  const dotMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff27a }));
  const DOTS = 6;
  let dotsKey = '';
  let dotWires: Array<{ curve: THREE.Curve<THREE.Vector3>; dots: THREE.Mesh[] }> = [];
  function setDots(x: CircuitSceneState['xray']) {
    const key = x ? `${wiresKey}|${[...x.reached].sort().join()}` : '';
    if (key === dotsKey) return;
    dotsKey = key;
    dotGroup.clear(); dotWires = [];
    if (!x) return;
    for (const c of curves) {
      if (!x.reached.includes(c.clips[0])) continue;
      const dots = Array.from({ length: DOTS }, () => new THREE.Mesh(dotGeo, dotMat));
      dots.forEach(d => dotGroup.add(d));
      dotWires.push({ curve: c.curve, dots });
    }
  }
  const top3 = (clip: Clip) => postAt(bulbs, clip).setY(POST_TOP);
  function setWires(wires: readonly Wire[], loose: Wire | null = null) {
    const key = wires.map(w => w.join('~')).join('|') + (loose ? `|loose:${loose.join('~')}` : '');
    if (key === wiresKey) return;
    wiresKey = key;
    curves = [];
    for (const child of [...wireGroup.children]) {
      wireGroup.remove(child);
      const m = child as THREE.Mesh;
      m.geometry.dispose(); (m.material as THREE.Material).dispose();
    }
    wires.forEach((w, i) => {
      const a = top3(w[0]), b = top3(w[1]);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 0.6 + a.distanceTo(b) * 0.12;
      // Wires that share a pair of posts sit side by side.
      mid.z += (i % 2 ? 0.25 : -0.25);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      curves.push({ curve, clips: w });
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.07, 8, false),
        new THREE.MeshStandardMaterial({ color: WIRE_COLORS[i % WIRE_COLORS.length], roughness: 0.5 }));
      tube.castShadow = true;
      wireGroup.add(tube);
    });
    if (loose) {
      const a = top3(loose[0]), end = postAt(bulbs, loose[1]).add(new THREE.Vector3(0.7, 0.07, 0.9));
      const mid = a.clone().add(end).multiplyScalar(0.5);
      mid.y += 0.5;
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, end), 32, 0.07, 8, false),
        new THREE.MeshStandardMaterial({ color: WIRE_COLORS[wires.length % WIRE_COLORS.length], roughness: 0.5 }));
      const clipEnd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0xc0c6cc, metalness: 0.8, roughness: 0.3 }));
      clipEnd.position.copy(end);
      wireGroup.add(tube, clipEnd);
    }
  }

  let t = 0;
  return {
    root,
    tick(dt, s) {
      t += dt;
      setWires(s.wires, s.loose ?? null);
      setGapThing(s.inGap ?? s.held);
      if (opts.magnet) gapThing.position.y = THREE.MathUtils.damp(gapThing.position.y, s.stuck ? MAG_Y - 0.25 : 0, 6, dt);
      if (opts.poles && s.poles) {
        const want = s.poles.facing === 'N' ? Math.PI : 0;
        poleB.rotation.y = THREE.MathUtils.damp(poleB.rotation.y, want, 8, dt);
        const test = s.poles.test;
        if (test && test.n !== poleTestN) { poleTestN = test.n; poleT = 0; }
        poleT += dt;
        let x = POLE.rest;
        if (test && test.result === 'pull') x = POLE.rest + (POLE_TOUCH - POLE.rest) * Math.min(1, (poleT / 0.7) ** 2);
        else if (test) {
          // Slid up close, then pushed away, overshooting and settling back.
          x = poleT < 0.5 ? POLE.rest + (POLE.near - POLE.rest) * (poleT / 0.5)
            : poleT < 0.85 ? POLE.near + (POLE.rest + 0.5 - POLE.near) * ((poleT - 0.5) / 0.35)
              : POLE.rest + 0.5 * Math.max(0, 1 - (poleT - 0.85) / 0.6);
          poleA.position.x = POLE.aX - (poleT > 0.45 && poleT < 0.85 ? 0.06 * Math.sin((poleT - 0.45) * 40) : 0);
        }
        if (!test) x = THREE.MathUtils.damp(poleB.position.x, POLE.rest, 6, dt);
        poleB.position.x = x;
      }
      if (opts.dist && s.dist) {
        const d = s.dist;
        if (d.test && d.test.n !== distTestN) { distTestN = d.test.n; distT = 0; }
        distT += dt;
        distBalls.forEach((ball, r) => {
          const b = d.balls[r] ?? { mark: null, stuck: false };
          if (b.stuck) {
            // Pulled: the ball speeds up as it nears the magnet, then sticks.
            ballV[r] += 14 * dt;
            ball.position.x = Math.max(DIST.magEnd + DIST.ballR + 0.02, ball.position.x - ballV[r] * dt);
          } else {
            ballV[r] = 0;
            ball.position.x = THREE.MathUtils.damp(ball.position.x, b.mark == null ? DIST.park : markX(b.mark), 10, dt);
          }
          ball.rotation.z = -ball.position.x / DIST.ballR;
          // A try jiggles the magnet, pull or not.
          const tried = d.test?.ruler === r && distT < 0.35;
          distMags[r].position.x = DIST.magEnd - magHalf(opts.dist!.magnets[r].size) + (tried ? 0.05 * Math.sin(distT * 60) : 0);
          distPlates[r].forEach((mat, k) => {
            const hit = d.marks?.filter(x => x.ruler === r && x.mark === k + 1) ?? [];
            mat.color.setHex(!hit.length ? 0xf6f1e4 : hit.some(x => x.pulled) ? 0x3fbf6a : 0x7b8494);
          });
        });
      }
      if (electro && s.electro) electro.tick(dt, s.electro);
      setDots(s.xray ?? null);
      if (s.xray) {
        const speed = s.xray.flowing ? (s.xray.fast ? 1.6 : 0.45) : 0;
        for (const dw of dotWires) dw.dots.forEach((d, i) => d.position.copy(dw.curve.getPoint(((i / DOTS) + t * speed) % 1)));
      }
      if (opts.switch) lever.rotation.z = THREE.MathUtils.damp(lever.rotation.z, s.switchOn ? 0 : 0.7, 10, dt);
      for (const [b, p] of Array.from(bulbParts)) {
        const on = s.powered && s.lit.includes(b);
        const isOut = !!s.out?.includes(b);
        p.bulb.visible = !isOut; p.filament.visible = !isOut;
        const k = THREE.MathUtils.damp(p.glass.emissiveIntensity, on && !isOut ? (s.dim?.includes(b) ? 1.1 : 3.2) : 0, 8, dt);
        p.glass.emissiveIntensity = k;
        p.glass.opacity = 0.55 + 0.35 * Math.min(1, k / 3.2);
        p.light.intensity = k * 6;
      }
      for (const [b, m] of Array.from(movers)) {
        const on = s.powered && s.lit.includes(b) && !s.out?.includes(b);
        if (b === 'motor') m.rotation.z += on ? dt * 14 : 0;
        else m.position.y = on ? 0.03 * Math.sin(t * 60) : 0;
      }
      const warm = s.powered && s.short;
      body.emissive.setHex(warm ? 0xff6a1a : 0x000000);
      body.emissiveIntensity = warm ? 0.45 + 0.35 * Math.sin(t * 6) : 0;
      if (s.selected && posts.has(s.selected)) {
        const at = postAt(bulbs, s.selected);
        ring.visible = true; ring.position.set(at.x, POST_TOP + 0.05, at.z);
        ring.scale.setScalar(1 + 0.12 * Math.sin(t * 5));
      } else ring.visible = false;
    },
    pickPoint(target) {
      if (electro && (target.startsWith('em:') || target.startsWith('core:'))) return electro.pickPoint(target as ElectroTarget);
      if (opts.dist) {
        const lanes = distLanes(opts.dist.magnets.length);
        if (target === 'mag:a' || target === 'mag:b') return new THREE.Vector3(DIST.magEnd - 0.3, 0.35, lanes[target === 'mag:b' ? 1 : 0]);
        if (target.startsWith('mark:')) { const [, r, k] = target.split(':').map(Number); return new THREE.Vector3(markX(k), 0.08, lanes[r]); }
      }
      if (target === 'mag:a') return poleA.position.clone().setY(POLE.y + 0.3);
      if (target === 'mag:b') return poleB.position.clone().setY(POLE.y + 0.3);
      return postAt(bulbs, target.slice(5) as Clip).setY(POST_TOP * 0.8);
    },
    targetFromHit(obj) {
      return (obj.userData?.target as CircuitTarget | undefined) ?? null;
    },
    dispose() {
      setWires([]);
      setGapThing(null);
      disposables.forEach(d => d.dispose());
    },
  };
}
