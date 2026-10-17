'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildEcosystem, makeSkyEnvironment, TANK_VIEWS, type EcoState, type EcoTarget, type EcosystemWorld, type TankFocus } from './ecosystem3d';
import type { Side, TestThing } from './ecosystemModel';
import type { LifeState } from './ecosystemLife3d';

export interface EcosystemSceneProps {
  islandName: string;
  /** The two things on test; a new `testKey` puts them out. */
  test: { left: TestThing; right: TestThing } | null;
  testKey: string;
  fills: { left: number; right: number };
  sunP: number;
  guess: Side | null;
  picked: Side | null;
  verdict: 'correct' | 'incorrect' | null;
  /** The sun can be dragged (or run by `autoRunKey`). */
  sunActive: boolean;
  finale: boolean;
  /** A new key runs the sun the rest of the way across the sky. */
  autoRunKey: string | null;
  /** The sun moved to day progress p (a drag or the auto run). */
  onSun: (p: number) => void;
  /** A tap on a thing on test, an animal or a winter place. */
  onTap: (target: Exclude<EcoTarget, 'sun'>) => void;
  /** The living layer. Winter, growth and droop ease toward these values in the scene. */
  life: LifeState;
  /** Where the camera looks: close on the test, or wide enough to see the sun's whole path. It eases on a change. */
  focus: TankFocus;
  /** A new key turns the camera back to the view for `focus`. */
  viewKey: string;
  /** Taps and drags are ignored (the runtime has closed input, or the item is done). */
  disabled: boolean;
  className?: string;
}

const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.6));

function startView(aspect: number, focus: TankFocus = 'test') {
  const v = TANK_VIEWS[focus];
  const target = v.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(v.r, aspect), v.ph, v.th)).add(target);
  return { target, pos };
}

const AUTO_RUN_SECONDS = 5;

const World: React.FC<Omit<EcosystemSceneProps, 'className'>> = props => {
  const { gl, scene, camera, size, raycaster } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const world = useMemo<EcosystemWorld>(() => buildEcosystem({ islandName: props.islandName,
    anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()) }), [props.islandName, gl]);
  const live = useRef(props);
  live.current = props;

  useEffect(() => () => world.dispose(), [world]);
  useEffect(() => {
    const env = makeSkyEnvironment(gl);
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);

  // Put out the things for each new test.
  useEffect(() => { world.setTest(live.current.test); }, [props.testKey, world]);

  // The auto run: the sun travels from where it is to the end of its arc.
  const auto = useRef<{ from: number; t: number } | null>(null);
  useEffect(() => {
    if (props.autoRunKey) auto.current = { from: live.current.sunP, t: 0 };
  }, [props.autoRunKey]);

  // Dragging the sun along its arc.
  const dragging = useRef(false);
  useEffect(() => {
    const el = gl.domElement;
    const ndc = new THREE.Vector2();
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const p = world.sunParamFromRay(raycaster.ray);
      if (p != null && live.current.sunActive && !live.current.disabled) live.current.onSun(p);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (controls.current) controls.current.enabled = true;
      el.style.cursor = 'grab';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [gl, camera, raycaster, world]);

  // Camera: ease back to the start view on request.
  const move = useRef<{ t: number; fromT: THREE.Vector3; fromP: THREE.Vector3; toT: THREE.Vector3; toP: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { target, pos } = startView(size.width / Math.max(1, size.height), props.focus);
    move.current = { t: 0, fromT: c.target.clone(), fromP: camera.position.clone(), toT: target, toP: pos };
  }, [props.viewKey, props.focus, camera, size.width, size.height]);

  const eased = useRef({ winter: 0, growth: 0, droop: 0, plantKey: '' });
  useFrame((_, dt) => {
    const p = live.current;
    const e = eased.current;
    const k = 1 - Math.exp(-dt * 0.9);
    e.winter += (p.life.winter - e.winter) * k;
    const plantKey = p.life.plant ? `${p.testKey}` : '';
    if (plantKey !== e.plantKey) { e.plantKey = plantKey; e.growth = p.life.plant?.growth ?? 0; e.droop = p.life.plant?.droop ?? 0; }
    if (p.life.plant) { e.growth += (p.life.plant.growth - e.growth) * k * 1.6; e.droop += (p.life.plant.droop - e.droop) * k * 1.6; }
    const a = auto.current;
    if (a) {
      if (!p.sunActive || p.disabled) auto.current = null;
      else {
        a.t = Math.min(1, a.t + dt / AUTO_RUN_SECONDS);
        p.onSun(a.from + (1 - a.from) * a.t);
        if (a.t >= 1) auto.current = null;
      }
    }
    world.tick(Math.min(dt, 0.05), { ...stateOf(p), life: { ...p.life, winter: e.winter,
      plant: p.life.plant ? { ...p.life.plant, growth: e.growth, droop: e.droop } : null } }, camera);
    const m = move.current, c = controls.current;
    if (m && c) {
      m.t = Math.min(1, m.t + dt / 1.4);
      const k = m.t * m.t * (3 - 2 * m.t);
      c.target.lerpVectors(m.fromT, m.toT, k);
      camera.position.lerpVectors(m.fromP, m.toP, k);
      c.update();
      if (m.t >= 1) move.current = null;
    }
  });

  // Drives (dev/test only): where a target is on screen, so a script can tap or drag it.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement & { __ecosystemPoint?: (t: EcoTarget) => { x: number; y: number }; __ecosystemBusy?: () => boolean };
    el.__ecosystemPoint = (target: EcoTarget) => {
      const v = world.pickPoint(target).project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
    el.__ecosystemBusy = () => dragging.current || !!auto.current;
    return () => { delete el.__ecosystemPoint; delete el.__ecosystemBusy; };
  }, [gl, camera, world]);

  /** The first real target under the pointer, looking through glass, water, the hut and the animals. */
  const firstTarget = (e: ThreeEvent<PointerEvent | MouseEvent>): EcoTarget | null => {
    for (const hit of e.intersections) {
      const t = world.targetFromHit(hit.object);
      if (t === 'pass') continue;
      return t;
    }
    return null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    const p = live.current;
    if (p.disabled || !p.sunActive) return;
    if (firstTarget(e) !== 'sun') return;
    e.stopPropagation();
    dragging.current = true;
    auto.current = null;
    if (controls.current) controls.current.enabled = false;
    gl.domElement.style.cursor = 'grabbing';
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (live.current.disabled || e.delta > 8) return; // a drag that turned the tank is not a tap
    const t = firstTarget(e);
    if (t && t !== 'sun') live.current.onTap(t);
  };

  const start = startView(size.width / Math.max(1, size.height), props.focus);
  return (
    <>
      <primitive object={world.root} onClick={onClick} onPointerDown={onPointerDown}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (dragging.current) return;
          const t = firstTarget(e);
          const p = live.current;
          gl.domElement.style.cursor = !p.disabled && ((t === 'sun' && p.sunActive) || (t && t !== 'sun')) ? 'pointer' : 'grab';
        }} />
      <OrbitControls ref={controls as React.MutableRefObject<OrbitControlsImpl | null>} makeDefault enablePan={false}
        enableDamping dampingFactor={0.08} minDistance={14} maxDistance={70} maxPolarAngle={1.5}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const stateOf = (p: Omit<EcosystemSceneProps, 'className'>): EcoState => ({
  test: p.test, fills: p.fills, sunP: p.sunP, guess: p.guess, picked: p.picked, verdict: p.verdict,
  sunActive: p.sunActive && !p.disabled, finale: p.finale, life: p.life,
});

export type { LifeState };

const NO_WEBGL = 'This island tank needs WebGL. Open it in a recent browser with hardware acceleration turned on.';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D island tank. Drag to turn, pinch or scroll to zoom, drag the sun, tap a thing on test. */
export const EcosystemScene: React.FC<EcosystemSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-ecosystem-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-ecosystem-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.1, far: 400, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, #fff8ea 0%, #f3e6cf 40%, #d9c3a0 80%, #c4a983 100%)', cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <World {...props} />
      </Canvas>
    </div>
  );
};

export default EcosystemScene;
