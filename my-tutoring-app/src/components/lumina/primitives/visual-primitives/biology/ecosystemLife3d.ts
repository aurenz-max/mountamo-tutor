/**
 * The living layer of the ecosystem diorama (three.js, built in code): weather in the tank (clouds, rain, snow,
 * wind), winter (the leafy tree turns and drops its leaves, snow covers the island), the animals and their winter
 * places, the potted plant, and the keep-it-cool thing with its shade covers. `ecosystem3d.ts` builds the world and
 * calls `buildLife` with its handles; this module owns only what it adds.
 *
 * Tappable meshes carry `userData.target`: `animal:<kind>`, `place:<winter place>`, or 'pass'.
 */
import * as THREE from 'three';
import { COOL_LINE, type Cover, type CoolThing } from './ecosystemModel';
import { ANIMALS, type Animal, type PlantKind, type PlantSetup, type Weather, type WinterPlace } from './ecosystemLife';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface LifeState {
  /** Today's weather in the tank (the log modes), or null for a plain sunny world. */
  weather: Weather | null;
  /** 0 summer to 1 deep winter (season_behavior): leaves turn and fall, snow covers the island. */
  winter: number;
  /** The animals on the island this item and where each is, or null when none take part. */
  animals: { kind: Animal; place: WinterPlace | 'summer' }[] | null;
  /** Show the winter places as tappable rings. */
  placesActive: boolean;
  holding: Animal | null;
  plant: { kind: PlantKind; setup: PlantSetup; growth: number; droop: number } | null;
  cool: { thing: CoolThing; cover: Cover | null; fill: number } | null;
}

export interface LifeContext {
  root: THREE.Group;
  groundY: (x: number, z: number) => number;
  islandGeometry: THREE.BufferGeometry;
  /** The leafy tree's leaf puffs (turn colour and fall in winter) and its trunk group. */
  leafPuffs: THREE.Mesh[];
  leafyTree: THREE.Group;
  /** Spots shared with the world: the open sand in front, and inside the shade hut. */
  frontSpot: { x: number; z: number };
  hutSpot: { x: number; z: number };
  water: number;
  tank: { hx: number; hz: number; top: number };
  thermoTexture: THREE.Texture;
}

export interface Life {
  tick(dt: number, state: LifeState, clock: number, camPos: THREE.Vector3): void;
  /** Weather dims the sun: 1 on a clear day, lower under cloud. */
  sunlight(state: LifeState): number;
  pickPoint(target: string): THREE.Vector3 | null;
  dispose(): void;
}

/** Where each winter place is on the island, and each animal's summer place. */
const PLACE_AT: Record<WinterPlace, { x: number; z: number; y?: number }> = {
  den: { x: -6.1, z: -2.4 },
  south: { x: 6.9, z: 0.6 },
  hollow: { x: -3.2, z: -1.9, y: 1.7 },
  meadow: { x: 0.9, z: -2.2 },
};
const SUMMER_AT: Record<Animal, { x: number; z: number; y?: number }> = {
  bear: { x: -5.6, z: 1.6 },
  bird: { x: -1.6, z: 2.5, y: 0.0 },
  squirrel: { x: -2.0, z: 2.9 },
  deer: { x: 2.4, z: 3.0 },
};

export function buildLife(ctx: LifeContext): Life {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const geo = <G extends THREE.BufferGeometry>(g: G) => { geos.push(g); return g; };
  const std = (hex: number, rough: number, extra?: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: rough, ...extra }); mats.push(m); return m;
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
  };
  const tag = (o: THREE.Object3D, t: string) => o.traverse(c => { c.userData.target = t; });
  const { root, groundY, tank } = ctx;
  const g0 = (p: { x: number; z: number; y?: number }) => V(p.x, groundY(p.x, p.z) + (p.y ?? 0), p.z);

  // ── Weather: clouds, rain, snow, wind ──────────────────────────────────────────────────────────────────
  const clouds = new THREE.Group(); root.add(clouds); tag(clouds, 'pass');
  const cloudMat = std(0xffffff, 0.95, { transparent: true, opacity: 0, depthWrite: false });
  const puffGeo = geo(new THREE.IcosahedronGeometry(1, 2));
  const cloudList: { g: THREE.Group; x0: number; z: number; speed: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group();
    const n = 4 + (i % 3);
    for (let k = 0; k < n; k++) {
      const m = mesh(puffGeo, cloudMat, g, (k - n / 2) * 0.9, Math.sin(k * 1.7) * 0.25, Math.cos(k * 2.3) * 0.4);
      m.scale.setScalar(0.8 + ((k * 37) % 5) * 0.12); m.castShadow = true; m.receiveShadow = false;
    }
    const x0 = -9 + i * 3.4, z = -3.8 + (i % 3) * 2.6;
    g.position.set(x0, tank.top - 1.6 - (i % 2) * 0.6, z);
    clouds.add(g); cloudList.push({ g, x0, z, speed: 0.25 + (i % 3) * 0.08 });
  }

  const makeFall = (count: number, size: number, color: number) => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * (tank.hx - 0.4);
      pos[i * 3 + 1] = Math.random() * (tank.top - 1);
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * (tank.hz - 0.4);
    }
    const g = geo(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    mats.push(m);
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; root.add(pts); tag(pts, 'pass');
    return { pts, pos, m };
  };
  const rain = makeFall(700, 0.09, 0x8fc7ff);
  const snow = makeFall(500, 0.2, 0xffffff);

  // Snow cover: a white copy of the island surface laid just above it.
  const snowMat = std(0xf7fbff, 0.9, { transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexColors: true });
  const snowGeo = geo(ctx.islandGeometry.clone());
  {
    const pos = snowGeo.attributes.position, rgba: number[] = [];
    for (let i = 0; i < pos.count; i++) rgba.push(1, 1, 1, clamp((pos.getY(i) - ctx.water - 0.08) / 0.25, 0, 1));
    snowGeo.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
  }
  const snowCover = new THREE.Mesh(snowGeo, snowMat); snowCover.position.y = 0.03; snowCover.receiveShadow = true;
  root.add(snowCover); tag(snowCover, 'pass');

  // Falling leaves.
  const leafGeo = geo(new THREE.PlaneGeometry(0.22, 0.16));
  const leafMat = std(0xd9822b, 0.8, { side: THREE.DoubleSide, transparent: true, opacity: 0 });
  const leaves: { m: THREE.Mesh; seed: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const m = mesh(leafGeo, leafMat, root); m.castShadow = false; m.userData.target = 'pass';
    leaves.push({ m, seed: Math.random() * 100 });
  }
  const treeTop = ctx.leafyTree.position.clone().add(V(0, 3.2, 0));
  const leafGreen = [new THREE.Color(0x4e9a3a), new THREE.Color(0x6dbb4a)];
  const leafFall = new THREE.Color(0xe08a2a);

  // ── Animals and winter places ───────────────────────────────────────────────────────────────────────────
  const fur = { bear: std(0x6b4423, 0.9), bird: std(0xe0453a, 0.6), squirrel: std(0x9a6a3e, 0.85), deer: std(0xb7864f, 0.85) };
  const dark = std(0x1b1b1b, 0.4), light = std(0xf3e6cf, 0.8), beak = std(0xf2a71b, 0.5), antler = std(0xe8dcc0, 0.7);
  function animalModel(kind: Animal): THREE.Group {
    const g = new THREE.Group();
    const m = fur[kind];
    if (kind === 'bear') {
      mesh(geo(new THREE.SphereGeometry(0.6, 16, 12)), m, g, 0, 0.62, 0).scale.set(1.35, 0.95, 0.9);
      mesh(geo(new THREE.SphereGeometry(0.36, 14, 10)), m, g, 0.78, 0.95, 0);
      mesh(geo(new THREE.SphereGeometry(0.16, 10, 8)), light, g, 1.08, 0.88, 0);
      for (const s of [-1, 1]) mesh(geo(new THREE.SphereGeometry(0.11, 8, 6)), m, g, 0.72, 1.28, 0.2 * s);
      for (const s of [-1, 1]) mesh(geo(new THREE.SphereGeometry(0.05, 6, 6)), dark, g, 1.02, 1.04, 0.13 * s);
      const legGeo = geo(new THREE.CylinderGeometry(0.15, 0.15, 0.45, 8));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(legGeo, m, g, sx * 0.45, 0.22, sz * 0.3);
    } else if (kind === 'deer') {
      mesh(geo(new THREE.SphereGeometry(0.45, 14, 10)), m, g, 0, 1.05, 0).scale.set(1.5, 0.75, 0.7);
      const neck = mesh(geo(new THREE.CylinderGeometry(0.1, 0.13, 0.6, 8)), m, g, 0.6, 1.4, 0); neck.rotation.z = -0.5;
      mesh(geo(new THREE.SphereGeometry(0.2, 12, 8)), m, g, 0.8, 1.72, 0).scale.set(1.4, 0.9, 0.9);
      for (const s of [-1, 1]) {
        const a = mesh(geo(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 5)), antler, g, 0.74, 2.0, 0.12 * s); a.rotation.x = 0.4 * s;
        mesh(geo(new THREE.SphereGeometry(0.04, 6, 6)), dark, g, 1.0, 1.78, 0.1 * s);
      }
      const legGeo = geo(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(legGeo, m, g, sx * 0.45, 0.4, sz * 0.18);
    } else if (kind === 'squirrel') {
      mesh(geo(new THREE.SphereGeometry(0.22, 12, 10)), m, g, 0, 0.3, 0).scale.set(1.2, 1.1, 0.9);
      mesh(geo(new THREE.SphereGeometry(0.14, 10, 8)), m, g, 0.22, 0.52, 0);
      for (const s of [-1, 1]) mesh(geo(new THREE.SphereGeometry(0.03, 6, 6)), dark, g, 0.33, 0.56, 0.06 * s);
      const tail = mesh(geo(new THREE.SphereGeometry(0.22, 12, 10)), m, g, -0.3, 0.52, 0); tail.scale.set(0.7, 1.6, 0.8); tail.rotation.z = 0.4;
    } else {
      mesh(geo(new THREE.SphereGeometry(0.22, 12, 10)), m, g, 0, 0.3, 0).scale.set(1.4, 0.9, 0.9);
      mesh(geo(new THREE.SphereGeometry(0.14, 10, 8)), m, g, 0.26, 0.42, 0);
      const b = mesh(geo(new THREE.ConeGeometry(0.05, 0.16, 6)), beak, g, 0.43, 0.4, 0); b.rotation.z = -Math.PI / 2;
      for (const s of [-1, 1]) {
        const w = mesh(geo(new THREE.BoxGeometry(0.28, 0.03, 0.34)), m, g, -0.02, 0.36, 0.2 * s); w.rotation.x = 0.4 * s;
        w.userData.wing = s;
        mesh(geo(new THREE.SphereGeometry(0.03, 6, 6)), dark, g, 0.33, 0.47, 0.07 * s);
      }
    }
    return g;
  }
  const animals = new Map<Animal, { g: THREE.Group; ring: THREE.Mesh; pos: THREE.Vector3; gone: number }>();
  const ringGeo = geo(new THREE.TorusGeometry(0.75, 0.05, 8, 40));
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  mats.push(hitMat);
  const hit = (parent: THREE.Object3D, r: number, y: number) => {
    const m = new THREE.Mesh(geo(new THREE.SphereGeometry(r, 10, 8)), hitMat); m.position.y = y; m.castShadow = false; parent.add(m); return m;
  };
  for (const kind of ANIMALS) {
    const g = animalModel(kind); g.visible = false; g.scale.setScalar(kind === 'bear' ? 1.15 : kind === 'deer' ? 1.0 : 1.35);
    root.add(g);
    const ring = mesh(ringGeo, std(0xffd23f, 0.4, { emissive: new THREE.Color(0xffb000), emissiveIntensity: 0.9 }), g, 0, 0.05, 0);
    ring.rotation.x = Math.PI / 2; ring.visible = false; ring.castShadow = false;
    hit(g, kind === 'bear' || kind === 'deer' ? 0.9 : 0.6, 0.5);
    tag(g, `animal:${kind}`);
    animals.set(kind, { g, ring, pos: g0(SUMMER_AT[kind]), gone: 0 });
  }

  const places = new Map<WinterPlace, { g: THREE.Group; ring: THREE.Mesh }>();
  {
    const stone = std(0x6f6a62, 0.95, { flatShading: true });
    const holeMat = std(0x141210, 1);
    for (const p of ['den', 'south', 'hollow', 'meadow'] as WinterPlace[]) {
      const g = new THREE.Group(); g.position.copy(g0(PLACE_AT[p])); root.add(g);
      if (p === 'den') {
        const cave = mesh(geo(new THREE.SphereGeometry(1.25, 18, 12, 0, TAU, 0, Math.PI / 2)), stone, g, 0, -0.1, 0); cave.scale.set(1.2, 0.9, 1);
        const mouth = mesh(geo(new THREE.CircleGeometry(0.55, 20, 0, Math.PI)), holeMat, g, 0.35, 0.0, 1.0); mouth.rotation.y = 0.35;
      } else if (p === 'south') {
        mesh(geo(new THREE.BoxGeometry(0.1, 1.5, 0.1)), std(0x7a5230, 0.85), g, 0, 0.75, 0);
        const c = document.createElement('canvas'); c.width = 256; c.height = 96;
        const x = c.getContext('2d');
        if (x) {
          x.fillStyle = '#f2b21b'; x.beginPath(); x.moveTo(0, 20); x.lineTo(180, 20); x.lineTo(180, 0); x.lineTo(256, 48); x.lineTo(180, 96); x.lineTo(180, 76); x.lineTo(0, 76); x.fill();
          x.fillStyle = '#3a2a10'; x.font = '800 44px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SOUTH', 100, 50);
        }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        const sm = std(0xffffff, 0.7, { map: t, transparent: true, side: THREE.DoubleSide }); (sm as THREE.MeshStandardMaterial).map = t;
        mesh(geo(new THREE.PlaneGeometry(1.4, 0.52)), sm, g, 0.3, 1.4, 0);
      } else if (p === 'hollow') {
        // A dark hollow in the leafy tree's trunk with nuts at its lip.
        g.position.copy(ctx.leafyTree.position).add(V(0.0, 1.5, 0.3));
        mesh(geo(new THREE.CircleGeometry(0.2, 16)), holeMat, g, 0, 0, 0.02);
        for (let k = 0; k < 3; k++) mesh(geo(new THREE.SphereGeometry(0.06, 8, 6)), std(0x8a5a2b, 0.7), g, -0.1 + k * 0.1, -0.2, 0.08);
      } else {
        for (let k = 0; k < 5; k++) mesh(geo(new THREE.ConeGeometry(0.06, 0.4, 4)), std(0x3f8a3a, 0.8), g, Math.cos(k) * 0.5, 0.2, Math.sin(k * 2) * 0.4);
      }
      const ring = mesh(ringGeo, std(0x7fd3ff, 0.4, { emissive: new THREE.Color(0x2a9df4), emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }), g, 0, 0.06, 0);
      ring.rotation.x = Math.PI / 2; ring.scale.setScalar(p === 'hollow' ? 0.5 : 1.2); ring.visible = false; ring.castShadow = false;
      if (p === 'hollow') ring.rotation.x = 0;
      // The hollow's hit sits just in front of the trunk, so a tap there wins over the tree behind it.
      hit(g, p === 'hollow' ? 0.55 : p === 'den' ? 1.4 : 1.0, p === 'hollow' ? 0 : 0.5).position.z = p === 'hollow' ? 0.35 : 0;
      tag(g, `place:${p}`);
      places.set(p, { g, ring });
    }
  }
  /** Where an animal stands at a winter place (several animals at one place stand side by side). */
  const placeSpot = (p: WinterPlace, k: number) => {
    const base = p === 'hollow' ? ctx.leafyTree.position.clone().add(V(0.25, 1.35, 0.45)) : g0(PLACE_AT[p]);
    if (p === 'den') base.add(V(0.5, 0, 1.2));
    return base.add(V(k * 0.7, 0, k * 0.3));
  };

  // ── The potted plant ────────────────────────────────────────────────────────────────────────────────────
  const pot = new THREE.Group(); root.add(pot); pot.visible = false; tag(pot, 'pass');
  const potMat = std(0xc0623a, 0.8);
  mesh(geo(new THREE.CylinderGeometry(0.55, 0.42, 0.75, 24, 1, true)), std(0xc0623a, 0.8, { side: THREE.DoubleSide }), pot, 0, 0.38, 0);
  mesh(geo(new THREE.TorusGeometry(0.56, 0.06, 8, 32)), potMat, pot, 0, 0.75, 0).rotation.x = Math.PI / 2;
  mesh(geo(new THREE.CircleGeometry(0.42, 24)), potMat, pot, 0, 0.02, 0).rotation.x = -Math.PI / 2;
  const soilMat = std(0x5a3a22, 0.95);
  const soil = mesh(geo(new THREE.CylinderGeometry(0.5, 0.42, 0.55, 24)), soilMat, pot, 0, 0.3, 0);
  const pebbles = new THREE.Group(); pot.add(pebbles);
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4, r = 0.12 + (i % 4) * 0.09;
    mesh(geo(new THREE.DodecahedronGeometry(0.1, 0)), std(0x9b978f, 0.8, { flatShading: true }), pebbles, Math.cos(a) * r, 0.5 + (i % 3) * 0.04, Math.sin(a) * r);
  }
  const plant = new THREE.Group(); plant.position.y = 0.57; pot.add(plant);
  const stemMat = std(0x3f8a3a, 0.8), leafMatP = std(0x56a640, 0.75, { side: THREE.DoubleSide });
  const stem = mesh(geo(new THREE.CylinderGeometry(0.05, 0.07, 1, 8)), stemMat, plant); stem.geometry.translate(0, 0.5, 0);
  const plantLeaves: THREE.Mesh[] = [];
  for (let k = 0; k < 4; k++) {
    const l = mesh(geo(new THREE.SphereGeometry(0.22, 10, 6)), leafMatP, plant); l.scale.set(1.2, 0.18, 0.6);
    plantLeaves.push(l);
  }
  const heads: Record<PlantKind, THREE.Group> = { sunflower: new THREE.Group(), 'bean plant': new THREE.Group(), 'tomato plant': new THREE.Group(), daisy: new THREE.Group() };
  {
    const sf = heads.sunflower;
    mesh(geo(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20)), std(0x5a3a1a, 0.9), sf).rotation.x = Math.PI / 2;
    for (let k = 0; k < 14; k++) {
      const p = mesh(geo(new THREE.SphereGeometry(0.12, 8, 6)), std(0xffc61a, 0.6), sf, Math.cos(k * TAU / 14) * 0.3, Math.sin(k * TAU / 14) * 0.3, 0);
      p.scale.set(1.3, 0.55, 0.2); p.rotation.z = k * TAU / 14;
    }
    const d = heads.daisy;
    mesh(geo(new THREE.SphereGeometry(0.09, 10, 8)), std(0xffd23f, 0.6), d);
    for (let k = 0; k < 10; k++) {
      const p = mesh(geo(new THREE.SphereGeometry(0.08, 8, 6)), std(0xffffff, 0.6), d, Math.cos(k * TAU / 10) * 0.16, Math.sin(k * TAU / 10) * 0.16, 0);
      p.scale.set(1.4, 0.5, 0.2); p.rotation.z = k * TAU / 10;
    }
    const t = heads['tomato plant'];
    for (let k = 0; k < 3; k++) mesh(geo(new THREE.SphereGeometry(0.14, 12, 10)), std(0xe0302a, 0.45), t, -0.2 + k * 0.2, -0.1 * (k % 2), 0.1);
    const b = heads['bean plant'];
    for (let k = 0; k < 3; k++) {
      const pod = mesh(geo(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8)), std(0x7cc24a, 0.6), b, -0.15 + k * 0.15, -0.1, 0.08); pod.rotation.z = 0.3;
    }
    for (const h of Object.values(heads)) { h.visible = false; plant.add(h); }
  }
  const extras = { den: new THREE.Group(), berries: new THREE.Group() };
  {
    for (let k = 0; k < 6; k++) {
      const s = mesh(geo(new THREE.CylinderGeometry(0.03, 0.04, 1.0, 5)), std(0x7a5230, 0.9), extras.den, Math.cos(k) * 0.25, 0.42, Math.sin(k) * 0.25);
      s.rotation.set(Math.sin(k) * 0.4, 0, Math.cos(k) * 0.4);
    }
    mesh(geo(new THREE.CylinderGeometry(0.3, 0.22, 0.14, 16)), std(0xe8e2d4, 0.6), extras.berries, 0, 0.07, 0);
    for (let k = 0; k < 7; k++) mesh(geo(new THREE.SphereGeometry(0.07, 8, 6)), std(0x6a2bd9, 0.5), extras.berries, Math.cos(k) * 0.14, 0.17, Math.sin(k) * 0.14);
    for (const e of Object.values(extras)) { e.visible = false; root.add(e); tag(e, 'pass'); }
  }

  // ── Keep it cool: the thing, its thermometer with a cool line, and the covers ─────────────────────────────
  const coolGroup = new THREE.Group(); root.add(coolGroup); coolGroup.visible = false; tag(coolGroup, 'pass');
  const coolThings: Record<CoolThing, THREE.Group> = { 'ice pop': new THREE.Group(), snowman: new THREE.Group(), 'chocolate bar': new THREE.Group() };
  {
    const ip = coolThings['ice pop'];
    mesh(geo(new THREE.BoxGeometry(0.42, 0.7, 0.2)), std(0xff7a2f, 0.5), ip, 0, 0.62, 0);
    mesh(geo(new THREE.BoxGeometry(0.08, 0.3, 0.04)), std(0xe6c48a, 0.8), ip, 0, 0.15, 0);
    const sm = coolThings.snowman;
    mesh(geo(new THREE.SphereGeometry(0.32, 16, 12)), std(0xffffff, 0.7), sm, 0, 0.3, 0);
    mesh(geo(new THREE.SphereGeometry(0.22, 16, 12)), std(0xffffff, 0.7), sm, 0, 0.75, 0);
    const n = mesh(geo(new THREE.ConeGeometry(0.04, 0.16, 6)), std(0xff8a1f, 0.5), sm, 0, 0.76, 0.24); n.rotation.x = Math.PI / 2;
    const ch = coolThings['chocolate bar'];
    mesh(geo(new THREE.BoxGeometry(0.8, 0.1, 0.45)), std(0x5a3220, 0.5), ch, 0, 0.06, 0);
    mesh(geo(new THREE.BoxGeometry(0.4, 0.11, 0.46)), std(0xd8402a, 0.6), ch, 0.22, 0.065, 0);
    for (const t of Object.values(coolThings)) { t.visible = false; coolGroup.add(t); }
  }
  const puddle = mesh(geo(new THREE.CircleGeometry(0.6, 24)), std(0xff9a5a, 0.2, { transparent: true, opacity: 0.0 }), coolGroup, 0, 0.02, 0);
  puddle.rotation.x = -Math.PI / 2; puddle.castShadow = false;
  // The thermometer, with a blue cool line.
  const coolThermo = new THREE.Group(); coolThermo.position.set(1.1, 0, 0.55); coolGroup.add(coolThermo);
  const TH = 1.6, TY = 1.15, TUBE = TH * 0.72, tubeY0 = TY - TH / 2 + TH * 0.14;
  mesh(geo(new THREE.BoxGeometry(0.06, 0.4, 0.06)), std(0x7a5230, 0.85), coolThermo, 0, 0.2, 0);
  mesh(geo(new THREE.BoxGeometry(0.6, TH, 0.05)), [std(0x7a5230, 0.85), std(0x7a5230, 0.85), std(0x7a5230, 0.85), std(0x7a5230, 0.85),
    std(0xffffff, 0.7, { map: ctx.thermoTexture }), std(0x7a5230, 0.85)], coolThermo, 0, TY, 0);
  const coolLine = mesh(geo(new THREE.BoxGeometry(0.62, 0.05, 0.03)), std(0x2a9df4, 0.4, { emissive: new THREE.Color(0x2a9df4), emissiveIntensity: 0.6 }), coolThermo, 0, tubeY0 + COOL_LINE * TUBE, 0.06);
  coolLine.castShadow = false;
  const coolFillGeo = geo(new THREE.CylinderGeometry(0.062, 0.062, 1, 12)); coolFillGeo.translate(0, 0.5, 0);
  const redMat = std(0xe8322a, 0.4, { emissive: new THREE.Color(0xff2a10), emissiveIntensity: 0.35 });
  const coolFillMesh = mesh(coolFillGeo, redMat, coolThermo, 0, tubeY0, 0.07);
  mesh(geo(new THREE.SphereGeometry(0.15, 16, 12)), redMat, coolThermo, 0, tubeY0 - 0.08, 0.07);
  let coolFillNow = 0.1;
  const covers: Record<Exclude<Cover, 'hut'>, THREE.Group> = { umbrella: new THREE.Group(), 'leaf roof': new THREE.Group(), 'clear sheet': new THREE.Group() };
  {
    const u = covers.umbrella;
    mesh(geo(new THREE.CylinderGeometry(0.035, 0.035, 2.0, 8)), std(0xdddddd, 0.4), u, 0, 1.0, 0);
    const canopy = mesh(geo(new THREE.ConeGeometry(1.25, 0.55, 12, 1, true)), std(0xff5d73, 0.6, { side: THREE.DoubleSide }), u, 0, 2.0, 0);
    canopy.castShadow = true;
    const lr = covers['leaf roof'];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(geo(new THREE.CylinderGeometry(0.04, 0.05, 1.5, 6)), std(0x7a5230, 0.9), lr, sx * 0.75, 0.75, sz * 0.6);
    for (let k = 0; k < 9; k++) {
      const l = mesh(geo(new THREE.SphereGeometry(0.45, 10, 6)), std(k % 2 ? 0x4e9a3a : 0x6dbb4a, 0.8, { flatShading: true }), lr, -0.6 + (k % 3) * 0.6, 1.55, -0.45 + Math.floor(k / 3) * 0.45);
      l.scale.set(1, 0.25, 1);
    }
    const cs = covers['clear sheet'];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(geo(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6)), std(0xbfc6cc, 0.5), cs, sx * 0.75, 0.7, sz * 0.6);
    const sheet = mesh(geo(new THREE.BoxGeometry(1.7, 0.02, 1.4)), new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.05, transparent: true, opacity: 0.25 }), cs, 0, 1.42, 0);
    mats.push(sheet.material as THREE.Material);
    sheet.castShadow = false; // light goes through
    for (const c of Object.values(covers)) { c.visible = false; coolGroup.add(c); }
  }

  const tmp = new THREE.Vector3();
  let wind = 0, cloudCover = 0, rainOn = 0, snowOn = 0;

  return {
    sunlight(state) {
      const w = state.weather;
      const cloud = w === 'cloudy' ? 0.55 : w === 'rainy' ? 0.7 : w === 'snowy' ? 0.6 : w === 'windy' ? 0.25 : 0;
      return 1 - cloud * 0.75 - state.winter * 0.25;
    },
    tick(dt, s, clock, camPos) {
      const k = 1 - Math.exp(-dt * 3);
      const w = s.weather;
      cloudCover = lerp(cloudCover, w === 'cloudy' || w === 'rainy' || w === 'snowy' ? 1 : w === 'windy' ? 0.55 : s.winter > 0.4 ? 0.5 : 0, k);
      rainOn = lerp(rainOn, w === 'rainy' ? 1 : 0, k);
      snowOn = lerp(snowOn, w === 'snowy' || (s.winter > 0.45 && s.winter < 0.98) ? 1 : 0, k);
      wind = lerp(wind, w === 'windy' ? 1 : w === 'rainy' ? 0.35 : 0, k);
      cloudMat.opacity = 0.9 * cloudCover;
      cloudMat.color.setRGB(1 - 0.35 * rainOn, 1 - 0.33 * rainOn, 1 - 0.28 * rainOn);
      clouds.visible = cloudCover > 0.02;
      for (const c of cloudList) {
        const speed = c.speed * (1 + wind * 4);
        c.g.position.x = ((c.x0 + clock * speed + 10) % 20) - 10;
      }
      // Rain and snow fall inside the tank.
      for (const [f, speed, sway] of [[rain, 9, 0], [snow, 1.2, 0.6]] as const) {
        const on = f === rain ? rainOn : snowOn;
        f.m.opacity = 0.85 * on;
        f.pts.visible = on > 0.02;
        if (!f.pts.visible) continue;
        for (let i = 0; i < f.pos.length; i += 3) {
          f.pos[i + 1] -= speed * dt;
          f.pos[i] += (sway * Math.sin(clock + i) + wind * 3) * dt;
          if (f.pos[i] > tank.hx - 0.3) f.pos[i] = -tank.hx + 0.3;
          if (f.pos[i + 1] < ctx.water) f.pos[i + 1] = tank.top - 0.8;
        }
        (f.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
      // Winter: leaves turn, then fall; snow covers the island.
      const turn = clamp((s.winter - 0.1) / 0.35, 0, 1), drop = clamp((s.winter - 0.35) / 0.4, 0, 1);
      ctx.leafPuffs.forEach((m, i) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.color.copy(leafGreen[i % 2]).lerp(leafFall, turn);
        const keep = 1 - drop * (0.6 + 0.4 * ((i * 37) % 7) / 7);
        m.scale.setScalar(Math.max(0.001, (m.userData.baseScale as number) * keep));
        m.visible = keep > 0.05;
      });
      leafMat.opacity = drop > 0 && drop < 1 ? 1 : wind > 0.5 ? 0.9 : 0;
      for (const l of leaves) {
        const t = (clock * 0.25 + l.seed) % 1;
        l.m.position.set(treeTop.x + Math.sin(l.seed * 3) * 2 + wind * t * 6, treeTop.y - t * 4.5, treeTop.z + Math.cos(l.seed * 5) * 1.6);
        l.m.rotation.set(clock * 2 + l.seed, clock * 1.3, l.seed);
      }
      snowMat.opacity = clamp((s.winter - 0.5) / 0.4, 0, 1) * 0.95;
      // Wind leans the leafy tree.
      ctx.leafyTree.rotation.z = wind * 0.06 * Math.sin(clock * 3);

      // Animals.
      const onIsland = new Set((s.animals ?? []).map(a => a.kind));
      const atPlace = new Map<WinterPlace, number>();
      for (const [kind, a] of Array.from(animals.entries())) {
        const entry = s.animals?.find(x => x.kind === kind);
        a.g.visible = onIsland.has(kind) && a.gone < 1;
        if (!entry) { a.gone = 0; continue; }
        let target: THREE.Vector3;
        if (entry.place === 'summer') { target = g0(SUMMER_AT[kind]); a.gone = 0; }
        else {
          const n = atPlace.get(entry.place) ?? 0; atPlace.set(entry.place, n + 1);
          target = placeSpot(entry.place, n);
          // A bird sent south flies off past the glass and is gone; it comes back if moved again.
          if (entry.place === 'south' && kind === 'bird') target = V(tank.hx + 3, tank.top, 0.6);
        }
        a.pos.lerp(target, 1 - Math.exp(-dt * 2.5));
        const flying = kind === 'bird' && (entry.place === 'south' || a.pos.distanceTo(target) > 0.3);
        a.g.position.copy(a.pos).add(V(0, flying ? 0.6 + 0.2 * Math.sin(clock * 6) : 0, 0));
        if (kind === 'bird' && entry.place === 'south') a.gone = clamp((a.pos.x - (tank.hx - 0.5)) / 2, 0, 1);
        tmp.copy(target).sub(a.pos);
        if (tmp.lengthSq() > 0.01) a.g.rotation.y = Math.atan2(-tmp.z, tmp.x);
        else a.g.rotation.y = lerp(a.g.rotation.y, Math.atan2(camPos.x - a.pos.x, camPos.z - a.pos.z) - Math.PI / 2, 0.05);
        // A sleeping bear lies low in its den; a held animal bobs and wears a ring.
        a.g.scale.y = (kind === 'bear' ? 1.15 : kind === 'deer' ? 1.0 : 1.35) * (entry.place === 'den' && kind === 'bear' ? 0.75 : 1);
        a.ring.visible = s.holding === kind;
        if (a.ring.visible) a.g.position.y += 0.15 * (1 + Math.sin(clock * 6));
        a.g.traverse((o: THREE.Object3D) => { if (o.userData.wing) o.rotation.x = (o.userData.wing as number) * (0.4 + (flying ? 0.6 * Math.sin(clock * 18) : 0)); });
      }
      for (const p of Array.from(places.values())) {
        p.g.visible = !!s.animals;
        p.ring.visible = s.placesActive;
        if (p.ring.visible) (p.ring.material as THREE.MeshStandardMaterial).opacity = 0.6 + 0.3 * Math.sin(clock * 4);
      }

      // The potted plant.
      pot.visible = !!s.plant;
      extras.den.visible = !!s.plant?.setup.extras.includes('den');
      extras.berries.visible = !!s.plant?.setup.extras.includes('berries');
      if (s.plant) {
        const spot = s.plant.setup.spot === 'sun' ? ctx.frontSpot : ctx.hutSpot;
        const target = V(spot.x, groundY(spot.x, spot.z), spot.z);
        pot.position.lerp(target, pot.position.lengthSq() === 0 ? 1 : 1 - Math.exp(-dt * 5));
        pot.scale.setScalar(1.35);
        extras.den.position.copy(pot.position).add(V(-1.2, 0, 0.3));
        extras.berries.position.copy(pot.position).add(V(1.0, 0, 0.5));
        const fill = s.plant.setup.fill;
        soil.visible = fill === 'soil'; pebbles.visible = fill === 'pebbles';
        soilMat.color.setHex(s.plant.setup.watered ? 0x3a2414 : 0x7a5a3a);
        const h = 0.35 + 1.25 * s.plant.growth;
        stem.scale.set(1, h, 1);
        const droop = s.plant.droop;
        plant.rotation.z = 0.5 * droop;
        stemMat.color.setHex(droop > 0.3 ? 0x8a8a3a : 0x3f8a3a);
        leafMatP.color.setHex(droop > 0.3 ? 0xa8a050 : 0x56a640);
        plantLeaves.forEach((l, i) => {
          const y = h * (0.25 + 0.18 * i);
          l.position.set((i % 2 ? 1 : -1) * 0.22, y, 0);
          l.rotation.z = (i % 2 ? -1 : 1) * (0.3 + droop * 0.9);
          l.visible = h > 0.4 || i < 2;
        });
        for (const [kind, head] of Object.entries(heads)) {
          head.visible = kind === s.plant.kind && s.plant.growth > 0.55;
          head.position.set(0, h + 0.05, 0.05);
          head.scale.setScalar(clamp((s.plant.growth - 0.55) / 0.45, 0.2, 1));
        }
      }

      // Keep it cool.
      coolGroup.visible = !!s.cool;
      if (s.cool) {
        const inHut = s.cool.cover === 'hut';
        const spot = inHut ? ctx.hutSpot : ctx.frontSpot;
        coolGroup.position.set(spot.x, groundY(spot.x, spot.z), spot.z);
        coolGroup.scale.setScalar(1.35);
        for (const [kind, t] of Object.entries(coolThings)) t.visible = kind === s.cool.thing;
        for (const [kind, c] of Object.entries(covers)) c.visible = kind === s.cool.cover;
        coolFillNow = lerp(coolFillNow, s.cool.fill, 1 - Math.exp(-dt * 6));
        coolFillMesh.scale.y = Math.max(0.02, coolFillNow * TUBE);
        coolThermo.rotation.y = Math.atan2(camPos.x - coolGroup.position.x, camPos.z - coolGroup.position.z);
        const melt = clamp((coolFillNow - COOL_LINE) / 0.35, 0, 1);
        const thing = coolThings[s.cool.thing];
        thing.scale.set(1 + 0.25 * melt, Math.max(0.25, 1 - 0.7 * melt), 1 + 0.25 * melt);
        (puddle.material as THREE.MeshStandardMaterial).opacity = 0.75 * melt;
        (puddle.material as THREE.MeshStandardMaterial).color.setHex(s.cool.thing === 'snowman' ? 0xbfe6ff : s.cool.thing === 'chocolate bar' ? 0x5a3220 : 0xff9a5a);
        puddle.scale.setScalar(0.4 + melt);
      }
    },
    pickPoint(target) {
      if (target.startsWith('animal:')) { const a = animals.get(target.slice(7) as Animal); return a ? a.g.position.clone().add(V(0, 0.4, 0)) : null; }
      if (target.startsWith('place:')) { const p = places.get(target.slice(6) as WinterPlace); return p ? p.g.getWorldPosition(new THREE.Vector3()).add(V(0, 0.3, 0)) : null; }
      return null;
    },
    dispose() {
      geos.forEach(g => g.dispose());
      mats.forEach(m => m.dispose());
    },
  };
}
