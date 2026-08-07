# Workstreams — Portfolio Index

The single orientation surface for all Lumina workstreams. Any session answering
"what's next?" starts HERE, not in memory or individual queues.

**Rules:** WIP limit = 2 ACTIVE streams + 1 DELEGATED lane. Everything else is
PARKED with a trusted-as-of date — act on a parked stream's queue only after
re-verifying its claims against EVAL_TRACKER + git. Maintained by `/pm` (Claude)
or `$pm` (Codex)
(reconcile → update → propose); every session that closes work updates the owning
queue AND this file's "last touched" in the same slice.

| State | Meaning |
|---|---|
| ACTIVE | being worked now; queue is trusted |
| DELEGATED | handed to another session/agent; check its report before touching |
| PARKED | intentionally idle; queue trusted only as of the noted date |
| BLOCKED | waiting on a named dependency |

## Current snapshot — reconciled 2026-08-06 (**RE-PRIORITIZATION — the build pivot died on its own fit check**)

> **`/pm` 2026-08-06 (latest) — the user's read: *"feels like we don't have high impact work
> other than DI… feels like we were going through `/reader-fit` but then stopped, this may be
> higher value?"* Both halves tested against ground truth. The first is right for a reason
> nobody had recorded; the second is right about the VALUE and wrong about the CAUSE.**
>
> **1. The build stream `/pm` opened yesterday is DEAD — killed by its own fit check.**
> `sight-word-trainer` (GAP-008) was pulled as the new ACTIVE stream; `/curriculum-fit`, run
> pre-birth per the LA lane's standing *fit-before-birth* rule, returned **BIRTH → EXTEND, do
> not build.** `fast-fact` already occupies the space and names sight words in its catalog
> description verbatim; 3 of the 4 proposed modes already ship; and GAP-008's central mechanic
> (1s/0.5s/0.25s flash tiers — *"speed is the entire point"*) **violates a standing ruling**
> ([[feedback_no-timer-on-fact-fluency]]) that `fast-fact` already implements correctly. Its
> honest conversion is `/add-eval-modes` on `fast-fact` — which is **FF-4**, already open.
> GAP-008 marked **CLOSED-BY-EXTEND**. Report `qa/curriculum-fit/sight-word-trainer-2026-08-06.md`.
> **Second fit-before-birth save in two days** (the `spatial-scene` catch was the first) — the
> rule is paying for itself, but it also means the portfolio has now spent two consecutive
> `/pm` runs opening build streams that dissolved on contact with the catalog.
>
> **2. `/reader-fit` did not stop — it DRAINED, and its own queue says so.** Items 14a–14m are
> all closed (last: 14l, 2026-08-05), and `qa/reader-fit/BACKLOG.md` states outright: *"This
> queue has no EMERGING census pull left — the next item here is a fresh priority call, not a
> carried-over pointer."* Nothing was abandoned mid-stream. **But the user's instinct about its
> VALUE is correct and worth acting on** — reader-fit produced the highest-severity findings of
> the last month (rule-#1 answer leaks, bands that were structurally unreachable, hardcoded caps
> silently overriding lesson intent), none of which tsc, unit tests, or contracts can see.
>
> **3. ⚠️ `/pm` GOT THIS WRONG AND THE USER CAUGHT IT — recorded because the trap is
> reusable.** The first version of this snapshot argued reader-fit was "worked out" at
> PRE/EMERGING and that resuming it meant pulling its weakest band. The user's push-back:
> *"we have over 100 primitives — explaining to me we did 14/14 is missing so many other
> K-selectable primitives that aren't designed for non-readers. If you say only 14
> primitives are relevant to K, this is a lack of scope."* **Correct, and the error is
> precise: `/pm` read "the queue drained" as "the band is covered."** Those are different
> claims. The reader-fit queue was seeded from **demand SAMPLES** — 6 K subskills
> (2026-07-14), 6 G1 subskills (2026-08-01), then whatever routed in those 12 traces. A
> primitive that never surfaced in the sample was never audited, however selectable it is
> at K. **Sampling demand ≠ covering supply.**
>
> **Coverage measured against the live catalog this run — the number that was missing:**
> **196** catalog entries · **107 K-selectable** (text permits K, no `BAND FLOOR` /
> "Grade 1+ ONLY" / "not appropriate for younger grades") · **~38** with any reader-fit
> evidence → **≈69 K-selectable primitives never reader-fit audited.** The unaudited set
> holds near-certain PRE failures, not just unknowns: `stoichiometry-lab`,
> `gas-laws-simulator`, `orbit-mechanics-lab`, `telescope-simulator`, `blueprint-canvas`,
> `digital-skills-sim`, `two-way-table`, `story-planner`, `machine-profile` are all
> routable into a Kindergarten lesson today. Caveat kept honest: the 107 is a text proxy
> over description + constraints and over-counts incidental K-inclusive ranges, so triage
> verifies per primitive — but discount it heavily and the gap is still dozens.
>
> **Re-seed shape = a SUPPLY-SIDE sweep, not another demand census:** enumerate the 107 →
> subtract the ~38 → triage the ~69 by risk (text-primary interaction, no read-aloud
> `aiDirectives`, no component band gate, adult vocabulary in `constraints`) → `/reader-fit
> [--fix]` highest-risk first. The cheapest class of fix is a catalog **band floor** (the
> `word-sorter` `match_pairs` pattern) — no component work, and it removes the failure by
> making the primitive unselectable at K. The G2/DEVELOPING census stays genuinely
> never-run and legitimately queued, but BELOW this.
>
> **4. The transferable part of reader-fit — and where it has never been pointed.** What made
> it valuable was not the band rubric; it was that reader-fit was the only **demand-side census
> driven through the REAL pipeline** (published objective → manifest → generator → judged
> output). That method has been run on **K and G1 across LA / Math / SS**. It has **never been
> run on Science** — and Science is exactly where this run found two independent problems
> stacked on the same primitives:
>
> - **PEDAGOGY (CLAUDE.md #1) — a measured, month-old, un-queued answer leak.** `/oracle-test`
>   coverage of biology started 2026-07-09, ran **one** primitive, and stopped. That pilot
>   measured **6 of 10 real generations leaking the answer** in `dna-explorer` (the build
>   challenge's `givenStrand` equals the displayed `templateStrand`). It lived only in a memory
>   note saying "route to `/eval-fix`" — `/pm` verified this run that there is **no tracker row
>   and no fix in the tree**: `gemini-dna-explorer.ts` still has no constraint separating the
>   two. Now filed **DNA-1**. The other **13 evaluable biology primitives have never been
>   oracle- or eval-tested at all** (**BIO-1**). Expected yield is high on precedent: both leak
>   investigations that ran to completion — FF-1 (`fast-fact`) and DNA-1 — found the leak was
>   **domain-wide, not local**; `fast-fact` measured Math 6 / LA 24 / Science 15 violations once
>   someone actually looked.
> - **DENSITY (CLAUDE.md #3) — ≈42 primitives invisible to the IRT selector.** Re-measured
>   properly this run as `supportsEvaluation: true` vs `evalModes:` per catalog file (the first
>   pass counted total primitives and overstated it): **biology 14/0 — the entire domain**,
>   engineering 23/5, astronomy 10/3, core 10/7. Math (61/61), literacy (32/31), chemistry
>   (14/14), di (4/4) are clean. Filed **BIO-2**. **Demand caveat, measured not guessed:**
>   biology splits about half elementary (organism-card, classification-sorter,
>   life-cycle-sequencer, habitat-diorama, bio-compare-contrast, adaptation-investigator,
>   body-system-explorer, bio-process-animator) and half secondary-only (protein-folder 7-8,
>   inheritance-lab 6-8, energy-cycle-engine 5-8, evolution-timeline 4-8, cell-builder 4-8,
>   microscope-viewer 3-8) — so run a demand check before committing the domain.
>
> **These two share the same generator per primitive, so they are one slice, not two.**
>
> **RECOMMENDATION REVISED after the §3 correction — reader-fit supply-side sweep takes the
> ACTIVE slot; Science depth drops to second.** With the real coverage number in hand the
> ranking inverts, on three grounds: **(a) size** — ≈69 unaudited K-selectable primitives vs
> ≈42 at L0; **(b) priority** — a non-reader who cannot start is CLAUDE.md #1 (pedagogy),
> while an unrouteable primitive is #3 (density: it still teaches, it just isn't
> adaptively selected); **(c) severity** — the L0 failure mode is *sub-optimal routing*,
> the reader-fit failure mode is *a Kindergartener handed `stoichiometry-lab`*. The user's
> original instinct ("we were going through `/reader-fit`… this may be higher value") was
> right, and `/pm`'s first answer talked them out of it on a bad premise.
> **Science depth (DNA-1 / BIO-1 / BIO-2) stays fully queued and un-deleted** — the
> dna-explorer leak is measured, month-old and un-fixed, so it should ride as the
> opportunistic +1 or take the slot the moment the sweep's triage is authored.
>
> **5. DI is genuinely in progress and stays ACTIVE — the parking note below is superseded.**
> `3986f77` shipped item 10 (`counting_next` to 120, user-ruled build-ahead) plus the DI-120-1
> barge-bar floor, and an untracked `diShapesScript.ts` shows a new pack in flight. The
> "PARKED to make room" decision in the prior snapshot was made before that work landed.
> **COMPLETED same evening — both DI development slices are SHIPPED (the in-flight pack
> landed as `cabb3f0`).** The user's authoring call ("DI shapes… and the primitive to 120,
> we can move forward directly") became two committed slices:
> **(a) item 10 BUILT** — code-owned `numberWordFor` 0..120, counting-windowed pool
> (decade transitions + near-ceiling window + teen anchors, never rote-from-zero),
> per-type benched ceilings (facts stay ≤20 by construction), teen/decade + compound-
> completeness judging clauses, 1000ms compound close; gates 96/96 focused, full Vitest
> 1778/1778, **real-pipeline probes 5/5** (census reaches 119; within-5/10 controls
> unchanged; subtraction ≤20 under a 120 ask). **DI-120-1 FIXED** in the same slice
> (`MIN_BARGE_BAR 0.03`; design question settled AGAINST cap-skipping — DI-1 doctrine,
> the channel closed where the turn opens). Report
> `qa/tutor-reports/di-math-facts-item10-2026-08-06.md`.
> **(b) di-shapes L0 BORN (`cabb3f0`, pack #5)** — DISTAR shape naming ("this shape is a
> triangle — what shape is this?"), SVG stage at generator-stamped rotation, Fork A
> 9-shape menu, geometry-as-rule-#1-guard (rectangle ≥1.6:1 / oval non-circular),
> "diamond" judged alternate of rhombus, full registration incl. β + `di-shapes →
> MATHEMATICS`; bench `Shapes` probe set wired. Gates: DI sweep 304/304, full Vitest
> **1791/1791**, typecheck:lumina 0, py_compile clean, **real-Gemini probes 3/3**.
> Birth cert `qa/eval-reports/di-shapes-birth.md`; queue row = DI BACKLOG item 14.
> **Human gate = ONE mic session: #63 re-run (now an ACCEPTANCE drive on the fixed bar,
> unblocked) + NEW #72 (di-shapes L0 live loop + Shapes bench stress).** The DI lane's
> "no unblocked top item / author with the user" state is RESOLVED — authored, built,
> shipped; next lane pulls after the sitting = CTX-1 (item 13, the tutor-quality top)
> and the di-shapes ladder (curriculum-fit probe → L1 count_sides).
>
> **6. Ship hygiene — `addition-subtraction-scene` item-12 is STILL uncommitted** (4 files,
> browser-verified with a 10-check real-Chrome run, no commit) and now carries a modified
> contract + reader-fit test alongside. It is a clean standalone slice; ship it before starting
> anything new. **STALE as of the 08-06 sweep session — `git status` shows a clean tree apart
> from that session's own files; item-12 landed in `56b5dda`.**

## EXECUTED 2026-08-07 — 15A entered at S2; **the BAND-FLOOR strategy was OVERTURNED by user ruling**

> Lane: **reader-fit supply-side sweep**, still ACTIVE. Queue of record
> `qa/reader-fit/BACKLOG.md` item **15A**. Entered from
> `qa/HANDOFF-reader-fit-2026-08-07.md` (written after 15B closed 8/8).
>
> **⚠️ STRATEGY CHANGE — this is the durable outcome of the session, bigger than the slice.**
> 15A's stated theory was *"these primitives cannot serve K by design, so the fix is a catalog
> BAND FLOOR, no component work"*, with S1 `telescope-simulator` as the shipped precedent.
> Mid-slice the user ruled: *"i dont like band floor method, like if lumina routes to a certain
> primitive, its okay to use it and we should make it age friendly?"* **A floor removes a K
> failure by removing the primitive — it shrinks supply at exactly the band with the least
> content** (CLAUDE.md priority #3: the adaptive engine only works when there is enough content
> to route through). **WRONG-BAND is now a last resort**, legitimate only when the core act
> cannot exist at the band at all AND another primitive already covers the objective.
> Recorded as [[feedback_make-age-friendly-not-band-floor]]; BACKLOG 15A rewritten; **S1's
> Grade-2 floor is now a REVISIT CANDIDATE, not a precedent.**
>
> The ruling was corroborated live, not just accepted: a real `topic-trace` on *"Things that go
> around and around in space"* @ K **selected `orbit-mechanics-lab`**, so a floor would have
> deleted a card the curator actively wanted.
>
> **S2 `orbit-mechanics-lab` CLOSED — READY at PRE.** Verdict **SCAFFOLD-GAP +
> PRIMITIVE-GAP**, not WRONG-BAND. Report `qa/reader-fit/orbit-mechanics-lab-PRE-2026-08-07.md`.
> Four defects: prose grade (`:251`); a **second** bug that survives a correct resolver —
> `gradeLevel >= '3'` is TRUE for `'K'`, so burns/field-lines stayed on at K (a grep for the
> resolver finds only the first); the resolved rung was **never stamped onto the output**, so
> every new gate would have been dead on arrival (the S14 shape); and the missing channel
> (no catalog block, no `useLuminaAI`). Both numeric sliders (kN, degrees) replaced at K-1 by
> **three tappable pictures**, one tap sets thrust+angle and flies.
>
> **Correction to the handoff's own prediction, worth carrying:** it expected the prose-grade
> defect to bite at K. **It did not** — the K happy path was already correct. It bit at **G1**
> (*"Rocket to Orbit! - **Grade 3** Orbit Mechanics Lab"* with the full adult instrument) and on
> the degrade path. **A K-only probe would have passed this generator clean. Probe the
> neighbouring grade too.**
>
> Also found: **`showOrbitPath` was declared, generated at every grade, and read by NOBODY** —
> and it is the catalog's entire K rung (*"showOrbitPath only"*). Now implemented.
> `showApogeePerigee` was equally dead. Physics extracted to a pure
> `service/astronomy/orbitPhysics.ts` so the three speed presets are **proved against the same
> integrator the child's rocket flies on** (TWR 0.90 crash / 1.02 orbit on-screen / 2.50 flung
> off-screen) rather than asserted. **Answer leak caught in-flight:** the winning choice was
> labelled *"Just right"* — which names the answer, and the tutor reads labels aloud to a child
> who cannot read them. Relabelled "Medium", test-locked.
>
> Gates: 35 + 34 tests, **six revert-bites (1/2/4/2/20/1) — two did NOT bite at first** (the
> rung stamp, `showOrbitPath`) because the code was unreachable from a test, and were
> **restructured rather than left as decoration**; src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **2049/2049**, tutor-test Tier 1 `pass` + Tier 2
> `findings: []` / `dataBagDynamic: false` / 9-of-9 keys `component` / zero `(not set)`.
> **Runtime A/B @ G1: `'3'` + full instrument → `'1'` + all off; G3 control unchanged.**
> Curator A/B reported as **no measurable change** (1/4 pre vs 0/4 post — inside noise at a
> ~25% base rate); selection is not what this slice changed, so it is a supply sanity check,
> not the decisive evidence.
>
> **NEXT: 15A S3 `rocket-builder`**, budgeted as a full component slice.
> Residuals: no Tier-3 live audio (→ HUMAN-CHECKS #73); 0 eval modes;
> `gravityVisualization`/`initialOrbit` still declared-but-unread; the 🐢 "too slow" arc is
> ~51 km ≈ **under 1 px**, so that outcome reads only from the 💥 + spoken beat.

## EXECUTED 2026-08-06 (same day) — reader-fit supply-side sweep TAKEN as ACTIVE, S1 CLOSED

> The re-prioritization above was acted on immediately. Lane state: **ACTIVE**, queue of
> record `qa/reader-fit/BACKLOG.md` **item 15**, triage
> `qa/reader-fit/supply-sweep-triage-2026-08-06.md`.
>
> **The ≈69 estimate was replaced with a real enumeration** (vitest harness importing
> `UNIVERSAL_CATALOG`, then deleted — not a grep): **196 entries · 118 K-selectable · 28
> audited → 90 never audited.** *Higher* than the estimate, not lower; the gap is 18 entries
> that state no grade at all, which the text proxy could not see.
>
> **The top risk band collapsed from "90 audits" to ONE verified class.** A primitive reaches
> a non-reader only via a catalog `tutoring` block or component `useLuminaAI`/`sendText`.
> **26 K-claiming primitives have NEITHER** — the tutor is handed the literal string *"No
> specific scaffolding instructions for this primitive type."* (`lumina_tutor.py:385`). PRE
> contract rule #1 fails before a single string is read. 20 of the 26 make an explicit
> `"K: …"` promise in `constraints`. **11 are ALREADY OWNED** by
> `qa/engineering-tutoring-scaffold/BACKLOG.md` Phase A (which found the same defect from the
> read-aloud side on 07-21) — confirmed, not re-filed. **The unowned 15 are item 15**, split
> WRONG-BAND (floor it) vs SCAFFOLD-GAP (give it a voice). All but one also carry 0 eval
> modes, so each is **one slice shared with the queued BIO-2 density deficit**.
>
> **Two `/pm` estimate corrections, recorded so they are not re-raised:**
> `stoichiometry-lab`/`gas-laws-simulator` are **not** top-band — their constraints say
> *"Best for grades 8-12"*; they matched only on a *"K-8 → HS gap"* boast. And `story-talk`
> was a **false positive** — it is the PRE reference model, driving read-aloud from component
> `sendText`; it became the negative control that proved the channel test discriminates.
>
> **S1 `telescope-simulator` CLOSED — WRONG-BAND, floored to Grade 2, A/B-verified against
> the real curator.** Report `qa/reader-fit/telescope-simulator-PRE-2026-08-06.md`.
> Audit A: every load-bearing string UNCOVERED (the task instruction is 12px text behind a
> "Show hints" toggle). Audit B: FAIL structurally — `tutor-test` returns HTTP 400
> `no-scaffold`. Audit C: **17+ simultaneous interactive elements vs the contract's ≤5**, plus
> an `AZ 225.0° · ALT 35.0° · 3×` readout in a five-year-old's field; `gradeLevel` is
> destructured at `TelescopeSimulator.tsx:265` and **never read again**, so K and Grade 5
> render an identical panel. Fix = catalog `BAND FLOOR: Grade 2+ ONLY` (states why + names the
> K-1 alternatives) + generator backstop (schema enum `["2".."5"]`, K/G1 rungs deleted).
> **Second defect fixed in the same slice:** the generator read PROSE `ctx.gradeContext` into
> `=== 'K'` / `<= '2'` comparisons that could never match — the **`14m` class, unwired here** —
> now canonical-first via exported `telescopeGradeFromGrade()`, prose resolver kept as fallback.
> Gates: 10 focused tests with **revert-bite 3/10**, tsc **805 vs 806 baseline** (one fewer,
> zero new), typecheck:lumina 0, full vitest **1801/1801**.
> **Runtime (Verification Doctrine): eval-test K→2, G1→2, G3→3 unchanged (control), and a
> curator A/B on "Looking at the night sky with telescopes" @ K — PRE-FIX the real pipeline
> selected `telescope-simulator`; POST-FIX it does not.** The predicted failure was reproduced
> live before it was fixed.
>
> **📋 HANDOFF WRITTEN — `qa/HANDOFF-reader-fit-supply-sweep-2026-08-06.md`** (paste-able
> prompt, line-exact anchors for all 15 queue rows, the S1 fix template, per-slice gates
> incl. the **curator A/B recipe**, and the scope fence). A fresh session can take S2 from
> that file alone. **It also carries a MEASURED, un-queued finding:** the astronomy domain
> violates `generationContext.ts:68` (*"NEVER parse grade out of `gradeContext` prose"*)
> **10 generators out of 10** — day-night-seasons 13 dead comparisons, moon-phases-lab 10,
> mission-planner 7, scale-comparator 7, orbit-mechanics-lab 4. Confirmed bite on S2:
> `gemini-orbit-mechanics-lab.ts:554/556` use `gradeLevel >= '3'` against prose, and
> `'e' > '3'` lexically, so **orbital burns and gravity field lines are ON at Kindergarten
> today** while `showOrbitalPeriod` (`:551`) is unreachable at every grade. Same `14m` class
> telescope-simulator carried; the sweep is surfacing it domain-wide, exactly as the FF-1 and
> DNA-1 leak investigations did.
>
> Two follow-ons deliberately left OPEN rather than silently closed:
> telescope-simulator still has **no tutoring block and 0 eval modes at the grades it DOES
> serve** (`/add-tutoring-scaffold`, `/add-eval-modes`).
> **Signal worth acting on:** the post-fix K manifest routed to `planetary-explorer` and
> `constellation-builder` — both flagged in the triage as *no read-aloud, no band gate*. K
> astronomy demand now lands squarely on the Class-B queue, which **raises** S8–S12's priority.

## EXECUTED 2026-08-06 (same day, later) — 15B taken (user-pulled), **S8 CLOSED**

> The user pulled **15B — SCAFFOLD-GAP (8)** directly: *"tap-and-watch primitives that are
> genuinely K-fit and just have no voice."* This is the interleave the handoff recommended
> (option **b**) and the priority raise the S1 routing signal argued for, so the queue was
> entered at 15B rather than draining 15A first. Serial, one primitive per slice.
>
> **S8 `moon-phases-lab` CLOSED — READY at PRE.** Report
> `qa/reader-fit/moon-phases-lab-PRE-2026-08-06.md`. Pre-fix failure reproduced at the
> mechanism first: `tutor-test` returned `{"status":"no-scaffold"}`. Fix = catalog `tutoring`
> block (11 contextKeys, 3 levels, 5 struggles **led by the primitive's own stated critical
> misconception — "phases are Earth's shadow" — which its explanation panel names but nothing
> had ever spoken**, 3 aiDirectives incl. a PRE-READER READ-ALOUD carrying the *"this OVERRIDES
> any one-sentence cap"* clause so it survives the lesson `[PRIMITIVE SWITCH]`) + component
> `useLuminaAI` with 5 moments + 4 read-aloud surfaces + K-1 band gating.
>
> **The slice's real finding: the queued fix would have shipped INERT.** The Tier-2 probe was
> requested at `grade=K` and came back **"Sunlight and the Moon: Grade 3 Space Explorer",
> `gradeLevel:'3'`, `viewMode:'split_view'`** — the `14m` prose-grade class the handoff had
> *measured* on this generator (10 char-compares, 0 reads of `ctx.grade`) but not queued.
> `gemini-moon-phases-lab.ts:223` regexed PROSE `ctx.gradeContext` for `/grade\s*(\d|K)/`;
> kindergarten prose has no "grade N", so it fell through to a literal `'3'`. Because the new
> component band gate keys off `data.gradeLevel`, **a generator that can never emit `'K'` makes
> `isPreReader` dead code** — a green scaffold report over an unchanged child experience. Fixed
> with the S1 template (exported `moonPhasesGradeFromGrade()`, prose kept as fallback) but
> **with NO floor** — unlike S1, this primitive genuinely is K-fit, so K must reach its own rung.
>
> Incidental bug fixed en route: the K/1 jump-to-phase branch rendered the emoji **twice**
> (`🌑 🌑`). Now one large glyph at K-1, `emoji + name` at 2+, locked by a test.
>
> Gates: 12 focused + 15 jsdom tests, **revert-bite 5/12 and 4/15** (both proven by restoring
> the pre-fix logic and watching it fail), tsc **805 = baseline**, typecheck:lumina 0, full
> vitest **1813/1813**, tutor-test Tier 1 `pass` + Tier 2 probe **every var
> `resolvedBy: component`, zero `(not set)`**.
> **Runtime A/B @ K (the gate that decides it): pre-fix `'3' / split_view / "Grade 3 Space
> Explorer"` → post-fix `'K' / from_earth / cycleSpeed 8 / "Peek-a-Boo Moon"`, with G3
> unchanged as the control proving the ladder was not flattened.**
>
> **Cross-queue finding, filed not fixed:** Tier 1 flagged `tagged-sendtext-not-silent` on the
> read-aloud. Checked at the mechanism (`LuminaAIContext.tsx:930-953`) — `silent` suppresses
> only the chat-transcript entry; the socket payload is identical, so a silent send still
> speaks. Engineering Phase A's `readBlockAloud` pattern sends read-alouds **non-silent** and
> evades the static check only by interpolating the tag (`` `${tag} …` ``) instead of a literal
> `[TAG]`, so it posts machine prompts into the conversation as if the child typed them. That
> belongs to `qa/engineering-tutoring-scaffold/BACKLOG.md`, not here.
>
> **Residuals (open):** no Tier-3 live audio run on S8 → HUMAN-CHECKS #73; still 0 eval modes →
> `/add-eval-modes`.
>
> **S9 `classification-sorter` CLOSED — READY at PRE, and the QUEUED VERDICT WAS INCOMPLETE.**
> Report `qa/reader-fit/classification-sorter-PRE-2026-08-06.md`. The triage called this
> SCAFFOLD-GAP — *"tap/drag creatures into groups"*, i.e. the interaction is fine and only the
> voice is missing. The voice was missing, but **the interaction was not fine**: the only
> placement path was HTML5 drag-and-drop, a two-part act a five-year-old cannot execute.
> Three defects closed, **two of them unqueued**:
> **(1) SCAFFOLD-GAP** — catalog block + 6 moments. The load-bearing design decision is the
> answer/question split: for a sorter the RULE and the GROUP NAMES are the *question* (a
> non-reader must hear them repeatedly or the task is unstateable), while the correct group is
> the *answer* — forbidden outright **including by elimination**, with `[SORT_INCORRECT]`
> deliberately never interpolating `correctCategoryId`. Locked by tests asserting the answer
> string is absent from those messages.
> **(2) PRIMITIVE-GAP (unqueued)** — fixed by reusing the **WordSorter PRE precedent** rather
> than inventing: at K-2 ONE item is staged at a time and the group cards become the answer
> buttons, so the two-part drag collapses to tap = choose (rules 2 + 4). Drag is untouched at
> 3-5/6-8, and both protocols funnel through a single `placeItem()` so scoring, feedback and
> the tutor moment cannot drift between bands.
> **(3) Prose-band lookup (unqueued)** — `gradeBandMap[ctx.gradeContext] || '3-5'`: the map is
> keyed on bare grade tokens but indexed with PROSE, so it missed at every grade and the
> `'3-5'` default always won. Probe at `grade=K` returned `gradeBand:'3-5'` with THREE
> categories against a catalog K-2 rung reading *"Binary sorts only (2 categories)"*.
> Also removed `item.imagePrompt` from the render — an image-GENERATION instruction ("a
> red-breasted robin on a branch") was being printed as student copy **at every grade**.
> Gates: 13 + 12 tests, **revert-bite 5/13 and 6/12**, src-scoped tsc **803 vs 804 baseline
> (one fewer, zero new)**, typecheck:lumina 0, full vitest **1853/1853**, tutor-test Tier 1
> `pass` + Tier 2 **14/14 vars `resolvedBy: component`**. **Runtime A/B @ K: `'3-5'` / 3
> categories → `'K-2'` / 2 categories, with G4 unchanged as control.**
>
> **⚠️ TWO METHOD FINDINGS that change how S10–S15 should be worked:**
> **(a) There are TWO grade-blindness mechanisms, and they do not share a grep.** Astronomy
> (S10/S11/S12) uses the S8 shape — regex `/grade\s*(\d|K)/` over prose. Biology (S13/S14/S15)
> uses the S9 shape — a map keyed on grade tokens but indexed with prose. Identical signature,
> different code. **Probe each primitive at `grade=K` before writing anything**; S8 and S9 both
> prove the scaffold fix ships inert on top of a grade-blind generator.
> **(b) The absolute `tsc` count is NOT a usable gate in this lane.** It read 805, then 806,
> then 807 on an unchanged tree. The drift is `.next/types/app/**` — in the tsc program, and
> regenerated by the dev server that these very probes require. Gate on the `src/`-scoped error
> SET diff (`comm -13 baseline current`). A future session comparing against the "805" quoted
> in the S8 report would chase a phantom. *(Same cause surfaced an S8 residual:
> `typecheck:lumina` had been run before the jsdom test file was added, so a `/u`-flag regex
> error in it went unseen; fixed in this slice.)*
>
> **S10 `day-night-seasons` CLOSED — READY at PRE.** Report
> `qa/reader-fit/day-night-seasons-PRE-2026-08-06.md`. **The queued verdict was incomplete for
> the second slice running.** Triage said SCAFFOLD-GAP ("rotate the Earth, watch the light").
> What was actually on a Kindergarten screen: a **free-text `<input placeholder="Type your
> answer..."/>`** — PRE rule 6 — and it was the *entire* assessment, **scoring any non-empty
> string as correct**. A K child who cannot type scored 0; a child who typed "aaa" scored 100.
> It measured nothing at either end. Fixed: typing removed at K-1 (the questions survive as a
> spoken 🔊 prompt), `<select>` → tappable emoji place buttons, degree/hours readouts gated,
> and **scoring moved to the instrument** — spun the Earth, ran it, observed ≥2 places — which
> is *stricter* at K than what it replaced. Plus the catalog scaffold (9 contextKeys, 5
> struggles leading with BOTH misconceptions the primitive exists to correct, and a
> `THE TILT, NOT THE DISTANCE` directive that forbids "closer"/"farther" as a cause *even as a
> thing to reject in passing* — a young child keeps the phrase and loses the correction).
> Third defect, predicted and probe-confirmed: the worst prose-grade offender in astronomy
> (13 char-compares, 0 reads of `ctx.grade`) served **every K rung wrong** — `'3'`,
> `showTiltAxis:true`, 4 markers, 3 objectives, `timeSpeed:5`.
> Gates: 12 + 13 tests, **revert-bite 12/25**, src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **1878/1878**, tutor-test Tier 1 `pass`.
>
> **A thing NOT shipped, on purpose.** The catalog first carried a `[EARTH_DAY_NIGHT_FLIP]`
> beat — narrate when the watched place crosses into night. Whether a marker is lit depends on
> angle conventions in the D3 terminator math that I could not confirm visually this session,
> and a tutor confidently saying *"now it's night in New York"* over a daylit screen is worse
> than silence. So `isDaytimeAtMarker` is derived from the SAME expressions the renderer uses
> for the terminator (it cannot drift from the drawn shadow) and reported only on the
> jsdom-verifiable `[EARTH_LOCATION_SELECTED]` moment. **`tutor-test` then caught the dead
> directive tag I had left behind** (`directive-tag-never-emitted`) — rewritten to the tag
> actually emitted. The reading itself is queued for one pair of eyes at HUMAN-CHECKS #73; if
> it is inverted the fix is a single `!`.
>
> **⚠️ PATTERN, 3 slices for 3: the triage's "SCAFFOLD-GAP — interaction is fine, only the
> voice is missing" label has understated the work EVERY time.** S8 sat on a grade-blind
> generator, S9 was drag-only, S10 had typing at Kindergarten. The Class-B risk scores
> (3–8) were a text-proxy read of the catalog, not an Audit C. **Budget the remaining slices
> (S11–S15) for a component band-gate pass, not just a catalog block, and run Audit C rather
> than trusting the triage line.**
>
> **S11 `solar-system-explorer` CLOSED — READY at PRE.** Report
> `qa/reader-fit/solar-system-explorer-PRE-2026-08-06.md`. First slice where the generator's
> **happy path was already correct at K** (probe: `gradeLevel:'K'`, `initialZoom:'inner'`, 5
> bodies) — the prompt carries the audience in prose, which is the one place prose belongs.
> The defect was on the **degrade path**: `getDefaultBodies(gradeLevel)` was handed PROSE and
> its only branch is `=== 'K' || '1' || '2'`, so the K-2 branch was **unreachable** and a
> Kindergartener fell back to all 8 planets instead of the inner 4 — firing only when Gemini
> returned no bodies, i.e. exactly when the lesson was already degraded. **This is the
> `matter-explorer` inline-resolver shape ([[feedback_value-origin-not-code-touch]]): there is
> no named resolver to grep, AND no happy-path probe can reach it** — it is covered by the
> focused test instead, and that asymmetry is the finding rather than a gap in the evidence.
> Scaffold notes: a hard **no-measurements** directive at PRE (the detail card is six numeric
> cells — AU/km/days/hrs/°C/moons — with the replacement register supplied: "the biggest one",
> "really really hot"), dropped at 3-5 where the numbers are the point; plus a **SCALE
> HONESTY** directive, because 2 of the 5 struggles are misconceptions *the layout itself
> invites* (planets look lined up, look close together). Six categories of adult chrome gated
> at K-1, all kept at 3-5.
> **Reusable lesson: the first gating attempt used Tailwind `hidden` and the jsdom test failed
> it — correctly. CSS-hidden is NOT gone**; the text stays in the DOM and reachable by
> assistive tech. Conditional render is the only thing that satisfies rule 7.
> Gates: 12 + 13 tests, **revert-bite 5/13**, src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **1903/1903**, tutor-test Tier 1 `pass`.
> *Residual worth knowing:* this primitive has **no evaluation hook at all** — pure explorer,
> so band-contract rule 8 is N/A rather than passing. `planetary-explorer` is the measured
> cousin if K astronomy ever needs a scored solar-system activity.
>
> **S12 `scale-comparator` CLOSED — READY at PRE, and it carried the most complete
> prose-grade instance in the whole sweep.** Report
> `qa/reader-fit/scale-comparator-PRE-2026-08-06.md`. This is the only one where the prose
> **escaped the generator and reached the component**, via
> `gradeLevel: gradeLevel as 'K'|'1'|…|'5'` — **a type assertion that silenced the compiler at
> exactly the boundary being violated.** Probe @ K returned
> `gradeLevel: "kindergarten students (ages 5-6) - Use clear language…"` alongside
> `showRatios: true` against a catalog rule reading *"showRatios should be false for K-1"*.
> Four live consequences: `getGradeConfig`'s `switch` never matched (every grade got the
> default rung); the prompt's audience line rendered as *"…for Grade kindergarten students
> (ages 5-6) - Use clear… students"*; all six per-grade prompt blocks were unreachable; and
> **the component's own pre-existing `formatNumber` K branch had never once run**, because the
> field it compares against held a sentence — meaning any band gate I added there would have
> been dead on arrival. That is the transferable lesson: **an `as` cast at a module boundary
> can propagate a contract violation into a second file where nothing looks wrong.**
> Also: catalog scaffold whose real job is a **non-numeric comparison register** ("much
> bigger", "tiny next to it") since the whole primitive is about magnitude a pre-reader cannot
> read; five categories of numeric chrome gated at K-1, with the "3.7× larger" ratio panel
> gated in the COMPONENT as well as the generator (tested by passing `showRatios:true` at K
> and asserting it still does not render).
> **A React footgun the test caught:** the object-added cue decided add-vs-remove with a flag
> assigned INSIDE the `setState` updater and read immediately after — React runs functional
> updaters during render processing, so it was always `false` and the cue never fired. Decide
> from the current render's state.
> Gates: 13 + 13 tests, **revert-bite 11/26**, src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **1929/1929**, tutor-test Tier 1 `pass`. Runtime A/B @ K:
> prose → `'K'`, `showRatios` true → false, G4 control unchanged (and gains `interactiveWalk`
> + 5 objects).
>
> **Portfolio note worth a decision:** S11 and S12 both turned out to have **no evaluation
> hook at all** — pure instruments, so band-contract rule 8 is N/A rather than passing. Two of
> the eight 15B primitives cannot measure anything. Either they get `/add-eval-modes` or they
> should be declared exploration-only so the manifest stops routing assessment demand to them.
>
> **S13 / S14 / S15 CLOSED — and with them 15B is COMPLETE, 8/8.** Reports:
> `qa/reader-fit/{life-cycle-sequencer,habitat-diorama,organism-card}-PRE-2026-08-06.md`.
> - **S13 `life-cycle-sequencer`** — lowest triage risk in the class (3) and still needed a
>   component pass. The answer is an ORDER, so the scaffold forbids naming any position or
>   confirming a placement pre-check, and draws the line explicitly (describing what happens IN
>   a picture is stimulus and free; saying where it goes is the answer). Select-then-target
>   collapsed to **one tap places** at K-2. `imagePrompt` removed as student copy at every
>   grade. **The band resolver was EXTRACTED to `service/biology/gradeBand.ts`** rather than
>   copied a third time, with S9 re-pointed at it. Runtime A/B changed the *register*: K went
>   from *"The female butterfly lays a tiny egg on a milkweed leaf…"* to *"A mama butterfly
>   lays a tiny egg on a leaf. It is so small you can barely…"*.
> - **S14 `habitat-diorama`** — the most instructive shape: the component was **already written
>   band-aware, with five `gradeBand !== 'K-2'` gates that had never run**, because the
>   generator never emitted `'K-2'`. Most of the PRE improvement came from deleting one broken
>   lookup. Also: the roles legend was gated **backwards** (hid each role's description, kept
>   the five technical terms — jargon with its explanation removed), and the organism buttons
>   had **no accessible name at all**.
> - **S15 `organism-card`** — the scaffold's first draft promised "tap a fact to open it" and
>   `tutor-test` caught the tag as dead, because the fact boxes were static divs. Made it TRUE
>   rather than deleting it, since *size* and *locomotion* otherwise had no spoken twin. Fifth
>   and last copy of the prose-keyed map removed — **no fifth resolver written**.
>
> **What 15B actually was.** The triage label — *"interaction is K-fit, only the voice is
> missing"* — **understated the work 8 times out of 8**. It was true of the core mechanic every
> time and false about the screen every time: S9 was drag-only, S10 had **typing at
> Kindergarten** scored by any non-empty string, S11 had six classes of chrome around the tap,
> S12 printed kilometres and ratios, S13 was a two-act ordering protocol, S14's own gates were
> dead, S15 had no way to hear any of its five facts. **And every one of the eight sat on a
> grade-resolution defect** (seven outright, plus S11's degrade path) — the scaffold fix alone
> would have shipped inert in all of them. A supply-side triage read from catalog text cannot
> see chrome, protocol, or a grade-blind generator; only an Audit C plus a probe at the band
> can. **Do not trust a Class-B style label for 15A or any future sweep — budget every slice
> for a component pass.**
>
> **Reusable lessons, now in the reports:** CSS `hidden` is not gone (text stays in the DOM and
> reachable by AT); a component containing band-gating code is not evidence that gating
> happens; an `as` cast at a module boundary propagates a contract violation into a second file
> where nothing looks wrong; a `primitiveData` bag assembled behind local statements makes
> `tutor-test` report every key as "dynamic — verify at runtime", turning a real check into a
> shrug; never set a flag inside a `setState` updater and read it after; and the absolute `tsc`
> count is unusable while the dev server runs (`.next/types` churn) — gate on the `src/`-scoped
> error SET diff.
>
> Cumulative gates across the 8 slices: **1978/1978 vitest** (up from 1801 at S1), src-scoped
> tsc **803 vs the 804 baseline**, typecheck:lumina 0, tutor-test Tier 1 `pass` on all eight,
> and a runtime K-vs-control A/B on every one.
>
> **Open across the class:** no Tier-3 live audio run on any of the 8 → **HUMAN-CHECKS #73**
> (one sitting covers all three primitives listed there; the S10 day/night reading is the only
> genuinely open question in it). **S11, S12 and S15 have no evaluation hook at all**, so rule
> 8 is N/A rather than passing — either `/add-eval-modes` or declare them exploration-only so
> the manifest stops routing assessment demand at them. **All 8 still have 0 eval modes.**
>
> **📋 HANDOFF WRITTEN — `qa/HANDOFF-reader-fit-2026-08-07.md`** (the 08-06 one is marked
> SUPERSEDED in-file; its anchors went stale when 15B's tutoring blocks shifted every catalog
> id). The successor carries re-derived anchors, a per-item prediction of which
> grade-blindness shape each remaining generator has, the proven per-slice recipe, the
> corrected tsc gate, the seven traps, and the ranked frontier beyond item 15. A fresh session
> can take S2 from that file alone.
>
> **Two findings in it worth surfacing here, because both contradict "assume the pattern":**
> **`story-planner` (S4) is already CLEAN** — it reads `ctx.grade` canonically with an explicit
> contract comment, so a blanket "assume the defect" heuristic would have produced a pointless
> diff. And **`bio-compare-contrast` (S5) has a FOURTH shape**: `gradeBand` is a function
> parameter defaulting to `'3-5'`, so the defect (if any) lives at the **call site** and a grep
> for the other three misses it entirely. Predict from the code, confirm by probe, fix only
> what the probe shows.
>
> **Next pull: 15A S2 `orbit-mechanics-lab`** → S3 → S5 → S6 → S7 (S4's generator needs no
> fix; its band-floor question is catalog-only). Nominally cheaper per slice — catalog band
> floor, no component work by design — but that is the same shape of claim 15B disproved 8/8,
> so verify per primitive.
> **Then audit `planetary-explorer` + `constellation-builder`**, which are NOT in item 15
> (they have a channel) but now carry the K astronomy demand that S1's floor and 15B's fixes
> redirected onto them — the most likely site of the next real K failure.

## Prior snapshot — reconciled 2026-08-06 (**BUILD PIVOT — user-pulled; stream since CLOSED-BY-EXTEND, see above**)

> **`/pm` 2026-08-06 (late) — the portfolio was starved of BUILDABLE work, and that was
> structural, not a discipline failure.** The user's read — *"we've been doing lots of eval
> tests, contract work etc, but we need to make some real progress on real primitives"* — is
> confirmed by the queue tops: **LA K-2 Grammar's top was a DESIGN RULING** (item 1b,
> viewer-relative prepositions), **the DI lane's own row said "no unblocked top item — next
> pull is a development item to author with the user"**, and the opportunistic lane was
> **evidence closure**. Three streams, zero buildable tops. `/pm` opened a build stream.
>
> **NEW ACTIVE: K-1 Literacy Fluency — `sight-word-trainer` BIRTH (GAP-008), user-pulled.**
> Executor `/primitive` (L0), then the lifecycle ladder. Rationale: the gap tracker calls it
> *"the widest curriculum ROI of any unbuilt primitive in the K-1 literacy stack"* — sight-word
> automaticity is a prerequisite for fluent reading of any connected text, so every
> `decodable-reader` and read-aloud session is enhanced by it. **The decisive argument is
> capability timing:** this primitive needed a speak-and-be-judged loop the platform did NOT
> have when GAP-008 was written (2026-04) and now DOES — `useSpokenWordCapture` (Azure
> dual-signal → flash-latest), `LuminaMicListener`, and session-wide open mic from the
> `9d08687` voice-transport unification. Automaticity is measured in response latency on a
> spoken word; it no longer has to ship as a tap-only proxy. Serves LA001-07-a/b + LA005-08-a
> at K with cross-grade reach to G2.
>
> **WIP kept at 2+1 — the DI / voice lane is PARKED to make room.** It is the right one to
> park: its queue top is unauthored, and its live residuals (**HUMAN-CHECKS #63 bench sitting,
> #64(b) real-child drive, #65 calibration spread, #70, #71**) are all **user-only** gates that
> a Claude session cannot close anyway. Parked as of 2026-08-06 — **CTX-1 (item 13) landed
> first** (`a55c674`, `b87dd8b`, `aab8260`: the three recitable maxims the tutor read aloud to
> a child were deleted outright, per the user ruling to delete the channel rather than tune the
> gate). Resume condition: the user runs a mic session, or authors the next development item.
>
> **STALENESS SWEEP — `qa/PRIMITIVE_GAPS.md` had not been touched since 2026-04-01 and its own
> #1 and #3 priorities were ALREADY BUILT.** Re-verified every gap against the LIVE catalog
> (`service/manifest/catalog/*.ts`) rather than the dashboard: **GAP-010 `word-sorter` CLOSED**
> (catalog + component + generator + tests; the LA lane's open item against it is an eval-mode
> add, not a build) and **GAP-007 `coin-counter` CLOSED** (catalog + component + generator +
> a derived contract; it has since consumed multiple build slices). Totals corrected to
> **12 CLOSED / 7 OPEN**. Verified-still-missing: `sight-word-trainer`, `letter-tracer`,
> `book-explorer`, `capacity-lab`, `erosion-explorer`, `landform-mapper`,
> `earth-changes-timeline`, `bar-graph-builder` (the G2 Earth Science trio has **zero
> references anywhere in the repo** — genuinely unbuilt and unwired).
>
> **NEW FINDING, no register owned it — a DEPTH deficit larger than the gap list.** Measured
> against the live catalog: primitives carrying `supportsEvaluation: true` with **no
> `evalModes` block** are built and generating content but **invisible to the IRT selector**.
> **biology: 17 primitives, 0 eval modes — the entire domain at L0**; engineering ~19 at L0;
> astronomy ~8; core ~12. Biology is the sharpest case because the 2026-06-28 science sweep
> already fixed 11 of those generators for topic/intent fidelity — they honor an objective and
> produce good content that cannot be adaptively routed. This is CLAUDE.md's priority #3
> verbatim. **Recorded in `qa/PRIMITIVE_GAPS.md` under "Not a gap — a DEPTH deficit."**
> Executor `/add-eval-modes`, serial, pilot-then-sweep. **Honest caveat carried:** biology
> skews secondary (`protein-folder`, `dna-explorer`, `evolution-timeline`), so K-5 demand is
> likely thinner than 17 suggests — run a demand check before committing the domain.
> Offered to the user this run and **not** chosen; it is the standing next candidate.
>
> **UNSHIPPED, flagged: the `addition-subtraction-scene` item-12 work** (4 files, ~200 lines)
> is browser-verified with a 10-check real-Chrome run and has **no commit**. G1 `act_out`
> forked by operation — subtraction becomes an enacted scene, and the ten-frame answer leak
> (it mirrored stored `resultCount` on enacted scenes) is closed. Ship it as its own slice;
> it does not collide with the sight-word build, which lands new files plus a `literacy.ts`
> catalog entry.

## Prior snapshot — reconciled 2026-08-06 (**ship reconcile — 4 clusters uncommitted**)

> **`/pm` 2026-08-06 (evening) — EVERYTHING SHIPPED, AND THE TWO GATES CLOSED.** The
> four clusters below are committed and pushed (`a695574..f391cca`), and the user drove
> the browser in the same session: **HUMAN-CHECKS #69 struck** (the props-are-data repair
> verified in the lesson path — the only place it ever failed) and **#64 struck including
> criterion (b)**, with the dev backend confirmed restarted onto the fix first. That closes
> **DI BACKLOG item 11 end-to-end** and retires the last residual of the voice-transport
> unification `9d08687` apart from #65. **The DI lane's queue now has no unblocked top
> item — its next pull is a development item to author with the user.**
> **#63 was then RUN the same evening — and still does not close.** The `Counting to
> 120` bench probe drove 4 of 10 items, answered every one CORRECTLY, and stopped at
> `count-13`, so **none of #63's three criteria were exercised** and **no multi-word
> numeral was ever spoken** — the class the row exists to bench. Correct answers being
> affirmed cannot distinguish a discriminating judge from a permissive one; criterion
> (a) exists precisely because it needs a *deliberately wrong* answer. Banked as real:
> a clean **negative control** (thirteen not heard as thirty in either direction) and
> a steady `commitLagMs` ~1220. **DI item 10 stays BLOCKED.** New blocker **DI-120-1**
> (DI BACKLOG item 12): two noise blips at peak 0.018 opened turns over tutor audio,
> anchored EMPTY attempts and burned `count-39` without the user ever answering it —
> the barge-in bar (0.0108) sits below this device's leakage while real speech peaked
> 0.045–0.116, so 0.025–0.03 separates them cleanly. **Fix that before re-running.**
> Report `qa/di-bench/run-2026-08-06-counting-120-probe.md`. #70/#71 also stay open.
>
> **⚠️ CTX-1 — SAME-DAY REGRESSION IN `d895bfb`, user-reported from a live session
> 17:02 (DI BACKLOG item 13, now the lane's TOP pull).** The tutor spoke a
> self-directed stage direction aloud to the child — *"Silence is the invitation to
> keep exploring, not a question from the student. Wait for them to take the next
> step…"* — a **verbatim recitation of the style rule at `lumina_tutor.py:563`**,
> spliced with the new carve-out's vocabulary. Cause: `ContextUpdateGate`'s
> `MAX_HOLD_S = 8.0` force-releases a parked context update **without checking
> whether the tutor is still speaking**, and normal turns exceed 8s (item 11's own
> live report logged 8.2 / 8.4 / 14.5 / **20.5**s). So the gate built to prevent
> self-inflicted barge-ins causes one on every long turn; the landed update then
> hands Gemini the floor and, with nothing to answer, it reads the prompt out loud.
> **Same class as item 11's original defect and its `(not set)` rider** — internal
> machinery reaching the child's ears. **`/pm` reporting miss owned:**
> `ContextUpdateGate` was added in `d895bfb` and described in neither the commit
> message nor the slice report.
> **REFRAMED SAME DAY BY USER RULING — severity MEDIUM, and the fix is DELETION.**
> `/pm`'s first call (tune the gate's expiry) was treating the symptom. The user's
> read: *"this feels like we just reminded the tutor to talk when this capability
> wasn't actually necessary — can we make this more parsimonious?"* The code itself
> concedes the point at `:1039-1042` — it forwards every slider tick over a transport
> that **structurally cannot be silent**, then spends prompt budget telling the model
> to **ignore** what was just sent. So: stop pushing state; hold it server-side and
> prepend it to messages that already give the model the floor; make the struggle
> exception an explicit cue rather than a hope that the model notices. That makes the
> symptom unreachable, shrinks `ContextUpdateGate` toward deletion, and should retire
> most of the **9-of-17 self-caused barge-ins** its own docstring measured.

> **`/pm` 2026-08-06 — the portfolio is TRUTHFUL but UNSHIPPED.** Nothing has been
> committed since `a695574` (12:43) and the working tree holds **four independent
> clusters, ~2,200 added lines across 55 files**. Three are fully evidenced and recorded
> (fast-fact answer contract, DI item 11 lesson-tutor, plus their registers); the fourth
> had **no record anywhere** and is now written up below as "One-off, UNREPORTED".
> Whole-tree gates measured this run: **full Vitest 1768/1768**, **tsc 803 = baseline**
> (`/pm` cleared the 3 stray errors that were sitting above it). The portfolio's own
> risk right now is not correctness — it is that ~2,200 lines of verified work is
> one `rm -rf` or bad `git checkout` away from gone, and that a cold session reading
> `git log` sees none of it. **Ship first, pull next task second.**

## Prior snapshot — reconciled 2026-08-05 (**2nd pass, post-`bd1c535`**)

| Lane | State | Pull now | Ground truth |
|---|---|---|---|
| LA K-2 Grammar density (spatial-scene prepositions) | ACTIVE — top slot, user-pulled 2026-08-05 (item 1 CLOSED-BY-SPLIT 08-05 latest) (item 1 CLOSED-BY-SPLIT 08-05 late) | **Queue of record now SEEDED: `qa/la-k2-grammar/BACKLOG.md` (top = next).** Handoff Phases 0-3 EXECUTED 2026-08-05. **Queue RENUMBERED 2026-08-05 evening by `bd1c535` — a new item 2 was inserted, so every pointer below shifted by one (this row was stale until `/pm` re-reconciled it).** Current order: **item 1 `spatial-scene` containment/two-reference prepositions** (`in` / `between` / `in front of`-`behind`, 4-5 subskills) — contract **C2 OPEN** names the class; **`in` inverts contract R11** (`place` targets an EMPTY cell; `GridScene` only offers the tap affordance on empty cells) so read R11 before touching, and `in_front_of`/`behind` need a **design ruling before code** (viewer-relative is ambiguous in a top-down grid). **~~item 2 (contract C3, `above`/`on` ambiguity)~~ CLOSED 2026-08-05 late — see the ACTIVE section; it was a MEASURED 4/18 failure, now 0/36, promoted to contract R12, and its probe caught a second rule-#1 leak (answer at `options[0]` in 18/18)**. Then item 3 (path words through/around/across — the one preposition sub-cluster fit-first does NOT resolve into spatial-scene, likely a real birth), item 4 (word-sorter K picture-pair mode, 3 subskills), item 5 (Sentence Mechanic BIRTH, 4 — run `/curriculum-fit` FIRST), item 6 (**draft-first** re-target of the 11 already-served subskills), item 7 (sentence-builder @ K, the biggest EXTEND at 9 subskills — wants its own contract-first slice), item 8 (Conversation Studio — 16 grammar + most of LA005/LA003/LA007; a **lane DESIGN decision**, not a grammar item; do NOT force these into tap-primitives). Serial, one item per slice. **Item 2 CLOSED, then item 1 taken and SPLIT 2026-08-05 (latest): `in` + `between` SHIPPED as their OWN eval modes — `place_in` (β 1.5; **R11 INVERTED**, the answer is the cell the container OCCUPIES) and `place_between` (β 3.5, judged from TWO references). A **FORK, not an edit** (ladder rung 1), so `place`/R11 and the math K.G.1 window are byte-for-byte unchanged — neither word joins the position window at all (new **R15**). Contract **C2 OPEN → PARTIALLY RESOLVED**. The curator now routes LA004-05-B → `place_in` and LA004-01-F → a 3-mode blend unprompted; that routing probe also caught a real defect — a **blend pin resolving to null**, generating all six modes (a 17-challenge session). Gates: 27/27 real-Gemini clean incl. a math control, focused **49/49** (3-of-49 bite), a **NEW jsdom component drive 8/8** (2-of-8 bite — pre-fix the correct containment answer was *literally unclickable*), Vitest **1670/1670**, tsc **803 = baseline**. **Top is now item 1b (`in_front_of`/`behind`) — a DESIGN RULING, not code**; buildable alternatives are item 2b or item 4.** | **Phase 0/1 DONE — census of record is `qa/la-k2-grammar/census-2026-08-05.md`; it SUPERSEDES the 07-04 demand map.** Three corrections measured off the live published curriculum: (1) the count is **138, unchanged** — and it *cannot* shrink from primitive builds, because `target_primitive` is a **stored curriculum field**, so the handoff's "may have shrunk since word-sorter/sentence-builder shipped" premise is wrong by construction; (2) grammar is **50**, not ~37; (3) **131 of 138 are Kindergarten** (7 at G1, 0 at G2) — the pre-reader contract governs essentially the whole lane. Triage: 11 ROUTE / 19 EXTEND / 4 BIRTH / 16 TIER-3-by-design. **Phase 2 pilot CLOSED — and it was an ANTI-DUPLICATION CATCH.** The handoff's headline predicted birth ("Preposition/Spatial Scene") **already existed**: `spatial-scene`, `catalog/math.ts:3743`, fully built at L3 (4 eval modes + support tiers + ctx-native scope), invisible to the 07-04 map only because it is filed under **math**. Verdict flipped BIRTH → EXTEND before any code was written. Measured defect: the curator genuinely routes LA prepositions here and its own intent said *"Put the ball UNDER the table"*, but the generator's hardcoded K window ("ONLY above, below, beside, next_to" — the math K.G.1 vocabulary) silently overrode it and emitted above/below/beside ([[trust-intent-over-hardcoded-caps]]). Fixed with the **14l resolver template** — one temperature-0 schema-bound call resolves the lesson's named position words, UNIONed with the band default (**widens only**), and only in-window words get grid semantics stated so the LLM is never invited to emit a relation the checker cannot judge; `on`/`under` are CONTACT-scoped vs `above`/`below` any-distance — that contrast IS the LA skill. Math K.G.1 byte-compatible (no request → band default). Contract derived first (11 R, **C1 RESOLVED via the config-axis rung**, C2 open) + catalog projection applied (the 06-07 curriculum-fit sweep had already flagged this entry 0.766 "diffuse"). Gates: focused **15/15** w/ **2-of-15 revert-bite**, full Vitest **1,628/1,628**, typecheck:lumina **0**, tsc **803 = baseline**, real-Gemini census replay serves on/under/beside with placements matching the injected rule EXACTLY, math replay 11 challenges / 4 modes / **0 out-of-window**. **Honest residual: the 138 demand number did NOT move** — this made the primitive *able* to serve 7 subskills; converting demand needs the draft-first re-target (BACKLOG item 5), deliberately not entered (`curriculum_published` read-only throughout). No browser check (no component change shipped). Reports `qa/la-k2-grammar/{census,spatial-scene-prepositions}-2026-08-05.md`. **Second slice the same day (`bd1c535`, 18:52) — the routing re-probe the pilot skipped, and it came back CLEAN.** The catalog projection landed AFTER the pilot's last routing probe, so the description/`constraints` rewrite — the only text the manifest curator routes on, and it now names words to keep OUT — had never been re-verified. Both preposition subskills re-probed: **LA004-05-B still routes here and now claims TWO instances** (`place` + `follow_directions`, was one), with the curator's intent shifted off the unsupported `in` onto the supported window — the projection working as designed; **LA004-01-F still routes** and its `between` ask **saturated honestly** (3 `place` challenges, every placement rule-correct, zero out-of-window words in any judged field). Routing held and tightened; the re-probe's by-product was contract **C3** (queue item 2). **Evidence-hygiene note recorded by `/pm`:** that slice shipped no report file, so its evidence lives only in the commit message + the contract changelog — a future session has to `git show bd1c535` to find it. **Reader-fit K → EMERGING stays PARKED as of 08-05: queue fully drained** (14a–14m all closed; re-seed via a new band census when wanted) | **14l CLOSED + SHIPPED 2026-08-05**: flashcard-deck honors a requested review count and refuses untaught vocabulary; the K community-helpers census instance closed as a rider. Contract derived + C1/C2 resolved, `--check` COMPATIBLE. Focused 20/20 w/ revert-bite; full Vitest **1,589/1,589**; typecheck:lumina 0; tsc 803 baseline. Prior: 14j `f4147ef` + 14k `1fbf4a1` SHIPPED 08-05. |
| Direct Instruction family → session voice | ACTIVE | **14g `counting_next` CLOSED 2026-08-05** (handoff executed in its own session): the "within 120" → "within 12" parse bug is fixed, so a G1 counting ask now saturates at the benched twenty instead of collapsing to twelve — real-pipeline 5/5, 12 new tests w/ 4-of-6 revert-bite, full Vitest **1601/1601**, typecheck:lumina 0, tsc 0 new. User chose **Option B**, so the 1–120 extension is **DI item 10, BLOCKED on standing gate 1** (multi-word numerals = unbenched response class); its probe set "Counting to 120" is wired and the ~30-min sitting is **HUMAN-CHECKS #63** — a genuine fork gate, not pixel debt. Report `qa/tutor-reports/di-math-facts-14g-2026-08-05.md`. **VOICE TRANSPORT UNIFICATION SHIPPED `9d08687` 2026-08-05 — ALL FOUR charter phases, same day it was un-parked**: session-wide open mic (every lesson authenticates `manual_activity`, provider-owned turn authority, judged DI subscribes), calibration beat, contextual close-timing + viewport claim, refer-back journey live PASS 3/3 real Gemini sessions. Students can now natively speak to the tutor on any lesson section. **Residual = HUMAN-CHECKS #64 (mixed-lesson mic acceptance drive) + #65 (calibration hardware spread) — the user driving their own feature is the gate. Lane pull = author the next development item with the user** (#63 bench sitting unlocks DI item 10 counting-to-120; new pack in a benched class; voice-aware expansions now that the transport exists). **AUTHORED 2026-08-05 late — queue TOP is now item 11 (user-pulled): lesson-tutor curiosity-question deflection + resume continuity**, opened from the first real-child mixed-lesson drives (the #64 shape in the wild; **#64(b) FAILED** — a kid's "are they going to build a bunch of apartments?" got machine-profile's level1 scaffold line back verbatim; root cause = unscoped "never give direct answers" in `build_lesson_system_instruction`). **✅ ITEM 11 MACHINE HALF DONE 2026-08-06 (same-day user pull):** carve-out shipped in both builders + `[SESSION RESUMED]` steering + all three riders + `LUMINA_FAULT_DROP_S`; gates = pre-fix journey FAILED ≈50%/judged beat (non-vacuity; keyword anchors alone false-passed, so the harness gained a temp-0 LLM judge), post-fix `lesson-curiosity --runs 3` PASS zero findings, resume probe PASS non-vacuous (drop fired mid-reply, resumed 350ms, `resume-steering mid_turn=true`, no re-greet), units 22/22 w/ revert-bite. **Residual = the user's real-child #64(b) drive — restart the dev backend first (it ran pre-fix code all slice).** Slice report `qa/tutor-reports/lesson-tutor-item11-2026-08-06.md`; review `qa/tutor-reports/lumina-session-review-2026-08-05.md` | Focused 51/51, full Vitest 1,613/1,613 combined, typecheck:lumina 0, refer-back pytest + live 3/3. Item 2 closed (Probe G 11/11, full Vitest 1,569/1,569). **Item 6 DEPRIORITIZED by user ruling 08-05** — imperfect free-form calibration accepted; NO hardcoded grade guardrails in retrieval (pure-IRT family ruling); standalone-only exposure. Item 9 Tier 2 stays demoted-but-queued. Focus per user 08-05: active development — primitives, DI packs, audio/spoken modalities are the foundation. |
| Support tiers (non-math) | OPPORTUNISTIC (+1) | **Batch-3 verification/report closure** via `/eval-test` — **SERIAL, one primitive at a time (user ruling 08-05)**; no Workflow fan-out; append the report + strike per item so an interrupted session lands its progress | Commit `effc7a6` wired batch 3, taking the code surface to 31/36. Required per-item real-Gemini evidence and the batch report are still missing; HUMAN-CHECKS #60/#62 are non-blocking. |
| Delegated lane | NONE | — | No residual delegated report needs folding. |

**One-off closed 2026-08-06 — `fast-fact` answer contract (no lane needed; owning register
was `qa/EVAL_TRACKER.md` throughout).** A field-reported leak (a live "Super Counting Within
20" lesson rendered `text-large "7"` over *"Which number is shown here?"* with options 6/7/8)
turned out on `/oracle-test` to be the primitive's default behaviour in **every subject it
serves** — Math 6 / Language Arts 24 / Science 15 answer-leak violations across 5 runs each,
0% flakiness. `/eval-fix` closed FF-1 (CRITICAL) + FF-2 (HIGH) and promoted the missing
invariant to **SP-29 (representation shift)**. The load-bearing half was the *prompt*, not
the guard: "show the word, pick the word" is identity-shaped by construction, so a code guard
alone would have emptied the sight-word drill rather than fixed it — the LA drill that leaked
10/10 now generates 10/10 clean sentence-completion items. Re-running the same matrix:
**4/4 PASS, 197 challenges, 0 violations, 0/5 flakiness**. The re-test also caught a defect
nobody had queued (**FF-3**): pushing counting items off numerals onto emoji exposed SP-8 —
flash-lite keyed 10 over seven emoji — closed structurally with a `visualRepeat` count the
model can get right plus code that repeats the glyph. Gates: focused **37/37** with a
**13-of-37 revert-bite** (every guard disabled in turn), oracle seeded suite 25/25, full Vitest **1768/1768**,
typecheck:lumina 0 from this work, tsc **806 = 803 baseline + 3 pre-existing** in another
session's untracked `gemini-number-line.session-distinctness.test.ts`. Reports
`qa/eval-reports/fast-fact-2026-08-06.md` + `qa/oracle-test/fast-fact-2026-08-06.md`.
**Residuals, honest:** (1) the oracle's leak checks are now regression detectors for the
guard rather than independent findings; (2) **no browser look** at a K counting drill
rendering 19 emoji in the `text-5xl` visual box — the 25-glyph cap is a guess →
**HUMAN-CHECKS #68**; (3) reject-only (user ruling, no retry) can ship a short
drill on a leak-heavy topic — measured 9-10 items, but a total leak throws; (4) **FF-4 stays
open** — `fast-fact` is still L0 with `supportsEvaluation: true` and no `evalModes`, so it is
unrouteable by difficulty (`/add-eval-modes`); (5) **TU-1 stays open** by user ruling.

**One-off, UNREPORTED — found uncommitted by `/pm` 2026-08-06; the portfolio had NO
record of it.** A fourth cluster of 08-06 work sat in the working tree with no report
file, no queue row, and no WORKSTREAMS entry — evidence lived only in code comments and
two contract changelogs. Recorded here because a future session would otherwise have to
read the diff to find it. Four independent fixes:

1. **PLATFORM — the props-are-data render bug (the significant one).** Eight primitives
   were declared `React.FC<XData> = (data) => …`, i.e. props ARE the data, while EVERY
   renderer mounts a primitive as `<Component data={…} index={…} />` (ManifestOrderRenderer,
   PrimitiveRenderer, PracticeManifestRenderer, PulseActivityRenderer). Each therefore
   rendered **perfectly on its standalone tester** — which spreads the fields across props —
   and had `data.<anything>` undefined the first time it landed in a **real lesson**.
   Affected: the **whole DI family** (letter-sounds, word-reading, sentence-reading,
   math-facts), **calendar-explorer**, **timeline-builder**, **equation-workspace**.
   `PrimitiveConfig.component` was `ComponentType<any>`, which is what let them register
   cleanly; it is now typed to the `{ data, index? }` platform contract, so the class is a
   **compile error going forward** — the load-bearing half of the fix. Components with
   extra props (`onRowClick`, `totalCards`, `index`) must keep them OPTIONAL to stay
   assignable; ConceptCard/FeatureExhibit/GenerativeTable were adjusted for exactly that.
2. **base-ten-blocks answer channel.** The keypad is removed from `build_number` and
   `regroup` — wherever the target value is already on screen, typing it is transcription,
   not place value. Both are now judged from the built columns, with a `nonstandard`
   verdict (12 unit cubes total 12 but never show the ten) routing the student to the trade
   instead of scoring correct. `read_blocks` + the operate modes keep the keypad, where the
   number genuinely is not on screen. Tutor gains a `[CHANNEL]` clause so it never coaches
   a keypad that isn't rendered.
3. **number-line R9 + number-sequencer R9 — two field-reported session-shape bugs.**
   number-line: `reshapeOrderSet`/`reshapeBetweenPair` scored the POOL and returned the
   single best set, never reading their per-challenge argument — so an easy-tier G1
   "Counting within 20" order session rendered **12, 15, 17 four times**. number-sequencer:
   the hard-tier reshaper rebuilt `order-cards` as `[...set.slice(1), set[0]]`, i.e. the
   sorted set rotated by one, so the task was **solvable from layout** (a rule-#1 leak that
   read as a rendering bug). Both fixed with regression pins; the number-sequencer oracle
   gained the `answer-leak` rule that would have caught it. Evidence is in the contract
   changelogs (`docs/contracts/number-line.md`, `number-sequencer.md`), not a report.
4. **Two small guards.** `curator-brief` hook badge: flash-lite returned a WORD ("marbles")
   into a `text-5xl` glyph slot, so the model now picks a theme from an enum and code
   attaches the emoji (`utils/hookVisual.ts`) — the standard words-to-a-menu split.
   `LuminaAIContext.sendText`: identical cues within 50ms are dropped — StrictMode's
   double-invoke shipped every `[ANSWER_CORRECT]` **twice**, and the duplicate barged in on
   the turn the first copy had just started, clipping the tutor mid-sentence.

**Gates (measured by `/pm`, whole tree): full Vitest 1768/1768, tsc 803 = baseline.**
`/pm` fixed the one thing blocking that baseline — the untracked
`gemini-number-line.session-distinctness.test.ts` carried 3 `TS18048` errors on an optional
`challenges`; narrowed once through a `challengesOf` helper that asserts rather than
defaulting to `[]` (an empty default would pass every distinctness assertion vacuously).
That file's 7/7 still pass.

**✅ ITEM 1 RUNTIME-VERIFIED 2026-08-06 (evening) — HUMAN-CHECKS #69 STRUCK.** The user
drove ~15 minutes in the browser: *"worked great, DI worked great, each lumina primitive
worked great."* The DI half is the strongest evidence — those packs must mount, receive
content AND drive the judged mic loop, which a silently-undefined `data` could not have
survived. `ac2d342` moves from "machine-verified, needs a browser check" to **verified**.
Lesson recorded as [[tester-green-lesson-broken]]. **#70 and #71 stay OPEN** — neither was
named in the drive, and a general "the lesson worked" is not evidence for base-ten-blocks'
nonstandard-build rejection (you must deliberately build 12 as twelve unit cubes) or for
the curator-brief hook badge being a glyph rather than a word.

**Honest gaps, all QUEUED not fixed:** (a) ~~no runtime verification of item 1~~ **CLOSED
above 2026-08-06**; (b) **no regression pin for the
platform contract itself** — nothing fails if the next primitive is written props-are-data
and registered through an `any` escape hatch; executor `/primitive` (checklist) or a
registry-shape test; (c) base-ten-blocks keypad removal is a real UI change never clicked →
**#70**; (d) the hook-visual mapper is pure and **untested**, and nothing pins the generator
to the enum → **#71**; (e) the cue-dedup guard has **no test** and is folded into #64 as a
listen-for criterion; (f) **no EVAL_TRACKER rows** were written for the base-ten-blocks or
number-line/number-sequencer defects, so the dashboard still shows those primitives clean —
executor `/eval-test` or a tracker backfill.

**WIP:** back to **2 ACTIVE + 1 opportunistic — compliant.** The entire 08-04
surface SHIPPED 2026-08-05: reader-fit 14j `f4147ef`, 14k `1fbf4a1`, DI item 2
`62e22aa`, registers `f69aa86`, plus the **home-shell refresh `1b3e2db` —
user-approved in browser 08-05 ("home refresh is good") and CLOSED as a lane**
(compact header grade selector, constellation idle hero, simplified ribbon;
typecheck:lumina 0, full Vitest 1,569/1,569; no owning queue was ever needed —
it closed as a one-off approved surface). **Reader-fit 14l closed and SHIPPED
2026-08-05** (generator + new resolver + 20 focused tests + contract + catalog
constraints prose + registers). **DI 14g CLOSED 2026-08-05** — the
`counting_next` parse bug is fixed and a 120 ask saturates honestly at twenty;
the 1–120 extension is DI item 10, gated on bench sitting **#63** (multi-word
numerals, an unbenched response class — the probe is wired and waiting).
**DI 14g SHIPPED `4000434` and VOICE TRANSPORT SHIPPED `9d08687` (all four
charter phases, live refer-back 3/3) — both landed 08-05.** Pulls: **LA K-2 Grammar
density — handoff Phases 0-3 EXECUTED 2026-08-05; queue of record now seeded at
`qa/la-k2-grammar/BACKLOG.md` (top = next).** The census corrected the 07-04 map on
three counts (138 unchanged and structurally insensitive to primitive builds; grammar
50 not ~37; 131/138 are Kindergarten), and the pilot was an **anti-duplication catch** —
the predicted "Preposition/Spatial Scene" birth already existed as the math-filed
`spatial-scene`, so it shipped as an intent-driven preposition-window EXTEND instead
(contract C1 resolved on the config-axis rung; full Vitest 1,628/1,628, tsc 803
baseline). Next pull = **BACKLOG item 2** (contract **C3**, the `above`/`on` ambiguity —
a rule-#1 risk closed by an `identify`/`describe` probe plus a small exclusivity rule;
`/pm` recommends it ahead of item 1, whose containment/`between` build carries an
unresolved viewer-relative design ruling and is flagged against contract R11);
reader-fit is PARKED with a drained queue; DI/voice
lane: **item 11 MACHINE HALF DONE 2026-08-06** (carve-out + resume steering +
riders shipped; pre-fix journey failed ≈50%/beat, post-fix 3/3 PASS zero
findings, resume probe non-vacuous PASS, units 22/22; residual = the
real-child #64(b) drive — **restart the dev backend first**); one ~45-min mic
session closes #64 acceptance + #63 bench (which unlocks DI item 10
counting-to-120); support tiers **batch-3 evidence closure, serial**.
`.claude/settings.local.json` still permits
only `Read(**)`, so the standing routine-shell permission flag remains unresolved.

**Reconcile 2nd pass, `/pm` 2026-08-05 evening — four corrections, all drift from the
same cause: `bd1c535` landed after the day's first reconcile.** (1) The LA queue was
**renumbered** by that commit (a new item 2 inserted; every pointer shifted by one) and
the snapshot still named the old order — corrected, and items 7-8 that this file had
never listed are now named. (2) Contract **C3** was opened by the re-probe and appeared
nowhere in the portfolio — recorded. (3) **Structural:** the top ACTIVE lane had no body
section under `## ACTIVE` while PARKED reader-fit still held the `### 1.` slot — a cold
reader following the body found no grammar lane at all; the LA section is now authored at
`### 1.`, reader-fit's heading says PARKED in place, and reader-fit has a real PARKED-table
row with its resume condition (**run a new band census**, since its queue is drained rather
than blocked). (4) The `bd1c535` entries were stamped **2026-08-06** — a forward date, since
the commit is 08-05 18:52 -0400; fixed in `qa/la-k2-grammar/BACKLOG.md` and
`docs/contracts/spatial-scene.md` (both the C3 heading and the changelog). **HUMAN-CHECKS
needs no new row** — the C3 finding is machine territory (an `identify`/`describe` probe),
not pixel debt; the file is current through **#65, next free ID = 66**, and no report newer
than its as-of date carries unfolded browser debt.

## ACTIVE

### 1. LA K-2 Grammar density — TOP SLOT (user-pulled 2026-08-05) — last touched **2026-08-05**

*Section authored by `/pm` 2026-08-05 (2nd pass). The lane was opened, seeded, piloted and
re-probed all on 08-05 but existed only as a snapshot-table row — a cold reader following the
`## ACTIVE` body found reader-fit in slot 1 and no grammar lane at all.*

- **Queue:** `my-tutoring-app/qa/la-k2-grammar/BACKLOG.md` (top = next; 8 items).
  **Roster of record:** `qa/la-k2-grammar/census-2026-08-05.md` — it SUPERSEDES the
  2026-07-04 demand map.
- **Executor skills:** `/add-eval-modes`, `/reader-fit`, `/curriculum-fit` → `/primitive`,
  `/primitive-contract --check` (required before touching `spatial-scene` — R11 is flagged),
  `/eval-test`. Curriculum re-targets are **draft-first**: edit draft → `lineage-check` →
  publish; NEVER `curriculum_published`.
- **Demand:** 138 K-2 LA subskills route to the generic `ai-tutor-session`; **131 are
  Kindergarten** (7 G1, 0 G2), so the pre-reader contract governs essentially the whole lane.
  Grammar (GK LA004) is **50** of the 138. Triage: 11 ROUTE / 19 EXTEND / 4 BIRTH /
  16 TIER-3-by-design.
- **The census corrected the 07-04 map on three counts** — (1) 138 is **unchanged and
  structurally cannot shrink from primitive builds**, because `target_primitive` is a *stored
  curriculum field* (so the handoff's "may have shrunk" premise was wrong by construction);
  (2) grammar is 50, not ~37; (3) the lane is 95% Kindergarten.
- **Standing lesson from the pilot — fit before birth.** The handoff's headline predicted
  BIRTH ("Preposition/Spatial Scene"); the primitive **already existed**, fully built at L3,
  invisible to the 07-04 map only because it is filed under **math**. Verdict flipped
  BIRTH → EXTEND before any code was written. **Run `/curriculum-fit` before `/primitive` on
  every remaining BIRTH candidate in this queue** (items 3 and 5).
- **Honest ledger:** the pilot made `spatial-scene` *able* to serve 7 subskills — **the 138
  demand number has not moved.** Converting demand requires the draft-first re-target
  (item 6), deliberately not entered while `curriculum_published` stayed read-only.
- **Item 2 CLOSED 2026-08-05 (late) — contract C3 → R12, and it was a MEASURED failure, not
  the risk it was queued as.** The pilot never ran `identify`/`describe`; pinning that mode
  combination at the published LA004-01-F objective found **4 of 18** challenges shipping two
  defensible options — in both directions (key `on` next to option `above`, key `above` next
  to option `on`), plus `below`/`under` and `beside`/`next_to`. Closed with a
  **geometry-driven** guard (`positionHolds` + `enforceSingleDefensibleOption`), not a synonym
  table — so it also covers `beside` ⊂ `left_of`/`right_of` before Grade 1 ever runs — and it
  makes R1 **code-enforced** for these two modes (an out-of-window key is now repaired, not
  merely discouraged in the prompt). **The probe found a second rule-#1 leak nobody had
  queued:** `correctPosition` was `options[0]` in **18/18** challenges and the component
  renders array order, so "tap the first button" solved every item without reading the grid —
  fixed with a seeded `placeAnswerSlot`. Post-fix **0/36 ambiguous** across an LA and a math
  K.G.1 control run, answer slots `{0:9, 1:10, 2:9, 3:8}`, **0 out-of-band words in the math
  control (R1 held)**. Gates: focused **34/34** (+19) with a **2-of-34 revert-bite on the
  wiring**, full Vitest **1,647/1,647**, typecheck:lumina **0**, tsc **803 = baseline**.
  Closing **`/eval-test` all 4 modes: 4/4 PASS**, R12 clean on all 6 `identify`/`describe`
  challenges, and **contract R11 upgraded INFERRED → OBSERVED** as a by-product (all 3
  `place` challenges targeted an empty cell — the contract had asked for exactly this on
  first contact). Reports `qa/la-k2-grammar/spatial-scene-c3-exclusivity-2026-08-05.md`
  + `qa/eval-reports/spatial-scene-2026-08-05.md`.
- **New finding, QUEUED not fixed (item 2b, `/eval-fix`, tracker SS-5):** the closing
  eval-test found the `identify` **hint hands over the answer** — *"Is the flower right
  **above** it?"* against a key of `above`, **2 of 3 hints**. Pre-existing and independent
  of R12, but it defeats the same skill R12 just made answerable, so it stays with this
  primitive rather than a future sweep. `buildSharedContext` already asks for hints that
  don't give the answer and the LLM ignores it — so the fix is a hard per-mode constraint
  plus a post-process check, not more prose. One wrinkle to carry: a hint leaked *"next
  to"* for a key of `beside` **after** R12 removed `next_to` from the options, so the
  check must cover synonyms, not just the literal key.
- **Item 1 CLOSED-BY-SPLIT 2026-08-05 (latest) — `in` + `between` SHIPPED; contract C2 goes
  from OPEN to PARTIALLY RESOLVED.** The flagged R11 edit was taken as a **fork, not an
  edit** (ladder rung 1, eval-mode split): containment is `place_in` (β 1.5) and targets the
  cell the container **OCCUPIES** — R11 inverted — while `place_between` (β 3.5) is judged
  from **two** references by `betweenHolds`/`resolveBetweenCell`. The load-bearing decision
  is that **neither word joins the position window**: `composePositionWindow` filters them
  out by construction, so a lesson asking only for containment leaves the K math vocabulary
  byte-for-byte intact (new **R15**), and R11 stays unconditional for `place`. Both new
  modes derive `correctCell` in **code** — neither schema carries a cell — and reject rather
  than guess (non-container, unresolvable reference, non-collinear pair, occupied gap,
  pre-placed target). **Demand converts at the routing layer:** re-probing the published
  objectives, LA004-05-B (*"Put the pencil in the box"*) now routes to `place_in` and
  LA004-01-F to a `place_in|place|place_between` blend — unprompted. That routing probe also
  caught a **real defect nobody had queued: a blend pin was resolving to null**, so the
  generator produced *every* mode — at six modes a 17-challenge session instead of the three
  the curator chose; parsed locally rather than in the shared helper ~60 generators depend
  on. Gates: **27/27** real-Gemini challenges judged independently (incl. a math K.G.1
  control — every `place` cell empty, 0 out-of-window keys/options), focused suite **49/49**
  (+15) with a **3-of-49 revert-bite**, a **NEW jsdom component drive 8/8** with a
  **2-of-8 revert-bite** (this one earned its keep: pre-fix the correct containment answer
  was *literally unclickable* — a failure `tsc` and the generator suite are both blind to),
  full Vitest **1670/1670**, tsc **803 = baseline**. Report
  `qa/la-k2-grammar/spatial-scene-containment-2026-08-05.md` · Contract **R13/R14/R15**.
  **Residuals, honest:** (1) no real-browser look at the nested render — jsdom asserts the
  DOM, not whether "in the box" *looks* like inside the box → **HUMAN-CHECKS #67**; (2) the
  138 demand number still has not moved (same as the pilot — that needs item 6's draft-first
  re-target); (3) `hint` is confirmed **never rendered** by the component, which re-frames
  queued item 2b from "fix the leak" to "decide whether hints should render at all".
- **Next:** **item 1b** — `in_front_of`/`behind`, which is a **DESIGN RULING, not code**
  (viewer-relative is ambiguous with above/below in a top-down grid — a rule-#1 hazard).
  If the ruling isn't wanted now, the buildable pulls are **item 2b** (hint/dead-field
  decision, small, same primitive) or **item 4** (`word-sorter` K picture-pair, 3 subskills).

### (PARKED 2026-08-05 — queue DRAINED; kept in place as the history record, not an ACTIVE pull) Reader-fit K → EMERGING queue — last touched **2026-08-05** (**§14l CLOSED 2026-08-05 — flashcard-deck final-assessment scope/count binding.** The requested count and the taught-concept scope both lived in **intent prose**; `config.cardCount` is stamped by no manifest producer anywhere in the repo, so a "10 simple review cards" ask fell through to `defaultCount` 15 while the prompt's own rules invited expansion and the `cards` schema array was unbounded. New `service/flashcard-deck/resolveDeckRequest.ts` applies the 14h resolver template to a non-numeric axis — one temperature-0 structured call yielding `{requestedCount, isReview, taughtConcepts[]}`, never a regex. Binding is a **constraint-presence fork** (14j's shape, contract C1) so generic open-study decks stay byte-identical at 15; under a review scope the two expansion-inviting rules invert and a TAUGHT CONCEPTS block forbids new vocabulary, with code comparing count-vs-concepts so surplus cards revisit angles rather than pad. Schema array bound to the resolved count + post-parse slice; `buildGradeLine(ctx.grade)` threads canonical grade. **Contract C2 ruled: the K 6-card cap wins over a requested count at PRE** — a developmental load rule, deliberately narrow, with R8 still forbidding new caps elsewhere. Live: G1 census replay **exactly 10** cards with zero untaught vocabulary (no patent/prototype/Internet/medicine); the **K community-helpers census instance closed as a rider**; G5 generic control unchanged at 15; K PRE control 6 cards / 6 distinct emojis; tutor probe 0 findings. Contract derived same slice (9 R, 2 conflicts, **zero authored-map consumers — every consumer is manifest-emergent, mostly the finalAssessment slot**), `--check` **COMPATIBLE**; catalog `constraints` padding invitation removed. Focused 20/20 with revert-bite (10 fail pre-fix), full Vitest **1,589/1,589**, typecheck:lumina 0, tsc 803 baseline. Anchor correction recorded: the generator is `gemini-flashcard.ts`, not the `gemini-flashcard-deck.ts` the queue and both censuses name. Reports `qa/reader-fit/flashcard-deck-14l-2026-08-05.md` + `qa/primitive-contracts/flashcard-deck-check-2026-08-05.md`. **NEXT = re-read the §14 pull order; the EMERGING census is drained except 14g's DI-owned half.** Prior day: **§14m CLOSED 2026-08-04 — the FULL SWEEP shipped in one slice: 20 generators** (hundreds-chart/14i's hard `?? '2'` + the six K-2/elementary prose resolvers + coin-counter/14c per contract gap G2 + 12 chemistry incl. `matter-explorer`, an inline-resolver census under-count found in-flight) **now resolve canonical-first** — exported per-generator mapper over `ctx.grade`, legacy prose/default fallback kept everywhere, explicit `config.gradeBand` pins still outrank. **The chemistry "may not bite" guess was WRONG in the published band**: safety-lab sent K to 6-8 off the '6' in the kindergarten prose "(ages 5-6)"; states-of-matter/reaction-lab sent published G1/G2 to 3-5 — verified, fixed, probed (K→K-2, G1→K-2, G2→K-2). Where the LLM stamped `gradeBand` via schema (fraction-circles + 6 chemistry) code now stamps the band when a canonical grade exists. Headline probe wins: fraction-circles G1 dens ≤4 (was ≤12), timeline-builder G2/G4/G7 reach 2-3/4-5/6-8 (all previously unreachable), coin-counter G2 drew a **half-dollar** (`MEAS002-05` pool live for the first time), hundreds-chart G4 → [3,4,6,7,8]. Gates: 43 new tests / 7 suites with revert-bite per generator, typecheck:lumina 0, tsc 803 baseline, full vitest 1400/1400, 21 real-Gemini probes. Reports `qa/reader-fit/14m-sweep-2026-08-04.md` + `qa/reader-fit/hundreds-chart-14i-2026-08-04.md`. 14i's intent-focus half measured IN-DESIGN (6/7 on named intervals); its 120-grid capability half stays open (fork territory). NEXT by pull order = **14h number-sequencer** → 14j → 14k/14l. Prior day: **§14m PILOT DONE 2026-08-03 (evening): number-line ships the canonical-grade-first template — contract-first (`docs/contracts/number-line.md` derived, 12 R, C1 OPEN → 14k), `--check` COMPATIBLE, focused wiring tests 7/7 with revert-bite, typecheck:lumina 0 / tsc 803-baseline / full vitest 1327/1327, 10 real-Gemini eval-test probes incl. `grade=4 → 3-5/decimal` — the FIRST runtime 3-5 render on the ctx path — and `grade=1 → K-2` for all 8 authored G1 consumers. PREMISE CORRECTION recorded for the sweep: production passes grade-context PROSE and every production sentence matched the old K-2 substring test ("grades 1-5" has a `1`, "thinking" has a `k`), so the live defect was EVERYTHING-lands-K-2 / 3-5 unreachable — not G1→3-5; verify each sweep target's actual input string before predicting direction. 14k replay measured honestly: band fixed, 14k STAYS OPEN with mechanism pinned into contract C1 (K-2 ≤30 clamp vs authored ≤120 + uniform pool-window placement + any-interior accept — fork required). **Committed `dcfaac7`** (slice-only; the concurrent DI session's in-flight files left for its own commit). Report `qa/reader-fit/number-line-14m-2026-08-03.md`; check report `qa/primitive-contracts/number-line-check-2026-08-03.md`. NEXT = the 14m SWEEP: hundreds-chart (14i, the `?? '2'` shape) → sorting-station / number-tracer / fraction-circles / shape-composer / net-folder / timeline-builder → coin-counter (14c rides) → 11 chemistry last (verify the defect bites first). Earlier same day: §14f DONE & SHIPPED `7ba48ba`.** Pilot swapped off coin-counter by user ruling 08-03: the first version named coin-counter because its contract already documented the defect as gap G2 — i.e. it was the *cheapest* pull, not the highest-leverage one. That is the trap the user named — a heavily-worked primitive keeps winning pulls because prior work makes each next item cheap, regardless of demand (coin-counter routes **3** across both censuses yet had consumed 2 build slices + 2 contract checks + 2 human-check rows). number-line carries real census demand via **14k** and its defect is confirmed at `gemini-number-line.ts:890` — `elementary` prose contains no 'k'/'1'/'2', so a Grade-1 objective lands on the `3-5` band and the range resolver then falls back to grade-band defaults. Cost accepted honestly: number-line has no contract, so contract-first adds work coin-counter would not have needed — paying it once is the point. See [[feedback_worked-primitives-self-select]])
- **14h CLOSED 2026-08-04:** number-sequencer blend + scoped Grade-1 120 fidelity is
  contract-first and runtime-verified; generic ≤100 preserved; all five modes PASS;
  full Vitest 1406/1406. Report `qa/reader-fit/number-sequencer-14h-2026-08-04.md`.
  **14j and 14k are closed; next = 14l.**
- **14j CLOSED 2026-08-04:** annotated-example exact scenario/grade/operation
  binding is contract-first and runtime-verified. The recorded 4×5 dime/200¢
  replacement now fails deterministic validation; the coin final-payload oracle
  passes 3/3 live, 108–111 remains exact, and advanced calculus remains legal.
  Report `qa/reader-fit/annotated-example-14j-2026-08-04.md`.
  **Next = 14l flashcard-deck.**
- **14k CLOSED 2026-08-04:** number-line exact missing-number fidelity is
  contract-first and runtime-verified. Canonical Grade-1 objectives may retain an
  explicit 0–120 domain while a focus-aware local window keeps the line legible;
  additive exact-target grading preserves legacy any-interior `between` behavior.
  Contract C1 is resolved. Real eval-test 4/4, tutor live standalone and lesson 3/3,
  browser exact-click pass, focused 29/29, full Vitest 1,569/1,569. Report
  `qa/reader-fit/number-line-14k-2026-08-04.md`. **Next = 14l.**
- **Queue:** `my-tutoring-app/qa/reader-fit/BACKLOG.md` (top = next).
- **Executor skills:** `/reader-fit [--fix]`, `/eval-fix`, `/tutor-test`
- **Re-prioritized by Pulse walk 2026-07-16 (user):** two live K-math findings jump ahead of the
  supply-side #9a–#9d tail. **(a) comparison-builder #2b** chrome band-gate is now PEDAGOGY-CRITICAL —
  the K screen still shows "Left: 3 / Right: 5" count badges that hand the child the answer (rule-#1
  violation), plus a one_more_less scaffold that's silent on "one less". **(b) NEW item 11** —
  addition-subtraction-scene `act_out` promises "drag the frogs out" but only offers a number-tile
  proxy; K must enact the scene (direct-manipulation-first). Two systemic generalizations seeded
  (direct-manipulation for act/build scenes; on-demand "🔊 Read me" replay across eval modes).
  Verified & struck: HUMAN-CHECKS #2 (knowledge-check @ PRE) + #6 (deep-dive @ PRE) — user Pulse-confirmed.
  **Paste-able handoff prompts for all three findings:** `my-tutoring-app/qa/HANDOFF-reader-fit-pulse-2026-07-16.md`.
  **Explainer-tail #9b–#9d handoff (concept-card-grid / comparison-panel / flashcard-deck):**
  `my-tutoring-app/qa/HANDOFF-reader-fit-explainer-tail-2026-07-16.md`.
- **In flight 2026-07-16 (parallel sessions):** #9a delegated (own workstream). **#9b concept-card-grid /
  #9c comparison-panel / #9d flashcard-deck — ALL THREE READY @ PRE 2026-07-16** (ctx-native generator
  refactor + `gradeLevel` stamp + code-attached emoji + catalog PRE-READER directive + component band-gate;
  typecheck:lumina 0, full suite 799/799, new jsdom 15/15, eval-test + tutor-probe PASS at K). Residual =
  Tier-3 live `--lesson` + pixel → HUMAN-CHECKS #27/#28/#29. Reports: `qa/reader-fit/{comparison-panel,
  concept-card-grid,flashcard-deck}-PRE-2026-07-16.md`. **The K explainer tail now drains.**
  **#2b comparison-builder — 3 Pulse priorities DONE 2026-07-16** — (1) K chrome band-gate kills the
  "Left: 3 / Right: 5" count-leak + hides counter/mode-tabs/grade+type badges at K (group pictures +
  "=" kept); (2) one_more_less symmetry — component `voiceOtherOneMoreLess` silent `[DISAMBIGUATE]` +
  catalog ORIENT rewrite, **live `--lesson --runs 3` decrement spoken 3/3**; (3) persistent 🔊
  `ReadMeButton` shared helper (first instance of the systemic replay item). Contract-first:
  `docs/contracts/comparison-builder.md` derived, edit COMPATIBLE (no fork). Verified tsc 0-new +
  typecheck:lumina 0 + jsdom 12/12 + full suite 790/790 + tutor-test Tier-1/2 pass. Report:
  `qa/reader-fit/comparison-builder-PRE-2b-2026-07-16.md`. Head **Committed `39f2543`** (pixel → HUMAN-CHECKS #26).
  **2b TAIL DONE 2026-07-20** — Audit-C rule-5 feedback-on-object (text card hidden at K, wrong tap shakes the
  touched object) + per-mode PRE picture passes (compare_numbers → tap the bigger numeral + `=`, no `<>` /
  alligator / Check; order → wordless graduated-bar direction; one_more_less → 5-cell window + wordless ⬆/⬇ +
  tap=choose). Band+mode fork (builds contract G1). Verified jsdom 25/25, full 857/857, typecheck:lumina 0,
  eval-test @ K 3/3, contract `--check` COMPATIBLE. Report: `qa/reader-fit/comparison-builder-PRE-2b-tail-2026-07-20.md`.
  Residual: live `--lesson` + pixel → HUMAN-CHECKS #35. **comparison-builder #2b now FULLY RESOLVED.**
  **#11 addition-subtraction-scene `act_out` @ K DONE + USER-CONFIRMED LIVE 2026-07-16** — TRUE direct
  manipulation (seed startCount → tap-add/remove → auto-judge on the enacted count); fork by band+mode
  (solve_story tiles + create_story build + Grade-1 count model all preserved); deterministic
  tap-accurate instruction. **Two same-day browser-reported follow-ons, both fixed:** (a) scene objects
  were unclickable — SVG `<g>` had no hit area; added a transparent hit-target `<circle pointerEvents:all>`
  (real-browser proof via playwright-core + Chrome; jsdom is blind to this — memory
  `svg-g-unclickable-jsdom-blind`); (b) `solve_story` "count the bunnies" was inert — added a tap-to-count
  aid (ordinal badges in tap order + highlight, result-unknown only; tiles still answer). Verified vitest
  **7/7** + eval-test @ K + **live `--lesson` 3/3** + **user browser check (full session 100%, Act Out +
  Solve Story)** → HUMAN-CHECKS #25/#26 struck to Done. Contract + changelog:
  `docs/contracts/addition-subtraction-scene.md`. Report: `qa/reader-fit/addition-subtraction-scene-item11-2026-07-16.md`.
  **Committed `39f2543`** (folded into the coordinated reader-fit slice).
  **#9a Step 1 (contract) DONE 2026-07-16, then PROMOTED (user-approved) to its own workstream,
  now PARKED 2026-07-16 (B1 shipped)** — see the PARKED media-player row; #9a is no longer in this
  queue (reader-fit tail = #9b–#9d + 2b tail + #11 residuals).
  Multiple reader-fit sessions live — shared files (BACKLOG, WORKSTREAMS, catalog, `run_tutor_live.py`,
  EVAL_TRACKER) will collide; each session re-reads before editing and commits its primitive + its
  strike in a tight slice.
- **Direct-manipulation census DONE 2026-07-16** (the item-11 session's sibling audit swept ~60 math
  primitives — that IS the census of record, do not re-sweep). Findings promoted to discrete fix
  items. **#12 ten-frame make-ten DONE 2026-07-16** — contract-first K band+mode fork: fixed seed →
  tap empty cells → auto-judge the enacted complement; stepper/Check removed only at K. K build +
  flash/hide subitize and Grade 1–2 make-ten preserved. Browser follow-on fixed: make-ten → add now
  clears the completed frame before operate begins. Verified jsdom 5/5, full suite 810/810,
  typecheck:lumina 0, eval-test 4/4 modes; report `qa/reader-fit/ten-frame-item12-2026-07-16.md`;
  pixel/real-click → HUMAN-CHECKS #31. **#13 counting-board subitize DONE 2026-07-20** —
  contract-first flash-then-hide DISPLAY fork (K band+mode: objects render only during the flash,
  stepper/Check gated behind the hide, `handleObjectTap` no-op so the scene can't be tap-counted);
  count_all @ K + Grade-1 subitize + Pre-K perceptual all unchanged; no generator/schema/catalog
  change. Verified jsdom 3/3, full suite 844/844, typecheck:lumina 0, eval-test @ K PASS (content
  unchanged). Contract `docs/contracts/counting-board.md` (R4); report
  `qa/reader-fit/counting-board-item13-2026-07-20.md`; pixel → HUMAN-CHECKS #34. **Next =
  coin-counter `count-like` confirm/clear (Task 3).** Execution handoff:
  `my-tutoring-app/qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`.
- **Now (2026-08-01): §14a DONE; the EMERGING queue is evidence-seeded.** Six published Grade-1
  subskills (2× LA / 2× Math / 2× SS) ran through the real `/topic-trace` pipeline: **42 generated
  components, zero generator errors**. The routing census is led by knowledge-check 6, sorting-station
  4, foundation-explorer 3, then seven primitives at 2 each. Reports:
  `qa/topic-traces/g1-*-2026-08-01.md`; ranked findings live in `qa/reader-fit/BACKLOG.md` §14.
  **14e DONE 2026-08-01:** the numeric Grade-1 generator boundary now stamps topic-driven and final
  assessment configs with raw `objectiveGrade`, then resolves it through the one canonical parser;
  numeric prompt bands reuse that parser too. Two live trace replays stamped Grade 1 on **15/15**
  calls and cleared `phonics-blender` K → 1; primitive-local `hundreds-chart` 2 and DI generic prose
  remain queued. Full vitest 1,076/1,076; Lumina typecheck 0; tsc 803 baseline before/after.
  Reports: `qa/topic-fidelity/numeric-grade-generator-boundary-2026-08-01.md` and
  `qa/topic-traces/g1-numeric-grade-14e-replay-2026-08-01.md`. **14b DONE 2026-08-01** (parallel
  session): coin-counter G1 `count-like` now enacts the tag — the child taps each coin (re-tap =
  rejected double-count), then still TYPES the total, keeping the β1.5 answer act and the
  "summation" half of `MEAS001-07-c` student-produced (full K parity was deliberately REJECTED);
  `showRunningTotal` reconciled as the enacted-display lever (easy = climbing skip-count
  readout/badges, medium/hard = plain ✓ tags). Contract **R11** + `--check` **COMPATIBLE**;
  report `qa/reader-fit/coin-counter-14b-2026-08-01.md`; pixel/feel → HUMAN-CHECKS **#58**.
  **14f DONE 2026-08-02:** knowledge-check now consumes precise Grade 1, schema-bounds every
  problem shape, and renders bounded existing visual evidence for map/symbol/invention tasks;
  visual text-column matching is converted per problem while nonvisual mixed siblings and K/PRE
  remain intact. Contract derived + check **COMPATIBLE**; real-Gemini analyze/map/K probes pass;
  both failing census topics replay clean; full 1085/1085, Lumina typecheck 0. Report:
  `qa/reader-fit/knowledge-check-14f-2026-08-02.md`; pixel → HUMAN-CHECKS #59.
  Both 14e and 14b had paste-able
  handoffs (`/pm` 2026-08-01, file-disjoint — safe as two parallel sessions):
  `qa/HANDOFF-reader-fit-14e-numeric-grade-2026-08-01.md` +
  `qa/HANDOFF-reader-fit-14b-coin-counter-g1-2026-08-01.md`.** Next by observed demand:
  DI intent fidelity 3/42 (coordinate with the active DI stream) →
  number-sequencer/hundreds-chart 2 each → annotated-example → number-line/flashcard singletons.
  **coin-counter `count-like` @ K — VERDICT PROXY (CLEARED=false), FIXED.** K now enacts the count:
  tap each coin, a badge stamps the **running skip-count total** (5→10→15) in tap order, auto-judge
  when every coin is counted exactly once, no number input and no Check at K; a re-tap is a rejected
  double-count that shakes the object, so the path is failable rather than a walk-through. Fork is
  **band+mode**; Grade 1+ and every `count-mixed` card are byte-identical (`git diff` = **160
  insertions, 0 deletions**). Contract derived first (none existed): `docs/contracts/coin-counter.md`
  — 10 requirements, C1 resolved, 6 gaps; `--check` **COMPATIBLE**. Verified tsc **0-new** (all 803
  pre-existing errors sit outside `components/lumina/`) + typecheck:lumina 0 + jsdom **9/9** with
  **both non-vacuity probes failing the right tests** + full vitest **930/930** + real-Gemini
  eval-test **6/6 @K, 6/6 count-like @G1, 6/6 count-mixed @G2** + a **real-Chrome mouse-click probe**
  (tap→5¢→10¢, double-tap holds at 10¢, →15¢, 0 inputs/0 Check, no page errors). Report:
  `qa/reader-fit/coin-counter-task3-2026-07-25.md`. Pixel/feel → HUMAN-CHECKS **#52**.
  - **Two rulings recorded.** (1) *Split mechanism:* the generator now **stamps
    `countMode:'like'|'mixed'` from `targetEvalMode`**; inspecting `displayedCoins` for a single
    denomination was REJECTED because the generator rejects multi-type sets for count-like but has
    **no converse rule** — a G2 count-mixed card drawing three dimes would have silently flipped
    into K's enacted mode and ablated a live consumer. (2) *`showCoinValues` on like coins:*
    **legitimate recognition aid, NOT a rule-#1 leak — kept default-true.** The denomination is the
    skip-count INTERVAL (an input); the total is never printed; coin-value recall is a different
    subskill (`MEAS001-07-b`→knowledge-check); and `identify` already hides values because there the
    value IS the answer. Narrow exception queued (G4: a one-coin card prints its own total).
  - **PREMISE CORRECTION — `count-like` is a GRADE 1 skill, and its Grade-1 consumer STILL has the
    proxy.** The census found the only authored consumer is **`MEAS001-07-c` @ Grade 1** ("Focus:
    Skip counting and summation… single-denomination sets"), and live routing confirms Grade 1.
    **There is no K money subskill in the curriculum at all** — the strand is G1 `MEAS001-07` + G2
    `MEAS002-05`; the K `MEAS001-07-A…F` sharing that stem is **"Time Durations"**.
    `PRIMITIVE_GAPS.md` GAP-007 mislabels them "MATHEMATICS (K)" — the likely origin of the K
    framing. **K is still reachable** (a K topic-driven money lesson routes `identify`→`count-like`),
    so the fork is live code — but the PRIMARY consumer is Grade 1. Not widened unilaterally: Grade 1
    carries β1.5 item history and changing its interaction deserves its own slice. → **gap G1, the
    first item for the EMERGING census.**
  - **Other gaps opened:** **G2** `resolveGradeBand` parses `ctx.gradeContext` PROSE (which
    `GenerationContext` explicitly forbids) so **Grades 2–3 are unreachable** and G2 money lessons
    silently run as Grade 1 (`/topic-fidelity`); **G3** K chrome (grade badge / "1/2" counter / phase
    badge) is not band-gated and the instruction has no 🔊 — surfaced by the pixel check, the same
    class comparison-builder fixed in #2b; **G5** count fallback is a MIXED set; **G6** the catalog
    advertises a K band the curriculum lacks.
  - *Superseded (kept for the record — the handoff that drove this):*
  **`qa/HANDOFF-reader-fit-coin-counter-2026-07-25.md`.** The 07-16 prompt was written blind and
  misnames the target (`count-like` is a CATALOG eval mode, `catalog/math.ts:3613` β1.5; the
  component challenge type is `'count'`, `CoinCounter.tsx:39`, shared with `count-mixed` β2.5 — a
  session grepping the component for "count-like" finds nothing). The new handoff carries a
  completed line-exact read whose **indicated verdict is PROXY, not clear**: `renderCountChallenge`
  (`:632`) renders coins via `renderCoinGroup` → `<CoinVisual disabled />` (`:599`, no `onClick`)
  and takes the answer as a typed `LuminaInput type="number"` (`:640`) behind a Check button
  (`:928`/`:931`) — so K is compute-then-type over an inert coin set, the item-11/12 shape. It also
  names the two rulings the session must record (count-like vs count-mixed can't be told apart by
  `challenge.type`; `showCoinValues` default-true on LIKE coins = aid or rule-#1 leak?) and makes
  **contract-first REQUIRED** (no `docs/contracts/coin-counter.md`; 6 eval modes span K–3, and
  Grade-2/3 `count-mixed` shares the render path). Closing this **drains the demand-side K queue** →
  milestone: re-run the topic-trace census at grade 1 (EMERGING).
  *Prior framing, kept for the record:* #13 closed; **2b tail closed 2026-07-20** (see the #2b
  row above). Remaining pull = **Task 3 — coin-counter `count-like` confirm/clear** (the last
  un-swept direct-manipulation candidate from the 07-16 sibling census). **Confirmed genuinely open** —
  `CoinCounter.tsx` has a `gradeBand` prop but NO `isK` fork anywhere (it only picks the grade
  LABEL at line 321/844), so the K `count-like` interaction has never been band-gated or
  direct-manipulation-audited. It is a READ-then-verdict task (~30 min), not a build: enacted count
  → record CLEARED under the systemic note; stepper/number-pad over a manipulable coin set → promote
  a new BACKLOG item with the item-11 fix direction. No source edit unless it's a confirmed proxy.
  Then, with the demand-side K queue drained, re-run the topic-trace census at grade 1 (EMERGING) to
  re-seed the band.
  **Stale line removed 2026-07-24:** the "uncommitted `CountingBoard.tsx` + contract + QA docs"
  note was true on 07-20 and is now false — that sibling slice SHIPPED (tree carries no reader-fit
  files; the only uncommitted surface is DI).
- **History (#9 explainer tail):** pilot + fact-file DONE 2026-07-15, tail reconciled. The
  "same shape → one pattern" premise held for only 1 of 5: pilot **foundation-explorer @ PRE
  READY** (live `--lesson` 3/3) + a reusable **`PreReaderSelfCheck` helper** extracted; **fact-file
  @ PRE READY** via the helper (jsdom 6/6, eval-test K 2/2, live queued). The other four are NOT
  the same shape (no MCQ / true-false gate / no grade threading / no tutoring block) and are queued
  as **BACKLOG #9a media-player** (now a **REIMAGINING** per user pivot 2026-07-16 — contract-first
  via `/primitive-contract`, then re-build across K/EMERGING/ESTABLISHED reading modalities inspired
  by deep-dive/interactive-passage; supersedes the old band-gate plan), **#9b concept-card-grid** /
  **#9c comparison-panel** / **#9d flashcard-deck** (bespoke: read-aloud-on-flip / picture-T-F +
  ctx-native generator refactors + grade threading). #2b comparison-builder remaining still DEFERRED
  to K-stage. (#10 word-workout+word-flip, #8 rhyme-studio, #7 phonics-blender, #1e sorting-station
  all **DONE 2026-07-15**.)
- **Milestone (after #9a–#9d + #2b close, the K queue drains):** re-run the topic-trace census at
  grade 1 (EMERGING) to re-seed the queue at the next band. #10 was the last *demand-side*
  (census-routed) K item; the explainer tail (#9a–#9d) is the remaining supply-side text-surface work.

### 2. Direct Instruction primitive family (graduated from bench) — last touched **2026-08-05** (**reader-fit 14g CLOSED 2026-08-05 — `di-math-facts counting_next`, fork resolved as Option B and GATED.** The census finding had two layers and only one was a bug: `resolveTextScope` captured `(\d{1,2})`, so the published G1 objective "counting forward … within 120" parsed as **"within 12"** and every three-digit ask was silently MANGLED rather than saturated (100 → 10). Fixed to `(\d{1,3})\b` — the `\b` matters, since a bare `\d{1,3}` reads "202" out of "to 2026". **The clamp did not move:** `Math.min(20, …)` stays, so a 120 ask now saturates at the pack's benched twenty — the di-sentence-reading precedent (a benched ceiling is a hard cap that saturates, never a knob), and twenty is the last SINGLE-WORD entry in `NUMBER_WORDS`, i.e. the edge of the #46-benched response class. **Layer two is why this is a fork, not a wider clamp:** every answer past twenty is a multi-word numeral ("one hundred seven"), an unbenched spoken response class that DI standing gate 1 blocks. User chose Option B (extend) over Option A (saturate + steer high-range counting to number-sequencer/number-line), so what shipped is everything up to the gate PLUS the gate itself: a new bench set **"Counting to 120"** (10 hand-rolled items, new `DIItemKind: 'counting'`) whose cue LINES are the #46-benched wording byte-for-byte (already `problem`-phrased, so it reads correctly for counting) but whose JUDGING BAR forks — the generic "reasonably close for a kindergartener" would rubber-stamp exactly the teen/decade near-miss the sitting exists to detect, so the counting branch mirrors the pack's shipped contract (strict on a different number AND on an incomplete compound; permissive on child pronunciation and counting up). Teens are deliberately never cross-aliased with their decade siblings — that would hide the confusion in the disagreement meter. Gates: 12 new tests with **4-of-6 revert-bite** on the focused scope suite, DI+bench 212/212, full Vitest **1601/1601**, typecheck:lumina 0, tsc **1021 = HEAD baseline, 0 new**, standing gate 2 re-scanned mechanically (241 sentences, 0 unexpected sentinel openers), **real-pipeline 5/5** (census objective now reaches 17 pinned / 18 at `hard`, `subtraction_fact` shares the ceiling honestly, K within-5 + G1 within-10 controls unchanged, zero `undefined` answer words). **Honest residual: a 1–120 objective is served within TWENTY** until the sitting passes — that is saturation, not the defect, but it is not what the objective asks. Option A's catalog steering was deliberately NOT taken (B reverses it), so if the sitting slips, take it as an interim. Extension queued line-exact as **BACKLOG item 10**; sitting = **HUMAN-CHECKS #63**. Report `qa/tutor-reports/di-math-facts-14g-2026-08-05.md`. Prior: **TWO rungs closed 2026-08-03. (1) di-sentence-reading `/add-structural-difficulty` (L4) DONE — first pack at L4, the family's L4 template**: the tier now drives BOTH dials — DISTAR fade (L3) + sentence-LENGTH band (L4): easy [3,4] / medium [5,6] / hard [7,8] inside the session ceiling, clamped in `resolveProblemShape`, enforced at selection by `rankByBand` (one key two places; prompt advisory, code authoritative; the **benched 8-word ceiling stays a hard cap, never a knob** — K/narrowed ceilings saturate honestly); pool identity outranks the band (sight stays sight; review keeps nearest-band lesson anchors); 7 menu additions (one 7-8w sentence per pure vowel + 2 sight-heavy, all from established vocabulary) give the hard band real pool support; template lesson for the L4 siblings — trim candidates to the band WINDOW before the variance rotation (its family-novelty pull out-ranked the band; caught by the new suite pre-live); NO spoken copy changed → no new ear row, the 8-word COLD read (L4×L3 hard) folds into the pack's next sitting. Gates: typecheck:lumina 0, tsc = 1021 baseline, 17 new tests (non-vacuity: 9 fail on revert), full vitest 1303/1303, live `/eval-test` sweep 6/6 on an isolated :3005 (hard 7-8w / easy 3-4w / mixed+medium all-tiered / K saturation / scope-beats-band / no-tier control). Report `qa/eval-reports/di-sentence-reading-structural-difficulty-2026-08-03.md`. **Next serial rung = di-letter-sounds L4** (item-set composition per birth cert), then di-math-facts L4, then di-word-reading L1 backfill. **(2, earlier same day) di-word-reading `/add-tutoring-scaffold` (L2) DONE, committed `66a2d66` — the family is now ENTIRELY catalog-resolved; no pack ships a script-local tutoring block.** `DI_WORD_READING_TUTORING` moved into `catalog/di.ts`, so both connect paths resolve it from the single source of truth; cue lines + `correctionLine` byte-untouched (#55 still gates the contrastive port). Added what L0 deferred: `{{challengeType}}` + 4 contextKeys (`challengeType`/`word`/`wordType`/`words` — the SENTENCE precedent, nothing withheld, since the printed word is stimulus and target both), 5 observed `commonStruggles` (near-neighbour matt/son/read as the signature class, plus one PROTECTIVE struggle so an over-strict tutor cannot punish audible blending), a generator flat `words` summary, and the component `updateContext` sync. **ONE new directive clause**, because `words` newly puts unread words in RUNTIME STATE: never preview a word that is still coming. The handoff's 5th key (`graphemes`/sound-out) was dropped by design — absent on every sight word, derived rather than generated (so it can never resolve at probe time; the first probe run showed the `(not set)` break), and already carried verbatim in the `[DI_ITEM]` cue. Gates: typecheck:lumina 0, `npm test` 1286/1286, Tier 1 **0 HIGH** (the family's 2 structural WARNs), **Tier 2 × 3 content shapes** all keys resolved / zero `(not set)`, standing gates 2+3 re-verified mechanically over the assembled prompt. Live glance (5 struggles → chattiness; the never-preview clause needs a run reaching item 2+) rides the next DI sitting — NOT a new gate. **Second slice: reader-fit 14g's di-word-reading half CLOSED — verdict WRONG-PRIMITIVE, not the GENERATOR bug it was filed as**: a CVCe ask is out of this pack's benched scope, so serving short-vowel CVC is the correct degradation; the defect was the entry's own steering (the old constraints excluded digraphs/blends/multisyllable, and CVCe is none of those). Fixed in `constraints` + measured: `manifestOnly` traces on 14g's exact topic **2/3 → 0/3** picks, while the real homes still route 3/3 (short-a CVC @ G1) and 2/2 (sight words @ K). 14g's `di-math-facts counting_next` 1–120 half stays open as a genuine in-scope failure. Report `qa/tutor-reports/di-word-reading-2026-08-03.md`. **Next serial rung = di-sentence-reading L4** (axis built + measured; the 8-word benched ceiling is NOT a difficulty knob), then di-letter-sounds L4 / di-math-facts L4; di-word-reading's OWN next rung is `/add-eval-modes` (L1). Prior 08-01: **di-letter-sounds `/add-support-tiers` (L3) DONE — third use of the DI L3 template, the pack is now L0→L1→L2→L3**: the DISTAR fade composed in the SCRIPT (`leadInFor` + `coldSoundGuard`, easy = model+guide+test byte-for-byte the bench-proven block / medium = model+test / hard = COLD grapheme→sound retrieval); per-mode composition verified for the pack's three cue structures — the onset ask keeps the stimulus WORD while its first sound withdraws, the keyword-vowel ask keeps "Say apple" while the "short a" sound-naming withdraws (the cold guard is SOUND-scoped, never word-scoped); catalog second-channel audit came back clean like math's (level 1 repeats the PROMPT; levels 2-3 + struggles are correction territory — recorded in `catalog/di.ts`), plus the three closures anyway: per-item cold guard, `supportTier` contextKey threaded through connect/updateContext/`startDiRunLog`, cold-items clause in the LIVE-JUDGED directive; PLAIN correction untouched (contrastive port stays frozen on #55) and byte-pinned at every tier; no `tierSection` in the prompt (Fork A: a tier line could only nudge LETTER selection — L4's axis); no tester work (the family tier selector drove it unchanged). Gates: `typecheck:lumina` 0, new script suite 16/16 + 4 generator tier tests, **non-vacuity ×7** (siblings proved ×5), full vitest 1067/1068 (the 1 = CoinCounter.reader-fit, the concurrent 14b stream's in-flight file — not this slice), **3/3 real-pipeline probes** (pinned+hard all-hard scope-intact / mixed+medium all three identities tiered / no-param no-field byte-compatible; probes 2-3 ran on an isolated :3005 dev server after the shared :3000 broke under 14e's in-flight edits). Live `hard` ear-check → **HUMAN-CHECKS #57** (new row, mirrors #50(d)/#54(d), carries the onset+vowel glances). Report `qa/eval-reports/di-letter-sounds-support-tiers-2026-08-01.md`. **Next serial rung = di-word-reading L2** (catalog `tutoring:` move), then di-sentence-reading L4; `catalog/di.ts` is free again. Prior same-day: **item 8's 3-pack FLUSH SWEEP DONE, parallel lane** — `run-end` + deduped 6s tail + `teardown` flushes and the pre-connect `setClientRunId(mintRunId())` registration replicated byte-for-byte from the DiMathFacts pilot into di-letter-sounds / di-word-reading / di-sentence-reading; typecheck:lumina 0, full vitest 1041/1041; item 8 residual = the acceptance gate only (rides item 9 Tier 2 / a sitting); no non-math pack has flushed LIVE yet — each pack's next live run confirms free, artifact in `logs/di-runs/`. **BACKLOG item 5 STRUCK — stall fix BUILT, and LEVEL-2 RECOVERY CONFIRMED LIVE in a user fault drive**: dead cues at exactly 10s/20s → `session-dead` → warm reconnect **327ms** → `session-resumed` → in-flight item re-cued verbatim → affirm → advance; whole episode reconstructed from persisted artifacts alone (run `7f0a1543ff7c`, client teardown flush + server ledger = item 8's acceptance shape demonstrated); the drives caught two real bugs, both fixed same slice — the OPENER never armed the dead-cue watch (stale-`enabled` at arm time; ladder slept for the from-birth-dead session) and `sessionDeads` double-counted (flag→kind); residual runtime = level-3 card (`EPISODES=2`) + an end-coherent full run, folded into item 9 Tier 2's stall journey. Build detail, 07-31 per the dev-first ruling and the 07-27 handoff executed line-exact: (i) `LuminaAIContext.sessionResumeCount` → engine `session-resumed` emission → all 4 packs re-cue the item in flight through their resync branch (backend cold retry now safe for DI); (ii) engine dead-cue watch — cue→tutor-AUDIO liveness, never cue→verdict, 10s × 2 → `session-dead` → shared `useDiStallRecovery`: level 2 = warm `ctx.reconnect()` (mic never touched, open-mic doctrine), level 3 = picture-primary `DiStallCard` 🔄 + `flushDiRunLog('stall')` at the failure moment — never silent "Listening…"; (iii-a) standalone post-run disconnect removes the GoAway-flap trigger, (iii-b) server-side variant DEFERRED; dev-gated **`LUMINA_FAULT_MUTE_S`** fault injection (backend, refuses to arm unless `ENVIRONMENT=dev`) machine-covers item 8's induced-stall acceptance gate; verified vitest **1025/1025** (new session-liveness suite 11/11, fuzz hook-only-kinds invariant extended, reducer untouched/fuzz-clean) + `typecheck:lumina` 0 + py_compile clean; **runtime confirmation = the fault-injected drive**; #56 shrinks to the ear halves; slice report `qa/di-bench/slice-2026-07-31-item5-stall-fix.md`. **RE-POINTED `/pm` 2026-08-01 (user ruling: PUSH DEVELOPMENT):** top pull is the **family ladder** — **di-math-facts `/add-support-tiers` (L3) DONE 2026-08-01** (the birth-cert fade composed in the SCRIPT; 14/14 new tests with non-vacuity + 3/3 real-pipeline probes incl. the blended path; the tester gained the family tier selector that also makes #54(d) drivable; live `hard` ear-check → **#50(d)**; see the DONE entry below) — ~~next rung = di-letter-sounds L3~~ **DONE 2026-08-01, see the headline** (handoff `qa/HANDOFF-di-letter-sounds-L3-2026-08-01.md` executed; next = di-word-reading L2 → di-sentence-reading L4), then **item 2** remediation-lever design; **item 9 Tier 2 DEMOTED but queued** — it stays the absorber of item 5's residual runtime checks (level-3 🔄 card via `EPISODES=2` + an end-coherent run), build it when testing capability is warranted again. **Fault-flag time bomb DEFUSED same day** (user: "we are making ticking time bombs"): `LUMINA_FAULT_MUTE_S=25` removed from `backend/.env`, and the backend now REFUSES .env-persisted fault flags (process-env only, one loud ERROR; guard exercised 4-path in the venv). Full ruling text at the top of the BACKLOG. Prior 07-27: child-paced `answer_fact` K run COHERENT, diagnosed from the AUTO-PERSISTED log alone — no human copy: 5/5 completed, 3 plain-fallback corrections byte-stable → **#55(e) HALF-closed** (spoken-no-number half; the SILENCE route still rides the 90s micro-run), counting-aloud supersession chains absorbed benignly (item 9 Tier-2 "rapid double answers" class, first live observation → watch-item), `[DI_COMPLETE]` tail flush held, cuesStalled 0; report `qa/di-bench/run-2026-07-27-math-facts-answer-fact.md`. Prior 07-26: decoherence ROOT-CAUSED — voice turn gate `minVoiceMs` frame quantization, engine fix + retro-anchor — and VERIFIED live same day: coherent run through the family's **first live `[DI_MOVE_ON]`**; #49(c) + #50(a) CLOSED (both ear halves user-confirmed: move-on line heard, "My turn" works for math), #55(c)/(d-math) closed, #50(c) HALF-closed (subject override ✓ MATHEMATICS, but free-form landed `OPS002-04-c @ G2` → BACKLOG item 6). **PLUS the family's first REAL-CHILD run** (`qa/di-bench/run-2026-07-26-math-facts-stress-sitting.md`, corrected same day): judge-over-transcript HELD — ASR collapsed on child speech ("Please" for a spoken "three", user-confirmed) while the in-band judge contrasted the right number — and turn-gate fix + script shape held under barge-in chaos; **the real break = a mid-run STALL** (no verdict ever arrives, silent "Listening…", GoAway-resume drops the in-flight turn as lead suspect) → **BACKLOG item 5** (escalation ladder + re-cue-on-resume) + clock-skew WS hard-fail (item 7); residual — **user ruling: telemetry FIRST** — **item 8 BUILT + SMOKE-VERIFIED same day** (timestamps un-broken via basicConfig force; server JSONL session ledger with GoAway `mid_turn` stamping; `/api/di-run-logs` drop-box; client ring + auto-flush piloted in DiMathFacts; two live smokes: first caught the mint-after-auth correlation race + flush truncation, both fixed; second run 4/4 — `client_run_id` joins ledger↔run files; residual = induced-stall acceptance gate, rides the recipe sitting; then sweep flush to the other 3 packs) and **item 9 tier-1 SHIPPED** (seeded reducer fuzz in `npm test`, 0 violations → the stall lives above the reducers); **THE RECIPE RUN RAN EOD — COHERENT: item 1 CLOSED** (5/5 items capped, 5× `[DI_MOVE_ON]`, 14 byte-template contrastive corrections = #55 c/d-math at scale, echo rule 5/5 → mean 0 → S1 gate reached, no GoAway/stall; `qa/di-bench/run-2026-07-26-math-facts-sustained-miss.md`); **S1 CONFIRMED — the misconception loop's FIRST LIVE CAPTURE:** stored `"identifies the answer to a subtraction fact as the second number in the expression"` — correct 5/5, bounded, generative, Tier-A over garbage ASR; item 2's consumption half now has live Firestore data; next = 90s silence micro-run (no-verdict→resync + #55(e) + item-8 acceptance) → item-5 fix; tier-2 = DI journey family on `run_tutor_live.py`, not a new harness)
- **Item 11 OPENED 2026-08-05 late (user-pulled) — ✅ MACHINE HALF DONE 2026-08-06
  same-day: lesson-mode session tutor — the script outranks the student, + resume
  continuity.** Fixes shipped + machine-gated (pre-fix journey FAILED ≈50%/judged
  beat; post-fix 3/3 PASS zero findings; resume probe non-vacuous PASS; units
  22/22). Residual = the real-child #64(b) acceptance drive (restart the dev
  backend first). Slice report `qa/tutor-reports/lesson-tutor-item11-2026-08-06.md`. The user's son drove two real
  mixed-lesson open-mic sessions (the #64 shape in the wild) and **#64(b)
  failed**: his curiosity question mid-`machine-profile` ("are they going to
  build a bunch of apartments? can we go over there?") was answered with a
  verbatim recitation of the scaffold's level1 line. Root cause = prompt-priority
  inversion: unscoped "Never give direct answers"/"Socratic questioning" in
  `build_lesson_system_instruction` (`lumina_tutor.py:394-397`) beats the
  scaffold's own answer-then-redirect rule (`engineering.ts:152`) on a
  display-only primitive with nothing to protect. Separately: 7 Gemini-side
  connection deaths across the two sessions, resumption held 7/7 ≤500ms, but the
  visible one cut the tutor mid-sentence → ~17s dead air → re-orientation
  greeting instead of continuing ("the error where it disconnected"). Fixes =
  one prompt carve-out (curiosity questions get a real answer FIRST, one
  sentence, then bridge back; anti-leak rescoped to the active challenge) + a
  `[SESSION RESUMED] continue-don't-greet` injection + three riders ("(not set)"
  spoken aloud, switch-greeting debounce, chunk-inflated `session-end` turns).
  **Autonomous gate before the user re-drives:** new `lesson-curiosity` Tier-3
  journey in `run_tutor_live.py` replaying the child's exact 48s utterance blob
  (must FAIL pre-fix, then 3/3), fault-injected resume-continuity probe
  (`LUMINA_FAULT_MUTE_S` pattern, process-env only), 3 pytest units. Human
  acceptance = the next real-child drive (existing #64, no new row). Full
  analysis: `qa/tutor-reports/lumina-session-review-2026-08-05.md`; queue detail:
  `qa/di/BACKLOG.md` item 11.
- **Item 2 misconception consumption CLOSED 2026-08-04.** The restored
  `/add-misconception-loop` executor wired typed diagnosis→move resolvers and
  deterministic up-to-two-item emphasis across all four code-owned DI pools.
  Math pilot passed first, then the family Probe G matrix passed 11/11 with
  mode/scope/tier/count intact and zero diagnosis/remediation fields serialized;
  focused 91/91, full Vitest 1,569/1,569, Probe R 9/9, S4 pass. No wrapper prompt
  or spoken copy changed. Report `qa/misconception/di-family-2026-08-04.md`.
- **Latest closures (2026-08-04): requested serial run COMPLETE.** `di-math-facts` L4 now composes the DISTAR fade with the birth-certificate operand window: within-five → cross-five → cross-ten, clamped to the existing pool (normal within-ten K/G1 hard saturates at cross-five; no silent widening); 17/17 focused, 10/17 non-vacuity, live eval 10/10. `di-word-reading` L1 backfill adds `cvc_reading` β2.0 / preserved `read_word` β2.5 / `sight_word` β3.0 / `word_reading_review` β3.5 with real Fork-A single/blend/mixed pools; 12/12 focused and live pinned/blend/mixed PASS; the live sweep caught and closed the default review-window sight omission. Full Vitest passes 1,385/1,385; touched DI TypeScript errors 0 (global 805 vs 803 pre-slice due two concurrent unrelated math grade-band tests). Reports: `qa/eval-reports/di-math-facts-structural-difficulty-2026-08-04.md`, `qa/eval-reports/di-word-reading-evalmodes-2026-08-04.md`. **Item 2 remediation-lever DESIGN also CLOSED**: code-owned item re-ranking only, up to two targets + transfer, unknown/cross-mode no-op, no diagnosis sent to Gemini and no spoken-copy changes; pilot math subtraction then Probe G before sweep. Handoff `qa/di/HANDOFF-di-remediation-levers-2026-08-04.md`; implementation closed in the item 2 entry above.
- **Prior ladder closure (2026-08-03): di-letter-sounds L4 DONE.** The birth-certificate item-set axis now composes with the L3 fade: easy = unique continuants/no complete pair; medium = +short vowel/no pair; hard = `m/n` + `f/v` together at the default four-item capacity. Onset medium honestly saturates because vowels are forbidden by mode identity; hard still advances to the legal contrast pairs. The final composition window is enforced after mixed-mode rotation, closing the sentence-template variance trap. Gates: typecheck:lumina 0; tsc 803=baseline; new suite 17/17 incl. 2,048-set stress (10 fail on revert); full vitest 1320/1320; live eval-test 7/7. Existing #57 carries the live feel check; no new row. Report `qa/eval-reports/di-letter-sounds-structural-difficulty-2026-08-03.md`.
- **Queue:** `my-tutoring-app/qa/di/BACKLOG.md` — **GRADUATED 2026-07-20** (bench passed its
  architecture gate across 4 live runs; user call: DI = a new primitive FAMILY alongside
  core/math/literacy, first set custom-made). Old charter `qa/HANDOFF-di-bench-2026-07-16.md`
  is historical.
- **Executor skills:** `/primitive` (L0 birth per pack) + `/curriculum-fit` + `/eval-test` +
  `/tutor-test`; bench sitting per NEW response class before wiring (standing gate in the BACKLOG).
- **User-pulled 2026-07-16.** Test one turn controller over one Gemini Live audio session: exact
  I-do/we-do/you-do scripts, Live input/output transcription, and an asynchronous Flash-Lite JSON
  report that alone authorizes advance/retry.
- **DONE 2026-07-16 (POC slice):** **Direct Instruction Bench** (`di-bench`, home card 🎯).
  Shared Lumina owns only Live transport plus a generic ordered `structured_state_update` channel.
  `backend/app/services/di_turn_reducer.py` owns the DI schema, transcript aliases, and Flash-Lite
  reduction. `diBenchModel.ts` owns report parsing and authority (fresh aligned `match` advances;
  retry/unclear stays). `diScript.ts` owns exact pedagogy/cues; the panel owns orchestration and
  Copy-run-JSON diagnostics. The abandoned Azure phoneme/warm clip-judge branch was removed from
  shared production files. `typecheck:lumina` 0 errors; focused tests 11 frontend + 7 backend.
- **SUPERSEDED same-day (2026-07-16, live-judged pivot):** the Flash-Lite reducer was DELETED after
  run 1 of the live-judged rewrite PASSED (`qa/eval-reports/di-bench-live-judged-2026-07-16.md`).
  Live now judges in-band via sentinel openers ("Yes," / "My turn."); `diBenchModel.ts` classifies
  and alone advances; Gemini auto-VAD off, local amplitude VAD = turn authority (runs 3–4 tuned).
- **DONE 2026-07-18 (open-mic slice, user ruling: no force-mutes from the primitive):** echo gate
  removed from the bench VAD (speaking over the tutor = native barge-in); backend forwards Gemini
  `server_content.interrupted` → `ai_interrupted`, `LuminaAIContext` flushes playback on it (tutor
  audibly stops — generic transport, benefits all Live surfaces); cue pacing re-entrant (cues fire
  only into silence, held cues re-fire on audio-fall/voice-close/verdict edges); echo telemetry
  (`turnsOverTutorAudio`). tsc 0 new, vitest 12/12, py_compile OK. NOT live-exercised.
- **RUN 2026-07-19 (first open-mic live run): PASS on the full scripted loop** — 4/4 items affirmed,
  exact script fidelity, 4 clean VAD bracket pairs, **0 phantom turns**, cue cadence held; the Live
  judge affirmed a sustained /s/ from AUDIO while ASR wrote "Shh." (the architecture's thesis,
  demonstrated). Report: `qa/di-bench/run-2026-07-19-open-mic.md`. **Barge-in and speaker-echo were
  NOT triggered in this run** (no `ai_interrupted` in the backend log) — HUMAN-CHECKS #30 narrowed
  to that ~2-min probe.
- **PROBE RUN 2026-07-19 (run 2, run JSON): barge-in + echo EXERCISED, #30 STRUCK.** Barge-in
  verified end-to-end (deliberate talk-over interrupted + judged; /sss/ over tutor audio affirmed
  from audio). Echo leakage = 1 blip (peak 0.033 vs threshold 0.025) that chopped a cue line.
  **Three findings promoted to build inputs** (`qa/di-bench/run-2026-07-19-open-mic-probe.md`):
  **DI-1 (BUG)** — a sentinel verdict with no transcript-backed attempt is silently dropped →
  bench/model desync → model self-advanced (read bracketed cue aloud) → wrong-item credit; engine
  must anchor attempts to LOCAL voice-turn close, bind unanchored verdicts to the last unmatched
  voice turn, resync via re-cue after N off-script. **DI-2** — dual threshold: turn-open bar during
  tutor audio ≈ 2× silence bar (echo 0.033 vs real speech ≥0.068); calibration beat measures both
  floors. **DI-3** — ignore attempts until the first cue begins.
- **SHIPPED 2026-07-19:** open-mic slice + run reports committed `6635877` (+ QA docs `10b17d9`);
  main pushed & in sync.
- **Extraction step 1 DONE + RUNTIME-VERIFIED 2026-07-20, committed `4af21b6` (#32 struck):**
  `hooks/voiceTurnMachine.ts` (pure turn authority, DI-2 dual threshold, vitest 7/7 incl. the
  probe-run echo regression) + `hooks/useLiveVoiceTurns.ts` (activity brackets, ambient/echo EMA
  floors) + bench as pilot consumer. **User live run PASS**
  (`qa/di-bench/run-2026-07-20-hook-parity.md`): 4/4 items, **0 unanchored verdicts, 0 echo-opened
  turns** (floors 0.0008/0.0082 vs 0.05 barge-in bar — ~6× margin), barge-ins interrupted + judged,
  response times improved (1706/1192ms vs probe 2986/1882ms). New engine input from the run:
  a mid-cue attempt can consume a cue FRAGMENT as its verdict (benign off-script) — verdict
  classification must only consume tutor output that begins a NEW turn after the attempt closed.
- **Extraction step 2 CODE-COMPLETE 2026-07-20 (uncommitted):** the judged-loop engine.
  `hooks/judgedLoopModel.ts` (pure reducer: voice-anchored attempts DI-1 — attempts exist at LOCAL
  voice-turn close, transcripts only annotate; sentence-scoped sentinel scanning — fixes the
  mid-cue-fragment misread; off-script only on sentence+quiet; DI-3 arming; no-verdict timeout 8s;
  resync emission after 2 misses; vitest 13/13, every case traced to a live-run shape) +
  `hooks/useJudgedSpeechLoop.ts` (conversation feed, tutor-quiet clock, tick, cue queue with
  verify-beat + fire-into-silence; disable keeps the queued closing cue, clearQueuedCue for abrupt
  stops) + bench rewritten as pilot consumer (owns only DI pedagogy: script, progression policy,
  alias cross-check, run log; `classifyTutorJudgment` deleted from diBenchModel — collision test now
  runs against engine DI_SENTINELS). typecheck:lumina 0, full suite 844/844.
- **Step 2 RUNTIME-VERIFIED 2026-07-21 + COMMITTED (#33 struck):** user run PASS
  (`qa/di-bench/run-2026-07-21-engine-gate.md`) — 4/4, 0 unanchored, and the crown jewel: the
  probe run's transcript-loss failure RECURRED live (voice turn, no transcript, "Yes, sss.") and
  the voice-anchored attempt absorbed it — judged, advanced, no desync. Off-script-at-quiet
  exercised (tutor re-modeled without the "My turn" opener; engine stayed correctly). Resync/
  timeout unit-covered, not yet observed live (watch-items). Primitive note: tutoring directive
  should remind that EVERY correction begins "My turn:" (model dropped it on a re-correction).
- **DONE 2026-07-20 — `di-letter-sounds` BORN L0** (BACKLOG item 1 struck). First custom-made pack
  over the committed engine stack: new family `primitives/visual-primitives/direct-instruction/`
  (`DiLetterSounds.tsx` + hand-authored `diLetterSoundsScript.ts`), `catalog/di.ts`,
  `service/direct-instruction/gemini-di-letter-sounds.ts` (Fork A menu-scoped generator, no
  hardcoded items), `registry/generators/diGenerators.ts`, evaluation metrics + a
  `direct-instruction-tester` dev panel. typecheck:lumina PASS; eval-test PASS ×3 (topic fidelity
  confirmed); curriculum-fit MATCH (K LA Letter-Sound Correspondence, 0.788 — the starved GK band).
  Birth cert + 6-layer follow-up queue: `qa/eval-reports/di-letter-sounds-birth.md`. **Live loop
  UNVERIFIED through the primitive → HUMAN-CHECKS #36** (engine 4 runs PASS). Two L0 gaps to
  `/add-tutoring-scaffold`: lesson-mode connect needs `manual_activity`+DI-tutoring through the
  shared session; add `subject_for_domain('di')→LANGUAGE_ARTS` to the retrieval matcher.
- **LIVE LOOP VERIFIED 2026-07-21 (HUMAN-CHECKS #36 STRUCK):** user drove `direct-instruction-tester`
  with a real mic — **PASS end-to-end through the primitive**, and the backend log confirms the FULL
  data loop fired on submit (curriculum resolve → score 9.2/correct → competency + calibration
  item_beta=2.96 θ=4.71 P=0.92 + mastery lifecycle + +38 XP). **di-letter-sounds L0 is now fully
  runtime-verified; its lifecycle ladder is UNBLOCKED.** Watch-item (not a defect): the standalone
  submission mapped to LA001-01-a "Decode short vowel CVC words" (runtime Gemini re-mapper), not the
  birth-cert home "Letter-Sound Correspondence" — expected under the L0 lesson-mode gap; raises the
  priority of `/add-tutoring-scaffold` carrying the objective's subskill instead of re-deriving.
- **DONE 2026-07-21 — di-word-reading bench set WIRED (BACKLOG item 2 in progress).** The single-word
  response class is a standing-gate-1 bench sitting before `/primitive`; the bench already models
  `kind: 'word'` end-to-end, so this was content + a set toggle, no engine work. Added
  `WORD_READING_PROBE_ITEMS` (10: sam·mat·pig·dog·sun·red·cup + sight the·see·go; near-neighbours
  matt/son/read/sea left in to stress over-affirmation) + `BENCH_SETS` registry in `diScript.ts`,
  and a **Letter sounds ⇄ Word reading** set toggle in `DirectInstructionBench.tsx` (letter-sounds
  set untouched). typecheck:lumina PASS. **Probe sitting PENDING → HUMAN-CHECKS #41** (mic run).
  Gate: judge reliable on lone words → `/primitive`; over-affirms neighbours → log the failure class.
- **DONE 2026-07-22 — di-letter-sounds L1 eval-modes (birth-cert follow-up #1 struck).** 3-mode
  ladder, task identities all within the benched continuant response class: `letter_sound` (β1.5,
  base focused cluster), `letter_sound_review` (β2.5, cumulative mixed-set — anchors the recent
  focus then broadens across the menu so it isn't a copy of the base cluster), `first_sound_in_word`
  (β3.5, onset isolation from a spoken word; continuant keywords only, NEW hand-authored DISTAR cue
  lines + picture/word stage so the lone grapheme never leaks the onset). Fork A: `resolveEvalModes`
  routes intent→mode, code builds+stamps `challengeType` (no Gemini enum to constrain); the mixed
  path interleaves all three modes staggered so it never stacks one keyword (SP-21). Wired
  `catalog/di.ts` evalModes + backend `problem_type_registry.py` (β mirrored) + metrics union +
  eval-test validator reads `challengeType` + tester mode selector. Verified: real-Gemini eval-test
  PASS ×4 (each pinned mode single-type; onset drops vowels; mixed = 3-type interleave) + keepable
  oracle `gemini-di-letter-sounds.test.ts` (4/4); typecheck:lumina clean of this work. **New onset
  live-tutor wording UNVERIFIED live → HUMAN-CHECKS #42.** Ladder next = `/add-tutoring-scaffold` (L2,
  birth-cert follow-up #2: move DI block into catalog `tutoring:` + wire the lesson-mode connect gap).
  Report: `my-tutoring-app/qa/eval-reports/di-letter-sounds-evalmodes-2026-07-22.md`.
- **DONE 2026-07-22 — `di-word-reading` BORN L0 (BACKLOG item 2 struck).** Second custom-made pack
  over the committed engine (separate pack; letter-sounds files untouched; no hooks/ change):
  `DiWordReading.tsx` + hand-authored `diWordReadingScript.ts` (DISTAR two-branch cues — CVC
  sound-out "sss-aaa-mmm… sam" / sight whole-word; STRICT near-neighbour judging contract; handoff's
  classic "My turn." model opener re-worded to "I'll sound it out…" — sentinel collision) +
  `gemini-di-word-reading.ts` (Fork A: 30-CVC-by-vowel + 8-sight menu in code, Gemini enum-selects,
  vowel/sight scope CODE-enforced) + full registrations (catalog single `read_word` β2.5, backend β,
  metrics, registry, ComponentId) + a **Letter Sounds ⇄ Word Reading primitive picker** in the
  direct-instruction-tester (no cloned tester). Answer-leak inversion honored: printed word ONLY
  before the read; emoji = post-affirmation reward; sight words just affirm. **Standing gate 1
  (bench sitting #41) WAIVED by user ruling 2026-07-22** — near-neighbour stress folded into the
  live-loop check. typecheck:lumina 0; eval-test PASS ×4 (named/generic/sight/short-a scope);
  curriculum-fit **MATCH @ G1 LA001-01** (K = diffuse vote-splitting across sibling CVC families,
  not a gap). Birth cert + 6-layer queue: `qa/eval-reports/di-word-reading-birth.md`. **Live loop
  NOT yet driven → HUMAN-CHECKS #43 is the real L0 gate** (mirror of #36; also carries the
  near-neighbour stress + resync/timeout watch-items).
- **DONE 2026-07-23 — di-letter-sounds L2 tutoring scaffold + FAMILY lesson-mode wiring
  (birth-cert follow-up #2 struck; both carried L0 gaps CLOSED).** DI tutoring block moved to
  `catalog/di.ts` `tutoring:` (+contextKeys challengeType/letter/keyword/letters, +3
  commonStruggles; sentinel-collision re-checked). Shared wiring, benefits the whole family: new
  `ComponentDefinition.audioInput` — both DI packs declare `{manual_activity:true}` in the catalog;
  `connectLesson` scans the manifest and opens the shared Gemini session with it (audio config is
  connect-time-fixed); `switch_primitive` carries tutoring + audio_input; standalone connect falls
  back to the catalog (component's explicit passes removed). Subskill carry comes free in lesson
  mode (ManifestOrderRenderer injection) — ends the 07-21 re-map watch-item.
  `subject_for_domain('di')→LANGUAGE_ARTS` added (REVISIT at di-math-facts). Generator grew a flat
  `letters` field; component syncs per-item RUNTIME STATE via silent updateContext. Verified:
  typecheck:lumina 0; tutor-test Tier 1 PASS (0 HIGH) + Tier 2 probe PASS (0 `(not set)`) —
  `qa/tutor-reports/di-letter-sounds-2026-07-23.md`. **Lesson-mode live loop → HUMAN-CHECKS #45**
  (incl. the mixed-lesson trade-off: DI-bearing lessons run manual VAD session-wide, non-DI chat
  turns won't open). **Committed `2e5814a` 2026-07-23** (L0 word-reading + L1 letter-sounds modes +
  L2 scaffold/lesson-mode wiring + useVoiceViewportGate all in one commit; tree clean).
- **#42 + #43 VERIFIED LIVE 2026-07-23/24 (both struck).** User mic runs: word-reading (sam·mat·cat·hat
  all read+affirmed, printed-word-only stage) + letter-sounds onset + mixed (SP-21 interleave m·s·f·s).
  User verdict: "a true awesome Lumina-native modality." Tester mode-switch kickoff bug fixed
  (`DirectInstructionPrimitivesTester` remounts the pack per Generate via `runKey` — components kick off
  a mic gesture and don't reset on new data; a lesson gives each objective a fresh instance so it's a
  tester-only artifact). typecheck:lumina 0; **needs the same mode-switch glance to confirm live.**
- **PHASE SET 2026-07-24 (user): "more DI packs" — content density within DI** (voice-transport
  unification stays PARKED; not this phase). WIP unchanged (reader-fit TOP + DI).
- **#46 math-facts probe sitting PASSED 2026-07-24 (struck; user: "worked great!").** Number words
  judged reliably from audio: 3/3 affirmed, aliasAgree 3/3 (ASR wrote WORDS — digit aliases never
  needed), 0 unanchored/phantom/echo-opened, commit lag ~933ms CONSTANT → silent response-time viable
  as the fluency signal. Carried to the primitive's L0 live loop (mirror of #41→#43): fact correction
  branch never fired (3/10 items, all correct) + homophone stress. Sentinel gate 2 resolved: engine
  defaults kept. Report + run JSON: `qa/di-bench/run-2026-07-24-math-facts-probe.md`. (Probe wiring
  `8e30a52`; ship-prereq slices `ec6d16e` ledger-gate fix — DI gens were the last legacy registrations,
  context-native migration now 100% — + `7283ef5` tester runKey + `d99ad29` charter/reconcile.)
- **#3 di-math-facts — BORN L0 2026-07-24 (BACKLOG item 3 STRUCK; the first custom-made set is
  complete: three packs at L0+).** Third DI pack, first MATH pack — `DiMathFacts.tsx` +
  hand-authored `diMathFactsScript.ts` (bench-proven #46 cue wording; strict on a different number,
  permissive on th-fronting/counting-up) + `gemini-di-math-facts.ts` (Fork A code-owned fact pool,
  scope code-enforced named→make-10→doubles→within-N→grade default, wrapper leak-guard) + full
  registration (catalog `answer_fact` β2.0 + audioInput, registerContextGenerator, metrics union
  incl. silent `meanResponseMs` fluency signal, backend registry, tester picker). Verified:
  typecheck:lumina 0; vitest 915/915; backend pytest = HEAD baseline (0 new); real-Gemini eval-test
  **PASS 6/6** (30 challenges programmatically recomputed); curriculum-fit **MATCH ×2** (K OPS001-03
  fluency-within-5 0.785 / G1 OPS001-01 addition-within-10 0.830). EVAL_TRACKER row added
  (358/375). Birth cert + ladder queue: `qa/eval-reports/di-math-facts-birth.md` (L1 candidates
  counting_next / fact_review / subtraction_fact — all still number words, the benched class, so no
  new bench sitting gates the ladder).
  **L0 gate NOT closed: the live loop has never been driven → HUMAN-CHECKS #48**, carrying three
  named stresses — (a) the fact CORRECTION branch ("My turn: …") has never been heard live (the #46
  bench sitting was all-correct) + the live half of the sentinel-opener judgment, (b)
  homophone/over-affirmation stress (one/won, two/too, four/for, eight/ate), (c) the submit must
  attribute to MATHEMATICS (OPS001), which is what exercises the new subject override at runtime.
- **DONE 2026-07-24 — di-math-facts L1 eval-modes (birth-cert follow-up #1 struck).** User chose the
  FULL birth-cert ladder: `counting_next` (β1.5) / `answer_fact` (β2.0, L0 unchanged) /
  `fact_review` (β2.5) / `subtraction_fact` (β3.0). **Standing gate 1 satisfied with NO new bench
  sitting** — every mode answers with a spoken NUMBER WORD, the class benched in #46. The
  bench-proven L0 cue wording survives byte-for-byte: the L0 lines were already phrased around
  `it.problem`, so all four skills read through the same proven sentences ("three minus one is two",
  "the number after five is six") — the ONLY type-aware line is the counting DIRECTION in the
  judging contract (subtraction counts back, not up). Fork A held (code owns pools/answers/aliases,
  stamps `challengeType`); new code-built `solvedDisplay` so the post-affirmation reward is right per
  skill ("5 → 6", not "5 → ? = 6"). Catalog description/constraints widened WITH a routing boundary
  ("use a dedicated counting primitive when counting itself is the objective") so the pack doesn't
  poach counting-board/number-line territory. Verified: real-Gemini eval-test **PASS ×8** (4 pinned
  single-type + mixed = all-four interleave (SP-21) + curated blend), **40/40 challenges recomputed
  correct**, and `/topic-trace` on a real K subtraction topic routed manifest →
  **`subtraction_fact`** end-to-end — intent routing was NEWLY live (with one mode the resolver
  short-circuits to mixed, so this path had never run for this pack). typecheck:lumina 0; full tsc
  0-new (1021 pre-existing legacy); vitest **915/915**. One design gap caught by the run and closed:
  `fact_review` on a doubles objective drew ZERO doubles — anchors now hold for any scope.
  EVAL_TRACKER 361/378. **The 3 NEW modes' cue wording is UNVERIFIED live → HUMAN-CHECKS #49, which
  folds into #48 (one mic sitting closes both).** Report:
  `qa/eval-reports/di-math-facts-evalmodes-2026-07-24.md`. Deferred by design: G3
  `multiplication_fact` (needs its own curriculum-fit + grade gate) and missing-addend (L4).
- **DONE 2026-07-25 — di-math-facts L2 tutoring scaffold (birth-cert follow-up #2 struck; the pack is
  now L2 one day after birth).** `DI_MATH_FACTS_TUTORING` moved from `diMathFactsScript.ts` into
  `catalog/di.ts` `tutoring:`, so both connect paths (standalone fallback + lesson
  auth/`switch_primitive`) resolve it from the single source of truth. **No transport work needed** —
  di-letter-sounds' 07-23 L2 slice already built the family lesson-mode wiring, which is exactly the
  leverage that slice was for. The bench-proven cue lines + `judgingContract` are untouched,
  byte-for-byte. Added AT this layer (the L0 block had none of it): `contextKeys`
  (challengeType/display/problem/facts — **stimulus side only**; `answerWord`/`solvedDisplay` stay
  out because the tutor already gets the answer inside the `[DI_ITEM]` contract and RUNTIME STATE is
  echoed far more loosely than a scripted line), 4 `commonStruggles`, and one NUMBER WORDS clause
  aimed at the #48 homophone stress (judging is by SOUND, so a homophone of the TARGET number is the
  target — "won"/one, "too"/two, "for"/four, "ate"/eight; the "a DIFFERENT number is always wrong"
  rule is untouched). Component drops its local `tutoring:` arg and gains an `updateContext` effect
  (silent channel, never perturbs the judged loop); generator attaches the flat `facts` summary so
  RUNTIME STATE is populated from the first auth-time prompt (mirrors letter-sounds' `letters`).
  Verified: tsc **0 Lumina-surface errors**; `/tutor-test di-math-facts` **0 HIGH** — 2 WARNs that
  are the DI family's SHAPE, not defects (`data-bag-unparsed`: DI connects via
  `ctx.connect`/`updateContext`, not a `useLuminaAI` bag the auditor can parse; `no-sendtext-moments`:
  DI cues ride `[DI_ITEM]`/`[DI_MOVE_ON]`/`[DI_COMPLETE]` through the judged-loop engine, so the
  tutor cannot go silent) — di-letter-sounds carries the identical pair. Tier-2 probe on TWO modes
  (`answer_fact` @ K, `subtraction_fact` @ G1) shows all 4 keys resolving with real values, **no
  `(not set)`, no answer in RUNTIME STATE**. Report: `qa/tutor-reports/di-math-facts-2026-07-25.md`.
  **Tier-3 rides #48/#49** — the new struggle/homophone copy is exercised by the same mic sitting
  that drives the correction branch, so no new human gate was created.
- **L0 LIVE GATE CLOSED 2026-07-25 (user mic run — "worked great!") — di-math-facts is now
  runtime-verified at L0 + L1 + L2.** `subtraction_fact` / "subtraction within 5": **5/5 affirmed**
  + recap. One sitting closed three layers: the judged loop end-to-end (no desync/stall/phantom),
  the reworked reward beat (audio-edge pacing holds live — not flagged as dragging or clipping),
  and the **first live run of the catalog-resolved L2 scaffold** — the tutor held the scripted lines
  across 5 items, so the 4 added `commonStruggles` did NOT loosen it into chattiness (the named risk
  of adding them). `subtraction_fact` cue wording + code-built `solvedDisplay` confirmed live (#49b).
  HUMAN-CHECKS **#48 struck**. **Residual: third consecutive ALL-CORRECT sitting** — the correction
  branch has still never been heard, the L2 homophone clause has never been exercised, and the
  MATHEMATICS submit attribution is unconfirmed; all three need a deliberately WRONG answer →
  new HUMAN-CHECKS **#50**. Report: `qa/eval-reports/di-math-facts-live-2026-07-25.md`.
- **DONE 2026-07-25 — di-math-facts reward beat (user browser check, same session as L2).** The stage
  showed the NEXT problem while the LAST answer's equation sat in a chip below it — two facts at once,
  overload at K. Fixed in two halves: the completed equation now REPLACES the printed problem in the
  big slot (never stacks under it), and `advance()` is deferred to a reward beat instead of firing at
  verdict time. **The beat is edge-driven, not timed** — the engine already sends the next `[DI_ITEM]`
  cue 400ms after the tutor's audio falls (`VERIFY_BEAT_MS`), so the visual rides that same falling
  edge and the swap lands exactly when the tutor stops talking about this fact (900ms floor, 3s cap,
  and `attempt-open`/`resync` flush the beat so a resolved fact is never up while the child answers
  the next one). Verified: new jsdom suite `DiMathFacts.reward-beat.test.tsx` **6/6**, non-vacuity
  probed (reverting the deferred advance fails 2 of them, reverting the in-place render fails a 3rd);
  full vitest **921/921**; tsc 0 Lumina errors. **The FEEL still needs the mic — HUMAN-CHECKS #48
  updated**, since its old text described the behavior this replaced. Reinforces the July
  retrospective's antipattern #1: the 07-24 answer-leak fix was tsc-and-eval-green and still shipped a
  UX regression that only a human at the browser could see.
- **STANDING GATE 1 PASSED 2026-07-25 (user mic sitting — "this worked so well!") —
  `di-sentence-reading` is CLEARED FOR `/primitive`, and it is now the stream's top pull.**
  10/10 items, 10 affirmed / 3 corrected / **0 off-script / 0 unanchored**. **The make-or-break
  answered YES 2/2:** two deliberate one-word OMISSIONS inside 6- and 7-word sentences ("big",
  "red") were both caught and corrected, both retries affirmed — omission is the hardest error class
  to hear, and a rubber-stamp there would have killed the pack. **Whole-sentence correction is
  settled** (learner self-repaired on the first retry both times → word-targeting, and its
  off-script risk, is unnecessary). **Restating affirm stays** (~2-3s against a ~15-17s cycle whose
  dominant term is learner think-time, 8-11s — tutor talk is not the bottleneck for connected text).
  **One ship-blocking finding, cheap:** a read sentence splits into TWO voice turns (3
  supersessions) because `silenceCloseMs: 500` is tuned for one-word answers — a mid-sentence pause
  is part of the response. It broke the alias cross-check (BOTH alias disagreements trace to the
  split, not judge error) and nulled `responseMs` on second fragments; the pack passes ~1100ms via
  `useJudgedSpeechLoop({ voice: { config } })` and the family default stays 500ms. Scope confirmed
  3-8 words, no ceiling found. Residual → HUMAN-CHECKS **#53** (short end unstressed; item 1
  transcribed "the car" yet affirmed — ASR artifact or false affirm, unresolved). Report:
  `qa/di-bench/run-2026-07-25-sentence-reading-probe.md`.
- **Context for the above — QUEUE REOPENED 2026-07-25 (user phase call: "can we turn
  read-aloud-studio into a DI-style primitive?") — 4th pack = `di-sentence-reading`.** Ruling: **fork,
  do NOT convert.** `read-aloud-studio` is live (3 eval modes accuracy/expression/dialogue with
  calibrated βs, `supportsEvaluation`, a `problem_type_registry` row) so the manifest can route to it
  today; rewriting its modality in place would silently change what those eval modes MEAN and
  invalidate their calibration — the contract-first fork-on-conflict case. The new pack takes judged
  short-sentence accuracy at G1-2; read-aloud-studio keeps passages, WPM, and expression/dialogue for
  older readers, where self-assessment is defensible. **Why it's worth a pack:** read-aloud-studio's
  own catalog says *"Student self-assessment only, no AI speech grading"* — it has a mic, records,
  tracks WPM, and judges nothing, so it produces no evidence the IRT model can use. This is
  `feedback_production-modality-roadmap` exactly. **Standing gate 1 honored:** connected text is the
  family's biggest response-class jump (every benched class so far is a SHORT production judged
  whole), so it benched before wiring — `kind: 'sentence'` + a 10-item `Sentence reading` probe
  (3→8-word ladder, word-reading vocabulary carried over, one-word-error stress: hen/pen, hat/hut,
  a repeated phrase where omission is easy). The sentence branch gets its OWN judging criteria: the
  generic "reasonably close for a kindergartener" is right for one short production and WRONG for
  connected text, where "close" rubber-stamps the dropped word fluency exists to catch. Bench tests
  **22/22**, tsc 0 Lumina errors. **The sitting (HUMAN-CHECKS #51) decides three things:** (a) can
  Live detect a ONE-WORD error in a 5-8 word utterance — make-or-break; (b) whole-sentence correction
  vs. word-targeted (which costs off-script risk); (c) does the restating affirm drag at sentence
  length. `/primitive` only after it passes.
- **DONE 2026-07-25 — `di-sentence-reading` BORN L0 (BACKLOG item 2 STRUCK). Fourth DI pack, the
  family's first CONNECTED TEXT pack, and the first born on a gate cleared the same day.**
  `DiSentenceReading.tsx` + hand-authored `diSentenceReadingScript.ts` — **every spoken line is
  byte-for-byte the bench's proven `kind:'sentence'` branch**, so all three sitting rulings ship
  intact: whole-sentence correction (no word-targeting and its off-script risk), the restating
  affirm kept, 3-8 word scope. `gemini-di-sentence-reading.ts` is Fork A over a **37-sentence
  code-owned decodable menu** (vocabulary carried from the word-reading menu so a miss is
  attributable to connected text, not new words; a model-written "sentence for a first grader"
  would be undecodable and turn every miss into a content bug). Full registration incl. catalog
  `read_sentence` β3.0 + `audioInput` + the L0 `tutoring:` block, backend β mirror, and a tester
  **Sentence Reading** picker with a per-pack `defaultGrade` (the tester had been sending
  kindergarten for every pack).
  **The ship-blocking bench finding landed in the same slice:** `silenceCloseMs` **1100ms**
  pack-level — a mid-sentence pause is part of one response, not the end of it. The family default
  stays 500ms; the three short-response packs are untouched.
  Verified: `typecheck:lumina` **0**; full tsc **0 Lumina-surface errors** (805 pre-existing, all in
  the legacy graveyard); vitest **936/936**; real-Gemini eval-test **PASS ×11** with every check
  programmatic — wordCount recomputed from text, benched ceiling, sentinel safety, wrapper leak,
  teaching order, vowel purity (`qa/eval-reports/di-sentence-reading-2026-07-25.md`);
  curriculum-fit **MATCH ×2** — G1 `LA003-01` Oral Reading Accuracy 0.824 (its top subskill,
  *"self-correct reading miscues by re-reading"*, is a near-verbatim statement of the judging
  contract) and G2 `LA001-05` Reading Fluency 0.807, **whose sibling subskills are
  read-aloud-studio's self-assessment territory — independent confirmation of the fork ruling**
  (`qa/curriculum-fit/di-sentence-reading-2026-07-25.md`). EVAL_TRACKER 362/379.
  **One real issue found + fixed by QA:** phonics scope was vowel OVERLAP, not purity — a "short a"
  objective was served "Sam has a red cup." (a/e/u). The pool now prefers vowel-SUBSET sentences and
  widens only if pure cannot fill the session; all five vowels now serve pure sets. (Automated
  checks had passed — this one only surfaced by reading the content.)
  **Departure worth knowing:** the tutoring block ships in the CATALOG at birth rather than the
  script (as the two older reading packs did), because di-letter-sounds' L2 slice already built the
  family lesson-mode wiring that resolves both connect paths from there — so lesson mode works day
  one. L2 still owns `contextKeys` / `commonStruggles` / RUNTIME STATE sync.
  Birth cert + 6-layer queue: `qa/eval-reports/di-sentence-reading-birth.md`.
- **L0 LIVE GATE CLOSED 2026-07-25 (user mic run — "it worked fantastically!") — the pack was born
  and runtime-verified the SAME DAY, a family first.** 4/4 affirmed, session completed + submitted,
  recap all-emerald. One sitting closed three things: the judged loop end-to-end through THIS
  component (its `applyVerdict` → `recordResult` → `advance` path, cue builders, and generator had
  never run together with a real mic), **the reward beat at SENTENCE length** — the named pacing
  risk, since the affirm restates the WHOLE sentence (~2-3s), well past what the 900ms floor / 3.5s
  cap were tuned against, and it neither dragged nor clipped — and the one-sentence stage invariant
  (the exact failure di-math-facts shipped and had to fix a day earlier).
  **Residuals are now both QUANTITATIVE, not behavioural → HUMAN-CHECKS #54:** (a) the
  `silenceCloseMs: 1100` fix has no numeric proof — the run did not visibly break, but its evidence
  (0 attempt-supersessions / non-null `responseMs` / `aliasMatch` true) lives in the `[DI eval]`
  console payload, not the UI; (b) the SHORT end (#53) and the correction branch stayed dark —
  **the fourth consecutive all-correct DI sitting through a primitive**, with `[DI_MOVE_ON]` still
  never fired in ANY pack. Note the difference from math-facts' equivalent gap: the sentence
  correction WORDING is bench-proven (3 corrections incl. the 2 deliberate omissions), so what is
  untested is only the COMPONENT's retry-in-place branch and 2-correction cap. Report:
  `qa/eval-reports/di-sentence-reading-live-2026-07-25.md`.
- **DONE 2026-07-25 — di-sentence-reading L1 eval-modes (birth-cert follow-up #1 struck). The pack
  went BORN → LIVE-VERIFIED → L1 in a single day.** Full 4-mode ladder: `decodable_sentence` (β2.5)
  / `read_sentence` (β3.0, L0 unchanged) / `sentence_review` (β3.5) / `sight_phrase_sentence` (β4.0).
  Standing gate 1 satisfied with **no new bench sitting** (every mode is the same response class) and
  — unlike di-math-facts, which needed one type-aware line — this ladder shipped with **ZERO new
  spoken copy**: the L0 script was already phrased around `it.text`, so all four skills read through
  the bench-proven sentences byte for byte. **Identities, not tiers:** `decodable_sentence` and
  `read_sentence` have different curriculum homes at different grades, and `decodable_sentence` gives
  the pack the **K home the birth's fit probe abstained on**. Verified: typecheck:lumina 0; full tsc
  0 Lumina-surface errors (803 pre-existing); vitest 936/936; backend β rows mirror the catalog;
  real-Gemini eval-test **10/10 clean** with per-mode **POOL** assertions rather than type stamps
  (all four modes render identically, so the route's own validator passes trivially) — incl. **mixed
  yielding all four types (SP-21)**. `/topic-trace` closed the routing path the tester structurally
  cannot reach: a sight-word objective → `sight_phrase_sentence` end-to-end, **newly live** (with one
  mode the resolver short-circuits). **Found + fixed in QA: `sentence_review` never broadened** — a
  short-a review returned 4/4 short-a, the base mode relabelled, because the model's picks (drawn
  from the focused prompt menu) crowded out the wide pool. **di-math-facts' `fact_review` bug in
  mirror image** — theirs drew zero focus items and lost the thread; this drew nothing else and lost
  the breadth; both are the same underlying question caught from opposite sides. Reports:
  `qa/eval-reports/di-sentence-reading-evalmodes-2026-07-25.md`,
  `qa/topic-traces/reading-sentences-with-sight-words-2026-07-25.md`. EVAL_TRACKER 365/382.
  **L1 VERIFIED LIVE the same day (user mic run on `sight_phrase_sentence` — "these are so good!");
  HUMAN-CHECKS #54(c) struck.** 4/4 affirmed, all four sentences from the sight-heavy pool → the mode
  means at runtime what the catalog claims, and the bench-proven cue lines carried a vocabulary
  (see/go/you/my/and) no prior sitting had spoken, which was the last plausible place for the ladder
  to have disturbed proven speech. **So di-sentence-reading is runtime-verified at BOTH L0 and L1 on
  its birth day** — a family first (letter-sounds took 1 day to its L0 gate, word-reading 1, math-facts 1).
- **DONE 2026-07-25 — di-sentence-reading L2 tutoring scaffold (birth-cert follow-up #2 struck). The
  pack ran L0 → live → L1 → live → L2 in ONE day.** Because it already shipped its catalog
  `tutoring:` block at birth (the deliberate departure — di-letter-sounds' L2 had already built the
  family lesson-mode wiring), L2 added precisely the omitted half: `contextKeys`
  (challengeType/text/wordCount/sentences), the **`{{challengeType}}` placeholder those keys make
  safe** (an unfilled `{{key}}` renders SILENTLY, so it could not ship before its key), 5
  `commonStruggles` drawn from behaviour actually observed in the bench sitting + both live runs, a
  generator `sentences` summary, and the component `updateContext` sync. Bench-proven aiDirectives,
  cue lines, and judging contract untouched byte-for-byte. **Sibling difference recorded:**
  di-math-facts keeps its ANSWER out of RUNTIME STATE; that reasoning does not transfer here, since
  the printed sentence is stimulus and target both — nothing is withheld. Verified: typecheck:lumina
  0; vitest 936/936; `/tutor-test` **0 HIGH** with the same 2 structural WARNs both siblings carry;
  **Tier-2 probe clean on 3 modes** (`probe.findings: []`, all keys real, and the `sentences` summary
  tracks the pinned mode's pool — proof L1 and L2 did not drift). The 5 `(not set)` strings are
  confined to `staticPromptPreview`, which by construction has no content to fill. **Tier 3 rides
  #54** — three of the five struggles only fire on a MISS, so the deliberately-wrong read exercises
  them; watch that 5 struggles don't loosen the scripted tutor into chattiness (math-facts cleared
  this with 4). Report: `qa/tutor-reports/di-sentence-reading-2026-07-25.md`.
- **DONE 2026-07-25 — di-sentence-reading L3 support tiers (birth-cert follow-up #3 struck). The pack
  ran L0 → L1 → L2 → L3 on its birth day.** Fits NONE of the skill's six archetypes (live-judged
  spoken production) and has **zero `showOptions`**, so the whole ladder is modality #2
  instruction-as-scaffold — the AngleWorkshop case. The sub-steps were already there: **DISTAR's
  model→guide→test IS a scaffold ladder.** easy = model+guide+test / medium = model+test / hard =
  **cold read**. In the SCRIPT (`leadInFor`), never a UI flag, exactly as the birth cert specified.
  **`hard` closes the answer-leak caveat the birth audit could not resolve** — the model line speaks
  the sentence before the child reads it (legitimate DI instruction, but an ECHO ROUTE); at hard the
  sentence never enters the block the tutor may speak. Never withdrawn at any tier: the printed
  sentence, the correction's re-model (gate 3), the restating affirm (bench (c)), the judging
  contract. **Tutor second-channel hole found + fixed:** L2's own `scaffoldingLevels` level 1 would
  have re-read the withheld sentence at hard. **Deliberate departure — no `tierSection` in the
  prompt:** under Fork A the model only picks sentence ids, so a tier line could only nudge CONTENT =
  structural difficulty by the back door. Verified: typecheck:lumina 0; full tsc 0 Lumina-surface;
  vitest **949/949**; new suite 13/13 with **non-vacuity proven** (5 fail when reverted). **A bad
  assertion of mine was caught in QA** — diffing content across tiers to prove "numbers never change"
  cannot work, since a same-tier control returned three different sets; the rule is established
  structurally instead. That control also **retires the L0 convergent-selection note** (L1's
  selection path introduced real variety). Report:
  `qa/eval-reports/di-sentence-reading-support-tiers-2026-07-25.md`.
- **DONE 2026-07-25 — contrastive correction (user ruling), di-sentence-reading + di-math-facts.**
  The first live correction run in ANY DI pack overturned the sentence pack's bench finding (b):
  a reader read "Mom got THE pot" **three times** against an identical whole-sentence re-model,
  because a re-model gives the learner nothing to diff their own words against. The bench's
  evidence for (b) was n=2, both OMISSIONS with first-retry self-repair — a SUBSTITUTION with no
  self-repair had never been seen. Corrections now NAME the error and contrast it
  (`My turn: not ⟨what they said⟩ — <correct form> Your turn. <ask>`), audio only, no screen
  change (user scope call). The sitting's stated blocker was inspected and does not hold —
  sentinels match OPENERS only (`matchesOpener`), so a mid-line slot carries zero engine risk;
  `correctionLine` survives byte-for-byte as the nothing-to-contrast fallback. Math also carries
  the user-named **echo misconception** (answering "2 + 1" with "one"). Verified typecheck:lumina 0,
  vitest **964/964**, new `diCorrectionContrast.test.ts` 15/15 (filled AND unfilled contrast lines
  still classify as `corrected`). **UNBENCHED per the family rule → HUMAN-CHECKS #55, riding the
  same mic run as #54/#50(a).** letter-sounds + word-reading still carry the old re-model — port
  only after #55.
- **DI misconception evidence — SHIPPED 2026-07-25 (BACKLOG item 1 struck; the ① below is DONE).**
  All four packs. A DI miss produced `{correct: false, score: 0}` and nothing else; it now produces a
  **Tier-A `DiagnosisEvidence` packet** — the child's transcript, the tutor's own judging sentence,
  and the earlier misses as `priorAttempts` — shipped as `submitResult`'s **6th** arg, with
  `misconceptionScope: 'primitive'` declared on all four catalog entries (the second gate, without
  which the packets are dropped before the distiller).
  **The handoff's step 1 was necessary but NOT sufficient — the finding worth carrying forward.**
  It said to expose the `verdictText` the reducer already computes. But the reducer classifies from
  the sentinel OPENER and fires immediately (by design — progression must not wait on a sentence),
  while Gemini forwards `output_transcription` in **sub-word chunks**. So `verdictText` is truncated
  at "My turn" — and for a contrastive correction the opener is exactly the part carrying **no
  diagnosis**. Shipping it as `judgeFeedback` would have produced a Tier-A packet that names nothing,
  **worse than honest Tier B**. Closed with a second additive emission: `useJudgedSpeechLoop` keeps
  accumulating past the verdict and emits **`verdict-text`** when the line completes. Reducer
  untouched; one place, not four.
  **Gate `/misconception-test di-math-facts` = PARTIAL, deliberately.** Probe D **10/10 draws**
  (3 GENERATIVE + 2 ABSTAINED, 0 LEAK, 0 OVERREACH, every packet at `tier=judge`) — and the abstains
  held on Tier-A packets, which was this design's likeliest failure mode. Probe R **CLOSED** (backend
  9/9, new DI scope case), S4 Firestore exposure **pass**. **Probe G is NOT-WIRED** → new DI BACKLOG
  item 1: no DI generator consumes `remediationFocus`, so a stored diagnosis changes nothing yet.
  That is a design question, not a missing import — DI's spoken copy is byte-frozen, so the only
  honest remediation lever is which ITEMS the pool draws. Verified: typecheck:lumina **0**, vitest
  **985/985**. Report: `qa/misconception/di-math-facts-2026-07-25.md`.
- **Next pull — ① is DONE (2026-07-25); ② is now the top pull.** *(The ① text below is kept as the
  reasoning trail for the slice that shipped.)*
  **① ~~DI BACKLOG item 1 — FAMILY-WIDE: the wrong answer's CONTENT is discarded~~ DONE 2026-07-25** (executor:
  `/primitive` follow-up or a dedicated slice; all four packs, component-owned). A miss IS recorded
  (`outcomes[]` carries `{correct, attempts, score}`; metrics carry `attemptsCount`/`firstTryCount`/
  `overallAccuracy`), but **WHAT the child said is thrown on the floor** — the engine emits
  `attempt-transcript` with `text` and every DI component keeps only `emission.responseMs`. So the
  data loop can see THAT a child missed `5 − 1` twice, never that they said "four" both times, which
  is a textbook diagnosable misconception. **📋 Handoff written `/pm` 2026-07-25:
  `qa/HANDOFF-di-misconception-evidence-2026-07-25.md`** (paste-able, line-exact).
  **User ruling — it feeds the FRONTEND misconception system, and the BACKLOG's "non-metric bag"
  fix shape is superseded:** the accumulation is right, the destination is wrong — the shipped
  channel is **`diagnosisEvidence`** (Misconception Loop S1), `submitResult`'s 6th arg. Two findings
  from the read change the job: **(1) `catalog/di.ts` declares no `misconceptionScope`**, so
  `captureMisconception` gate 3 drops every DI submission before the distiller — all four packs are
  invisible to the loop today; **(2) the ENGINE also discards the tutor's judging sentence**
  (`judgedLoopModel.ts:252-255` computes `verdictText`, emits only the `judgment`), and that
  sentence is what buys **Tier A** — the loop's highest-fidelity tier, written for judge-driven
  primitives, which DI is the only real instance of. Since contrastive correction landed, that
  discarded sentence NAMES the error. Template: `PhonicsBlender.tsx:540-566`. Gate:
  `/misconception-test di-math-facts`.
  **①ᵇ THE SITTING RAN 2026-07-25 AND DECOHERED — BACKLOG item 1. DIAGNOSED + FIXED + FIX
  VERIFIED LIVE 2026-07-26:** the channel was none of the four hypotheses — the voice turn gate's
  `minVoiceMs: 120` silently meant "three 85ms frames", so two-frame one-word answers were rejected
  while Gemini had already judged them → unanchored verdicts dropped → desync. Engine fix
  (framePeriodMs → `voicedMs`, retro-anchor, cue ledger) verified live same day: coherent
  `fact_review` run, first-ever live `[DI_MOVE_ON]` at the correction cap, contrastive correction
  held byte-identical (#55 math half). `qa/di-bench/run-2026-07-26-math-facts-turn-gate.md` +
  `-verify.md`. **Residual (now the top pull): the sustained-miss recipe run** — wrong on MOST
  items, same rule, mean < 60 — for multi-cap resync/rapid-retry stress + the S1 misconception
  capture (the 07-26 run's mean of 80 was correctly below the write gate). *(Original finding kept
  below as the reasoning trail.)* The user drove the consistent successor rule and the tutor + pack lost coherence.
  **No usable record survived**, and that is the first finding: the packs handled **5 of the 8**
  `LoopEmission` kinds and hit `default: return` on the three that MEAN desync
  (`attempt-superseded` / `phantom-transcript` / `unanchored-verdict` — the canonical DI-1 signal),
  and wired neither `onTutorText` nor `onVoiceTurnClose`, so nothing captured **what the tutor
  actually said**. The bench has had all of this since the open-mic runs, which is why every prior DI
  failure was diagnosable and this one was not.
  **Instrumentation landed in the same slice:** `diRunLog.ts` + `DiRunLogPanel.tsx` (shared, all four
  packs) give the primitive path bench parity — a coherence-flag row first, then attempts / affirmed /
  corrected / move-ons / resyncs / echo-opened / mean response + commit lag, and **Copy run JSON**
  mirroring the bench payload. Verified `typecheck:lumina` 0, full vitest **997/997**, new
  `diRunLog.test.ts` 12/12 with **non-vacuity proven** (reverting the three captures fails 5).
  Logging is write-only and cannot influence progression.
  **Ruled out, don't re-chase:** the misconception slice (`awaitingJudgeTextRef` is pure
  record-keeping, cleared on `attempt-open` and reset, never gates progression) and `off-script`
  (handled correctly — returns and keeps listening). **Live hypotheses:** `[DI_MOVE_ON]` at the
  correction cap (a consistent wrong rule caps EVERY item, and move-on has never fired live in any
  pack), resync fighting the tutor's own in-band re-elicitation, contrastive-correction drift (#55,
  still UNBENCHED), unanchored verdicts under rapid retry. **Cheap bisect:** the same rule in the
  always-instrumented `di-bench` math-facts probe separates an engine fault from pack orchestration.
  **② Then the mic sitting, RE-RUN with the panel open (#54 + #50 + #55 + #49(a)/(c) — ONE run).**
  ① is landed, so the ordering already paid off: this is the **first deliberately-WRONG DI run ever
  driven**, and it now produces the family's first recorded wrong-answer transcripts, judge
  sentences, and a real distiller call instead of ears-only evidence. It is also the S1 live-capture
  check no probe can reach — watch the console for
  `[captureMisconception] stored for di-math-facts: …` (or `abstained: …`, which is success) — and the
  gate that unblocks **porting contrastive correction to di-letter-sounds + di-word-reading** (family
  rule: the rewording is UNBENCHED until #55 closes).
  **③ Then the ladder.** di-sentence-reading `/add-structural-difficulty` (L4) — axis already built
  and measured (sentence LENGTH, carried as `wordCount` + `meanSentenceWords`), with one hard
  constraint: the **8-word benched ceiling is not a difficulty knob**; raising it needs a new bench
  sitting, not an L4 decision. Alternatives at the same rung: **di-math-facts `/add-support-tiers`
  (L3)** (birth cert already specifies the fade — easy = model+guide+test / medium = model+test /
  hard = test-only cold — as a per-tier cue variant in the SCRIPT, never a UI flag; di-sentence-reading's
  L3 is the worked template), di-word-reading catalog `tutoring:` move (L2), di-letter-sounds
  `/add-support-tiers` (L3).
  A **fifth pack** is a user phase call, not a queue default — the remaining benched-class gap is
  blends; a "counting sequence" pack is no longer a candidate at all (`counting_next` absorbed it).
  **Human gates in leverage order:** the ② sitting, then **#45** (DI in a real K lesson — the
  evidence that would justify un-parking voice-transport). #48 struck; #53 folded into #54(b).
- **DONE 2026-08-01 — di-math-facts L3 support tiers (birth-cert follow-up #3 struck; second pack at
  L3, first MATH pack tiered).** The ladder rung the 08-01 re-point named, executed on
  di-sentence-reading's L3 template point-for-point: zero `showOptions`, so the whole ladder is
  modality #2 instruction-as-scaffold over **DISTAR's own model→guide→test** — easy = model+guide+test
  (byte-for-byte the #46 bench-proven block) / medium = model+test / hard = **cold answer**, composed
  in the SCRIPT (`leadInFor` + `coldAnswerGuard` in `diMathFactsScript.ts`), never a UI flag.
  **`hard` matters MORE here than in the sentence pack:** the screen never shows the sum (answer-leak
  rule), so the model line was the ONLY pre-attempt channel carrying the answer — at hard the item
  becomes a genuine **retrieval probe**, and silent `responseMs` becomes true retrieval time instead
  of partly echo delay. Never withdrawn: printed problem, correction re-model (gate 3, plain AND
  contrastive), restating affirm, judging contract (byte-identical across tiers, test-pinned).
  **Tutor second-channel audit came back CLEAN, unlike the sibling** — level 1 repeats the QUESTION
  (stimulus, on screen), not the target; the fact-modeling levels/struggles are all post-attempt
  remediation = correction territory; audit note recorded in `catalog/di.ts`. Channel closed anyway:
  per-item cold-answer guard + `supportTier` contextKey (connect payload / `updateContext` /
  `startDiRunLog`) + one cold-items clause in the LIVE-JUDGED directive. Same Fork-A departure as the
  sibling: **no `tierSection` in the prompt** (a tier line could only nudge the fact RANGE =
  structural difficulty by the back door; operand structure is L4's axis). **Family gap closed in the
  same slice: the direct-instruction-tester had NO difficulty control**, so no DI tier (incl. the
  sibling's #54(d) hard cold-read check) was actually drivable — added the tier selector riding the
  eval-test route's existing `?difficulty=` tap. Verified: typecheck:lumina **0**; vitest
  **1041/1041** (new suite 14/14, non-vacuity proven — 5 fail when hard is reverted); **and 3/3
  probes through the REAL pipeline** (dev server + real Gemini): pinned `answer_fact`+hard → all
  challenges `'hard'`, scope intact; `mixed`+medium → the SP-21 four-identity interleave ALL got the
  tier (the gate-on-tier-not-mode rule live); no param → no field (pre-L3 byte-compatible). Live
  `hard` ear-check folded into **#50(d)** (rides the deliberately-wrong sitting). L4
  `/add-structural-difficulty` now unblocked. Report:
  `qa/eval-reports/di-math-facts-support-tiers-2026-08-01.md`.
- **`subject_for_domain('di')` REVISIT — RESOLVED AND NOW COMMITTED (`/pm` 2026-07-25 correction of
  its own 07-24 note).** The 07-24 line called this "resolved in the working tree (uncommitted)";
  that is now stale — `curriculum_retrieval_service.py` (`_PRIMITIVE_TO_SUBJECT`
  `di-math-facts → MATHEMATICS` + `subject_for_primitive()`, per-primitive override wins and the
  domain default falls through), `curriculum_mapping_service.subject_for_primitive()` and
  `submission_service` (passing `ctx.primitive_type`) all shipped in **`7be0883`**; the working tree
  carries none of them. The DI family can span subjects without splitting the domain. The ONLY
  uncommitted backend file is `problem_type_registry.py` (the L1 β mirror, part of the DI slice).
  **Still unverified at runtime** — a math-facts submission must be seen resolving to MATHEMATICS
  before this is called done; that check is HUMAN-CHECKS #48(c), same sitting as the data-loop trace
  that closed #36.
- **REGISTER GAP CLOSED (`/pm` 2026-07-24): the DI family was invisible in `qa/EVAL_TRACKER.md`.**
  Two shipped, eval-tested packs (di-letter-sounds 3 modes, di-word-reading 1 mode) had passing
  eval-tests with reports on disk but no dashboard row — so the tracker under-reported the portfolio
  and a session reading it would not know DI primitives existed. Backfilled from the committed
  reports (no re-run): totals 353/370 → **357/374**, 0 new open issues. Standing correction recorded
  in the tracker: a DI `/primitive` / `/add-eval-modes` run writes its row like any other primitive.
  `di-math-facts`'s row is owned by the in-flight session and lands with its birth cert.
- **Still open (not blocking the phase): HUMAN-CHECKS #45** — DI in a real K lesson (L2 lesson-mode
  behavior + the mixed-lesson VAD trade-off measurement). Worth running opportunistically; it's the
  evidence that would later justify un-parking voice-transport.
- **WIP note:** the 07-16 "proof-of-concept, not a build" framing is RETIRED (user call
  2026-07-20) — the bench proved the architecture; DI is now a build stream. ACTIVE = reader-fit
  (top) + DI = **2 ACTIVE, within the 2+1 limit.**

*(SP-27 Tutoring Context Integrity + media-player reimagining + voice-transport unification all
PARKED — see PARKED table. WIP = **2 ACTIVE + 0 DELEGATED** (reader-fit TOP-PRIORITY + DI family),
within the 2+1 limit as re-verified 2026-07-24; DI is the only lane with activity since 07-21.)*

### 3. Support-tiers campaign (non-math) — **OPPORTUNISTIC (+1)** — last touched **2026-08-04**
- **Queue:** `my-tutoring-app/qa/support-tiers/BACKLOG.md` — **RECONCILED `/pm` 2026-08-04**.
  Batch-3 implementation already shipped in `effc7a6`; the top task is its missing
  `/eval-test` evidence/report closure, not another implementation pass. After that, five eligible
  primitives remain. Hydraulics-lab still requires coordination with its reimagining stream;
  timeline-builder's reader-fit 14m resolver prerequisite has landed, so its tier work is now
  independently pullable. The ~59 not-yet-eligible generators (need `/add-eval-modes` first) stay
  un-enumerated by design — opening that frontier is its own decision.
- **Executor skills:** `/add-support-tiers` (+ `/add-eval-modes` first for the ~59 that lack modes),
  `/eval-test`, `/primitive-contract --check`.
- **State: 31/36 non-math primitives code-wired; 21/36 have complete batch-report evidence.**
  Batch 3 shipped in `effc7a6` across 10 primitives, but no
  `qa/eval-reports/support-tiers-batch3-2026-08-04.md` or equivalent per-item real-Gemini probe
  record landed. Close that evidence gap before declaring the batch fully done. Batch 2
  (**committed `423c58f`**, report
  `qa/eval-reports/support-tiers-batch2-2026-08-02.md`) took 13/36 → 21/36 via an 8-agent
  orchestrated Workflow — 7 implemented, 1 partial (letter-sound-link `see_hear` correctly declined
  single-tap commit: its options are bare speaker bubbles, so a first tap would commit an *unheard*
  option). ~15 remain, plus ~59 that need `/add-eval-modes` before they are even eligible.
- **The batch's real value was the defects it found en route, not the tiers** — and this is the
  argument for the campaign continuing: a **rule-#1 answer leak in rhyme-studio** (the rime
  highlight rendered only when the pair rhymed, so the highlight WAS the yes/no answer), **three
  live rule-#1 tutor leaks in letter-sound-link** ([ACTIVITY_START] named the sound and keyword
  before the challenge), an **unanswerable calendar-explorer identify** mode, and the
  **calendar-explorer grade-band bug that turned out to be systemic** (now reader-fit **14m**).
  Profiling 8 primitives closely enough to withdraw their scaffolding is what surfaced these; none
  were findable from the tier work alone.
- **Residuals:** batch-2 hard-tier browser feel-pass → **HUMAN-CHECKS #60**; batch-3 feel-pass →
  **HUMAN-CHECKS #62**; the
  live-tutor ear-check that reveal-policy directives hold in real audio rides any DI/lesson sitting
  at a hard tier. None blocks machine verification/report closure.
- **Note the shape for reuse:** the orchestration pattern held — profiles → orchestrator writes
  line-anchored specs → agents implement mechanically → orchestrator applies all catalog patches
  serially and runs the merge gates. Zero collisions across 7 agents in `catalog/literacy.ts`, and
  the concurrent 14f session's uncommitted register edits were untouched. One trap recorded: apply
  structured-output patches with **UTF-8 decoding**, since PowerShell 5.1 `Get-Content` ANSI-decoded
  the journal and briefly wrote em-dash mojibake into the catalogs.

## DELEGATED

*(none — lane 3 closed 2026-07-15, folded to the PARKED contracts stream below.)*

> **WIP note (`/pm` 2026-08-03 EVENING reconcile — supersedes the morning note below):** HEAD
> **`603cc82`**, main, **in sync with origin.** Movement since the morning reconcile: **two DI
> ladder rungs landed, committed AND pushed same-day** — `66a2d66` (di-word-reading L2, the family
> now entirely catalog-resolved, + 14g's di-word-reading half closed WRONG-PRIMITIVE with measured
> 2/3→0/3 steering) and `603cc82` (di-sentence-reading L4, first pack at L4, the family's L4
> template). Both commits carried their queue + WORKSTREAMS updates in the same slice — grooming
> held; this reconcile found only ONE staleness: the DI BACKLOG's 08-01 ordering block still said
> "next rung = di-word-reading L2" after both rungs landed (the ladder table below it was current).
> Fixed — **DI next serial rung = di-letter-sounds L4** (item-set composition per birth cert).
> **Human-check re-grep:** both 08-03 reports SELF-declare "no new row" and the claim verified —
> the L4 8-word cold read folds into existing #54(d) (clause added), the L2 chattiness glance rides
> the next DI sitting. Next free ID still **62**.
> **Uncommitted surface = pure register/skill docs, ONE `docs(pm)` slice, no code:** the
> primitive-contract **Phase 2b (G-series) REMOVAL** (user ruling 08-03 — contracts record what must
> stay TRUE, never an improvement wishlist; 9 contracts had manufactured 26 gaps, ~500 by
> construction at catalog scale; governing rulings `qa-is-a-gate-not-a-census` +
> `worked-primitives-self-select`) + the reader-fit **14m pilot swap coin-counter → number-line**
> (same ruling family; WORKSTREAMS already carried it committed, the BACKLOG edit is the lagging
> half) + this reconcile's corrections (DI pointer, #54(d) fold-in, this note).
> **Convergence worth naming:** 14m's number-line pilot is contract-first, and number-line is
> ALREADY item 5 of the contracts derivation queue — one slice serves both queues.
> Portfolio = **2 ACTIVE + 1 opportunistic, at the limit**; both ACTIVE streams touched today.
> ⚠️ **Standing flag, SEVENTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone (re-verified this run). Either restore `Bash(*)` / `Glob` / `Grep` or record
> the narrowing as deliberate so `/pm` can stop raising it.
>
> **WIP note (`/pm` 2026-08-03 morning full reconcile — superseded by the note above):** HEAD
> **`8ce40ec`**, main. **Uncommitted surface = ONE stream's worth (reader-fit 14f knowledge-check)**
> — 4 source files + contract + reader-fit test + 5 QA docs + 5 shared registers. Clean to ship.
> **Ship proposal, 2 slices — EXECUTED `/ship` 2026-08-03:** (1) the 14f code + its contract + its
> reports (one stream, fully verified per its report: COMPATIBLE check, Lumina typecheck 0,
> real-Gemini probes) → **`7ba48ba`**; (2) the shared registers (WORKSTREAMS, EVAL_TRACKER,
> HUMAN-CHECKS, both BACKLOGs) in their own commit — they now carry this reconcile's corrections as
> well as 14f's, so they are genuinely a separate concern. Ship-time gates re-run on the whole tree:
> `typecheck:lumina` 0, **full suite 1286/1286** (the 14f report's 1085 was that session's count;
> the suite has grown by `423c58f` + `8ce40ec` since). Portfolio = **2 ACTIVE + 1 opportunistic**,
> at the limit.
>
> **Three staleness corrections made this run** (all of the "recorded-open but actually done" class
> the skill warns about, and all three were invisible from the queues alone):
> **(1) how-it-works HW-4/HW-5/HW-6 were recorded OPEN while the fix sat at HEAD.** The 08-02
> diagnosis session wrote the tracker rows; the fixing session landed `8ce40ec` and never struck
> them. Verified in the tree (`maxOutputTokens: 8192` + 2-attempt retry, `clampStr` across every
> free-text field, and a payload/longest-string detector in `eval-test/route.ts`). Struck as
> CODE-LANDED with re-verification named. **HW-2/HW-3 likewise cleared** — the 9-run sweep proved
> both fixed and said so in its report, but nobody carried it to the tracker.
> **(2) The eval-test harness is now runaway-instrumented for EVERY primitive** (HW-6's fix is
> route-level, not how-it-works-level). Any sweep that has been trusting `status: pass` was blind to
> the SP-6b class; it no longer is. That is a portfolio-wide gain hiding inside a single-primitive
> commit.
> **(3) A systemic defect was being met one instance at a time** — see reader-fit **14m**, opened
> this run. 14e made `ctx.grade` precise; **19 of the 26 generators carrying a local band resolver
> still substring-match `gradeContext` PROSE** (8 of them on the K-2 surface, 11 chemistry).
> coin-counter (14c), hundreds-chart (14i), and
> calendar-explorer were three independent sightings of one bug, and calendar-explorer was already
> fixed blind inside the support-tiers batch — which is exactly the fix template for the other 19.
>
> **Human-check debt re-grepped:** two rows added (**#60** support-tiers hard-tier feel pass — its
> own report names it; **#61** how-it-works HW-1, a CRITICAL open since 2026-03-22 that had no row
> at all, which is why it has been invisible rather than deprioritized). Next free ID = 62.
> ⚠️ **Standing flag, SIXTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone (re-verified this run — file is 9 lines, `allow: ["Read(**)"]`). Every
> session pays permission prompts for routine shell/search. This has now outlived five reconciles;
> either restore `Bash(*)` / `Glob` / `Grep` or record that the narrowing is deliberate so `/pm`
> can stop raising it.
>
> **WIP note (`/pm` 2026-08-01 second run, handoff planning — superseded by the note above):** HEAD **`66b3cd8`**, main, **tree CLEAN, in sync with origin.** The earlier note's
> "uncommitted surface = DI stall-fix + guard" is DISCHARGED — that whole day landed
> (`f156f21` stall fix, `9af684c` math-facts L3, `79dcbdd` 14a census, `66b3cd8` rulings).
> **Three parallel-session handoffs written this run** (paste-able, line-exact, file-disjoint by
> construction): **(1)** reader-fit **14e** numeric Grade-1 dead band —
> `qa/HANDOFF-reader-fit-14e-numeric-grade-2026-08-01.md` (target verified:
> `geminiService.ts:30-37` collapses `Grade 1`/`1` → `elementary`; fix routes through
> `normalizeObjectiveGrade`, `resolveGenerationContext.ts:38`); **(2)** DI **di-letter-sounds L3**
> — `qa/HANDOFF-di-letter-sounds-L3-2026-08-01.md` (third use of the L3 template; owns
> `catalog/di.ts` serially); **(3)** reader-fit **14b** coin-counter G1 enacted-count widening —
> `qa/HANDOFF-reader-fit-14b-coin-counter-g1-2026-08-01.md` (contract-first, carries the β1.5
> decision). 14e+14b are one stream worked by two sessions (07-16 precedent); portfolio stays
> **2 ACTIVE + 0 DELEGATED**. Opportunistic 4th if a slot opens: DI queue item 6 (backend-only
> attribution probe, zero collision) — pull straight from the queue, no handoff needed.
> ⚠️ **Standing flag, FIFTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone (re-verified this run).
>
> **WIP note (`/pm` 2026-08-01 — superseded by the note above):** HEAD `d906c68`, main.
> **Uncommitted surface = ONE stream's worth (DI) + this run's backend guard:** the 07-31/08-01
> item-5 stall-fix slice (engine hooks + 4 packs + session-liveness/fuzz tests + `DiStallCard` +
> recovery/disconnect hooks + `LuminaAIContext` + backend clock-skew & ledger edits + QA docs) plus
> the fault-flag persistence guard (`lumina_tutor.py`, `config.py`) landed by this `/pm`.
> **Ship proposal:** slice 1 = the DI stall-fix + guard (same files, one stream, all verified —
> vitest 1025/1025, typecheck:lumina 0, py_compile clean, level-2 recovery confirmed live);
> slice 2 = shared registers (WORKSTREAMS, HUMAN-CHECKS, DI BACKLOG) in their own commit.
> **Two user rulings recorded this run:**
> **(1) Fault-flag time bombs (defused + guarded).** `LUMINA_FAULT_MUTE_S=25` had been left in
> `backend/.env` — it would have silently muted the first DI session of every backend boot. Removed,
> and the class is closed in code: fault flags now REFUSE to arm from .env persistence (pydantic
> loads .env without touching os.environ, so the persisted form is detectable) — one loud ERROR
> names the fix; shell-scoped arming (`$env:LUMINA_FAULT_MUTE_S='25'; uvicorn …`) still works for
> deliberate drives. Guard exercised on all four paths via the backend venv. Memory:
> `feedback_no-persisted-fault-flags`.
> **(2) Scope pivot: PUSH DEVELOPMENT.** Testing of DI was good but must stop dominating sessions;
> favor platform capabilities that don't require substantial testing. DI re-pointed at its LADDER
> (machine-gated /add-* rungs) + item 2 design; item 9 Tier 2 (headless student = testing
> capability) demoted-but-queued, absorbing the level-3-card + end-coherent-run residuals.
> Reader-fit's §14a EMERGING census (pure agent work) fits the ruling and is that stream's pull.
> Portfolio = **2 ACTIVE + 0 DELEGATED**, within limit. Reader-fit idle since 07-25 — resume via
> 14a rather than parking (it IS the development frontier for the K-2 demand map).
> ⚠️ **Standing flag, FOURTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone — every session pays permission prompts for routine shell/search. Restore
> `Bash(*)` / `Glob` / `Grep` if the narrowing wasn't deliberate (`/fewer-permission-prompts` can
> seed it); no other stream owns this.
>
> **WIP note (`/pm` status re-check 2026-07-27 late — superseded by the 2026-08-01 note above):** HEAD **`d906c68`**, main, **tree CLEAN, pushed** (main in sync with origin). Portfolio =
> **2 ACTIVE + 0 DELEGATED**, within the 2+1 limit. Reader-fit idle 2 days — within tolerance, queue
> freshly re-seeded (§14) so a session can pull cold.
>
> **The earlier reconcile note's `/ship` section is DISCHARGED — the entire 07-26 DI day landed in
> `d906c68`** (one commit rather than the proposed 3 slices; acceptable — it is one stream's work):
> turn-gate engine fix + fuzz suites + telemetry item 8 + misconception-evidence tests + all run
> reports + register updates (incl. this `/pm`'s #56 row and preamble refresh). **Both pre-ship
> gates were honored in the same commit:** `backend/logs/` is now gitignored with the "raw runtime
> logs never enter the repo" comment (and `git ls-files backend/logs` confirms nothing tracked), so
> the student-session-data exposure is closed.
> ⚠️ **Standing flag, still open (third `/pm` raising it):** `.claude/settings.local.json`
> allow-list remains `["Read(**)"]` alone — every session pays permission prompts for routine
> shell/search. Restore `Bash(*)` / `Glob` / `Grep` if the narrowing wasn't deliberate; no other
> stream owns this.
>
> **Post-commit movement (2026-07-27 evening): a child-paced `answer_fact` K run, COHERENT** —
> diagnosed from the auto-persisted log alone (item 8's zero-click path working in anger), 3
> plain-fallback corrections byte-stable → **#55(e) HALF-closed** (spoken-no-number half; the
> literal-SILENCE route still rides #56), counting-aloud supersession chains absorbed benignly
> (first live sight of item 9 Tier-2's "rapid double answers" class). Report:
> `qa/di-bench/run-2026-07-27-math-facts-answer-fact.md`.
> **Human-only residuals:** open rows run to **#56; next free ID = 57**. Two short runs remain:
> **#56** (the ~90s silence micro-run — no-verdict→resync live + #55(e)'s silence route + item 8's
> induced-stall acceptance gate) and the **sentence half** of the deliberately-wrong recipe
> (#54(a)/(b)/(d) + #55(a)/(b)/(d-reading) + #50(b) + #49(a)). Then **#45** (DI in a real K lesson),
> the evidence that would justify un-parking voice-transport.
> **DEV-FIRST RULING (user, 2026-07-27): human sittings must not be the critical path.** Recorded at
> the top of the DI BACKLOG queue. Code runway, none of it human-gated: **item 5** (stall fix) →
> **item 9 Tier 2** (headless student — machine-verifies item 5 + the silence path, shrinking #56 to
> an ear-check) → **item 8 flush sweep** → **item 6 probe** → **item 2 design**. Reader-fit's 14a
> EMERGING census is likewise pure agent work. **Item 7 (clock-skew) FIXED this session** —
> `clock_skew_seconds=10` at the tutor-WS + shared HTTP auth sites, py_compile clean, uncommitted.
> Only the contrastive-correction port stays frozen on a sitting (#55, family rule).

## PARKED (trusted-as-of date; re-verify before acting)

| Stream | Queue / doc | Next action | As of |
|---|---|---|---|
| Reader-fit K → EMERGING | `my-tutoring-app/qa/reader-fit/BACKLOG.md` (body section kept under `## ACTIVE` as the history record) | **PARKED 2026-08-05 with the queue DRAINED — this is a clean stop, not a stall.** 14a–14m are all closed; the queue file itself states it has **no EMERGING census pull left**, so the next item here is a **fresh priority call, not a carried-over pointer**. Resume by running a **new band census** (the 14a shape: ~6 published subskills across LA/Math/SS through the real `/topic-trace` pipeline) to re-seed at the next band. The `## Systemic items` section stays accumulate-evidence by design — not a pull. | 08-05 |
| Voice transport unification | `my-tutoring-app/qa/voice-transport/CHARTER.md` | **UN-PARKED 2026-08-05 → now the ACTIVE DI-lane pull (see snapshot); this row kept for the charter pointer.** **NEW 2026-07-23 (user direction).** Promote the DI-proven client-side turn authority (`voiceTurnMachine`/`useLiveVoiceTurns`) from DI-private mode to Lumina's SESSION-WIDE voice transport, so students can talk to the tutor throughout a lesson and verbally refer back to prior sections. Dissolves the DI mixed-lesson manual-VAD trade-off (L2 wiring 07-23, HUMAN-CHECKS #45 measures the interim). Phases: calibration beat → lesson-level turn authority (DI becomes a consumer) → contextual close-timing + viewport claim → refer-back Tier-3 journey beats (the raised live-testing bar). Charter has the evidence base + watch-items. Pull only when a WIP slot opens. | 07-23 |
| media-player reimagining | `qa/media-player-reimagining/BACKLOG.md` + `docs/contracts/media-player.md` | **PARKED 2026-07-16 (user — B1 shipped & browser-confirmed, `39f2543`).** B1 done: 3 eval modes live (PRE `listen_and_look` / EMERGING `listen_for_details` / ESTABLISHED `story_analysis`), MP-1/2/3 cleared, PRE band + tester refactor user-verified. Resume at **B2 (EMERGING polish)** or B4 `/tutor-test` probe; **B5 live `--lesson` @ K still queued** (live tutor beats, not tester-covered). Contract is CONFLICTED — C1's resolution IS this stream; read it first on resume. | 07-16 |
| SP-27 Tutoring Context Integrity | `docs/PRD_TUTORING_CONTEXT_INTEGRITY.md` + sweep `qa/tutor-reports/sweep-2026-07-14.md` | **PARKED 2026-07-16 (deliberate, single-stream focus on reader-fit).** Resume at Phase 0: harden `scaffoldAudit.ts` (invalid-syntax + studentPrompts coverage + fingerprints), **re-run the now-stale sweep** (comparison-builder edits since), cut the monotonic baseline, add the Vitest + report-only runtime gates. NOT urgent — failures cluster in physics/advanced-math sims students aren't routed to; K primitives are already green. **Carry-forward HIGH — RESOLVED + COMMITTED 2026-07-16 (`39f2543`):** the `fast-fact` spoken answer-leak (`scaffoldingLevels.level3` interpolated `{{correctAnswer}}` then said "try again") is FIXED — level3 rewritten answer-free in `catalog/core.ts`; Tier-1 audit re-run confirms the `answer-leak-in-scaffold` finding cleared (fast-fact HIGH→WARN; only a pre-existing `indirect-script` level2 copy nit remains). `correctAnswer` retained in taskDescription/RUNTIME STATE for tutor-reference (allowed). This was the single audibly-harmful SP-27 defect; the rest of the stream stays parked. | 07-16 |
| Primitive contracts | `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` | **12 contracts on disk** — newest **number-sequencer and annotated-example, 2026-08-04**, both derived contract-first inside reader-fit 14h/14j and checked COMPATIBLE. **`--check` guard now exercised ×8, all COMPATIBLE**; reports live in `qa/primitive-contracts/`. Next = #3 **foundation-explorer**, then #4 concept-card-grid. **The pattern persists: contracts land as prerequisites of active fixes rather than standalone pulls**, so the queue's Done section must absorb those out-of-order derivations. | **08-04** |
| Engineering tutoring-scaffold wiring | `my-tutoring-app/qa/engineering-tutoring-scaffold/BACKLOG.md` | **NEW 2026-07-21 (user).** Bring engineering primitives to L2 (`/add-tutoring-scaffold`). **Phase A** = 12 primitives with NO `useLuminaAI` tutor channel (machine-profile, dump-truck-loader, bridge-builder, tower-stacker, gear-train-builder, pulley-system-builder, lever-lab, ramp-lab, wheel-axle-explorer, shape-strength-tester, foundation-builder, blueprint-canvas) — wiring the channel also unlocks read-aloud there (finishes the 07-21 sweep). Pilot A1 machine-profile end-to-end + live-verify BEFORE sweeping A2–A12. **Phase B** = `/tutor-test` the 12 that already have the channel for L2 *sufficiency* (not just presence). Executors: `/add-tutoring-scaffold` → `/tutor-test` → `/reader-fit --fix`. | 07-21 |
| Misconception loop | memory `project_misconception-loop` | Phase 3A | 07-12 |
| Literacy eval-modes densification | memory `project_literacy-evalmodes-densification` | tree is CLEAN (no longer uncommitted — /ship step moot); remaining = `/eval-test` the 6 task-identity ladders to confirm they draw, then close | 07-15 |
| Flash-lite truncation hardening | memory `project_flash-lite-truncation-template` | ~50-gen sweep | 07-06 |
| LuminaReadAloud 🔊 sweep | `qa/HANDOFF_read-aloud-sweep.md` | pilot browser-VERIFIED 07-15 (user); remaining = 🔊 sweep across the other hand-rolled read-aloud surfaces | 07-15 |
| Lumina kit roadmap | `docs/DROPZONE_MIGRATION_PRD.md` + memory `project_lumina-kit-motion-roadmap` | motion tokens + LuminaDropZone COMMITTED (e17679f, e450cb0). DropZone Batch 1 (+2) are CODE-COMPLETE (◐ browser spot-checks pending, PRD tracks them) — "next = B1" was STALE. **DropZone Batch-3 tail CODE-COMPLETE 2026-07-15** (10 migrated + 3 triaged; typecheck:lumina clean; browser spot-checks → HUMAN-CHECKS #13/#14; uncommitted). Next = Batch-4 triage or LuminaCompletionScreen (106 hand-rolled 🎉 blocks). PRD §2 rulings settled | 07-15 |
| Curriculum authoring | memory (K-5 archive) | G5 Science + G5 Social Studies; GK phonics starvation | 07-09 |
| Analytics/snapshot residue | memory | snapshot `--all` + commit; metrics grade-join `--apply` | 07-08 |

**Absorbed:** tutor-test fix campaign (46/130 FAIL) → SP-27. Orphaned tutoring
configs (distribution-explorer, dot-plot) → SP-27 Phase 2/3.

## CLOSED (verified 2026-07-14; reopen deliberately, not by accident)
- **Grade-fidelity sweep close-out** (2026-07-15) — **committed** (`7cb5e5f`). 4/4 tasks closed
  via runtime probe: daily-session grade threading verified HONORED; 11/11 probe-sweep HONORED;
  `gradeToBand`+`buildGradeLine` extracted to `scopeContext.ts`; and a real 6-gen phonics dead
  lever fixed via `clampGradeToK2`. Report: `qa/topic-fidelity/grade-fidelity-closeout-2026-07-15.md`.
  Residual: none.
- **reader-fit 1e sorting-station @ PRE** (2026-07-15) — **committed** (`7cb5e5f`). READY @ PRE for
  `sort_one` + `odd_one_out`; other four modes floored to Grade 1+. jsdom 6/6 + live `--lesson` 3/3.
  Residual = pixel look (HUMAN-CHECKS #12). Report: `qa/reader-fit/sorting-station-PRE-2026-07-15.md`.
- **DropZone Batch-3 tail** (2026-07-15) — code **committed** (`7cb5e5f`). 10 migrated onto
  LuminaDropZone + 3 triaged decorative; `typecheck:lumina` clean. Residual = browser spot-checks
  (HUMAN-CHECKS #13/#14). Next kit move (Batch-4 triage / LuminaCompletionScreen) tracked under the
  PARKED Lumina-kit-roadmap row. Handoff: `qa/HANDOFF-dropzone-batch3-2026-07-15.md`.
- **DeepDive block scaffolding + curator-brief PRE scaffold** (2026-07-15) —
  **user-confirmed live**. BlockTutorHelp + tap-to-explore + the full K-eligible
  PRE read-aloud palette (prose/key-facts/MC/mini-sim/pull-quote/diagram) and
  curator-brief `[READ_SECTION]` auto-narrate all committed (tree clean) and
  behaving in a live lesson. Residual (minor, non-blocking): no jsdom tests yet
  for the new mini-sim/pull-quote/diagram preReader branches; the "toggle-as-core-
  control PREDICT block at PRE" ergonomics question stays a watch-item.
- **K-stage presentation mode (MVP)** (2026-07-15) — **user-confirmed in browser**:
  on-rails one-section rail, wordless arrow advance, `[SECTION_START]` narration
  work. The stream's browser gate is closed. NOTE: per-primitive internal chrome
  (counters/steppers inside components) is a SEPARATE ongoing backlog item — keep
  recording Audit-C chrome FAILs under the BACKLOG systemic entry; the stage only
  removes lesson-level chrome.
- **Gemini Live resumption** (2026-07-15) — **user-confirmed live**. The 1008
  session-duration abort is fixed via `context_window_compression` +
  `SessionResumptionConfig` + GoAway-driven transparent reconnect
  (`backend/app/api/endpoints/lumina_tutor.py`, `LuminaAIContext.tsx`). Memory's
  "NOT runtime-tested live yet / uncommitted" was the last stale caveat — the
  code is committed (tree clean) and the user verified the live behavior.
- **Opus generator-fix lane** (2026-07-15) — all three delegated tasks landed and
  are committed: shape-tracer SHT-1 (code-placed geometry, 4/4 runtime-verified),
  word-workout vowel-scope binding, phoneme-explorer initial-sound routing, plus
  word-flip routing. Residual = PRE band-audit for word-workout/word-flip, which
  lives in the reader-fit queue as **item 10** (not a delegated task). Optional
  2b-P2 chrome band-gate is tracked as reader-fit **item 2b**. Nothing lane-specific
  remains.
- **Pulse Agent v2** — Phases 1–3 + v2.1 + v2.2 SHIPPED, committed AND pushed
  (cb058b9/ecac549/5a5f7d3; main in sync with origin — "push pending" was stale).
  Phase 4 (close-out delta + generation-context) is **optional per PRD §D** —
  reopen only if that delta becomes needed. Residual worth keeping: the
  gate/selector disagreement on student 1004 COUNT001-01-D the harness surfaced.
- **Voice control (knowledge-check pilot)** — TF + MCQ wiring COMMITTED
  (edeadeb); LetterSpotter has NO voice wiring **by ruling** (unbenched
  letter-name homophone class — that's a standing decision, not pending work;
  reopens only if a Voice Studio letter-name bench is built). Sole residual =
  2-min human mic smoke → HUMAN-CHECKS #11. Platform follow-up noted in memory:
  global single-mic lock before any MCQ voice sweep.

## Standing hygiene
- Human-only verification debt lives in `my-tutoring-app/qa/HUMAN-CHECKS.md` — burn
  down in one browser sitting, not per-stream archaeology.
- Uncommitted surface: keep it to ONE stream's worth; `/ship` slices as streams
  close work. Shared files (EVAL_TRACKER, BACKLOG, run_tutor_live.py) commit in
  their own slice to reduce cross-session collisions.
