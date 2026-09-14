/** Local presentation state, authored by each primitive from its own phases.
 * No model tools, transcript commands, synthetic clicks, or answer mutations.
 */
export interface PipTarget {
  id: string;
  label: string;
  element: Element;
}

export type PipSurfacePhase = 'idle' | 'introducing' | 'working' | 'checking' | 'celebrating';

export interface PipPose {
  phase: PipSurfacePhase;
  targetId?: string;
  gesture: 'none' | 'look' | 'point' | 'receive';
}

export interface PipSurface {
  instanceId: string;
  scopeId: string;
  label: string;
  dock: HTMLElement;
  targets: PipTarget[];
  pose: PipPose;
}

const samePose = (a: PipPose, b: PipPose) =>
  a.phase === b.phase && a.gesture === b.gesture && a.targetId === b.targetId;

const sameSurface = (a: PipSurface, b: PipSurface) =>
  a.instanceId === b.instanceId && a.scopeId === b.scopeId && a.label === b.label && a.dock === b.dock
  && samePose(a.pose, b.pose) && a.targets.length === b.targets.length
  && a.targets.every((t, i) => t.id === b.targets[i].id && t.element === b.targets[i].element && t.label === b.targets[i].label);

/** Which surface Pip joins is decided by events, never by a tutor connection:
 * the first surface to register, then whichever surface's pose last moved into
 * a non-idle phase (a start, a touch, a check, a cue). A host may also claim a
 * surface explicitly (the lesson's focused section, the tutor's active block).
 */
export class PipSurfaceStore {
  private surfaces = new Map<string, PipSurface>();
  private listeners = new Set<() => void>();
  private version = 0;
  private activeId: string | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.version;
  private emit() { this.version++; this.listeners.forEach((fn) => fn()); }

  /** Explicit claim by a host. A claim on a primitive with no surface parks Pip
   *  (the companion falls back to its perch) until a surface engages. */
  setActive(instanceId: string | null) {
    if (this.activeId === instanceId) return;
    this.activeId = instanceId;
    this.emit();
  }

  getActive = () => this.activeId ? this.surfaces.get(this.activeId) ?? null : null;

  publish(surface: PipSurface) {
    const previous = this.surfaces.get(surface.instanceId);
    if (previous && sameSurface(previous, surface)) return;
    this.surfaces.set(surface.instanceId, surface);
    const engaged = !!previous && !samePose(previous.pose, surface.pose) && surface.pose.phase !== 'idle';
    if (this.activeId === null || engaged) this.activeId = surface.instanceId;
    this.emit();
  }

  remove(instanceId: string, dock: HTMLElement) {
    if (this.surfaces.get(instanceId)?.dock !== dock) return;
    this.surfaces.delete(instanceId);
    if (this.activeId === instanceId) this.activeId = Array.from(this.surfaces.keys()).pop() ?? null;
    this.emit();
  }
}
