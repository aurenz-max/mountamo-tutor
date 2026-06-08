# Curriculum-Fit QA: knowledge-check (content-driven, out-of-sample) — 2026-06-07

**Domain → Subject:** `assessment` → **(none — cross-cutting)**
**Engine:** `backend/scripts/curriculum_fit_knowledge_check.py` (reuses the production `CurriculumRetrievalMatcher.probe()` + `_build_retrieval_query`, one Firestore init, 20-item fixture).
**Grade probed:** 1 (published for MATHEMATICS, LANGUAGE_ARTS, SCIENCE; SOCIAL_STUDIES published but unrouteable).

## Why this test is different

`knowledge-check` is not calibrated to a subject. It lives in the `assessment` domain, which has **no `_DOMAIN_TO_SUBJECT` entry** — so a plain `/curriculum-fit knowledge-check` bails immediately ("no curriculum subject"). Its curriculum home is decided **entirely by the content it is filled with**. That makes it the ideal probe for one question:

> Given arbitrary, **held-out** grade-1 content (not derived from any catalog description), does the production scoped-retrieval path place it on the correct grade-1 skill — and decline honestly when there is no home?

This is a general read on **out-of-sample retrieval quality** for the whole `/api/problems/submit` matcher, using knowledge-check as the carrier.

**Method:** each item simulates a KC populated with `content` (the concept its questions probe), routed to the content's subject, then scored against the expected grade-1 family. `content` is fed as the concept-leading signal (mirrors the live FOCUSED query: challenge text + topic context).

## Results — 19/20 expectations met

| id | category | route | verdict | best | coh | landed | expected | P/F |
|----|----------|-------|---------|------|-----|--------|----------|-----|
| m_add10 | core | math | MATCH | 0.828 | 5/5 | OPS001 | OPS001 | ✅ |
| m_time_hour | core | math | MATCH | 0.839 | 5/5 | MEAS001 | MEAS001 | ✅ |
| m_tens_ones | core | math | MATCH | 0.830 | 5/5 | NBT001 | NBT001 | ✅ |
| m_2d_shapes | core | math | MATCH | 0.848 | 5/5 | GEOM001 | GEOM001 | ✅ |
| m_patterns | core | math | MATCH | 0.826 | 5/5 | PTRN001 | PTRN001 | ✅ |
| m_coins | core | math | MATCH | 0.849 | 4/5 | MEAS001 | MEAS001 | ✅ |
| l_cvc | core | literacy | MATCH | 0.853 | 4/5 | LA001 | LA001 | ✅ |
| l_nouns | core | literacy | MATCH | 0.792 | 4/5 | LA004 | LA004 | ✅ |
| l_story | core | literacy | MATCH | 0.779 | 3/5 | LA003 | LA003 | ✅ |
| l_syn_ant | core | literacy | MATCH | 0.822 | 4/5 | LA005 | LA005 | ✅ |
| s_sound | core | science | MATCH | 0.819 | 5/5 | SCI001 | SCI001 | ✅ |
| s_animal_parts | core | science | MATCH | 0.858 | 5/5 | SCI002 | SCI002 | ✅ |
| s_day_night | core | science | MATCH | 0.862 | 5/5 | SCI003 | SCI003 | ✅ |
| s_machines | core | science | MATCH | 0.807 | 4/5 | SCI005 | SCI005 | ✅ |
| x_math_as_literacy | misroute | literacy | ABSTAIN | 0.699 | 2/5 | (LA004) | ABSTAIN | ✅ |
| x_literacy_as_math | misroute | math | ABSTAIN | 0.704 | 1/5 | (OPS001) | ABSTAIN | ✅ |
| o_multiplication | oos-grade | math | ABSTAIN | 0.756 | 2/5 | (MEAS001) | ABSTAIN | ✅ |
| o_count10_K | oos-grade | math | ABSTAIN | 0.749 | 1/5 | (MEAS001) | ABSTAIN | ✅ |
| **o_fractions_symbolic** | **oos-grade** | **math** | **MATCH** | **0.806** | **5/5** | **GEOM001** | **ABSTAIN** | ❌ |
| ss_community | unroutable | social_studies | UNROUTABLE | — | — | (no route) | UNROUTABLE | ✅ |

## What the numbers say (the out-of-sample guide)

There is a **clean, well-separated population split** — and crucially, the discriminator is **coherence, not cosine height**:

| Population | best cosine | family coherence |
|---|---|---|
| **In-curriculum content** (correct subject) | 0.78 – 0.86 | **3–5 / 5** |
| **Off-target** (misrouted or wrong-grade) | 0.70 – 0.76 | **1–2 / 5** |

1. **Out-of-sample recall is excellent (14/14).** Every held-out grade-1 topic, routed to the right subject, landed on the correct skill family — most at 4–5/5 coherence. Retrieval generalizes well beyond the catalog descriptions it was never trained on. The matcher even resolves *within-subject* discrimination cleanly: coins → MEAS001-07, time → MEAS001-03, place-value → NBT001, all distinct.

2. **Subject is the hard guard, and it holds.** Deliberately misrouting math content into literacy (and vice-versa) **abstained** — the exact `math → phonics` misattribution class that this whole capability was born to prevent ([QA_curriculum_mapping_misattribution.md](../../src/components/lumina/docs/QA_curriculum_mapping_misattribution.md)) does **not** reproduce. Note the off-target items still clear the τ=0.60 cosine floor (~0.70); it's the **family-coherence ≥3/5 peak test** that rejects them. Cosine alone would have mis-fired — confirming the coherence rule is doing the real work.

3. **Honest abstain on out-of-curriculum content.** Multiplication (grade 3) and counting-to-10 (Kindergarten) both abstained as `diffuse` rather than forcing a false home — the pedagogically-safe outcome (CLAUDE.md #1). Off-grade content does not silently attach to a near-grade skill.

4. **The one boundary failure is a *concept-proximity* over-claim, not a bug.** `o_fractions_symbolic` (writing 1/2, 1/4 — a grade-3 symbolic skill) matched **GEOM001 partitioning into halves/fourths @ 0.806, 5/5**. That *is* the nearest legitimate grade-1 home for "halves and fourths," so the embedding behaves reasonably — but it over-claims because a related-but-not-identical skill exists at grade. **This is the generalizable risk for out-of-sample content:** when the curriculum has a *near-neighbor* of slightly-above-grade content, retrieval lands there with high cosine *and* high coherence, so neither guard catches it. Honest-abstain protects against *absent* concepts, not against *adjacent* ones.

## Structural finding (the real blocker)

**knowledge-check is currently un-attributable in production, regardless of content quality.** Because `assessment` has no subject mapping, the live mapping service returns `None` at subject-resolution — *before retrieval ever runs*. So all of the content-fit quality measured above is **latent**: every knowledge-check attempt today accrues to the orphan synthetic `general` subject, never to OPS001/LA001/SCI001 etc. `ss_community` makes the same gap visible from the other side: SOCIAL_STUDIES has published grade-1 curriculum but no domain route, so it can never be reached at all.

## Recommendations (report-only)

1. **Derive a subject for content-carrier primitives before retrieval.** knowledge-check (and any `assessment`/cross-cutting primitive) needs a subject from somewhere other than its domain. Two options, lowest-effort first:
   - **(a) Inherit from lesson context** — the manifest/lesson that placed the KC already knows its subject and grade. Pass that through to the mapping call. Cheapest, no new model.
   - **(b) Lightweight subject classifier** on the KC content when context is absent. Only needed for standalone/ad-hoc checks.
   Once a subject is supplied, the scoped retrieval proven here (14/14) does the rest. Owner: `curriculum_mapping_service.py` (subject resolution), not the matcher.
2. **Add a domain route for SOCIAL_STUDIES** (or explicitly mark it cross-cutting) so its published grade-1 curriculum is reachable. Currently it's published-but-orphaned.
3. **Treat "adjacent-grade near-neighbor" as a known retrieval limit.** The fractions case shows cosine+coherence can't distinguish "this exact skill" from "the closest grade-appropriate cousin." If precise grade-gating matters for KC attribution, pair retrieval with the grade-aware probe already proposed in the math sweep ([_sweep-math-2026-06-07.md](_sweep-math-2026-06-07.md) rec #2) — probe the content's *own* grade band and flag matches that only resolve at an adjacent grade.

## Reproduce

```bash
cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/curriculum_fit_knowledge_check.py        # table
cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe scripts/curriculum_fit_knowledge_check.py --json  # machine-readable
```

Fixture (20 items, grade 1) is inline in the script — extend `FIXTURE` to add topics/subjects/grades. This is the reusable template for "does content-X find its curriculum home out of sample?"

**Bottom line:** the retrieval matcher is **out-of-sample-ready** — held-out grade-1 content lands on the right skill (14/14) and declines honestly on misrouted/off-grade content, with coherence (not cosine) doing the discrimination. The gap is *plumbing*: knowledge-check can't reach retrieval at all because `assessment` has no subject. Wire a content/context-derived subject and knowledge-check inherits this quality for free. The only retrieval-side caveat is adjacent-grade near-neighbors (symbolic fractions → grade-1 partitioning).
```
