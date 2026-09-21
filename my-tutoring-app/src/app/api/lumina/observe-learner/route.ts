import { observationRoute } from '@/components/lumina/service/typesafe/observationRoute';
import { learnerIntentKind } from '@/components/lumina/service/typesafe/observeLearnerIntent';
import { validLearnerIntentRequest } from '@/components/lumina/components/live-activity/runtime/learnerIntentContract';

/** Advisory learner-turn observation. It returns probabilities and commits nothing. */
export const POST = observationRoute(learnerIntentKind, validLearnerIntentRequest, { maxBytes: 8000, noun: 'turn' });
