/**
 * Machine Workshop's scene on the shared tutor/JEV teaching workspace. Every item is a build the activity checks (the
 * card, `machineWorkshop.card.ts`, names the moves), so no key reaches the tutor. The scene carries what is drawn and
 * what the tutor needs to TEACH it (user 11-05: the tutor said "find the missing part" and nothing about the goal or
 * the motion): what the machine is for, how its wheel moves and how its working end must move, what each tray part
 * looks like, what is fitted, and what each run did. Which parts work is never in it, and the slot's own job (the
 * principle) appears only once the machine has worked.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import {
  KIND_NAMES, PART_GUIDE, TRAY_NAMES, endWord, isConverter, isDriver, loadStage, outcomeWords, trayName, type Build,
  type MachineChallenge, type MachineRunRow,
} from './machineModel';

export interface MachineView {
  build: Build;
  runs: readonly MachineRunRow[];
  running: boolean;
  solved: boolean;
}

const fitted = (c: MachineChallenge, id: string | null) => {
  const p = c.tray.find(x => x.id === id);
  return p ? `a ${trayName(p)}` : 'nothing';
};

export function machineScene(c: MachineChallenge, view: MachineView): SceneOf {
  const end = endWord(loadStage(c).kind);
  const stages = c.stages.map((s, i) => (isConverter(s.kind)
    ? `${i + 1}. the missing part (empty: the learner builds it)${view.solved ? `: ${s.job}` : ''}`
    : `${i + 1}. ${KIND_NAMES[s.kind]}: ${s.job}`)).join('; ');
  // One line per kind of part, with its sizes, so the facts stay short (each fact is capped at 500 characters).
  const parts = (driver: boolean) => {
    const own = c.tray.filter(p => isDriver(p.part) === driver);
    return Array.from(new Set(own.map(p => p.part))).map(k => {
      const sizes = own.filter(p => p.part === k && p.size !== 'one').map(p => p.size);
      return `${TRAY_NAMES[k]}${sizes.length ? ` (${sizes.join(', ')})` : ''}: ${PART_GUIDE[k]}`;
    }).join('; ').slice(0, 500);
  };
  const facts: Record<string, string | number> = {
    bench: `a ${c.name.toLowerCase()} (${c.where}) drawn from the side on a workbench, its stages left to right the way `
      + 'power flows, with the missing part as an empty dashed circle marked "?" on the last wheel. Parts are picked from '
      + 'two rows of picture buttons under it.',
    machine: c.intro,
    goal: `make the ${c.name.toLowerCase()} work: it ${c.doesWord}`,
    howItMoves: `the wheel at the missing part already spins round and round (it is spinning now, labelled "spins"); `
      + `the ${end} has to go up and down (labelled "must go up and down"); the missing part has to turn the spinning `
      + 'into up-and-down',
    stages,
    wheelParts: parts(true),
    joiningParts: parts(false),
    instruction: c.instruction,
    fitted: `on the spinning wheel: ${fitted(c, view.build.driver)}; joining it to the ${end}: ${fitted(c, view.build.link)}`,
    step: view.running ? 'the machine is running' : view.solved ? 'the machine works' : view.runs.length ? 'trying ideas' : 'not started',
    runs: view.runs.length
      ? view.runs.map((r, i) => `run ${i + 1}: ${fitted(c, r.driver)} with ${fitted(c, r.link)}: ${outcomeWords(c, r.outcome)}`).join('; ').slice(0, 500)
      : 'none yet',
    constraints: 'Two steps in order: step 1 puts a part on the spinning wheel, step 2 joins it to the working end, and the '
      + 'machine runs by itself as soon as it is joined; swapping either part runs it again. A lab notebook lists each run, '
      + 'and each run that did not work shows why. While a run plays, the path of the moving part is traced. "I\'m done!" '
      + 'checks the build.',
  };
  return { objects: [], facts };
}
