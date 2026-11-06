'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildMarbleRun, MARBLE_VIEW, type MarbleSceneState, type MarbleTarget, type MarbleWorld } from './marble3d';
import { buildTrack, type LoopChallenge } from './marbleModel';

export interface MarbleSceneProps extends MarbleSceneState {
  /** The item's run (fixed per item); a new `partsKey` rebuilds the park. */
  item: Pick<LoopChallenge, 'pegs' | 'loopR' | 'carpet'>;
  partsKey: string;
  /** A tap on a peg or the marble. */
  onTap: (target: MarbleTarget) => void;
  disabled: boolean;
  className?: string;
}

const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.7));
function startView(aspect: number) {
  const target = MARBLE_VIEW.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(MARBLE_VIEW.r, aspect), MARBLE_VIEW.ph, MARBLE_VIEW.th)).add(target);
  return { target, pos };
}

const World: React.FC<Omit<MarbleSceneProps, 'className'>> = props => {
  const { gl, scene, camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo<MarbleWorld>(() => buildMarbleRun(props.item, buildTrack(props.item)), [props.partsKey]);
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
    world.tick(Math.min(dt, 0.1), { peg: p.peg, run: p.run, topLine: p.topLine, pegMarks: p.pegMarks });
    controls.current?.update();
  });

  // Drives (dev/test only): where a peg or the marble is on screen, so a script can tap it.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement & { __marblePoint?: (t: MarbleTarget) => { x: number; y: number } };
    el.__marblePoint = (target: MarbleTarget) => {
      const v = world.pickPoint(target).project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
    return () => { delete el.__marblePoint; };
  }, [gl, camera, world]);

  const firstTarget = (e: ThreeEvent<PointerEvent | MouseEvent>): MarbleTarget | null => {
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

const NO_WEBGL = 'The marble run needs WebGL. Open it in a recent browser with hardware acceleration turned on.';
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D marble run: drag to turn, pinch or scroll to zoom, tap a peg or the marble. */
export const MarbleScene: React.FC<MarbleSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-marble-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-marble-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.1, far: 200, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <World {...props} />
      </Canvas>
    </div>
  );
};

export default MarbleScene;
