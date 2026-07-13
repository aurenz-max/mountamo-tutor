import type { StudioScenario } from '../types';
import SayWordScenario from './SayWordScenario';
import ChoiceQueueScenario from './ChoiceQueueScenario';
import LetterNameScenario from './LetterNameScenario';

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
    id: 'choice-queue',
    label: 'Spoken choice queue',
    blurb: 'Voice control: 2 targeted problems; saying an option answers the focused one, then focus advances.',
    Component: ChoiceQueueScenario,
  },
];
