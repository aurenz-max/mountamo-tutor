# Reader Fit: knowledge-check @ PRE — 2026-07-14

Modes audited: recall, apply (the K-routed tiers) | Probes: eval-test ✓ (5 K draws) · tutor-test --probe ✓

knowledge-check is the K CENSUS TOP FINDING (backlog 1d): it closes EVERY K
lesson the manifest builds, and every draw is text-primary. It is a *container*
that renders per-type problem primitives (multiple_choice, true_false,
fill_in_blanks, matching_activity, sequencing_activity, categorization_activity).
Every K draw across the census resolved to `multiple_choice` (occasionally
`true_false`) — those two are the real K route; the rest are text/two-column/
typing shapes that are WRONG-BAND at PRE.

## Audit A — text census (5 K draws)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Which of these words rhymes with 'cat'?" + options **hat / dog / cup** | MCQ (rhyme) | Load-bearing | question read at [PROBLEM_SHOWN]; **options never read** | **UNCOVERED** — options are text words a non-reader can't decode, AND wrong modality (rhyme is auditory) |
| "How many apples are in the box?" opts 3/4/5 | MCQ (count) | Load-bearing | question read; no visual | **UNCOVERED** — references "the box" but the generator populates **no `visual`**; the apples don't exist |
| "Sam has 2 blue toy cars… Use the math sentence below to help you count." | MCQ (add) | Load-bearing | question read | **UNCOVERED** — long sentence above K decode; references a "math sentence below" that is never generated |
| "Look at the picture of the shape with 3 straight sides. What shape is this?" opts Circle/Triangle/Square | MCQ (shapes) | Load-bearing | question read | **UNCOVERED** — references a non-existent picture; **answer leaks in the stem** (3 sides→Triangle); options text |
| Terminal header "Knowledge Assessment Terminal", "N PROBLEMS", "Verify Answer", "Need help?", "Scratch Pad" | container/kit chrome | Decorative/adult | none | chrome (Audit C) |

Numbers as options (3/4/5, 2/3/4) are NOT text and are fine. The failures are
(1) **text-word options** on modes where the option carries meaning (rhyme,
shapes) — non-decodable and sometimes answer-leaking; (2) **questions that
reference visuals the generator never produces** ("the box", "the picture", "the
math sentence below") — the stimulus is a text-only reference to nothing; (3)
**no option is ever read aloud** — the [PROBLEM_SHOWN] beat reads only the
question.

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| recall (MCQ/TF) | ⚠ weak — scaffold *narrates* "read the question" (probe: 2× `indirect-script` on level1/level3, 2× on struggles) | ✗ question read but **options never voiced**; no override of lesson one-sentence cap | ✗ no beat names the choice set for a non-reader | ⚠ chime only + text rationale card | ⚠ struggles say "read the question / tell me what the question is asking" — not eyes-free |
| apply (MCQ) | ⚠ same | ✗ same | ✗ same | ⚠ same | ⚠ same |

Probe: `tutor-test --probe` → **warn**. All template vars resolve
(`currentQuestion` etc. from the component bag), so this is a *sufficiency* gap,
not a resolution gap: the scaffold points the child at text instead of voicing
it, and the options are never spoken.

## Audit C — band contract (worst-case MCQ render)

| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is instruction channel | FAIL | on-screen question + options gate progress; only question is voiced |
| 2 Tap = choose | FAIL | two-tap: select option → **"Verify Answer"** button (atomic selection, no reason for a confirm) |
| 3 Pictures are answer surface | FAIL | options are text words; **no emoji/picture field exists** in the MCQ schema |
| 4 One thing per screen, ≤5 elements | PARTIAL | single problem OK, but AI Helper collapsible + Scratch Pad button + Verify crowd the field |
| 5 Feedback on the touched object | FAIL | wrong answer → text rationale card, not a flash/shake on the tapped choice |
| 6 No typing | FAIL (type-gated) | fill_in_blanks / short_answer require a keyboard; matching/sequencing are drag protocols |
| 7 No adult chrome | FAIL | "Knowledge Assessment Terminal", terminal dots, "N PROBLEMS" counter, problem-number badges, "Need help?", "Scratch Pad" |
| 8 Assessment hidden in mechanics | FAIL | quiz-shaped by design |

**Overall: PRIMITIVE-GAP + SCAFFOLD-GAP** — the MCQ/TF interaction core is sound
and already voice-wired, but at PRE it gates progress behind text options, a
two-tap protocol, adult chrome, and a scaffold that references text instead of
voicing it. Complex types (matching/categorization/sequencing/fill_in_blanks)
are **WRONG-BAND at PRE** and must not route to K.

Findings → fix layer:
- **SCAFFOLD-GAP** (ORIENT/STIMULUS/RECOVER) → CATALOG `assessment.ts`: PRE-READER
  READ-ALOUD directive (read question AND every option, override one-sentence
  cap, answer-free); enact-not-narrate scaffolding levels; eyes-free struggles.
- **PRIMITIVE-GAP** (text options, two-tap, chrome, feedback) → COMPONENT
  `MultipleChoiceProblem.tsx` + `KnowledgeCheck.tsx`: picture-primary options,
  tap=choose, auto-read + 🔊 replay, feedback on the touched object, chrome
  band-gated at K.
- **Generator** (option modality + phantom-visual + type floor) → `gemini-knowledge-check.ts`:
  emoji-required picture-primary MCQ at K, ≤12-word questions with no reference
  to un-generated visuals, and a K floor to multiple_choice/true_false only.
- **WRONG-BAND** complex types at PRE → generator K type-floor (routing).

[--fix] Loop log:

| # | Slice | Change | Verification | Result |
|---|---|---|---|---|
| A | CATALOG scaffold (`assessment.ts`) | Added **PRE-READER READ-ALOUD** aiDirective (`[QUIZ_READ_ALOUD]` reads question + every choice aloud, overrides one-sentence cap, answer-free; `[QUIZ_RETRY]` eyes-free hint); rewrote scaffoldingLevels to **enact** the question (say it) not narrate ("read the question"); struggles reworded eyes-free | `tutor-test --probe` | **pass, 0 findings** (was warn, 4× `indirect-script`) |
| B | GENERATOR (`gemini-knowledge-check.ts`) + type | Emoji-required **picture-primary** MCQ options at K (`optionProps.emoji`, required); `PRE_READER_MC_PALETTE` (≤12-word question, no phantom-visual reference, no answer-leak, picturable options); **K type-floor** to multiple_choice/true_false (orchestrated + direct paths, insets stripped); `MultipleChoiceOption.emoji?` added | `eval-test` @ K, 3 topics | rhyme→dog🐶/bat🦇/cup🥤, shapes→🟦🔺🔴 (no more "picture of shape with 3 sides" leak), add→2/3/4 cars🚗; all MCQ, emoji 3/3 |
| C | COMPONENT (`MultipleChoiceProblem.tsx` + `KnowledgeCheck.tsx`) | PRE render: picture-primary emoji grid, **tap=choose** (no Verify), auto-read on first view (IntersectionObserver) + **🔊 replay** (`LuminaReadAloud`), feedback on the tapped object; container threads `preReader`+`onAskTutor` (non-silent sendText), hides terminal header/counter/badges/AI-Helper/Scratch-Pad at K | tsc + lumina gate; jsdom `MultipleChoiceProblem.reader-fit.test.tsx`; full suite | **0 new tsc errors**; **6/6** jsdom; **787/787** suite |
| D | QA oracle (`oracles/knowledge-check.ts`) | `option-modality` check (every MCQ option carries an emoji at PRE); `reader-fit` WRONG-BAND check (non-MCQ/TF type at PRE); 4 new oracle tests | `oracles.test.ts` | **211/211** |
| E | Live harness (`run_tutor_live.py`) | Bespoke `build_knowledge_check_journey` (replays `[QUIZ_READ_ALOUD]`, `must_include` = every option + question content); registered in `JOURNEYS` | `--component knowledge-check --lesson --eval-mode recall --runs 3` | **3/3 PASS, 0 findings** — tutor read "Which one is a circle? A… Square. B… Circle. C… Triangle." in the lesson greeting/switch path all 3 runs (`qa/tutor-reports/knowledge-check-live-lesson-2026-07-14.md`) |

**Overall after fix: READY** at PRE for the K route (picture-primary MCQ + true/false floor).

### Residuals (queued, not blocking READY)
- **true_false @ PRE:** the container now passes `preReader`/`onAskTutor` to TrueFalseProblem, but that component has no PRE branch yet — the statement isn't auto-read via `[QUIZ_READ_ALOUD]` and its ✓/✗ chrome isn't band-gated. It IS already voice-wired and the container's `[PROBLEM_SHOWN]` reads the statement. Give it the MCQ treatment next.
- **MCQ retry button + rationale card** at K are still text (spoken by the tutor's `[ANSWER_*]` beat, so eyes-free in practice) — a wordless retry glyph + suppressing the text card at K is a polish follow-up.
- **Count-type MCQ** ("how many…") relies on the palette reworking the stem to self-contained + count-emoji options — spot-check a few more count draws.
- **Pixel-level browser glance** of the emoji grid (render + behavior verified headlessly; click not exercised in a real browser).
- **EMERGING (grade 1):** complex types (matching/categorization) may still route — re-run at grade 1 once the K queue drains.
