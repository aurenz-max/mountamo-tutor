'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { buildSkidYard, makeSkyEnvironment, YARD_VIEW, type SkidYard, type YardItem } from './skidSteer3d';
import type { Attachment, Job, Levers, MoveResult } from './skidSteerModel';

export interface SkidSteerSceneProps {
  /** What the yard holds: a thing to turn toward, or a job in front of the machine. */
  item: YardItem;
  /** A new key builds the item fresh (a new item, or Try again). */
  itemKey: string;
  levers: Levers;
  /** The attachment on the quick-attach plate (null: a bare plate). */
  tool: Attachment | null;
  /** The move or the job try to run; a new `id` starts it. */
  move:
    | { id: string; kind: 'turn'; levers: Levers; result: MoveResult; correct: boolean }
    | { id: string; kind: 'job'; job: Job; tool: Attachment; correct: boolean }
    | null;
  /** The move has finished (bump and celebration included). */
  onDone: (id: string) => void;
  /** A new key turns the camera back to the start view. */
  viewKey: string;
  className?: string;
}

const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.6));

function startView(aspect: number) {
  const target = YARD_VIEW.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(YARD_VIEW.r, aspect), YARD_VIEW.ph, YARD_VIEW.th)).add(target);
  return { target, pos };
}

const Yard: React.FC<Omit<SkidSteerSceneProps, 'className'>> = props => {
  const { gl, scene, camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const yard = useMemo<SkidYard>(() => buildSkidYard({ anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()) }), [gl]);
  const live = useRef(props);
  live.current = props;

  useEffect(() => () => yard.dispose(), [yard]);
  useEffect(() => {
    const env = makeSkyEnvironment(gl);
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);

  useEffect(() => {
    yard.setItem(live.current.item);
    yard.setTool(live.current.tool);
  }, [props.itemKey, yard]);

  useEffect(() => { if (!yard.busy()) yard.setTool(props.tool); }, [props.tool, yard]);

  useEffect(() => { yard.showLevers(props.levers); }, [props.levers, yard]);

  const ran = useRef<string | null>(null);
  useEffect(() => {
    const m = props.move;
    if (!m || ran.current === m.id) return;
    ran.current = m.id;
    const done = () => live.current.onDone(m.id);
    if (m.kind === 'turn') yard.play(m.levers, m.result, m.correct, done);
    else yard.playJob(m.job, m.tool, m.correct, done);
  }, [props.move, yard]);

  const ease = useRef<{ t: number; fromT: THREE.Vector3; fromP: THREE.Vector3; toT: THREE.Vector3; toP: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { target, pos } = startView(size.width / Math.max(1, size.height));
    ease.current = { t: 0, fromT: c.target.clone(), fromP: camera.position.clone(), toT: target, toP: pos };
  }, [props.viewKey, camera, size.width, size.height]);

  useFrame((_, dt) => {
    yard.tick(dt);
    const m = ease.current, c = controls.current;
    if (m && c) {
      m.t = Math.min(1, m.t + dt / 1.1);
      const k = m.t * m.t * (3 - 2 * m.t);
      c.target.lerpVectors(m.fromT, m.toT, k);
      camera.position.lerpVectors(m.fromP, m.toP, k);
      c.update();
      if (m.t >= 1) ease.current = null;
    }
  });

  const start = startView(size.width / Math.max(1, size.height));
  return (
    <>
      <primitive object={yard.root} />
      <OrbitControls ref={controls as React.MutableRefObject<OrbitControlsImpl | null>} makeDefault enablePan={false}
        enableDamping dampingFactor={0.08} minDistance={7} maxDistance={40} maxPolarAngle={1.42}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const NO_WEBGL = 'This yard needs WebGL. Open it in a recent browser with hardware acceleration turned on.';

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D yard. Drag to turn, pinch or scroll to zoom. Without WebGL every move finishes at once. */
export const SkidSteerScene: React.FC<SkidSteerSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  const { move, onDone } = props;
  useEffect(() => { if (!gl && move) onDone(move.id); }, [gl, move, onDone]);
  if (!gl) {
    return <div className={className} data-skid-steer-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-skid-steer-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 40, near: 0.1, far: 300, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ background: 'radial-gradient(130% 90% at 70% -10%, #ffffff 0%, #e6f0f8 38%, #b9d3ea 78%, #9cc0de 100%)', cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <Yard {...props} />
      </Canvas>
    </div>
  );
};

export default SkidSteerScene;
