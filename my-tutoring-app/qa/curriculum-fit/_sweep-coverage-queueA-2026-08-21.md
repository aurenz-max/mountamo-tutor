# Curriculum-Fit Sweep — Coverage Queue A — 2026-08-21

**Gate for `/add-eval-modes` on `qa/coverage/BACKLOG.md` §A.** Ran the live
`CurriculumRetrievalMatcher` (real Firestore curriculum + real Gemini embeddings — the
same scoped-retrieval path `/api/problems/submit` uses) for every queue-A primitive
against every published SCIENCE grade. Raw per-grade + top-5 data:
`_sweep-coverage-queueA-2026-08-21.json`.

## Verdict — the gate is CLEAR

**Every probeable queue-A primitive has a curriculum home. Zero abstain-everywhere, zero
curriculum gap, zero scoping failure.** Nothing in queue A needs curriculum authored or a
catalog description rewritten before it can be laddered.

| Bucket | n | Outcome |
|---|---:|---|
| engineering | 17 | MATCH — all 17, best cosine 0.71–0.88 |
| biology | 12 | MATCH — all 12 |
| astronomy | 6 | MATCH — all 6 |
| physics | 1 | MATCH (`motion-diagram`) |
| **probeable total** | **36** | **36 MATCH** |
| core (3) + media (1) | 4 | **N/A — cross-cutting domain, no curriculum subject** |

*(`habitat-diorama` was probed as well and matches at 4 of 5 grades — see roster
correction #1; that is the 37th probe in the JSON.)*

### Three corrections to the queue's own numbers

1. **Queue A is 40, not 41.** `habitat-diorama` gained `evalModes` when it shipped its DI
   port (#116) and no longer qualifies. Biology is **12**, not 13. (The pull text said
   "16 biology" — that was never the queue's number either.)
2. **core + media (4) cannot be gated by this skill.** `comparison-panel`, `fast-fact`,
   `feature-exhibit`, `image-panel` sit in domains with no curriculum subject
   (`_DOMAIN_TO_SUBJECT` deliberately omits core/media/assessment/calendar). They declare
   `supportsEvaluation: true`, so they are *not* §C material either — they need a **demand
   ruling**, not a fit probe. **36 are cleared by the probe; USER RULING 08-21 — the 4 ungateable ones get ladders anyway.**
3. **SCIENCE publishes K, 1, 2, 3, 4 — there is no Grade 5.** Every science ladder is
   bounded K–4 by construction. This is the known G5 Science gap, now measured from the
   retrieval side.

---

## ⚠️ The finding that changes how §A is executed

**Grade 4 `SCI001-04 "Electric Circuits"` is a semantic attractor. 17 of the 37 primitives
rank it top-1 at G4, and 6 of them clear MATCH there** — `engine-explorer`,
`gear-train-builder`, `lever-lab`, `pulley-system-builder`, `wheel-axle-explorer`,
`orbit-mechanics-lab`.

A unit that a pulley builder, a telescope simulator, a DNA explorer and a moon-phases lab
all land on is not a home for any of them. The cause is in the subskill wording — it is
generic systems language, not circuit language:

> *"**Identify the components** of a simple circuit and **describe the role of each part**"*
> *"**Trace the transformation** of electrical energy into other forms like light, heat, or **motion**"*

Any primitive whose description says *parts*, *components*, *energy*, or *motion* scores
against it.

**Binding consequence: do not anchor a queue-A eval-mode ladder at Grade 4.** The anchor
tables below already exclude it. `evolution-timeline` is the sole legitimate G4 home
(`SCI004-06 Changing Surface` / `SCI004-03 Rock Layers & Fossils` — deep time, 4/5).

*Owner note: this is also a curriculum-quality signal. The fix is on the curriculum side
(sharpen SCI001-04's subskill wording so it reads as circuits), not the catalog side —
queue it for `/curriculum-author`, not for this campaign.*

---

## Anchors for `/add-eval-modes`

The grade + skill each ladder should be written against. Chosen as the highest-coherence
MATCH whose unit is actually the primitive's concept, G4-Electric-Circuits excluded.

### Engineering (17)

| Primitive | Anchor | Skill | cos | coh |
|---|---|---|---:|---:|
| `dump-truck-loader` | G1 | SCI005-02 Construction Machines | 0.873 | 5/5 |
| `foundation-builder` | G1 | SCI005-03 Building Strong Structures | 0.873 | 5/5 |
| `ramp-lab` | G1 | SCI005-01 Simple Machines | 0.867 | 5/5 |
| `excavator-arm-simulator` | G1 | SCI005-02 Construction Machines | 0.863 | 5/5 |
| `tower-stacker` | G1 | SCI005-03 Building Strong Structures | 0.859 | 5/5 |
| `gear-train-builder` | G1 | SCI005-04 Planning a Build | 0.852 | 3/5 |
| `pulley-system-builder` | G1 | SCI005-01 Simple Machines | 0.845 | 5/5 |
| `lever-lab` | G1 | SCI005-01 Simple Machines | 0.841 | 5/5 |
| `wheel-axle-explorer` | G1 | SCI005-01 Simple Machines | 0.838 | 5/5 |
| `bridge-builder` | G1 | SCI005-03 Building Strong Structures | 0.820 | 5/5 |
| `shape-strength-tester` | G1 | SCI005-03 Building Strong Structures | 0.816 | 5/5 |
| `vehicle-design-studio` | **K** | SCI004-01 Engineering Design Process | 0.771 | 5/5 |
| `blueprint-canvas` | **K** | SCI004-01 Engineering Design Process | 0.752 | 5/5 |
| `paper-airplane-designer` | **K** | SCI004-01 Engineering Design Process | 0.735 | 5/5 |
| `engine-explorer` | G3 | SCI001-04 Patterns in Motion | 0.752 | 5/5 |
| `airfoil-lab` | G3 | SCI001-04 Patterns in Motion | 0.736 | 4/5 |
| `propulsion-timeline` | G3 | SCI001-04 Patterns in Motion | 0.764 | 3/5 · soft |

**The densest block in the whole campaign: 11 of these 17 anchor in `SCI005` at Grade 1**
(Simple Machines / Construction Machines / Building Strong Structures / Planning a Build),
at 0.82–0.87 with 5/5 coherence. That is not luck — the curriculum was authored
Lumina-first, and several G1 subskills *name these primitives in their own text*:

> *"Students experiment with **a gear train** to watch how gears turn together"*
> *"Students operate a **virtual pulley system** to hoist a flag up a flagpole"*
> *"Students **assemble a bridge** using beams and supports to span a gap"*
> *"Students press on different **straw shapes** — triangles, squares, and pentagons"*

**A whole authored G1 unit currently has zero difficulty discrimination** — the strongest
demand signal in queue A. ⚠️ But six of those eleven have no assessable moment at all; see
the superseded-pilot note below before pulling one.

### Biology (12)

| Primitive | Anchor | Skill | cos | coh |
|---|---|---|---:|---:|
| `classification-sorter` | G1 | SCI002-10 Living Things Classification | 0.876 | 5/5 |
| `adaptation-investigator` | G1 | SCI002-03 Structures for Survival | 0.851 | 5/5 |
| `food-web-builder` | G3 | SCI003-01 Food Chains | 0.849 | 5/5 |
| `life-cycle-sequencer` | G3 | SCI002-01 Life Cycle Stages | 0.836 | 5/5 |
| `bio-compare-contrast` | G1 | SCI002-06 Parent-Offspring Traits | 0.813 | 5/5 |
| `inheritance-lab` | G1 | SCI002-06 Parent-Offspring Traits | 0.794 | 5/5 |
| `evolution-timeline` | **G4** | SCI004-06 Changing Surface | 0.776 | 4/5 |
| `energy-cycle-engine` | G2 | SCI002-01 Needs of Living Things | 0.776 | 3/5 · soft |
| `bio-process-animator` | G3 | SCI002-01 Life Cycle Stages | 0.770 | 4/5 |
| `microscope-viewer` | G1 | SCI002-10 Living Things Classification | 0.752 | 5/5 · soft |
| `protein-folder` | G3 | SCI002-04 Inherited vs Learned | 0.736 | 5/5 · **soft** |
| `dna-explorer` | G3 | SCI002-04 Inherited vs Learned | 0.724 | 4/5 · **soft** |

### Astronomy (6) + physics (1)

| Primitive | Anchor | Skill | cos | coh |
|---|---|---|---:|---:|
| `moon-phases-lab` | G1 | SCI003-03 Moon Patterns | 0.820 | 5/5 |
| `telescope-simulator` | G1 | SCI003-02 Day and Night | 0.816 | 5/5 |
| `motion-diagram` | G3 | SCI001-04 Patterns in Motion | 0.795 | 5/5 |
| `scale-comparator` | K | SCI003-03 Space Systems | 0.785 | 5/5 |
| `orbit-mechanics-lab` | G3 | SCI001-04 Patterns in Motion | 0.774 | 5/5 |
| `mission-planner` | K | SCI003-03 Space Systems | 0.759 | 5/5 |
| `rocket-builder` | G1 | SCI005-03 Building Strong Structures | 0.745 | 3/5 · soft |

---

## Diagnosis: the six SOFT homes

These clear the live MATCH rule, so they pass the gate — but the top-1 is a **nearest
neighbour in a thin neighbourhood**, not the primitive's actual concept. The K–4
curriculum simply has no skill for molecular biology, rocketry, microscopy or transport
history.

| Primitive | What actually matched | Why it is soft | How to ladder it |
|---|---|---|---|
| `protein-folder` | *classify characteristics as inherited or learned* | no molecular skill exists K–4; the match is "traits" adjacency | ladder the **observable** (which chain folds, which property drives it), never "protein structure" as the skill |
| `dna-explorer` | *inherited vs learned* / *parent-offspring traits* | thin — its #4 neighbour at G4 was **Magnets and Electricity** | ladder **base-pairing + trait inheritance**; DNA is the medium, heredity is the skill |
| `microscope-viewer` | *sort characteristics into the correct group bin* | matched the **sorting shape**, not microscopy | ladder **classification from observed structure**; the scope is the medium |
| `rocket-builder` | *stack blocks to build the tallest tower* | matched "assemble + test"; no thrust/propulsion skill exists | ladder **structure + balance**, or accept K Space Systems |
| `propulsion-timeline` | *measure distances travelled over equal time* | matched the timeline shape; its #2 was *Fossils and Past Life* | ladder **chronological ordering**, not propulsion physics |
| `energy-cycle-engine` | *needs of living things* | photosynthesis/respiration coupling has no K–4 home | ladder **inputs → outputs of a living system** |

**Also spurious, though the primitive passes overall** — ignore these grades when
laddering: `airfoil-lab` @ G1 → *Vibrations and Sound*; `vehicle-design-studio` @ G1 →
*gear train*; `evolution-timeline` @ K → *natural resources* and @ G1 → *Living Things
Classification*.

## Five content-agnostic shells

`adaptation-investigator`, `bio-compare-contrast` and `food-web-builder` MATCH at **all
five** published grades; `blueprint-canvas` and `bio-process-animator` at four. Their
difficulty does not live in the grade — it lives in the content they are handed. Their
ladders must be written as **task identities**, not grade bands
(`feedback_structural-difficulty-not-numeric`).

## Still gated downstream (not by this skill)

Four biology primitives are curriculum-cleared but carry open answer-leak rows in
`qa/science-depth/BACKLOG.md` — **fix the leak before adding modes**, per queue A's own
warning: `dna-explorer` (DNA-1/DNA-2), `classification-sorter` (CS-1),
`bio-process-animator` (PA-1), `life-cycle-sequencer` (LCS-1).

## Recommended pilot — ⚠️ SUPERSEDED SAME DAY, read this before using the tables above

This report originally nominated **`ramp-lab`** @ G1 `SCI005-01` (0.867, 5/5) — the
highest-confidence home in the sweep. **`/add-eval-modes` then found it has no assessable
moment**: 1172 lines with zero occurrences of challenge / answer / correct / submit. Six of
the eleven SCI005 primitives are the same.

**The limit is in the method, not the run.** Curriculum-fit embeds the catalog description
to answer *"does a home exist?"* — and an exploration sandbox describes itself exactly like
an assessable primitive. **A MATCH is not an assessability signal.** Grep the component for
a solve surface before nominating anything off this table; the triage for all 17
engineering entries is in `qa/coverage/BACKLOG.md` §A.

**Pilot actually shipped: `dump-truck-loader`** @ G1 `SCI005-02 Construction Machines`
(0.873, 5/5 — the highest cosine here) — same anchor family, and it already had a
code-owned job pool to ladder.
`qa/eval-reports/dump-truck-loader-evalmodes-2026-08-21.md`.

## Method

- Engine: `backend/scripts/curriculum_fit_sweep.py` (whole-domain batch driver — one
  matcher, one embedding cache) for engineering / biology / astronomy / physics, plus a
  scratch top-5 driver for the 14 borderline reads.
- Descriptions embedded **verbatim** from `service/manifest/catalog/*.ts` — byte-identical
  to the live submit path. Nothing was hand-fed to force a match.
- The domain sweeps covered all 57 primitives in those four domains, not just queue A;
  the committed JSON carries the queue-A rows plus the borderline top-5 detail.
