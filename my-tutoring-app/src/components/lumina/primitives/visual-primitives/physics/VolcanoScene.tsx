'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  buildIsland, buildKitchenTable, ISLAND_VIEW, VOLCANO_VIEW, type IslandSceneState, type VolcanoSceneState,
} from './volcano3d';

export interface VolcanoSceneProps extends VolcanoSceneState, Partial<IslandSceneState> {
  /** Which world: the kitchen table (kitchen_volcano) or the island (runny_or_sticky). */
  world?: 'kitchen' | 'island';
  /** A new key rebuilds the world for a new item. */
  partsKey: string;
  className?: string;
}

type View = typeof VOLCANO_VIEW;
const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.6));
function startView(aspect: number, v: View) {
  const target = v.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(v.r, aspect), v.ph, v.th)).add(target);
  return { target, pos };
}

const World: React.FC<Omit<VolcanoSceneProps, 'className'>> = props => {
  const { scene, size, camera } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const island = props.world === 'island';
  const view = island ? ISLAND_VIEW : VOLCANO_VIEW;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo(() => (island ? buildIsland() : buildKitchenTable()), [props.partsKey, island]);
  const live = useRef(props);
  live.current = props;
  useEffect(() => () => world.dispose(), [world]);
  useEffect(() => {
    scene.background = new THREE.Color(island ? 0x9fd0ee : 0x24324a);
    return () => { scene.background = null; };
  }, [scene, island]);
  useEffect(() => {
    const { target, pos } = startView(size.width / Math.max(1, size.height), view);
    camera.position.copy(pos);
    controls.current?.target.copy(target);
  }, [island, camera, size.width, size.height, view]);
  useFrame((_, dt) => {
    const p = live.current, d = Math.min(dt, 0.25);
    if ('eruptionKey' in world || island) {
      (world as ReturnType<typeof buildIsland>).tick(d, { eruption: p.eruption ?? null, eruptionKey: p.eruptionKey ?? '' });
    } else {
      (world as ReturnType<typeof buildKitchenTable>).tick(d, { a: p.a, b: p.b });
    }
    controls.current?.update();
  });
  const start = startView(size.width / Math.max(1, size.height), view);
  return (
    <>
      <primitive object={world.root} />
      <OrbitControls ref={controls as React.MutableRefObject<OrbitControlsImpl | null>} makeDefault enablePan={false}
        enableDamping dampingFactor={0.08} minDistance={7} maxDistance={40} maxPolarAngle={1.4}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const NO_WEBGL = 'The volcanoes need WebGL. Open them in a recent browser with hardware acceleration turned on.';
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D kitchen table (volcanoes A and B) or the island: drag to turn, pinch or scroll to zoom. */
export const VolcanoScene: React.FC<VolcanoSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10, props.world === 'island' ? ISLAND_VIEW : VOLCANO_VIEW), [props.world]);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-volcano-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-volcano-scene="3d" data-volcano-world={props.world ?? 'kitchen'}>
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.1, far: 300, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <World {...props} />
      </Canvas>
    </div>
  );
};

export default VolcanoScene;
