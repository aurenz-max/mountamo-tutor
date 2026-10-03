# di-dice-roll --check (2026-10-03)

**Verdict: COMPATIBLE.** Edit: DI levers, family 2 (`/add-support-tiers`).

**Contract:** NO-CONTRACT before this run, so it was derived first (`docs/contracts/di-dice-roll.md`, 12 requirements).

**Zone touched:** the dice stage (rolled dice move out of the roll button, tappable pips, model card, bracket), catalog guidance, and the shared `DiTeachingStage` readiness (now a set of prepared items).

| Requirement | Probe | Result |
|---|---|---|
| R1 roll first | DiDiceRoll.workspace | pass (image count now excludes the model card's dice) |
| R2 no face in packet | DiDiceRoll.workspace | **failed first**: the model 6 + 3 beside a 3 + 4 named "three". Fixed by the no-shared-face rule; pass |
| R3, R4, R7 | DiDiceRoll.workspace | pass |
| R5 tier shapes | gemini-di-dice-roll tests | pass |
| R6 roll feel | DiDiceRoll.workspace | pass (the rolled dice are a group, not a disabled button) |
| di-math-facts R13 (other DI packs) | all `direct-instruction` tests | pass |

Suites: 89 files. All pass except 2 journey-sweep rows for addition-fact-strategies, a primitive another session is creating (untracked files, J9 on its own levers); outside this zone. `typecheck:lumina` 0; full tsc 772 (baseline 773; the one new error is outside this slice).
