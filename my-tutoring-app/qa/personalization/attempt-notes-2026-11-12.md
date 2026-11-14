# Attempt notes wired into generation — 2026-11-12

Student 1004, real attempts since 2026-10-01. Gemini spend for the whole run: $0.54 of the $5.00 agent cap (214 calls).

## What was built

1. **Write.** After a submission (lesson and Pulse), `captureAttemptNote` sends the attempt's record to the Next
   action `writeAttemptNote` (flash-lite), then posts the note to `POST /api/student-profile/attempt-notes`. The
   backend files it under the published unit / skill / subskill (`attempt_notes.note_home`) in
   `students/{id}/attempt_notes`, or refuses it. No model call on the backend. Skipped with no call when the
   work has no per-item record or no curriculum home.
2. **Deliver.** `/generation-context` adds each objective's unit to the packet scopes and the notes of those
   units to the signed launch packet (`packet.notes`). Generation makes no backend call.
3. **Apply.** `generateComponentContent` asks once per objective per request which struggle notes apply
   (`applyNotes.ts`, flash, low thinking). Picks reach every context-native generator as `ctx.learnerNotes` and
   as a private block on `ctx.intent`; the exact items a pick names reach the word space picker (`tierPick`).
4. **Guard.** Client-sent `learnerNotes` is dropped; a copied notes field or echoed block is scrubbed from the
   generated content; `LUMINA_ATTEMPT_NOTES=off` stops writing and applying.

## Benchmark

Harness: `backend/scripts/attempt_notes_bench.py` (dump, store, packet) and
`scripts/attempt-notes-replay.mjs` (notes, replay). Production code on both sides; no login.

| Step | Result |
|---|---|
| Attempts with an item record and a published home | 43 |
| Notes written by the production writer | 43 of 43; 21 with something specific; 32 signals (15 struggle, 17 strength); $0.03 |
| Stored and read back through the production store | 21 notable notes under 1004 |
| Real `/generation-context` handler, LA001-01-a | signed packet with 7 notes and the unit; the frontend key verifies the signature |
| Tampered packet | no notes on 6 of 6 items |
| Applicability latency | 9-25 s and one timeout at default thinking; about 2.5 s at low thinking |
| Notes in generated output | found once (phonics-blender copied the config field); 0 of 18 draws after the scrub |

Generation, 3 draws with the packet and 3 without, fit gate off:

| Primitive, objective | Picked | Effect on content |
|---|---|---|
| phonics-blender, CVC decoding | pig (from cvc-speller, neighbouring skill), bus | Both words first in 3 of 3 noted draws. Baseline already held bus 3 of 3 and pig 2 of 3: the K space is small. |
| cvc-speller, segment and spell | none | The "p i p for pig" note is filed under this very subskill and was not picked. Applicability miss. |
| shape-sorter, shape category | triangle vs rectangle | None. Both shapes were already in every draw; the primitive has no side-count contrast to add. |
| number-sequencer, spot the error | 21 in a teens count | None. 21 appeared in 0 of 3 noted draws, 2 of 3 baseline. Code builds the sequences. |
| pattern-builder, AB patterns | star and moon | None. Moon in 0 of 3 draws either way. |
| knowledge-check, excavator | bucket | Partial on one draw; bucket in 2 of 3 draws either way. |

## What this shows

- Write, store, signed delivery and applicability work on real data.
- A note changes content only where a generator has a channel for it. The intent block alone moved one of six
  primitives. The word space picker is a shared channel (15 literacy primitives use `tierPick`); math item
  spaces and model-authored generators have none yet.
- Strength notes are not offered to generators. On the second run two picked strengths filled a five-word
  session with words the child already reads and dropped the two they had missed.
- Several picked "uses" are coaching ("highlight the number of sides"). Those belong to the live tutor, which
  this slice does not feed.

## Not exercised

- The browser path: a real submit calling `/api/lumina` `writeAttemptNote` and the authenticated POST. Covered
  by vitest and pytest only. Needs one played activity with the backend running, then a look at
  `students/{id}/attempt_notes`.
- A full lesson build through `/api/lumina/build-stream` with a live packet.

## Open

- A noted number or shape has no picker channel in math item spaces (`itemSpace/index.ts` `tierPick`).
- pattern-builder, shape-sorter and knowledge-check do not act on the intent block.
- Notes misfiled by the free-form mapping (a sea-otter deep-dive under CVC decoding, a slope canvas under
  drawing) were offered and correctly not picked; the filing itself is the knowledge-check handoff's item 5.
- Picks vary between runs at temperature 0 (bus was picked in runs 1 and 3, not run 2).

## Second pass, same day: prompt section, per-component applicability, code check

The first replay moved one of six primitives because the notes rode `ctx.intent`, and most generators do not put
intent in their prompt (pattern-builder and shape-sorter use the scope section only; the literacy focus line
called anything beyond skill and scope "decoration"). Changes:

- One section, `learnerNotesBlock`, that states the goal first ("use it as the chance to work on them", at least
  one item per note, named items must appear), then the limits. It is emitted by `buildScopePromptSection`
  (95 generators) and after the rules of `themedFocusLine` (12), and stays on the tail of `ctx.intent` for the rest.
- Applicability now runs per component and sees the activity's catalog description and pinned mode. A note is
  picked only when the activity can show the thing it names.
- After generation, code checks whether the named items are in the content (`checkLearnerNotes`). Named and
  absent earns one redraw. Every outcome is a line in `qa/fit-gate/learner-notes-YYYY-MM-DD.jsonl`.

Replay, 3 draws per arm (spend to this point $0.82 of $5.00):

| Primitive | Picked | Named item in noted draws | In baseline draws | Ledger |
|---|---|---|---|---|
| phonics-blender | pig, bus | pig 3 of 3, bus 3 of 3 | pig 1 of 3, bus 3 of 3 | present x3 |
| pattern-builder | star and moon | moon 3 of 3 | moon 0 of 3 | present x3 |
| shape-sorter | triangle vs rectangle | both 3 of 3 | both 3 of 3 | present x3; judge: both shapes now offered together on two challenges |
| number-sequencer | 21 in a teens count | 21 in 1 of 3 | 3 of 3 | absent after redraw x2: code builds the sequences (8.3m) |
| knowledge-check | bucket, boom | bucket 1 of 3 | 2 of 3 | one draw picked nothing, one present, one partly |
| cvc-speller | none | - | - | none-picked x3 |

Read of the last three rows:
- number-sequencer is the ledger doing its job: picked, absent, redraw did not help. It needs the item-space channel.
- knowledge-check picks differ between draws (each draw is its own applicability call) and its one question
  rarely lands on the noted part.
- cvc-speller: the objective is segmenting a word into sounds and the note is a spelling slip on pig. The
  refusal may be right; it needs the labelled case set (8.3o) to say.

No notes field or private block in any of the 18 noted outputs.
