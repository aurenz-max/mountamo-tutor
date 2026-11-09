# Agent display roadmap (USER 2026-11-08)

Executor: `/agent-primitive`. Code: `service/agent-kit/displays.ts`. Index row: `WORKSTREAMS.md` phase 15.

## The idea

When the kit can draw something, the agent writes a few values (`{hour: 9, minute: 0}`) instead of a picture. Output
tokens are the main cost of an agent primitive and the main cause of a slow write, and hand-drawn SVG is most of those
tokens on picture items. A code-drawn display should also make the item better: code can read what is on the screen,
so it can check the key, and every option is drawn the same way, so "one card looks different" stops being possible.

Every display a primitive like `practice-studio` can use is one more kind of item the agent can write cheaply, for
every agent primitive at once.

## Evidence so far

All 2026-11-08 on `gemini-3.8-flash`, 4 items per session. These are comparisons across topics, from before the displays
were built. The before-and-after measurements are in Results below.

| Session | Item text | Share that is SVG | Time |
|---|---|---|---|
| G2 bar graphs (only code-drawn displays) | 5,462 chars | 0% | 111 s full loop |
| G1 Monarch butterflies (23 agent SVGs) | 22,194 chars | 75% | 175 s full loop |
| G1 tens and ones (6 agent SVGs) | 10,388 chars | 65% | 31 s first write |

| First write | Output tokens | Cost | Time |
|---|---|---|---|
| G1 telling time, two runs (a clock on every card) | 10,086 and 15,903 | $0.039 and $0.061 | 64 s and 82 s |
| Six other runs that day (tens and ones, hexagons, others) | 4,619 to 8,239 | $0.018 to $0.032 | 31 to 44 s where logged |

The 11-07 probe (`qa/agent-surfaces/2026-11-07-v1/`) also found code-drawn items the cleanest of the 18.

## Rules for a display

1. The agent gives values and code draws. The renderer is a pure HTML string in `displays.ts`, so the component and the
   author's screenshot show the same thing.
2. Values describe the state of the thing (hour, minute, how many tens). Which values to use stays the agent's choice;
   code checks that they can be drawn and never limits them to a content list.
3. A display shows no answer the item asks for: no digital time printed under a clock unless reading that is the task.
4. `displayWords` states the values in words, so the no-browser fallback and the tutor can read them.
5. Where the display makes the key computable, add the check (clock label against its hands, pieces that fill a shape).
6. Give it a way to draw more for a help lever (highlight the hour hand, outline one ten), so help changes the screen.
7. `svg` stays for anything no display covers. A display never takes that option away. See "When the agent should
   keep drawing" below.
8. Reuse the drawing logic from the existing schema primitive where there is one; it is a React component, so the
   drawing has to be ported to an HTML string.

## When the agent should keep drawing (USER 2026-11-08)

Displays are for pictures that recur and that a few values fully describe. Hand drawing stays the right tool when the
structure of the drawing is the idea being taught. The exemplar is `exemplars/2026-11-08-bridge-trusses/` (G2, triangular
trusses on bridge spans): no one built a truss display or a truss primitive, and the agent drew one for this objective.

What makes those drawings work, and what to keep when writing or reviewing agent SVG:

1. **Only the taught variable differs.** Every card has the same deck, supports and span. Only the web members change
   (none, verticals, triangles), so the child compares structure and nothing else.
2. **Plain line diagrams.** Strokes and a few rectangles, no scenery. The picture holds only what the task uses.
3. **The drawing can test the rule.** The sort includes a square with one diagonal: it looks like a square and belongs
   with the triangles. Text alone could not ask that.
4. **One drawing language across the items.** The bridge from the first item returns in the ordering item, so the child
   learns the picture once.

Do not build a display for a drawing seen on only one topic. AD-2 counts should separate drawings that recur across
topics from one-off concept diagrams like this one.

Not solved by this exemplar (executor `/agent-primitive`):
- The lesson description shows above every item and says triangular trusses carry heavier cargo, which answers items 1
  and 3 before the child looks at a card.
- The objective's Pratt, Warren and K-truss types, 1/10 depth limit and 20% load step do not appear in the three items
  captured. The drawn trusses are visibly deeper than 1/10 of the span.
- The SVG source was not saved, so its token cost is unmeasured.

## How each display is judged

Run the tester's compare mode on one fixed objective before and after, and record first-write tokens, time, cost and
whether the items still teach by playing them. A display that does not lower the cost or raise the quality is not kept.

## Queue

AD-1 was built alone and measured first (pilot, then sweep). Observed means the agent has already been seen drawing it by
hand on a run. Predicted comes from the K-5 math strands and earlier row 15 notes, and AD-2 reorders these with data.

| ID | Display | Values | Basis | Reuse from | State |
|---|---|---|---|---|---|
| AD-1 | `clock` | hour, minute, numerals, highlight | Observed, the most expensive first write | `analog-clock` | Built, measured 11-08 |
| AD-2 | Run record of hand-drawn SVG | per item: SVG chars and a short name of what was drawn (`svg.name`) | Ranks the rest by real use | none | Built 11-08: `drawnByHand` in the run debug, shown in the tester |
| AD-3 | `base_ten` | hundreds, tens, ones, ones_first, highlight | Observed (tens and ones) | `base-ten-blocks` | Built, measured 11-08 |
| AD-4 | `pattern_blocks` | target outline, pieces on numbered slots, loose tray, highlight | Observed (hexagon composition). Code checks "fills the shape" from each piece's size | `shape-composer` | Built, measured 11-08 |
| AD-5 | `ten_frame` | filled, frames, second color, highlight | Predicted | `ten-frame` | Built, measured 11-08 |
| AD-6 | `fraction_model` | bar or circle, parts, shaded, unequal parts, highlight | Predicted | `fraction-bar`, `fraction-circles` | Removed 11-08 (USER): built and measured, cost flat. Fraction items go back to `number_line` and agent SVG |
| AD-7 | `array` | rows, columns, grouping, icon, highlight | Predicted | `array-grid` | Built, measured 11-08 |
| AD-8 | `coins` | list of coins and bills, highlight | Predicted | `coin-counter` | Built, measured 11-08 |
| AD-9 | `pictograph` | icon, key value, labels, values, highlight | Predicted | none | Built, measured 11-08 |
| AD-10 | `timeline`, `map` | timeline: events with optional dates. map: places, paths, regions, legend, compass | Predicted, non-math | `map-explorer` is a live map, not a display | Built, measured 11-08 |
| AD-11 | `flow` | steps with optional icons, loop, highlight | Observed (Monarch stages drawn by hand). The first science display | none | Built, measured 11-08, result inconclusive (below) |
| AD-12 | Life-lab's drawings in the registry (beak, feet, seed, moth, critter) | shape and color values | They exist only in `LifeLab.tsx`, so other primitives cannot use them | `LifeLab.tsx` | Queued: port when a second primitive needs one |
| AD-13 | Screenshot in `runAuthor`, so `svg` can go on life-lab's menu | none | Life-lab cannot draw a part no emoji shows | `look.ts`, `svgPng.ts` | Built 11-08: a view with `drawn` always comes back to the author; `svg` is on life-lab's menu |
| AD-14 | Biology: `cell`, `zoom`, `food_web` | cell: kind, parts by shape with label and count. zoom: levels. food web: living things by level, who eats whom | USER 11-08: biology-specific displays. Agent drew cells and zooms on real runs | none | Built 11-08, not yet measured before and after. `drawnByHand` in real runs ranks the next (organ cross sections are the likely one) |

## Results (2026-11-08)

Measured on `gemini-flash-latest`. Each row is the mean of 3 first drafts with no review. "Before" hides that one display from
the author, so it draws the picture by hand (the tester's "Hide a display" control). First-draft cost varies a lot from run to
run because thinking tokens vary, so 3 runs give the direction and not a precise figure.

| Display | Cost before | Cost after | Saved | Time before | Time after | Output tokens before | Output tokens after |
|---|---|---|---|---|---|---|---|
| clock | $0.0700 | $0.0207 | 70% | 117 s | 42 s | 9,149 | 1,846 |
| base_ten | $0.0288 | $0.0171 | 41% | 51 s | 29 s | 3,640 | 1,951 |
| pattern_blocks | $0.0259 | $0.0181 | 30% | 43 s | 29 s | 5,092 | 2,227 |
| ten_frame | $0.0346 | $0.0194 | 44% | 60 s | 35 s | 4,692 | 1,819 |
| fraction_model | $0.0279 | $0.0267 | 4% | 49 s | 46 s | 4,325 | 2,399 |
| array | $0.0344 | $0.0175 | 49% | 56 s | 29 s | 5,870 | 2,215 |
| coins | $0.0372 | $0.0179 | 52% | 61 s | 31 s | 6,208 | 2,199 |
| pictograph | $0.0398 | $0.0263 | 34% | 67 s | 47 s | 6,277 | 2,239 |
| timeline | $0.0299 | $0.0168 | 44% | 47 s | 28 s | 6,142 | 2,359 |
| map | $0.0309 | $0.0206 | 33% | 51 s | 34 s | 7,081 | 2,672 |

`fraction_model` saved output tokens but the author thought longer, so cost did not move, and it was removed under the "not kept"
rule above (USER 11-08). The row stays here as the record.

`flow` (AD-11), G3 butterfly and frog life cycles on `gemini-flash-latest`, 3 first drafts each way: $0.0210 and 41 s with it,
$0.0264 and 48 s with it hidden, about 20% cheaper. That is inside the run-to-run noise, and item counts differed (3 against 3 to 4).
The agent used `flow` in 2 of 3 runs; with it hidden it drew SVG in 2 of 3 and used `timeline` in 2 of 3. It stays because it is
life-lab's only way to show a cycle (no `svg` on that menu yet). Re-measure when AD-13 lands.

Each display then ran one full write, look and revise session in the real tester, using `Offline (free)`: every choose item was
answered wrong once, every item was answered right, and the help lever was pulled where the item had one. All 10 sessions finished
with 4 items each and every help lever changed the screen. Screenshots and run summaries: `qa/agent-surfaces/2026-11-08-displays/`.
