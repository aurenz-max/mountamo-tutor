'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildAirliner, makeSkyEnvironment, PART_VIEWS, type Airliner } from './airliner3d';
import type { AirplanePart } from './airplaneModel';

export interface AirplaneSceneProps {
  airline: string;
  /** Painted on the stand. */
  code: string;
  /** The found part showing what it does, or null. */
  showing: AirplanePart | null;
  /** The finale takeoff. */
  flying: boolean;
  /** Where the camera goes; a new `focusKey` re-runs the move even to the same place. */
  focus: AirplanePart | 'overview';
  focusKey: string;
  /** Taps are ignored (the runtime has closed input, or the item is done). */
  disabled: boolean;
  onTapPart: (part: AirplanePart) => void;
  className?: string;
}

/** A point on (or just inside) each part, for drives: the ray to it hits that part first from most views. */
const PICK_POINTS: Record<AirplanePart, THREE.Vector3> = {
  nose: new THREE.Vector3(15.3, -0.32, 0),
  cockpit: new THREE.Vector3(13.0, 0.95, 0),
  cabin: new THREE.Vector3(3, 0.45, 1.3),
  wings: new THREE.Vector3(-1.6, -0.38, 7.5),
  engines: new THREE.Vector3(2.6, -1.62, 4.05),
  tail: new THREE.Vector3(-13.2, 4.6, 0),
  gear: new THREE.Vector3(12.22, -2.59, 0.2),
};

/** Wider for a narrow (portrait) canvas, so the whole jet stays in view. */
const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * (r > 18 ? 0.55 : 0.3)));

function viewPosition(view: (typeof PART_VIEWS)['overview'], aspect: number, origin: THREE.Vector3) {
  const target = view.t.clone().add(origin);
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(view.r, aspect), view.ph, view.th)).add(target);
  return { target, pos };
}

const Jet: React.FC<Omit<AirplaneSceneProps, 'className'>> = props => {
  const { gl, scene, camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const jet = useMemo<Airliner>(() => buildAirliner({ airline: props.airline, code: props.code,
    anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()) }), [props.airline, props.code, gl]);
  const live = useRef(props);
  live.current = props;

  useEffect(() => () => jet.dispose(), [jet]);
  useEffect(() => {
    const env = makeSkyEnvironment(gl);
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);

  // Camera moves: ease to the focus view over about a second, then hand the camera back to the learner.
  const move = useRef<{ t: number; fromT: THREE.Vector3; fromP: THREE.Vector3; toT: THREE.Vector3; toP: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { target, pos } = viewPosition(PART_VIEWS[props.focus], size.width / Math.max(1, size.height), jet.aircraft.position);
    move.current = { t: 0, fromT: c.target.clone(), fromP: camera.position.clone(), toT: target, toP: pos };
  }, [props.focus, props.focusKey, camera, jet, size.width, size.height]);

  useFrame((_, dt) => {
    jet.tick(dt, { showing: live.current.showing, flying: live.current.flying });
    const m = move.current, c = controls.current;
    if (m && c) {
      m.t = Math.min(1, m.t + dt / 1.1);
      const k = m.t * m.t * (3 - 2 * m.t);
      c.target.lerpVectors(m.fromT, m.toT, k);
      camera.position.lerpVectors(m.fromP, m.toP, k);
      c.update();
      if (m.t >= 1) move.current = null;
    } else if (c && live.current.flying) {
      // Follow the climb.
      const lift = jet.aircraft.position.y + 0.5 - c.target.y;
      c.target.y += lift; camera.position.y += lift; c.update();
    }
  });

  // Drives (dev/test only): where a part is on screen, so a script can tap it.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement & { __airplanePartPoint?: (p: AirplanePart) => { x: number; y: number } };
    el.__airplanePartPoint = (part: AirplanePart) => {
      const v = PICK_POINTS[part].clone(); jet.aircraft.localToWorld(v); v.project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
    return () => { delete el.__airplanePartPoint; };
  }, [gl, camera, jet]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (live.current.disabled || e.delta > 8) return; // a drag that turned the jet is not a tap
    for (const hit of e.intersections) {
      let visible = true;
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) { visible = false; break; }
      if (!visible) continue;
      const part = jet.partFromHit(hit.object, hit.point);
      if (part) live.current.onTapPart(part);
      return; // the first thing the ray meets decides: scenery in front is not an answer
    }
  };

  const start = viewPosition(PART_VIEWS.overview, size.width / Math.max(1, size.height), new THREE.Vector3());
  return (
    <>
      <primitive object={jet.root} onClick={onClick}
        onPointerOver={() => { gl.domElement.style.cursor = 'pointer'; }}
        onPointerOut={() => { gl.domElement.style.cursor = 'grab'; }} />
      <OrbitControls ref={controls as React.MutableRefObject<OrbitControlsImpl | null>} makeDefault enablePan={false}
        enableDamping dampingFactor={0.08} minDistance={5} maxDistance={85} maxPolarAngle={1.62}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const NO_WEBGL = 'This jet needs WebGL. Open it in a recent browser with hardware acceleration turned on.';

/** Whether this browser can draw WebGL (jsdom and some locked-down browsers cannot). */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D jet on its stand. Drag to turn, pinch or scroll to zoom, tap a part. */
export const AirplaneScene: React.FC<AirplaneSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => viewPosition(PART_VIEWS.overview, 16 / 10, new THREE.Vector3()), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-airplane-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-airplane-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 40, near: 0.1, far: 600, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ background: 'radial-gradient(130% 90% at 70% -10%, #ffffff 0%, #dcedfa 38%, #a9cbe8 78%, #8fb6d8 100%)', cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <Jet {...props} />
      </Canvas>
    </div>
  );
};

export default AirplaneScene;
