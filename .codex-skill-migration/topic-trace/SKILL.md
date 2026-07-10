# Topic Trace — How a Topic Shapes Scope in Downstream Primitives

Insert a topic, run the real lesson pipeline (curator brief → manifest → generators), and assess how the topic's scope flows into the content each primitive actually generates. Use this to evaluate generator prompts. Report only where scope is actually lost — not style.

**Arguments:** `/topic-trace "<topic>" [gradeLevel] [componentId]`
- `/topic-trace "Counting to 10"` — trace every primitive the manifest selects for this topic
- `/topic-trace "Counting to 10" kindergarten` — set the grade level (default `elementary`)
- `/topic-trace "Place value to 1000" elementary place-value-chart` — trace only one generator
- `/topic-trace "Counting to 20" --student 1004` — personalized trace: A/B the manifest with and without that student's IRT/mastery context (see "Personalized traces" below)
- Topic is required and should carry real scope language ("to 10", "within 5", "1–100", "two-digit") so there's a scope to honor.

This is the topic-side companion to `/eval-test`. `/eval-test` fixes a topic and tests one primitive's modes; `/topic-trace` fixes a topic and watches it propagate through the manifest into many primitives.

## Workflow

### Step 1: Curl the API

```bash
# Full trace (URL-encode the topic)
curl -s "http://localhost:3000/api/lumina/topic-trace?topic=Counting%20to%2010&gradeLevel=elementary"

# Focus a single generator
curl -s "http://localhost:3000/api/lumina/topic-trace?topic=Counting%20to%2010&componentId=ten-frame"
```

If connection refused, tell the user: `cd my-tutoring-app && npm run dev`

Base64 image data is **stripped by default** (replaced with a short `[stripped …]` placeholder) — it's noise for scope/prompt assessment and would bloat the response to multiple MB. Add `&images=keep` only if you actually need the pixels.

Add `&manifestOnly=true` to stop after the manifest (~5-10s) — no generators run. Use this for manifest-level A/B comparisons (personalization, prompt experiments) where the generator outputs are irrelevant.

The full pipeline (brief + manifest + every generator) can take 30–90s. The route blocks until done and returns ONE JSON document. Each entry in `components[]` has:
- `objectiveText` / `objectiveVerb` — the objective that bound this component (where scope language lives)
- `intent` — what the manifest told the generator to make
- `generatorInput` — the exact `generateComponentContent(item, topic, gradeLevel)` call (the "primitive api call"), including the `config` injected with objective context
- `data` — the generated output to inspect
- `replay` — a ready-to-POST body to re-run JUST this primitive against `/api/lumina`

### Personalized traces (student context A/B)

The manifest prompt accepts a per-student STUDENT PROFILE block (IRT/mastery state per objective, resolved via curriculum retrieval). To assess whether personalization actually changes curator behavior, run an A/B with **fixed objectives** (so the only variable is the profile):

**1. Build the student's generation context** (no HTTP auth needed — call the endpoint handler directly through backend services):

```bash
cd backend && /c/Users/xbox3/miniforge-pypy3/envs/py311env/python -c "
import asyncio, json
async def main():
    from app.dependencies import get_competency_service, get_curriculum_mapping_service
    from app.api.endpoints.student_profile import get_generation_context, GenerationContextRequest, ObjectiveIn
    comp = await get_competency_service(); mapping = await get_curriculum_mapping_service()
    objs = [ObjectiveIn(id='obj1', text='<objective text>', verb='apply')]
    req = GenerationContextRequest(student_id=1004, topic='<topic>', grade_level='<grade>', subject='Mathematics', objectives=objs)
    out = await get_generation_context(req, user_context={}, competency_service=comp, mapping_service=mapping)
    json.dump(out, open('C:/tmp/ctx.json', 'w'), indent=2)
asyncio.run(main())
"
```

Student **1004** is the dev student with real theta data (COUNT001 skills). Student 1 has none — its context comes back all "new material". A synthetic low-state variant (edit `pCorrect`/`masteryGate`/`summary` fields) is a legitimate fixture for testing the struggling branch.

**2. POST the trace** with the same fixed `objectives` used to build the context, ± `studentContext`:

```bash
curl -s -X POST http://localhost:3000/api/lumina/topic-trace \
  -H "Content-Type: application/json" \
  -d '{"topic":"<topic>","gradeLevel":"<grade>","manifestOnly":true,
       "objectives":[{"id":"obj1","text":"<objective text>","verb":"apply","icon":"🎯"}],
       "studentContext": <contents of C:/tmp/ctx.json or null>}'
```

Fixed `objectives` skip the curator brief, so baseline and personalized runs compare the same lesson — not brief variance.

**3. Assess the response:**
- `personalization.applied` / `personalization.promptBlock` — the exact STUDENT PROFILE block the curator saw (null when not applied)
- `objectives[].componentConfigs[].difficulty` — should shift easy↔challenging with the profile (P(correct) <55% → easy; >80% → challenging)
- Component selection/count per objective — struggling profiles should weight Introduce/Visualize; strong should compress intro and weight Apply/assessment
- **Leak check (pedagogy rule #1):** no title or intent may mention scores, gates, P(correct), mastery, or percentages. A leak here is a release blocker for the manifest prompt.

Verified baseline (2026-06-11, "Counting objects up to 20", kindergarten): strong profile (P≈97%) → all difficulties "challenging", intro compressed 4→3 components; struggling (P≈32%) → all "easy", assessment block dropped from the weak objective; zero leaks. See `qa/topic-traces/personalization-ab-counting-2026-06-11.md`.

### Step 2: Trace the scope chain — TOPIC → OBJECTIVE → INTENT → CONFIG → DATA

For each component, walk the chain and find where scope is preserved or dropped:

1. **Topic → Objective.** Did the manifest's `objectiveText` keep the topic's numeric/conceptual scope? ("Counting to 10" → objective says "count to 10" ✓, or drifts to "count to 100" ✗).
2. **Objective → Intent.** Does the component's `intent` restate the scope, or does it go generic ("practice counting")?
3. **Intent/Config → Generator input.** Is the scope present in `generatorInput.config` (e.g. `keyTerms`, range hints), or does the generator only receive the bare topic string?
4. **Input → Data.** Does the generated `data` stay inside scope? Flag the **largest student-facing value or out-of-scope concept** a student would actually see — ignore timings, indices, pixel sizes, IDs.

The point is to locate **which link broke**, because that determines the fix target.

### Step 3: Report — scope drops only

Only flag a component where the generated content **leaves the topic's scope** (too-large numbers, off-topic concepts, wrong grade band). If it stays in scope, say it stays in scope. Do not flag style, wording, or difficulty tuning that's still inside scope.

For each scope drop, classify the **broken link** so the fix lands in the right place:

| Broken link | Symptom | Fix target |
|---|---|---|
| **OBJECTIVE** | `objectiveText` already dropped the scope | Manifest/curator prompt (`gemini-manifest.ts`, `gemini-curator-brief.ts`) |
| **INTENT** | Objective kept scope, but `intent` went generic | Manifest prompt — intent must restate the parent objective's scope |
| **GENERATOR** | Intent/config carried scope, but `data` blew past it | The generator prompt. Check whether it calls `buildScopePromptSection` (`scopeContext.ts`); if not, it's a rollout target; if it does, the binding needs strengthening |

This maps directly onto the Scope Context Contract work — generators that ignore the objective ceiling are the `scopeContext.ts` rollout backlog.

### Step 4: Save Report

Save to: `my-tutoring-app/qa/topic-traces/<topic-slug>-<YYYY-MM-DD>.md`

Overwrite if the same topic + date already exists. Keep it short:

```markdown
# Topic Trace: "<topic>" (<gradeLevel>) — <YYYY-MM-DD>

Scope intended by the topic: <e.g. "values ≤ 10">

## Components

| Component | In scope? | Largest / off-scope value | Broken link | Fix target |
|-----------|-----------|---------------------------|-------------|------------|
| ten-frame | ✓ | 9 | — | — |
| number-line | ✗ | 87 | GENERATOR | scopeContext rollout |

## Scope drops

### number-line — generates values to 87 for a "to 10" topic
- **Chain:** objective "count to 10" ✓ → intent "plot numbers on a line" (scope dropped) → data max 87
- **Broken link:** INTENT then GENERATOR — intent didn't restate the ceiling, and the generator has no scope binding
- **Fix target:** GENERATOR (`gemini-number-line.ts` — wire `buildScopePromptSection`) + tighten manifest intent

<If every component stays in scope, state that and skip this section.>
```

After saving, tell the user the file path and a one-line summary (e.g. "5 components, 1 scope drop in number-line — GENERATOR link").

**Do NOT fix code unless the user explicitly asks.** This skill assesses prompts; `/eval-fix` and the `scopeContext.ts` rollout do the fixing.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/lumina/topic-trace/route.ts` | The API endpoint (this skill's engine) |
| `src/components/lumina/service/manifest/gemini-manifest.ts` | Manifest + objective/intent prompt |
| `src/components/lumina/service/curator-brief/gemini-curator-brief.ts` | Curator brief / objective prompt |
| `src/components/lumina/service/**/gemini-*.ts` | Per-primitive generator prompts (the assessment target) |
| `src/components/lumina/service/**/scopeContext.ts` | `buildScopePromptSection` — the scope-binding helper generators should call |
| `src/components/lumina/service/studentContext/types.ts` | `StudentGenerationContext` shape (what `studentContext` must look like) |
| `backend/app/api/endpoints/student_profile.py` | Generation-context endpoint (objectives → retrieval → IRT/mastery state) |
| `my-tutoring-app/qa/topic-traces/` | Report output directory |
---
name: topic-trace
description: >-
  Trace a topic through Lumina's curator brief, manifest, and downstream generators. Use when assessing how topic scope reaches selected primitives and identifying where generator prompts lose fidelity.
---
