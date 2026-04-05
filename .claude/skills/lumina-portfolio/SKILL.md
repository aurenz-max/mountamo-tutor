# Lumina Portfolio — Primitive Product Portfolio Manager

Product portfolio manager for Lumina primitives. Bird's-eye view of all PRDs, implementation status, pedagogical gaps, and strategic roadmap. This is the **precursor to `/primitive`** — use it to decide *what* to build next, then hand off to `/primitive` to build it.

**Arguments:** `/lumina-portfolio [command] [options]`

## Commands

| Command | Example | Purpose |
|---------|---------|---------|
| `dashboard` | `/lumina-portfolio dashboard` | Full portfolio overview: all PRDs, all domains, implementation status |
| `audit` | `/lumina-portfolio audit physics` | Deep audit of a specific PRD or domain — what's built, what's missing, what's broken |
| `audit` | `/lumina-portfolio audit --all` | Audit every domain, produce cross-domain summary |
| `gaps` | `/lumina-portfolio gaps` | Pedagogical gap analysis across all domains — where are the biggest holes? |
| `gaps` | `/lumina-portfolio gaps K-2` | Gap analysis filtered to a grade band |
| `roadmap` | `/lumina-portfolio roadmap` | Prioritized build plan based on pedagogical impact, coverage gaps, and effort |
| `prd` | `/lumina-portfolio prd chemistry` | Develop or enhance a PRD — guided PRD authoring workflow |
| `health` | `/lumina-portfolio health math` | Technical health check — generators, registry, eval modes, type safety |
| `compare` | `/lumina-portfolio compare math literacy` | Side-by-side maturity comparison between two domains |

---

## Data Sources

### PRD Documents
All PRDs live in: `my-tutoring-app/src/components/lumina/docs/`

Read and parse PRDs to extract:
- **Planned primitives** — every primitive spec in the PRD (name, grade band, interaction model, eval modes)
- **Standards alignment** — CCSS, NGSS, C3, CEE references
- **Implementation status** — if the PRD has status tables, extract them; otherwise infer from catalog

### Live Catalog (what's actually registered)
Catalog files: `my-tutoring-app/src/components/lumina/service/manifest/catalog/*.ts`
- Extract: `id`, `description`, `constraints`, `supportsEvaluation`, `evalModes[]`, `tutoring`

### Built Components (what's actually coded)
Primitive components: `my-tutoring-app/src/components/lumina/primitives/`
- Glob `**/*.tsx` to find all built primitives by domain subdirectory

### Generators (what produces content)
Generator files: `my-tutoring-app/src/components/lumina/service/*/gemini-*.ts`
Generator registry: `my-tutoring-app/src/components/lumina/service/registry/generators/`

### Backend Registry (what's calibrated)
`backend/app/services/calibration/problem_type_registry.py`
- Extract primitive IDs and their eval mode beta priors

### Domain-to-PRD Mapping

| Domain | Primary PRDs | Catalog File |
|--------|-------------|--------------|
| **math** | `math-primitives-prd.md`, `math-primitives-phase2-prd.md`, `PRD_KINDERGARTEN-MATH.md`, `PRD-KINDERGARTEN-GEOMETRY.md`, `PRD_K3_CONTENT_DENSITY.md` | `math.ts` |
| **literacy** | `PRD_LANGUAGE_ARTS_SUITE.md`, `PRD_KINDERGARTEN_PHONICS_AND_ALPHABET.md` | `literacy.ts` |
| **physics** | `physics-primitives-prd.md`, `k5-physics-primitives-prd.md` | `physics.ts` |
| **chemistry** | `chemistry-primitives-prd.md`, `chemistry-k8-prd.md` | (in science.ts or missing) |
| **biology** | `biology-primitives-prd.md` | `biology.ts` |
| **astronomy** | `space-primitives-prd.md`, `CALENDAR_PRIMITIVES_PRD.md` | `astronomy.ts` |
| **engineering** | `engineering-primitives-prd.md`, `vehicles-flight-machines-primitives-prd.md`, `living-engineering-primitives-prd.md` | `engineering.ts` |
| **social_studies** | `PRD_HISTORY_SOCIAL_STUDIES_SUITE.md` | (none — gap) |
| **economics** | `PRD_ECONOMICS_SUITE.md` | (none — gap) |
| **core** | `general-content-primitives-prd.md`, `editorial-primitives-prd.md` | `core.ts` |
| **media** | `interactive-book-prd.md` | `media.ts` |
| **assessment** | `PRD_EVAL_MODES_ROLLOUT.md`, `PRD_EVAL_MODES_LITERACY.md`, `PRD_ADVANCED_PROBABILITY.md` | `assessment.ts` |

---

## Command: `dashboard`

Full portfolio overview. This is your "state of the union" view.

### Phase 1: Inventory Scan

1. **Read all catalog files** — extract every registered primitive with domain, eval mode count, eval support flag
2. **Glob all built components** — `my-tutoring-app/src/components/lumina/primitives/**/*.tsx`
3. **Glob all generators** — `my-tutoring-app/src/components/lumina/service/*/gemini-*.ts`
4. **Read backend registry** — extract all primitives with calibrated eval modes
5. **Scan PRD directory** — list all PRDs, extract planned primitive counts (scan for `## ` headers that name primitives, or tables listing primitives)

### Phase 2: Cross-Reference

For each domain, build a status matrix:

```
Primitive → [PRD planned?] [Component built?] [Catalog registered?] [Generator exists?] [Backend calibrated?] [Eval modes?]
```

A primitive is:
- **SHIPPED** — all 5 checkmarks (or 4 if eval modes not applicable)
- **BUILT-NOT-WIRED** — component exists but missing catalog/generator/registry entries
- **PLANNED-NOT-BUILT** — in a PRD but no component
- **ORPHANED** — built but not in any PRD (may be fine — could be a utility)

### Phase 3: Present Dashboard

```markdown
## Lumina Primitive Portfolio Dashboard
> Generated: {date}

### Executive Summary

| Metric | Value |
|--------|-------|
| Total PRDs | 20+ |
| Total primitives (catalog) | ~183 |
| Total components (built) | ~200 |
| Domains with full pipeline | 9 |
| Domains PRD-only (not built) | 2-3 |
| Standards frameworks covered | CCSS, NGSS, C3, CEE |
| Grade bands covered | K-12+ |

### Domain Maturity Matrix

| Domain | PRDs | Planned | Built | Catalog | Generators | Calibrated | Maturity |
|--------|------|---------|-------|---------|------------|------------|----------|
| Math | 5 | 50+ | 44 | 50 | 51 | 45 | MATURE |
| Literacy | 2 | 30+ | 28 | 29 | 28 | 20 | STRONG |
| Engineering | 3 | 25+ | 24 | 24 | 25 | 18 | STRONG |
| Biology | 1 | 17 | 17 | 17 | 18 | 12 | STRONG |
| Astronomy | 2 | 11 | 11 | 11 | 12 | 8 | STRONG |
| Physics | 2 | 20+ | 2 | 2 | 3 | 2 | EARLY |
| Chemistry | 2 | 20+ | 13 | 0 | 0 | 0 | BLOCKED |
| Social Studies | 1 | 20 | 0 | 0 | 0 | 0 | PRD ONLY |
| Economics | 1 | 20 | 0 | 0 | 0 | 0 | PRD ONLY |
| Core | 2 | 18 | 29 | 18 | 37 | 10 | MATURE |

### Maturity Levels
- **MATURE** — 80%+ primitives shipped with eval modes and calibration
- **STRONG** — 60%+ shipped, pipeline working, filling eval mode gaps
- **EARLY** — <30% shipped, pipeline working for what exists
- **BLOCKED** — Components exist but pipeline broken (no generators/catalog)
- **PRD ONLY** — Planning complete, nothing built
- **NO PRD** — No planning document exists

### Pipeline Health Flags

List any broken links in the pipeline:
- Chemistry: 13 components BUILT but 0 generators — **BLOCKED on generator registration**
- Science catalog: 12 entries but 0 implementations — **catalog entries are ghosts**
- Assessment: 2 components, 0 generators — **missing generator wiring**
```

---

## Command: `audit [domain]`

Deep audit of a specific domain or PRD.

### Phase 1: Load PRD(s)

Read the relevant PRD file(s) for the domain. Extract every planned primitive:
- Name/ID
- Description
- Grade band
- Interaction model (what students do)
- Eval modes planned
- Standards alignment
- Dependencies on other primitives

### Phase 2: Cross-Reference Against Live State

For each planned primitive, check:

1. **Component exists?** — Glob `primitives/*/<Name>.tsx` or similar
2. **Catalog entry?** — Search domain catalog file for the ID
3. **Generator?** — Check for `gemini-<id>.ts` in the domain service folder
4. **Backend registry?** — Search `problem_type_registry.py` for the ID
5. **Eval modes wired?** — Count eval modes in catalog vs planned in PRD
6. **Eval tested?** — Check `qa/eval-reports/<id>-*.md` for reports
7. **Tester component?** — Check for `<Domain>Tester.tsx` or similar

### Phase 3: Present Audit

```markdown
## Domain Audit: {domain}

### PRD Coverage: {prd_name}

| Primitive | PRD | Component | Catalog | Generator | Registry | Eval Modes | Tested | Status |
|-----------|-----|-----------|---------|-----------|----------|------------|--------|--------|
| lever-lab | Y | Y | Y | Y | Y | 4/4 | Y | SHIPPED |
| bridge-builder | Y | Y | Y | Y | N | 0/3 | N | NEEDS CALIBRATION |
| robot-creator | Y | N | N | N | N | — | — | NOT STARTED |

### Implementation Rate
- SHIPPED: 18/24 (75%)
- PARTIALLY BUILT: 3/24 (13%)
- NOT STARTED: 3/24 (13%)

### Eval Mode Depth
| Primitive | Modes Planned | Modes Wired | Max Beta Gap | Densification Needed? |
|-----------|--------------|-------------|-------------|----------------------|
| lever-lab | 4 | 4 | 0.8 | No |
| pulley-system | 3 | 2 | 1.5 | Yes — use /lumina-densify-primitives |

### Standards Coverage
| Standard | Substandards | Covered by Primitives | Gaps |
|----------|-------------|----------------------|------|
| NGSS K-PS2 | 4 | 3 | K-PS2-1: no push/pull primitive |
| NGSS K-PS3 | 2 | 1 | K-PS3-2: no heating/cooling primitive |

### Recommendations
1. **HIGH PRIORITY:** Wire chemistry generators — 13 components sitting idle
2. **MEDIUM:** Add 3 eval modes to bridge-builder for IRT calibration
3. **LOW:** robot-creator is aspirational — defer unless curriculum demands it
```

### `--all` Flag

When `--all` is passed, run the audit for every domain and produce:
1. Per-domain audit tables (abbreviated — just the summary row)
2. Cross-domain comparison table
3. Global pipeline health flags
4. Global standards coverage gaps

---

## Command: `gaps [grade-band]`

Pedagogical gap analysis — the most strategic command. Finds where the *learning experience* has holes.

### Gap Categories

1. **Standards gaps** — A curriculum standard has no primitive that teaches it
2. **Grade band gaps** — A subject has primitives for grades 3-5 but nothing for K-2
3. **Interaction model gaps** — All primitives in a domain are observation-only (no manipulation)
4. **Eval mode gaps** — Primitive exists but can't assess (display-only, no eval modes)
5. **Difficulty progression gaps** — No smooth K→12 difficulty ladder exists
6. **Cross-domain gaps** — Science topics that need math primitives, or vice versa
7. **PRD gaps** — Subject areas with no PRD at all

### Phase 1: Scan

1. Read all PRDs — build a standards coverage map
2. Read all catalogs — build primitive→standards mapping
3. Read curriculum (if backend running) — check what curriculum expects vs what exists
4. Identify the CCSS/NGSS/C3 standards at each grade band, compare to primitives

### Phase 2: Classify Gaps

For each gap found:

```markdown
### GAP: {title}

| Field | Value |
|-------|-------|
| **Category** | Standards / Grade band / Interaction / Eval / Difficulty / Cross-domain / PRD |
| **Domain** | {domain} |
| **Grade band** | {K-2 / 3-5 / 6-8 / 9-12} |
| **Standards affected** | {list of standards} |
| **Curriculum subskills blocked** | {count, if known} |
| **Closest existing primitive** | {name} — why it doesn't fit: {reason} |
| **Proposed solution** | New primitive / Eval mode addition / PRD needed / Extend existing |
| **Effort** | SMALL (1-2 files) / MEDIUM (full primitive) / LARGE (new domain) |
| **Pedagogical impact** | HIGH / MEDIUM / LOW — {why} |
| **Next action** | `/primitive {name}` / `/add-eval-modes {name}` / `/lumina-portfolio prd {domain}` |
```

### Phase 3: Prioritization Matrix

```markdown
## Gap Prioritization

### Quadrant View (Impact vs Effort)

**HIGH IMPACT, LOW EFFORT (do first)**
- Wire chemistry generators (13 primitives unlocked, ~2 hours work)
- Add eval modes to 5 display-only biology primitives

**HIGH IMPACT, HIGH EFFORT (plan next)**
- K-2 physics primitives (PRD exists, 6 primitives needed)
- Social studies domain (PRD exists, 20 primitives, new catalog)

**LOW IMPACT, LOW EFFORT (batch these)**
- Calendar primitive eval modes
- Assessment generator registration

**LOW IMPACT, HIGH EFFORT (defer)**
- Economics domain (no curriculum authored yet)
- Advanced probability suite (niche audience)
```

### Grade Band Filter

When a grade band is specified (e.g., `gaps K-2`):
- Only show gaps relevant to that grade band
- Highlight primitives that exist for other grades but not this one
- Show standards coverage for just that grade band

---

## Command: `roadmap`

Synthesize gaps, priorities, and dependencies into an actionable build plan.

### Phase 1: Gather Context

1. Run `gaps` analysis (or use cached results from same conversation)
2. Read recent git commits to see what's been shipped recently
3. Check EVAL_TRACKER.md for in-progress work
4. Check PRIMITIVE_GAPS.md if it exists

### Phase 2: Build Roadmap

Organize into waves based on:
- **Dependency order** — Can't build eval modes without components; can't calibrate without eval modes
- **Pedagogical impact** — Standards coverage, curriculum unblocking
- **Effort-to-impact ratio** — Quick wins first
- **Domain balance** — Don't over-invest in one domain while others starve

```markdown
## Lumina Primitive Roadmap
> Generated: {date}

### Current State
- {N} primitives shipped across {M} domains
- {X} primitives blocked (built but not wired)
- {Y} primitives planned (PRD only)
- Strongest domains: Math, Literacy, Engineering
- Weakest domains: Chemistry (blocked), Physics (early), Social Studies (PRD only)

### Wave 1: Unblock & Wire (immediate — hours)
**Theme:** Fix broken pipelines, unlock existing work

| # | Task | Domain | Primitives Unlocked | Effort | Action |
|---|------|--------|--------------------:|--------|--------|
| 1 | Wire chemistry generators | chemistry | 13 | SMALL | Create generators, add catalog entries |
| 2 | Register assessment generators | assessment | 2 | SMALL | Wire existing components |
| 3 | Clean science catalog ghosts | science | 0 (remove 12 phantoms) | SMALL | Remove or implement |

### Wave 2: Deepen Coverage (this week — days)
**Theme:** Add eval modes and calibration to existing primitives

| # | Task | Domain | Impact | Effort | Action |
|---|------|--------|--------|--------|--------|
| 1 | Eval modes for biology display primitives | biology | 5 subskills unblocked | MEDIUM | `/add-eval-modes` |
| 2 | Densify math eval mode ladders | math | smoother IRT curves | MEDIUM | `/lumina-densify-primitives` |
| 3 | Calibrate engineering primitives | engineering | 6 uncalibrated | SMALL | Backend registry |

### Wave 3: Expand (this sprint — weeks)
**Theme:** New primitives for standards coverage gaps

| # | Task | Domain | Standards | Effort | Action |
|---|------|--------|-----------|--------|--------|
| 1 | K-5 physics primitives | physics | NGSS K-PS2, K-PS3 | LARGE | `/primitive` x6 |
| 2 | History/social studies foundations | social_studies | C3 D1-D4 | LARGE | Create catalog + `/primitive` x5 |

### Wave 4: Horizon (next month)
**Theme:** Full subject buildout for new domains

| # | Task | Notes |
|---|------|-------|
| 1 | Economics domain buildout | PRD exists, 20 primitives planned |
| 2 | Advanced probability suite | Exam P/STAM audience |
| 3 | Literacy phase 2 (fluency) | Reading fluency primitives |

### Dependencies
```
Wave 1 (unblock) ─┬─→ Wave 2 (deepen) ──→ Wave 3 (expand)
                   └─→ Wave 3 can start in parallel for domains not in Wave 1/2
Wave 4 depends on: curriculum authoring for new subjects
```
```

---

## Command: `prd [domain]`

Guided PRD development workflow. For creating new PRDs or enhancing existing ones.

### For New PRDs

1. **Check existing PRDs** — Read the docs folder. Is there already a PRD for this domain? If partial, enhance rather than replace.

2. **Gather inputs from user:**
   - Target audience / grade band
   - Standards framework (CCSS, NGSS, C3, CEE, or custom)
   - Learning goals (what should students be able to DO after?)
   - Interaction philosophy (manipulative? observation? simulation? construction?)
   - How many primitives are envisioned?

3. **Reference PRD template** — Use `math-primitives-prd.md` (most mature) as structural reference:
   - Problem/Gap Analysis
   - Design Principles (domain-specific)
   - Primitive Specifications (one per planned primitive)
     - Name, ID, description
     - Grade band progression
     - Interaction model
     - Eval modes (with difficulty tiers)
     - Gemini generation constraints
     - Standards alignment
   - Implementation Roadmap

4. **Validate against catalog** — Before planning new primitives, check if existing ones already cover the concept:
   - Read ALL catalog files (not just the target domain)
   - Flag overlaps: "This concept is already covered by {existing_primitive} in {domain}"
   - Propose extensions to existing primitives before creating new ones

5. **Write the PRD** to `my-tutoring-app/src/components/lumina/docs/{domain}-primitives-prd.md`

6. **Cross-reference:** After writing, run `audit {domain}` to show the gap between the new PRD and current state.

### For Enhancing Existing PRDs

1. **Read the existing PRD** — understand what's there
2. **Run `audit {domain}`** — identify what's built vs planned
3. **Identify enhancement areas:**
   - Missing grade bands (PRD covers 3-5 but not K-2)
   - Missing eval modes in primitive specs
   - Standards not covered
   - New interaction models enabled by recent platform improvements
4. **Present enhancement plan to user**
5. **Update the PRD** — add new sections, update status tables
6. **Re-run audit** to show updated gap picture

---

## Command: `health [domain]`

Technical health check for a domain's primitive pipeline.

### Checks

1. **Generator registration:** Every catalog entry has a matching generator
2. **Backend registry:** Every evaluable primitive has calibrated beta priors
3. **Type safety:** Run `npx tsc --noEmit` and filter errors to the domain
4. **Eval mode consistency:** Catalog betas match backend registry betas
5. **Eval mode ordering:** Betas are monotonically increasing within each primitive
6. **Tester coverage:** Every visual primitive has a tester entry
7. **Orphaned components:** Built components not in the catalog

### Output

```markdown
## Health Check: {domain}

| Check | Status | Issues |
|-------|--------|--------|
| Generator registration | WARN | 2 catalog entries missing generators |
| Backend calibration | FAIL | 5 primitives not in problem_type_registry |
| Type safety | PASS | No domain-specific type errors |
| Eval mode consistency | WARN | 1 beta mismatch (catalog: 3.5, registry: 3.0) |
| Beta ordering | PASS | All monotonic |
| Tester coverage | PASS | All 24 primitives in tester |
| Orphaned components | INFO | 1 component not in catalog (legacy?) |

### Issues Detail
...
```

---

## Command: `compare [domain1] [domain2]`

Side-by-side maturity comparison.

```markdown
## Domain Comparison: Math vs Physics

| Dimension | Math | Physics |
|-----------|------|---------|
| PRDs | 5 | 2 |
| Primitives planned | 50+ | 20+ |
| Primitives shipped | 44 | 2 |
| Implementation rate | 88% | 10% |
| Eval modes (total) | 120+ | 4 |
| Avg modes per primitive | 2.7 | 2.0 |
| Max beta gap | 1.0 | 1.5 |
| Backend calibrated | 45 | 2 |
| Standards covered | CCSS K-12 | NGSS K-PS2 only |
| Grade bands | K-12+ | MS-AP (K-5 planned) |
| Maturity | MATURE | EARLY |

### What Math has that Physics needs:
1. Multi-phase primitive hooks (Math has 5 primitives using shared hooks)
2. Dense eval mode ladders (avg 2.7 modes vs 2.0)
3. K-2 grade band coverage
4. Tutoring scaffold integration

### Fastest path to bring Physics to STRONG:
1. Build 6 K-5 physics primitives from existing PRD
2. Add eval modes to existing 2 physics primitives
3. Register backend calibration for all
```

---

## Strategic Principles for Recommendations

When prioritizing what to build, apply these in order:

1. **Unblock before build** — Wiring 13 existing chemistry components is more impactful than building 1 new primitive
2. **Eval modes before new primitives** — A primitive without eval modes can't participate in adaptive learning
3. **Standards coverage before depth** — Cover all K-2 NGSS before adding advanced AP physics
4. **Curriculum-demanded first** — If a curriculum subskill references a primitive that doesn't exist, that's a higher priority than a PRD-only plan
5. **Quick wins compound** — 5 small wiring tasks > 1 ambitious new primitive (in the short term)
6. **Domain balance matters** — A platform with only math primitives isn't a learning platform

---

## Anti-Patterns (DO NOT)

1. **DO NOT recommend building primitives that already exist.** Always check ALL catalog files and glob for components before proposing new work.

2. **DO NOT confuse "planned in PRD" with "needed by curriculum."** PRDs are aspirational. Curriculum demand is real. Prioritize curriculum-blocked primitives over PRD completionism.

3. **DO NOT count phantom catalog entries as "built."** A catalog entry without a generator and component is a ghost. Flag it, don't count it.

4. **DO NOT recommend new PRDs when existing PRDs have < 50% implementation.** Finish what's started before planning more. Exception: if curriculum urgently needs a new domain.

5. **DO NOT make roadmap recommendations without reading the actual catalog and PRDs.** Every recommendation must be grounded in what you read, not what you assume.

6. **DO NOT present gaps without proposed solutions.** Every gap should have a "next action" that references a specific skill (`/primitive`, `/add-eval-modes`, `/lumina-densify-primitives`, `/lumina-portfolio prd`).

7. **DO NOT ignore the living simulation pattern.** Physics, chemistry, and engineering primitives should prioritize canvas-based physics simulations over static SVG/label-based displays. Reference `memory/feedback_living-simulation-pattern.md`.

---

## Handoff to Other Skills

This skill is the strategic layer. It identifies what to do. Other skills do the doing:

| Decision | Hand Off To |
|----------|-------------|
| Need a new primitive | `/primitive {name}` |
| Need eval modes on existing primitive | `/add-eval-modes {name}` |
| Need to densify eval mode ladder | `/lumina-densify-primitives {name}` |
| Need to test a primitive | `/eval-test {name}` |
| Need to fix eval test failures | `/eval-fix {name}` |
| Need to audit curriculum↔primitive alignment | `/curriculum-lumina-audit audit {subject}` |
| Need to author curriculum for new domain | `/curriculum-author` |
| Need to check curriculum graph structure | `/curriculum-graph diagnose` |
| Need to simulate student journeys | `/pulse-agent` |

---

## Checklist

- [ ] Parsed command and arguments
- [ ] For `dashboard`: scanned all catalogs, components, generators, registry, PRDs — presented full matrix
- [ ] For `audit`: read target PRD(s), cross-referenced against live catalog/components/generators/registry
- [ ] For `gaps`: identified gaps across all 7 categories, classified each, built prioritization matrix
- [ ] For `roadmap`: synthesized gaps into waves with dependencies and effort estimates
- [ ] For `prd`: gathered user inputs, referenced template, validated against existing catalog, wrote/updated PRD
- [ ] For `health`: ran all 7 technical checks, reported issues with specifics
- [ ] For `compare`: built side-by-side matrix with actionable recommendations
- [ ] All recommendations grounded in actual file reads (not assumptions)
- [ ] Every gap has a proposed next action referencing a specific skill
- [ ] No phantom primitives counted as "built"
- [ ] No duplicate primitives recommended (checked all domains)
