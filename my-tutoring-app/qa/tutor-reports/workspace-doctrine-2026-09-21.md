# Shared workspace doctrine, written once (brief 11 item 4)

Date: 2026-09-21 · Executor: `/add-live-tutor-tools` under its standing authority (user ruling
2026-09-21) · Owner: LA-13 / LA-14

## What changed

- `WORKSPACE_DOCTRINE` + `workspaceGuidance(domain)` in `adapters/adapterContract.ts` (900 chars).
  Every tutor/JEV workspace adapter (counting-board, shape-sorter, number-sequencer,
  di-letter-sounds, di-word-reading, di-math-facts, letter-sound-link) now writes only its domain
  sentences and wraps them. The five tuned "name the X back in the same breath" variants are gone.
- The credit rule is one instruction, not a line to recite: *when an answer is right, credit the
  learner and name what they got right, in your own words: that they did it, and the number, word,
  shape or sound they gave. Praise that names nothing, or the answer alone, credits nothing.*
- A refused workspace action can return its reason (`ExecutableAffordance.execute` → `boolean | string`,
  `LiveLessonRuntime` relays it). `demonstrate` without `targets` now answers
  "demonstrate needs targets: ids from workspace.objects, or [] to clear the marks." instead of
  "Adapter refused the transition". One run repeated an untargeted call 45 times against the bare
  refusal until timeout.
- Backend unchanged (see the rejected design below).

Guidance lengths now: counting-board 1154, number-sequencer 1495, shape-sorter 1349,
di-letter-sounds 1800, di-word-reading 1917, di-math-facts 1880, letter-sound-link 1961 (cap 2000).

## Measurement

Seven families, one spoken mode each, three connected `--startup --audio` journeys per family,
replaying the 2026-09-20 payloads. Metric per labelled learner answer: did the observer commit the
tutor's reply (correct → accepted, wrong → no false credit). Raw reports:
`<family>-guidance-{before,after,doctrine}-2026-09-21.json`.

| 21 journeys each | before (HEAD) | doctrine in backend `RUNTIME_INSTRUCTION` | doctrine in adapter guidance (kept) |
|---|---|---|---|
| correct answers credited | 36/38 | 26/28 | **40/42** |
| false credit on wrong answers | 0/19 | 0/14 | **0/21** |
| observer abstained on a reply meant as praise | 1 | 0 | **0** |
| visible demonstration | 19/21 | 14/21 | **21/21** |
| runs with an untargeted `demonstrate` | 1 | 2 | **0** |
| runs passed | 13/21 | 9/21 | **16/21** |

The uncredited answers in the kept column (2) are both letter-sound-link `aaa`, which synthetic
audio transcribes as "A" and the tutor then judges as the letter NAME — a tutor verdict, not an
observer abstention, and the known synthetic-phoneme limit (HUMAN-CHECKS #167). The before
column's one real abstention was the target shape: "Terrific! There are 7 blocks in this
challenge." — a fact with no credit to the child, which stalled the run.

Replies after the change credit the child by name of the act: "That's it! You read the word cat.",
"You did it! There are five blocks on the board.", "Exactly! You made the mmm sound for the letter M."
di-math-facts still often uses the model line ("That's right, one plus four is five!"); it scores
0.90–1.00, so it was left alone.

Failed runs in the kept column: shape-sorter 3/3 and letter-sound-link 2/3 timeouts. Shape-sorter's
were a harness defect present in every column, fixed below; letter-sound-link's follow the `aaa`
misjudgement.

## Harness fix: shape-sorter journeys never passed on this payload

`run_live_runtime.py`'s workspace journey answered two items, waited in `transfer` for the second to
read `correct`, then asked "I am ready to finish." Three defects, each found by the next run:
1. A committed success can advance before any packet shows `correct`, so `transfer` waited for a
   state it never saw. It now also accepts the next item appearing.
2. Only the last item's outcome completes a workspace lesson and no tutor tool ends one early, so
   a 4-item payload cannot finish on request. The journey now answers the remaining items (bounded).
3. The closing check required exactly two observer advances; it now requires one per correct answer.

Re-run on the kept design: shape-sorter 3/3 PASS (12/12 credited, 0 false credit, 3/3
demonstrations), counting-board 1/1 PASS. In the first of the intermediate re-runs one journey
answered "show me" verbally without `demonstrate`; that output file was overwritten by the next
re-run, so the kept design's demonstration record is 27 of the 28 runs checked, not 28/28.

## The rejected design, and why

The first attempt put the doctrine in the backend `RUNTIME_INSTRUCTION` (the session system
instruction, already keyed on `workspace.progression=observer`) and cut each adapter to its domain
sentences. Crediting improved, but demonstrations fell from 19/21 to 14/21: asked "can you show me
what you mean?", the tutor answered with speech (counting aloud, a snake sound) or claimed a mark it
never made. Adapter guidance is also echoed in the mount receipt, beside the conversation; the
system instruction is not. The same sentences carried from the adapter restored 21/21. The doctrine
therefore rides in the guidance, and the backend edit was reverted.

## Probes

`tutor-verdict-probe.mjs` and `learner-intent-probe.mjs` send JEV fixed replies and learner turns;
neither includes adapter guidance, and neither the observer criterion nor its inputs changed. They
cannot move with this slice and were not re-run. The connected journeys above are the measurement.

## Checks

`typecheck:lumina` 0 · full `tsc` 770 (baseline) · 3300 tests across live-activity,
direct-instruction, math and literacy primitives (one new: a refused demonstration names its reason
and marks nothing) · backend `tests/tutor_live` 69 passed. `backend/app` is unchanged from HEAD.

## LA-13 consequence

The open LA-13 question was whether the observer's `correct` criterion should credit a bare
affirmation. With the tutor told to credit the learner and name what they got right, 0 of 42 correct
answers across seven domains hit an observer abstention on a crediting reply. The criterion was not
changed and needs no change on this evidence.

## Queued (brief 11 item 8)

The doctrine costs 900 of each adapter's 2000 characters; letter-sound-link has 39 left. The next
doctrine sentence either replaces one or needs the per-offer cap moved (backend).
