# Birth Certificate — spatial-path (2026-09-09)

**Lifecycle layer: L0 (born)** — pedagogically measurable, animated, and multi-instance.

- Core task identity: `choose_route` — choose the requested over/under/through/around/
  across route, then animate a traveler along the selected geometry.
- Generator fork: **Fork A — local code-owned pool.** Code owns all SVG paths, route
  identities, answer keys, and 3–6 challenge selection. Gemini writes answer-free wrapper
  copy only.
- Measurement: correctness is selected route ID/relation, never the destination. Canonical
  metrics include totals, first-try count, attempts, hints, accuracy, and average attempts;
  student-work evidence retains each chosen route and represented relation.
- Answer-leak audit: obstacles and candidates remain visible, while the green correct-path
  highlight and relation labels appear only after submission.

## Design gate

- Direct manipulation — pass: the child taps a route itself.
- Living behavior — pass: the traveler follows the exact selected SVG path after submit.
- Production over recognition — accepted L0 exception: this request explicitly permits
  choosing or drawing; L0 implements route choice, with `draw_route` queued for L1.
- No visible timer — pass: none is rendered.
- No answer leak by layout — pass: all candidates share their endpoints, candidate colors
  do not encode correctness, and the correct highlight is withheld until submission.

## Verification

- Focused Vitest: **70/70 passed** across generator/contract, scene runtime,
  spoken-scene script, legacy preposition, and catalog-affordance suites.
- Lumina typecheck: zero errors.
- Backend calibration parity: **2/2 passed** for the extended `spatial-scene` ladder.
- Live registry/API: `spatial-path` generated five challenges covering all five relations;
  every candidate retained the shared `(60,160)` → `(540,160)` endpoints. The Next route
  compiled successfully.
- Curriculum fit: Kindergarten MATCH at 0.8120 with 4/5 same-skill coherence; exact top result is
  LA004-05-H. Grade 1–2 are intentionally excluded after diffuse/scattered probes.
- Real microphone/tutor speech and browser visual polish remain human checks.

## Follow-up queue

| Skill | Layer | Candidate work |
|-------|-------|----------------|
| `/add-eval-modes` | L1 | Add `draw_route` and `follow_multi_route` only when their distinct evidence contracts are implemented. |
| `/add-tutoring-scaffold` | L2 | Add route-aware coaching that contrasts geometry without naming the key early. |
| `/add-support-tiers` | L3 | Vary tracing aids while preserving routes and answers. |
| `/add-structural-difficulty` | L4 | Increase bends/legs or compose multiple relations, not merely remove hints. |
| `/add-sound` | L5 | Add sparse travel/landmark feedback without masking spoken directions. |
| `/eval-test spatial-path` | QA | Run live registry and browser lifecycle gates; route confirmed failures through `/eval-fix`. |
