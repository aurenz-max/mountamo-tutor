# Reader Fit: equation-builder @ PRE — 2026-09-05

Scope: short audit to give the `affordances.reader` tag a source. equation-builder is picked
5× at kindergarten in today's Lesson Bench packages and had **no reader-fit verdict anywhere**.
Audited at its LOWEST claimed grade — the catalog says "ESSENTIAL for K-2 equation understanding"
and `constraints: Requires grade band (K-2)`, so K is a promise.

Modes audited: `build-simple`, `true-false` probed live; `missing-result` / `missing-operand` /
`balance-both-sides` / `rewrite` read from the component's answer surfaces.
Probes: `eval-test?componentId=equation-builder&evalMode={build-simple,true-false}&grade=K&gradeLevel=kindergarten&topic=Addition within 5 with objects` → both **pass** (5 challenges each, gradeBand "K", maxNumber 5).
Live: not run — the verdict does not turn on tutor behaviour (there is no PRE directive to exercise).

## Audit A — text census (real K content, verbatim from the probes)
| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Can you use the tiles to make a true equation that **equals 2**?" · "Build a matching equation where **one plus three equals four**." (build-simple, 5/5 challenges) | `instruction`, rendered as prose at `EquationBuilder.tsx:1133` | **LOAD-BEARING** — the target is stated ONLY in this English sentence. The tiles `["1","_","1","3","=","+","2"]` do not say what to build; two of five challenges spell the numbers as WORDS | none — no `isPreReaderGrade` gate, no `LuminaReadAloud`, and the catalog `aiDirectives` are EQUAL-SIGN COACHING + CHALLENGE TYPE COACHING with no read-aloud instruction | **UNCOVERED** |
| "Look at the apples! Does 2 plus 1 equal 3? …" (true-false, 5/5) | instruction prose | Supportive here — `displayEquation` `2 + 1 = 3` carries the question on its own | none | ACCEPTABLE (the equation is the stimulus) — but see note |
| **True** / **False** | answer pills, `:945` `:957` | **LOAD-BEARING, text-only answer surface** | none | **UNCOVERED** |
| **Check** | `LuminaActionButton` after selecting a pill, `:965` | Protocol — select then Check = two taps to commit | none | **FAIL rule 2** |
| `<LuminaInput type="number" inputMode="numeric">` + "? =" | balance / missing-value answer entry, `:1002` | **Typed numeric answer** | — | **FAIL rule 6** |
| Numerals, `+`, `−`, `=` on tiles | stimulus | NOT text at K-1 per the band table | — | n/a |
| title / description / challenge-type badge / grade band | chrome | Adult chrome | none | rule 7 |

Content note (separate from the reading axis): every true-false instruction opens on objects that
are **not on screen** — "Look at the apples!", "Check the stars!", "Count the blocks!", "Inspect
the balloons!" The stage is symbolic tiles only. Logged below, not fixed here.

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| build-simple | partial — `[ACTIVITY_START]` passes `instruction` but says only "Introduce briefly" | ✗ the target is never spoken | ✗ | spoken on `[ANSWER_*]` | scaffolding ladder exists |
| true-false | partial | ✓ the equation is visible | ✗ nothing says the pills are the answer | ✓ spoken | ✓ |
| missing-* / balance / rewrite | partial | ✗ | ✗ | ✓ | ✓ |

The ladder's own level 1 is `"Read the equation out loud. What does each part mean?"` — the
scaffold instructs the child to READ.

## Audit C — band contract (PRE)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is the instruction channel | **FAIL** | the build target exists only as prose; no directive says it aloud |
| 2 tap = choose | **FAIL** | select-then-Check on true-false and every check path |
| 3 pictures are the answer surface | **FAIL** | "True"/"False" words; numeral tiles are acceptable, the word pills are not |
| 4 ≤5 elements | borderline | 7-8 draggable tiles + slots + Check |
| 5 feedback on the touched object | PASS | tile/pill state changes |
| 6 no typing | **FAIL** | numeric input on missing-result, missing-operand, balance |
| 7 no adult chrome | FAIL | grade-band + challenge-type badges, title/description block |
| 8 assessment in the mechanics | PASS | building the equation IS the evidence |

**Overall: WRONG-BAND @ PRE.** Not a bug in the interaction core — the equal-sign manipulative is
sound and the tile mechanic is genuinely good at Grades 1-2. It cannot serve a pre-reader **as
built**: the only statement of what to do is an English sentence, the true-false answer surface is
two English words, and a third of the ladder is typed.

Per the standing user ruling ([[feedback_make-age-friendly-not-band-floor]]) **no band floor was
added** and the catalog description/constraints were NOT narrowed — removing the primitive from K
shrinks supply at the band with the least content. The demand is recorded as a tag instead, where
the curator and the Bench can both see it.

**Reader field derivation → `reader: 'developing'`** — the affordance table's WRONG-BAND @ PRE
rule: the stated cause is a text-only instruction + answer surface, and the demand is a full
short sentence per challenge with no spoken twin, which is the DEVELOPING band's ceiling. The tag
is the primitive-level maximum across modes; no per-mode `reader` override, because every mode
renders the same prose `instruction`.

## Queued, not fixed here
- **Make equation-builder PRE-fit** (the age-friendly path, not a floor): a PRE-READER READ-ALOUD
  `aiDirective` that says the `instruction` verbatim; an `isPreReaderGrade` render that turns the
  True/False pills into ✅/❌ glyph buttons and commits on tap (drop Check); a K generator rule that
  states the target with a numeral rather than a spelled word; route the typed modes above K.
  → `qa/reader-fit/BACKLOG.md`, executor `/reader-fit equation-builder --fix`.
- **Phantom-object instructions at K** ("Look at the apples!" with no apples on screen) →
  generator fix, `/eval-fix equation-builder`.
