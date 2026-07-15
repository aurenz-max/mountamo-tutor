# Reader Fit: sorting-station @ PRE — 2026-07-15

Modes audited: `sort_one` (S1, THE K census route), `odd_one_out` (S3+), `sort_attribute`
(S2), `count_compare` (S3), `two_attributes` (S4), `tally_record` (S4+) — all claimed at K
via the catalog "ESSENTIAL for Kindergarten and Grade 1." | Probes: eval-test ✓ (6 modes,
grade=K) · tutor-test --probe ✓ · **live --lesson ✓ (3/3 CONFIRMED, 2026-07-15)**

Source: BACKLOG item **1e** (top of the ACTIVE Reader-fit K queue) + handoff
`HANDOFF-sorting-station-PRE-2026-07-15.md`. Invoked with `--fix`. Generator objective-drift
was already FIXED 2026-07-14 (`qa/topic-fidelity/sorting-station-2026-07-14.md`) — NOT
re-opened. This is the presentation audit + fix loop that had never been run.

## Phase 0 — artifacts
- Component: `src/components/lumina/primitives/visual-primitives/math/SortingStation.tsx` (`gradeBand: 'K'|'1'` + `supportTier` already in config; `useLuminaAI`; `[ACTIVITY_START]`/`[NEXT_ITEM]` sends)
- Generator: `src/components/lumina/service/math/gemini-sorting-station.ts`
- Catalog: `src/components/lumina/service/manifest/catalog/math.ts` (id `sorting-station`, ~2989)
- Worst-case renders observed (K, real eval-test draws): `sort_one` 4 objects × 2 text bins
  (Need/Want); bins had **no picture** (`categories[].label` only, no emoji field existed);
  objects WERE emoji-primary (💧 Water, 🧸 Teddy). `two_attributes` 6 objects + compound
  instruction "find the NEEDS that are also FOOD"; `count_compare`/`tally_record` add +/-
  number steppers.

## Audit A — text census (sort_one @ K, worst-case)
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| Instruction "Can you help sort these into a Need pile or a Want pile?" | LuminaPanel | Load-bearing | `[ACTIVITY_START]`/`[NEXT_ITEM]` include it, but **no aiDirectives** → droppable under the lesson one-sentence cap | **UNCOVERED (lesson)** |
| Bin labels "Need" / "Want" (`cat.label`) — the answer surface | Bin headers | Load-bearing | None — `categories` is a contextKey (tutor-reference); no bin picture existed | **UNCOVERED** |
| Object labels "Water" / "Teddy Bear" | Object chips | Supportive | emoji present on every object | COVERED (emoji) |
| "Unsorted Objects" / "Click a bin below to place it" | pool header / protocol hint | Load-bearing (protocol) | None | **UNCOVERED** |
| "N objects are in the wrong bin. Try again!" | feedback text card | Load-bearing (quantitative correction) | bin flash (`LuminaDropZone` correct/incorrect) + SFX carry it; text unreadable | partial |
| Title, description, "Challenge N of M", type/phase badges, "Kindergarten" badge, PhaseSummaryPanel | chrome | Decorative/adult | — | rule-7 offenders (Audit C) |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| sort_one | **FAIL** — `[ACTIVITY_START]` says "Introduce warmly"; no aiDirectives beat; dropped in lesson mode | **FAIL** — the sort RULE + bin NAMES never guaranteed spoken (objects OK, they're emoji) | **FAIL** — no script states "Is this a NEED or a WANT? Tap the bin"; `sortingAttribute`/`categories` sit in contextKeys, never enacted | partial — bin flash + SFX good; but "N wrong" text card (quantitative prose) | partial — scaffoldingLevels referenced abstract `{{sortingAttribute}}` ("look at the category of each object"); struggle #1 said "point to the bin **pictures**" that did not exist |
| odd_one_out | **FAIL** (same, no directive) | n/a (objects are pictures) but the TASK ("which is different?") unread | **FAIL** — no script asks "Which one is different? Tap it" | partial (selection highlight + SFX; no text needed) | partial (struggles spoken, answer-free) |
| sort_attribute, count_compare, two_attributes, tally_record | **FAIL** | mixed | **FAIL** | — | — → see Audit C: these exceed PRE by design (band floor) |

`tutor-test --probe` confirmed in the resolved prompt: **no `aiDirectives` at all**; a dead
`studentAnswer` contextKey rendered "studentAnswer: (not set)".

## Audit C — band contract (sort_one @ PRE, pre-fix)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1. Audio is the instruction channel | **FAIL** | instruction + protocol text gate; intro droppable in lesson |
| 2. Tap = choose | PASS (sort) / **FAIL** (odd_one_out) | sort = multi-part construction (two-tap object→bin + Check is exempt); odd_one_out is an ATOMIC selection yet needed a separate Check button |
| 3. Pictures are the answer surface | **FAIL** | bin headers text-only ("Need"/"Want"); no `bucketEmoji` field existed |
| 4. One thing / ≤5 elements | partial | K sort_one ≈ 4 objects + 2 bins = 6 (generator K-caps 4–6; catalog ceiling of 10 is never reached at K); inherent to a multi-part construction |
| 5. Feedback on the touched object | partial | bin flash + SFX good, BUT "N wrong" quantitative text card |
| 6. No typing | PASS | (floored modes use +/- steppers, not typing) |
| 7. No adult chrome | **FAIL** | challenge-type progress pills, "Challenge N of M" counter, phase badges, description, "Kindergarten" badge, "Unsorted Objects" header, "N wrong" prose |
| 8. Assessment hides in mechanics | PASS | the sort itself is the instrument |

**Overall: PRIMITIVE-GAP + SCAFFOLD-GAP.** The sort/recognition core is sound (NOT a
REBUILD); at PRE the bins were text-gated, the surface was chrome-laden, and the scaffold
lacked ORIENT/STIMULUS/DISAMBIGUATE. Four of the six eval modes exceed a pre-reader by design
→ **WRONG-BAND, band floor** (the word-sorter `match_pairs` precedent).

Findings → fix layer:
1. **SCAFFOLD-GAP (HIGH, all K modes) → CATALOG.** No ORIENT/STIMULUS/DISAMBIGUATE beat → add `aiDirectives`.
2. **PRIMITIVE-GAP (HIGH, sort_one) → COMPONENT + GENERATOR.** Text-only bins → picture-primary (`bucketEmoji`).
3. **PRIMITIVE-GAP (HIGH, all K modes) → COMPONENT.** Adult chrome → band-gate on `gradeBand==='K'`.
4. **PRIMITIVE-GAP (MED, odd_one_out) → COMPONENT.** Atomic selection needs tap=choose (auto-submit, no Check).
5. **WRONG-BAND (routing) → CATALOG.** `sort_attribute`, `count_compare`, `two_attributes`, `tally_record` → Grade 1+ band floor.
6. Feedback "N wrong" prose (rule 5) → hide at K; dead `studentAnswer` key → remove.

## [--fix] Loop log — 2026-07-15

| # | Layer | Change | Verify | Re-audit |
|---|---|---|---|---|
| 1 | CATALOG (math.ts) | **aiDirectives** "SAY THE SORT OUT LOUD AND NAME EVERY BIN FIRST" (ORIENT: read the instruction in child terms + NAME each bin via `{{categories}}` + ask the sorting question; odd-one-out branch asks "which is different?"; explicitly overrides the one-sentence cap; answer-free). Reworded scaffoldingLevels/struggles eyes-free (dropped abstract `{{sortingAttribute}}` meta-language; struggle #1 now "say each bin name aloud"). Removed dead `studentAnswer` contextKey. **Band floors** on `sort_attribute`/`count_compare`/`two_attributes`/`tally_record` descriptions ("Grade 1+ ONLY (never Kindergarten — …)") + a `BAND FLOOR:` clause in constraints. | tutor-test --probe | aiDirectives present in prompt; `{{instruction}}` + `{{categories}}` resolve (component-forwarded); `studentAnswer` gone. Audit B ORIENT/STIMULUS/DISAMBIGUATE now enacted on paper |
| 2 | COMPONENT (SortingStation.tsx) | At `gradeBand==='K'` (`isK`): bin headers PICTURE-primary — big `bucketEmoji` (or a color-coded fallback circle aligned to `BIN_COLORS`) with the word as a caption; **odd_one_out tap=choose** (auto-submit via a ref-latched effect, Check button hidden); chrome hidden (progress pills, "Challenge N of M", description, instruction panel, "Unsorted Objects" header, protocol hint, band badge, "N wrong" text card, per-bin count badge). Reader grades (Grade 1) UNCHANGED. Forwarded `instruction` into `aiPrimitiveData` so the directive's `{{instruction}}` resolves. | tsc (baseline 808, 0 new) + `typecheck:lumina` 0 err + **jsdom 6/6** (`SortingStation.reader-fit.test.tsx`: picture bins, chrome hidden, sort keeps Check, odd_one_out auto-submit + no Check, wrong tap doesn't complete, Grade-1 control keeps chrome) | Audit C rules 1,2,3,5,7 now PASS at K |
| 3 | GENERATOR (gemini-sorting-station.ts) + type | Added `bucketEmoji?` to `SortingCategory`; generator emits `categoryEmojis` (value→emoji, one per bin) in the sort-family + count-compare schemas/prompts; `deriveCategories` attaches `bucketEmoji`. Non-load-bearing (sort correctness is by `rule`); missing → component color-circle fallback. | eval-test @ K | 4/4 sort_one bins carried a picture (🏠 Need / 🎁 Want) |
| 4 | LIVE behavioral gate | Added `build_sorting_station_journey` to `run_tutor_live.py` (verbatim `[ACTIVITY_START]`/`[NEXT_ITEM]` replays; ORIENT bar = every bin label + a sort/question word at both challenge starts; objects are emoji so no per-object read-aloud beat). Registered in `JOURNEYS`. | `--lesson --runs 3` @ Kindergarten, `--eval-mode sort_one` | **3/3 CONFIRMED** — all runs named both bins + asked the question at both starts (e.g. "We have a 'Need' bin and a 'Want' bin"; "Which ones are needs and which ones are wants?"). Zero `stimulus-not-read`, zero answer-leak, 0.0 superlatives/turn. Report: `qa/tutor-reports/sorting-station-live-lesson-2026-07-15.md` |

### Re-audit (after fixes)
- **Audit A:** bin labels now picture-primary (🏠/🎁 or color circle); instruction/protocol/counter/"N wrong" hidden at K → UNCOVERED strings resolved or removed from the child's field.
- **Audit B:** ORIENT + DISAMBIGUATE beat present AND **behaviorally CONFIRMED 3/3** in lesson mode; STIMULUS (rule + bins) voiced 3/3; RECOVER reworded eyes-free.
- **Audit C:** rules 1, 2 (odd_one_out now tap=choose), 3, 5, 7 now PASS at K. Residual: rule 4 (multi-part sort ≈ 6 elements — inherent, accepted) and the completion PhaseSummaryPanel ledger (→ K-stage systemic).

**Overall: was PRIMITIVE-GAP + SCAFFOLD-GAP → now READY @ PRE for `sort_one` and `odd_one_out`**
(picture-primary, chrome-gated, scaffold probe-verified + live `--lesson` 3/3). **`sort_attribute`,
`count_compare`, `two_attributes`, `tally_record` = WRONG-BAND, floored to Grade 1+** (a success
outcome — K still routes to the two picture-primary tap modes; Grade 1 keeps all six).

Residuals (recorded, not blocking):
- PhaseSummaryPanel % ledger + "N / M correct" completion text still render at K (rule 7) →
  **K-stage systemic item** (LuminaCompletionScreen roadmap).
- "Next Challenge" is still a text button (single active element, arrow icon — discoverable;
  candidate for the K-stage wordless-advance pattern).
- `question-stacking` WARN at 1/3 live runs (tutor asked 2+ questions in one breath) —
  global tutor-prompt style, not primitive-local; not confirmed (below the 2/3 bar).
- Pixel-level look of the picture-primary bins + emoji sizing → **HUMAN-CHECKS** (headless
  can't judge it).
- EMERGING (Grade 1) follow-up: the four floored modes want their own picture-primary /
  disambiguate pass when the grade-1 (EMERGING) census runs — out of PRE scope.
