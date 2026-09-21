import { observationRoute } from '@/components/lumina/service/typesafe/observationRoute';
import { assignmentOutcomeKind } from '@/components/lumina/service/typesafe/observeDialogue';
import { validDialogueRequest } from '@/components/lumina/components/live-activity/runtime/dialogueContract';

/** Shared lesson observer. Server owns model credentials; response commits stay scoped in the runtime. */
export const POST = observationRoute(assignmentOutcomeKind, validDialogueRequest, { maxBytes: 12000, noun: 'exchange' });
