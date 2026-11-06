/**
 * The electromagnet bench (electromagnet), drawn into the workbench scene by `circuit3d.ts`: a battery (and a spare to
 * put in), a switch, a crane holding the core with its wraps of copper wire over a tray of paper clips, a tray of other
 * cores to swap, and the strength meter lever. `electroModel.ts` says how many clips a dip lifts; this file only draws.
 *
 * Tappable parts carry `userData.target`: 'em:coil' (the core: one more wrap), 'em:switch', 'em:battery' (the spare),
 * 'em:clips' (dip and lift), and 'core:<core>' on the core tray.
 */
import * as THREE from 'three';
import { MAX_TURNS, type Core, type ElectroBuild } from './electroModel';

export interface ElectroBench { spareBattery: boolean; coreTray: boolean }
export interface ElectroSceneState {
  build: ElectroBuild;
  /** The last dip: a new `n` lowers the core into the clips and lifts. */
  dip: { n: number } | null;
  /** Clips hanging from the core now (they drop when the build changes or the switch goes off). */
  hanging: number;
  /** The strength meter lever: 0..1 when drawn, else null. */
  meter: number | null;
}
export type ElectroTarget = 'em:coil' | 'em:switch' | 'em:battery' | 'em:clips' | `core:${Core}`;

const NAIL = { x: 2.4, z: 0.6, restY: 2.7, dipY: 1.25, half: 0.85, armY: 3.75 };
const TRAY = { x: 2.4, z: 0.6 };
const BAT = { x: -4.2, y: 0.5, z: 1.2, slot2: 2.3, spare: -1.6 };
const SW = { x: -1.2, z: 1.8 };
const CORE_TRAY = { x: 5.0, z: -1.6 };
const CORES: Core[] = ['steel', 'wood', 'aluminium'];
const METER = { x: 4.1, z: 0.6, h: 2.6 };

export function buildElectroBench(bench: ElectroBench, keep: <T extends { dispose(): void }>(x: T) => T) {
  const root = new THREE.Group();
  const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra }));
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, target?: ElectroTarget) => {
    const x = new THREE.Mesh(keep(geo), m); x.castShadow = true;
    if (target) x.userData.target = target;
    return x;
  };

  // Batteries: one in the holder, the spare beside the table (hard) until it is put in.
  const batteryMesh = (target?: ElectroTarget) => {
    const g = new THREE.Group();
    const cell = mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.0, 24), mat(0x2a2f3a, { metalness: 0.3 }), target);
    cell.rotation.z = Math.PI / 2;
    const band = mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.6, 24), mat(0xc7862f, { metalness: 0.6 }), target);
    band.rotation.z = Math.PI / 2; band.position.x = 0.7;
    g.add(cell, band);
    return g;
  };
  const holder = mesh(new THREE.BoxGeometry(2.6, 0.2, 2.4), mat(0x3d4450, { roughness: 0.7 }));
  holder.position.set(BAT.x, 0.1, (BAT.z + BAT.slot2) / 2);
  const bat1 = batteryMesh(); bat1.position.set(BAT.x, BAT.y, BAT.z);
  const spare = batteryMesh('em:battery'); spare.position.set(BAT.x, BAT.y, BAT.spare);
  spare.visible = bench.spareBattery;
  root.add(holder, bat1, spare);

  // The switch: a base and a lever, down (closed) when on.
  const swBase = mesh(new THREE.BoxGeometry(1.4, 0.2, 0.8), mat(0x4a5160), 'em:switch');
  swBase.position.set(SW.x, 0.1, SW.z);
  const lever = new THREE.Group(); lever.position.set(SW.x - 0.5, 0.25, SW.z);
  const bar = mesh(new THREE.BoxGeometry(1.1, 0.08, 0.16), mat(0xc0c6cc, { metalness: 0.8 }), 'em:switch');
  bar.position.x = 0.55; lever.add(bar);
  root.add(swBase, lever);

  // The crane: a post behind the clip tray and an arm over it; the core hangs from the arm.
  const post = mesh(new THREE.CylinderGeometry(0.12, 0.15, NAIL.armY + 0.1, 12), mat(0x5a6070));
  post.position.set(NAIL.x, (NAIL.armY + 0.1) / 2, NAIL.z - 1.4);
  const arm = mesh(new THREE.BoxGeometry(0.2, 0.2, 1.6), mat(0x5a6070));
  arm.position.set(NAIL.x, NAIL.armY, NAIL.z - 0.7);
  root.add(post, arm);

  // Wires, still: battery to switch, switch to the post foot, and the post foot back to the battery (they run up the
  // post to the coil).
  const copper = mat(0xd9822b, { metalness: 0.5, roughness: 0.35, emissive: 0x000000 });
  const tube = (pts: THREE.Vector3[]) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.05, 8, false), copper);
  root.add(
    tube([new THREE.Vector3(BAT.x + 1.0, 0.5, BAT.z), new THREE.Vector3(-2.6, 0.35, 1.9), new THREE.Vector3(SW.x - 0.6, 0.25, SW.z)]),
    tube([new THREE.Vector3(SW.x + 0.6, 0.25, SW.z), new THREE.Vector3(0.8, 0.3, 0.4), new THREE.Vector3(NAIL.x - 0.1, 0.2, NAIL.z - 1.35)]),
    tube([new THREE.Vector3(NAIL.x + 0.1, 0.2, NAIL.z - 1.35), new THREE.Vector3(-1.0, 0.2, -0.6), new THREE.Vector3(BAT.x - 1.0, 0.5, BAT.z)]),
  );

  // The core on the crane: one mesh per kind, shown for the build's core; the wraps are copper rings round it.
  const nail = new THREE.Group(); nail.position.set(NAIL.x, NAIL.restY, NAIL.z);
  const coreMesh = (c: Core, target?: ElectroTarget) => {
    const g = new THREE.Group();
    if (c === 'steel') {
      g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, NAIL.half * 2, 16), mat(0x9aa3ad, { metalness: 0.85, roughness: 0.3 }), target));
      const head = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), mat(0x9aa3ad, { metalness: 0.85, roughness: 0.3 }), target);
      head.position.y = NAIL.half; g.add(head);
      const tip = mesh(new THREE.ConeGeometry(0.13, 0.25, 16), mat(0x9aa3ad, { metalness: 0.85 }), target);
      tip.position.y = -NAIL.half - 0.12; tip.rotation.x = Math.PI; g.add(tip);
    } else if (c === 'wood') {
      g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, NAIL.half * 2, 6), mat(0xf2c230, { roughness: 0.8 }), target));
      const tip = mesh(new THREE.ConeGeometry(0.16, 0.3, 6), mat(0xe8c9a0, { roughness: 0.9 }), target);
      tip.position.y = -NAIL.half - 0.15; tip.rotation.x = Math.PI; g.add(tip);
    } else {
      g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, NAIL.half * 2, 16), mat(0xdfe4ea, { metalness: 0.6, roughness: 0.25 }), target));
    }
    return g;
  };
  const cores = new Map<Core, THREE.Group>(CORES.map(c => [c, coreMesh(c, 'em:coil')]));
  cores.forEach(g => nail.add(g));
  const ringGeo = keep(new THREE.TorusGeometry(0.22, 0.045, 8, 24));
  const rings: THREE.Mesh[] = [];
  for (let k = 0; k < MAX_TURNS; k++) {
    const r = new THREE.Mesh(ringGeo, copper); r.rotation.x = Math.PI / 2; r.position.y = -0.7 + k * 0.13;
    r.userData.target = 'em:coil'; rings.push(r); nail.add(r);
  }
  // The wire from the top wrap up to the arm.
  const lead = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), copper);
  lead.position.set(0.24, NAIL.half + 0.1, 0); nail.add(lead);
  // Clips hanging from the tip, three to a row, big enough to count.
  const clipGeo = keep(new THREE.TorusGeometry(0.11, 0.025, 6, 16));
  const hangGeo = keep(new THREE.TorusGeometry(0.15, 0.035, 6, 16));
  const clipMat = mat(0xc9d1d9, { metalness: 0.8, roughness: 0.3 });
  const hanging: THREE.Mesh[] = [];
  for (let k = 0; k < 12; k++) {
    const m = new THREE.Mesh(hangGeo, clipMat); m.scale.set(1, 1.6, 1);
    m.position.set(((k % 3) - 1) * 0.3, -NAIL.half - 0.42 - Math.floor(k / 3) * 0.42, 0); m.rotation.z = ((k % 3) - 1) * 0.35;
    m.visible = false; hanging.push(m); nail.add(m);
  }
  root.add(nail);

  // The clip tray.
  const tray = mesh(new THREE.BoxGeometry(1.8, 0.16, 1.4), mat(0x6b4f35, { roughness: 0.8 }), 'em:clips');
  tray.position.set(TRAY.x, 0.08, TRAY.z);
  root.add(tray);
  for (let k = 0; k < 16; k++) {
    const m = new THREE.Mesh(clipGeo, clipMat); m.scale.set(1, 1.7, 1); m.rotation.x = Math.PI / 2; m.rotation.z = k * 1.3;
    m.position.set(TRAY.x - 0.65 + (k % 4) * 0.43, 0.2, TRAY.z - 0.45 + Math.floor(k / 4) * 0.3);
    m.userData.target = 'em:clips'; root.add(m);
  }

  // The core tray (hard): the cores not on the crane, lying down.
  const trayCores = new Map<Core, THREE.Group>();
  if (bench.coreTray) {
    const ct = mesh(new THREE.BoxGeometry(2.8, 0.12, 1.9), mat(0x4a5160, { roughness: 0.8 }));
    ct.position.set(CORE_TRAY.x, 0.06, CORE_TRAY.z);
    root.add(ct);
    CORES.forEach((c, i) => {
      const g = coreMesh(c, `core:${c}`);
      g.rotation.z = Math.PI / 2; g.scale.setScalar(0.8);
      g.position.set(CORE_TRAY.x, 0.3, CORE_TRAY.z - 0.6 + i * 0.6);
      trayCores.set(c, g); root.add(g);
    });
  }

  // The strength meter lever: a frame and a fill.
  const meter = new THREE.Group(); meter.position.set(METER.x, 0, METER.z); meter.visible = false;
  const frame = mesh(new THREE.BoxGeometry(0.5, METER.h, 0.3), mat(0x23262b, { transparent: true, opacity: 0.5 }));
  frame.position.y = METER.h / 2;
  const fillMat = mat(0x3fbf6a, { emissive: 0x1f7a3c, emissiveIntensity: 0.6 });
  const fill = mesh(new THREE.BoxGeometry(0.38, 1, 0.34), fillMat);
  meter.add(frame, fill);
  root.add(meter);

  let dipN = -1, dipT = 9;
  return {
    root,
    tick(dt: number, s: ElectroSceneState) {
      const b = s.build;
      cores.forEach((g, c) => { g.visible = c === b.core; });
      trayCores.forEach((g, c) => { g.visible = c !== b.core; });
      rings.forEach((r, k) => { r.visible = k < b.turns; });
      const two = b.batteries === 2;
      spare.position.z = THREE.MathUtils.damp(spare.position.z, two ? BAT.slot2 : BAT.spare, 8, dt);
      lever.rotation.z = THREE.MathUtils.damp(lever.rotation.z, b.on ? 0 : 0.7, 10, dt);
      // Current flowing: the copper glows a little.
      copper.emissive.setHex(b.on ? 0xff7a1a : 0x000000);
      copper.emissiveIntensity = b.on ? 0.35 : 0;
      if (s.dip && s.dip.n !== dipN) { dipN = s.dip.n; dipT = 0; }
      dipT += dt;
      const down = dipT < 0.5 ? dipT / 0.5 : dipT < 1.1 ? 1 - (dipT - 0.5) / 0.6 : 0;
      nail.position.y = NAIL.restY - (NAIL.restY - NAIL.dipY) * Math.sin((down * Math.PI) / 2);
      const showing = dipT < 0.5 ? 0 : s.hanging;
      hanging.forEach((m, k) => { m.visible = k < showing; });
      meter.visible = s.meter !== null;
      const f = Math.max(0.02, Math.min(1, s.meter ?? 0));
      fill.scale.y = f * (METER.h - 0.1); fill.position.y = (f * (METER.h - 0.1)) / 2 + 0.05;
    },
    pickPoint(t: ElectroTarget): THREE.Vector3 {
      if (t === 'em:coil') return new THREE.Vector3(NAIL.x, nail.position.y, NAIL.z);
      if (t === 'em:switch') return new THREE.Vector3(SW.x + 0.3, 0.2, SW.z);
      if (t === 'em:battery') return spare.position.clone().setY(BAT.y + 0.3);
      if (t === 'em:clips') return new THREE.Vector3(TRAY.x + 0.6, 0.2, TRAY.z + 0.5);
      const g = trayCores.get(t.slice(5) as Core);
      return g ? g.position.clone() : new THREE.Vector3(CORE_TRAY.x, 0.3, CORE_TRAY.z);
    },
  };
}
