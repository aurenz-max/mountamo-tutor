import { observationRoute } from '@/components/lumina/service/typesafe/observationRoute';
import { spokenMissKind } from '@/components/lumina/service/typesafe/observeSpokenMiss';
import { validSpokenMissRequest } from '@/components/lumina/components/live-activity/runtime/spokenMissContract';

/** Advisory: which of the item's known wrong answers a spoken answer is. It judges no credit and commits nothing. */
export const POST = observationRoute(spokenMissKind, validSpokenMissRequest, { maxBytes: 16000, noun: 'answer' });
