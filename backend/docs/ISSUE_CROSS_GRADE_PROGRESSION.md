# Issue: A student who masters their grade has nowhere to go

**Status:** **Production branch SHIPPED 2026-07-09** (runtime-verified); **auto-promotion ON by default as of 2026-07-09** (`AUTO_GRADE_PROMOTION` default flipped to `True`) — a student who masters their grade advances automatically. Parent-approval remains an optional gate (flip the flag off) but is not required.
**Discovered:** 2026-07-09, via `/pulse-agent gifted --loop --days 30` (MATHEMATICS_GK)
**Area:** Planning / selection / curriculum-graph scoping
**Severity:** High for the top of the ability distribution (the exact students meant to showcase adaptive learning)

---

## Summary

The adaptive engine is confined to **one grade's graph per subject**. When a student
masters everything reachable in their grade (e.g. all Kindergarten Math), the planner
returns an empty teaching plan — only retention pulses — and the student stays there
**until a human manually edits `grade_level`**. There is no mechanism to advance a
student across a grade boundary on mastery.

This is most visible exactly where the product thesis is strongest: a gifted, fast-moving
student dead-ends at the grade wall instead of continuing to climb.

## How it surfaced

A 30-day loop journey for the `gifted` profile (Gifted Grace) on `MATHEMATICS_GK`:

- Days 1–20: steep climb, 9 → **124 subskills mastered** (~100% of the ~138 reachable
  graph nodes; 75% of the 166-subskill published hierarchy).
- **Days 21–30: terminal-empty.** `plan=0 subskills`, `did 0 lesson + 6 pulse items`.
  Nothing left to teach; only the daily pulse kept running.

The terminal-empty tail is not a harness artifact — it faithfully reproduces what the
production engine does when a grade's frontier is exhausted.

## Root cause — grade is a hard, student-pinned silo

1. **Graph key is built from the student's stored grade.**
   The planning graph is keyed `MATHEMATICS_GK`, formed by suffixing the bare subject
   with the student's `grade_level`.
   - `planning_service.py:962` — `student_grade = planning.get("grade_level")`
   - `learning_paths.py:1062-1066` — `graph_subject_id = f"{subject_id}{suffix}"` (`"K" → "_GK"`)
   - `firestore_service.py:936-962` — `grade_to_subject_suffix()`

2. **Graphs are grade-partitioned in Firestore; cross-grade edges are structurally impossible.**
   Nodes and edges each load from exactly one grade doc.
   - `firestore_service.py:1010-1019` — nodes from `curriculum_published/{grade}/subjects/{subject_id}`
   - `firestore_service.py:1063-1073` — edges from `curriculum_graphs/{grade}/subjects/{subject_id}/edges/`
   - `firestore_service.py:1143-1160` — `get_curriculum_graph()` resolves one grade, loads nodes+edges from it only.

   Even if an edge named a node in another grade, that target isn't in the loaded node
   set, so `_determine_unlocked_nodes` (`learning_paths.py:1270-1309`) could never
   unlock it. No GK→G1 prerequisite/unlock edge can exist or take effect.

3. **Empty frontier ⇒ empty plan, no higher-grade fallback.**
   - `planning_service.py:1017-1020` — a subject with `remaining_subskills == 0` is skipped.
   - `firestore_analytics.py:1860-1871` — the selector only picks nodes whose status is
     `frontier / in_progress / in_review`; all-mastered ⇒ zero eligible objectives.
   - `planning_service.py:1089-1100` — with no candidates, returns a plan with
     `warnings=["No skills due or available for today."]` and no lesson blocks.
   - There is **no branch** that, on an empty frontier, reaches for the next grade's graph.

4. **`grade_level` only changes manually.**
   Written in just two paths — the profile-edit endpoint (`user_profiles.py:89`) and the
   CLI `scripts/set_student_grade.py:41`. Nothing auto-advances on mastery.

## Impact

- **Gifted / accelerating students stall** at the grade boundary — the worst place for the
  adaptive story to break.
- **Silent, not loud:** the student still gets a (retention-only) daily pulse, so nothing
  errors. It reads as "done for now," not "blocked."
- **Manual intervention required** to unblock every advancing student, which does not scale.

## Options

| Option | What it does | Effort | Notes |
|---|---|---|---|
| **Auto-promote** | On empty-frontier-for-subject, bump grade (ideally a **per-subject** grade) and reload the next graph | Small | One new branch + a per-subject grade field; graphs already exist per grade |
| **Cross-grade bridge edges** | Publish GK-terminal → G1-entry edges so the frontier flows continuously | Medium | Curriculum/graph work; must go through draft-first → lineage-check → publish |
| **Per-subject grade decoupling** | A student can be G1 in Math but GK in Reading — grade becomes per-subject | Larger | Touches the student-scope model everywhere `grade_level` is read |

## Recommended next step (evidence before production)

Prototype **auto-promote inside the pulse-agent loop first**: when the GK frontier
exhausts, reload `MATHEMATICS_G1` and let the gifted profile keep climbing across the
boundary in a 40-day run. The loop already loads graphs by key, so this proves the
behavior at runtime without touching production scope logic — matching the
"mock the surface as an artifact first" doctrine.

## Prototype: DONE and runtime-validated (2026-07-09)

`/pulse-agent gifted --loop --days 40 --promote` implements harness-side auto-promote:
when a day surfaces **no new work at all** (no `new` plan items, no selector targets)
while mastery exists, the loop bumps `grade_level` to the next grade, lazily fetches
that grade's graph + published curriculum into the in-memory store (one Firestore read
per promotion, same doctrine as `--seed-from`), invalidates the planner/curriculum/graph
caches, and keeps walking. Changes: `run_scenarios.py` (`--promote` + lazy grade
loader), `full_loop.py` (`_promote_grade`, `promotion_continuity` assertion, Grade
Promotions report section), `in_memory_firestore.py` (multiple grade docs per subject,
grade-scoped `get_published_curriculum` — production already stores one doc per
(grade, subject)).

**40-day gifted run (seed 42): the wall is gone.**

- Day 19: GK frontier exhausted at 124 mastered → **promoted K → 1**; day 20 planned
  8 G1 subskills, 6 leapfrogs, gate advances immediately.
- Day 30: G1 exhausted at 195 → **promoted 1 → 2**; climb continued on `MATHEMATICS_G2`.
- Final: **256 subskills mastered across three grade graphs** (vs 124 + a 10-day
  dead-end tail before). All 9 loop assertions PASS, including L2 replay parity
  (780 attempts, MATCH) and the new `promotion_continuity` (+132 mastered after K→1,
  +61 after 1→2). Report: `backend/reports/GK/loop_report_Gifted_Grace_MATHEMATICS_GK.md`.

**Bycatch fixed:** reaching G1/G2 exposed a real pulse bug — densified primitives carry
7+ eval modes, and `select_best_mode()` leaked the β-sorted ladder *index* into
`PulseItemSpec.target_mode`, which is the 1-6 scaffolding *tier* (`le=6`), killing the
whole pulse session with a Pydantic error (9 of 40 days silently pulse-less). Fixed in
`pulse_engine.select_best_mode`: tier label clamps to 6, β/eval_mode_name stay exact.

## Production branch: SHIPPED 2026-07-09 (flag-gated)

The planner now owns cross-grade progression, per-subject:

- **Per-subject grade overrides** — `students/{id}.subject_grade_overrides`
  (`{"MATHEMATICS": "1"}`, keyed by `rollup_subject_key`) let one subject plan ahead
  of the grade of record. `PlanningService._subject_grade` resolves the effective
  grade everywhere the planner passes `grade=` down (pace allocation + selector).
  `grade_level` itself is never auto-written.
- **Detection** — in `_allocate_subject_minutes` (the one place remaining work is
  computed): a frontier is exhausted when the graph has mastery but **zero
  `frontier`/`in_progress` subskills** left. NOT `done == total` — real graphs carry
  permanently-locked orphan nodes (ghost edges), so "everything mastered" never
  literally happens. `in_review` doesn't block promotion (retention flows through
  retests regardless of grade).
- **Never silent** — exhaustion always writes
  `students/{id}.promotion_ready[SUBJECT] = {from_grade, to_grade,
  mastered_subskills, detected_at}` (idempotent per from→to pair) and appends a plan
  warning ("ready to advance to grade 1 (awaiting approval)").
- **Auto-apply behind `AUTO_GRADE_PROMOTION`** (settings, **default ON** as of
  2026-07-09) — verifies the next grade's graph exists, writes the override,
  marks the ready-record `applied: true`, and re-reads pace so **the same plan
  that detects exhaustion already serves next-grade work** — zero dead days.
  Set the flag off to hold advancement behind an approval step instead.
- **Grade wall** — promotion past the highest published grade records
  promotion-ready but applies nothing; the subject stays retention-only with an
  explicit warning.

**Runtime verification** (`/pulse-agent gifted --loop --days 40 --promote-engine`
— the harness makes NO decisions; it only mirrors `subject_grade_overrides` written
by the production planner):

- Day 16: `[PROMOTION] MATHEMATICS grade K frontier exhausted (111 mastered) — ready
  for grade 1` → auto-promoted K → 1 **in the same plan build** (24 lesson items that
  day, no empty day at all — earlier and cleaner than the harness prototype's day-19
  trigger, because teachable==0 fires before the last stragglers finish).
- Day 24: promoted 1 → 2 the same way. Day ~31: grade-2 frontier exhausted, **no
  MATHEMATICS_G3 graph loaded → correct wall** (ready-record written, retention only).
- Final: 239 mastered, 9/9 loop assertions PASS incl. L2 replay parity (735 attempts)
  and `promotion_continuity` (+128 after K→1, +172 after 1→2).
- Flag-off control run (default config): `promotion_ready` recorded once + plan
  warning, **zero promotions**, all assertions pass — the dead-end is unchanged but
  now observable.

## Still open

1. **Parent approval surface** — with `AUTO_GRADE_PROMOTION` now default ON,
   advancement no longer *requires* approval; it happens automatically. An
   optional approval surface (an endpoint / profile-edit affordance that acts on
   `promotion_ready` by writing `subject_grade_overrides[SUBJECT]`) is still worth
   building for deployments that flip the flag off, and for a parent-facing
   "your child advanced to grade N" notification on the auto path.
2. **Other `grade_level` readers** — the override scopes the planner/selector path.
   Weekly-plan per-subject stats, forecast surfaces, and frontend-initiated pulse
   subject ids still read the grade of record.
3. **Generation grade for promoted blocks** — `plan.grade_level` stays the grade of
   record; a promoted subject's blocks carry next-grade subskill ids, but the launch
   surface's generation scope should eventually ride per-block grade, not per-plan.
4. Whether cross-grade bridge edges (GK-terminal → G1-entry) should gate entry nodes
   instead of dropping the student at the next grade's roots.

## Verification doctrine note

This finding is runtime-observed (a driven 30-day loop), not a type-check inference. Any
fix must likewise be exercised end-to-end — a loop run showing a student crossing GK→G1
and continuing to master content — before being called done. The prototype above met
this bar; the production fix must repeat it through the real planner endpoints.
