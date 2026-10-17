/**
 * Ecosystem diorama on the shared tutor/JEV teaching workspace (born bound, plain shape). Every item is one gesture
 * item: the world runs what the learner sets up, and code judges. No key ever reaches the tutor; the scene carries
 * what is drawn (thermometer marks, the pictures in a weather log, where each animal is).
 *
 * - sun_test: tap a guess, move the sun, tap the thing that got warmer (the check).
 * - season_from_log: play the month (the log fills), pick a season, then tap the weather that shows it (the check).
 * - compare_logs: play both months, then tap the log that answers the question (the check).
 * - plant_needs: set the pot's place, soil and water, then Watch it grow (the check).
 * - season_behavior: bring winter, move each animal to a winter place, then Done (the check).
 * - keep_it_cool: build shade (or move the thing into the hut), then move the sun across the sky; the day's end is the check.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  COOL_LINE, DAY_DONE, LOG_DAYS, PLACE_SHORT, compareAskText, coolFill, coverWords, dayWord, thermoFill, thermoMarks, thingOn,
  warmthAt, weatherDays,
  type Cover, type EcosystemChallenge, type PlantSetup, type Season, type Side, type SunTestChallenge, type TestThing,
  type Weather, type WinterMoves,
} from './ecosystemModel';
import { countWeather, WEATHERS, type Animal } from './ecosystemLife';

export {
  readMatches, readMiss, describeRead, ECOSYSTEM_MISSES, type EcosystemMiss,
} from './ecosystemModel';

export const ecosystemAssignment = (c: EcosystemChallenge): TeachingAssignment =>
  ({ id: c.id, task: c.instruction, response: 'gesture' });

export type SunTestStep = 'guess' | 'run' | 'read';

/** The learner's working state for the current item. Each mode reads its own fields. */
export interface EcosystemView {
  /** sun_test: guess, run, read. keep_it_cool: build, run. logs: play, answer. plant_needs: set, grown. season_behavior: summer, move. */
  step: string;
  guess?: Side | null;
  /** Day progress, 0 (morning) to 1: sun_test and keep_it_cool. */
  sunP?: number;
  lastPick?: Side | null;
  /** School days played so far (compare_logs counts both months). */
  daysShown?: number;
  season?: Season | null;
  evidence?: Weather | null;
  logPick?: 'a' | 'b' | null;
  plant?: PlantSetup;
  grown?: 'grew' | 'drooped' | null;
  moves?: WinterMoves;
  holding?: Animal | null;
  cover?: Cover | null;
}

/** The thermometer fills the learner sees at day progress p (sun_test). */
export function sunTestFills(c: SunTestChallenge, p: number): { left: number; right: number } {
  return { left: thermoFill(warmthAt(c.left, p)), right: thermoFill(warmthAt(c.right, p)) };
}

const where = (t: TestThing) => (t.spot === 'hut' ? 'in the shade hut' : 'on the open sand in the sun');
const marksWord = (n: number) => (n === 0 ? 'below the first mark' : `up to mark ${n} of 5`);
const TANK = 'an island in a glass tank drawn in 3D: sand, a meadow, trees, water with fish, a shade hut, and a sun that moves along an arc over the tank';

/** What a weather log shows so far: the count of each picture, as drawn. */
function logFacts(days: readonly Weather[], shown: number): string {
  if (shown <= 0) return 'empty';
  const n = countWeather(days.slice(0, shown));
  const parts = WEATHERS.filter(w => n[w]).map(w => weatherDays(w, n[w]));
  return `${shown} of ${LOG_DAYS} days filled in: ${parts.join(', ')}`;
}

export function ecosystemScene(c: EcosystemChallenge, view: EcosystemView): WorkspaceScene {
  const facts: Record<string, string | number> = { tank: TANK };
  switch (c.type) {
    case 'sun_test': {
      const sunP = view.sunP ?? 0;
      const fills = sunTestFills(c, sunP);
      const moved = sunP > 0.02;
      Object.assign(facts, {
        onTest: `${c.left.name} (on the left, ${where(c.left)}) and ${c.right.name} (on the right, ${where(c.right)})`,
        whatIsDifferent: c.difference,
        step: view.step === 'guess' ? 'making a guess' : view.step === 'run' ? 'moving the sun across the sky' : 'reading the thermometers',
        guess: view.guess ? thingOn(c, view.guess).name : 'not made yet',
        sun: sunP >= DAY_DONE ? 'across the sky: the day is over' : moved ? `moving (${dayWord(sunP)})` : 'low in the morning sky',
        thermometers: moved
          ? `red line by ${c.left.name}: ${marksWord(thermoMarks(fills.left))}; red line by ${c.right.name}: ${marksWord(thermoMarks(fills.right))}`
          : 'both red lines sit at the bottom, below the first mark',
        ...(view.lastPick ? { lastPick: `tapped ${thingOn(c, view.lastPick).name} as the warmer one` } : {}),
        constraints: 'The learner taps a thing to guess, drags the sun along its path (or presses Let the day go by), then taps the '
          + 'thing that got warmer; that tap is the check. Each thing has a picture thermometer beside it: a red line that rises '
          + 'past five marks, a snowflake at the cold end and a sun at the hot end. No numbers or temperatures are shown.',
      });
      break;
    }
    case 'season_from_log': {
      const shown = Math.min(view.daysShown ?? 0, LOG_DAYS);
      Object.assign(facts, {
        step: view.step === 'play' ? 'playing the month' : 'naming the season from the log',
        weatherLog: `a picture log of one month of school days (the month is not named): ${logFacts(c.days, shown)}`,
        todayInTheTank: shown > 0 && shown <= LOG_DAYS ? `${c.days[shown - 1]} weather` : 'not started',
        seasonPicked: view.season ?? 'none yet',
        ...(view.evidence ? { weatherPicked: weatherDays(view.evidence) } : {}),
        constraints: 'The learner plays the month (Play the month, or Next day); each day the tank shows that day\'s weather and its '
          + 'picture goes into the log, which also shows a picture graph with one row per kind of weather. Then the learner taps a '
          + 'season card, then taps the row of weather in the log that shows the season; that tap is the check. The tree and '
          + 'animals do not change in this activity: the log is the evidence.',
      });
      break;
    }
    case 'compare_logs': {
      const shown = view.daysShown ?? 0;
      Object.assign(facts, {
        step: view.step === 'play' ? 'playing the two months' : 'answering the question',
        question: compareAskText(c.ask),
        logA: `${c.a.label}: ${logFacts(c.a.days, Math.min(shown, LOG_DAYS))}`,
        logB: `${c.b.label}: ${logFacts(c.b.days, Math.max(0, shown - LOG_DAYS))}`,
        ...(view.logPick ? { lastPick: (view.logPick === 'a' ? c.a : c.b).label } : {}),
        constraints: 'Both months play in the tank one after the other and fill two picture logs, each with a picture graph. Then '
          + 'the learner taps the log that answers the question; that tap is the check.',
      });
      break;
    }
    case 'plant_needs': {
      const s = view.plant ?? c.start;
      Object.assign(facts, {
        plant: `a ${c.plant} in a pot${c.variant === 'fix' ? ', drooping at the start' : ', a small seedling at the start'}`,
        potStandsIn: s.spot === 'sun' ? 'the sunny sand' : 'the shade hut',
        inThePot: s.fill === 'empty' ? 'nothing (an empty pot)' : s.fill,
        watered: s.watered ? 'yes (the soil is dark and wet)' : 'no (dry)',
        animalThingsAdded: s.extras.length ? s.extras.join(', ') : 'none',
        ...(view.grown ? { lastGrowth: view.grown === 'grew' ? 'it grew tall in the time-lapse' : 'it drooped in the time-lapse' } : {}),
        constraints: 'The learner moves the pot (sunny sand or shade hut), fills it (soil or pebbles), waters it, and may add a den '
          + 'or berries (things for animals). Watch it grow runs two weeks of days and is the check: the plant grows with '
          + 'sunlight, water and soil, and the check also wants nothing it does not need.',
      });
      break;
    }
    case 'season_behavior': {
      const moves = view.moves ?? {};
      Object.assign(facts, {
        season: view.step === 'summer' ? 'summer: green leaves, every animal in its summer place' : 'winter: bare tree, snow on the ground',
        animals: c.animals.map(a => `the ${a}: ${moves[a] ? `moved to ${PLACE_SHORT[moves[a]!]}` : 'still in its summer place'}`).join('; '),
        winterPlaces: 'a cave den on the hill, an arrow at the edge of the tank that says south, a hollow in the big tree, the open meadow',
        ...(view.holding ? { holding: `the ${view.holding} (picked up, waiting for a place)` } : {}),
        constraints: 'The learner presses Bring winter, then taps an animal and taps a winter place for it, and presses Done; Done '
          + 'is the check. Animals can be moved again before Done.',
      });
      break;
    }
    case 'keep_it_cool': {
      const sunP = view.sunP ?? 0;
      const fill = coolFill(view.cover ?? null, sunP);
      Object.assign(facts, {
        thing: `the ${c.thing}, out on the sunny sand, with a picture thermometer beside it`,
        coversOnOffer: c.covers.map(x => (x === 'hut' ? 'move it into the shade hut' : `a ${x}`)).join(', '),
        built: coverWords(view.cover ?? null),
        sun: sunP >= DAY_DONE ? 'across the sky: the day is over' : sunP > 0.02 ? `moving (${dayWord(sunP)})` : 'low in the morning sky',
        thermometer: `red line ${marksWord(thermoMarks(fill))}; the blue cool line is at mark 2, and the red is ${fill < COOL_LINE ? 'below' : 'above'} it`,
        constraints: 'The learner picks a cover (or moves the thing into the hut), then drags the sun across the sky or presses Let '
          + 'the day go by. The end of the day is the check: the red line must stay below the blue cool line. Change the cover only '
          + 'before the sun moves.',
      });
      break;
    }
  }
  return { objects: [], facts };
}
