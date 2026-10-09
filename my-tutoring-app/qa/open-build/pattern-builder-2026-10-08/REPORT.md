# pattern-builder `create`: open build (OB-9M), 2026-10-08

The existing `create` mode upgraded in place, not a new mode. Its task identity and β (4.5) are unchanged: the
learner makes their own repeating pattern. User ruling 10-08: build = create.

## What changed
- **The ask names a shape and the tokens are the learner's.** "Make your own A B B pattern (one thing, then two the
  same). Use any tokens, and repeat it at least two times." Code picks the shape for each item: at K-1 AB, ABB, AAB
  (then ABB, AAB again); at grades 2-3 AB, ABB, AAB, ABC, AABB. Code also writes the instruction, hint and narration,
  and makes sure the palette has enough different tokens for the shape.
- **Judge (code):** the first part has the asked shape and the row repeats it at least two whole times. A trailing
  partial repeat is fine. Misses: `too_short`, `other_shape` (new: AB made when ABB was asked, or one token over and
  over), and `no_repeat`. The old judge passed any repeat, including "red red red red".
- **Surface:** the row is now one svg, wrapping at six per line, so the watcher's picture is what the learner sees.
  Tapping the last token takes it off. "Start over" and "I'm done!" replace Undo and Check. The asked shape is drawn
  as grey glyphs (◯ △ ◇) with small letters under them. A drive showed that a printed "A B" read against the
  palette's "B" (blue) tile.
- **Try again keeps the row**, and the verdict's words stay on screen. The words name the miss and the shape, never
  tokens to tap.
- **Scene facts:** `askedShape`, `row`, and two numbers, `tokensInRow` and `differentTokens`. `workHistory` records a
  turn back, for example `tokensInRow 6 → 0 → 6`.
- **Watcher:** `useBuildWatcher`, with `numbers: 'never'`, `neverSay` (pattern, repeat), and a task phrased without
  the shape words. The shared layer gained an optional `made` field: exact facts about what the child placed. Without
  it, flash-lite misnamed colours from the picture twice ("purple", then "blue" for a red tile). No other primitive
  sets `made`, so nothing else changed.
- **Older payloads** with no `createShape` keep the old any-repeat check, now also requiring two different tokens. The
  saved `pattern-builder.create` payload still passes.
- **Registry:** catalog description, guidance sentence, and the `other_shape` miss. The live adapter checks that the
  shape is known and that the palette has enough tokens for it. The journey driver gives a kept row a Start over.
  New payload `pattern-builder.create-open-build.json`.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 |
| full tsc | 771, none in a touched file (a peer session is editing at the same time) |
| pattern-builder suites, including the new `PatternBuilder.create.workspace.test.tsx` | 32/32 |
| live-activity + catalog + math + build-layer suites | green (one BarModel load timeout passes alone, 24/24) |
| journey sweep | all 6 pattern-builder payloads, 0 findings, every miss named |
| real generation (`scripts/pattern-builder-create-probe.mjs`) | 3/3 clean: K [AB, ABB, AAB, ABB, AAB]; G2 and G3-hard all five shapes; adapter accepts each |
| headless drive (`drive.mjs`, `drive.json`, `shots/`) | 17/18 |

The drive went: AB asked → ABB made twice → `other_shape` ("That repeats, but it is not A B yet.") → Try again kept
6 → Start over → AB twice → pass. Then ABB asked → 5 tokens → `too_short` → added one → pass. Palette tokens are
44 px, and there were no page errors.

The one failed check: only 3 of 5 watcher looks produced a line. The filter drops a line rather than show a bad one.
All 3 kept lines named only colours on the row, with no number and no verdict.

## Not done / open
- **No levers anywhere on pattern-builder.** The bench reads "This item declares no levers", and every `create`
  miss is unanswered. Build mode step 6 wants levers, bare at the start. The next step is `/add-support-tiers`
  pattern-builder. One help lever, a model of the asked shape in tokens not on the palette. One simplify lever: AB
  instead of the longer shape.
- No Live run. The tutor's wording on the shape ask rides the next class Live gate.
- The watcher keeps about 3 lines in 5.
- The K-1 mixed (unpinned) prompt still says no `create` at K-1, while the catalog constraints allow it when the
  objective asks. That inconsistency predates this slice.
