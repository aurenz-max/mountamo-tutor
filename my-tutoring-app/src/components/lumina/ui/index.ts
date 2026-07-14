/**
 * Lumina UI kit — the codified Lumina design system.
 *
 * Compose primitive *chrome* (cards, buttons, badges, panels, text hierarchy)
 * from these components instead of re-deriving Tailwind class strings. The
 * glass aesthetic lives in `tokens.ts` and flows through here, so the theme
 * can evolve at scale rather than primitive-by-primitive.
 *
 * Boundary: this kit is the FRAME, not the painting. Standardize the chrome.
 * Never absorb a primitive's bespoke interaction surface (canvas, drag
 * targets, simulation objects) into the kit — that stays unique per primitive.
 *
 *   import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaButton } from '../../ui';
 */
export {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaCardFooter,
  type LuminaCardProps,
} from './LuminaCard';

export { LuminaButton, type LuminaButtonProps } from './LuminaButton';
export { LuminaBadge, type LuminaBadgeProps } from './LuminaBadge';
export { LuminaPanel, type LuminaPanelProps } from './LuminaPanel';

// Tier 2 — richer chrome extracted from MachineProfile + ComparisonPanel.
export { LuminaCallout, type LuminaCalloutProps } from './LuminaCallout';
export { LuminaSectionLabel, type LuminaSectionLabelProps } from './LuminaSectionLabel';
export { LuminaSlider, type LuminaSliderProps } from './LuminaSlider';
export { LuminaStat, type LuminaStatProps } from './LuminaStat';
export { LuminaChoiceChip, type LuminaChoiceChipProps } from './LuminaChoiceChip';
export {
  LuminaAccordion,
  LuminaAccordionItem,
  type LuminaAccordionItemProps,
} from './LuminaAccordion';
export { LuminaProgress, type LuminaProgressProps } from './LuminaProgress';

// Tier 3 — the multi-phase primitive scaffold (extracted from CountingBoard + TenFrame).
export { LuminaStepper, type LuminaStepperProps } from './LuminaStepper';
export {
  LuminaModeTabs,
  type LuminaModeTab,
  type LuminaModeTabsProps,
} from './LuminaModeTabs';
export {
  LuminaChallengeCounter,
  type LuminaChallengeCounterProps,
} from './LuminaChallengeCounter';
export { LuminaPrompt, type LuminaPromptProps } from './LuminaPrompt';
export { LuminaInlineStat, type LuminaInlineStatProps } from './LuminaInlineStat';
export { LuminaTable, type LuminaTableProps } from './LuminaTable';

// Evaluation loop — the problem → eval → results spec (extracted from the
// problem-primitives + PhaseSummaryPanel).
export {
  LuminaFeedbackCard,
  type LuminaFeedbackCardProps,
  type FeedbackStatus,
} from './LuminaFeedbackCard';
export {
  LuminaAnswerChoice,
  type LuminaAnswerChoiceProps,
  type AnswerChoiceState,
} from './LuminaAnswerChoice';
export {
  LuminaActionButton,
  type LuminaActionButtonProps,
  type ActionKind,
} from './LuminaActionButton';
export {
  LuminaHintDisclosure,
  type LuminaHintDisclosureProps,
} from './LuminaHintDisclosure';
export { LuminaScoreRing, type LuminaScoreRingProps } from './LuminaScoreRing';
export {
  LuminaFillBlankSlot,
  type LuminaFillBlankSlotProps,
  type FillBlankState,
} from './LuminaFillBlankSlot';
export {
  LuminaChip,
  LuminaChipBank,
  type LuminaChipProps,
  type LuminaChipBankProps,
  type ChipState,
} from './LuminaChip';
export { LuminaInput, type LuminaInputProps } from './LuminaInput';
export {
  LuminaDropZone,
  type LuminaDropZoneProps,
  type DropZoneState,
} from './LuminaDropZone';

// Brand — the Aurora Core mark, doubling as a progress ring.
export { LuminaMark, type LuminaMarkProps } from './LuminaMark';

// Spoken reception — the one "read this to me" affordance (tutor voice out,
// cyan; counterpart to the emerald mic-in orb below).
export {
  LuminaReadAloud,
  LuminaReadAloudGlyph,
  type LuminaReadAloudProps,
  type LuminaReadAloudGlyphProps,
} from './LuminaReadAloud';

// Spoken production — the shared "mic is live, speak now" capture surface.
export {
  default as LuminaMicListener,
  type LuminaMicListenerProps,
  type MicListenerState,
} from './LuminaMicListener';

// Voice targeting — the "current target" frame when several units of work
// share a screen with an always-on mic.
export {
  default as LuminaVoiceTarget,
  type LuminaVoiceTargetProps,
} from './LuminaVoiceTarget';

// Session-level auto-listen switch — navbar chip over utils/voiceMode (Ctrl+M).
export {
  default as LuminaVoiceToggle,
  type LuminaVoiceToggleProps,
} from './LuminaVoiceToggle';

export {
  surface,
  text,
  interactive,
  motion,
  accentText,
  accentBorder,
  accentGlow,
  accentSolidBg,
  accentSoftBg,
  accentChipBg,
  accentSoftBorder,
  accentStrongText,
  answerStateClasses,
  answerStateClass,
  dropZoneStateClasses,
  dropZoneStateClass,
  getPerformanceTier,
  TIERS,
  LUMINA_ACCENTS,
  type LuminaSurface,
  type LuminaAccent,
  type LuminaMotion,
  type PerformanceTier,
  type TierStyle,
} from './tokens';
