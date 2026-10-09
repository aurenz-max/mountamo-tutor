# timeline-builder — support levers, 2026-10-09

Modes: `sequence-daily`, `sequence-yearly`, `place-historical`. One check (Check Order), the same five misses on every
mode (`timelineMiss`). The order of the events IS the answer, so no lever places, numbers, ranks or names an event.

## Failure inventory
| Miss (observable) | Evidence class | Reading |
|---|---|---|
| `adjacent_swap` | observed-synthetic (journey wrong program) + documented (commonStruggles: "confuses two events close in time") | two close events traded |
| `reversed` | inferred | which end of the timeline is earlier |
| `two_swapped`, `one_moved` | inferred | one or two events misplaced against the scale |
| `mixed_order` | documented (commonStruggles: "places events randomly without reading labels") | no ordering at all |

No real-learner evidence; no demonstrations, misconception or remediation files for this primitive.

## Lever table (all three modes)
| Lever | Kind | Carrier | Answers | Leak rule (code) |
|---|---|---|---|---|
| `time_arrow` | help | shown (flag + arrow, earlier → later) | reversed, mixed_order | draws no event |
| `time_ruler` | help | shown: daily = day-part pictures 🌅☀️🌇🌙 (morning-to-night scales only); yearly = every month start → end, wrapping; historical = years at even steps | all five | `rulerLeaks`: no mark is an event's name; never only the cards' own months/years; not declared where scale ends can't be read |
| `fewer_events` | simplify | shown | all five | `practiceLeaks`: `<id>~simpler`, same type, 3 events (2 on a 3-event item) from a code pool, no label shared with any session timeline, never as many events; ungraded |

`nextLever`: adjacent_swap / two_swapped / one_moved → ruler then fewer; reversed / mixed_order → arrow then ruler.
No miss lacks a lever; no `unanswered` entries. Phase 6 (starting positions) not built: the generator has no tier harness.

## Built
`calendar/timelineBuilderLevers.ts` (pure); `TimelineBuilder.tsx` lever state keyed by item, practice timeline,
`pullLever`/`endPractice`, `onScreen`/`practice` facts, arrow + ruler render (workspace path only; scripted path unchanged);
catalog `levers: true`; `liveJourneySpec.ts` rebuilds `~simpler` items; contract R4.

## Gates
| Gate | Result |
|---|---|
| `typecheck:lumina` | 0 errors in timeline files (sibling errors at the time: `timeSequencerLevers.ts`, `liveJourneySpec.ts:763` measure-lab) |
| `timelineBuilderLevers.test.ts` | 48/48 (leak rules over all 12 payload items, builder, miss → lever table, J12 per item) |
| `TimelineBuilder.levers.workspace.test.tsx` + `TimelineBuilder.workspace.test.tsx` | 3/3 + 5/5 |
| journeySweep + workspaceContract, timeline-builder | 16/16 (3 payloads J1-J12, 0 findings; 13 contract) |
| journeySweep + workspaceContract + misses.test, whole run | 2628 passed, 1 failed (`time-sequencer.before-after`, sibling) |

## Tutor replay (gemini-3.8-flash, 3 payloads × 5) — `qa/tutor-reports/replay/timeline-builder-levers-2026-10-09.json`
All code checks 0/15 misses. On `stuck` the tutor pulled `time_ruler` itself 15/15 and described the ruler only in the
reply to its own call. Read by hand: no event placed or ordered; replies compare two events/months (allowed by guidance).
One `lever` reply (yearly, 1/15) said "look at the months for your red cards and try swapping them": after an adjacent
swap that names the fix. Guidance already forbids saying which two to trade; not patched (one sample, no instruction tail).

## Open
- Ruling: "try swapping them" on the two red cards (1/15), and the W1 question on two-event comparisons.
- G1 (from W1): historical cards state years, so the ruler makes K-3 historical items number matching; `/eval-test`.
- Needs a browser check on the arrow and ruler layout (11 month marks at 3 letters on a narrow screen).
