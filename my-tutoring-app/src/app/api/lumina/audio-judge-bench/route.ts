import { NextResponse, type NextRequest } from 'next/server';
import { systemOne } from '@/components/lumina/service/manifest/typesafe/typesafeClient';
import { itemScoreKind } from '@/components/lumina/service/typesafe/observeItemScore';
import { observeSpokenAudio, MAX_AUDIO_BASE64 } from '@/components/lumina/service/typesafe/observeSpokenAudio';
import { hearBlind } from '@/components/lumina/service/typesafe/hearWordBlind';
import { blindLetterCandidates, blindWordCandidates, letterMisses, letterTask } from '@/components/lumina/service/typesafe/blindWordCandidates';
import { wordReadingMisses } from '@/components/lumina/primitives/visual-primitives/literacy/spokenReadingMisses';

/**
 * Voice Studio "Hear the word" bench: one learner clip judged by gemini-decision-1 three ways, side by side.
 *   told   — the 11-11 bench shape (`item_score`): task + expected answer, "is the learner right?"
 *   miss   — what the app sends today (`spoken_miss_audio`): task + expected answer + the item's known misses
 *   blind  — no task, no answer: which option was said (`hearBlind`); code reads it as correct or a miss
 * `kind`: word (read a printed word), letter_sound (say the letter's sound), letter_name (say its name).
 * Dev bench only; commits nothing.
 */
const AUDIO_NOTE = 'The attached audio clip is the learner\'s own spoken answer. Judge what the learner says in the audio.';
const KINDS = ['word', 'letter_sound', 'letter_name'] as const;
type Kind = typeof KINDS[number];

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const kind: Kind = KINDS.includes(body?.kind) ? body.kind : 'word';
  const target = typeof body?.target === 'string' ? body.target.trim().toLowerCase() : '';
  const audio = body?.audioBase64;
  if (kind === 'word' ? !/^[a-z]{2,12}$/.test(target) : !/^[a-z]$/.test(target))
    return NextResponse.json({ error: kind === 'word' ? 'target must be one lowercase word' : 'target must be one letter' }, { status: 400 });
  if (typeof audio !== 'string' || audio.length < 64 || audio.length > MAX_AUDIO_BASE64)
    return NextResponse.json({ error: 'audioBase64 missing or too large' }, { status: 400 });

  const letters = target.split('');
  const ask = kind === 'letter_name' ? 'name' : 'sound';
  const { task, expectedAnswer } = kind === 'word' ? { task: `Read this word out loud: ${letters.join(' ')}`, expectedAnswer: target } : letterTask(target, ask);
  const misses = kind === 'word' ? wordReadingMisses(target, letters.length === 3 ? { sounds: letters } : {}) : letterMisses(target, ask);
  const candidates = kind === 'word' ? blindWordCandidates(target) : blindLetterCandidates(target, ask);
  const setting = kind === 'word' ? 'A child read one printed word aloud.' : 'A child looked at one printed letter and said something about it aloud.';
  const scope = { sessionEpoch: 'bench', instanceId: 'audio-judge-bench', itemId: `${kind}-${target}` };
  const media = [{ type: 'audio' as const, mime_type: 'audio/wav', data: audio }];
  const timed = async <T,>(f: () => Promise<T>) => { const t = performance.now(); const v = await f(); return { v, ms: Math.round(performance.now() - t) }; };

  const told = timed(async () => {
    const req = { scope, attemptIndex: 0, task, expectedAnswer, learner: '(no transcript: listen to the attached audio)',
      tutor: 'Okay, thank you for telling me.' };
    const r = await systemOne({ ...(itemScoreKind.state(req) as Record<string, unknown>), learnerAudio: AUDIO_NOTE }, itemScoreKind.questions as any,
      { model: 'gemini-decision-1', media, signal: request.signal });
    return itemScoreKind.decide(req, r.answers, r.ms, r.model).learnerCorrect;
  }).then(({ v, ms }) => ({ pRight: v, ms }), e => ({ pRight: null, ms: 0, error: String(e?.message ?? e).slice(0, 200) }));

  const miss = timed(() => observeSpokenAudio({ scope, task, expectedAnswer, learner: '(audio)', audioBase64: audio, misses }, request.signal))
    .then(({ v, ms }) => ({ reading: v.reading, miss: v.miss, p: v.p, ms, ...(v.reading === null ? { error: v.reason } : {}) }));

  const blind = hearBlind(candidates, audio, setting, request.signal);

  const [a, b, c] = await Promise.all([told, miss, blind]);
  return NextResponse.json({ kind, target, told: a, miss: b, blind: c });
}
