# length-lab — W1 workspace binding (plain shape), 2026-10-09

ROLLOUT C10. `withWorkspaceController`: the scripted path is kept (one try per challenge, Next).

## Modes and what code checks
All six catalog modes are gesture items; the activity's own check (`lengthLabMatches`, `lengthLabWorkspace.ts`) is the judge, so no `expectedAnswer` and no key in the scene facts.

| Mode | Learner input | Check | Misses (`lengthMiss`) |
|---|---|---|---|
| compare | tap a choice | choice = `correctAnswer` | reversed, said_same, missed_same |
| estimate_then_tile | tap a guess (never graded), + tiles, Check | tiles = count | tiled_to_guess, one_short, one_over, short, over |
| two_unit_compare | tile unit A, Check; tile unit B, Check; tap a unit | unit = the one with the larger count | chose_bigger_unit |
| tile_and_count | + tiles, Check | tiles = count | one_short, one_over, short, over |
| order | tap 3 objects into slots, Check Order | slots = `correctOrderCsv` | reversed_order, swapped_pair, other_order |
| indirect | tap a choice | choice = `correctAnswer` | chose_shorter, said_same |

Workspace-only changes: a wrong tile count no longer prints the right count (it did: "the crayon is 4 cubes long", before Try again); Try again remounts the tiling/ordering rows and clears the choice, keeping an estimate's guess. Two-unit work is described by position ("first unit"), because a unit name in the miss message is the other choice (sweep J3 caught it).

## Gates
- `typecheck:lumina`: 0.
- `LengthLab.workspace.test.tsx` 10/10, `pip/LengthLab.surface.test.tsx` 4/4 (its `+` lookup now reads the `Add <unit>` label).
- `workspaceContract`, `misses.test.ts`, `lessonWorkspacePlan`, `activityContract`: 2268/2268.
- Sweep `-t length-lab`: 6 payloads, 19 items, 0 findings, 19/19 checked misses named.

## Tutor replay (6 payloads x 5 samples, `replay/length-lab-2026-10-09.json`)
0 misses on every check except `no_key_before_try`: start 6/25, stuck 2/25. Read by hand, all 8 are false positives: the tutor reads the three compare choices aloud (the guidance asks it to; the learner may not read), lists the estimate guesses 2-5 (the true count is one of them; a guess is never graded), and restates the on-screen indirect clues as a chain. No reply names the answer alone. Guidance not changed. The check cannot tell "lists every on-screen choice" from "says the key": harness finding below.

## Undriven modes
None.

## Open findings
1. **Generator, two_unit_compare** (`/eval-fix`): instructions name other units than the ones drawn ("tiny beads versus big paper clips" over cubes and bears; all 3 items in the saved payload).
2. **Generator, order** (`/eval-fix`): an instruction can list the objects in answer order ("Put the crayon, pencil, and straw in order", answer crayon,pencil,straw; 1 of 3 items).
3. **Harness, replay_checks `no_key_before_try`** (`/add-live-tutor-tools`, shared): a reply that reads out every on-screen choice is flagged as stating the key. Record the item's choice labels and exempt a reply that names all of them.
4. Needs a browser check on two_unit_compare and order (JSDOM only).
