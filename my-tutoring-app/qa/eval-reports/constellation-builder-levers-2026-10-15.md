# constellation-builder — support levers, 2026-10-15

Built on the W1 binding (`qa/tutor-reports/constellation-builder-w1-2026-10-15.md`). Not committed.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or eval-report files for constellation-builder).
Documented = the catalog's `commonStruggles` (random taps with no pattern in mind; a wrong star near a right one; dim
stars taken for pattern stars); synthetic = the journey's scripted wrong taps and names; the rest inferred.

| Mode | Failure (miss) | Class |
|---|---|---|
| guided_trace | taps a later star, one already joined, or one not in the order (`later_star`, `traced_star`, `other_star`) | documented, synthetic |
| free_connect | joins two pattern stars the pattern does not join (`wrong_pair`) | documented, synthetic |
| free_connect | taps a dim background star (`background_star`, medium/hard) | documented |
| identify | names another constellation on screen (`wrong_name`) | synthetic, inferred |
| seasonal | names a constellation of another season (`other_name`), picks several (`several_names`) | synthetic, inferred |

## Lever table (built, `constellationLevers.ts`)

| Mode | Lever | Kind | Answers | Leak rule (code) |
|---|---|---|---|---|
| guided_trace | spotlight | help | every guided miss | fades every star but the ringed one and those already joined; marks only the star the ring marks |
| free_connect | shape_card | help | wrong_pair, background_star | a card beside the sky with the pattern's lines and stars only; no background star, no field position |
| free_connect (medium/hard only) | bright_stars | help | background_star | the pattern's stars drawn bright, as the easy tier draws them; never a line |
| all | easier_pattern | simplify | every miss of the mode | same mode, a real pattern from a code library of 7 (`PATTERNS`); trace: fewer stars; identify: two names, none the item offers; seasonal: another season, two names, the foil from a third season; never the item's name (`practiceLeaks`) |

Starting position: the existing tier (easy draws the pattern bright, so `bright_stars` is offered only at medium/hard);
no new tier code. Each help lever's picture has no words.

## Gates
- `constellationLevers.test.ts` 20/20 (miss table, miss -> next lever table, the easier item over every saved payload
  item, the plain identify/seasonal question), `ConstellationBuilder.workspace.test.tsx` 10/10 (pull changes screen and
  scene in one commit, repeat pull blocked, next attempt records the lever, practice ungraded and the full item credited
  after it).
- Sweep lever inventory: every catalog miss answered on every mode, 0 gaps; J9, J12, J13 clean.
- Replay r2: 0 misses on every check, `no_change_before_receipt` included. On "I'm stuck" the tutor pulled spotlight,
  shape_card or easier_pattern itself in 20/20 samples and described the change after the call.

## Failures with no lever
- identify has no help lever: it is recognition, so any picture of an option's shape answers it by matching. Its miss is
  answered by the easier pattern.
- seasonal has no help lever: the answer is recalled knowledge, and a sky chart for the season is the answer.
- A trace already as small as the smallest pattern (3 stars, e.g. Orion's Belt) has no easier pattern; its help lever
  answers its misses.

## Open
- Browser check on the spotlight ring, the shape card and the practice field.
