# QA Report — Curriculum Mapping Mis-Attribution

**Status:** ✅ **Fix applied (2026-06-07)** — scoped embedding retrieval shipped; verified end-to-end (see §12). Deferred: calibration sweep (§11 open step), confidence-as-calibration-weight, remediation of already-polluted rows.
**Severity:** High (pedagogy + adaptive-model integrity)
**Area:** Lumina primitive submission → curriculum mapping → competency/mastery
**Filed from:** lesson-summary work (the bug surfaced *because* we started showing the resolved skill to the student)

> **2026-06-07 update — read §10–§11 first.** We reproduced the bug against the
> real `resolve_mapping`, then tested a retrieval-based alternative. Net:
> - The permissive `0.3` floor is **refuted as the cause** (the mis-map clears it at 0.75–0.80).
> - An earlier "no ordinal skill exists" finding (§10 row 4) is **itself wrong** and corrected in §11: the K curriculum *does* have `COUNT001-04` "Understand ordinal numbers". The mapper never saw it because `get_curriculum` defaults to **Grade 1** when grade isn't passed.
> - **Corrected root cause:** the candidate set is never scoped to `(primitive's subject, lesson's grade)`, *and* the mapper uses **generation** (force an LLM pick from the flood) instead of **retrieval** (embed → nearest neighbor). Scoped embedding retrieval returns the correct skill `COUNT001-04` @ cosine **0.884**, deterministically (§11).

---

## 1. Summary

A **math** primitive (`ordinal-line`) was attributed to a **Language Arts phonics** curriculum skill. The backend's topic→curriculum mapping resolved an ordinal-positions activity to *"Short and Long Vowel Decoding"* and persisted that attribution to the student's competency + mastery records, then surfaced it to the student as fact.

This is the same class of issue flagged earlier as "finding #1" (the mapping clears a permissive confidence floor and writes a mis-attribution). It was invisible until the new lesson-summary surface started **reading the resolved skill back to the student** — the surface is now acting as a truth check on the mapping, and it caught the mapping lying.

---

## 2. Observed behavior (evidence)

From the `PhaseSummaryPanel` on a completed `ordinal-line` primitive:

- **Primitive:** `ordinal-line` (math — ordinal positions, "1st/2nd/3rd in the parade")
- **Heading shown:** "Ordinal Line Complete! — You mastered ordinal positions in the parade!"
- **Score:** 100% (Perfect)
- **"See what you demonstrated" accordion showed:**
  - Subject: **LANGUAGE ARTS**
  - Skill: **Short and Long Vowel Decoding**
  - Subskill detail: *"Decode short vowel CVC words by mapping sounds to letters… Examples: cat, map, tin, dot, bus… isolate single short vowel sounds…"*
  - Badge: **demonstrated**, 100%
  - Footer: "This activity counted toward your progress on this curriculum skill."

The subject mismatch (math primitive ↔ phonics skill) makes this a clear mis-attribution, not a near-miss.

### Related earlier observation (separate run, for context)
A prior server log showed the pipeline resolving a free-typed lesson to `LANGUAGE_ARTS / LA003-05 / LA003-05-a` ("Sequencing Story Events") at **confidence = 0.70**, then writing competency + calibration (`ability/LA003-05`) + mastery lifecycle (`gate 0→3`). That run *may* have been legitimate (we don't know its primitive/topic), but it confirms the full write path fires off the mapping result regardless of whether the match is correct.

> ✅ **Resolved (2026-06-07):** the confidence was **0.80** (`via=gemini`, a fresh call — not a cache hit). A clean re-run of the same input produced a *different* wrong LA skill — `LA002-01-a` "Pre-Writing and Drawing" @ **0.75**. Both well above the `0.3` floor and a hypothetical `0.6` display bar. See §10.

---

## 3. Impact

1. **Pedagogy (CLAUDE.md priority #1 violation):** the student is told they demonstrated a skill they did not practice. A confident wrong claim is worse than showing nothing.
2. **Adaptive-model pollution:** the mis-attributed attempt is written to `competency`, the IRT calibration (`ability/{skill_id}`), and the `mastery_lifecycle/{subskill_id}` — i.e., a math attempt becomes "evidence" on a phonics skill, corrupting θ / P(correct) / mastery gates that drive routing.
3. **Trust surface:** now that the resolved skill is student-facing, every mis-map is visible to the user.

---

## 4. What happened — pipeline trace

```
Primitive completes (frontend, pre-scored)
   │
   ▼
POST /api/problems/submit                         ← single submission endpoint
   │  payload.lesson_context { topic, grade_level, component_intent,
   │                           primitive_type, id_source: "free-form" }
   ▼
SubmissionService._handle_lumina_primitive
   │  needs_mapping == true  (free-form IDs)
   ▼
CurriculumMappingService.resolve_mapping(...)     ← Gemini call
   │  Gemini returns single "best match" + confidence
   │  GATE: if mapping.confidence >= 0.3  → accept   ← permissive floor
   ▼
review.skill_id / subskill_id / subject  := mapping.*   ← MIS-ATTRIBUTION ENTERS HERE
review.skill_description / subskill_description / mapping_confidence  (newly threaded)
   │
   ├─► CompetencyService.update_competency_from_problem(...)   ← persists attempt + competency
   │       ├─ CalibrationEngine  → ability/{skill_id}
   │       └─ MasteryLifecycleEngine → mastery_lifecycle/{subskill_id}
   │
   └─► SubmissionResult.review returned to frontend
           └─ frontend builds DemonstratedSkill → shown in accordion
```

**Where the fault is introduced:** the `confidence >= 0.3` gate accepts a low/mediocre-confidence Gemini guess and treats it as authoritative for *all* downstream writes. Confidence is checked once as a boolean gate, then effectively discarded (it does not weight the calibration update). Whether Gemini returned a genuinely high confidence here, or a ~0.3–0.5 guess, is the key unknown (§2).

---

## 5. Backend endpoints & services involved

| Endpoint / service | File | Role in this bug |
|---|---|---|
| `POST /api/problems/submit` | `backend/app/api/endpoints/problems.py` (`submit_problem`, ~L435) | Entry point for Lumina primitive submissions |
| `SubmissionService._handle_lumina_primitive` | `backend/app/services/submission_service.py` (~L311) | Decides `needs_mapping`, calls mapping, builds `review` |
| ↳ mapping call + 0.3 gate | `backend/app/services/submission_service.py` (~L386, gate L393) | **Accepts the mapping** that becomes the attribution |
| ↳ review fields (new) | `backend/app/services/submission_service.py` (~L441–449) | `skill_description`, `subskill_description`, `mapping_confidence` |
| `CurriculumMappingService.resolve_mapping` | `backend/app/services/curriculum_mapping_service.py` (L60) | Gemini topic→subskill resolution |
| ↳ confidence floor | `backend/app/services/curriculum_mapping_service.py` (`_CONFIDENCE_THRESHOLD = 0.3`, L40) | **The permissive threshold** |
| ↳ Gemini prompt | `backend/app/services/curriculum_mapping_service.py` (`_resolve_with_gemini`, L178) | Prompt that produced the wrong match |
| `CompetencyService.update_competency_from_problem` | `backend/app/services/competency.py` (L210) | Persists attempt + competency under the (wrong) skill |
| `CalibrationEngine` | `backend/app/services/calibration_engine.py` | Writes `ability/{skill_id}` from the attempt |
| `MasteryLifecycleEngine` | `backend/app/services/mastery_lifecycle_engine.py` | Writes `mastery_lifecycle/{subskill_id}` |

**Persistence touched (all under the wrong skill):** `students/{id}/attempts`, competency docs, `students/{id}/ability/{skill_id}`, `mastery_lifecycle/{subskill_id}`.

Read-side (not the cause, but where the bad data later shows up): `GET /api/evaluations/student/{id}/history` & `/stats` (`backend/app/api/endpoints/evaluations.py`).

---

## 6. Frontend evalAPI (separate, as requested)

All of this lives in **`my-tutoring-app/src/components/lumina/evaluation/api/evaluationApi.ts`**.

| Function | Role |
|---|---|
| `convertToProblemSubmission(result)` (~L66) | Builds the `/api/problems/submit` payload. **This sets `lesson_context` (topic / grade / component_intent / primitive_type) and `id_source`** — i.e., it produces the *input* that drives the Gemini mapping. For free-typed lessons it sends `id_source: 'free-form'` and `skill_id/subskill_id: 'free-form'`, which is what triggers `CurriculumMappingService`. **Investigate what `topic` / `component_intent` were sent for the ordinal-line case** — a misleading intent string could be steering Gemini toward Language Arts. |
| `submitEvaluationToBackend(result)` (~L155) | POSTs to `/api/problems/submit`, receives `SubmissionResult`. |
| `extractDemonstratedSkill(review, result)` (~L) | NEW. Reads `review.{subject, skill_id, subskill_id, skill_description, subskill_description, mapping_confidence}` into a `DemonstratedSkill`. **Currently gates only on a non-sentinel subskill + non-empty description — it does NOT gate on `mapping_confidence`.** A low-confidence mis-map still displays. This is the cheapest place to add a display guard (e.g., require confidence ≥ 0.6) once we decide the bar. |

Downstream of the API (context + UI, for completeness — not where the bug originates):
- `EvaluationContext.tsx` accumulates `demonstratedSkills` (dedupe by subskill, best score).
- `DemonstratedSkillDetails.tsx` self-discovers + renders the accordion.

---

## 7. Root-cause hypotheses (status after 2026-06-07 investigation — see §10)

1. ~~**Permissive floor:** `_CONFIDENCE_THRESHOLD = 0.3` accepts weak matches.~~ **REFUTED as the cause.** The map came back at **0.75–0.80**, not ~0.3–0.5. Raising the floor (or a `0.6` display bar) would not catch this. The floor is still a weakness, but it is downstream of the real problem.
2. **Input not scoped + richest signal dropped.** Topic was the bare string `"Ordinal positions"`, `component_intent` was **empty**, and `objective_text` (the richest signal) is **dropped before the Gemini call** (collected & threaded, but `resolve_mapping` has no such param). More importantly the candidate set is **never scoped to subject or grade** (see #5).
3. ~~**Subject hint leakage** toward `language_arts`.~~ **Not the mechanism.** For a free-form `auto` submission `subject_hint = None`, so the *full* cross-subject curriculum is offered. Gemini chose LA with MATHEMATICS present — it wasn't nudged, it guessed.
4. **Gemini overstates confidence.** **CONFIRMED.** The prompt says "no good match → confidence < 0.3," yet it returns 0.75–0.80 when forced to pick. Self-reported confidence is not trustworthy as a gate.
5. **★ SCOPE FAILURE + WRONG METHOD (the actual root cause).** Two compounding faults:
   - **Grade scope:** `_build_curriculum_summary` calls `get_curriculum(subject)` with **no grade**, which defaults to **Grade 1**. `ordinal-line` is a K primitive whose correct skill `COUNT001-04` "Understand ordinal numbers" lives in the **Kindergarten** curriculum — so it was *never in the candidate set*. (The earlier "no ordinal skill exists" claim was this bug in disguise — corrected in §11.)
   - **Subject scope:** with `subject_hint=None`, all subjects are offered. The primitive's catalog domain (`math`) is known and ignored.
   - **Method:** even correctly scoped, *generation* (force an LLM to pick) hallucinates and can't abstain honestly. *Retrieval* (embed → nearest neighbor) over the correctly-scoped K-math set returns `COUNT001-04` @ **0.884** deterministically (§11). The pipeline uses the wrong tool.
6. **Grade-duplicated subjects (aggravator).** `get_available_subjects()` returns each subject **once per published grade** (`grade='1'` *and* `grade='Kindergarten'`), and the mapper neither dedupes nor uses the grade → it loads the grade-less (Grade-1) doc **twice**, bloating the prompt. (`curriculum_service.py:get_available_subjects`, `curriculum_mapping_service.py:96-109`.)

---

## 8. Suggested fix plan (revised after §11 — retrieval, not generation)

The fix is **not** a threshold tweak, and not a better prompt. Replace forced LLM generation with **scoped embedding retrieval** — the pattern `curriculum-authoring-service/SuggestionEngine` already uses (Gemini embeddings + cosine + threshold, coarse-to-fine). In priority order:

1. **Scope the candidate set (the core fix).** Before matching, restrict to `(subject, grade)`:
   - **Subject** = the primitive's catalog domain (`getCatalogByDomain` → `math`); never `None`/all-subjects.
   - **Grade** = the lesson's `grade_level`, passed into `get_curriculum(subject, grade=...)` so a K primitive is matched against K skills. *This alone surfaces `COUNT001-04` for `ordinal-line`.*
2. **Retrieve, don't generate.** Embed the primitive (catalog description + topic + `objective_text` + `eval_mode`) and rank the scoped subskills by cosine. Return **top-k**, not a single forced pick. Proven: `ordinal-line`→`COUNT001-04` @ 0.884; `ten-frame`→`COUNT001-05`/`OPS001-01` @ 0.80 (§11).
3. **Abstain on shape, not just height.** A *peaked, coherent* top-k (one skill family) = match; a *diffuse plateau* of unrelated skills = no home → **write nothing, show nothing** (CLAUDE.md #1). Calibrate the cutoff across more primitives (§11 next steps).
4. **Confidence as weight, not just gate.** Carry the cosine score into the calibration update as a weight (today's log shows `weight=1.00` on a guess), so weak matches don't pollute θ/mastery at full strength.
5. **Display guard** in `extractDemonstratedSkill` — keep as last-line defense only.
6. **Remediation** for already-polluted competency/ability/mastery rows (e.g. `LA001-01-a`, `LA002-01-a` for student 1004).

**Reuse note:** the embedding machinery already exists — `SuggestionEngine._compute_embeddings` + cosine + calibrated thresholds (`gemini-embedding-2-preview`). The matcher should live where the node index already is (authoring-service, port 8001) and be called from `submission_service` in place of `resolve_mapping`.

---

## 9. Note

The lesson-summary feature that exposed this is **working as intended** — it faithfully shows what the backend resolved. The defect is upstream in the mapping/attribution path. Do **not** "fix" this by hiding the surface; the surface is the truth check.

---

## 10. Reproduction & corrected diagnosis (2026-06-07)

**Method.** Drove the **real** `CurriculumMappingService.resolve_mapping` (live Firestore curriculum + live Gemini) with the exact inputs `MathPrimitivesTester` sends for `ordinal-line`:

```
topic            = "Ordinal positions"   (MathPrimitivesTester.tsx:100)
component_intent = ""                     (tester sends none)
grade_level      = "kindergarten"
primitive_type   = "ordinal-line"
subject_hint     = None                   (subject 'auto' → hint dropped)
```

Harness: `backend/scripts/repro_ordinal_mapping.py` (instruments the subjects loaded into the prompt, scans for an "ordinal" skill, then runs the real mapping).

**Findings:**

| # | Observation | Implication |
|---|---|---|
| 1 | Mapping reproduced: `"Ordinal positions"` → **`LANGUAGE_ARTS / LA002-01 / LA002-01-a`** "Pre-Writing and Drawing" @ **confidence 0.75**. | Bug is real and reproducible. |
| 2 | Prod log for the same input gave a **different** wrong skill (`LA001-01-a` vowel decoding @ 0.80). | **Non-deterministic** — Gemini guesses among LA skills, confident each time. The polluted skill ID is unpredictable. |
| 3 | The Gemini prompt contained **MATHEMATICS (36 skills)** — math was available. | "Math missing from summary" theory **refuted**. Gemini chose LA *over* available math. |
| 4 | ~~No skill in the hierarchy contains "ordinal" → no curriculum target.~~ **CORRECTED in §11.** This was a **wrong-grade artifact**: the scan loaded grade-less curriculum (defaults to **Grade 1**). The **Kindergarten** curriculum *does* contain `COUNT001-04` "Understand ordinal numbers". `ordinal-line` has a valid target; the mapper just never scoped to K. |
| 5 | `get_available_subjects()` returned `['LANGUAGE_ARTS','MATHEMATICS','SCIENCE','SOCIAL_STUDIES']` **twice** → the summary loaded all 4 subjects **duplicated** (8 entries, LA first). | Prompt bloat + LA front-loaded/doubled ⇒ bias toward LA. Real prod bug (same code path). |
| 6 | Confidence 0.75–0.80 despite the prompt's "no good match → confidence < 0.3" rule. | Gemini **overstates confidence**; self-reported confidence is unsafe as a gate. |

**Conclusion.** The proximate fault is not the `0.3` floor — it's that the pipeline forces a curriculum match for a primitive that has none, and trusts Gemini's (overstated) confidence to police it. Corrected hypotheses in §7, revised fix plan in §8.

> Repro is re-runnable: `cd backend && ./venv/Scripts/python.exe scripts/repro_ordinal_mapping.py` (note: results vary run-to-run — that's finding #2).

---

## 11. Retrieval vs. generation experiments (2026-06-07)

After §10 we tested whether primitive→skill is better modeled as **retrieval** (embed + cosine) than **generation** (forced LLM pick), and whether scoping by subject + grade matters. Harnesses: `backend/scripts/repro_subject_pinned_abstain.py` (LLM, subject-pinned, abstain-allowed) and `backend/scripts/repro_embedding_match.py` (Gemini embeddings + cosine, same technique as `SuggestionEngine`).

### 11.1 Generation with a subject pin + explicit abstain (LLM)
Pinned `subject=MATHEMATICS`, offered an explicit "or NONE" option, 3 runs each:
- `ordinal-line` → **ABSTAIN ×3.** Looked correct at the time — but only because the prompt loaded **Grade-1** math (no ordinal skill). False abstain (see 11.3).
- `ten-frame` → **ABSTAIN ×3.** A *false* abstain: ten-frame add/sub skills exist. A 4-word topic + binary match/abstain is too thin to find them.
- *Takeaway:* the subject pin removes cross-subject garbage, but binary LLM match/abstain over a thin topic starves legit primitives of credit.

### 11.2 Retrieval — wrong grade (Grade 1)
Embedded each primitive (catalog description) vs. 111 **Grade-1** math subskills, cosine, τ=0.60:
- `ordinal-line` → best **0.728**, a **diffuse plateau** of 5 unrelated skills (subtraction, length-ordering, growing patterns…). > τ ⇒ would *mis-match* to "Subtraction within 10". The plateau shape is the "no home in this set" signature.
- `ten-frame` → best **0.810** on a **coherent** OPS001 ten-frame cluster ⇒ correct MATCH (fixes 11.1's false abstain).

### 11.3 Retrieval — correct grade (Kindergarten) ✅
Same method vs. 166 **Kindergarten** math subskills:

| Primitive | Best cosine | Top-5 | Verdict |
|---|---|---|---|
| `ordinal-line` | **0.884** | **all 5 are `COUNT001-04` "Understand ordinal numbers"** subskills (0.85–0.88) | ✅ correct skill, peaked & coherent |
| `ten-frame` | **0.799** | `COUNT001-05` "Compose/Decompose 11–19" ×3 + `OPS001-01-F` "ten frames" | ✅ real K number-sense skills |

**Conclusions:**
1. **Grade is a first-class scope input.** Grade-less loading defaults to Grade 1 and was the hidden driver of the whole misattribution; it also produced the false "no ordinal skill" finding in §10.
2. **Retrieval beats generation here.** Correctly scoped, embedding NN returns the *pedagogically correct* skill deterministically (0.884) where the LLM hallucinated (LA @ 0.80) or false-abstained.
3. **Abstain is a shape test.** Coherent peak (top-k = one skill family) = match; diffuse plateau = no home. Height alone (τ=0.60) is insufficient — `ordinal-line`@G1 scored 0.728 but was scattered.
4. **The machinery already exists** (`SuggestionEngine` embeddings + cosine + thresholds) — see §8 reuse note.

> Re-runnable: `cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/repro_embedding_match.py` (set `GRADE` in the script). Grade strings: `"Kindergarten"` or `"K"` (not `"kindergarten"`/`"0"`).

### Open next step (not yet done)
Calibrate the §8 abstain rule (absolute τ vs. top-1-minus-background margin vs. shortlist coherence) across ~10–15 primitives spanning has-a-home and genuinely-homeless cases, so Phase 2 can be a pure threshold or a cheap top-k verify call.

---

## 12. Fix applied (2026-06-07)

Shipped the §8 retrieval fix as a **self-contained backend matcher** (no cross-service
call in the submission hot path) with the primitive's catalog identity **threaded from
the frontend** (no backend primitive→subject duplication / maintenance treadmill).

**Changed files:**
- `backend/app/services/curriculum_retrieval_service.py` (new) — `CurriculumRetrievalMatcher`: scope to `(subject, grade)`, embed (`gemini-embedding-2-preview`) → cosine top-k, shape-based abstain. Subskill embeddings cached per `(subject, grade)`; embedding calls run in `asyncio.to_thread`.
- `backend/app/services/curriculum_mapping_service.py` — owns the matcher; new `resolve_by_retrieval(...)` + `subject_for_domain(...)`; retrieval-result cache; `clear_cache` clears all three.
- `backend/app/services/submission_service.py` — `_handle_lumina_primitive` is **retrieval-first** when the primitive's domain maps to a known subject. **An honest abstain writes nothing — it does NOT fall back to generation** (that fallback was the mis-attribution). Cross-cutting/unknown domains (core/media/assessment/calendar) and legacy no-domain submissions keep the old generation path + 0.3 gate.
- `backend/app/schemas/problem_submission.py` — `LessonContext` gains `primitive_domain`, `primitive_description`.
- `my-tutoring-app/.../catalog/index.ts` — new `getDomainById(id)`.
- `my-tutoring-app/.../evaluation/api/evaluationApi.ts` — `convertToProblemSubmission` threads `primitive_domain` + `primitive_description`; `extractDemonstratedSkill` adds a ≥0.6 display-confidence floor (last-line defense, §8 #5).

**Abstain rule (default — calibration sweep still deferred):** `τ = 0.60` cosine floor **AND** ≥3 of the top-5 share the top-1's skill family (a *peak*, not a diffuse *plateau*). Height alone is insufficient — the wrong-grade plateau clears 0.60; the coherence test is what rejects it.

**Grade is a *soft* scope (robustness fix, post-ship).** First production run abstained on a real `ordinal-line` submission because `grade_level` came in as the **band `"elementary"`**, which doesn't resolve to a published grade doc — so the candidate set was empty and it silently fell back to the frontend's guess IDs. Fixed: **subject is the hard scope; grade only narrows within it.** A band expands to its member grades (`elementary` → K–5), a missing/unresolvable grade widens to *all* published grades for the subject, and each candidate grade is scored on its **own** coherent set with the best-matching grade winning (grades are never unioned — unioning splits a multi-grade concept's top-k across different skill_ids and dilutes the coherence test). `ordinal-line @ "elementary"` now resolves to `COUNT001-04 @ K` deterministically; `ten-frame` with no grade still matches `COUNT001-05 @ K`. `no_scope` is now rare (only when a subject has nothing published).

**Verified end-to-end** against live Firestore curriculum + live Gemini (`backend/scripts/verify_retrieval_matcher.py`, re-runnable):

| Input | Old (generation) | New (retrieval) |
|---|---|---|
| `ordinal-line` @ Kindergarten | `LANGUAGE_ARTS/LA002-01` phonics @ 0.75 (wrong, non-deterministic) | **`MATHEMATICS/COUNT001-04` "Understand ordinal numbers" @ 0.814, 5/5 coherent** ✅ |
| `ten-frame` @ Kindergarten | false abstain | **`MATHEMATICS/COUNT001-05` K number-sense @ 0.830, 4/5** ✅ |
| `ordinal-line` @ Grade 1 (wrong-grade stress) | — | **ABSTAIN** (2/5 diffuse plateau → no home, writes/shows nothing) ✅ |

The math-primitive → Language-Arts-skill mis-attribution is now structurally impossible: a math primitive is scoped to `MATHEMATICS` at its lesson grade and either matches a coherent math skill or abstains.

**Checks:** backend imports + `py_compile` clean; frontend `tsc --noEmit` = 1441 errors (vs 1444 baseline — 0 new, none in touched files).

**Still deferred (not in this pass):** (1) the §11 calibration sweep across 10–15 primitives to lock τ / coherence; (2) carrying cosine into the calibration update as a *weight* (§8 #4 — today still `weight=1.00`); (3) remediation of already-polluted `competency`/`ability`/`mastery` rows (§8 #6, e.g. `LA001-01-a`, `LA002-01-a` for student 1004).
