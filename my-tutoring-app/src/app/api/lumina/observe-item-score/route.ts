import { observationRoute } from '@/components/lumina/service/typesafe/observationRoute';
import { itemScoreKind } from '@/components/lumina/service/typesafe/observeItemScore';
import { validItemScoreRequest } from '@/components/lumina/components/live-activity/runtime/itemScoringContract';

/** The scoring pass: re-grades one spoken attempt for the record. It commits nothing and moves no lesson. */
export const POST = observationRoute(itemScoreKind, validItemScoreRequest, { maxBytes: 16000, noun: 'attempt' });
