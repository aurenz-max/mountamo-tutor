# Reader Fit: comparison-builder @ PRE — 2026-07-14

Modes audited: compare_groups (K, beta 1.5 — the live-observed mode) | also noted:
one_more_less, compare_numbers, order | Probes: eval-test ✓ (real K content)
tutor-test --probe ✓ | **live --lesson ✓ (3/3 PASS, 2026-07-14)**

Origin: BACKLOG item 2, user-observed live K lesson 2026-07-13 — tutor never
asked/clarified WHICH comparison to make.

## Audit A — text census (compare_groups @ K)
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Let's count! Does the left group have more, fewer, or the same number of apples…" | `LuminaPrompt` (generated `instruction`) | Load-bearing | In RUNTIME STATE only (tutor-reference); no beat READS it | UNCOVERED |
| "More" / "Fewer" / "The Same" | answer buttons | Load-bearing (they ARE the answer surface) | none — text-only, no icon | UNCOVERED |
| "Left" / "Right" (SVG labels) | compare-groups svg | Supportive (color-coded) | n/a | ok |
| "Left: N / Right: N" count badges | below svg | Supportive→leaks count | n/a | chrome |
| Mode-tab labels "Compare Groups" etc, "Kindergarten" badge, "1/5" counter | header chrome | Decorative (adult) | n/a | chrome |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| compare_groups | ✗ ([ACTIVITY_START] says only "introduce warmly"; no directive enacts the task) | n/a (groups are visual) but the *question* is unread | **✗ FAIL** — no script states "Which side has MORE? Tap it." (`instruction`/`askFor` sit in contextKeys, never enacted; no `aiDirectives` block exists) | partial (SoundManager beep + tutor hint; text card unreadable; no per-object animation) | partial — struggles are spoken, but **level3 leaks the answer** |

Confirmed in the resolved prompt (tutor-test --probe, K):
- **No `aiDirectives` at all** → nothing carries ORIENT/DISAMBIGUATE past the
  "one-sentence" lesson cap. This is the live failure.
- **Answer leak (HIGH, flagged by tutor-test):** `scaffoldingLevels.level3`
  resolves to *"…5 is **more** 3, so we use the **more** symbol."* — `{{correctAnswer}}`
  spoken to the child.
- **`{{#if …}}` handlebars render literally:** TASK line prints
  `{{#if leftCount}}…{{/if}}` verbatim; level2 prints
  `{{#if useAlligatorMnemonic}}Remember, the alligator eats the bigger number!{{/if}}`
  as junk. `interpolate_template` does key substitution only.

## Audit C — band contract (compare_groups @ K)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is instruction channel | FAIL | question only in a text prompt; no read-aloud beat |
| 2 tap = choose | FAIL | atomic 3-way select still needs a separate **Check** button (two-tap) |
| 3 pictures are answer surface | FAIL | "More/Fewer/The Same" are **text** buttons, no icon |
| 4 one thing / ≤5 elements | PASS (groups) | (one_more_less separately FAILs — up to 21 number cells) |
| 5 feedback on touched object | FAIL | feedback is a transient text card + generic beep, not on the group |
| 6 no typing | PASS | — |
| 7 no adult chrome | FAIL | mode tabs, "1/5" counter, "Kindergarten" + type badges, count badges |
| 8 assessment hides in mechanics | FAIL | it's a labeled MCQ, not "tap the side with more" |

**Overall: PRIMITIVE-GAP + SCAFFOLD-GAP** — the interaction gates reading
(text options, two-tap, chrome) AND the scaffold strands the non-reader
(no disambiguate beat, answer leak, literal handlebars). Not a REBUILD: the
group-comparison core is sound; both layers are fixable.

Findings → fix layer:
- Text-only options / two-tap / chrome → COMPONENT (band-gate on gradeBand==='K')
- No ORIENT/DISAMBIGUATE beat → CATALOG `aiDirectives`
- Answer leak (level3) + literal `{{#if}}` → CATALOG scaffold copy

---

## [--fix] Loop log — 2026-07-14 (scaffold P1–P3 + component P1)

| # | Layer | Change | Verify | Result |
|---|---|---|---|---|
| 1 | CATALOG (math.ts) | **P1** ORIENT+DISAMBIGUATE `aiDirectives` beat: at each challenge start read the question aloud and NAME the specific comparison per challenge type; overrides the lesson one-sentence cap; answer-free | tutor-test --probe | directive present in prompt preview ✓ |
| 2 | CATALOG | **P2** `level3` rewritten answer-free (no `{{correctAnswer}}` in a spoken line) | tutor-test --probe | audit `pass`, answer-leak HIGH **gone** ✓ |
| 3 | CATALOG | **P3** flattened `taskDescription` + `level2` — removed all `{{#if}}` handlebars | tutor-test --probe | no `{{#if}}` in preview ✓ |
| 4 | COMPONENT (ComparisonBuilder.tsx) | **P1** at `gradeBand==='K'`: the two group pictures + a middle `=` are the tappable answer surface (tap=choose, picture-primary); text "More/Fewer/The Same" buttons and the Check button hidden; `checkCompareGroups(answerArg)` refactor avoids state-timing race | tsc + typecheck:lumina + eval-test + **jsdom behavioral test** | 0 new tsc errors, lumina gate `0 errors`; content flows, tap mapping matches real `correctAnswer`; **`ComparisonBuilder.reader-fit.test.tsx` 5/5**: no text buttons/Check at K, tap-left(more)/tap-right(less)/tap-`=`(equal) each auto-complete, wrong tap does NOT complete. Full suite 750/750 ✓ |

Verification note: component logic is behaviorally driven (jsdom taps, not just tsc).
Still wanting a human glance: pixel-level look of the tappable SVG boxes/`=`, and a
Tier-3 `run_tutor_live.py --lesson` to green the tutor DISAMBIGUATE beat live.

### Re-audit (compare_groups @ K, after fixes)
- **Audit A:** "More/Fewer/The Same" text options **removed** at K → UNCOVERED options resolved. (`instruction` on screen now enacted by the directive.)
- **Audit B:** DISAMBIGUATE beat present AND **behaviorally CONFIRMED 3/3** — see the
  Tier-3 live run below. level3 answer leak fixed.
- **Audit C:** rules 2 (tap=choose), 3 (pictures = answer surface), 8 (assess-in-mechanics) now **PASS** at K. Still FAIL (deferred, out of this slice's scope): rule 7 chrome (mode tabs/counter/badges/count badges → P2 + K-stage systemic), rule 5 feedback still text-card+beep.

### Tier-3 live behavioral confirmation — 2026-07-14 (`--lesson`, 3 runs)
`run_tutor_live.py --component comparison-builder --lesson --runs 3 --eval-mode
compare_groups --grade kindergarten`. Bespoke `build_comparison_builder_journey`
added to the harness (replays the real `[ACTIVITY_START]`/`[NEXT_ITEM]`; `must_include`
DISAMBIGUATE bar = a comparison word + a side/choice word per challenge type; leak =
the answer word asserted). Also added an `--eval-mode` passthrough to pin the run.
**Verdict: PASS — 0 findings.** In all 3 sessions the tutor read the question and named
the specific choice at both challenge starts (and in the lesson greeting itself,
surviving the one-sentence cap): *"Which side has MORE stars—the left side or the
right side? Tap that side. If they are the same, tap the equals sign in the middle."*
No `stimulus-not-read`, no `answer-leak-live`, 0.0 superlatives/turn. Report:
`qa/tutor-reports/comparison-builder-live-lesson-2026-07-14.md`.

**Verdict after slice: was PRIMITIVE-GAP + SCAFFOLD-GAP → scaffold layer READY (probe-verified + live --lesson 3/3); component P1 READY (behaviorally verified, jsdom 5/5), pending only a pixel glance.** Remaining: component P2 (chrome band-gate), rule-5 feedback-on-object, other three eval modes (one_more_less 21-cell load, compare_numbers, order).
