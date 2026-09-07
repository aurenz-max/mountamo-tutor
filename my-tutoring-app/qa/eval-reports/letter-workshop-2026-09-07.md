# Eval Report: letter-workshop — 2026-09-07

| Task | Status | Issues |
|------|--------|--------|
| Assisted trace (L0) | PASS — generated content and geometric contract | 0 confirmed CRITICAL/HIGH |

Three live `/api/lumina/eval-test?componentId=letter-workshop&evalMode=trace` draws at kindergarten produced 12 usable challenges:

| Raw response | Requested scope | Generated guides |
|---|---|---|
| [Run 1](letter-workshop-2026-09-07-run-1.json) | Lowercase s, a, t, i | t, a, s, i |
| [Run 2](letter-workshop-2026-09-07-run-2.json) | Uppercase B, D, O, S | B, S, D, O |
| [Run 3](letter-workshop-2026-09-07-run-3.json) | Uppercase and lowercase g, j | J, g, G, j |

G1: All wrappers contain nonempty title, description, gradeLevel, and challengeType=`trace`; every challenge has a unique id, type=`trace`, and a resolving code-owned templateId. G2: no nullable flat reconstruction. G3: not applicable, one L0 task and no catalog eval-mode ladder. G4: the same template supplies the visible guide and geometric answer; visible letters are intentional tracing support. G5: Gemini framing is validated without a content fallback; target selection is code-owned, honors the requested scope, and varies across these scopes. No tier-aware difficulty is claimed.

The API's `status: pass` alone is insufficient: its response reports `catalogMeta: null` and skipped challenge-type validation because this L0 entry has no `evalModes`. The assertions above come from inspecting the actual payloads against the component and geometry contract.

Source audit found a regeneration mismatch: a newly allocated, equal-content challenge array reset shared progress while the serialized session key retained old ink, evidence, and submission guards. The implementation owner confirmed and fixed this by including challenge-array identity revision in the session key, with a component regression for identical-content regeneration. Follow-up runtime: **124/124 tests passed** across geometry and the six component tests, including the regeneration regression. No open issue remains from this finding.

Final focused suite: **165 tests passed** (118 geometry, 6 component, 41 generator). Coverage includes all 52 exact templates, taps/reverses, ordered strokes, missing/extra strokes, partial lines, shortcuts, scribbles, pointer-density invariance, intentional i/j dot taps, similar-letter confusion, regenerated sessions and cumulative group scope.

Live Chromium mouse drive: generated four challenges through the actual Language Arts tester, rejected reversed tracing, accepted a corrected retry, completed all challenges and emitted exactly one evaluation with five retained attempts. Zero page errors. [Browser evidence](letter-workshop-browser-result.json), [generated payload](letter-workshop-browser-generated.json), [feedback](letter-workshop-feedback.png), [summary](letter-workshop-summary.png). The probe intercepted synthetic student submissions; backend persistence was not tested. An initial harness wait used an exact heading string and timed out because the shared summary decorates it with stars; corrected to a heading-role match and re-ran successfully.

These are provisional assisted-tracing checks. Reviewed manuscript conventions, real child tolerances, physical touch/stylus and live tutor audio remain pending; see [birth/follow-up queue](letter-workshop-birth.md).

Typecheck: the scoped gate initially passed. Final recheck reports seven errors in concurrently added `DiDeduction.tsx` / `diDeductionScript.ts`, none in this primitive. Full project baseline before the build was 770 legacy errors.
