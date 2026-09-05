# Reader Fit: fast-fact @ PRE — 2026-09-05

Modes audited: recognize, recall (the K modes in packages; apply is context/cloze and out of K scope) | Probes: eval-test ✓ @ `grade=K` on three topics × before/after the fix (counting objects, naming basic shapes, colours of everyday objects) · tutor-test --probe ✓ (1 pre-existing WARN: level2 narrates the UI) · K package `…pgr5` hands it `recognize` with emoji visuals + numeral options (human label: keep) · live: not run

## Audit A — text census (before the fix)
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Ready to practice? · 10 challenges · Math · Take your time and do your best!" + **Start** | start gate | Load-bearing protocol (nothing else on screen) | `[ACTIVITY_START]` fires on connect but nothing says "tap Start" | ACCEPTABLE by position (one primary button); FAIL rule 7 (start-gate paragraph) |
| "How many stars do you see?" / "What shape is this?" | prompt (3xl) | Load-bearing question | `[ACTIVITY_START]` + `[NEXT_ITEM]` carry `prompt.text` — "Introduce briefly", no directive to SAY it | WEAK → fixed (directives now say the question word for word) |
| "Count the items carefully" | subtext | Supportive | — | n/a |
| Emoji visual ⭐⭐⭐ | stimulus | Picture | — | n/a |
| Options — counting: "3" / "2" / "4" | LuminaAnswerChoice | Numerals | — | COVERED |
| Options — shapes: "Circle" / "Square" / "Triangle"; colours: "Yellow" / "Blue" / "Red" | LuminaAnswerChoice | **Load-bearing, text-only answer surface, never read aloud** | none | **UNCOVERED** — 19/19 non-counting K challenges before the fix |
| "Next Challenge", streak "3 in a row!", "1 / 10", accuracy %, phase badge, subject/grade badges | chrome | Decorative | — | rule 7 |
| Feedback line + correct-option highlight | after tap | Supportive; spoken `[ANSWER_*]`; option turns green/red | spoken + object | COVERED |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| recognize | ✓ (after the directive) | ✓ picture / spoken question | ✓ the question | ✓ option colours + spoken | ✓ hint on `[ANSWER_INCORRECT]` |
| recall | ✓ | ✓ spoken question | ✓ | ✓ | ✓ |

## Audit C — band contract
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is the instruction channel | PASS after the directive | |
| 2 tap = choose | PASS | single tap commits |
| 3 pictures are the answer surface | **FAIL → fixed** | word options on every non-counting K topic |
| 4 ≤5 elements | PASS | 3–4 options |
| 5 feedback on the touched object | PASS | option state + spoken |
| 6 no typing | PASS | |
| 7 no adult chrome | FAIL | start-gate paragraph, streak/accuracy/counter, badges — queued (19b) |
| 8 assessment in the mechanics | PASS | |

**Overall (after the fix): READY on the reading axis for recognize / recall; PRIMITIVE-GAP on chrome (rule 7).**

**Reader field derivation → `reader: 'none'`** — true by construction now: below Grade 1 the generator is bound to numeral / single-letter / single-emoji options, the tutor says the question, and the component renders glyph-only options as large picture buttons.

## Loop log
| iteration | change | check | re-audit |
|---|---|---|---|
| 1 | Tier 3 generator: `gemini-fast-fact.ts` adds a PRE-READER ANSWER SURFACE section for Toddler/Preschool/Kindergarten (options = numeral, single letter, or ONE emoji; name-it → find-it, e.g. "Which one is a circle?" 🔵/⬛/🔺; sight-word exception). Tier 1 catalog: ACTIVITY INTRODUCTION says the first question; NEXT CHALLENGE TRANSITION says "{{promptText}}" out loud. Tier 2 component: `renderChoiceButtons` renders glyph-only option sets at `h-20 text-4xl` | eval-test @ K after: shapes 0/10 word options (was 9/9), colours 0/10 (was 9/9), counting 0/10 (numerals, unchanged); every emoji option distinct, answer present, no stem leak; tutor-test: `promptText` resolves from the component, directive renders; `gemini-fast-fact.answer-leak.test.ts` passes; `typecheck:lumina` 0, full tsc 802 = baseline | Audit A: options COVERED (pictures); Audit C rule 3 PASS |

Not browser-driven: the large picture-button render is a className change; needs a glance in the tester at K (queued with 19b).
