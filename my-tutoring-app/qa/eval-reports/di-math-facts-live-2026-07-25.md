# di-math-facts — live mic sitting (2026-07-25)

**User run, `direct-instruction-tester → Math Facts`, topic "subtraction within 5",
mode Take-Away Fact (`subtraction_fact`). Verdict: PASS — "worked great!"**

Session: 5/5 affirmed, all green in the recap — `4 - 3 = 1`, `5 - 0 = 5`,
`5 - 1 = 4`, `4 - 1 = 3`, `4 - 2 = 2` — closing on "Great work today!".

## What this sitting CLOSES

1. **The L0 live gate (HUMAN-CHECKS #48).** The judged loop ran end-to-end on the
   third DI pack: cue → model/guide/test → open mic → in-band audio judgment →
   affirm → advance → recap. No desync, no stall, no phantom verdicts reported.
2. **The reworked reward beat (same-day fix).** The overload the user caught
   hours earlier is gone: one fact on screen at a time, the equation completing
   in place before the next problem appears. The pacing — edge-driven off the
   tutor's audio fall, 900ms floor / 3s cap — was not flagged as dragging or
   clipping. jsdom proved the invariant (6/6); this run proves the feel.
3. **The L2 tutoring scaffold, live.** This is the first session run against the
   catalog-resolved `tutoring:` block (moved from `diMathFactsScript.ts` the same
   day). The tutor stayed on the scripted lines through 5 items — the 4 new
   `commonStruggles` did not loosen it into chattiness, which was the named risk
   of adding them.
4. **`subtraction_fact` cue wording, live (part of #49b).** The L1 mode's spoken
   lines had only ever been generated, never heard. They read correctly at K
   pace, and the code-built `solvedDisplay` for subtraction is right in the recap
   (`4 - 3 = 1`, not a mis-shaped `4 - 3 = ? = 1`).

## What this sitting does NOT close — an all-correct run again

Third consecutive all-correct DI math sitting (#46 bench 3/3, 07-24 run 5/5, this
run 5/5). The stresses that need a WRONG answer remain undriven:

| Residual | Why it still matters |
|---|---|
| **Correction branch** — "My turn: three minus two is one. Your turn…" | Never heard live across any sitting. The sentinel decision's live half: does "My turn" read acceptably as an *arithmetic* correction opener? Also unverified: the 2-correction cap → move-on. |
| **Homophone / over-affirmation** — "won"/one, "too"/two, "for"/four, "ate"/eight, plus a WRONG number that rhymes | The L2 scaffold's new NUMBER WORDS clause is written for exactly this and has never been exercised. Widening for target homophones could in principle soften wrong-number strictness — untested. |
| **MATHEMATICS attribution on submit** | The recap fired, so `[DI eval]` submitted — but whether the data loop attributed to the OPS001 family (not Language Arts) is not visible from the screen. This is the runtime check of the `subject_for_primitive` override. Needs a backend log / Firestore glance. |
| **`counting_next` + `fact_review` cue wording** (#49a, #49c) | Two of the three new L1 modes still unheard. |
| Resync + no-verdict-timeout watch-items | Unit-covered, still never observed live. |

Tracked as HUMAN-CHECKS **#50** (was the residual half of #48) and the surviving
parts of **#49**.
