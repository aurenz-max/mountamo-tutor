# Reader Fit: deep-dive @ PRE — 2026-07-14

Modes audited: explore (the K-routable tier) | Probes: eval-test ✓ (3 K draws + 1 G4 regression draw) tutor-test --probe ✓ | live --lesson ✗ (queued follow-up)

Trigger: user-observed K lesson (goats) — Quick Quiz block rendered a full-sentence
question + 4 text-only options + Check button to a pre-reader; prose section's only
read-aloud affordance was a text-labeled button.

## Audit A — text census (pre-fix)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| Quiz question ("Which of these animals gives us eggs?") | MultipleChoiceBlock | Load-bearing | none | UNCOVERED |
| 4 option labels ("Cow" … "Make a loud moo sound") | MultipleChoiceBlock | Load-bearing | none | UNCOVERED |
| "Check Answer" / "Ask the tutor" buttons | MultipleChoiceBlock | Load-bearing (protocol) | none | UNCOVERED |
| Explanation feedback card | MultipleChoiceBlock | Load-bearing (correction) | none | UNCOVERED |
| Prose paragraphs (3 × ~300 chars) | ProseBlock | Supportive→load-bearing | manual, behind TEXT-labeled button | UNCOVERED |
| Key-facts text + flip headlines + "Tap to reveal" | KeyFactsBlock | Supportive | [FACT_EXPLORE] on tap (paraphrase only, not read) | PARTIAL |
| "6 sections · 1 question", layout badge, attempts count, "Answer the question above to continue..." | DeepDive chrome | Decorative/protocol | — | rule-7 chrome |

## Audit B — sufficiency contract (pre-fix, explore mode)

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore | PARTIAL ([DEEP_DIVE_START] exists, not band-aware) | FAIL (question/choices/prose never spoken; no catalog aiDirectives beat → lesson-cap droppable) | FAIL (nothing enacts the question) | PARTIAL (spoken on answer, explanation never voiced) | FAIL (scaffolds say "re-read it carefully") |

## Audit C — band contract (pre-fix)

| Rule | Verdict | Offender |
|---|---|---|
| 1 audio instruction channel | FAIL | quiz + prose text gate progress |
| 2 tap = choose | FAIL | select-then-Check two-step |
| 3 pictures answer surface | FAIL | text-only options |
| 4 one thing per screen | PARTIAL | 5-6 blocks in one scroll (K-stage systemic; reveal_progressive helps) |
| 5 feedback on touched object | PASS | option state + sound |
| 6 no typing | PASS | (fill-in-blank was K-routable though — word-bank reading) |
| 7 no adult chrome | FAIL | section/question counts, attempts counter, protocol text |
| 8 assessment in mechanics | PARTIAL | quiz-shaped but explore-tier appropriate |

**Overall: PRIMITIVE-GAP + SCAFFOLD-GAP** — interaction core (tap-to-explore + embedded MCQ) is sound; band-gating + read-aloud beats fix it. Not REBUILD.

Findings → fix layer: STIMULUS/RECOVER → CATALOG aiDirectives + component beats;
tap=choose/pictures/chrome → COMPONENT band-gate; text-gated block palette +
option pictures + text load → GENERATOR.

## Fix loop (--fix)

| # | Change | Layer | Verification |
|---|---|---|---|
| 1 | PRE-READER READ-ALOUD aiDirective: [QUIZ_READ_ALOUD]/[BLOCK_READ_ALOUD] read word-for-word, overrides the lesson one-sentence cap; [FACT_EXPLORE] reads card text first at PRE; [QUIZ_RETRY] = answer-free spoken hint | CATALOG core.ts | tutor-test --probe: directive renders in prompt preview, 0 findings |
| 2 | Orchestrator PRE palette (prompt) + code-owned palette gate stripping fill-in-blank/data-table/timeline/compare-contrast/perspectives/hypothesis-lab at K; MC schema + prompt: option0-3Emoji required at PRE, ≤12-word question, 1-4-word options (all-or-nothing emoji ship); key-facts one-short-sentence rule; prose exactly 2 short spoken-style paragraphs | GENERATOR gemini-deep-dive.ts | eval-test K ×3: palette clean every draw; bees draw = facts 8-10w, prose 2 paras, q 10w, 4/4 distinct emojis. G4 regression draw: unchanged (FIB present, long options, no emojis) |
| 3 | DeepDive: `isPreReaderGrade(data.gradeLevel)` band flag; PRE [DEEP_DIVE_START] (title aloud, "I'll read everything", speaker-button orientation); spoken explanation appended to [ANSWER_CORRECT/INCORRECT] at PRE; section/question-count chrome + reveal-progressive protocol text hidden at PRE | COMPONENT | typecheck:lumina 0 errors |
| 4 | MultipleChoiceBlock PRE mode: auto [QUIZ_READ_ALOUD] once on first view (IntersectionObserver, ref-guarded), 🔊 replay button, picture-primary 2-col options (optionEmojis), tap=choose (no Check), first miss → [QUIZ_RETRY] + incorrect state stays on tapped card, attempts/help-text chrome hidden | COMPONENT | jsdom `MultipleChoiceBlock.test.tsx` 7/7: auto-read once w/ question+choices, replay, tap=choose, retry-then-reveal, no answer key in any spoken line, standard flow regression |
| 5 | ProseBlock PRE: single large "🔊 Read to me" ([BLOCK_READ_ALOUD]); text-labeled discussion button dropped. KeyFactsBlock PRE: tap-hint protocol text hidden, [FACT_EXPLORE] flags pre-reader | COMPONENT | typecheck + K draw renders |
| 6 | **TU-5 closed en route:** all 12 block `onAskTutor` forwards now `sendText(msg, { silent: true })` — required before auto-firing [QUIZ_READ_ALOUD] through that channel | COMPONENT | grep 12/12; typecheck clean |

## Post-fix contract status (PRE)

Rules 1/2/3/7: PASS at component level (quiz auto-reads, tap=choose, pictures,
chrome gated). Rule 4: PARTIAL — multi-block scroll remains; K-stage systemic
item (recorded below). B-contract: ORIENT/STIMULUS/DISAMBIGUATE carried by the
auto quiz read-aloud + catalog directive; RECOVER by [QUIZ_RETRY]; FEEDBACK by
spoken explanation.

**Overall after loop: READY (component + generator + scaffold), pending live confirmation**

## Residuals / follow-ups
- **Live `--lesson` run not yet done** — STIMULUS beats need Tier-3 confirmation
  (`run_tutor_live.py --component deep-dive --lesson --runs 3`; needs a bespoke
  deep-dive journey in the harness). The catalog-directive placement follows the
  proven addition-subtraction-scene/word-sorter pattern, but per doctrine this is
  *should work — needs the live lesson check*.
- Browser glance at the PRE quiz grid + 🔊 buttons (DeepDiveTester, Ctrl+Alt+K).
- diagram (explore) label popups at PRE are text-only descriptions — tap fires no
  read-aloud; acceptable as supportive, but a [BLOCK_READ_ALOUD] on label-tap
  would close it fully.
- Audit-C rule-4 chrome evidence for the K-stage case: even gated, a 5-block
  scroll with header masthead remains adult-shaped; hero title + progress dots
  stay in the child's field.
- mini-sim prediction block is PRE-allowed but its prediction question/options are
  text-only — same treatment as MCQ if it starts appearing in K draws (none in 3
  probe draws).
