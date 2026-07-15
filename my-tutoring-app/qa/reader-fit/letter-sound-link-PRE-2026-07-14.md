# Reader Fit: letter-sound-link @ PRE — 2026-07-14

Modes audited: see_hear, hear_see, keyword_match | Probes: eval-test ✓ (all 3 modes, K, 6/6 challenges, binary confusable distractors, no phoneme text) · tutor-test --probe ✓ (pass, 0 findings, all keys component-resolved)

Backlog item #6. Band = PRE (catalog: "ESSENTIAL for kindergarten"). This primitive has the
**strongest audio channel of the literacy set** — a dedicated clean-phoneme `aiDirective`,
`[PRONOUNCE_SOUND]`/`[SAY_KEYWORD]`/`[TAP_OPTION]` moments, auto-play in hear-see, and a
judge-backed spoken-keyword production beat. The gap is not audio; it's that the **interaction
protocol is communicated only in text**.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Which sound does this letter make?" / "Tap to hear the sound, then find the letter!" / "Which word starts with this letter's sound?" | renderSeeHear/HearSee/KeywordMatch task line | Load-bearing (the task) | `[ACTIVITY_START]`/`[NEXT_CHALLENGE]` say letter+sound — but component sendText, droppable under lesson one-sentence cap; never states the *task verb* | PARTIAL |
| "tap to hear" / "tap to choose" (10px) + "Tap each speaker to hear the sound, then tap your answer again to choose it" | see-hear/keyword-match micro-labels + footer | **Load-bearing PROTOCOL** (the two-tap) | **none** — tutor never explains audition-then-commit | **UNCOVERED** |
| "Your turn — say '{keyword}'!" + mic idle labels | production beat (isLocked) | **Load-bearing** (invites production) | **none** — `[ANSWER_CORRECT]` celebrates but never invites the child to speak | **UNCOVERED** |
| Big letter "S", emoji option bubbles | stimulus / answer surface | Not text (grapheme under test / pictures) | n/a | OK |
| targetSound "/s/" | never rendered (audio-first by design) | — | played | OK |
| Feedback card prose ("Not quite! Listen again…") | LuminaFeedbackCard | Supportive (object animates + earcon + tutor voice carry it) | object scale/color + SoundManager + `[ANSWER_INCORRECT]` | COVERED |
| Group N / mode / "1/6" counter / PhaseSummaryPanel % ledger | chrome | Decorative/adult | — | chrome (rule 7) |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| see_hear | **FAIL** — protocol (audition→tap-again) never voiced; child who taps once & hears a sound doesn't know a 2nd tap commits | PASS — target sound voiced at `[ACTIVITY_START]`/`[NEXT_CHALLENGE]`, options heard on tap | PASS — target sound named answer-free | PASS — bubble scale/color + earcon + tutor | PARTIAL — struggles cover phoneme production, not the "didn't know to tap twice" stall |
| hear_see | PASS-ish — sound auto-plays; but "now tap the letter" not stated | PASS — `[PRONOUNCE_SOUND]` auto-plays | PASS | PASS | PASS |
| keyword_match | **FAIL** — same two-tap protocol unvoiced | PASS — options (words) heard on tap | PASS | PASS | PARTIAL |

Production beat (all modes): ORIENT **FAIL** — the "say the keyword" invite is text-only; no `sendText` twin.

## Audit C — band contract
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is the instruction channel | **FAIL** | Two-tap protocol + task footer sentences gate progress in 10px text; no spoken twin |
| 2 Tap = choose (multi-part may confirm) | **FAIL (as communicated)** | see-hear/keyword-match audition-then-commit is a *legitimate* multi-part confirm — but it reads as a bare two-tap because it's text-explained, not wordless+spoken. hear-see is already single-tap ✓ |
| 3 Pictures are the answer surface | PASS | keyword-match = emoji; hear-see = letters under test; see-hear = speaker bubbles (audio-primary by design, options identical because the SOUND is the differentiator) |
| 4 One thing / ≤5 elements | PASS | Binary discrimination: 2–3 interactive elements per screen |
| 5 Feedback on the touched object | PASS | Bubble/letter animates (scale+color) + earcon; text card redundant, not load-bearing |
| 6 No typing / no phoneme-notation-only | PASS | No typing; phoneme text never rendered (audio-first) |
| 7 No adult chrome | **FAIL → systemic** | Group badge, mode badge, LuminaChallengeCounter "1/6", PhaseSummaryPanel % ledger in child's field |
| 8 Assessment hides in mechanics | PASS-ish | Audio discrimination + spoken production are instrument-like |

**Overall: PRIMITIVE-GAP + SCAFFOLD-GAP** — a strong audio-discrimination core whose two-tap
audition protocol and production invite are gated behind unreadable text (never spoken). Fix by
**band-gating the communication** (spoken protocol beat + wordless affordance), NOT deleting the
mechanic — auditioning both options before committing is intrinsic to sound discrimination
(rule 2 permits an explicit confirm for multi-part interactions).

Findings → fix layer:
- **SCAFFOLD (catalog aiDirectives):** PRE-READER PROTOCOL beat (voice how to play per mode,
  answer-free, overrides the lesson one-sentence cap — durable ORIENT carrier) + production
  invite ("now YOU say {keyword}"). Closes Audit B ORIENT + Audit A rows 2 & 3.
- **COMPONENT (K band-gate on `gradeLevel==='K'`):** replace the 10px protocol text with a
  wordless affordance (ear glyph → pulsing check "tap to keep"); hide per-primitive chrome
  (Group/mode badges, counter). Keep audition-then-commit. jsdom behavioral test + browser.
- **GENERATOR:** thread `gradeLevel` (from `ctx.gradeContext`) into `LetterSoundLinkData` so the
  component can band-gate (mirrors word-sorter).
- **Chrome (PhaseSummaryPanel ledger, progress bar) → K-stage systemic item** (record, partial
  local fix only).

[--fix] Loop log (single iteration — all four layers, no re-audit failures):
| # | change | verification | result |
|---|---|---|---|
| 1 | **GENERATOR** (`gemini-letter-sound-link.ts`): `resolvePreReaderGradeKey(ctx)` (prefers canonical `ctx.grade`, prose fallback, defaults non-K) → stamps `result.gradeLevel`. `LetterSoundLinkData.gradeLevel?` added. | eval-test @K → `gradeLevel:'K'`; @grade1 → `'1'` (no over-gating) | PASS |
| 2 | **SCAFFOLD** (`catalog/literacy.ts`): two new `aiDirectives` — **HOW TO PLAY** (voice the audition-then-commit protocol per mode at `[ACTIVITY_START]`/`[NEXT_CHALLENGE]`, answer-free, explicitly overrides the lesson one-sentence cap = durable ORIENT carrier) + **THEIR TURN TO SAY IT** (spoken production invite "Now YOU say {{keywordWord}}"). | tutor-test `--probe`: pass, 0 findings, both directives in prompt, `{{targetSound}}`→`/s/` & `{{keywordWord}}`→`sun` resolved, no literal handlebars | PASS |
| 3 | **COMPONENT** (`LetterSoundLink.tsx`, gated on `gradeLevel==='K'`): 10px "tap to hear"/"tap to choose" → wordless **EarGlyph → KeepGlyph** (see-hear + keyword-match); footer + task-question + shared-sound sentences hidden; keyword hint = emoji only; chrome hidden (Group/mode badges, counter); real grade passed to `useLuminaAI` (was hardcoded `'K'`). Audition-then-commit two-tap **kept** (rule 2 multi-part confirm). | jsdom `LetterSoundLink.reader-fit.test.tsx` **4/4** (chrome+protocol hidden @K; two-tap preview→commit→[ANSWER_CORRECT]→Next; both-challenge submit; reader-grade control keeps text). Full suite **781/781**. tsc/typecheck:lumina 0-err. | PASS |

Verdict after loop: **READY** (PRE) — live-confirmed; one cosmetic follow-up below.

Live confirmation (Tier-3, `run_tutor_live.py --component letter-sound-link --lesson --runs 3
--grade kindergarten`): **PASS 3/3, zero findings** (report
`qa/tutor-reports/letter-sound-link-live-lesson-2026-07-14.md`). The HOW-TO-PLAY protocol is
voiced in BOTH the lesson greeting (the `[PRIMITIVE SWITCH]` one-sentence-cap path) and
`[ACTIVITY_START]` all 3 runs — *"Tap a bubble to hear it. When you find the one that makes /s/,
tap it again to keep it!"* — the keyword is said ("as in sun"), and the production invite
*"Now YOU say sun!"* fires on `[ANSWER_CORRECT]` 3/3, with the protocol re-enacted for challenge 2
(apple). The durable aiDirective carrier survives the cap, exactly as on word-sorter/
comparison-builder/cvc-speller. Harness gained a bespoke `build_letter_sound_link_journey`
(registered in `JOURNEYS`) — `must_include` asserts the tap/listen action verb + the keyword per
ORIENT/STIMULUS beat.

Follow-up (cosmetic):
- **Human browser glance** at the wordless ear→check glyphs (render + interaction verified in
  jsdom + live audio behavior confirmed; only the pixel look is unexercised).
- **Chrome → K-stage systemic:** PhaseSummaryPanel % ledger + the progress bar remain in the
  child's field (per-primitive local fix is partial by design; see BACKLOG systemic section).
