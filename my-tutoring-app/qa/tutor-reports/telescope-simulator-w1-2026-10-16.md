# telescope-simulator W1 binding (R2 batch B1), 2026-10-16

**Shape P, rebuilt under the 10-15 ruling, four modes, all bound.** Levers in
`../eval-reports/telescope-simulator-levers-2026-10-16.md`. Not committed.

## What the old screen did, and what changed
The old primitive was a free sandbox. Each target was drawn with its name in yellow and a dashed ring until tapped; the
target list named every target and clicking a row pointed the telescope at it; labels defaulted on; with no targets the
score was the share of objects clicked; Venus was forced into every target list; Gemini placed every object. Finding a
target meant reading its name.

Rebuilt so that each mode is a task with a code-built key (`telescopeWorkspace.ts`). A table of 17 real objects
(magnitude, kind, colour, and the weakest instrument that shows each feature) and a table of 11 instrument details
(`DETAILS`) are the only sources of truth. Gemini writes the title and a one-sentence overview, nothing else.
- **find_by_look** (tap): 3-4 unnamed objects through a small telescope; the ask describes one look ("Find a pink cloud
  with a dark gap across it."). The key is the one object whose drawn look has every clue. Colours are keyed by groups a
  child can tell apart (white and blue-white count as one clue), so code never builds an ask only a near-identical
  colour separates.
- **brightest** (tap): 2-4 unnamed objects through binoculars, each as bright as its magnitude; tap the brightest.
- **object_type** (speech + tap): one unnamed object in the middle; say or tap Moon / Planet / Star / Star cluster /
  Nebula / Galaxy.
- **pick_instrument** (speech + tap): "Which is the least powerful instrument that lets you see Saturn's rings?" The
  object is drawn as seen with just your eyes (no key is above that), and the view switches to the key instrument only
  after credit.
- **Screen**: no name, ring or badge before credit; after credit the names appear under the objects. No free panning,
  zoom slider, focus, view modes, journal, hints or target list. Frame on the Lumina kit; the eyepiece is bespoke SVG.
- **Default modes by grade** (no pin): 2: find_by_look + brightest; 3: + object_type; 4-5: all four. Band floor 2 kept.
- **Metrics** (`TelescopeSimulatorMetrics` unchanged, reinterpreted): targets = items, found = credited items,
  telescopeTypesUsed = the instruments the items are drawn through; focus, journal, pan fields fixed.

Misses (`telescopeMiss`, spoken ids the same): find `near_match`, `shares_clue`, `other_object`; brightest
`picked_biggest`, `picked_dimmer`; object_type `sharp_mixup`, `fuzzy_mixup`, `other_family`; pick `too_weak`,
`too_strong`.

## Gates
- `typecheck:lumina` 0. Full `tsc` 772; none in the files I touched (the +2 over 770 are outside `components/lumina`).
- `TelescopeSimulator.workspace.test.tsx` 16/16. Astronomy dir + generator reader-fit + Pip science surface + catalog
  (incl. `misses.test.ts`) 635/635. `live-activity` 4231 passed, 2 failed: both `fraction-bar.compare`, another
  session's work in progress (a new mode with no journey input yet); every telescope case passes.
- Payloads `w1-payloads/telescope-simulator.{find_by_look,brightest,object_type}.json` (hard) and `.pick_instrument.json`
  (medium), Grade 4, from `save_payload.py`.
- Sweep: 0 findings J1-J15 on the four payloads; misses named 4/4 each; clean 100, recover 67 (first-response 0).
  Advisories on object_type and pick_instrument: the key is in the choice list, which is on screen.

## Replay (gemini-3.8-flash, 16 items x 5 samples, `--observe`)
Saved `backend/tests/tutor_live/replay/telescope-simulator-2026-10-16{,-r2}.json`. Read by hand, every non-start reply.
- **r1.** Automatic checks: 11/400 "press Check Answer" (protocol). Reading found two leaks the checks scored 0:
  - object_type (Mars): 4/10 stuck and lever replies said "a steady ball rather than twinkling like a star" or "instead
    of twinkling like a star or spreading out like a cloud", which rules kinds out.
  - pick_instrument: "Which instrument from your choices is the least powerful one on that list?" (3/15 on the item
    whose key was the weakest choice) and "one step up from our eyes" (1/5): both point at the key by its place.
  - brightest: credit replies called Venus a "bright white ball" though the view draws a dot (look phrases now follow
    what the brightest view draws).
- **Fixes**: guidance (object_type: never say what a look means or rule a kind in or out; pick: never point at a
  choice by its place in the order, never say how much magnifying a detail needs); tap-mode task text no longer says
  "presses Check Answer".
- **r2.** No reply names a key, rules a choice out or points by position. Object_type replies describe only what is
  drawn ("stripes and a line of tiny dots"). Remaining check flags: 4/80 start replies tell the child to press Check
  Answer, the real button. About 4/80 brightest replies after `same_size` say "so size won't fool you", after the
  learner already picked the big one; left as is.

## Browser
Headless Chromium on the Astronomy tester (scripted path, :3000): every mode generated and rendered, 2 items each,
real mouse clicks on the SVG objects: a wrong pick checks wrong, the key credits and names appear, pick_instrument
switches the view to the key instrument. 26/26 checks. Not driven in a browser: the workspace path (tutor) and the
lever cards. Needs a human check at phone width and of the twinkle.

## Undriven modes
None (taps through `data-pip-object="sky-<n>"`, choices by label).

## Open findings
- No `docs/contracts/telescope-simulator.md`; the new requirements (code keys, nothing named before credit, the pre-answer
  view never shows the detail) are recorded only here. `/primitive-contract`.
- The spoken path is not swept (the row taps). `/eval-test`.
