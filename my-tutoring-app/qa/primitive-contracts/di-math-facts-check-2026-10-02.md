# di-math-facts --check (2026-10-02)

**Verdict: COMPATIBLE.** Edit: the DI lever pilot (`/add-support-tiers`, user rulings 2026-10-02).

**Contract:** NO-CONTRACT before this run, so it was derived first (`docs/contracts/di-math-facts.md`, 13 requirements).

**Zone touched:** the stage (lever state, practice item), the stimulus render, the `support` scene fact, catalog guidance and description, and the answer_fact mode description. Also the shared `DiTeachingStage`, which 8 other DI packs mount.

| Requirement (other consumers) | Probe | Result |
|---|---|---|
| R1 answer never on stage | DiMathFacts.teaching | pass |
| R2 word = numeral | DiMathFacts.teaching | pass |
| R3 name_numeral inverted | DiMathFacts.teaching | pass |
| R4 teen/decade, to 120 | diSpokenMisses, teaching | pass |
| R5 tier structure | gemini-di-math-facts.* (scope, structural, name-numeral, remediation) | pass |
| R6 guidance ≤ 2000 | activityContract, teaching | pass after trim (2267 → under 2000) |
| R7 probe = packet | teaching (updated: + `onScreen`); probe script updated to match | pass |
| R13 other DI packs unchanged | all `direct-instruction` workspace and teaching tests | pass |

Suites: direct-instruction, live-activity, manifest, service/direct-instruction: 87 files, 2766 tests pass. `typecheck:lumina` 0; full tsc 771 (baseline 771/773).

**Expectation changes, each a consequence of the ruling and not a regression:**
- `pull_lever` is now offered on four modes (name_numeral: its only lever starts on screen at easy).
- "I'm stuck" before a try now pulls the next help lever. The 09-27 ladder makes the item assisted.
- The packet carries an `onScreen` fact for the easy model card.
