# digital-skills-sim W1 binding (ROLLOUT R1 batch 4), 2026-10-16

**Shape P, three modes, all bound** (click, drag, type). Levers in `../eval-reports/digital-skills-sim-levers-2026-10-16.md`. Not committed.

## Verdict on the old screen, and what changed
Every answer was on screen. click drew one pulsing target, and any click on it was right (a click on empty space
was the only miss). drag drew one item and one drop zone. type showed the letter in a bouncing card and ringed the
same key on the keyboard. The Gemini schema wrote each challenge; the score was correct/total, and since every
challenge stayed open until right, it was always 100.

Rebuilt so that each mode has one right action among wrong ones, built and keyed by code (`digitalSkillsWorkspace.ts`):
- **click**: 2, 3 or 4 pictures from a theme (farm, ocean, space, food, school, toys), no words, all drawn alike; the
  question names one ("Click the duck."). easy 2 large, medium 3, hard 4 small. The target's place cycles across the
  set. The arena is one SVG; a press and release is read in viewBox units, so the check is pure geometry.
- **drag**: a picture and 2, 3 or 4 boxes drawn as pictures (basket, box, bucket, cart, bowl), no words; "Drag the
  hen into the bucket." The learner presses on the picture, holds, moves it and lets go; the drop is where the
  picture's centre is let go. A press that does not start on the picture, or a move under 12 units, commits nothing.
- **type**: an on-screen QWERTY keyboard of capitals, all keys alike; a card shows easy a capital letter, medium a
  small letter whose capital looks different (a, b, d, e, ... the key shows the capital), hard a three-letter word
  typed in order (a wrong key at any place commits the miss). A real keyboard works too.
- **Generator**: Gemini writes only the title, one sentence and the theme. Code builds the items from the eval-mode
  pin and `config.difficulty`. A legacy payload (model-written `challenges`) is rebuilt in its modes.
- **Scripted path** (tester, no tutor): a right answer moves on after 0.9 s; a wrong one shows "Not quite. Try again!"
  and clears. Its score is now the share right on the first try.

Every mode is a gesture (J14): the answer is an action on the screen. Saying the letter aloud is letter naming, not
finding the key, so type is not a speech item. The key buttons are labelled "Tap M" for the driver and screen readers.
Misses (`skillMiss`): click `wrong_picture`, `missed_picture`; drag `wrong_box`, `let_go_outside`; type
`neighbour_key`, `mirror_letter`, `wrong_key`.

## Rulings (closed 2026-10-16) (removed or reshaped)
**Accepted by the user 2026-10-16** (`../HANDOFF-r1-batch4-rulings-2026-10-16.md`): R14 labels removed (wrong-tap feedback in click mode queued to `/eval-fix digital-skills-sim`), R20 first-try share, R25 fixed themes, K-1.
- **Score semantics on the scripted path**: first-try share instead of correct/total (which was always 100). The
  workspace path scores through the shared first-response gate as before.
- **Labels removed**: pictures and drop zones carry no words (the old zone showed its label). The tutor voices the
  name; `show_picture` gives a picture of it.
- **Model-written challenge content dropped**: targets, drop-zone names and "A for Apple" key hints are no longer
  generated. Themes are six fixed picture sets; drag boxes are five fixed containers.
- **Grades**: the workspace declares Kindergarten and Grade 1 (catalog constraint "K-1 only" kept).
- Betas and eval-mode ids unchanged; the catalog description and eval-mode descriptions were rewritten to match.
  `problem_type_registry.py` descriptions were left as they were.

## Gates
- `typecheck:lumina`: 0 errors in this primitive's files. The run shows 28 errors in other agents' files
  (liveJourneySpec.ts duplicate imports `vocabItems`/`timelinePracticeParent`, timelineExplorer*, howItWorksLevers,
  FactFile.workspace.test, EngineeringPrimitivesTester). Not touched.
- `DigitalSkillsSim.workspace.test.tsx` 15/15; with `ExhibitWorkspaces.surface.test.tsx`, `lessonWorkspacePlan.test.ts`
  and `misses.test.ts`: 222 passed.
- Payloads `w1-payloads/digital-skills-sim.{click,drag,type,type-hard}.json` (click medium, drag hard, type medium,
  type hard; Grade 1, farm theme). The first run's title copied the schema example and a click description said
  "type answers"; the prompt now names only the session's modes and the example is gone.
- `workspaceContract.test.tsx` for this id: 17 passed.
- Sweep: 0 findings J1-J15 on the four payloads, misses named 20/20, no advisories; clean record 100, recover record
  score 67 / first response 0.

## Replay
gemini-3.8-flash, `TUTOR_REPLAY_ITEMS=all`, 20 items x 5 samples; no `--observe` (no spoken mode).
`replay/digital-skills-sim-2026-10-16{,-r2}.json`. I read every miss, stuck, lever and credit reply.
- **r1.** Automatic checks: 16 `not_empty` misses, all HTTP 429 quota errors (other agents were replaying at the same
  time), not empty replies. When I read the replies: no reply gave a picture's or box's place or named the right one after
  a miss. On small-letter items, 2 of 25 stuck replies said the capital ("look ... for the capital letter H"), which
  does the case match the medium tier asks for. Replies named the glowing row ("the middle row is glowing"), which is
  on screen, but the guidance said never to name a row.
- **Fix.** Guidance: a glowing row may be named; for a small letter, never say or spell its capital.
- **r2** (`--concurrency 2`). The 5 `not_empty` flags are again 429 errors. No reply names a capital on a small-letter
  item, a place, or the right picture, box or key. Rows are named only when they glow. Credit replies say what the learner
  did. One stuck reply out of 100 narrates in the first person ("I lit up the top row"), which is the shared lever-doctrine
  finding that the agent editing `adapterContract.ts` owns. I counted it and did not fix it here.

## Undriven modes
None. The sweep drives clicks and drags as `draw` strokes on the arena SVG and keys by their labels.

## Open findings
- Needs a browser check: the drag on a real mouse and a touch screen (pointer capture, the picture following the
  finger), the arena's size on a phone, and a physical keyboard. Only JSDOM has run it. `/eval-test`.
- No `docs/contracts/digital-skills-sim.md`; the new requirements (code keys, no marked target, gesture only) are
  recorded only here. `/primitive-contract`.
- Emoji rendering of the newer pictures (bucket, kite, yo-yo, planet) is not checked on older devices. `/eval-test`.

## Follow-up 2026-10-16 (R14)
- A wrong try on the scripted path cleared itself after 700 ms, so a wrong click read as no response (browser run 10-16).
  It now stays (red mark, pressed key, "Not quite") until the next try clears it. Re-driven in headless Chromium on
  click easy and hard: the card and one mark show 1.5 s after a wrong tap; the next tap leaves one mark.
- The rebuilt generator read only the topic (intent contract test, 187/188). It now frames the title and picture set
  from the lesson scope: same topic, a farm intent gave the farm set and a space intent the space set.
