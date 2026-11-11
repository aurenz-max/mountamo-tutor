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

## Drawing guide and blind drawing look (USER 2026-11-09, deep-dive pilot)

`DRAWING_GUIDE` (`displays.ts`) gives the author four kinds of teaching drawing as craft: comparison, schematic,
cut-away, process. Code never asks which kind a drawing is. The author writes `shows`, one sentence on what the drawing
must make visible, and `lookAtDrawing` (`look.ts`) checks the picture against it. On a diagram the reader also matches
each pin to shuffled part names, and code grades that.

Reader on 7 saved drawings, with the caption standing in for `shows` ($0.02): the two-houses safe-house diagram failed
on all 4 pins and the flower diagram passed. Captions that claim more than a drawing can show failed too, so a run
with real `shows` sentences is the fair test.

Bench `qa/deep-dive-bench/drawing-guide-2026-11-09.json` (railroad, flower, seasons, images on, $0.75): railroad moved
to a Big Dipper schematic and the safe-house drawing is gone; the reader sent back one drawing and the author fixed it;
flower kept a clean cut-away; seasons drew nothing. One sample per lesson.

Open: the reader does not catch colored repeats (two full-color petals, against the write_diagram rule) or a Big Dipper
line that ends on no star. Seasons used all 12 turns with no drawing in it, cause not investigated.

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
| AD-15 | Deep-dive `write_chart`: numeric x-axis on a line, 2-4 groups on bar and line | group on each point | USER 11-09. A line with uneven years was drawn evenly spaced | `ChartInsetRenderer` | Built 11-09. Browser-checked on a fixture. Real lesson (`qa/deep-dive-bench/chart-series-2026-11-09.json`) wrote a chart without groups, so the model's use of groups is unobserved |
| AD-16 | `scatter` with optional trend line | points, axis labels, trend | USER 11-09 | none | Queued |
| AD-17 | `coordinate_plane` and function graph | points or an equation; code computes the plotted points | USER 11-09. Largest gap for middle school math | `coordinate-graph` | Queued |
| AD-18 | `dot_plot`, `histogram`, `box_plot` | raw values; code computes bins and quartiles | USER 11-09 | `dot-plot`, `histogram` | Queued |
| AD-19 | A check on a chart, answered only by reading it, and a highlight for the tutor's help | question; highlighted bar or point | USER 11-09. Tables have a check, charts did not | `DataTableBlock` | Check built 11-09 (optional `patternCheck` on `write_chart`, the author decides). Highlight built in the kit `chart` only; deep-dive has no help lever on a chart yet |
| AD-20 | `chart`: line, bar or pie, 2-4 groups, numeric x to scale, one set of validation rules shared with `write_chart` | chart type, axes, points with optional group, show_values, highlight | USER 11-09: reading a chart is a capability every problem should have | `chartView.ts` | Built 11-09, real runs below. Before-and-after cost not measured. `bar_graph` stays for one plain set of bars |
| AD-22 | Parts to tap (`point` surface) | a display names its parts (`parts` in its registry entry) and draws one unseen `data-part` shape per part; `highlight` set to a part lights it | USER 11-09: an answer surface every display with addressable parts gains | highlight targets | Built 11-09 for chart, pictograph, timeline, flow, map, zoom, food_web; `displays.test.ts` fails a display whose parts and tap shapes differ. Practice-studio and deep-dive (`write_check`) both offer it. Not yet chosen by a model in a real run (deep-dive ROADMAP DD-20). Next displays: DD-21 |
| AD-21 | Deep-dive chart: long y-axis label is clipped ("Carbon Dioxide (" with the unit cut off) | none | Seen 11-09 in the real lesson | `ChartInsetRenderer` | Queued (`/agent-primitive`) |

## Reading a chart in both primitives (2026-11-09)

Practice-studio gets `chart` as a display on its answer surfaces. Deep-dive keeps `write_chart` and it can now carry a question,
so the block becomes a check. Both use `chartView.ts` for the data model and rules. Deep-dive's blind reader did not receive a
chart's numbers before this; it does now, because `studentView` adds them.

One real run each, $0.217 (`2026-11-09-charts/`). Practice-studio, on an objective about line and double bar graphs, used `chart` on
4 of 4 items: a value, two group comparisons and an order by combined totals. Deep-dive on CO2 since 1960 (apply) added a trend
question to its one chart unprompted. Its distractors were weak ("dropped steadily", "stayed flat"). Browser drive of that lesson in
the tester: chart drawn, explanation hidden until answered, wrong then right answer scored, no page errors.

### What the chart questions demand (sample, 2026-11-09, $1.00)

16 practice-studio items across four objectives, every key recomputed by hand from the plotted values, all correct:

| Demand | Items |
|---|---|
| Read one value | 1 |
| Compare two or more points or intervals | 10 |
| Combine values or more than one step | 5 |

Deep-dive, three chart questions before a prompt change and three after (one question each per lesson, too few to call a trend). Before:
direction of a line, where data crosses 50%, "which statement is true" answered by the tallest bar. After: a ratio from two bars, direction
of a line, largest drop. The tool now says a question answered at a glance is too easy. One lesson wrote no chart.

Code added: wrong options too close to read apart on the axis are sent back (`optionsTooClose`, closer than a quarter of the axis spacing,
when the key is a plotted value between marks). It fired on none of the shipped items, so it guards a case not seen yet.

Open (executor `/agent-primitive`):
- The largest-drop key was "1975 to 1990", the longest span offered and one that contains another option, so a child can pick it by length of time.
- A bar chart of uneven years (1800, 1850, 1900, 1920) spaces them evenly. Only line charts are drawn to scale.
- Plain value reading is rare (1 of 16). The objectives sampled asked for interpretation, so this may be right; check on a read-a-value objective.
- One of 5 practice sessions died on invalid JSON from the first write. `itemLoop` now retries once. It did not recur, so the cause is unknown.

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
