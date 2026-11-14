import type { StudioScenario } from '../types';
import SayWordScenario from './SayWordScenario';
import ChoiceQueueScenario from './ChoiceQueueScenario';
import LetterNameScenario from './LetterNameScenario';
import HearWordScenario from './HearWordScenario';

/**
 * Scenario registry — the plug-and-play seam.
 *
 * A scenario is one component that owns its work surface and judge wiring,
 * and consumes the useVoiceCapture engine exactly like a primitive would.
 * To bench a new spoken interaction: write scenarios/YourScenario.tsx
 * (SayWordScenario is the minimal reference) and add one entry here.
 */
export const STUDIO_SCENARIOS: StudioScenario[] = [
  {
    id: 'say-word',
    label: 'Say the word',
    blurb: 'Production judging: did the student say the target word? (yes/no ladder)',
    Component: SayWordScenario,
  },
  {
    id: 'hear-word',
    label: 'Hear the word (Decisions)',
    blurb: 'gemini-decision-1 judges your clip three ways: told the answer, the app\'s spoken_miss, and blind "which word?". Say right and wrong words; the scoreboard compares.',
    Component: HearWordScenario,
  },
  {
    id: 'choice-queue',
    label: 'Spoken choice queue',
    blurb: 'Voice control: 2 targeted problems; saying an option answers the focused one, then focus advances.',
    Component: ChoiceQueueScenario,
  },
];
