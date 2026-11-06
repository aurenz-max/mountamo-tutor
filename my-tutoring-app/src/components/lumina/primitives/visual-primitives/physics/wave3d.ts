/**
 * The wave tank, built in code with three.js (no model files): a long glass tank with grid squares on its back glass,
 * a hinged paddle at the left end and its knob box outside the glass (push size 1-5 on top, push speed 1-5 below), a
 * cork in the middle, and a sand beach at the right end with a block tower at the waterline. The water, the paddle and
 * the tower play back `waveModel.ts` (`waveAt`, `paddleAngle`, `runTiming`); the scene never decides what a wave does.
 *
 * Tappable objects carry `userData.target`: a knob 'size:<n>' or 'speed:<n>' (1-5), the paddle 'paddle'. Everything
 * else is looked through.
 */
import * as THREE from 'three';
import {
  LEVELS, PUSHES, REST, SQUARE, TOWER_X, WAVE_SPEED, amplitude, heightSquares, paddleAngle, runTiming, spacingSquares,
  waveAt, wavelength, type KnockChallenge,
} from './waveModel';

export type WaveTarget = `size:${number}` | `speed:${number}` | 'paddle';

export interface WaveSceneState {
  size: number;
  speed: number;
  /** The wave playing now, and a key that restarts it. */
  run: { size: number; speed: number; fell: boolean; key: string; /** How far a tower that stays up rocks (0-1). */ wobble: number } | null;
  /** The `crest_marks` lever: brackets for crest height and the gap to the next crest. */
  crestMarks?: boolean;
  /** The `changes_marked` lever: rings round the first wave's knobs. */
  startRings?: boolean;
}

export interface WaveWorld {
  root: THREE.Group;
  tick(dt: number, state: WaveSceneState): void;
  /** Where a target is in world space (drives only). */
  pickPoint(target: WaveTarget): THREE.Vector3;
  targetFromHit(obj: THREE.Object3D): WaveTarget | null;
  dispose(): void;
}

export const WAVE_VIEW = { t: new THREE.Vector3(0, 1.6, 0), r: 14.5, ph: 1.25, th: 0 };

const TANK_END = 14.4;
const HALF_Z = 1.15;
const TANK_H = 3.6;
const BEACH_X0 = 10;
const BEACH_SLOPE = 2.6 / (TANK_END - BEACH_X0);
const beachY = (x: number) => Math.max(0, (x - BEACH_X0) * BEACH_SLOPE);
const BOX_X = -1.9;
const KNOB_DX = 0.34;
const knobX = (n: number) => BOX_X + (n - 3) * KNOB_DX;
const SIZE_Y = 2.55;
const SPEED_Y = 1.55;
const BLOCK = 0.34;
const BLOCK_COLORS = [0xef6b5b, 0xf2c230, 0x5ec26a, 0x4f8fe8, 0xb07ad8, 0xf5a524];

function textSprite(keep: (x: { dispose(): void }) => void, w = 256, h = 96) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const map = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map, depthTest: false, transparent: true });
  keep(map); keep(mat);
  const s = new THREE.Sprite(mat);
  s.renderOrder = 10;
  const draw = (text: string, fg = '#fde68a', bg = 'rgba(15,23,42,0.82)') => {
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 20); g.fill();
    g.fillStyle = fg; g.font = `bold ${Math.round(h * 0.55)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
    map.needsUpdate = true;
  };
  return { sprite: s, draw };
}

export function buildWaveTank(c: Pick<KnockChallenge, 'start' | 'sizeCap' | 'blocks'>): WaveWorld {
  const root = new THREE.Group();
  const disposables: Array<{ dispose(): void }> = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };
  const lab = new THREE.Group();
  lab.position.x = -(TANK_END + BOX_X - 1) / 2;
  root.add(lab);

  root.add(new THREE.HemisphereLight(0xffffff, 0x6a5a4a, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(4, 12, 9); sun.castShadow = true;
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
  root.add(sun);

  const bench = new THREE.Mesh(keep(new THREE.BoxGeometry(TANK_END + 6, 0.4, 4)), keep(new THREE.MeshStandardMaterial({ color: 0xc8a06a, roughness: 0.85 })));
  bench.position.set(TANK_END / 2 - 1.6, -0.2, 0); bench.receiveShadow = true;
  lab.add(bench);

  // The glass: back, front, ends, floor; grid squares on the back glass.
  const glassMat = keep(new THREE.MeshStandardMaterial({ color: 0xd8eef5, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
  const long = keep(new THREE.PlaneGeometry(TANK_END + 0.6, TANK_H));
  for (const z of [-HALF_Z, HALF_Z]) {
    const pane = new THREE.Mesh(long, glassMat);
    pane.position.set(TANK_END / 2 - 0.3, TANK_H / 2, z);
    lab.add(pane);
  }
  const end = keep(new THREE.PlaneGeometry(HALF_Z * 2, TANK_H));
  for (const x of [-0.6, TANK_END]) {
    const pane = new THREE.Mesh(end, glassMat);
    pane.position.set(x, TANK_H / 2, 0); pane.rotation.y = Math.PI / 2;
    lab.add(pane);
  }
  const back = new THREE.Mesh(long, keep(new THREE.MeshStandardMaterial({ color: 0xeaf4f8, roughness: 0.9 })));
  back.position.set(TANK_END / 2 - 0.3, TANK_H / 2, -HALF_Z - 0.02);
  lab.add(back);
  const grid: number[] = [];
  for (let x = 0; x <= TANK_END - 0.01; x += SQUARE) grid.push(x, 0, 0, x, TANK_H, 0);
  for (let y = 0; y <= TANK_H + 0.01; y += SQUARE) grid.push(-0.6, y, 0, TANK_END, y, 0);
  const gridGeo = keep(new THREE.BufferGeometry());
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
  const gridLines = new THREE.LineSegments(gridGeo, keep(new THREE.LineBasicMaterial({ color: 0x8fb3c4, transparent: true, opacity: 0.55 })));
  gridLines.position.z = -HALF_Z + 0.01;
  lab.add(gridLines);
  const restLine = new THREE.Mesh(keep(new THREE.BoxGeometry(TANK_END + 0.6, 0.025, 0.01)), keep(new THREE.MeshBasicMaterial({ color: 0x1e5f7a })));
  restLine.position.set(TANK_END / 2 - 0.3, REST, -HALF_Z + 0.02);
  lab.add(restLine);

  // The beach: a sand wedge at the right end.
  const shape = new THREE.Shape([new THREE.Vector2(BEACH_X0, 0), new THREE.Vector2(TANK_END, 0), new THREE.Vector2(TANK_END, beachY(TANK_END))]);
  const sandGeo = keep(new THREE.ExtrudeGeometry(shape, { depth: HALF_Z * 2 - 0.04, bevelEnabled: false }));
  const sand = new THREE.Mesh(sandGeo, keep(new THREE.MeshStandardMaterial({ color: 0xe8cf94, roughness: 1 })));
  sand.position.z = -HALF_Z + 0.02; sand.receiveShadow = true;
  lab.add(sand);

  // The water: a top surface and front and back faces whose top edge follows the wave.
  const SEG = 288;
  const x0 = -0.5;
  const xs = Array.from({ length: SEG + 1 }, (_, i) => x0 + ((TANK_END - x0) * i) / SEG);
  const waterMat = keep(new THREE.MeshStandardMaterial({ color: 0x3aa6c4, roughness: 0.15, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
  const topMat = keep(new THREE.MeshStandardMaterial({ color: 0x6cc8e0, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  const topGeo = keep(new THREE.PlaneGeometry(1, HALF_Z * 2 - 0.04, SEG, 1));
  const faceGeo = keep(new THREE.PlaneGeometry(1, 1, SEG, 1));
  const top = new THREE.Mesh(topGeo, topMat);
  top.rotation.x = -Math.PI / 2; top.renderOrder = 3;
  const faces = [-HALF_Z + 0.03, HALF_Z - 0.03].map(z => {
    const m = new THREE.Mesh(faceGeo, waterMat);
    m.position.z = z; m.renderOrder = 2;
    return m;
  });
  lab.add(top, ...faces);
  const setWater = (eta: (x: number) => number) => {
    const tp = topGeo.attributes.position as THREE.BufferAttribute;
    const fp = faceGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= SEG; i++) {
      const y = REST + eta(xs[i]);
      // Plane rows: top row first. The top surface lies in x/-z after its rotation, so its local y is -z and z is height.
      for (const row of [0, 1]) {
        const k = row * (SEG + 1) + i;
        tp.setXYZ(k, xs[i], tp.getY(k), y);
        fp.setXYZ(k, xs[i], row === 0 ? y : 0, 0);
      }
    }
    tp.needsUpdate = true; fp.needsUpdate = true;
    topGeo.computeVertexNormals();
  };
  setWater(() => 0);

  // The paddle: a board hinged at the bottom of the left end.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.1, 0);
  const wood = keep(new THREE.MeshStandardMaterial({ color: 0x9b6b3d, roughness: 0.7, emissive: 0x000000 }));
  const board = new THREE.Mesh(keep(new THREE.BoxGeometry(0.12, 3.1, HALF_Z * 2 - 0.12)), wood);
  board.position.y = 1.55; board.castShadow = true;
  board.userData.target = 'paddle';
  hinge.add(board);
  const handle = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 10)), wood);
  handle.position.set(-0.3, 3.3, 0); handle.rotation.z = Math.PI / 2;
  handle.userData.target = 'paddle';
  hinge.add(handle);
  lab.add(hinge);

  // The knob box, outside the glass.
  const box = new THREE.Mesh(keep(new THREE.BoxGeometry(LEVELS * KNOB_DX + 0.4, 2.4, 0.5)), keep(new THREE.MeshStandardMaterial({ color: 0x37465a, roughness: 0.6 })));
  box.position.set(BOX_X, 2.05, 0.6); box.castShadow = true;
  lab.add(box);
  const knobGeo = keep(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 18));
  const ringGeo = keep(new THREE.TorusGeometry(0.17, 0.03, 8, 24));
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: 0xfde68a }));
  const knobs: Record<string, THREE.Mesh> = {};
  const rings: THREE.Mesh[] = [];
  const row = (kind: 'size' | 'speed', y: number, color: number) => {
    const label = textSprite(keep, 512, 96);
    label.draw(kind === 'size' ? 'PUSH SIZE' : 'PUSH SPEED', '#e2e8f0', 'rgba(15,23,42,0)');
    label.sprite.scale.set(1.7, 0.32, 1);
    label.sprite.position.set(BOX_X, y + 0.36, 0.9);
    lab.add(label.sprite);
    for (let n = 1; n <= LEVELS; n++) {
      const knob = new THREE.Mesh(knobGeo, keep(new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: 0x000000 })));
      knob.rotation.x = Math.PI / 2;
      knob.position.set(knobX(n), y, 0.9);
      knob.userData.target = `${kind}:${n}`;
      lab.add(knob);
      knobs[`${kind}:${n}`] = knob;
      const num = textSprite(keep, 96, 96);
      num.draw(String(n));
      num.sprite.scale.set(0.2, 0.2, 1);
      num.sprite.position.set(knobX(n), y - 0.28, 0.9);
      lab.add(num.sprite);
      const start = kind === 'size' ? c.start.size : c.start.speed;
      if (n === start) {
        const r = new THREE.Mesh(ringGeo, ringMat);
        r.position.set(knobX(n), y, 0.98); r.visible = false;
        lab.add(r); rings.push(r);
      }
    }
  };
  row('size', SIZE_Y, 0x60a5fa);
  row('speed', SPEED_Y, 0xf59e0b);
  const lockedMat = keep(new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.8 }));
  for (let n = c.sizeCap + 1; n <= LEVELS; n++) knobs[`size:${n}`].material = lockedMat;

  // The cork: bobs where it is as waves pass.
  const CORK_X = 6.5;
  const cork = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 16)), keep(new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.9 })));
  cork.castShadow = true;
  lab.add(cork);

  // The tower: blocks stacked at the waterline on the beach.
  const tower = new THREE.Group();
  tower.position.set(TOWER_X, beachY(TOWER_X), 0);
  const blockGeo = keep(new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK));
  const blocks = Array.from({ length: c.blocks }, (_, i) => {
    const b = new THREE.Mesh(blockGeo, keep(new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[i % BLOCK_COLORS.length], roughness: 0.6 })));
    b.castShadow = true;
    tower.add(b);
    return b;
  });
  const stack = () => blocks.forEach((b, i) => { b.position.set(0, BLOCK / 2 + i * BLOCK, 0); b.rotation.set(0, 0, 0); });
  stack();
  lab.add(tower);

  // The `crest_marks` lever: a height bar on each crest and a gap bar between crests, with their square counts.
  const markMat = keep(new THREE.MeshBasicMaterial({ color: 0xfde68a }));
  const barGeo = keep(new THREE.BoxGeometry(0.04, 1, 0.04));
  const gapGeo = keep(new THREE.BoxGeometry(1, 0.04, 0.04));
  const heightBars = Array.from({ length: PUSHES }, () => { const m = new THREE.Mesh(barGeo, markMat); m.visible = false; lab.add(m); return m; });
  const gapBars = Array.from({ length: PUSHES - 1 }, () => { const m = new THREE.Mesh(gapGeo, markMat); m.visible = false; lab.add(m); return m; });
  const heightLabel = textSprite(keep, 160, 96);
  const gapLabel = textSprite(keep, 160, 96);
  for (const l of [heightLabel, gapLabel]) { l.sprite.scale.set(0.5, 0.3, 1); l.sprite.visible = false; lab.add(l.sprite); }

  let runKey = '';
  let t = 0;
  let labelKey = '';
  return {
    root,
    tick(dt, s) {
      Object.entries(knobs).forEach(([key, k]) => {
        const [kind, n] = key.split(':');
        const on = Number(n) === (kind === 'size' ? s.size : s.speed);
        const m = k.material as THREE.MeshStandardMaterial;
        m.emissive.setHex(on ? 0x6a5410 : 0x000000);
        k.scale.y = on ? 1.6 : 1;
      });
      rings.forEach(r => { r.visible = !!s.startRings; });
      const run = s.run;
      if (!run) {
        runKey = ''; t = 0;
        setWater(() => 0);
        hinge.rotation.z = 0;
        stack(); tower.rotation.z = 0;
        cork.position.set(CORK_X, REST, 0);
        heightBars.forEach(b => { b.visible = false; }); gapBars.forEach(b => { b.visible = false; });
        heightLabel.sprite.visible = false; gapLabel.sprite.visible = false;
        return;
      }
      if (run.key !== runKey) { runKey = run.key; t = 0; stack(); tower.rotation.z = 0; }
      t += dt;
      setWater(x => (x > TOWER_X + 0.3 ? 0 : waveAt(x, t, run.size, run.speed)));
      hinge.rotation.z = -paddleAngle(t, run.size, run.speed);
      const lam = wavelength(run.speed);
      cork.position.set(CORK_X + 0.6 * waveAt(CORK_X - lam / 4, t, run.size, run.speed), REST + waveAt(CORK_X, t, run.size, run.speed), 0);
      cork.rotation.z = -0.8 * waveAt(CORK_X - lam / 4, t, run.size, run.speed);

      // The tower: from the first crest's arrival it topples, or rocks and settles.
      const since = t - runTiming(run.speed).arriveS;
      if (since > 0) {
        if (run.fell) {
          // The blocks tip over up the beach (the way the wave pushes) and come to rest on the sand.
          const base = beachY(TOWER_X);
          blocks.forEach((b, i) => {
            const k = Math.min(1, Math.max(0, (since - i * 0.06) / 0.9));
            const ex = 0.2 + i * BLOCK * 0.55;
            const ey = beachY(TOWER_X + ex) - base + BLOCK / 2 + (i % 2) * BLOCK * 0.6;
            const sy = BLOCK / 2 + i * BLOCK;
            b.position.set(k * ex, sy + (ey - sy) * k * k, (i % 2 ? 1 : -1) * k * 0.12 * Math.min(i, 3));
            b.rotation.set(0, k * 0.3 * i, -k * (1.1 + 0.15 * i));
          });
        } else {
          tower.rotation.z = -0.16 * run.wobble * Math.abs(Math.sin(since * Math.PI * (WAVE_SPEED / lam))) * Math.exp(-since * 0.8);
        }
      }

      // Crest marks: crests sit a quarter wavelength behind the front, one wavelength apart.
      const showMarks = !!s.crestMarks;
      const a = amplitude(run.size);
      const front = WAVE_SPEED * t;
      const crests = Array.from({ length: PUSHES }, (_, k) => front - lam / 4 - k * lam).filter(x => x > 0.2 && x < BEACH_X0);
      heightBars.forEach((b, k) => {
        const x = crests[k];
        b.visible = showMarks && x != null;
        if (x != null) { b.scale.y = a; b.position.set(x, REST + a / 2, HALF_Z - 0.05); }
      });
      gapBars.forEach((b, k) => {
        const x1 = crests[k], x2 = crests[k + 1];
        b.visible = showMarks && x1 != null && x2 != null;
        if (x1 != null && x2 != null) { b.scale.x = x1 - x2; b.position.set((x1 + x2) / 2, REST + a + 0.18, HALF_Z - 0.05); }
      });
      const key = `${run.size}:${run.speed}`;
      if (key !== labelKey) {
        labelKey = key;
        heightLabel.draw(`${heightSquares(run.size)} tall`);
        const gap = spacingSquares(run.speed);
        gapLabel.draw(`${Number.isInteger(gap) ? '' : '~'}${Math.round(gap)} apart`);
      }
      heightLabel.sprite.visible = showMarks && crests[0] != null;
      if (crests[0] != null) heightLabel.sprite.position.set(crests[0] + 0.35, REST + a / 2, HALF_Z + 0.1);
      gapLabel.sprite.visible = showMarks && crests[1] != null;
      if (crests[1] != null) gapLabel.sprite.position.set((crests[0] + crests[1]) / 2, REST + a + 0.45, HALF_Z + 0.1);
    },
    pickPoint(target) {
      const obj = target === 'paddle' ? board : knobs[target];
      return obj.getWorldPosition(new THREE.Vector3());
    },
    targetFromHit(obj) {
      return (obj.userData?.target as WaveTarget | undefined) ?? null;
    },
    dispose() { disposables.forEach(d => d.dispose()); },
  };
}
