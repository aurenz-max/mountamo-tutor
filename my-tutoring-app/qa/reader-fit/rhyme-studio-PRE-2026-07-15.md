# Reader Fit: rhyme-studio @ PRE — 2026-07-15

Modes audited: **recognition, identification** (the two K census routes; production =
Tier 4 β 5.0, floored to Grade 1+) | Probes: eval-test ✓ · tutor-test --probe ✓ ·
live --lesson ✓ (recognition 3/3, identification 3/3)

Census: routed 2× in the K rhyme lesson (recognition + identification drawn together).
Cross-check: poetry-lab serves `rhyme_hunt` at K and phoneme-explorer was routed AWAY
from rhyme toward rhyme-studio/poetry-lab — rhyme-studio is a legitimate, non-duplicating
K rhyme surface (`project_poetry-lab-rf-fix-rhyme-hunt`). Grade-fidelity `clampGradeToK2`
pin (`7cb5e5f`) left intact.

## Audit A — text census (PRE)
| String (abridged) | Where | Class | Spoken twin (pre-fix) | Verdict (pre-fix) |
|---|---|---|---|---|
| targetWord / comparisonWord / option words (big text tile, amber rhyme suffix) | component | load-bearing | component `[ACTIVITY_START]`/`[PRONOUNCE_WORDS]` sendText only — **droppable at the lesson one-sentence cap** | UNCOVERED (lesson-fragile) |
| `targetWordImage` / option `image` ("a cute orange cat") | generator→component | supportive picture, but rendered as **prose text** — no actual picture | none | FAIL (no picture surface) |
| "Do these words rhyme?" / "Which word rhymes with X?" | component | load-bearing question | sendText only (droppable) | UNCOVERED (lesson-fragile) |
| "Yes!" / "No" buttons | component | load-bearing answer surface | none | FAIL (text-primary) |
| Feedback card ("Yes! cat and hat both end in -at") | component | load-bearing feedback | ring + SFX + spoken (present) but **text card also shown** | rule-5 partial |
| Title, "Grade K" badge, mode badge, "1/N" counter, "N correct", progress bar, start paragraph | component | decorative chrome | — | rule-7 FAIL |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| recognition (pre-fix) | fragile (sendText only) | fragile | fragile | partial (object + spoken ✓, text card too) | ✓ (commonStruggles eyes-free; scaffoldingLevels stack Qs — WARN) |
| identification (pre-fix) | fragile | fragile (option words not even in the tutor bag) | fragile | partial | ✓ |
| **post-fix (both)** | **✓ durable** | **✓ durable** | **✓ durable** | **✓ object+spoken** | ✓ |

## Audit C — band contract
| Rule | PASS/FAIL (post-fix) | Offender / fix |
|---|---|---|
| 1 Audio is the instruction channel | PASS | catalog PRE-READER READ-ALOUD directive voices words + question, survives the cap |
| 2 Tap = choose | PASS (already) | single tap fires; no Check button anywhere |
| 3 Pictures are the answer surface | PASS | emoji-primary target/comparison/options; word = small caption |
| 4 ≤ ~5 elements | PASS | recognition 2 buttons; identification 2 options |
| 5 Feedback on the object | PASS | text feedback card hidden at PRE; ring + SFX + spoken carry it |
| 6 No typing / notation | PASS | word-bank/tap only; amber suffix hidden at PRE |
| 7 No adult chrome | PASS | title/badges/counter/ledger/progress/start-paragraph hidden at PRE |
| 8 Assessment in mechanics | N/A | legitimate rhyme-discrimination quiz shape |

**Overall: PRIMITIVE-GAP + SCAFFOLD-GAP → READY @ PRE for recognition + identification**
(production floored to Grade 1+ — WRONG-BAND at PRE: its word-bank distractors are
hard-coded and cannot be pictured; Tier 4 keeps it off the K route).

Findings → fix layer:
- **CATALOG (SCAFFOLD-GAP):** new PRE-READER READ-ALOUD `aiDirective` — on `[ACTIVITY_START]`/
  `[PHASE_TRANSITION]`/primitive switch at Grade K, SAY both words (recognition) or target +
  every option (identification) and ASK the rhyme question, answer-free, **overriding the
  lesson one-sentence cap**; added `comparisonWord` + `optionWords` to `contextKeys`;
  description/constraints note production = Grade 1+ (K routes = recognition/identification).
- **COMPONENT (PRIMITIVE-GAP):** `isPreReaderGrade` band-gate — emoji-primary word cards
  (word → small caption), recognition answers become a big 👍/👎 icon, identification option
  tiles emoji-primary, load-bearing question sentences hidden (tutor voices them), text
  feedback card hidden, all chrome hidden (header/grade/mode badges, counter, score ledger,
  progress bar, start-gate paragraph), Next/Finish → wordless ▶/🎉. Forwarded `comparisonWord`
  + `optionWords` into `aiPrimitiveData`. tap=choose already held (kept).
- **GENERATOR (PRIMITIVE-GAP, reliability):** the picture surface. flash-lite **silently drops
  the nested `options` array when asked to also emit emojis** (confirmed: grade-1 identification
  with no emoji ask generates options; K with an emoji ask returned 9 empty-option fallbacks).
  Fix: DON'T ask the model for emojis — constrain K word choice to a curated picturable menu
  (`K_RHYME_FAMILIES`, injected into the prompt, ≥3 members/family) and attach the depicting
  emoji **deterministically in post-process** (`kEmojiFor`; ⭐ only if a word slips the menu).
  Also band-floor production out of the K mix. Result: 9/9 identification challenges carry
  distinct real emojis, 0 rhyme-logic errors, 0 fallbacks.

## --fix loop log
| iter | change | check | result |
|---|---|---|---|
| 1 | catalog PRE directive + contextKeys + production note | tutor-test --probe: comparisonWord/optionWords resolve `by component`; status warn (pre-existing stacked-Q only) | keys resolve ✓ |
| 2 | generator: emoji schema fields + emoji-in-options prompt | eval-test K identification → **9/9 empty-option fallbacks** (regression) | FAIL — flash-lite drops nested options under emoji ask |
| 3 | rework: curated K word menu + deterministic emoji attach; remove all emoji asks; production floor | eval-test K: recognition pig🐷/wig💇 (rhyme ✓); identification pig🐷→wig💇/hat🎩; 9/9 real emojis, 0 fallback, 0 rhyme-logic errors | PASS |
| 4 | component band-gate + jsdom test | tsc 808/808 (0 new); typecheck:lumina 0; jsdom **6/6** | PASS |
| 5 | live --lesson --runs 3 (recognition + identification) | tutor voices both words / target+options + "do these rhyme?"/"which rhymes?" every run, surviving the one-sentence cap | **recognition 3/3 PASS · identification 3/3 PASS**, 0 findings |

Live reports: `qa/tutor-reports/rhyme-studio-live-lesson-2026-07-15.md` (recognition),
`qa/tutor-reports/rhyme-studio-live-lesson-identification-2026-07-15.md` (identification).
Bespoke `build_rhyme_studio_journey` added to `run_tutor_live.py` `JOURNEYS`.

## Residuals
- **Pixel/visual** (emoji cards, 👍/👎 buttons, ▶ Start/Next look at K) → HUMAN-CHECKS.
- **Audit-C chrome for K-stage systemic:** `PhaseSummaryPanel` % ledger on completion;
  "Next Challenge"/"Finish" wordless-glyph is done here but the summary panel remains adult.
- **Scaffold polish (pre-existing, non-blocking):** `scaffoldingLevels.level1/level2` stack 3
  questions in one line (tutor-test WARN) — a per-mode split is a scaffold-copy task, not a
  reader-fit blocker (the new PRE directive does not stack).
- **production @ K:** floored (Grade 1+). A future picture-able production-at-K rebuild
  (emoji word-bank incl. distractors) is a primitive-expansion slice, not done here.
- **EMERGING (grade 1):** re-audit once the K queue drains (re-run the census at grade 1).
