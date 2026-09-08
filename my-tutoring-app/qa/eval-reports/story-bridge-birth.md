# Birth Certificate — story-bridge (2026-09-07)

**Lifecycle layer: L0 (born) + L2 (tutored) — judged-loop strong form at birth.** Pedagogically sound, measurable, single core mode, catalog tutoring block, headless DI drive PASS.

- Core task identity: `match_character` — hear two stories, tap the far-shore character who acted alike (LA006-04-B).
- Generator fork: **B orchestrator** — one flat 29-field Gemini call per story pair (`gemini-flash-lite-latest`); code assembles the story body from per-character evidence sentences, alternates the anchor side, and applies every gate from `storyBridgeScript.ts`. 1 pair (3 challenges) by default; `raw.challengeCount > 3` asks for 2 pairs.
- Spoken surface: `useJudgedScriptRunner`, gesture items (`answerKind: 'gesture'`, `responseClass: 'manipulation'`). Tags `[SB_ITEM]`, `[SB_TAP]`, `[SB_MOVE]`, `[SB_HEAR]`, `[SB_COMPLETE]`; no `sendText` (the runner owns the clock).
- Answer-leak audit: story text audio-only pre-verdict; evidence prints on affirm; one card chrome, anchor ring only, far shore reshuffled per item, anchor shore untappable; gates: title-names-no-character, describing-word names refused, name-free `sharedBehavior`, paired emojis differ. Tutor cue contract: ask names the anchor only; correction never names the partner.
- Design gate (Phase 2): manipulation — **pass**: the child taps the character cards themselves and the bridge draws between shores · simulation — **exception, chosen**: a story-comparison task has no physical system; the only living state is the bridge holding (affirm) vs river (pending) · production — **exception, chosen for L0**: the K standard is matching "using visual aids"; the spoken alike/different statements are the production rungs (ladder rows 1) · timer — **pass**: none; the runner records seconds silently · layout leak — **pass**: see audit.
- Curriculum home: **MATCH K** (0.8154, 4/5 top results in LA006-04 Comparing Texts; LA006-04-B ranks 5th behind single-story A). Grade 1 abstains — no G1 comparing-texts skill published. [Fit report](../curriculum-fit/story-bridge-2026-09-07.md).
- Verification: [eval report](story-bridge-2026-09-07.md) · [headless drive PASS](../tutor-reports/story-bridge-live-di-plain-2026-09-07.md) · script tests 14/14 · DI-script suites 1636/1636 · `typecheck:lumina` 0.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 0 | Human browser/mic sitting | rung-0 debt | Stage shuffle + reveal + hear-again on a tablet with a real tap; the drive proved the loop and the judge's cue compliance only. |
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder from the design variants: `match_setting` (LA006-04-C, gesture, source-labeled setting cards), `say_alike` (LA006-04-D, VOICE, `concept_statement` class — "both were lost"), `say_different` (LA006-04-E, voice), `venn_place` (F, gesture), `sequence_two` (H, gesture), `main_idea_compare` (LA006-03-J). β: match_character ~2.0, match_setting ~2.0, say_alike ~3.0, say_different ~3.5. Register backend `problem_type_registry.py` priors with the ladder. |
| 2 | `/add-tutoring-scaffold` | L2 tutored | **DONE at birth** (required by `/tutor-test` before any headless drive). contextKeys = the pack's `contextFor`: challengeType, anchorName, anchorStory, targetStory, farShore, taskFocus, currentTurn, totalTurns. Struggle seen in generation: the looks-trap (same-kind distractor). |
| 3 | `/add-support-tiers` | L3 tiered | Withdrawable scaffolding intrinsic to the interaction: the anchor ring (high: ring + "This friend…" label; mid: ring only; low: the ask names the anchor and no card is highlighted); the hear-again control's story re-read (high: both stories; low: the ask only); far-shore size 3 → 4. |
| 4 | `/add-structural-difficulty` | L4 shaped | (requires L3) Structural lever: similarity depth — surface behavior ("both shared") → feeling inferred from events ("both felt scared" never stated) → motive ("both wanted to help"); and the looks-trap density (0 → 1 → 2 same-kind distractors). |
| 5 | `/add-sound` | L5 polished | 2–3 points: card tap, bridge lands on affirm, soft river ripple on a wrong tap; nothing continuous under the tutor's voice. |
| 6 | `/add-affordances` | catalog | Missing `affordances` tags (every other literacy entry has them): pictorial representation, answers `['tap']`, reader `none` (all print is spoken), minutes ~5. |
| ✓ | `/eval-test story-bridge` + `/tutor-test story-bridge --di` | QA loop | Re-run after EVERY layer (per-mode drives after L1; tier sweep after L3/L4). |

Try it: `/lumina` → Developer Tools → Language Arts → Reading Literature → Story Bridge → Generate. Example topics: `friends who help`, `animals who help`, `Comparing characters across two stories`.
