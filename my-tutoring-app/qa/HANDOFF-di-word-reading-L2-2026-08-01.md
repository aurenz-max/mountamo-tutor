# HANDOFF — di-word-reading `/add-tutoring-scaffold` (L2): catalog `tutoring:` move

Written by `/pm` 2026-08-01. Owning queue: `my-tutoring-app/qa/di/BACKLOG.md` — the family
ladder's next serial rung after di-letter-sounds L3 landed (`5b6acc2`). Executor:
`/add-tutoring-scaffold`.

**SERIAL CONSTRAINT: this session is the only one touching `catalog/di.ts` and the DI pack files
while it runs.** A reader-fit session is concurrently working knowledge-check (14f) — file-disjoint;
shared registers (`WORKSTREAMS.md`, both BACKLOGs, `EVAL_TRACKER.md`) must be re-read immediately
before editing.

## Paste-able prompt

> Run `/add-tutoring-scaffold` on `di-word-reading` — the DI ladder's next serial rung (L2 =
> catalog `tutoring:` move; the family lesson-mode wiring already exists). Read
> `qa/HANDOFF-di-word-reading-L2-2026-08-01.md`, then the two sibling L2 reports:
> `qa/tutor-reports/di-math-facts-2026-07-25.md` and
> `qa/tutor-reports/di-sentence-reading-2026-07-25.md`. The spoken cue lines are bench-proven and
> byte-frozen — L2 adds the tutor scaffold around them, never rewords them.

## The job (the sibling pattern, instantiated)

di-word-reading is the last pack whose tutoring block is script-local:
`DI_WORD_READING_TUTORING` at `diWordReadingScript.ts:156`. The letter-sounds L2 slice (07-23)
already built the FAMILY wiring — catalog-resolved tutoring on both connect paths
(standalone fallback + lesson auth/`switch_primitive`), `audioInput` declaration, subskill carry —
so this rung is precisely the sibling delta:

1. **Move the block** into the `di-word-reading` entry in `catalog/di.ts` (entry starts `:153`;
   it currently has no `tutoring:`). Component drops its local pass-through.
2. **Add what L0 deferred:** `contextKeys` (stimulus side: challengeType/word/graphemes/words
   summary — see the withholding decision below), 3–5 `commonStruggles`, a generator flat `words`
   summary field (mirrors letter-sounds' `letters` / math's `facts`) so RUNTIME STATE is populated
   from the first auth-time prompt, and the component `updateContext` sync (silent channel, never
   perturbs the judged loop).
3. **Sentinel + correction-opener checks** (standing gates 2 and 3): re-verify no scaffold copy
   begins a sentence with the pack's affirm/correct openers, and the directive reminds that every
   correction begins with the correction sentinel.

## Pack-specific decisions

- **Answer-in-state:** follow the SENTENCE precedent, not math's — the printed word is stimulus
  and target both, nothing is withheld (`di-sentence-reading`'s L2 recorded exactly this sibling
  difference). `word` may sit in RUNTIME STATE.
- **No pre-read cues from the second channel:** the catalog constraint is explicit — *"The printed
  word is the answer: no pictures or audio pre-cues before the child reads."* The scripted CVC
  sound-out model line is the ONE legitimate pre-read channel; make sure no `scaffoldingLevels`
  copy reads the word to the child outside the scripted flow (this is also what L3 will later
  tier-gate).
- **Corrections are byte-frozen:** this pack still carries the PLAIN re-model — the contrastive
  port is gated on HUMAN-CHECKS #55 (family rule). Do not touch `correctionLine`.
- **Struggles from observed behavior only:** draw from the run reports (`#43` live run, the
  word-reading probe's near-neighbour stress — matt/son/read/sea over-affirmation class,
  letter-NAME-instead-of-sound). Don't invent hypothetical struggles; the named risk of struggles
  is loosening the scripted tutor into chattiness (math cleared it with 4, sentence with 5).

## Gates

- `npm run typecheck:lumina` 0; full `npm test` green (baseline 1,076/1,076 as of `2782eca`).
- `/tutor-test di-word-reading`: Tier 1 **0 HIGH** (the 2 structural WARNs — `data-bag-unparsed`,
  `no-sendtext-moments` — are the DI family's shape, all three siblings carry them); Tier-2 probe
  with all keys resolving real values, no `(not set)`, and **no pre-read answer leak in RUNTIME
  STATE beyond the printed word itself**.
- Report `qa/tutor-reports/di-word-reading-<date>.md`; update the DI BACKLOG ladder table
  (L2 ✅, next rung per the 08-01 order = di-sentence-reading L4) + WORKSTREAMS "last touched";
  one tight slice. Tier 3 (live mic) rides the next DI sitting — do not block on it.

## Optional second slice (same session, it owns the pack): the 14g word-reading verdict

Reader-fit 14g (cross-stream, evidence `qa/topic-traces/g1-silent-e-2026-08-01.md`) reports
di-word-reading "replaced a CVCe intent with `cat/red/pig/sun`". **Before treating that as a
generator bug, note the catalog's own constraints FORBID CVCe** ("Short-vowel CVC words and
starter sight words only — NO digraphs, blends, or multisyllable words"). So the `/topic-fidelity`
verdict is genuinely open three ways: HONORED (graceful degradation of an out-of-scope ask),
WRONG-PRIMITIVE (the manifest should not route silent-e to this pack — fix is catalog
description/steering, not generator code), or FIDELITY-BUG (only if the generator ignores an
in-scope pattern). Decide with a probe, record the verdict in the reader-fit 14g item (re-read
that BACKLOG first — the 14f session edits it too). The `di-math-facts counting_next` 1–120 half
of 14g is separate; leave it queued unless this session has room.
