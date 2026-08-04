# DI family — remediation-lever design (2026-08-04)

**BACKLOG item 2, design half: CLOSED. Implementation remains open and is
executed by `/add-misconception-loop`, then `/misconception-test`.**

The production half already stores bounded, task-named diagnoses. This design
closes the question that blocked consumption: a DI diagnosis changes **which
code-owned items the pool selects**, never what the tutor says. Every model,
guide, test, judging, correction, move-on, and completion line remains
byte-frozen.

## Family contract

1. Add a pure, typed resolver per pack:
   `resolveDiRemediationMove(challengeType, remediationFocus) → move | null`.
   Match only narrow, task-bounded language. Unknown or cross-mode diagnoses
   return `null`; the generator must not guess.
2. Apply the move after eval-mode + objective/scope + L4 shape eligibility are
   known, but before final variance selection. Explicitly named lesson items
   remain anchors and always outrank remediation.
3. Dosage is **up to two targeted items** in a normal 4–6-item set, then transfer
   items from the ordinary eligible pool. A one-item mixed-mode slice may target
   its one slot. Remediation never changes item count, mode allocation, scope,
   tier, magnitude cap, or uniqueness rules.
4. The shared `buildRemediationPrompt` is deliberately **not** used. DI wrapper
   Gemini calls choose titles/scope hints only; sending a private diagnosis there
   creates a leak surface without controlling the code-owned item content.
5. No diagnosis text or `remediationFocus` may enter returned data. Log only a
   safe enum and counts:
   `[DiRemediation] { primitive, type, move, requested, actual, skippedReason }`.
6. No focus / blank focus / unsupported focus is byte-compatible with today’s
   selection path.

## Move table

| Pack | Mode-compatible move | Narrow diagnosis signal | Pool lever | Target predicate |
|---|---|---|---|---|
| `di-math-facts` | `subtracts_by_adding` | subtraction + “comes after”, “adds”, or “successor” | re-rank legal subtraction facts toward take-away-one counterexamples | `b === 1`, with `a - 1 !== a + 1` |
| | `echoes_operand` | answer described as first/second/last number or addend | exclude collisions and vary the echoed operand | correct answer differs from both displayed operands; targeted operand varies |
| | `reverses_count_direction` | counting “before/back” on `counting_next` only | place boundary successors early | starts immediately below/at a legal five/ten boundary |
| `di-letter-sounds` | `name_for_sound` | letter name given instead of sound | prefer continuants whose names are acoustically distinct from their held sounds | selected set includes `m`, `s`, `f`, `r` before neutral fill |
| | `confusable_sound_pair` | bounded pair named (`m/n` or `f/v`) | require that pair together inside the existing L4 composition window | both members present; no new letters |
| `di-word-reading` | `stops_before_whole_word` | sound-out produced without the final whole word | prefer smooth, continuant-framed CVC words | CVC with stretchable onset/final; never a sight item |
| | `near_neighbor_read` | different close-sounding word / vowel or consonant substitution | choose a tight same-position contrast set from the curated CVC menu | at least two words differ in exactly one grapheme at the diagnosed position |
| | `sounds_out_sight_word` | tries to decode an irregular word | remain inside `sight_word`/sight slots and prefer the most irregular menu entries | sight entries only; no graphemes attached |
| `di-sentence-reading` | `drops_function_word` | skips “the”, “a”, “is”, etc. | rank legal sentences containing a medial function word | target token appears non-finally; sentence pool/mode unchanged |
| | `near_neighbor_word` | substitutes a close CVC word | rank sentences containing tight curated CVC contrasts | sentence includes a confusable CVC target already in the menu |
| | `word_order_or_addition` | swaps/adds words | prefer sentences with repeated grammatical slots but no repeated target answer | existing sentence only; no sentence synthesis or length change |

The first implementation pilot is `di-math-facts/subtraction_fact` with the
already-live Firestore diagnosis. It is the strongest causal lever and has a
machine-checkable predicate. The other moves land only after that pilot passes
Probe G; no family sweep before runtime proof.

## Priority and collision rules

`eval-mode identity → objective scope/named anchors → L4 tier window →
remediation target → ordinary variance`.

- A subtraction diagnosis presented to `counting_next` is a no-op even though
  the primitive-scoped key matches.
- `make_10`, named facts, named vowel families, onset-only letter mode, and
  sentence pool identity never broaden to make a remediation target fit.
- When fewer than two legal targets exist, take what exists and log saturation;
  never widen the band or duplicate an item.
- Correction remains correction territory. Content targeting must not add a
  pre-attempt hint, explanation, picture, or answer-bearing cue.

## Implementation slices and gates

1. **Pilot — math subtraction.** Add the typed resolver + stable re-rank in
   `gemini-di-math-facts.ts`; pin no-focus byte compatibility and two-target
   dosage with unit tests.
2. Run `/misconception-test di-math-facts` Probe G through the real eval route
   using the stored-style diagnosis. Assert mode/count/scope/tier unchanged,
   target predicate ≥2 where capacity permits, correct answers recomputed, and
   diagnosis string absent from serialized output.
3. Only after runtime PASS, sweep the other math move and the three sibling
   generators. Each pack gets the same no-focus/no-leak/mode-conflict tests.
4. Re-run family Probe G scenarios plus full tests. A changed title, description,
   cue, judging contract, correction line, mode, tier, cap, or count is a failed
   gate even if targeted items were produced.

## Explicit non-goals

- No diagnosis-to-prompt prose and no LLM-authored remediation plan.
- No new words, letters, facts, or sentences during the pilot.
- No per-child script wording, extra correction, hidden hint, or changed attempt
  cap.
- No forced move for a vague diagnosis. `null` is safer than false precision.

