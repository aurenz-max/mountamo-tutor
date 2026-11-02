'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { makeSkyEnvironment } from '../engineering/airliner3d';
import { buildHarbor, HARBOR_VIEWS, type HarborState, type HarborTarget, type HarborView, type HarborWorld, type Slot } from './buoyancy3d';
import type { HarborThing } from './buoyancyModel';

export interface BuoyancySceneProps {
  /** The item's things: the two tests, then the mystery (or a salt item's one to three foods, or a rule item's tests and
   *  the things to sort). A new `thingsKey` puts them out on the pier. */
  things: readonly HarborThing[] | null;
  thingsKey: string;
  /** Put the things in a row with these on yellow stands (absent: the drop test's three places). */
  stands?: readonly number[];
  dropped: readonly boolean[];
  selected: Slot | null;
  evidence: 0 | 1 | null;
  finale: boolean;
  /** The boat item's build, whether it is in the tank, and its pennies (undefined on a drop test). */
  boat?: HarborState['boat'];
  /** Lever drawings (`buoyancyLevers.ts`): force arrows, material tags, an extra pair at the back, model boats. */
  xray?: boolean;
  tags?: boolean;
  extras?: HarborState['extras'];
  modelBoats?: HarborState['modelBoats'];
  /** Spoons of salt in the tank (a salt item). */
  spoons?: number;
  /** A tap on a thing (on the pier or in the tank). */
  onTap: (target: HarborTarget) => void;
  /** A new key turns the camera to `view` (the start view by default). */
  viewKey: string;
  view?: HarborView;
  disabled: boolean;
  className?: string;
}

const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.6));

function startView(aspect: number, view: HarborView = 'start') {
  const v = HARBOR_VIEWS[view];
  const target = v.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(v.r, aspect), v.ph, v.th)).add(target);
  return { target, pos };
}

const World: React.FC<Omit<BuoyancySceneProps, 'className'>> = props => {
  const { gl, scene, camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const world = useMemo<HarborWorld>(() => buildHarbor({ anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()) }), [gl]);
  const live = useRef(props);
  live.current = props;

  useEffect(() => () => world.dispose(), [world]);
  useEffect(() => {
    const env = makeSkyEnvironment(gl);
    scene.environment = env;
    scene.background = new THREE.Color(0xbfe0f2);
    return () => { scene.environment = null; scene.background = null; env.dispose(); };
  }, [gl, scene]);

  useEffect(() => { world.setThings(live.current.things, live.current.stands); }, [props.thingsKey, world]);

  const move = useRef<{ t: number; fromT: THREE.Vector3; fromP: THREE.Vector3; toT: THREE.Vector3; toP: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { target, pos } = startView(size.width / Math.max(1, size.height), props.view);
    move.current = { t: 0, fromT: c.target.clone(), fromP: camera.position.clone(), toT: target, toP: pos };
  }, [props.viewKey, props.view, camera, size.width, size.height]);

  useFrame((_, dt) => {
    const p = live.current;
    const state: HarborState = { dropped: p.dropped, selected: p.selected, evidence: p.evidence, finale: p.finale, boat: p.boat,
      xray: p.xray, tags: p.tags, extras: p.extras, modelBoats: p.modelBoats, spoons: p.spoons };
    world.tick(Math.min(dt, 0.25), state, camera);
    const m = move.current, c = controls.current;
    if (m && c) {
      m.t = Math.min(1, m.t + dt / 1.2);
      const k = m.t * m.t * (3 - 2 * m.t);
      c.target.lerpVectors(m.fromT, m.toT, k);
      camera.position.lerpVectors(m.fromP, m.toP, k);
      c.update();
      if (m.t >= 1) move.current = null;
    }
  });

  // Drives (dev/test only): where a thing is on screen, so a script can tap it.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement & { __harborPoint?: (t: HarborTarget) => { x: number; y: number } };
    el.__harborPoint = (target: HarborTarget) => {
      const v = world.pickPoint(target).project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
    return () => { delete el.__harborPoint; };
  }, [gl, camera, world]);

  /** The nearest thing hit; the tank only when no thing is behind its glass (a test in the tank stays tappable). */
  const firstTarget = (e: ThreeEvent<PointerEvent | MouseEvent>): HarborTarget | null => {
    let water = false;
    for (const hit of e.intersections) {
      const t = world.targetFromHit(hit.object);
      if (t === 'pass') continue;
      if (t === 'water') { water = true; continue; }
      return t ?? (water ? 'water' : null); // the deck or tank floor behind the water is still a tap on the water
    }
    return water ? 'water' : null;
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (live.current.disabled || e.delta > 8) return; // a drag that turned the view is not a tap
    const t = firstTarget(e);
    if (t) live.current.onTap(t);
  };

  const start = startView(size.width / Math.max(1, size.height));
  return (
    <>
      <primitive object={world.root} onClick={onClick}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          gl.domElement.style.cursor = !live.current.disabled && firstTarget(e) ? 'pointer' : 'grab';
        }} />
      <OrbitControls ref={controls as React.MutableRefObject<OrbitControlsImpl | null>} makeDefault enablePan={false}
        enableDamping dampingFactor={0.08} minDistance={8} maxDistance={40} maxPolarAngle={1.45}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const NO_WEBGL = 'The harbor needs WebGL. Open it in a recent browser with hardware acceleration turned on.';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D harbor: drag to turn, pinch or scroll to zoom, tap a thing. */
export const BuoyancyScene: React.FC<BuoyancySceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-harbor-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-harbor-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.1, far: 400, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <World {...props} />
      </Canvas>
    </div>
  );
};

export default BuoyancyScene;
