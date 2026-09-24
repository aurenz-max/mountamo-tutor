import { usePipSurface, usePipTargets } from './PipSurfaceContext';
import { stimulusPipPose } from './stimulusPipPose';
import { PIP_DOCK_CLASS } from './useWorkspacePipSurface';

/** The phases the pose reads. The scripted runner and the workspace runner both provide them. */
export interface StimulusPipRun<Item extends { id: string }> {
  currentItem: Item | null | undefined;
  canAttempt: boolean;
  running: boolean;
  preparing: boolean;
  currentSolved: boolean;
  revealHeld: boolean;
  stage: string;
  tutorSpeaking: boolean;
  cuedItemId: string | null;
}

export interface StimulusPipOptions<Item extends { id: string }> {
  run: StimulusPipRun<Item>;
  instanceId: string;
  label: string;
  /** The session is over (evaluation submitted); the surface withdraws. */
  finished?: boolean;
  /** See `StimulusPipState`. */
  cueId?: string;
  gesture?: boolean;
  handover?: boolean;
  /** Registered ids that are currently rendered, when some are hidden. */
  visibleIds?: string[];
}

/** A judged primitive's surface when its question side is one stimulus panel:
 * spread `target('stimulus')` on that panel and `dock` where the teaching
 * contract puts Pip. The runner's phases are the only inputs; the child's taps
 * reach Pip through `look(id)` in the primitive's own handlers.
 */
export function useStimulusPipSurface<Item extends { id: string }>(options: StimulusPipOptions<Item>) {
  const { run, instanceId, label } = options;
  const itemId = options.finished ? null : run.currentItem?.id ?? null;
  const pip = usePipTargets(itemId, run.canAttempt);

  const store = usePipSurface(() => {
    if (!pip.dock.current || !itemId) return null;
    const targets = pip.targets(options.visibleIds);
    const pose = stimulusPipPose({
      running: run.running, preparing: run.preparing,
      currentSolved: run.currentSolved, revealHeld: run.revealHeld,
      judging: run.stage === 'judging', tutorSpeaking: run.tutorSpeaking,
      cueMatchesItem: run.cuedItemId === itemId,
      visibleIds: targets.map((target) => target.id), lastTouchedId: pip.lastTouchedId,
      gesture: options.gesture, cueId: options.cueId, handover: options.handover,
    });
    return { instanceId, scopeId: itemId, label, dock: pip.dock.current, targets, pose };
  });

  return {
    store,
    look: pip.look,
    clear: pip.clear,
    dock: { ref: pip.dock, 'data-pip-dock': instanceId, className: PIP_DOCK_CLASS },
    target: (id: string) => ({ ref: pip.ref(id), 'data-pip-object': id }),
  };
}
