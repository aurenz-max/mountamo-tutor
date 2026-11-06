'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildWaveTank, WAVE_VIEW, type WaveSceneState, type WaveTarget, type WaveWorld } from './wave3d';
import type { KnockChallenge } from './waveModel';

export interface WaveSceneProps extends WaveSceneState {
  /** The item's tank (fixed per item); a new `partsKey` rebuilds it. */
  item: Pick<KnockChallenge, 'start' | 'sizeCap' | 'blocks'>;
  partsKey: string;
  /** A tap on a knob or the paddle. */
  onTap: (target: WaveTarget) => void;
  disabled: boolean;
  className?: string;
}

const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.7));
function startView(aspect: number) {
  const target = WAVE_VIEW.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(WAVE_VIEW.r, aspect), WAVE_VIEW.ph, WAVE_VIEW.th)).add(target);
  return { target, pos };
}

const World: React.FC<Omit<WaveSceneProps, 'className'>> = props => {
  const { gl, scene, camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo<WaveWorld>(() => buildWaveTank(props.item), [props.partsKey]);
  const live = useRef(props);
  live.current = props;

  useEffect(() => () => world.dispose(), [world]);
  useEffect(() => {
    scene.background = new THREE.Color(0xa9d4f0);
    return () => { scene.background = null; };
  }, [scene]);
  useEffect(() => {
    const { target, pos } = startView(size.width / Math.max(1, size.height));
    camera.position.copy(pos);
    controls.current?.target.copy(target);
  }, [camera, size.width, size.height]);

  useFrame((_, dt) => {
    const p = live.current;
    world.tick(Math.min(dt, 0.1), { size: p.size, speed: p.speed, run: p.run, crestMarks: p.crestMarks, startRings: p.startRings });
    controls.current?.update();
  });

  // Drives (dev/test only): where a knob or the paddle is on screen, so a script can tap it.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement & { __wavePoint?: (t: WaveTarget) => { x: number; y: number } };
    el.__wavePoint = (target: WaveTarget) => {
      const v = world.pickPoint(target).project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
    return () => { delete el.__wavePoint; };
  }, [gl, camera, world]);

  const firstTarget = (e: ThreeEvent<PointerEvent | MouseEvent>): WaveTarget | null => {
    for (const hit of e.intersections) {
      const t = world.targetFromHit(hit.object);
      if (t) return t;
    }
    return null;
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
        enableDamping dampingFactor={0.08} minDistance={5} maxDistance={34} maxPolarAngle={1.45}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const NO_WEBGL = 'The wave tank needs WebGL. Open it in a recent browser with hardware acceleration turned on.';
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D wave tank: drag to turn, pinch or scroll to zoom, tap a knob or the paddle. */
export const WaveScene: React.FC<WaveSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-wave-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-wave-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.1, far: 200, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <World {...props} />
      </Canvas>
    </div>
  );
};

export default WaveScene;
