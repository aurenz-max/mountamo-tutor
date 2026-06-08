# Curriculum-Fit — Does a Primitive Have a Curriculum Home?

Run **scoped embedding retrieval** (the same `CurriculumRetrievalMatcher` path that `/api/problems/submit` uses) for a Lumina primitive against the live curriculum at its target grade(s). Report the top-k curriculum match per grade, and — when it misses — **diagnose *why* and recommend the fix**. Report only; never auto-edit curriculum or catalog.

**Arguments:** `/curriculum-fit <primitive-id> [grades]`
- Omit grades to auto-discover every published grade for the primitive's subject.
- `grades` is a comma list of grade keys, e.g. `K,1`.
- `/curriculum-fit all` sweeps every primitive in every evaluable domain (one report row each).
- `/curriculum-fit <domain>` (e.g. `math`) sweeps one domain.

> **Why this exists.** A primitive→curriculum match is a *retrieval* problem, not a stored mapping (we never pre-bake `target_primitive` affinities — see CLAUDE.md "No Pre-Baked Primitive Mappings"). This skill validates that the *runtime* retrieval path actually finds a home for each primitive. A miss is a real signal: either our curriculum is missing a skill, or the primitive's catalog description is too thin to be found. Born from `QA_curriculum_mapping_misattribution.md` (a math primitive was being attributed to a phonics skill).

> **Sibling, not duplicate:** `/curriculum-lumina-audit` works the *other* direction (curriculum → which subskills lack a good primitive, via stored `target_primitive`). This skill works primitive → curriculum, via live embeddings. A "curriculum gap" found here is a natural input to `/curriculum-lumina-audit gaps` and `/curriculum-author`.

---

## Workflow

### Step 0: Resolve the primitive's catalog identity

The probe needs the primitive's **catalog domain**, **description** (the embedding signal), and **target grade(s)**. All live in the catalog TS:

```
Catalog: my-tutoring-app/src/components/lumina/service/manifest/catalog/<domain>.ts
```

1. Find the entry: grep the catalog files for `id: '<primitive-id>'`. The file it lives in *is* the domain (`math.ts` → `math`).
2. Read its `description` (verbatim — this is what gets embedded) and `constraints`.
3. **Infer target grade(s)** from `constraints`/`description` (e.g. ordinal-line says *"maxPosition 5 for Kindergarten, 10 for Grade 1"* → grades `K,1`). If unclear, pass `--grades auto`.

> **Grade is a *soft* scope, not a hard one.** Subject is the hard scope (math can never match phonics); grade only narrows within it. A **band** (`elementary`), a missing grade, or anything unresolvable **widens to all published grades** for the subject and picks the best home — it never abstains just because the grade is coarse. (This was a real bug: production sends `grade_level="elementary"`, which used to silently abstain.) Each candidate grade is scored on its *own* coherent set and the best-matching grade wins — grades are never unioned (that would dilute the coherence test for concepts that span grades).

> Cross-cutting domains (`core`, `media`, `assessment`, `calendar`) have **no single curriculum subject** — the probe will say so and stop. Those primitives map via the legacy generation path, not retrieval; that's expected, not a bug.

### Step 1: Run the probe

```bash
cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/curriculum_fit_probe.py \
  --primitive <id> --domain <domain> --grades <K,1 | auto> \
  --description "<verbatim catalog description>" \
  [--topic "<short topic>"] [--json]
```

- Add `--json` to get machine-readable output you can parse; omit it for the readable table.
- The probe embeds the grade's subskills once per `(subject, grade)` and ranks them by cosine. It reuses the production matcher, so the verdict here **is** the verdict the live pipeline would reach.

If embeddings/Firestore error, the probe says so — check the backend `.env` has `GEMINI_API_KEY` and Firestore creds (same setup the `repro_*.py` scripts need).

### Step 2: Read the verdict per grade

The probe returns, for each grade: `best_cosine`, `coherent` (how many of the top-5 share the top-1's skill family), `verdict`, and `abstain_reason`.

| Verdict | Shape | Meaning |
|---|---|---|
| **MATCH** | best ≥ 0.60 **and** ≥3/5 share one skill family (a *peak*) | The primitive has a clear home. Report the skill. ✅ |
| **ABSTAIN — weak** | best < 0.60 everywhere | Nothing in this grade is even close. → **Curriculum gap** (likely). |
| **ABSTAIN — diffuse** | best ≥ 0.60 but top-5 scattered across unrelated skills (a *plateau*) | Either a thin description, or only loosely-related skills exist. |
| **ABSTAIN — no_scope** | the subject has *no* published grades at all | **Scoping/data issue** — nothing is published for this subject. (Rare now that grade is soft — a single unpublished grade widens to the others rather than no_scope.) |

> The JSON output includes a `per_grade` array (`grade`, `best_cosine`, `coherent`, `reason`) showing how *every* candidate grade scored — useful for the report and for spotting "matches at K but homeless at G1" situations.

> A primitive can MATCH at one grade and ABSTAIN at another — that's informative (e.g. ordinal-line: MATCH `COUNT001-04` @ K, ABSTAIN @ G1 → G1 has no ordinal skill). Report per grade.

### Step 3: Diagnose a miss (the valuable part)

Don't just report the abstain — classify it, because each cause has a different owner:

1. **Curriculum gap** (→ author the skill). Signals: `weak` everywhere, OR `diffuse` where you read the top-k and *no* listed skill is the right concept. The skill exists in the world but not in our curriculum.
   - **Recommend:** `/curriculum-author` to add the skill to the draft for that grade, then publish. Or feed it to `/curriculum-lumina-audit gaps <SUBJECT>`.
   - **Sanity-check first:** is it really absent, or present at a *different* grade? Re-run with `--grades auto`.

2. **Thin / misleading description** (→ fix the catalog). Signals: `diffuse` (or a low MATCH) where you read the scoped skills and the *correct* skill is clearly present in the curriculum but ranked low or scattered. The retrieval can't find a home that exists because the `description` is generic, jargon-heavy, or omits the key concept words.
   - **Recommend:** tighten the primitive's catalog `description` to name the concept and the student action in plain words (compare against a known-good entry like `ten-frame`/`ordinal-line`). Then re-run `/curriculum-fit` — do NOT edit it as part of this skill; report the suggested wording.

3. **Scoping / data issue** (→ fix the service/publish). Signals: `no_scope`, or the right grade returns far fewer candidates than expected.
   - **Recommend:** verify `curriculum_published/{grade}/subjects/{subject}` exists (this is the literal bug class from the QA report — a K primitive matched against an unpublished/defaulted grade). Check `backend/scripts/discover_grades.py`.

### Step 4: Save the report

Save to: `my-tutoring-app/qa/curriculum-fit/<primitive-id>-<YYYY-MM-DD>.md` (overwrite same primitive+date).

**Report format — keep it short:**

```markdown
# Curriculum-Fit: <primitive-id> — <YYYY-MM-DD>

**Domain → Subject:** <domain> → <SUBJECT>
**Query (embedded):** <first ~120 chars of the description used>

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| K | MATCH | 0.814 | 5/5 | COUNT001-04 "Understand ordinal numbers" |
| 1 | ABSTAIN (diffuse) | 0.752 | 2/5 | — (no ordinal home in G1) |

## Diagnosis & Recommendation

<Only for non-MATCH grades. State which of the 3 causes and the concrete next action.>
- **Grade 1 — curriculum gap.** G1 curriculum has no ordinal-numbers skill; top-5 are add/subtract & data skills. Either ordinal-line is K-only, or author a G1 ordinal skill via `/curriculum-author`. (top-1 was OPS001-05 "Add-To/Take-From" @ 0.752 — not a real home.)
```

If every probed grade is a clean MATCH, the Diagnosis section is just: "All grades have a clear curriculum home. No action."

### Step 5 (sweep mode only): rollup

For `/curriculum-fit all` or `/curriculum-fit <domain>`, write one report per primitive and print a console rollup:

```
Curriculum-Fit Rollup — <date>
| Primitive    | Best grade | Verdict | Notes |
|--------------|-----------|---------|-------|
| ordinal-line | K         | MATCH   | COUNT001-04 |
| ten-frame    | K         | MATCH   | COUNT001-05 |
| <homeless>   | —         | MISS    | curriculum gap |
```

Surface the MISSes at the top — those are the curriculum/description work items.

---

## Key Rules

1. **Report only — never auto-edit.** Curriculum changes go through draft-first (`/curriculum-author` → lineage-check → publish). Catalog description fixes are the user's call. This skill recommends; it does not write curriculum or catalog.
2. **The description is the signal.** Always embed the *verbatim* catalog `description`. If a primitive misses because its description is thin, that's a finding — don't "fix" it by hand-feeding a better query to force a match.
3. **A miss is a feature.** The point of the skill is to catch primitives with no honest curriculum home *before* they mis-attribute student attempts. Resist the urge to lower the bar; an abstain that says "no home" is the correct, pedagogically-safe outcome (CLAUDE.md #1).
4. **Match the live verdict.** The probe reuses `CurriculumRetrievalMatcher` (`backend/app/services/curriculum_retrieval_service.py`) and `_build_retrieval_query` — so its verdict is exactly what `/api/problems/submit` would do. If you change the abstain rule, change it there, not here.

## Reference

- **Engine:** `backend/scripts/curriculum_fit_probe.py` (parametrized) → `CurriculumRetrievalMatcher.probe()`.
- **Origin & method:** `my-tutoring-app/src/components/lumina/docs/QA_curriculum_mapping_misattribution.md` (§8 fix, §11 retrieval-vs-generation experiments, §12 applied fix).
- **Mirror-direction audit:** `/curriculum-lumina-audit` (curriculum → primitive coverage).
- **Fix the home:** `/curriculum-author` (author/adjust curriculum), `/eval-test` (verify the primitive itself works).
