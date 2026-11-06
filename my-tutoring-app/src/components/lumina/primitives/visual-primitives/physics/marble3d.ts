/**
 * The marble run, built in code with three.js (no model files): a long table with a wooden ramp on the left, its
 * numbered start pegs beside it, a flat run (with a carpet strip on hard items), a loop-the-loop and a bell at the far
 * end. The marble plays back the frames `marbleModel.ts` computed; the scene never decides where the marble goes.
 *
 * Tappable objects carry `userData.target`: a peg 'peg:<index>', the marble 'marble'. Everything else is looked through.
 */
import * as THREE from 'three';
import { MARBLE_R, rampXAt, type Frame, type LoopChallenge, type Outcome, type Track } from './marbleModel';

export type MarbleTarget = `peg:${number}` | 'marble';

export interface MarbleSceneState {
  /** The peg the marble sits on before a run. */
  peg: number | null;
  /** The run playing now (frames from the model), and a key that restarts it. */
  run: { frames: readonly Frame[]; outcome: Outcome; key: string } | null;
  /** The `loop_top_line` lever: a dashed line level with the top of the loop. */
  topLine?: boolean;
  /** The `peg_results` lever: per peg, true (made the loop), false (did not) or null (not run); null draws no rings. */
  pegMarks?: readonly (boolean | null)[] | null;
}

export interface MarbleWorld {
  root: THREE.Group;
  tick(dt: number, state: MarbleSceneState): void;
  /** Where a target is in world space (drives only). */
  pickPoint(target: MarbleTarget): THREE.Vector3;
  targetFromHit(obj: THREE.Object3D): MarbleTarget | null;
  dispose(): void;
}

export const MARBLE_VIEW = { t: new THREE.Vector3(-0.6, 1.9, 0), r: 14.5, ph: 1.25, th: 0 };

const PEG_COLORS = [0x5ec26a, 0x8fd14f, 0xc6d73f, 0xf2c230, 0xf5a524, 0xf08a2c, 0xe8603a, 0xd9433a];

function labelSprite(text: string, keep: (x: { dispose(): void }) => void): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = 'rgba(15,23,42,0.82)'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fde68a'; g.font = 'bold 76px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  }
  const map = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map, depthTest: false });
  keep(map); keep(mat);
  const s = new THREE.Sprite(mat);
  s.scale.set(0.42, 0.42, 1);
  return s;
}

export function buildMarbleRun(c: Pick<LoopChallenge, 'pegs' | 'loopR' | 'carpet'>, track: Track): MarbleWorld {
  const root = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const park = new THREE.Group();
  // Centre the run on the table.
  const span = track.bellX + 0.6;
  park.position.x = -span / 2;
  root.add(park);

  root.add(new THREE.HemisphereLight(0xffffff, 0x6a5a4a, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(4, 12, 8); sun.castShadow = true;
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
  root.add(sun);

  const table = new THREE.Mesh(keep(new THREE.BoxGeometry(span + 3, 0.4, 4.2)), keep(new THREE.MeshStandardMaterial({ color: 0xc8a06a, roughness: 0.85 })));
  table.position.set(0, -0.2, 0.2); table.receiveShadow = true;
  root.add(table);

  // Rails: two thin tubes along the track, either side of the marble.
  const wood = keep(new THREE.MeshStandardMaterial({ color: 0x9b6b3d, roughness: 0.7 }));
  const rail = keep(new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.35, metalness: 0.2 }));
  for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < track.x.length; i += 6) pts.push(new THREE.Vector3(track.x[i], track.y[i] + 0.02, track.z[i] + side * 0.11));
    pts.push(new THREE.Vector3(track.x[track.x.length - 1], 0.02, track.z[track.z.length - 1] + side * 0.11));
    const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.035, 6, false)), rail);
    tube.castShadow = true;
    park.add(tube);
  }
  // The ramp's wooden board under its rails, and posts holding it up.
  const boardPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 900; i += 30) boardPts.push(new THREE.Vector3(track.x[i], track.y[i] - 0.04, 0));
  const board = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(boardPts), 60, 0.06, 4, false)), wood);
  board.scale.z = 3;
  park.add(board);
  for (let x = 0.3; x < track.rampD - 0.8; x += 1.1) {
    const h = track.rampH * (1 - x / track.rampD) ** 2;
    const post = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, h, 0.1)), wood);
    post.position.set(x, h / 2, -0.2); post.castShadow = true;
    park.add(post);
  }
  // The loop's stand.
  const stand = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, track.loopR * 2, 0.12)), wood);
  stand.position.set(track.loopX, track.loopR, track.loopZ / 2 - 0.35);
  park.add(stand);

  if (track.marks.carpet) {
    const [a, b] = track.marks.carpet;
    const xa = track.x[track.s.findIndex(s => s >= a)], xb = track.x[track.s.findIndex(s => s >= b)];
    const carpet = new THREE.Mesh(keep(new THREE.BoxGeometry(xb - xa, 0.03, 0.6)), keep(new THREE.MeshStandardMaterial({ color: 0xb03a4a, roughness: 1 })));
    carpet.position.set((xa + xb) / 2, 0.0, 0); carpet.receiveShadow = true;
    park.add(carpet);
  }

  // The start pegs, beside the ramp, numbered from the bottom.
  const pegs: THREE.Mesh[] = [];
  const pegGeo = keep(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 16));
  c.pegs.forEach((h, i) => {
    const x = rampXAt(track, h);
    const mat = keep(new THREE.MeshStandardMaterial({ color: PEG_COLORS[i % PEG_COLORS.length], roughness: 0.5, emissive: 0x000000 }));
    const peg = new THREE.Mesh(pegGeo, mat);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(x, h + 0.1, -0.36);
    peg.userData.target = `peg:${i}`;
    peg.castShadow = true;
    park.add(peg);
    pegs.push(peg);
    const label = labelSprite(String(i + 1), keep);
    label.position.set(x - 0.32, h + 0.18, -0.6);
    park.add(label);
  });

  // The `loop_top_line` lever: dashes level with the top of the loop, from just left of the ramp to the loop.
  const topLine = new THREE.Group();
  const dashMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
  const dashGeo = keep(new THREE.BoxGeometry(0.2, 0.035, 0.035));
  const top = 2 * track.loopR;
  for (let x = rampXAt(track, top) - 0.7; x < track.loopX + track.loopR; x += 0.34) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(x, top, -0.36);
    topLine.add(dash);
  }
  topLine.visible = false;
  park.add(topLine);

  // The `peg_results` lever: a ring round each peg the learner ran from.
  const ringGeo = keep(new THREE.TorusGeometry(0.25, 0.045, 8, 24));
  const madeMat = keep(new THREE.MeshBasicMaterial({ color: 0x22c55e }));
  const missMat = keep(new THREE.MeshBasicMaterial({ color: 0xef4444 }));
  const rings = pegs.map(p => {
    const ring = new THREE.Mesh(ringGeo, madeMat);
    ring.position.copy(p.position); ring.position.z -= 0.02;
    ring.visible = false;
    park.add(ring);
    return ring;
  });

  // The bell at the far end.
  const bellPost = new THREE.Mesh(keep(new THREE.BoxGeometry(0.1, 1.3, 0.1)), wood);
  bellPost.position.set(track.bellX + 0.35, 0.65, track.loopZ);
  park.add(bellPost);
  const bellPivot = new THREE.Group();
  bellPivot.position.set(track.bellX + 0.2, 1.25, track.loopZ);
  const gold = keep(new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: 0.7, roughness: 0.3, emissive: 0x000000 }));
  const bell = new THREE.Mesh(keep(new THREE.ConeGeometry(0.22, 0.34, 18, 1, true)), gold);
  bell.position.y = -0.2; bell.material.side = THREE.DoubleSide;
  bellPivot.add(bell);
  park.add(bellPivot);

  const marble = new THREE.Mesh(keep(new THREE.SphereGeometry(MARBLE_R, 24, 18)),
    keep(new THREE.MeshPhysicalMaterial({ color: 0x3b82f6, roughness: 0.08, metalness: 0.1, clearcoat: 1, transmission: 0.2 })));
  marble.castShadow = true;
  marble.userData.target = 'marble';
  park.add(marble);
  const restAt = (h: number) => {
    const x = rampXAt(track, h);
    const i = Math.min(track.x.length - 1, Math.max(0, track.x.findIndex(v => v >= x)));
    return new THREE.Vector3(track.x[i] - track.ty[i] * MARBLE_R, track.y[i] + track.tx[i] * MARBLE_R, 0);
  };

  let runKey = '';
  let playhead = 0;
  let ring = 0;
  return {
    root,
    tick(dt, s) {
      topLine.visible = !!s.topLine;
      rings.forEach((r, i) => {
        const m = s.pegMarks?.[i];
        r.visible = m != null;
        if (m != null) r.material = m ? madeMat : missMat;
      });
      pegs.forEach((p, i) => {
        (p.material as THREE.MeshStandardMaterial).emissive.setHex(i === s.peg ? 0x5a4a10 : 0x000000);
      });
      if (!s.run) {
        runKey = ''; playhead = 0; ring = 0;
        marble.position.copy(s.peg == null ? restAt(c.pegs[c.pegs.length - 1] + 0.3) : restAt(c.pegs[s.peg]));
      } else {
        if (s.run.key !== runKey) { runKey = s.run.key; playhead = 0; ring = 0; }
        playhead = Math.min(s.run.frames.length - 1, playhead + dt * 60);
        const f = s.run.frames[Math.floor(playhead)];
        marble.position.set(f.x, f.y, f.z);
        marble.rotation.z -= dt * 8;
        if (playhead >= s.run.frames.length - 1 && s.run.outcome === 'made_it') ring += dt;
      }
      bellPivot.rotation.z = ring > 0 && ring < 2 ? Math.sin(ring * 18) * 0.5 * (1 - ring / 2) : 0;
      gold.emissive.setHex(ring > 0 && ring < 2 ? 0x664400 : 0x000000);
    },
    pickPoint(target) {
      const obj = target === 'marble' ? marble : pegs[Number(target.split(':')[1])];
      return obj.getWorldPosition(new THREE.Vector3());
    },
    targetFromHit(obj) {
      return (obj.userData?.target as MarbleTarget | undefined) ?? null;
    },
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}
