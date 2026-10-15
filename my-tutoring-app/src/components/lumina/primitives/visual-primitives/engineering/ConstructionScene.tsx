'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  buildConstructionSite, makeSkyEnvironment, SITE_VIEW,
  type ConstructionSite, type SiteAction, type SiteTarget,
} from './construction3d';
import type { Material } from './constructionModel';

export interface ConstructionSceneProps {
  company: string;
  material: Material;
  loaded: number;
  spilled: number;
  holding: boolean;
  capacityTons: number | null;
  departing: boolean;
  squash: boolean;
  finale: boolean;
  /** A new key rolls a new, empty truck in. */
  truckKey: string;
  /** The excavator action to run; a new `id` starts it. */
  action: (SiteAction & { id: string }) | null;
  /** `onMoment` when the scoop changes hands, `onIdle` when the arm is back at rest. */
  onMoment: (id: string) => void;
  onIdle: (id: string) => void;
  /** A new key turns the camera back to the start view. */
  viewKey: string;
  /** Taps are ignored (the runtime has closed input, an action is running, or the item is done). */
  disabled: boolean;
  onTap: (target: SiteTarget) => void;
  className?: string;
}

/** Wider for a narrow (portrait) canvas, so the whole site stays in view. */
const fitDistance = (r: number, aspect: number) => (aspect >= 1 ? r : r * (1 + (1 / aspect - 1) * 0.55));

function startView(aspect: number) {
  const target = SITE_VIEW.t.clone();
  const pos = new THREE.Vector3().setFromSpherical(new THREE.Spherical(fitDistance(SITE_VIEW.r, aspect), SITE_VIEW.ph, SITE_VIEW.th)).add(target);
  return { target, pos };
}

const Site: React.FC<Omit<ConstructionSceneProps, 'className'>> = props => {
  const { gl, scene, camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const site = useMemo<ConstructionSite>(() => buildConstructionSite({ company: props.company,
    anisotropy: Math.min(8, gl.capabilities.getMaxAnisotropy()) }), [props.company, gl]);
  const live = useRef(props);
  live.current = props;

  useEffect(() => () => site.dispose(), [site]);
  useEffect(() => {
    const env = makeSkyEnvironment(gl);
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); };
  }, [gl, scene]);

  // A new truck for each load.
  const firstTruck = useRef(true);
  useEffect(() => {
    if (firstTruck.current) { firstTruck.current = false; return; }
    site.newTruck();
  }, [props.truckKey, site]);

  // Run each new action once.
  const ran = useRef<string | null>(null);
  useEffect(() => {
    const a = props.action;
    if (!a || ran.current === a.id) return;
    ran.current = a.id;
    const id = a.id;
    site.run(a, siteState(live.current), { onMoment: () => live.current.onMoment(id), onIdle: () => live.current.onIdle(id) });
  }, [props.action, site]);

  // Camera: ease back to the start view on request.
  const move = useRef<{ t: number; fromT: THREE.Vector3; fromP: THREE.Vector3; toT: THREE.Vector3; toP: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const { target, pos } = startView(size.width / Math.max(1, size.height));
    move.current = { t: 0, fromT: c.target.clone(), fromP: camera.position.clone(), toT: target, toP: pos };
  }, [props.viewKey, camera, size.width, size.height]);

  useFrame((_, dt) => {
    site.tick(dt, siteState(live.current));
    const m = move.current, c = controls.current;
    if (m && c) {
      m.t = Math.min(1, m.t + dt / 1.1);
      const k = m.t * m.t * (3 - 2 * m.t);
      c.target.lerpVectors(m.fromT, m.toT, k);
      camera.position.lerpVectors(m.fromP, m.toP, k);
      c.update();
      if (m.t >= 1) move.current = null;
    }
  });

  // Drives (dev/test only): where a target is on screen, so a script can tap it.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement & { __constructionPoint?: (t: SiteTarget) => { x: number; y: number }; __constructionBusy?: () => boolean };
    el.__constructionPoint = (target: SiteTarget) => {
      const v = site.pickPoint(target).project(camera);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
    };
    el.__constructionBusy = () => site.busy();
    return () => { delete el.__constructionPoint; delete el.__constructionBusy; };
  }, [gl, camera, site]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (live.current.disabled || e.delta > 8) return; // a drag that turned the site is not a tap
    for (const hit of e.intersections) {
      const target = site.targetFromHit(hit.object);
      if (target === 'pass') continue; // the excavator, a ram, a falling scoop: look behind it
      if (target) live.current.onTap(target);
      return; // the ground or scenery in front is no target
    }
  };

  const start = startView(size.width / Math.max(1, size.height));
  return (
    <>
      <primitive object={site.root} onClick={onClick}
        onPointerOver={() => { gl.domElement.style.cursor = 'pointer'; }}
        onPointerOut={() => { gl.domElement.style.cursor = 'grab'; }} />
      <OrbitControls ref={controls as React.MutableRefObject<OrbitControlsImpl | null>} makeDefault enablePan={false}
        enableDamping dampingFactor={0.08} minDistance={6} maxDistance={55} maxPolarAngle={1.45}
        target={[start.target.x, start.target.y, start.target.z]} />
    </>
  );
};

const siteState = (p: Omit<ConstructionSceneProps, 'className'>) => ({
  material: p.material, loaded: p.loaded, spilled: p.spilled, holding: p.holding, capacityTons: p.capacityTons,
  departing: p.departing, squash: p.squash, finale: p.finale,
});

const NO_WEBGL = 'This work site needs WebGL. Open it in a recent browser with hardware acceleration turned on.';

/** Whether this browser can draw WebGL (jsdom and some locked-down browsers cannot). */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/** The 3D work site. Drag to turn, pinch or scroll to zoom, tap the pile or the truck. */
export const ConstructionScene: React.FC<ConstructionSceneProps> = ({ className, ...props }) => {
  const initial = useMemo(() => startView(16 / 10), []);
  const [gl] = React.useState(() => typeof document !== 'undefined' && webglAvailable());
  if (!gl) {
    return <div className={className} data-construction-scene="no-webgl">
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>
    </div>;
  }
  return (
    <div className={className} style={{ touchAction: 'none' }} data-construction-scene="3d">
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 40, near: 0.1, far: 400, position: [initial.pos.x, initial.pos.y, initial.pos.z] }}
        style={{ background: 'radial-gradient(130% 90% at 70% -10%, #ffffff 0%, #e6f0f8 38%, #b9d3ea 78%, #9cc0de 100%)', cursor: 'grab' }}
        fallback={<div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-300">{NO_WEBGL}</div>}>
        <Site {...props} />
      </Canvas>
    </div>
  );
};

export default ConstructionScene;
