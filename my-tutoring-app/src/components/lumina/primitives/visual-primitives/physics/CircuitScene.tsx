'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildWorkbench, CIRCUIT_VIEW, type CircuitSceneState, type CircuitTarget, type CircuitWorld } from './circuit3d';
import type { BulbColor, Clip, Wire } from './circuitModel';
import type { CondThing } from './conductorModel';
import type { MagnetThing } from './magnetModel';

export interface CircuitSceneProps {
  /** The bulbs on the table; a new `partsKey` rebuilds the table for a new item. */
  bulbs: readonly BulbColor[];
  partsKey: string;
  wires: readonly Wire[];
  powered: boolean;
  lit: readonly BulbColor[];
  short: boolean;
  selected: Clip | null;
  /** A wire whose clip came off (find_the_break). */
  loose?: Wire | null;
  /** A conductor item's test gap, and the thing lying across it. */
  gap?: boolean;
  inGap?: CondThing | null;
  /** A magnet item's thing under the magnet, and whether it is pulled up. */
  magnet?: boolean;
  held?: MagnetThing | null;
  stuck?: boolean;
  /** A switch item's switch, and whether it is on. */
  hasSwitch?: boolean;
  switchOn?: boolean;
  /** Lit bulbs that glow dimly, and bulbs taken out of their holders. */
  dim?: readonly BulbColor[];
  out?: readonly BulbColor[];
  /** The x-ray lever's charge dots (`circuitLevers.ts`). */
  xray?: CircuitSceneState['xray'];
  /** A tap on a clip post. */
  onTap: (target: CircuitTarget) => void;
  disabled: boolean;
  className?: string;
}

const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.6));
function startView(aspect: number) {
  const target = CIRCUIT_VIEW.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(CIRCUIT_VIEW.r, aspect), CIRCUIT_VIEW.ph, CIRCUIT_VIEW.th)).add(target);
  return { target, pos };
}

const World: React.FC<Omit<CircuitSceneProps, 'className'>> = props => {
  const { gl, scene, camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const world = useMemo<CircuitWorld>(() => buildWorkbench(props.bulbs, { gap: props.gap, switch: props.hasSwitch, magnet: props.magnet }), [props.partsKey]);
  const live = useRef(props);
  live.current = props;

  useEffect(() => () => world.dispose(), [world]);
  useEffect(() => {
    scene.background = new THREE.Color(0x1e2a3a);
    return () => { scene.background = null; };
  }, [scene]);

  useFrame((_, dt) => {
    const p = live.current;
    const state: CircuitSceneState = { bulbs: p.bulbs, wires: p.wires, powered: p.powered, lit: p.lit, short: p.short, selected: p.selected, loose: p.loose, inGap: p.inGap, switchOn: p.switchOn, dim: p.dim, out: p.out, xray: p.xray, held: p.held, stuck: p.stuck };
    world.tick(Math.min(dt, 0.25), state);
    controls.current?.update();
  });

  // Drives (dev/test only): where a clip is on screen, so a script can tap it.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement & { __circuitPoint?: (t: CircuitTarget) => { x: number; y: number } };
    el.__circuitPoint = (target: CircuitTarget) => {
      const v = world.pickPoint(target).project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
    return () => { delete el.__circuitPoint; };
  }, [gl, camera, world]);

  const firstTarget = (e: ThreeEvent<PointerEvent | MouseEvent>): CircuitTarget | null => {
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
        enableDamping dampingFactor={0.08} minDistance={7} maxDistance={30} maxPolarAngle={1.35}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const NO_WEBGL = 'The workbench needs WebGL. Open it in a recent browser with hardware acceleration turned on.';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D workbench: drag to turn, pinch or scroll to zoom, tap a clip. */
export const CircuitScene: React.FC<CircuitSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-circuit-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-circuit-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 0.1, far: 200, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <World {...props} />
      </Canvas>
    </div>
  );
};

export default CircuitScene;
