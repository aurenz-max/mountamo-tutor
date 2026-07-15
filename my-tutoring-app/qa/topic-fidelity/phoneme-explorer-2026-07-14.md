# Topic Fidelity: gemini-phoneme-explorer — 2026-07-14

Handoff Task 2 (`qa/reader-fit/HANDOFF-opus-2026-07-14.md`), BACKLOG item **1g**.

Scope/theme intended: an ENDING-sound (rime, for rhyme comparison) objective must NOT
be silently answered with an INITIAL-sound isolation task.

## Diagnosis — the mechanism, not the symptom

The K rhyme census (`qa/topic-traces/k-rhyme-identify-2026-07-14.md`) showed the manifest
selecting **phoneme-explorer** for the rhyme objective, whose `isolate` mode then matched
by INITIAL phoneme (Cat→Cup /k/, Dog→Duck /d/) — a silent task substitution for an
ENDING-sound intent.

Root cause is a three-layer over-claim of a capability the component does not have:

- **Component** (`PhonemeExplorer.tsx`): isolate mode renders "starts with" copy
  everywhere (`MODE_LABELS.isolate`, the example-word "starts with", the question "Which
  word also starts with…"). There is **no `position` field** — the component structurally
  cannot present an ending-sound (or medial) task.
- **Generator** (`gemini-phoneme-explorer.ts`): the isolate promptDoc teased
  "starts with (or ends with)", grade-1 guidelines claimed "initial AND final", grade-2
  claimed "initial, final, AND medial" — yet the always-appended CRITICAL RULE forces
  "MUST start with". So it always produced initial-match, regardless of intent.
- **Catalog** (`manifest/catalog/literacy.ts`): advertised "Isolate (match **initial/final**
  sound)" and "Identify **initial/final** phoneme". This false advertisement is what invited
  the manifest to route ending-sound/rhyme objectives here.

**Verdict:** WRONG PRIMITIVE for rhyme (not a generator fidelity bug to make honor ending
sounds). Dedicated rhyme primitives (rhyme-studio, poetry-lab `rhyme_hunt`) already honor
the rhyme objective in the same census. Full final-phoneme support would still not serve
*rhyme* correctly (rime = vowel + coda, ≠ final phoneme). → **Routing fix** (HANDOFF option 3):
make catalog + generator honestly say INITIAL/beginning-sounds only so the router stops
picking phoneme-explorer for ending-sound work.

## Change

- **Catalog** `literacy.ts` phoneme-explorer entry: description now leads with
  "Beginning/INITIAL-sound phoneme awareness — NOT for rhyme or ending-sound objectives"
  (steering language in the first ~90 chars, what resolveLessonEvalModes reads); isolate
  evalMode description → "Identify the INITIAL/beginning phoneme"; constraints spell out the
  component renders "starts with" and cannot present ending/rhyme tasks (route those to
  rhyme-studio / poetry-lab).
- **Generator** `gemini-phoneme-explorer.ts`: isolate promptDoc → "starts with the same
  INITIAL/beginning sound" (removed the "or ends with" tease, added the explicit
  can't-render-final note); schemaDescription → "identify the INITIAL/beginning phoneme";
  grade-1 and grade-2 isolate guidelines → "initial/beginning sounds ONLY". Generator,
  component, and catalog now tell the same truth.

No component code changed (routing fix, not capability add). No schema shape change.

## Verification (runtime — dev server :3001)

**Regression — initial-sound topic still honored** (`/api/lumina/eval-test`,
componentId=phoneme-explorer, evalMode=isolate, K, topic="Identify the beginning sound in a
word", 3 draws / 15 challenges):

| Draw | Sample challenges (phoneme · example → correct) | Every isolate = beginning-sound match? |
|------|-------------------------------------------------|----------------------------------------|
| 1 | S·Sun→Snake, M·Moon→Map, D·Dog→Duck, P·Pig→Pen, C·Cat→Cup | ✔ |
| 2 | M·Moon→Mouse, S·Sun→Snake, D·Dog→Duck, P·Pig→Pan, F·Fish→Fan | ✔ |
| 3 | S·Sun→Snake, M·Mouse→Milk, D·Dog→Duck, F·Fish→Fan, B·Ball→Bear | ✔ |

15/15 correct choices share the INITIAL phoneme with the example; distractors don't. No
degradation.

**Routing — phoneme-explorer no longer selected for the rhyme objective**
(`/api/lumina/topic-trace?...&manifestOnly=true`, topic="Identify the rhyming word from a
spoken set of three", K, 3 runs):

| Run | Selected primitives | phoneme-explorer? |
|-----|---------------------|-------------------|
| 1 | rhyme-studio, sorting-station, foundation-explorer, poetry-lab, word-workout, knowledge-check, flashcard-deck | NOT selected |
| 2 | rhyme-studio, poetry-lab, phonics-blender, picture-vocabulary, sorting-station, word-workout, knowledge-check | NOT selected |
| 3 | rhyme-studio ×3, poetry-lab, sorting-station, knowledge-check | NOT selected |

3/3 runs route rhyme to rhyme-studio (dominant) + poetry-lab — the correct primitives.
Pre-fix, the census manifest included phoneme-explorer here.

**Type check:** `npm run typecheck:lumina` → 0 errors (active surface green). Full-repo
`tsc --noEmit` shows only pre-existing legacy `src/lib/WebSocketService.ts` errors
(quarantined graveyard, unrelated — edits were string-only in lumina/).

**Verdict:** FIXED + VERIFIED (routing).

## Follow-up (not done here — logged, not halfway)

phoneme-explorer's isolate mode is INITIAL-only across all grades because the component
hardcodes "starts with". A genuine **final-phoneme isolation** capability (a real grade-1/2
skill, distinct from rhyme) would need: a `position: 'initial'|'final'` field on
`PhonemeChallenge`, conditional component copy, generator final-phoneme distractor logic
derived from intent, and its own eval-mode + oracle. That is a primitive-expansion slice,
not a fidelity fix — filed as a BACKLOG follow-up.
