# Reader-Fit Backlog

Working queue for `/reader-fit`. Top = next. Seeded 2026-07-13 from two live
user-observed K-lesson failures + the 2026-07-12 cognitive-load audit.
Re-seeded 2026-07-14 demand-side from the K topic-trace census (6 real K
subskills × LA/Math/SS; reports in `qa/topic-traces/k-*-2026-07-14.md`).
Re-seeded 2026-08-01 for EMERGING from 6 real Grade-1 subskills across the same
LA/Math/SS shape (reports in `qa/topic-traces/g1-*-2026-08-01.md`).

## Queue

### 15. SUPPLY-SIDE SWEEP — the never-audited K-selectable set — **TOP QUEUE** (2026-08-06)

**Seeded from a real enumeration, not a demand sample.** Full method, corrections
to the `/pm` estimate, and the ranked table:
`qa/reader-fit/supply-sweep-triage-2026-08-06.md`.

**Live catalog = 196 entries → 118 K-selectable → 28 audited → 90 never audited**
(higher than the ≈69 estimate; the gap is 18 entries stating no grade at all,
which the earlier text grep could not see).

**The top risk band is ONE verified class, not 90 audits.** A primitive can only
reach a non-reader through (a) a catalog `tutoring` block or (b) component
`useLuminaAI`/`sendText`. **26 K-claiming primitives have NEITHER** — the tutor
receives the literal string *"No specific scaffolding instructions for this
primitive type."* (`backend/app/api/endpoints/lumina_tutor.py:385`). PRE band
contract rule #1 fails before any string is read, at every eval mode. 20 of the
26 make an explicit `"K: …"` progression promise in `constraints`.

**11 of the 26 are ALREADY OWNED — do not re-file them.**
`qa/engineering-tutoring-scaffold/BACKLOG.md` **Phase A** reached the same defect
from the read-aloud side on 2026-07-21 and names `/add-tutoring-scaffold` as
executor. This sweep confirms that queue and adds nothing to it.

**The 15 unowned ones are this item.** All but `story-planner` also carry 0 eval
modes, so each is one slice shared with the queued **BIO-2** density deficit —
same primitive, same catalog file, both CLAUDE.md #1 and #3.

- **15A — ~~WRONG-BAND, fix = catalog `BAND FLOOR`~~ → THEORY OVERTURNED 2026-08-07.**
  **USER RULING (S2, mid-slice):** *"i dont like band floor method, like if lumina
  routes to a certain primitive, its okay to use it and we should make it age
  friendly?"* A band floor removes a K failure by removing the primitive, which
  shrinks supply at the band with the least content. **The fix for a band failure
  is a component pass that makes the primitive work at that band** — band-gate the
  chrome, collapse continuous/numeric controls to picture-primary `tap = choose`,
  add the scaffold and read-aloud. **WRONG-BAND is now a last resort**, legitimate
  only when the primitive's core act cannot exist at the band at all AND an
  existing primitive already covers the objective — and even then, design the
  band-appropriate interaction first and say what it would be.
  Recorded as [[feedback_make-age-friendly-not-band-floor]]. This supersedes the
  "catalog-only, no component work" framing for **S3, S5, S6, S7** — budget each
  for a component pass, which is what 15B found empirically 8/8 anyway.
  **S1 `telescope-simulator` shipped a Grade-2 floor under the old theory
  (`96c3eb6`) — it is now a REVISIT CANDIDATE, not a precedent to copy.**
  Original (superseded) framing follows:
  ~~**S1 `telescope-simulator`**~~ **S1 CLOSED 2026-08-06 — WRONG-BAND, floored to
  Grade 2, A/B-verified against the real curator.** Catalog `BAND FLOOR: Grade 2+
  ONLY` (states why + names the K-1 alternatives) + generator backstop (schema
  enum `["2".."5"]`, K/G1 rungs deleted). **Second defect fixed in the same
  slice:** the generator read PROSE `ctx.gradeContext` into `=== 'K'` / `<= '2'`
  comparisons that could never match — the `14m` class, unwired here — now
  canonical-first via exported `telescopeGradeFromGrade()` with the prose
  resolver kept as fallback. Gates: 10 focused tests with **revert-bite 3/10**,
  tsc **805 vs 806 baseline** (one fewer), typecheck:lumina 0, full vitest
  **1801/1801**, eval-test probes K→2 / G1→2 / **G3→3 unchanged (control)**.
  **Curator A/B on "Looking at the night sky with telescopes" @ K: PRE-FIX
  selected `telescope-simulator`; POST-FIX does not.** Report
  `qa/reader-fit/telescope-simulator-PRE-2026-08-06.md`.
  *Follow-on (NOT closed):* it still has no tutoring block and 0 eval modes at
  the grades it DOES serve → `/add-tutoring-scaffold` + `/add-eval-modes`.
  ~~**S2 `orbit-mechanics-lab`**~~ **S2 CLOSED 2026-08-07 — READY at PRE, and the
  15A WRONG-BAND label was WRONG.** Verdict is **SCAFFOLD-GAP + PRIMITIVE-GAP**,
  fixed by making the primitive K-fit rather than flooring it (see the ruling
  above). Two pieces of live evidence backed the ruling: a real `topic-trace` on
  *"Things that go around and around in space"* @ K **did select this primitive**
  (a floor would have deleted a card the curator wanted), and the K interaction
  turned out to be fixable — the blocker was two numeric sliders (kN, degrees),
  not the physics. **Four defects closed:**
  (1) **Prose grade**, `gradeLevel = ctx.gradeContext` @ `:251`. **The handoff
  predicted this would bite at K; it did NOT** — kindergarten prose steers Gemini
  well enough that the K happy path was already correct. It bit at **G1**
  (probe pre-fix: *"Rocket to Orbit! - **Grade 3** Orbit Mechanics Lab"*, TWR +
  fuel + burns + field_lines all on) and on the **degrade path at every grade**.
  ⚠️ **A happy-path probe at K alone would have declared this generator clean —
  probe the neighbouring grade too.** (2) **Lexical rung compare, a SECOND bug
  that survives a correct resolver:** `gradeLevel >= '3'` is TRUE for `'K'`, so
  burns and field lines stayed on at K even after the rung resolved. A grep for
  the resolver finds only the first. Now ordinal via `orbitRungIndex()` (K = 0).
  (3) **The rung was never STAMPED onto the output** — the component band-gates on
  `data.gradeLevel` and the generator returned Gemini's echo (`'3'` at G1), so
  every new gate would have been **dead on arrival** (the S14 shape). *Untested
  until a revert-bite proved the omission was silent.* (4) **SCAFFOLD-GAP +
  PRIMITIVE-GAP** — catalog block (9 contextKeys, 3 levels, 5 struggles, 3
  aiDirectives incl. PRE-READER READ-ALOUD with the cap-override clause and a
  `WHICH SPEED IS THE ANSWER — NEVER SAY IT` rule forbidding elimination) +
  `useLuminaAI` with 3 moments + `LuminaReadAloud`; **both sliders replaced at K-1
  by three tappable pictures** (one tap sets thrust+angle AND flies), all chrome
  conditionally rendered away, and the TWR gate deliberately bypassed on that path
  so *"too slow"* visibly falls back instead of hitting a disabled
  **"Need More Thrust!"** text dead end.
  **Also: `showOrbitPath` was declared, generated at every grade, and read by
  NOBODY** — the catalog's K rung is *"showOrbitPath only"*, i.e. the one feature K
  is promised did not exist. Now implemented from the same orbital elements the
  flight panel uses. `showApogeePerigee` was equally dead; also honoured.
  **The physics was extracted to `service/astronomy/orbitPhysics.ts`** (pure, and
  the component calls it) so the three speed presets are *proved* against the same
  integrator the child's rocket flies on, not asserted from a comment: TWR 0.90 →
  crash, 1.02 → orbit e=0.11 apogee 1,668 km (on screen), 2.50 → orbit apogee
  33,162 km (far off screen). Exactly one choice orbits AND stays visible.
  **Answer-leak caught in-flight:** the winning choice was first labelled
  **"Just right"** — naming the answer, and the tutor reads labels aloud to the
  child who cannot read them. Relabelled "Medium"; test-locked (CLAUDE.md #1).
  Gates: 35 + 34 tests, **revert-bite 1/2/4/2/20/1 across six bites — two of which
  did NOT bite at first** (the rung stamp and `showOrbitPath`, both unreachable
  from a test) **and were restructured rather than left as decoration**; src-scoped
  tsc **803 = baseline zero new**, typecheck:lumina 0, full vitest **2049/2049**,
  tutor-test Tier 1 `pass` + Tier 2 probe `findings: []`, `dataBagDynamic: false`,
  9/9 contextKeys `component`, zero `(not set)`.
  **Runtime A/B @ G1: `'3'` + full adult instrument → `'1'` + all of it off, with
  G3 unchanged as control.** Curator A/B reported honestly as **NO measurable
  change** (1/4 pre-fix vs 0/4 post-fix draws — inside noise at a ~25% base rate;
  selection is not what this slice changed).
  Report `qa/reader-fit/orbit-mechanics-lab-PRE-2026-08-07.md`.
  *Residuals:* no Tier-3 live audio run → HUMAN-CHECKS #73; 0 eval modes;
  `gravityVisualization` + `initialOrbit` still declared-but-unread (grade 3+
  features, fidelity not band); the 🐢 "too slow" arc is ~51 km ≈ **under 1 px** at
  this visual scale, so that outcome is legible only from the 💥 and the spoken
  beat — a K-specific zoom would be its own slice.
  ~~**S3 `rocket-builder`**~~ **S3 CLOSED 2026-08-07 — READY at PRE.**
  **First slice in the sweep where rule 2 already PASSED** — tapping a part
  already added it, so the K-fit core act ("rockets have parts") needed no
  protocol surgery. Everything that failed was the screen around it, plus the
  voice. `data.gradeLevel` was read in **exactly ONE place in 1,205 lines**: to
  print a literal `GRADE K` badge at the child.
  (1) **Prose grade on the DEGRADE PATH ONLY** — probed live pre-fix, the happy
  path was correct at **both K and G1**, so *a happy-path probe would have
  declared this generator clean*. `getDefaultComponents/Hints/LearningFocus(prose)`
  all miss their maps and fall through to the **Grade 3** rung, firing exactly
  when Gemini omits a field. The solar-system-explorer shape. (2) **Rung never
  stamped** onto the output (same as S2). (3) **SCAFFOLD-GAP** — catalog block
  (9 contextKeys, 3 levels, 5 struggles, 3 aiDirectives incl. PRE-READER
  READ-ALOUD banning kg/kN/thrust/staging/delta-v with replacements supplied, and
  a `LEAD THEM TO IT` rule that forbids handing over the three required parts as
  a checklist on the first ask) + `useLuminaAI` with **4 moments** —
  `[ROCKET_PART_ADDED]` is load-bearing, since the tutor's voice IS the part
  label for a non-reader. (4) **PRIMITIVE-GAP** — part cards became
  picture-primary (the `500 kg • 50 kN thrust` spec line removed at K-1), group
  headers use child words instead of the `fuel_tank` slug, and **13 chrome
  classes** conditionally rendered away (GRADE badge, mass/thrust/TWR/budget
  panels, staging control + counter, mission altitude, flight-profile chart,
  staging ledger, attempt ledger, teacher-facing Learning Focus, the TWR failure
  prose and the km readouts).
  **⚠️ HONEST CORRECTION carried in the report:** the ordinal budget-rung rewrite
  was first framed as "a second bug that survives the resolver", by analogy with
  S2. **It is NOT** — once the rung is canonical, `['3','4','5'].includes()` and
  `rung >= 3` are equivalent, and the revert-bite proved it (0 failures). S2's
  `>= '3'` was different because `'K' > '3'` lexically. **Do not generalise S2's
  second bug to other generators without biting it.**
  **⚠️ TESTING TECHNIQUE worth reusing:** the first three bites did NOT bite,
  because the generator tests only exercised the exported pure helpers, not the
  generator's own USE of them. Fixed by stubbing `../geminiClient` and driving the
  real `generateRocketBuilder` with a reply that OMITS every grade-shaped field —
  which is the only way to cover a degrade path. **Make this the default for this
  class.**
  Gates: 26 + 31 tests, **revert-bite 7/3/0/18/1/1 across seven bites — six bite,
  the seventh reported as a documented no-op rather than dropped**; src-scoped tsc
  **803 = baseline zero new**, typecheck:lumina 0, full vitest **2106/2106**,
  tutor-test Tier 1 `pass` + Tier 2 `findings: []`, `dataBagDynamic: false`, 9/9
  contextKeys `component`, 4/4 tags, zero `(not set)`.
  **Runtime ladder intact and monotone: K (all off, 3 parts, 1 stage) → G1 (fuel
  gauge on, 5 parts) → G3 (TWR + forces + budget 7500 + 3 stages, 8 parts).**
  Report `qa/reader-fit/rocket-builder-PRE-2026-08-07.md`.
  *Residuals:* **rule 4 still PARTIAL at K** (6 visible controls with 3 parts, 8 at
  G1 — the lever is a generator part-cap at K-1, a Tier-3 change deliberately not
  bundled); **flash-lite truncation observed live 1-in-4 on G1**
  (`availableComponents` is an unbounded array — pre-existing
  [[project_flash-lite-truncation-template]] class, and it means the degrade path
  this slice fixed is genuinely reachable); no Tier-3 live audio → HUMAN-CHECKS
  #73; 0 eval modes; the `GRADE {n}` badge is dev chrome at every grade but was
  gated only at K-1.
  ~~**S4 `story-planner`**~~ **S4 CLOSED 2026-08-07 — READY at PRE.**
  **The "generator is already canonical" prediction was RIGHT and is now a
  regression test** — it reads `ctx.grade` first with a contract comment and
  probed correct at K *and* G1 on the happy path *and* the degrade path. It is
  the only generator in the sweep that needed no grade-resolution work.
  **But "audit component + scaffold only" could not have produced a K-fit
  primitive, and the slice deliberately went past it.** At K the screen was two
  open questions with **nothing to choose from** — the interaction was free-text
  composition in `<textarea>`s (rule 6). Band-gating the chrome and adding
  read-aloud would have left a five-year-old listening to a well-spoken question
  in front of two empty text boxes, and recorded it as READY. So the generator
  gained **two additive, band-scoped fields** — `elements[].choices` (3
  emoji-prefixed picture options each) and `arcEvents` (one event per arc slot,
  in story order) — with grade 2+ output byte-identical (G3 control + 2 tests).
  The K act is now **pick your character → pick what happens → put the events in
  order**, which is what K narrative planning *is* (CCSS W.K.3 is "drawing,
  dictating, and writing", not writing) and makes `story_structure` a real
  assessed identity for the first time.
  **Four defects closed:** (1) **SCAFFOLD-GAP** — it was one of the 26 mute
  primitives; catalog block (11 contextKeys, 3 levels, 5 struggles, 3
  aiDirectives incl. PRE-READER READ-ALOUD with the cap-override clause and an
  `ORDER IS THE ANSWER` rule that forbids elimination) + `useLuminaAI` with
  **7 moments**; `[STORY_ELEMENT_ASKED]` is load-bearing because **the tutor's
  voice IS the option captions** for a non-reader. (2) **PRIMITIVE-GAP** — 0
  textareas at K-1, one question per screen, emoji-primary cards, tap = choose
  *and* advance, arc ordering by one tap into the next empty slot (the S13
  shape), and 5 chrome classes gated (grade badge, phase ribbon, "Writing
  Prompt:" panel, required `*`, story-mountain chart) — plus the generated arc
  LABELS replaced by numerals, since at G1 they are whole sentences.
  (3) **Rule 8 — the worst finding, and unqueued:** the score was
  `trim().length > 5` plus an 18-word adjective regex, so **a K child who cannot
  type scored 0 and `"aaaaaa"` scored full marks** — the S10 defect, second
  appearance. Now plan-complete (40%) + events-in-story-order (60%), stricter
  than what it replaced. (4) **The rung was never STAMPED** (S2/S3 defect #3,
  third appearance) — `gradeLevel` was Gemini's echo, right on both probes but
  not something a band gate may key off, so every new gate would have been dead
  on arrival. *Not the forbidden grade-resolution fix: the resolution was already
  right, it just never reached the component.*
  **Band list extracted to `service/literacy/storyPlannerBand.ts`** and imported
  by both sides (S13's shared-resolver precedent) rather than hand-copied.
  **Answer-leak discipline, three guards:** `arcEvents` arrives in correct order,
  so the component shuffles by a content-seeded rotation that is a **guaranteed
  derangement**, the ordered array is **kept out of `aiPrimitiveData`**, and the
  `[STORY_EVENT_PLACED]` beat is **proved identical for a right and a wrong
  placement** by diffing the two messages — not by grepping for "correct", which
  was the first (bad) version of that test and failed on the prohibition's own
  wording.
  ⚠️ **`Math.random` would have been wrong twice** — it reshuffles on every
  render AND cannot be tested. Seeded rotation does both jobs.
  ⚠️ **Flash-lite handled a nested array under an emoji ask, first try, K and
  G1** — `choices` sits inside the `elements` object array, the shape
  [[feedback_flash-lite-drops-nested-array-under-emoji-ask]] warns about. Keeping
  the emoji **inside the string** (`"🐶 A happy puppy"`) rather than asking for
  an `{label, emoji}` object appears to be why. Reusable.
  Gates: 20 + 28 tests, **revert-bite 11 bites / 11 bite (2/1/2/1/1/3/18/2/1/3/5)**,
  src-scoped tsc **803 vs a stashed 803 baseline — set-identical**,
  typecheck:lumina 0, full vitest **2154/2154**, tutor-test Tier 1 `pass` +
  Tier 2 **22/22 `component`**, zero `(not set)`.
  **Driven end-to-end in real Chrome at K** with the real draw (2 picture screens
  → arc board → Finish → ✅ per slot), zero console errors, and the tray visibly
  rendering the answer OUT of order. **G3 control byte-identical.**
  Report `qa/reader-fit/story-planner-PRE-2026-08-07.md`.
  *Residuals:* rule 4 PARTIAL (6 tap targets on element screen 2 — the ⬅️ back
  arrow); two read-aloud pills on the K plan screen; title still text at K;
  **degraded generation still falls back to textareas at K** (all-or-nothing
  guards prevent partial content but not empty); no Tier-3 live audio →
  HUMAN-CHECKS #73; **`arcEvents` quality unverified beyond 2 draws** — the whole
  ordering assessment assumes exactly one sensible order, so a draw with two
  interchangeable middles would mark a defensible answer wrong (`/oracle-test`
  contract if this gets real K traffic); the 3 grade-2-6 eval modes have no band
  floor.
  ~~**S5 `bio-compare-contrast`**~~ **S5 CLOSED 2026-08-07 — READY at PRE.**
  Verdict **SCAFFOLD-GAP + PRIMITIVE-GAP**, not WRONG-BAND.
  **The "fourth grade-shape" prediction was right about the LOCATION and wrong
  about the SHAPE.** The call site (`registry/generators/biologyGenerators.ts:260`)
  held a verbatim **fifth copy of the S9 map** — `gradeBandMap[ctx.gradeContext]
  || '3-5'`. `gemini-compare-contrast.ts` really is clean, which is exactly why a
  grep over `service/biology/*.ts` missed it. **Generalisable: a generator with a
  clean body can still be grade-blind if its band arrives as an argument.** Fixed
  by importing S13's `resolveBiologyBand` — no fifth copy written.
  **Probe pre-fix: K, G1 AND G4 all returned `'3-5'`** with the same *"Mammalian
  Predators … vertebrate mammals … evolved as social pack runners"* draw against
  a K-2 rung reading "4-6 attributes, simple observable characteristics".
  **(1) SCAFFOLD-GAP** — catalog block (9 contextKeys, 3 levels, 5 struggles, 3
  aiDirectives incl. PRE-READER READ-ALOUD with the cap-override clause, a
  `WHICH SIDE IT BELONGS ON IS THE ANSWER` rule forbidding elimination, and a
  `NO JARGON AT K-2` register rule dropped at 3-5) + `useLuminaAI` with 5 moments;
  `[COMPARE_ATTRIBUTE_SHOWN]` is load-bearing — **the tutor's voice IS the
  characteristic card** for a non-reader.
  **(2) PRIMITIVE-GAP** — venn was HTML5 **drag-only**, ~17 text cards, a
  multi-clause written protocol and a deferred "Check My Work". Replaced at K-2 by
  the **S9 WordSorter precedent**: one characteristic staged, three picture
  targets (A / BOTH / B), tap = choose = commit = advance, dots not counters.
  Drag untouched at 3-5+. 5 chrome classes gated; `imagePrompt` (S9/S13 leak,
  **third appearance**) and the `A-only` dev slug removed at EVERY grade.
  **(3) TWO ANSWER-KEY DEFECTS AT EVERY GRADE, UNQUEUED — the real find.**
  (a) **The B-only Venn region was structurally unreachable**: entity B was
  filtered by "category not already in entity A" while the generator prompt
  *demands* parallel categories. Measured **0 B-only cards at K, G1 AND G4**, so
  one of three regions was never correct for anything. (b) **The key could
  contradict itself** — a shared attribute emitted as both `'A-only'` and
  `'shared'` under one placement key; run the generator's **own K-2 example**
  through the old builder and a perfect player caps at **60%**. It hid on live
  draws only because Gemini wrote longer distinct prose for shared entries —
  **so it fires hardest at the youngest band**. Both fixed in one exported
  `buildComparisonItems`; `isShared` deliberately NOT trusted as a region signal
  (its value is often entity-specific prose).
  **(4) A SHIPPED 15B REGRESSION, found here:** `BiologyPrimitivesTester` had **no
  `LuminaAIProvider`**, and `useLuminaAI` THROWS rather than degrading — so
  `classification-sorter`, `life-cycle-sequencer`, `habitat-diorama` and
  `organism-card` **crash the biology tester today**. Missed because all four 15B
  biology slices verified in **jsdom, which mocks the hook**, and none drove a
  browser. Fixed (astronomy tester already had it).
  ⚠️ **A jsdom suite that mocks `useLuminaAI` cannot see a missing provider.**
  Gates: **50 tests, 12 revert-bites / 12 bite** (7/1/2/1/16/3/1/1/1/1/1/1) —
  **four did not bite at first and were restructured**, and one of those four was a
  **HARNESS bug not a test gap** (the cap-override clause appears 5× in
  `biology.ts`, so the bite hit the wrong entry). src-scoped tsc **803 = baseline
  set-identical**, typecheck:lumina 0, full vitest **2219/2219**, tutor-test Tier 1
  `pass` + Tier 2 `findings: []`, `dataBagDynamic: false`, 9/9 `component`, zero
  `(not set)`.
  **Runtime A/B: K `3-5`→`K-2` (7/7→5/5 attrs, images on, register *"Mammalian
  Predators"*→*"Comparing Our Furry Friends"*), G1 likewise, G4 control unchanged.**
  A second K draw on a different topic proves the register is real, not the
  few-shot example parroted.
  **Driven end-to-end in real Chrome** on real generated K data + real generated
  images: 0 draggables, targets `Tree only | Both of them | Flower only`, **8 taps
  to completion + celebration**, no chrome, zero console errors; 3-5 control keeps
  everything. ⚠️ **Chrome caught a bug jsdom rendered silently** — a
  `LuminaReadAloud` button nested inside a full-row button
  (`validateDOMNesting`); fixed by making the row *be* the kit component, locked
  with a `button button` structural guard.
  Report `qa/reader-fit/bio-compare-contrast-PRE-2026-08-07.md`.
  *Residuals:* no Tier-3 live audio; **rule 4 PARTIAL** (6 elements); **rule 3
  PARTIAL on the stimulus** — no per-attribute image exists in the schema, and
  adding one is the single biggest further PRE win; **the generator hard-THROWS
  when it cannot find two entities** (`topic="general practice", title="undefined"`
  — pre-existing, every grade, worth its own item); **`mode` is almost always
  `side-by-side`**, so the assessed K path is rarely routed while
  `supportsEvaluation: true` still attracts assessment demand to a viewer;
  0 eval modes.
  ~~**S6 `species-profile`**~~ **S6 CLOSED 2026-08-07 — READY at PRE.**
  Verdict **SCAFFOLD-GAP + PRIMITIVE-GAP + CONTENT-GAP**. The predicted
  `= ctx.gradeContext` @ `:241` was real, but **prose-into-the-prompt is not the
  defect here** — there were no dead char-compares to fix. Two other things were.
  **(1) NO RUNG WAS EVER STAMPED — 4th appearance.** `SpeciesProfileData` had no
  band field at all, so K and G4 payloads were structurally identical and the
  component had nothing to gate on. Every gate would have been dead on arrival.
  **(2) THE CONTENT WAS THE LOAD, not the chrome.** One prompt bullet ("for
  younger students, use simpler language") against **eight mandatory REQUIREMENTS
  sections** demanding complete taxonomy, accurate measurements and discovery
  history. Probe @ K returned `Ursus maritimus`, Kingdom `Animalia` / Phylum
  `Chordata`, *"300 to 600 kilograms"*, *"1.3 to 1.6 meters tall"* and
  ***"Formally described … in 1774 by the Constantine John Phipps"***.
  **Band-gating the component alone would have hidden the Latin name and left
  "300 to 600 kilograms" in the size row** — S4's lesson restated. Requirements
  1/4/7 are now band-SCOPED (K-2: comparisons only + "NEVER write a number with a
  unit"; taxonomy = broad everyday group, other ranks empty; `discoveryInfo`
  empty; a named jargon ban list with replacements). Belt-and-braces: at K-2 the
  generator writes comparisons into the RAW size fields too, so a missed gate
  still cannot leak a number.
  **(3) SCAFFOLD-GAP** — it was one of the 26 mute primitives; catalog block
  (8 contextKeys, 3 levels, 5 struggles, 3 aiDirectives) + `useLuminaAI` with 2
  moments and a read-aloud on the name and on **every fact** (the S15 precedent —
  the facts are the card's entire content and a non-reader had no way to hear
  them). **This primitive has no answer to protect**, so the directives guard the
  opposite risks instead: never read the whole card unprompted, never invent a
  fact the card lacks, and never put back the Latin/measurements the card
  deliberately withheld — the last explicitly lifted at 3-5/6-8.
  **(4) PRIMITIVE-GAP** — Latin binomial, Name Meaning, the whole taxonomy
  accordion, the discovery footer, the category badge and the raw metric values
  all gated at K-2 (the child-scale `*Comparison` string becomes the value);
  `imagePrompt` removed at EVERY grade (**4th appearance** of the S9/S13/S5 leak).
  Gates: 29 tests, **12 revert-bites / 12 bite** (4/7/1/1/1/1/9/2/1/1/1/1 — one
  needed re-anchoring for a harness escaping issue, not a test gap); src-scoped
  tsc **803 = baseline set-identical**, typecheck:lumina 0, full vitest
  **2248/2248**, tutor-test T1 `pass` + T2 `findings: []`, `dataBagDynamic:false`,
  8/8 keys, zero `(not set)`.
  **Runtime A/B @ K: `gradeBand` undefined→`K-2`, "300 to 600 kilograms"→"heavier
  than twenty kids put together in a big pile", discovery citation GONE; G4
  control keeps all of it.** **Driven in real Chrome:** K-2 shows no Latin, no
  taxonomy, no discovery, no badge, **no kilograms or metres anywhere**, 4
  read-aloud buttons, 0 nested buttons, zero console errors; 3-5 keeps everything.
  Report `qa/reader-fit/species-profile-PRE-2026-08-07.md`.
  *Residuals:* no Tier-3 live audio; **rule 8 is N/A not passing — no evaluation
  hook at all**, which makes **4 primitives in this sweep** (S11, S12, S15, S6)
  awaiting the same portfolio decision — `/add-eval-modes` or declare
  exploration-only so the manifest stops routing assessment demand at them;
  **rule 3 PARTIAL — the image is on-demand behind a text button at every grade**,
  and turning images ON at K-2 the way S5 did is the single biggest remaining PRE
  win here (a registry change with a latency cost, deliberately not bundled);
  `scientificName` is still generated at K-2 (required schema field) though never
  shown or spoken; one pre-fix G4 draw returned a malformed `taxonomy.species`
  with ranks stuffed in as literal `\n key: value` text — did not recur, worth an
  `/oracle-test` contract if this gets real traffic.
  → **NEXT: S7 `mission-planner`** (predicted `= ctx.gradeContext` @ `:252`,
  astronomy — **probe it; the predicted shape has now been wrong or incomplete in
  both S5 and S6**).
- **15B — SCAFFOLD-GAP, fix = `/add-tutoring-scaffold` then `/reader-fit --fix`**
  (interaction is genuinely K-fit; only the voice is missing):
  ~~**S8 `moon-phases-lab`**~~ **S8 CLOSED 2026-08-06 — READY at PRE.** Catalog
  `tutoring` block (11 contextKeys, 3 levels, 5 struggles led by the primitive's
  own *"phases are Earth's shadow"* misconception, 3 aiDirectives incl. a
  PRE-READER READ-ALOUD that overrides the lesson one-sentence cap) + component
  `useLuminaAI` with 5 moments + 4 read-aloud surfaces + K-1 band gating (stat
  panel, degree readout, days/sec and text phase labels off; emoji-primary
  options). **Second defect fixed in the same slice, found by the probe and NOT
  queued:** the generator regexed PROSE `ctx.gradeContext` for `/grade\s*(\d|K)/`
  and fell through to a literal `'3'`, so **K was served Grade 3 content with
  `split_view`** — which also made the new `isPreReader` gate dead code at K.
  Now canonical-first via exported `moonPhasesGradeFromGrade()`, prose kept as
  fallback, **no floor** (unlike S1 — this primitive really is K-fit). Gates:
  12 focused + 15 jsdom tests, **revert-bite 5/12 and 4/15**, tsc **805 =
  baseline**, typecheck:lumina 0, full vitest **1813/1813**, tutor-test Tier 1
  `pass` + Tier 2 probe all `resolvedBy: component`. **Runtime A/B @ K: pre-fix
  `gradeLevel:'3' / split_view / "Grade 3 Space Explorer"`; post-fix
  `'K' / from_earth / "Peek-a-Boo Moon"` — with G3 unchanged as control.**
  Report `qa/reader-fit/moon-phases-lab-PRE-2026-08-06.md`.
  *Residual (NOT closed):* no Tier-3 live audio run → HUMAN-CHECKS; still 0 eval
  modes → `/add-eval-modes`.
  ~~**S9 `classification-sorter`**~~ **S9 CLOSED 2026-08-06 — READY at PRE, and
  the queued verdict was INCOMPLETE.** Triage called this SCAFFOLD-GAP ("tap/drag
  creatures into groups") — the voice was indeed missing, but the interaction was
  **not** fine: placement was HTML5 drag-and-drop ONLY, a two-part act a
  five-year-old cannot execute (PRE rules 2 + 4). Three defects closed:
  (1) **SCAFFOLD-GAP** — catalog block (8 contextKeys, 3 levels, 5 struggles,
  2 aiDirectives) + 6 component moments. The answer/question split is the
  load-bearing part: the RULE and GROUP NAMES are the question (spoken freely and
  often), the correct group is the answer — forbidden outright *including by
  elimination*, and `[SORT_INCORRECT]` deliberately never interpolates
  `correctCategoryId`. (2) **PRIMITIVE-GAP, unqueued** — fixed with the
  **WordSorter PRE precedent**: at K-2 ONE item is staged and the group cards
  become answer buttons, collapsing drag to tap = choose; drag untouched at 3-5+;
  both protocols funnel through one `placeItem()`. (3) **Prose-band lookup,
  unqueued** — `gradeBandMap[ctx.gradeContext] || '3-5'` keyed the map on bare
  tokens but indexed it with PROSE, so it missed at EVERY grade and `'3-5'`
  always won; probe at `grade=K` returned `gradeBand:'3-5'` with THREE categories
  against a K-2 rung reading "Binary sorts only (2 categories)". **Different
  mechanism from S8's regex — grepping for the S8 pattern would have missed it.**
  Also removed `item.imagePrompt` from the render: an image-GENERATION
  instruction was printed as student copy **at every grade**. Gates: 13 + 12 tests,
  **revert-bite 5/13 and 6/12**, src-scoped tsc **803 vs 804 baseline (one fewer,
  zero new)**, typecheck:lumina 0, full vitest **1853/1853**, tutor-test Tier 1
  `pass` + Tier 2 **14/14 vars `resolvedBy: component`**. **Runtime A/B @ K:
  `'3-5'`/3 categories → `'K-2'`/2 categories, G4 control unchanged.**
  Report `qa/reader-fit/classification-sorter-PRE-2026-08-06.md`.
  *Residuals:* no live audio run → HUMAN-CHECKS #73; rule 3 only PARTIAL (item
  cards are words — `imagePrompt` exists but no image pipeline is wired for this
  primitive); 0 eval modes.
  ~~**S10 `day-night-seasons`**~~ **S10 CLOSED 2026-08-06 — READY at PRE; the
  queued verdict was INCOMPLETE again (2nd time in a row).** Triage: SCAFFOLD-GAP
  ("rotate the Earth, watch the light"). Reality: the only assessment at K was a
  **free-text `<input placeholder="Type your answer...">`** — PRE rule 6 — and it
  **scored any non-empty string as correct**, so a K child who cannot type scored
  0 and a child who typed "aaa" scored 100. Three defects closed:
  (1) **SCAFFOLD-GAP** — catalog block (9 contextKeys, 3 levels, 5 struggles,
  3 aiDirectives) + 4 moments. Struggles lead with BOTH misconceptions the
  primitive exists to correct ("the Sun moves", "seasons come from distance"),
  plus a `THE TILT, NOT THE DISTANCE` directive forbidding "closer"/"farther" as
  a cause *even as a thing to reject in passing*. (2) **PRIMITIVE-GAP, unqueued**
  — typing removed at K-1 (questions become a spoken 🔊 prompt), `<select>` →
  tappable emoji place buttons, degree readout + hours card gated; **scoring moved
  to the INSTRUMENT** (spun / played / observed ≥2 places), which is *stricter* at
  K than what it replaced. (3) **Prose-grade, predicted + probe-confirmed** — the
  worst astronomy offender (13 char-compares, 0 reads of `ctx.grade`); probe at
  `grade=K` returned `'3'` + `showTiltAxis:true` + 4 markers + 3 objectives +
  `timeSpeed:5`, i.e. **every K rung violated**. Fixed via exported
  `dayNightGradeFromGrade()`, no floor.
  **Deliberately NOT shipped:** a `[EARTH_DAY_NIGHT_FLIP]` narration beat — the
  lit/unlit test depends on terminator angle conventions that could not be
  confirmed visually this session, and a tutor saying "now it's night in New York"
  over a daylit screen is worse than silence. `isDaytimeAtMarker` is instead
  derived from the SAME expressions the renderer uses (so it cannot drift from the
  drawn shadow) and reported on the verifiable `[EARTH_LOCATION_SELECTED]` moment.
  **`tutor-test` caught the resulting dead directive tag** — rewritten.
  Gates: 12 + 13 tests, **revert-bite 12/25**, src-scoped tsc **803 = baseline,
  zero new**, typecheck:lumina 0, full vitest **1878/1878**, tutor-test Tier 1
  `pass`. Report `qa/reader-fit/day-night-seasons-PRE-2026-08-06.md`.
  *Residuals:* the day/night reading needs ONE visual confirmation (HUMAN-CHECKS
  #73 — if inverted the fix is one `!`); no live audio run; 0 eval modes.
  ~~**S11 `solar-system-explorer`**~~ **S11 CLOSED 2026-08-06 — READY at PRE.**
  First slice where the generator's HAPPY path was already right at K (probe:
  `gradeLevel:'K'`, `initialZoom:'inner'`, 5 bodies) — the prompt carries the
  audience in prose, which is the one place prose belongs. Three findings:
  (1) **SCAFFOLD-GAP** — catalog block (8 contextKeys, 3 levels, 5 struggles,
  2 aiDirectives) + 3 moments. Two notable rules: a hard **no-measurements**
  directive at PRE (the detail card is six numeric cells — AU/km/days/hrs/°C/moons
  — and the tutor is given the replacement register: "the biggest one", "really
  really hot"), dropped at 3-5 where numbers are the point; and a **SCALE
  HONESTY** directive, since 2 of the 5 struggles are misconceptions *the layout
  itself invites* (planets look lined up, look close together).
  (2) **Degrade-path grade blindness** — `getDefaultBodies(gradeLevel)` was fed
  PROSE, and its only branch is `=== 'K' || '1' || '2'`, so the K-2 branch was
  **UNREACHABLE** and a Kindergartener fell back to all 8 planets instead of the
  inner 4 — firing only when Gemini returned no bodies, i.e. when the lesson was
  already degraded. **This is the `matter-explorer` inline-resolver shape: no
  named resolver to grep, and no happy-path probe can reach it.** Fixed via
  `solarSystemGradeFromGrade()` + a canonical `gradeRung`; prose stays in the
  prompt. (3) **PRIMITIVE-GAP, unqueued** — 6 categories of adult chrome around
  the tap (3-clause 12px protocol text, 3 checkboxes, scale `<select>`, raw speed
  multiplier, calendar date, 6-cell stat grid), all gated at K-1, all kept at 3-5.
  **Lesson worth carrying: the first gating attempt used Tailwind `hidden` and the
  jsdom test failed it correctly — CSS-hidden is NOT gone** (text stays in the DOM
  and reachable by AT). Use conditional render.
  Gates: 12 + 13 tests, **revert-bite 5/13**, src-scoped tsc **803 = baseline
  zero new**, typecheck:lumina 0, full vitest **1903/1903**, tutor-test Tier 1
  `pass`. Report `qa/reader-fit/solar-system-explorer-PRE-2026-08-06.md`.
  *Residuals:* no live audio run; **no evaluation hook at all** (pure explorer —
  rule 8 is N/A, not passing; `planetary-explorer` is the measured cousin);
  0 eval modes; `instanceId` newly typed on the data interface.
  ~~**S12 `scale-comparator`**~~ **S12 CLOSED 2026-08-06 — READY at PRE. Carried
  the MOST COMPLETE prose-grade instance in the sweep — the only one where prose
  escaped the generator and reached the component.** `gradeLevel = ctx.gradeContext`
  then `gradeLevel: gradeLevel as 'K'|'1'|…|'5'` — **an `as` cast that silenced
  the compiler at exactly the boundary being violated.** Probe @ K returned
  `gradeLevel: "kindergarten students (ages 5-6) - Use clear language…"` and
  `showRatios: true` (catalog: "false for K-1"). Four live consequences:
  `getGradeConfig`'s `switch` never matched so every grade got the default rung;
  the prompt's audience line rendered as *"Grade kindergarten students (ages 5-6)
  - Use clear…"*; all six per-grade prompt blocks were unreachable; and **the
  component's own pre-existing `formatNumber` K branch was dead**, because the
  field it tests held a sentence — so any band gate added there would have been
  dead on arrival too. Fixed via `scaleComparatorGradeFromGrade()`, both casts
  deleted, `audienceProse` passed to the prompt separately.
  Plus (2) **SCAFFOLD-GAP** — catalog block + 3 moments, whose real job is
  supplying a **non-numeric comparison register** ("much bigger", "tiny next to
  it") since the entire primitive is about magnitude; a second directive,
  `COMPARISON IS THE ANSWER, NOT THE NUMBER`, applies at every grade. (3)
  **PRIMITIVE-GAP, unqueued** — five categories of numeric chrome gated at K-1
  (km on cards, km on the diagram, "N selected" tally, log-scale checkbox with a
  prose label, and the "3.7× larger" ratio panel — the last gated in the
  COMPONENT as well as the generator, and tested by passing `showRatios:true` at
  K and asserting it still does not render).
  **React footgun caught by the test:** `[SCALE_OBJECT_ADDED]` decided
  add-vs-remove with a flag set INSIDE the `setState` updater and read right
  after — React runs updaters during render processing, so it was always false
  and the cue never fired. Decide from the current render's state instead.
  Gates: 13 + 13 tests, **revert-bite 11/26**, src-scoped tsc **803 = baseline
  zero new**, typecheck:lumina 0, full vitest **1929/1929**, tutor-test Tier 1
  `pass`. Report `qa/reader-fit/scale-comparator-PRE-2026-08-06.md`.
  *Residuals:* no live audio run; **no evaluation hook** (same as S11 — 2 of the
  8 are pure instruments with no measurement path; worth a portfolio call:
  `/add-eval-modes` or declare them exploration-only so the manifest stops
  routing assessment demand at them); 0 eval modes.
  ~~**S13 `life-cycle-sequencer`**~~ **S13 CLOSED 2026-08-06 — READY at PRE.**
  Lowest triage risk in the class (3) and it *still* needed a component band-gate
  pass — 5 of 6 slices now. (1) **SCAFFOLD-GAP** — catalog block + 3 moments.
  Answer discipline is unusually tight here because **the ANSWER IS AN ORDER**:
  naming even one position gives away a piece of it, so the `ORDER IS THE ANSWER`
  directive forbids stating the sequence or confirming a placement pre-check, and
  draws the line explicitly — *describing what is happening IN a picture is the
  stimulus and is free; saying where it goes is the answer and is not*.
  (2) **PRIMITIVE-GAP, unqueued** — `imagePrompt` rendered as visible card text
  (removed at ALL grades, same as S9), select-then-target replaced at K-2 by
  **one tap places into the next empty slot** (the constellation-builder
  `guided_trace` shape, not a new invention; untouched at 3-5+), plus the band
  badge, scaleContext prose, "Available Cards (N)" tally and "Drop stage here"
  slot text all gated. (3) **Prose-keyed map** — probe @ K returned `'3-5'`.
  **Fixed by EXTRACTING the resolver to `service/biology/gradeBand.ts`
  (`biologyBandFromGrade`/`biologyBandFromProse`/`resolveBiologyBand`) rather
  than writing S9's a third time; S9 re-pointed at it via aliases so its names
  and tests are unchanged.** Four biology generators had independently written
  the same wrong lookup — correct behaviour is now obtained by import, and S14/S15
  get it for free.
  Gates: 13 (shared resolver) + 11 (jsdom) tests, S9's 13 still green through the
  refactor, **revert-bite 10/24**, src-scoped tsc **803 = baseline zero new**,
  typecheck:lumina 0, full vitest **1953/1953**, tutor-test Tier 1 `pass`.
  Report `qa/reader-fit/life-cycle-sequencer-PRE-2026-08-06.md`.
  **Runtime A/B is the clearest yet — the REGISTER changed:** K went from *"The
  female butterfly lays a tiny egg on a milkweed leaf. The egg contains…"* to
  *"A mama butterfly lays a tiny egg on a leaf. It is so small you can barely…"*.
  *Residuals:* no live audio run; rule 3 only PARTIAL (cards are a Sparkles glyph
  + word label — no image pipeline wired; same as S9, and wiring images for both
  biology sorters together would be one slice); 0 eval modes.
  ~~**S14 `habitat-diorama`**~~ **S14 CLOSED 2026-08-06 — READY at PRE, and the
  most instructive shape in the set: the component was ALREADY written band-aware
  and its gates had NEVER RUN.** `HabitatDiorama.tsx` carries five
  `gradeBand !== 'K-2'` conditions (disruption scenario, relationship overlay,
  relationships panel, 6-8 descriptions, legend descriptions) — all dead, because
  the generator's prose-keyed map never emitted `'K-2'`. Probe @ K pre-fix:
  `'3-5'`, **7 organisms / 4 relationships / disruption present** against a K-2
  rung reading "4-5 organisms, basic predator-prey only, NO disruption scenario".
  Fixed by importing the shared `resolveBiologyBand` from S13 — **most of this
  slice's PRE improvement came from deleting one broken lookup, not from new
  gates.** ⚠️ **Read the rest of the backlog accordingly: a component containing
  band-gating code is NOT evidence that band-gating happens. Only a probe at the
  band is.**
  Also (2) **SCAFFOLD-GAP** — catalog block + 3 moments, with a **no-jargon rule**
  at PRE (forbids producer/consumer/decomposer/herbivore/carnivore and supplies
  the replacement register) dropped at 3-5 where that vocabulary IS the objective,
  plus a `NOTHING HERE IS THE VILLAIN` directive (young children reliably read
  predators as mean). (3) **PRIMITIVE-GAP, unqueued** — the roles legend was
  gated **backwards**: at K-2 it hid each role's DESCRIPTION but kept the five
  TERMS, i.e. undecodable jargon with its explanation removed. Whole legend now
  hidden at K-2, shown WITH descriptions at 3-5. And the organism buttons had
  **no accessible name at all** (emoji-only scene, no `aria-label`) — added for
  organisms and features; an a11y fix at every grade.
  **tutor-test finding worth reusing:** the first run WARNed
  `context-key-unresolvable` on every key with "(bag has dynamic keys — verify at
  runtime)" because `aiPrimitiveData` was assembled behind a local statement in
  the `useMemo`. Flattened to a literal → 7/7 resolve. **A bag built behind
  statements turns a real check into a shrug.**
  Gates: 13 jsdom tests, **revert-bite 4/13**, src-scoped tsc **803 = baseline
  zero new**, typecheck:lumina 0, full vitest **1966/1966**, tutor-test Tier 1
  `pass`. Report `qa/reader-fit/habitat-diorama-PRE-2026-08-06.md`.
  *Residuals:* no live audio run; rule 8 only PARTIAL (submits on organisms
  VIEWED — exposure, not understanding); **organism emoji are chosen by
  string-matching `imagePrompt`**, so a scene whose prompts lack those substrings
  renders 🐰 for everything — a content-fidelity bug worth its own item if
  biology scenes get more use; 0 eval modes.
  ~~**S15 `organism-card`**~~ **S15 CLOSED 2026-08-06 — READY at PRE.**
  (1) **SCAFFOLD-GAP** — catalog block + 3 moments; the PRE directive forbids the
  **scientific name** and **measurements**, supplying replacements ("about as big
  as you"). (2) **The scaffold promised an interaction that did not exist** —
  the first draft said "tap a fact to open it" and carried
  `[ORGANISM_FACT_OPENED]`; `tutor-test` returned `directive-tag-never-emitted`
  because the fact boxes were **static divs**. Resolved by making it TRUE rather
  than deleting the promise, because the audit needed it: at K-2 the card is five
  facts and the header read-aloud covers only name/habitat/diet/funFact — *size*
  and *locomotion* had no spoken twin. Each fact box is now a button at K-2 that
  reads its own label and value; plain divs at 3-5. **Second time in the sweep
  the dead-tag check caught a scaffold describing a primitive that didn't exist
  (S10 was first) — that check is earning its place.** (3) **Prose-keyed map,
  fifth and last copy** — probe @ K returned `'3-5'` with 8 attributes against a
  K-2 rung reading "only basic attributes"; fixed by importing the shared
  resolver, **no fifth copy written**. (4) **PRIMITIVE-GAP** — Latin binomial,
  kingdom badge and a `Grade Band:` developer readout all gated at K-2.
  Gates: 12 jsdom tests, **revert-bite 5/12**, src-scoped tsc **803 = baseline
  zero new**, typecheck:lumina 0, full vitest **1978/1978**, tutor-test Tier 1
  `pass`. Report `qa/reader-fit/organism-card-PRE-2026-08-06.md`.
  *Residuals:* no live audio run; no evaluation hook (reference card by design —
  N/A, not a gap, but don't route assessment demand at it); the on-demand image
  button is still text-labelled at K-2; 0 eval modes.

**✅ 15B IS COMPLETE — 8/8 CLOSED, all READY at PRE.** Every slice is committed
with its own report. What the class actually turned out to be:

| | queued as | also found |
|---|---|---|
| S8 moon-phases-lab | SCAFFOLD-GAP | grade-blind generator (K served Grade 3) |
| S9 classification-sorter | SCAFFOLD-GAP | **drag-only** + prose-keyed band |
| S10 day-night-seasons | SCAFFOLD-GAP | **typing at K**, scored any non-empty string |
| S11 solar-system-explorer | SCAFFOLD-GAP | degrade-path grade blindness + 6 chrome classes |
| S12 scale-comparator | SCAFFOLD-GAP | **prose crossed into the component via an `as` cast** |
| S13 life-cycle-sequencer | SCAFFOLD-GAP | two-act ordering + `imagePrompt` leak |
| S14 habitat-diorama | SCAFFOLD-GAP | **5 correct band gates that had never run** |
| S15 organism-card | SCAFFOLD-GAP | scaffold promised a non-existent interaction |

**The triage label understated the work 8 times out of 8.** "Interaction is
K-fit, only the voice is missing" was true of the *core mechanic* every time and
false about the *screen* every time. A supply-side triage from catalog text
cannot see chrome, protocol or a grade-blind generator — only an Audit C and a
probe at the band can. **Do not trust a Class-B style label for 15A or any
future sweep; budget every slice for a component pass.**

**Every one of the 8 sat on a grade-resolution defect** (7 outright + S11's
degrade path). The scaffold fix alone would have shipped inert in all of them.

**Cross-cutting lessons now recorded in the reports:**
- CSS `hidden` is NOT gone (S11) — text stays in the DOM and reachable by AT.
- A component containing band-gating code is NOT evidence that gating happens (S14).
- An `as` cast at a module boundary can propagate a contract violation into a
  second file where nothing looks wrong (S12).
- A `primitiveData` bag assembled behind local statements makes `tutor-test`
  report every key as "dynamic — verify at runtime", turning a real check into a
  shrug (S14). Keep it a flat literal.
- Don't set a flag inside a `setState` updater and read it after (S12).
- The absolute `tsc` count is unusable while the dev server runs (`.next/types`
  churn) — gate on the `src/`-scoped error SET diff.

**Open across the class:** no Tier-3 live audio run on any of the 8 →
**HUMAN-CHECKS #73** (one sitting covers them all; the day/night reading in S10
is the only genuinely open question in it). **Three of the eight — S11, S12, S15
— have no evaluation hook at all**, so band-contract rule 8 is N/A rather than
passing; either they get `/add-eval-modes` or they are declared exploration-only
so the manifest stops routing assessment demand to them. **All 8 still have 0
eval modes.**
  **Pattern to expect (3 for 3 now): the "SCAFFOLD-GAP, interaction is fine"
  triage label has understated the work every time.** S9 was drag-only, S10 had
  typing at K. Budget each remaining slice for a component band-gate pass, not
  just a catalog block — and run Audit C properly rather than trusting the triage
  line.
  **⚠️ TWO DIFFERENT grade-blindness mechanisms are now confirmed in this queue.**
  Astronomy (S10/S11/S12) uses the S8 shape: regex `/grade\s*(\d|K)/` over prose
  `ctx.gradeContext` (day-night-seasons 13 char-compares, scale-comparator 7,
  solar-system-explorer 1, all reading `ctx.grade` zero times). Biology
  (S13/S14/S15) uses the S9 shape: `gradeBandMap[ctx.gradeContext]`, a map keyed
  on grade tokens but indexed with prose. **Probe each at `grade=K` before
  writing anything** — S8 and S9 both prove the scaffold fix ships inert without
  it, and the two shapes do not share a grep.
  **⚠️ Do NOT gate on the absolute tsc count.** It drifted 805→806→807 on an
  unchanged tree this session: `.next/types/app/**` is in the tsc program and the
  dev server (required for these probes) regenerates it. Gate on the `src/`-scoped
  error SET diff.

**📋 CURRENT HANDOFF (anchors re-derived 2026-08-07):
`qa/HANDOFF-reader-fit-2026-08-07.md`** — written after 15B closed 8/8. Carries
the **re-verified 15A anchors** (the 08-06 ones are STALE — 15B's tutoring blocks
shifted every catalog id), a per-item **prediction of which grade-blindness shape
each remaining generator has** (including that **`story-planner` is already clean
— do not "fix" it**, and that `bio-compare-contrast` has a *fourth* shape: a
function parameter defaulting to `'3-5'`, so the defect is at the CALL SITE), the
proven per-slice recipe, the corrected tsc gate, the seven traps 15B cost real
time on, and the ranked frontier beyond item 15.

*(The 08-06 handoff is retained for its origin story — enumeration, two-channel
test, S1 band-floor + curator A/B template — and is marked superseded in-file.)*

**Pull order now:** ~~15A S2~~ ~~S3~~ ~~S4~~ ~~S5~~ ~~S6~~ **ALL FIVE CLOSED 2026-08-07** →
**15A S7 `mission-planner`** (the last 15A item) → then audit
`planetary-explorer` + `constellation-builder`, which now carry the K astronomy
demand that S1's floor and 15B's fixes redirected onto them.
**⚠️ S6 added a third: the PREDICTED SHAPE has now been wrong or incomplete twice
running.** S5's "fourth shape" was really S9's map relocated to the call site;
S6's predicted prose-grade was real but was **not the defect** — there were no
dead char-compares, and the actual causes were an unstamped rung plus a prompt
whose eight mandatory sections outvoted its one "younger students" bullet.
**Probe before scoping; treat the handoff's per-item prediction as a hint, not a
finding.**
**⚠️ S5 added two rules to the method.** (a) **A generator with a clean body can
still be grade-blind if its band arrives as an ARGUMENT** — check the call site
even when the generator greps clean; the "fourth shape" prediction was right about
the location and wrong about the shape (it was S9's map, relocated). (b) **A jsdom
suite that mocks `useLuminaAI` cannot see a missing `LuminaAIProvider`** — the hook
THROWS, and four 15B primitives had been crashing the biology tester since they
shipped. **Drive one browser render per slice**; S5's only browser-caught bug
(nested `<button>`) was also invisible to jsdom.
**⚠️ S4 taught the sharpest scope lesson in the sweep.** The queue said
"generator already canonical — audit component + scaffold only". The *prediction*
was right (and is now a regression test), but the *scope* was wrong: at K the
primitive had **nothing to choose from**, so no amount of chrome-gating and
read-aloud could make it completable. **A band failure can be a CONTENT gap, not
just a chrome or voice gap — and only the generator can close a content gap.**
Check what the child would actually DO before scoping a slice as catalog- or
component-only.
**⚠️ The 15A "catalog-only, no component work" estimate is dead** — S2 needed a
generator fix, a catalog block AND a full component pass. Budget every remaining
15A slice like a 15B slice.
**⚠️ Probe the NEIGHBOURING grade, not just K.** S2's generator was clean at K on
the happy path and returned **Grade 3 content for a Grade 1 ask**. A K-only probe
would have passed it.
Serial, one primitive per slice ([[feedback_serial-over-workflow-token-budget]]).
**Budget each slice for a component pass** — 15B's "catalog-only" cousin label was
wrong 8/8.

*Two corrections to the `/pm` estimate, recorded so they are not re-raised:*
`stoichiometry-lab`/`gas-laws-simulator` are **not** top-band (their constraints
say "Best for grades 8-12"; they matched only on a "K-8 → HS gap" boast), and
`story-talk` is a **false positive** — it is the PRE reference model and drives
read-aloud from component `sendText`. It was the negative control for the channel
test.

*The other ~64 unaudited K-selectable entries have at least one channel and are
deliberately NOT queued — QA is a gate, not a census ([[feedback_qa-is-a-gate-not-a-census]]).
The ranked table is in the report if a session wants to pull from it.*

### 14. EMERGING (Grade 1) band — ~~RE-SEEDED / TOP QUEUE~~ **DRAINED 2026-08-05; superseded as top by item 15** (census 2026-08-01)

**Census of record:** six published Grade-1 subskills, two each from LA / Math / SS, run through the
real `/topic-trace` brief → manifest → generator pipeline. Reports:
`qa/topic-traces/g1-{silent-e,common-nouns,count-forward-to-120,identical-coins,map-legends,invention-listening}-2026-08-01.md`.

**Routing tally (42 generated components):** `knowledge-check` 6; `sorting-station` 4;
`foundation-explorer` 3; `annotated-example`, `coin-counter`, `comparison-panel`,
`concept-card-grid`, `hundreds-chart`, `image-comparison`, and `number-sequencer` 2 each; 15
singletons. Healthy high-frequency evidence: all four sorting-station draws stamped Grade 1 and
stayed on task; all three foundation-explorer draws stayed in scope. `media-player` reached the real
`SS004-05-c` consumer in `listen_and_look` mode, but remains owned by its separate workstream.

**Remaining pull order (re-ordered `/pm` 2026-08-03):** ~~**14m SWEEP**~~ **14m CLOSED
2026-08-04 — the FULL sweep shipped in one slice** (pilot number-line `dcfaac7` 08-03 →
hundreds-chart/14i + the six K-2 resolvers + coin-counter/14c + 12 chemistry incl.
matter-explorer, a census under-count found in-flight; 43 new tests, 21 real-Gemini probes,
typecheck:lumina 0, tsc 803 baseline, full vitest 1400/1400; report
`qa/reader-fit/14m-sweep-2026-08-04.md`) →
~~14h~~ **14h CLOSED 2026-08-04** → ~~14j~~ → ~~14k~~ **14k CLOSED 2026-08-04** →
~~14l~~ **14l CLOSED 2026-08-05**. ~~**The EMERGING census findings are now fully drained
except the DI-owned `di-math-facts counting_next` half of 14g**~~ **FULLY DRAINED 2026-08-05
— 14g's last half closed out of this queue** (parse bug fixed; the 120 range extension is a
response-class fork now owned by DI BACKLOG item 10, gated on bench sitting #63). **This queue
has no EMERGING census pull left — the next item here is a fresh priority call, not a
carried-over pointer.**

> **PRIORITY CALL MADE — `/pm` 2026-08-06.** The user asked whether this lane had been
> abandoned mid-stream and should resume. It had not: it **drained**. Recording the
> resume condition and the honest yield estimate so the next session does not have to
> re-derive them.
>
> **⚠️ CORRECTED SAME RUN by user push-back — the first version of this note was WRONG,
> and the error is worth recording because it is a reusable trap.** `/pm` first wrote that
> this lane was "worked out" at PRE/EMERGING and proposed the G2 census as a low-yield
> continuation. The user pushed back: *"we have over 100 primitives — explaining to me we
> did 14/14 is missing so many other K-selectable primitives that aren't designed for
> non-readers. If you say only 14 primitives are relevant to K, this is a lack of scope."*
> **Correct.** `/pm` had read **"the queue drained" as "the band is covered."** It is not
> the same claim. This queue was seeded from **demand SAMPLES** — 6 K subskills
> (2026-07-14) and 6 G1 subskills (2026-08-01), then whatever routed in those 12 traces.
> Any primitive that did not surface in those traces was never audited, however selectable
> it is at K. **Sampling demand ≠ covering supply.**
>
> **Coverage measured against the live catalog 2026-08-06 (the number that was missing):**
>
> | | Count |
> |---|---|
> | Catalog primitive entries | **196** |
> | **K-selectable** — catalog text permits K, no `BAND FLOOR` / "Grade 1+ ONLY" / "not appropriate for younger" | **107** |
> | Primitives with ANY reader-fit evidence (report or `*.reader-fit.test.tsx`) | **~38** |
> | **K-selectable and NEVER reader-fit audited** | **≈69** |
>
> **The unaudited set contains near-certain PRE failures, not just unknowns.** Selectable
> at K today: `stoichiometry-lab`, `gas-laws-simulator`, `orbit-mechanics-lab`,
> `telescope-simulator`, `blueprint-canvas`, `digital-skills-sim`, `two-way-table`,
> `story-planner`, `machine-profile`, `bio-compare-contrast`. These are text-heavy adult
> primitives whose catalog descriptions advertise a K-inclusive range, so the manifest
> curator may route them into a Kindergarten lesson where a non-reader cannot start.
>
> **RE-SEED SHAPE — supply-side sweep, NOT another demand census.** The next queue here is
> not a G2 band census (that remains legitimate and never-run, but it is the smaller
> prize). It is: enumerate the 107 K-selectable entries → subtract the ~38 audited →
> triage the ~69 remainder by risk (text-primary interaction, no read-aloud
> `aiDirectives`, no band gate in the component, adult vocabulary in `constraints`) →
> work them with `/reader-fit [--fix]`, highest-risk first. The cheapest fixes are
> catalog-level **band floors** (the `word-sorter` `match_pairs` / `protein-folder`
> pattern) for primitives that simply should not be offered at K at all — those need no
> component work and remove the failure by making the primitive unselectable.
>
> **Honest caveat on the 107.** It is a text-based proxy over catalog description +
> constraints, so it over-counts entries that mention a K-inclusive range incidentally,
> and it cannot tell whether the curator *would* pick a given entry for a real K
> objective. The triage step must verify per primitive. Discount it heavily and the gap
> is still dozens, not zero.
>
> **The G2/DEVELOPING census remains genuinely never-run** (`qa/topic-traces/` holds `k-*`
> and `g1-*` and nothing at G2; FLUENT 3+ is out of scope by the skill's own table). Keep
> it queued BELOW the supply-side sweep.
14g's `di-word-reading` half closed 2026-08-03 (WRONG-PRIMITIVE); 14c rides the 14m sweep;
14d is archived with the rest of the coin-counter tail.
*Why 14m jumped:* 14c and 14i were each queued as one-off generator bugs, but they are the same
defect and a census found 18 more generators carrying it. Fixing the class once is cheaper than
meeting it three more times down the queue — and one instance was already fixed blind in another
stream (calendar-explorer, `423c58f`), which is the signal that it needs an owner.

- ~~**14a. Run the EMERGING census.**~~ **DONE 2026-08-01.** Six real subskills, 42 generated
  components, zero generator errors. The scope/presentation findings below are the re-seeded queue.
- ~~**14e. P0 — numeric Grade-1 generator-boundary dead band (systemic).**~~ **DONE 2026-08-01.**
  Topic-driven components and final assessments now inherit raw `manifest.gradeLevel` as
  `objectiveGrade`; the existing `normalizeObjectiveGrade` remains the only parser and resolves
  `Grade 1`/`1` to precise `ctx.grade: '1'`. `normalizeGradeLevel` reuses that parser to map numeric
  inputs into the existing named bands. Non-vacuity proved: six new assertions failed before the
  fix; focused 41/41 and full 1,076/1,076 pass after. Two real `/topic-trace` replays stamped Grade 1
  on **15/15** generator calls; `phonics-blender` cleared K → 1. `hundreds-chart` 2 and DI generic
  prose persisted, correctly staying in 14i/14g rather than widening this slice. Reports:
  `qa/topic-fidelity/numeric-grade-generator-boundary-2026-08-01.md` and
  `qa/topic-traces/g1-numeric-grade-14e-replay-2026-08-01.md`.
  **📋 HANDOFF (paste-able, line-exact anchors verified): `qa/HANDOFF-reader-fit-14e-numeric-grade-2026-08-01.md`.**
- ~~**14b. coin-counter contract gap G1 — CONFIRMED by authored demand (2/42 routes).**~~
  **DONE 2026-08-01.** Widened as a deliberate **G1 VARIANT** (contract **R11**), NOT full K
  parity: at `gradeBand==='1' && countMode==='like'` the child TAGS each coin by tapping (re-tap =
  rejected double-count, shake + attempt), and the number input + Check appear only after every
  coin is tagged — the TYPED total keeps the "summation" half of `MEAS001-07-c` student-produced
  and the β1.5 answer act intact (full K parity/auto-judge was REJECTED: it would collapse the
  item toward unfailable). `showRunningTotal` RECONCILED: it now also governs the G1 enacted
  display — easy = climbing skip-count readout + value badges (self-check workspace, the
  make-amount philosophy); medium/hard = plain ✓ tags, child sums mentally — so the census's
  `showRunningTotal:false` @ medium now means something instead of being dead (generator stamped
  values unchanged). Catalog gains a scoped GRADE-1 COUNT-LIKE aiDirective (durable spoken twin
  for the tap protocol); standing rulings preserved (countMode from `targetEvalMode`;
  `showCoinValues` default-true on like coins). K (R9), `count-mixed` (R3), `identify` (R4)
  guard-verified unchanged. Verified: jsdom **17/17** (+2 non-vacuity probes bite), full vitest
  **1076/1076**, typecheck:lumina 0 + tsc 803-baseline 0-new, real-Gemini eval-test **6/6 @ G1
  like + 6/6 @ K like + 6/6 @ G2 mixed** (0 desyncs), **real-Chrome click probe ALL PASS**
  (tap → badge → reveal → typed 15¢ graded; easy readout 0→10→30). Contract `--check`
  **COMPATIBLE** (`qa/primitive-contracts/coin-counter-check-2026-08-01.md`). Report:
  `qa/reader-fit/coin-counter-14b-2026-08-01.md`. Residuals: pixel/feel → HUMAN-CHECKS **#58**;
  Tier-3 live `--lesson` ORIENT confirm queued (directive uses the proven cap-overriding carrier);
  G4 single-coin leak observed live again (K draw, one nickel) — still its own `/oracle-test` item.
  Original evidence: `qa/topic-traces/g1-identical-coins-2026-08-01.md`,
  `qa/reader-fit/coin-counter-task3-2026-07-25.md`, HANDOFF
  `qa/HANDOFF-reader-fit-14b-coin-counter-g1-2026-08-01.md`.
- ~~**14f. knowledge-check @ EMERGING — 6/42, routed in every census lesson.**~~ **DONE
  2026-08-02.** Contract derived first (`docs/contracts/knowledge-check.md`), then precise
  `ctx.grade` was threaded into both planning stages. Grade-1 schemas now bound stems/options and
  all six problem shapes; inherently visual map/coin/shape/invention tasks use existing bounded
  `ObjectCollection` / `ComparisonPanel` renderers with required flat fields and reject missing
  evidence. Text-column matching on a visual task is deterministically converted per problem;
  nonvisual mixed siblings, K emoji-picture/type floor, voice, `::pN`, and final attribution stay
  intact. **COMPATIBLE** contract check; 9 focused reader-fit tests, 230/230 contract-facing tests,
  full 1085/1085, Lumina typecheck 0. Real-Gemini G1 `analyze`, map `mixed`, and K regression pass;
  both census replays flipped. Report: `qa/reader-fit/knowledge-check-14f-2026-08-02.md`;
  pixel/feel → HUMAN-CHECKS **#59**.
- **14g. DI family intent/scope fidelity — 3/42 routes.** `di-sentence-reading` stayed on
  its noun objective. **The `di-word-reading` half is CLOSED 2026-08-03 by the DI workstream —
  verdict WRONG-PRIMITIVE, not a generator bug.** Reproduced by probe (a CVCe ask returns
  `cat, pin, dog, sun`), but the catalog constrains this pack to short-vowel CVC + starter sight
  words: there is no CVCe word in the menu and inventing one leaves the benched single-word response
  class, so serving in-scope words is the CORRECT degradation. The real defect was this entry's own
  steering — the old constraints excluded "digraphs, blends, multisyllable", and CVCe is none of
  those, so a single-syllable silent-e word read as in-scope to the manifest. Fixed in
  `catalog/di.ts` constraints (silent-e / magic-e / long vowel named out of scope + pointer to
  phonics-blender `cvce_blend` / cvc-speller / decodable-reader). Measured, not assumed:
  `manifestOnly` traces on 14g's exact topic went **2/3 → 0/3** picks, while the pack's real homes
  still route **3/3** (short-a CVC @ G1) and **2/2** (sight words @ K). No generator code touched.
  Report: `qa/tutor-reports/di-word-reading-2026-08-03.md`.
  ~~**Still open: `di-math-facts counting_next` replaced 1–120 with values only through 12**~~
  **CLOSED OUT OF THIS QUEUE 2026-08-05 — mechanism ruled, defect fixed, remainder transferred.**
  The census observation had TWO layers. The **parse bug is fixed**: `resolveTextScope` matched a
  two-digit capture, so "within 120" read as "within 12" (every three-digit ask was mangled the same
  way, 100 → 10) — now `(\d{1,3})\b`, and a 120 ask **saturates at the pack's benched twenty**
  instead of collapsing to twelve. Real-pipeline 5/5 (max answer 17 pinned, 18 at `hard`); K
  within-5 and G1 within-10 controls unchanged; full Vitest 1601/1601, typecheck:lumina 0.
  The **range extension to 120 is a FORK, not a wider clamp**: every answer past twenty is a
  multi-word numeral ("one hundred seven"), an unbenched spoken response class that DI standing
  gate 1 blocks until a ~30-min bench sitting passes. User chose to extend (Option B) rather than
  steer away, so it is now **DI BACKLOG item 10**, with the probe set "Counting to 120" wired and
  the sitting queued as HUMAN-CHECKS **#63**. Nothing further is owed by reader-fit. Report:
  `qa/tutor-reports/di-math-facts-14g-2026-08-05.md`.
- ~~**14h. number-sequencer @ G1 — 2/42, both contract-misaligned.**~~ **DONE 2026-08-04.**
  Contract derived first (8 requirements; `--check` COMPATIBLE). The blend now uses the shared
  blend-aware resolver plus schema/post-filter enforcement: exact replay emits only
  `count-from|before-after`. Grade 1 now resolves a structured topic/intent numeric window
  (one temperature-0 Flash Lite call only when no explicit range exists): generic practice
  remains ≤100, narrower ≤20 tracks, and published `NBT001-01-a` can reach 120. Render/input
  ranges derive from actual values, so exact `101,102,_,104` renders and grades 103; rejected
  cards are topped up in-range to the 3-card mastery floor. All 5 modes PASS live; 13 fidelity
  probes track; focused 24/24, full 1406/1406, Lumina typecheck 0, tsc 803 baseline. Report:
  `qa/reader-fit/number-sequencer-14h-2026-08-04.md`. **Next = 14j.**
- **14i. hundreds-chart @ G1 — 2/42, both stamp Grade 2.** *(Instance of systemic **14m**.)*
  **Grade-resolution half DONE 2026-08-04 (14m sweep slice 1):** `hundredsChartGradeBandFromGrade`
  (K/1→'1', 2→'2', 3→'3', 4+→'4', null without a grade) threaded canonical-first —
  `config?.gradeBand ?? mapper(ctx.grade) ?? '2'`, fallback never deleted. Wiring tests 7/7
  (revert-bite ×3), typecheck:lumina 0, tsc 803 baseline, full vitest 1334/1334, real-Gemini
  probes: G1→band 1, G3→[2,3,4,5], G4→[3,4,6,7,8] (**first runtime band-4 on the ctx path**),
  no-grade→band 2 unchanged. Report `qa/reader-fit/hundreds-chart-14i-2026-08-04.md`.
  **Intent-focus half MEASURED IN-DESIGN, closed:** the census's "injects a by-2 into the
  nickel/dime 5/10 focus" is the documented "one or two contrast intervals" allowance
  (live replay: 6/7 on the named intervals). A zero-contrast money rule would be a design
  change, not a bug. **120-capability half STAYS OPEN:** the chart is structurally 1–100
  (`buildSequence`/`gridMax`/catalog all pin 100); honoring a 100–120 intent means EXTENDING
  the visual to a 120-chart (12 rows, the CCSS 1.NBT.1 classroom standard) per
  [[trust-intent-over-hardcoded-caps]] — fork territory, its own slice. Until then the better
  manifest outcome for 100–120 asks is number-line (whose 14k window fix is queued).
- ~~**14j. annotated-example scope/grade binding — 2/42, 1 severe failure.**~~
  **CLOSED 2026-08-04.** Exact manifest steering is now promoted to a structured
  authoring contract; canonical grade reaches the generator; authoring, solver, step,
  and challenge output are validated; one bounded repair and an intent-faithful/
  deterministic repeated-addition fallback keep the session in scope. The solver
  PROBLEM echo is byte-checked and serialized for the final-payload oracle. Exact
  coin runtime: 6 nickels → 30¢ via skip-counting only. Exact `108,109,?,111`
  runtime: answer 110. Advanced calculus remains legal (`1/6`). Final real-Gemini
  oracle **3/3 PASS**, 0 failures/violations; focused 227/227; full Vitest 1542/1542.
  Report: `qa/reader-fit/annotated-example-14j-2026-08-04.md`. **Next = 14l.**
- ~~**14k. number-line `between` on a precise missing-number objective — 1/42.**~~
  **CLOSED 2026-08-04.** The structured scope resolver now separates full domain, focus
  window, and exact-missing-number intent. A scoped canonical Grade-1 fork preserves an
  explicit 0–120 range while ordinary K/K-2 clamping remains unchanged; the local pool
  honors the requested 90–110 focus. Exact cards emit adjacent bounds plus additive
  `exactTargetValue`, and the component/oracle require that value while legacy cards keep
  any-interior grading. Contract C1 is RESOLVED / check COMPATIBLE. Real eval-test after
  the final edit passed 4/4 with targets 97, 100, 105, and 106; browser exact click passed;
  tutor live standalone 3/3 and lesson 3/3 passed without answer leakage. Focused 29/29;
  full Vitest 1,569/1,569; touched-surface TypeScript 0 errors. Report:
  `qa/reader-fit/number-line-14k-2026-08-04.md`. **Next = 14l.**
- ~~**14l. flashcard-deck final-assessment expansion — 1/42.**~~ **CLOSED 2026-08-05.** A
  structured temperature-0 request resolver (`service/flashcard-deck/resolveDeckRequest.ts`) reads
  the requested count, the review framing, and the taught concepts out of **intent prose** — where
  they always lived, since no manifest producer stamps `config.cardCount` anywhere in the repo. A
  constraint-presence fork (14j's shape) binds count and scope ONLY when a request is present, so
  generic open-study decks keep the legacy 15-card identity byte-for-byte; under a review scope the
  prompt's two expansion-inviting rules invert and a TAUGHT CONCEPTS block forbids new vocabulary.
  The `cards` schema array is now bounded to the resolved count and sliced in code. Grade-1 replay
  emits **exactly 10** cards with zero untaught vocabulary (no patent/prototype/Internet/medicine);
  the **K community-helpers census instance closed as a rider** (stays on the four taught helpers);
  generic G5 control unchanged at 15; K PRE control holds the 6-card cap with 6/6 distinct emojis.
  Contract C1 + C2 resolved, `--check` COMPATIBLE. Catalog `constraints` padding invitation removed.
  Focused 20/20 (revert-bite 10/20 fail pre-fix); full Vitest 1,589/1,589; `typecheck:lumina` 0;
  tsc 803 baseline. **Anchor correction: the generator is `gemini-flashcard.ts`, not
  `gemini-flashcard-deck.ts`** (the queue text and both censuses named a file that does not exist).
  Report: `qa/reader-fit/flashcard-deck-14l-2026-08-05.md`.
- **14m. SYSTEMIC — generator-local grade resolvers never got 14e's memo.** *(Opened `/pm`
  2026-08-03. This is the OWNING entry for the class; **14c and 14i are instances of it** and should
  be worked through this item, not separately.)*
  **✅ CLOSED 2026-08-04 — FULL SWEEP DONE in one slice.** All 20 generators (8 K-2/elementary +
  hundreds-chart + coin-counter + 11 census chemistry + matter-explorer, an inline-resolver
  under-count the census grep missed) resolve canonical-first; prose fallbacks kept everywhere.
  **The chemistry "may not bite" guess was WRONG in the published band:** safety-lab sent K to
  6-8 off the '6' in the kindergarten prose "(ages 5-6)"; states-of-matter/reaction-lab sent
  published G1/G2 to 3-5 — verified then fixed, probes green (K→K-2, G1→K-2, G2→K-2, K
  mixing→3-5 floor). Where the LLM stamped `gradeBand` via schema (fraction-circles + 6
  chemistry), code now stamps the band whenever a canonical grade exists. Gates: 43 new tests
  (7 suites, revert-bite per generator), typecheck:lumina 0, tsc 803 baseline, full vitest
  1400/1400, 21 real-Gemini probes incl. every previously-unreachable rung with authored demand.
  Report: `qa/reader-fit/14m-sweep-2026-08-04.md`. Residuals queued there: 14i 120-grid fork,
  14k (unchanged), coin-counter contract G2 note now stale (close on next `--check`).
  **PILOT DONE 2026-08-03 — number-line ships the template, contract-first, machine-gated,
  runtime-exercised.** Contract derived
  (`docs/contracts/number-line.md`, 12 R, C1 OPEN → 14k) + `--check` COMPATIBLE. Focused wiring
  tests 7/7 with revert-bite; typecheck:lumina 0; tsc 803 baseline; full vitest 1327/1327; 10
  real-Gemini eval-test probes incl. `grade=4 → 3-5/decimal` — **the first runtime 3-5 render on
  the ctx path** — and `grade=1 → K-2` for the 8 authored G1 consumers. **PREMISE CORRECTION for
  the sweep:** production passes grade-context PROSE, and every production sentence matched the
  old K-2 substring test ("grades 1-5" has a `1`; "thinking" has a `k`) — so the live failure was
  *everything lands K-2 / 3-5 unreachable*, not G1→3-5; the bare-key inversion only hits raw-key
  callers. Verify each sweep target's actual input string before predicting direction. Report:
  `qa/reader-fit/number-line-14m-2026-08-03.md`.
  **The finding:** 14e made `ctx.grade` precise at the generation boundary, but a generator only
  benefits if it READS it. Census over the 219 Gemini generators (`resolveGradeBand|resolveBand|
  gradeToBand(`): **27 files match; excluding 1 test file → 26 generators, of which 19 never
  reference `ctx.grade` at all** — they resolve the band by substring-matching `ctx.gradeContext`
  PROSE, which `GenerationContext` explicitly forbids. So 14e fixed the supply and these 19 still
  consume the old signal. **11 of the 19 are chemistry** (grades 8-12, low routing pressure); the
  other 8 are `coin-counter`, `sorting-station`, `number-line`, `number-tracer`, `fraction-circles`,
  `shape-composer`, `net-folder`, `timeline-builder` — those are the K-2/elementary surface and the
  ones that matter. `hundreds-chart` carries a *different shape* of the same defect (a hard
  `?? '2'` default rather than a prose parse) and so does not appear in that 19.
  **Three independently-observed instances, none of them found by looking for this class:**
  (a) **coin-counter** (14c) — `gemini-coin-counter.ts:190,798,809`: `gl.includes('k')` returns 'K'
  for ANY prose containing a k, and `elementary` prose covers grades 1–5, so bands '2'/'3' are
  unreachable and three authored G2 consumers silently run as Grade 1;
  (b) **hundreds-chart** (14i) — `gemini-hundreds-chart.ts:522`: `config?.gradeBand ?? '2'`, a hard
  default that ignores `ctx.grade` entirely, which is exactly why both census draws stamped Grade 2;
  (c) **calendar-explorer** — found LIVE by the support-tiers batch-2 probes (`/api/lumina/eval-test`
  with grade=1 emitted band **4-5**, because `/4|5/.test(gl)` matches a "4" anywhere in the prose).
  **A fix template already shipped — copy it, don't re-derive it.** calendar-explorer was repaired
  in `423c58f`: a new `calendarGradeBandFromGrade(ctx.grade)` takes precedence and returns `null`
  when there is no canonical grade, with the prose resolver kept ONLY as the fallback
  (`gemini-calendar-explorer.ts:82-109`, and its comment documents the defect). That shape —
  canonical first, prose as fallback, never delete the fallback — is the whole fix, ~15 lines per
  generator.
  **Why this is worth its own item:** it is mechanical, machine-gated (`/eval-test` per generator at
  two grades), needs zero sittings, and it is the difference between 14e being a boundary fix and
  14e being a real one. It also fits the 08-01 push-development ruling.
  **Executor:** `/topic-fidelity` per generator → `/eval-fix`. **Sequence: pilot on `number-line`**,
  then hundreds-chart (14i), then the remaining K-2/elementary generators named above, and the
  **11 chemistry generators last** (grades 8-12, and their prose bands are coarse enough that the
  defect may not bite — verify before spending the slice). 14c (coin-counter) rides the sweep at
  its turn; it is NOT the pilot.
  **Why number-line and not coin-counter — a deliberate reversal (user, 2026-08-03):** the first
  version of this item named coin-counter as pilot *because its contract already documented the
  defect as gap G2*, i.e. it was the cheapest thing for a session to pull. That is exactly the trap
  the user named: **a heavily-worked primitive keeps winning pulls because prior work makes each
  next item cheap**, regardless of demand. coin-counter routes **3** across both censuses and had
  already consumed 2 build slices, 2 contract checks, and 2 human-check rows. number-line is the
  better pilot on the merits: it carries **real census demand via 14k** (a 90–110 intent rendering
  as 19–38), so one slice closes an observed failure *and* proves the template. Its defect is
  confirmed — `gemini-number-line.ts:890` tests
  `lower.includes('k') || includes('1') || includes('2')`, and `elementary` prose contains none of
  those, so a **Grade-1 objective lands on the `3-5` band**; the range resolver then explicitly
  falls back to "existing grade-band defaults", which is the likely mechanism behind 14k.
  **Accept the cost honestly:** number-line has no derived contract, so contract-first adds work
  coin-counter would not have needed. Paying it once is the point — that cost differential is the
  whole reason the worked primitive kept winning.
  **Do NOT bulk-sweep before the number-line pilot is runtime-exercised** (pilot-then-sweep).
- ~~**14c. coin-counter G2 — Grades 2–3 are UNREACHABLE**~~ **✅ CLOSED 2026-08-04 (14m sweep).**
  `coinCounterGradeBandFromGrade` (K/1/2/3, 4+ clamps to '3') canonical-first per contract gap
  G2's prescription; prose fallback kept. Probes: **G2 count-mixed → band 2 with a half-dollar
  drawn** — the `MEAS002-05-a/-b/-c` pool is live for the first time; K/G1 count-like forks
  byte-exact (R9); no-grade → 1. Wiring tests 6/6 (revert-bite ×3). Contract G2/R10 DEFECT notes
  now stale → strike on the next `--check`.
- **14d. coin-counter G3 — K chrome not band-gated + no 🔊** (HUMAN-CHECKS **#52**). The K screen
  still shows grade/counter/phase badges and an English instruction with no replay. This is the
  comparison-builder #2b class and remains the cheapest residual, not Grade-1 demand.

### 2b. comparison-builder @ PRE — ✅ FULLY RESOLVED 2026-07-20 (head 07-14/07-16 + tail 07-20)
Scaffold P1–P3 + component P1 (compare_groups tap-the-side) shipped 07-14; the three
Pulse-walk priorities (chrome band-gate, one_less symmetry, 🔊 Read-me) shipped 07-16.
Report: `qa/reader-fit/comparison-builder-PRE-2b-2026-07-16.md`. Contract:
`docs/contracts/comparison-builder.md` (edit assessed COMPATIBLE, no fork).
- ~~**Component P2 (chrome band-gate) — PEDAGOGY-CRITICAL.**~~ **DONE 2026-07-16.** At
  `gradeBand==='K'` (`isK`) the "Left: N / Right: N" count badges (the rule-#1 leak), the
  "Challenge 1 of N" counter, the mode tabs, and the "Kindergarten"/type badges are all hidden.
  Group pictures + middle "=" (answer surface, contract R1) kept. jsdom band tests: chrome
  absent@K, present@grade-1 control.
- ~~**one_more_less scaffold asymmetry.**~~ **DONE 2026-07-16.** Symmetric on both layers:
  component `voiceOtherOneMoreLess` fires a silent `[DISAMBIGUATE]` voicing the OTHER part after
  the child answers one (latched, answer-free); catalog ORIENT rewritten to voice "one less"
  identically to "one more". **Live `--lesson --runs 3` — decrement spoken 3/3.**
- ~~**On-demand instruction replay (generalizes).**~~ **DONE 2026-07-16.** Shared
  `primitives/shared/ReadMeButton.tsx` (thin `LuminaReadAloud` wrapper) rendered at K in the
  prompt row, SAME position across all four modes; re-voices instruction + answer-free ask.
  First instance of the systemic 🔊-Read-me item below.
- ~~**Audit-C rule 5 (feedback on the object).**~~ **DONE 2026-07-20.** At K the text
  feedback card is hidden; a wrong tap shakes the touched object (group side / `=` for
  compare-groups + compare-numbers numeral box + one_more_less cell; order slots already
  flashed). SFX + the silent spoken hint carry it. Shared `wrongFlash` key + `flashWrong()`.
- ~~**Other eval modes at PRE.**~~ **DONE 2026-07-20** (band+mode fork, builds contract G1):
  **compare_numbers** → tap the BIGGER numeral + middle `=` (K.CC.C.7; no `< > =` buttons,
  no alligator, no Check); **order** → wordless graduated-bar direction cue (text badge
  Grade-1 only); **one_more_less** → 5-cell window centered on target (down from up to 21)
  + wordless ⬆/⬇ row headers + tap=choose. jsdom `ComparisonBuilder.reader-fit.test.tsx`
  **25/25**; full **857/857**; `typecheck:lumina` 0; eval-test @ K 3/3 pass; contract
  `--check` COMPATIBLE. Report: `qa/reader-fit/comparison-builder-PRE-2b-tail-2026-07-20.md`.
  Residual: live `--lesson` + pixel → HUMAN-CHECKS #35; order @ K 4–5-tile load = queued
  EMERGING re-audit note (not a K blocker).
- ~~Behavioral confirm of the tutor beat~~ **DONE 2026-07-14** — live `--lesson` 3/3 PASS.

### 9a. media-player — **PROMOTED to its own workstream 2026-07-16 (user-approved) — no longer worked from this queue**
Step 1 (contract) closed here; Steps 2–3 live in
`qa/media-player-reimagining/BACKLOG.md` (WORKSTREAMS ACTIVE stream 2). The historical item
below is kept for the record; do NOT pull it from this queue.

### ~~9a (historical)~~ media-player — REIMAGINE as a multi-band reading primitive (inspired by deep-dive / interactive-passage) — **user pivot 2026-07-16**
**This SUPERSEDES the prior "picture-primary knowledgeCheck band-gate (helper fits)" plan.** User
call 2026-07-16: media-player was an early ambitious primitive; now that deep-dive and
interactive-passage exist, its segment + per-segment-MCQ design comes up short as a *reading*
surface. A narrow PRE band-gate would polish a primitive whose overall design is the real gap.
The play is a reimagining, not a `--fix`.
- **Step 1 — contract FIRST — ✅ DONE 2026-07-16** (`/primitive-contract media-player --census`).
  Contract: `docs/contracts/media-player.md` (status **CONFLICTED** — C1 open by design, resolution
  = this reimagining). Census: `qa/topic-traces/media-player-census-2026-07-16.md`. **Blast radius
  is SMALL and clean:** live consumers = 2 authored G1 social_studies listening subskills
  (SS001-05-c/SS004-05-c, route 2/2, constraints literally describe the current shape) + occasional
  K explainer routing (1/6 fresh, 2/6 on 07-14) + tutor narration (sweep PASS) + 1 calibration doc
  (2 obs, β 2.9, single `default` identity — cheap to migrate). **Zero G3 routing** — "grades 3+"
  is fiction. **Step-2 fuel:** curriculum-fit probe found the LA listening-comprehension family at
  every band (K scattered 0.731 main-idea-after-listening; **G1 0.767 `LA007-06-a`/`LA007-01-a` —
  authored to the PHANTOM `listen-and-respond`, i.e. unserved real demand**; G2 **MATCH 0.774**
  LA003 recount/evidence family). Keep-true list = contract R1–R7 (narrated segment walkthrough,
  Gemini-Live narration beats + contextKeys, checks answerable from narration alone, no answer
  leak, 3-attempt reveal+skip, single MediaPlayerMetrics submission, on-demand visuals); R8 grade
  handling is the sanctioned rebuild zone. MP-1/MP-2/MP-3 (title echo / CTA fold / no evalModes)
  must clear in the rebuild. Boundary (contract G5): don't absorb read-aloud-studio (production),
  decodable-reader (decoding), interactive-passage (text reading).
- **Step 2 — modality map across bands:** define the reading modalities media-player should serve at
  **K (PRE)**, **EMERGING (grade 1)**, and **ESTABLISHED (grade 2+)** — e.g. PRE = read-aloud +
  picture-primary comprehension check; EMERGING = read-along with light decoding + tap comprehension;
  ESTABLISHED = richer interactive segments (annotate/predict/evidence) in the deep-dive spirit.
  Borrow proven capabilities from deep-dive + interactive-passage rather than re-inventing (their
  PRE read-aloud palette, picture-primary MCQ, block model). Cross-check `/curriculum-fit` so the
  reimagined modes have real homes.
- **Step 3 — build the new capabilities, band by band:** treat like the reimaginings family
  (hydraulics/dump-truck/excavator template, but reading-focused). New/rebuilt eval modes via
  `/primitive` layers + `/add-eval-modes`; **fork on any contract conflict** (eval-mode split → band
  gate → config axis → variant) — never edit in place over a requirement Step 1 surfaced. Close each
  band with `/eval-test` + `/reader-fit` (PRE first, the observed K demand). The old
  `PreReaderSelfCheck` helper still applies to whatever ends up as a PRE picture-MCQ.
- **Preserved from the old plan (still true, feed into Step 2):** per-segment `knowledgeCheck.options`
  + `correctOptionIndex`; script + KC already auto-narrated (`[READ_ALOUD]`/`[READ_KNOWLEDGE_CHECK]`);
  generator reads `inferGradeLevel(ctx.gradeContext)` and should move to `ctx.grade` + stamp
  `gradeLevel`; catalog `constraints` say "grades 3+" but census routes it at K — the band floor is
  wrong and must be reconciled in the reimagining. **Scope note:** this is a heavier slice than the
  rest of the tail (#9b–#9d) — it may warrant promotion to its own short workstream once Step 1's
  contract shows the blast radius. Executors: `/primitive-contract` → `/curriculum-fit` → `/primitive`
  / `/add-eval-modes` → `/eval-test` + `/reader-fit`.

### 9b / 9c / 9d — explainer-tail bespoke — **ALL THREE READY @ PRE 2026-07-16 (see Done).**
concept-card-grid (9b), comparison-panel (9c), flashcard-deck (9d) all shipped their PRE
band-gate + ctx-native generator refactor + catalog PRE-READER directive. Residual for each =
Tier-3 live `--lesson` + pixel (→ HUMAN-CHECKS). With #9b–#9d closed, the K explainer tail drains.

### Lesson-mode sweeps (after pilots 1–2 prove the loop)
- `/reader-fit --lesson "Count to tell the number of objects — up to 5" kindergarten`
  (the observed lesson)
- One K addition/subtraction lesson end-to-end.
- DONE demand-side via topic-trace census 2026-07-14 (6 K subskills, LA/Math/SS):
  reports `qa/topic-traces/k-*-2026-07-14.md`. Re-run the census at grade 1
  (EMERGING) once the K queue drains.

## Systemic items (accumulate evidence, don't fix per-primitive)
- **Direct-manipulation-first for K "act out / build" scenes (seeded 2026-07-16).** Where a K
  story text promises a physical action ("drag them away", "add more", "put them in"), the K
  interaction MUST be that manipulation — the child enacts the scene and the answer is *derived
  from what they built/removed*, never entered via a number/text proxy. Ref user ruling
  `direct-manipulation-first`. First instance = addition-subtraction-scene `act_out` (item 11)
  — **CLOSED 2026-07-16** (see Done; the seed→tap-add/remove→auto-judge template + the
  deterministic tap-accurate instruction are the reusable pattern for the rest of this class).
  - **Sibling audit 2026-07-16** (Explore sweep of all ~60 `visual-primitives/math/` primitives;
    candidates for the SAME read-then-tap-a-number proxy over a manipulable scene, recorded NOT fixed):
    - **RESOLVED 2026-07-16 — `ten-frame` make-ten phase (item 12).** K now fixes the seeded
      counters, accepts taps only on empty cells, and auto-judges the complement when the enacted
      frame reaches 10; its stepper + Check are removed. The fork is band+mode scoped: subitize
      remains flash→hide→number, build/count-all is unchanged, and Grade 1–2 make-ten retains the
      stepper. Contract + report: `docs/contracts/ten-frame.md` and
      `qa/reader-fit/ten-frame-item12-2026-07-16.md`. Browser/pixel check → HUMAN-CHECKS #31.
    - **RESOLVED 2026-07-20 — `counting-board` subitize phase (item 13).** Decided: K subitize
      flashes-then-hides (like ten-frame), keeping the number answer — NOT enacted taps (that is the
      sibling `count_all` skill). Band+mode fork: at `gradeBand==='K' && type==='subitize'` objects
      render only during the flash window, the stepper/Check enable only after they hide, and
      `handleObjectTap` is a no-op so the scene can never be tap-counted. `count_all` @ K and
      Grade-1 subitize unchanged. Contract + report: `docs/contracts/counting-board.md` (R4) and
      `qa/reader-fit/counting-board-item13-2026-07-20.md`. Browser/pixel → HUMAN-CHECKS #34. Its
      `count-on` phase (`:1146–1173`, judged `:609`) is the same defect but a **Grade-1** type —
      deferred to the EMERGING re-audit (contract gap G1).
    - **NOT instances (checked + cleared):** number-bond (missing-part/fact-family are pure-symbol —
      `BondDiagram` draws pips only when counters are passed, which those modes don't; decompose uses
      tap-to-place = good), compare-objects (`type=number` is Grade-1 `non_standard` measurement; K is
      object tapping), length-lab (`TilingWorkspace` derives from `placedUnits` = good), ordinal-line
      (tap the character = manipulation), sorting-station (tap IS the manipulation). Pure
      symbol/equation, place-value, geometry, and upper-grade primitives are out of scope.
    - **PROMOTED to discrete fix items 2026-07-16** (user durability call): ten-frame make-ten →
      **item 12 (DONE 2026-07-16)**, counting-board subitize (display fix) → **item 13 (DONE 2026-07-20)**. coin-counter `count-like` =
      the one un-swept gap → confirm/clear as Task 3. Execution handoff (ten-frame first):
      `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md`. The sibling audit above IS the census
      of record — do NOT re-sweep.
    - **RESOLVED 2026-07-25 — `coin-counter` `count-like` (Task 3). VERDICT: PROXY (CLEARED=false), fixed.**
      The handoff's read held at every pointer: coins rendered `<CoinVisual disabled />` with no
      `onClick`, the answer was a typed `LuminaInput type="number"` behind Check, and `gradeBand`
      was cosmetic-only (no `isK` anywhere). K now ENACTS: tap each coin, a badge stamps the
      **running skip-count total** (5→10→15) in tap order, auto-judge when every coin is counted
      exactly once, no number input and no Check at K; re-tapping a counted coin is a rejected
      double-count that shakes the object (Audit-C rule 5) — so the enacted path is failable, not a
      walk-through. Fork is **band+mode**; Grade 1+ and every `count-mixed` card are byte-identical
      (`git diff` = 160 insertions, **0 deletions**). Contract derived first (none existed):
      `docs/contracts/coin-counter.md`; `--check` **COMPATIBLE**
      (`qa/primitive-contracts/coin-counter-check-2026-07-25.md`). Verified tsc 0-new (all 803
      pre-existing errors are outside `components/lumina/`) + typecheck:lumina 0 + jsdom **9/9**
      (both non-vacuity probes fail the right tests) + full vitest **930/930** + real-Gemini
      eval-test **6/6 @K, 6/6 @G1, 6/6 count-mixed @G2** + **real-Chrome mouse-click probe PASS**.
      Report: `qa/reader-fit/coin-counter-task3-2026-07-25.md`. Pixel → HUMAN-CHECKS **#52**.
      - **RULING (split mechanism):** the component can't tell count-like from count-mixed by
        `challenge.type`, so the generator now **stamps `countMode: 'like'|'mixed'` from
        `targetEvalMode`**. Inspecting `displayedCoins` for a single type was REJECTED — the
        generator rejects multi-type sets for count-like but has **no converse rule**, so a G2
        count-mixed card drawing three dimes would silently flip into K's enacted mode and ablate a
        live consumer. `[[value-origin-not-code-touch]]`.
      - **RULING (`showCoinValues` on like coins):** **legitimate recognition aid, NOT a rule-#1
        leak — kept default-true.** The objective is *skip counting and summation*; the denomination
        is the skip-count INTERVAL (an input), not the answer, and coin-value recall is a different
        subskill (`MEAS001-07-b` → knowledge-check). The total is never printed. Contrast
        comparison-builder's "Left: 3 / Right: 5" (the answer) and `identify`, which already hides
        values because there the value IS the answer. Narrow exception queued as **G4**: a
        count-like card showing exactly ONE coin prints its own total.
      - **PREMISE CORRECTION (the big one) — `count-like` is a GRADE 1 skill.** The census found the
        only authored consumer is **`MEAS001-07-c` @ Grade 1** ("Focus: Skip counting and
        summation… single-denomination sets"), and live routing confirms it resolves at Grade 1.
        **There is no K money subskill in the curriculum at all** — the strand is G1 `MEAS001-07` +
        G2 `MEAS002-05`; the K `MEAS001-07-A…F` sharing that stem is **"Time Durations"**.
        `PRIMITIVE_GAPS.md` GAP-007 mislabels these as "MATHEMATICS (K)" — that stale grade label is
        the likely origin of the K framing. **K is still reachable** (a K topic-driven money lesson
        routes `identify`→`count-like`), so the fork is live code, not dead code — but the PRIMARY
        consumer is Grade 1 and **still has the proxy**. Deliberately NOT widened here: Grade 1 is a
        live consumer with β1.5 item history and changing its interaction deserves its own slice.
        → contract gap **G1**, the highest-value follow-up, and the first item for the EMERGING census.
      - **Other gaps opened:** **G2** `resolveGradeBand` parses `ctx.gradeContext` PROSE (which
        `GenerationContext` explicitly forbids) — so Grades 2–3 are unreachable and G2 money lessons
        silently run as Grade 1 (`/topic-fidelity`); **G3** K chrome (grade badge / "1/2" counter /
        phase badge) is not band-gated and the instruction has no 🔊 — found by the pixel check
        (`/reader-fit --fix`); **G5** the count fallback is a MIXED set; **G6** the catalog advertises
        a K band the curriculum lacks.
    - **Task 3 (coin-counter) — ~~NEXT PULL~~ DONE 2026-07-25 (see above); dedicated handoff `/pm` 2026-07-25:**
      `qa/HANDOFF-reader-fit-coin-counter-2026-07-25.md`. It **supersedes** the 07-16 Task 3 prompt,
      which was written blind and has a naming error that sends a session hunting for a mode that
      doesn't exist: `count-like` is a CATALOG eval mode (`catalog/math.ts:3613`, β1.5) whose
      `challengeTypes` is `['count']` — the component type is `'count'` (`CoinCounter.tsx:39`), and
      `count-mixed` (β2.5) shares it. The handoff carries a completed line-exact source read whose
      **indicated verdict is PROXY, not clear**: in `renderCountChallenge` (`:632`) the coins go
      through `renderCoinGroup` → `<CoinVisual disabled />` (`:599`, no `onClick`) and the answer is
      a typed `LuminaInput type="number"` (`:640`) behind a Check button (`:928`/`:931`); `gradeBand`
      is used only for cosmetic labels (`:321`, `:844`) — no `isK` fork exists in the file. Two
      rulings the executing session must record: (a) the count-like vs count-mixed split (the
      component can't tell them apart by `challenge.type`), (b) whether `showCoinValues` defaulting
      true is a legit recognition aid or a rule-#1 leak for LIKE coins. **Contract-first is
      REQUIRED** — no `docs/contracts/coin-counter.md` exists and the component spans 6 eval modes
      K–3, so `/primitive-contract coin-counter --census` runs before any edit.
- **On-demand instruction replay across K eval modes (seeded 2026-07-16).** Every K math primitive
  should expose a persistent LuminaReadAloud "🔊 Read me" that repeats the current
  instruction/question, in a CONSISTENT position across all of that primitive's eval modes (so a
  struggling non-reader can always re-hear the ask). **First instance BUILT 2026-07-16 on
  comparison-builder (item 2b)** — the shared carrier is `primitives/shared/ReadMeButton.tsx`
  (`buildReadMeMessage` + `<ReadMeButton>`, a thin `LuminaReadAloud` wrapper; student-initiated →
  non-silent). The pattern is now proven; **generalize** by dropping `<ReadMeButton>` into the
  prompt row of the other K math primitives (gate on the primitive's `isPreReaderGrade`/K signal,
  route `onAskTutor` to a non-silent `sendText`, supply an answer-free per-mode `ask`).

- **K-stage presentation mode — MVP BUILT 2026-07-13** (`KindergartenStage.tsx`,
  gated in `LessonScreen.tsx` via `kindergartenMode.ts`; auto-on for K lessons,
  Ctrl+Alt+K override). On-rails one-section-at-a-time with animated frame flow,
  wordless arrow advance gated on section completion, tutor `[SECTION_START]`
  narration. **MVP browser-VERIFIED 2026-07-15 (user)** — the on-rails flow works.
  Still open: per-PRIMITIVE internal chrome
  (counters/steppers inside components) is untouched — keep recording Audit-C
  chrome FAILs here; the stage removes lesson-level chrome only.
- **Scaffold authoring rule** for ADDING_TUTORING_SCAFFOLD.md: every scaffold
  for a K-1-claiming primitive must include the STIMULUS beat (read load-bearing
  text aloud) and the DISAMBIGUATE beat (enact the question). Propose the doc
  edit after pilots 1–2 confirm the pattern.

## Done
- **13. counting-board `subitize` @ K — flash-then-hide DISPLAY fork, READY pending browser check (2026-07-20).**
  Contract-first (`docs/contracts/counting-board.md` derived this run — 8 requirements, 0 conflicts,
  gaps G1 count_on@EMERGING + G2 perceptual-flash@Pre-K). NOT a manipulation swap: the K stepper now
  sits over objects that FLASH then HIDE (mirroring ten-frame subitize), so the numeral answer is
  legitimate. Fork by band+mode at `gradeBand==='K' && type==='subitize'`: `isSubitizeFlashing`
  gates object rendering, `subitizeAnswerReady` gates the stepper+Check, an auto-start effect runs
  prep(800ms)→flash(1500ms)→hide, `handleObjectTap` is a no-op for K subitize (scene can't be
  tap-counted), "Show again" re-flashes, and flash state re-arms on retry/advance. `count_all` @ K,
  Grade-1 subitize, and Pre-K `subitize_perceptual` all UNCHANGED. No generator/schema/catalog
  change (optional `flashDuration?` field defaults to a constant; generator does not emit it).
  Verified: touched-file tsc 0-new + `typecheck:lumina` 0; jsdom `CountingBoard.reader-fit.test.tsx`
  **3/3** (K flash→hide + tap-guard, count_all control, Grade-1 control); full suite **844/844**;
  eval-test @ K `subitize` **PASS** (7 challenges, target===count, counts 2–5, scope honored — content
  unchanged). Report: `counting-board-item13-2026-07-20.md`. Pixel/feel → HUMAN-CHECKS #34.
- **12. ten-frame `make_ten` @ K — direct manipulation, READY pending browser check (2026-07-16).**
  Contract-first fork by band+mode (`docs/contracts/ten-frame.md`): K seed counters are fixed;
  tapping empty cells places the complement; the final fill auto-judges from the enacted count;
  stepper + Check are gone. K build/count-all and flash→hide subitize are unchanged; Grade 1–2
  make-ten keeps its stepper + Check. Browser follow-on fixed: a full make-ten frame had carried into
  the next `add`; transitions now clear first, then mode-specific seed effects run. No schema/catalog
  change. Verified focused jsdom **5/5**, full suite **810/810**, `typecheck:lumina` 0, live eval-test
  **4/4 modes PASS** (K make-ten 7/7).
  No bespoke ten-frame tutor journey exists, so live `--lesson` was infeasible; real-browser tap/
  pixel check → HUMAN-CHECKS #31. Report: `ten-frame-item12-2026-07-16.md`.
- **9b / 9c / 9d. Explainer-tail bespoke @ PRE — ALL THREE READY (2026-07-16).** The three
  explainer-tail surfaces that did NOT fit the fact-file MCQ helper (each bespoke). Shared pattern:
  ctx-native generator refactor (read `ctx.grade`) + stamp `gradeLevel` + code-attached flat emoji
  (dodges the flash-lite nested-array footgun) + a catalog PRE-READER READ-ALOUD `aiDirective`
  (overrides the lesson one-sentence cap) + a component `isPreReaderGrade(data.gradeLevel)` band-gate.
  Reports: `concept-card-grid-PRE-2026-07-16.md`, `comparison-panel-PRE-2026-07-16.md`,
  `flashcard-deck-PRE-2026-07-16.md`.
  - **9c comparison-panel** — the boolean gate renders as a **picture true/false** (👍/👎) via the
    shared `PreReaderSelfCheck` (a boolean gate IS a 2-option self-check), tap=choose, statement
    read aloud on view + 🔊; chrome hidden (Option A/B, VS, "Comprehension Check N of M", synthesis
    prose → spoken). `{{#if}}` handlebars check = clean.
  - **9b concept-card-grid** — emoji card FACE (`cardEmoji`) + **read-aloud-on-flip**
    (`[CARD_READ_ALOUD]` reads name+definition+curiosity note); chrome hidden ("Exhibit 0N", "Flip
    to Analyze", section labels, el.type badge, "Return to Artifact"). New PRE-READER directive.
  - **9d flashcard-deck** (largest) — **authored a whole NEW catalog `tutoring` block** (there was
    none) + wired `useLuminaAI` in the component (was none). Emoji face, auto-start, `[FLASHCARD_SHOWN]`
    voices the term, `[FLASHCARD_READ_ALOUD]` reads the card on flip, 🔊 replay, deck capped to 6 at K,
    chrome hidden (counter/dots/"Click to Reveal"/sublabels), wordless 🎉 summary.
  - Verified (all three): `typecheck:lumina` **0**; **full vitest suite 799/799**; new jsdom suites
    **15/15** (`ComparisonPanel`/`ConceptCard`/`FlashcardDeck.reader-fit.test.tsx`); eval-test @ K
    (each stamps `gradeLevel:'K'` + distinct picturable emojis, ≤12w copy); tutor-test `--probe` @ K
    **PASS 0 findings** (directives resolve, 0 `(not set)`, no `{{#if}}`).
  - Residual (each): Tier-3 live `--lesson` behavioral confirmation (needs a bespoke journey in
    `run_tutor_live.py` + backend) + pixel look → **HUMAN-CHECKS**. Mechanism = the proven
    cap-overriding catalog directive carrier (foundation-explorer / fact-file / knowledge-check).
- **11. addition-subtraction-scene @ K — `act_out` TRUE direct manipulation, READY + USER-CONFIRMED LIVE (2026-07-16).**
  Report: `addition-subtraction-scene-item11-2026-07-16.md`. The 2026-07-16 Pulse finding: subtraction
  `act_out` promised "drag them out of the scene" but the only interaction was a `NumberTileRow` (a
  proxy number). Fixed as a **fork by band + mode** (contract-first: `docs/contracts/addition-subtraction-scene.md`
  derived first).
  - **COMPONENT:** at `gradeBand==='K'`, `act_out` seeds the scene with the story's `startCount`; the
    child taps ＋ to bring `changeCount` more in (addition) or taps objects to send them away
    (subtraction); auto-judges the instant the enacted count equals `resultCount` (reuses the
    create-story build machinery). No `NumberTileRow`/Check at K `act_out`. **Grade 1 `act_out`
    untouched** (count-the-scene); `solve_story` keeps tiles (1b); `create_story` keeps its build (1b).
  - **GENERATOR:** de-"drag"-ed the promptDoc + a **deterministic code-owned** K `act_out` instruction
    ("Tap to bring N more X in!" / "Tap N X to send them away!") so the spoken `{{instruction}}`
    DISAMBIGUATE beat always matches the tap UI. Names `changeCount` only, never `resultCount`.
  - **CATALOG:** description reconciled; `act_out` evalMode desc was ALREADY "Manipulate objects in
    scene" — restored, not changed. **No schema change** — `start/change/result` already model the scene.
  - Verified: touched files tsc 0; **vitest jsdom 5/5**; eval-test @ K (4 tap-accurate `act_out`
    challenges, no leak); **live `--lesson --runs 3` 3/3 CONFIRMED** (story read aloud + tap
    instruction voiced + ORIENT restates the tap action), report
    `qa/tutor-reports/addition-subtraction-scene-live-lesson-2026-07-16.md`.
  - Residual: pixel/feel of the ＋ control + tap-remove → HUMAN-CHECKS. Sibling K scene primitives
    with the same proxy → recorded under the systemic "direct-manipulation-first" item.
- **9. Explainer tail @ PRE — pilot foundation-explorer READY + shared helper + fact-file
  swept; tail reconciled (2026-07-15).** Report: `explainer-tail-PRE-2026-07-15.md`.
  - **Pilot `foundation-explorer` @ PRE — READY** (PRIMITIVE-GAP + SCAFFOLD-GAP → fixed).
    CATALOG PRE-READER READ-ALOUD `aiDirective` (definition + question + every option
    verbatim, answer-free, overrides one-sentence cap); COMPONENT `isPreReaderGrade`
    band-gate (one concept at a time, auto-advance, prose→"🔊 Read to me", self-check via
    the new shared `PreReaderSelfCheck`, chrome hidden); GENERATOR K prompt (≤12w question,
    picturable options, no phantom/leak) + required distinct `optionEmojis` + `gradeLevel`
    stamp. Verified: tsc 0-new + `typecheck:lumina` 0; **jsdom 6/6**
    (`FoundationExplorer.reader-fit.test.tsx`); eval-test @ K **3/3** draws (emojis
    complete+distinct, q≤9w, correctIndex varies); **live `--lesson --runs 3` 3/3** (bespoke
    `build_foundation_explorer_journey`) — definition + question + every option read aloud,
    survives the cap (`qa/tutor-reports/foundation-explorer-live-lesson-2026-07-15.md`).
  - **Shared helper `primitives/shared/PreReaderSelfCheck.tsx`** — the reusable PRE MCQ
    self-check (`useAutoReadOnView` + `buildSelfCheckReadAloud` + `<PreReaderSelfCheck>`:
    emoji-primary, tap=choose, auto-read + 🔊, eliminate-until-correct, eyes-free RECOVER).
  - **Swept `fact-file` @ PRE — READY (pending live).** Helper swap: CATALOG
    `[FACTCHECK_READ_ALOUD]`/`[FACTCHECK_RETRY]` directive; COMPONENT PRE render bypasses the
    text tab-exploration gate + presents self-checks via `PreReaderSelfCheck`; GENERATOR flat
    `option*Emoji` (sidesteps flash-lite nested-array drop) + `gradeLevel` stamp. Verified:
    tsc 0-new + `typecheck:lumina` 0; **jsdom 6/6** (`FactFile.reader-fit.test.tsx`); full
    suite **773/773**; eval-test @ K **2/2** (emojis complete+distinct, q≤8w). Live `--lesson`
    queued (mechanism = the proven pilot directive).
  - **Tail reconciled — NOT one shape** (5-agent structural map). Only fact-file fit the
    MCQ helper. Deferred as distinct items with their (different) treatments: **#9a
    media-player** (helper fits; heavier), **#9b concept-card-grid** / **#9c comparison-panel**
    / **#9d flashcard-deck** (bespoke: no MCQ; need ctx-native generator refactors + grade
    threading; flashcard-deck needs a whole catalog `tutoring` block). User scope call: fact-file
    only this slice. take-home-activity band-exempt (parent-facing).
  - Residuals → HUMAN-CHECKS (emoji-grid pixel look, both primitives) + K-stage systemic
    (PhaseSummaryPanel / results % ledgers). foundation-explorer stall answer-leak (observational).
- **10. word-workout + word-flip @ PRE — audit + `--fix`, both READY (2026-07-15).**
  The PRE band audit that stayed open after the 07-14 scope/routing fixes (those NOT
  re-touched). Report: `word-workout-word-flip-PRE-2026-07-15.md`.
  - **word-workout: SCAFFOLD-GAP + PRIMITIVE-GAP → READY** for `real_vs_nonsense` /
    `picture_match` / `word_chains` (the K CVC census route); **`sentence_reading` =
    WRONG-BAND at PRE → floored to Grade 1+** (connected-text decoding, decodable-reader
    precedent; catalog `constraints` band-floor). Fixes: GENERATOR stamps `gradeLevel`
    (`resolvePreReaderGradeKey`); COMPONENT `isPreReaderGrade` band-gate (header chrome +
    **"Vowels: a" scope-leak label** + counter + progress hidden; per-mode instruction
    sentences hidden; text feedback card hidden; PRE `[ACTIVITY_START]` voices the per-mode
    play action answer-free; real grade → `useLuminaAI`); CATALOG **PRE-READER HOW TO PLAY**
    `aiDirective` (durable cap-overriding ORIENT). **live `--lesson --runs 3` 3/3 PASS**
    (bespoke `build_word_workout_journey`): tutor voiced "Read each word out loud…" every
    run, survived the one-sentence cap, never read the chain words for the child.
  - **word-flip: band decision = NOT WRONG-BAND → HONORED core, chrome PRIMITIVE-GAP fixed
    → READY.** The 07-14 "likely floor to G1+" hypothesis was WRONG: plural_s is a genuine
    K oral-grammar skill (regular plurals ≈ L.K.1.c), the catalog claims K, and it is the
    reader-fit skill's OWN PRE reference model (`SKILL.md:70`, voice-first counted-picture
    frame). Flooring would delete a legitimate K primitive. Fix = COMPONENT `isPreReaderGrade`
    band-gate (counter/tally/progress/mode badge/voice-toggle + start-screen badge + consent
    essay hidden; frame + mic + chips + start buttons remain) + CATALOG new `tutoring` block
    with a **PRE-READER ORIENT** `aiDirective` (was NO tutoring block). tutor-test --probe
    pass, 0 findings.
  - Verified: tsc 0-new + `typecheck:lumina` 0; **jsdom WordWorkout 9/9 + WordFlip 7/7**
    (chrome hidden at K, present at Grade-1 control; ORIENT answer-free); literacy 38/38;
    intent-contract 1/1. Live report: `qa/tutor-reports/word-workout-live-lesson-2026-07-15.md`.
  - Residuals: pixel → HUMAN-CHECKS #17 (word-workout) / #18 (word-flip); PhaseSummaryPanel
    ledgers → K-stage systemic; word-flip live run = optional belt-and-suspenders.
- **8. rhyme-studio @ PRE — audit + `--fix`, READY (2026-07-15).** Overall
  PRIMITIVE-GAP + SCAFFOLD-GAP → **READY @ PRE for recognition + identification**
  (the two K census routes); production floored to Grade 1+ (WRONG-BAND at PRE — Tier 4,
  word-bank distractors can't be pictured). Three layers, one loop:
  - **CATALOG (RF-1, scaffold gap):** PRE-READER READ-ALOUD `aiDirective` — on
    `[ACTIVITY_START]`/`[PHASE_TRANSITION]`/switch at Grade K, SAY both words (recognition)
    or target + every option (identification) and ASK the rhyme question, answer-free,
    overriding the one-sentence cap; `comparisonWord`+`optionWords` added to `contextKeys`
    and forwarded from the component bag (were absent — no durable directive could name them).
  - **COMPONENT (RF-2, primitive gap):** `isPreReaderGrade` band-gate — emoji-primary word
    cards (word → caption), recognition answers become a big 👍/👎 icon, identification tiles
    emoji-primary, question sentences hidden (tutor voices them), text feedback card hidden
    (ring + SFX + spoken carry it), chrome hidden (title/Grade/mode badges, counter, "N correct"
    ledger, progress bar, start paragraph), Next/Finish → wordless ▶/🎉. tap=choose already held.
  - **GENERATOR (RF-3, primitive gap + reliability):** flash-lite **silently drops the nested
    `options` array when also asked for emojis** (confirmed: grade-1 no-emoji → options present;
    K emoji-ask → 9/9 empty-option fallbacks). Fix: constrain K word choice to a curated
    picturable menu (`K_RHYME_FAMILIES`, ≥3/family, injected into the prompt) and attach the
    depicting emoji **deterministically in post-process** (`kEmojiFor`; ⭐ only on a menu miss);
    production floored out of the K mix. eval-test @ K: 9/9 identification real distinct emojis,
    0 fallback, 0 rhyme-logic errors.
  - Verified: tsc 808/808 (0 new) + `typecheck:lumina` 0; **jsdom 6/6**
    (`RhymeStudio.reader-fit.test.tsx`); tutor-test `--probe` — `comparisonWord`/`optionWords`
    resolve `by component`, no new findings; **live `--lesson --runs 3` PASS both K routes**
    (bespoke `build_rhyme_studio_journey`): recognition 3/3 ("cat … hat. Do these words rhyme?"),
    identification 3/3 ("Listen to 'cat'. The options are 'hat' or 'pig'. Which one rhymes?") —
    words + question voiced every run, surviving the one-sentence cap. Reports:
    `qa/reader-fit/rhyme-studio-PRE-2026-07-15.md`; live
    `qa/tutor-reports/rhyme-studio-live-lesson-2026-07-15.md` (recognition) +
    `…-identification-2026-07-15.md`.
  - Cross-check: does NOT duplicate poetry-lab `rhyme_hunt` @ K (different primitive/route;
    `project_poetry-lab-rf-fix-rhyme-hunt`). Grade-fidelity `clampGradeToK2` pin (`7cb5e5f`) intact.
  - Residuals → K-stage systemic: PhaseSummaryPanel % ledger. Pixel look → HUMAN-CHECKS.
    Scaffold `scaffoldingLevels` stacked-questions WARN (pre-existing, non-blocking).
- **7. phonics-blender @ PRE — audit + `--fix`, READY (2026-07-15).** Overall
  PRIMITIVE-GAP + minor SCAFFOLD-GAP → **READY @ PRE for `cvc`** (the only K-band
  eval mode; cvce_blend/digraph/advanced are Grade 1-2 by the catalog + the
  `clampGradeToK2` pin, not re-touched). Two findings, one loop:
  - **CATALOG (RF-1, scaffold gap):** PRE-READER HOW TO PLAY `aiDirective` — voices
    a play action (tap the sounds → put them in order → say the word) at
    `[ACTIVITY_START]`/`[PHASE_TO_BUILD]` at Grade K, answer-free, overriding the
    lesson one-sentence cap. STIMULUS was already spoken on tap via
    `[PRONOUNCE_SOUND]` (per-tap, un-capped) → only ORIENT needed the durable carrier.
  - **COMPONENT (RF-2, primitive gap):** K band-gate (`isPreReaderGrade`) — tiles
    **letter-primary** (was `/k/` slash notation, rule 6), phase stepper + word
    counter + Grade/pattern/phase badges hidden (rule 7), instruction labels hidden
    (tutor voices them), text feedback card hidden (slot flash + SFX + spoken hint
    carry it, rule 5), Clear dropped (tap a placed tile to remove). Arranging the
    sounds stays a multi-part construction → **Check kept** (rule 2). Reader grades
    unchanged.
  - Verified: tsc 808/808 (0 new) + `typecheck:lumina` 0; **jsdom 7/7**
    (`PhonicsBlender.reader-fit.test.tsx`); eval-test `cvc` @ K pass (emoji present);
    tutor-test `--probe` 0 findings; **live `--lesson` 3/3 PASS** (bespoke
    `build_phonics_blender_journey`) — tap/listen action + word voiced at
    activity-start, "put the sounds in order" at build, next word named on advance,
    all surviving the one-sentence cap. Report:
    `qa/reader-fit/phonics-blender-PRE-2026-07-15.md`; live:
    `qa/tutor-reports/phonics-blender-live-lesson-2026-07-15.md`.
  - Residuals → K-stage systemic: PhaseSummaryPanel ledger + "Ready to Build!"/
    "Blend!"/"Say it!" button labels. Pixel look → HUMAN-CHECKS. Grade-fidelity
    `clampGradeToK2` pin (`7cb5e5f`) left intact.
  - **Follow-up (queued by contract derivation 2026-07-15, executor `/tutor-test`):**
    the component emits `[PRONOUNCE_SOUND]` on tap but the catalog `PRONUNCIATION
    COMMANDS` directive (`literacy.ts:221`) triggers on `[PRONOUNCE]` — a tag-prefix
    mismatch. STIMULUS-on-tap is jsdom-verified (the emit) but **unverified at
    runtime** (Gemini's spoken response), because the live-lesson runs never tapped a
    tile. Add a tap-pronounce beat to the bespoke journey / probe to confirm the
    tutor actually speaks the sound on tap. Low risk (the message body is
    self-executing) but a real latent smell. Do NOT rename the tag in place without a
    `/primitive-contract phonics-blender --check` run — it touches every reader
    grade's audio path (contract R2).
- **1e. sorting-station @ PRE — presentation audit + fix loop, READY (2026-07-15).**
  Overall was PRIMITIVE-GAP + SCAFFOLD-GAP → **READY @ PRE for `sort_one` (THE K census route)
  and `odd_one_out`**; `sort_attribute`/`count_compare`/`two_attributes`/`tally_record` =
  **WRONG-BAND, floored to Grade 1+** (K still routes to the two picture-primary tap modes).
  Fixes: CATALOG `aiDirectives` ORIENT/STIMULUS/DISAMBIGUATE beat (name every bin + ask the
  sort, overrides the lesson one-sentence cap) + band-floor descriptions/constraints + dead
  `studentAnswer` key removed; COMPONENT K band-gate (picture-primary `bucketEmoji` bins with
  color-circle fallback, chrome hidden, odd_one_out tap=choose auto-submit) + `instruction`
  forwarded into the bag; GENERATOR `categoryEmojis`→`bucketEmoji`. Verified: tsc 0-new +
  `typecheck:lumina` 0-err; **jsdom 6/6** (`SortingStation.reader-fit.test.tsx`); eval-test
  re-probe (bins carry a picture) + tutor-test re-probe (directive resolves); **live `--lesson`
  3/3 CONFIRMED** (bespoke `build_sorting_station_journey` in `run_tutor_live.py`). Report:
  `qa/reader-fit/sorting-station-PRE-2026-07-15.md`; live: `qa/tutor-reports/sorting-station-live-lesson-2026-07-15.md`.
  Residuals → K-stage systemic: PhaseSummaryPanel ledger, "Next Challenge" text button. Pixel
  look → HUMAN-CHECKS. Generator objective-drift was already FIXED 2026-07-14 (not re-opened).
- **1f. shape-tracer — CRITICAL generator bug (wrong shape↔path), RESOLVED + RUNTIME-VERIFIED**
  (2026-07-14, Handoff Task 1; reconciled into Done by `/pm` 2026-07-15 — was a stale-open here
  while already struck in EVAL_TRACKER). SHT-1 fix: a deterministic `placeShape()` affine-transforms
  canonical `SHAPE_VERTICES` under LLM-chosen cosmetic knobs, so `targetShape`/instruction/`tracePath`
  agree by construction and a wrong vertex count is structurally impossible across trace/connect_dots/
  complete. Code lives in `service/math/gemini-shape-tracer.ts`; EVAL_TRACKER row = 4/4 modes
  runtime-verified. Report: `qa/eval-reports/shape-tracer-2026-07-14.md`.
- **10 (scope/routing). word-workout + word-flip — CVC scope binding + routing, FIXED + VERIFIED**
  (2026-07-14, Handoff Task 3). Report: `qa/topic-fidelity/word-workout-word-flip-2026-07-14.md`.
  word-workout was FIDELITY BUG (masteredVowels defaulted to all five → chains left the
  topic vowel): added `resolveScopedVowels` (topic/objective → target short vowel),
  `buildScopePromptSection` + hard vowel rule, and a deterministic `sanitizeVowelScope`
  post-parse filter with per-vowel scoped fallbacks. Verified: short-a 3/3 draws = 15/15
  on-vowel chains, masteredVowels=['a']; non-scoped grade-1 topic stays multi-vowel.
  word-flip was WRONG PRIMITIVE (grammar mis-routed to decoding) → catalog routing lead
  ("GRAMMAR … NOT phonics/decoding"); verified 3/3 CVC-decode manifest runs no longer
  select it. typecheck:lumina 0; vitest 726/726. **PRE audit for both still open** (item 10).
- **1g. phoneme-explorer — ending-sound fidelity, FIXED + VERIFIED (routing)** (2026-07-14,
  Handoff Task 2). Report: `qa/topic-fidelity/phoneme-explorer-2026-07-14.md`. Was a
  three-layer over-claim: catalog advertised "match initial/final sound", generator teased
  "or ends with" + grade-1/2 "final/medial", but the component hardcodes "starts with" and
  cannot render ending/medial tasks. Verdict WRONG PRIMITIVE for rhyme (rhyme-studio /
  poetry-lab already serve it) → routing fix: catalog + generator now say INITIAL/beginning
  sounds ONLY. **Verified:** regression 15/15 isolate draws honor the beginning sound;
  manifest 3/3 runs no longer select phoneme-explorer for the rhyme objective (routes to
  rhyme-studio + poetry-lab). typecheck:lumina 0 errors. Follow-up filed: a real
  final-phoneme isolation capability (position field + component copy + oracle) is a
  primitive-expansion slice, not done here. PRE audit still open (emoji choices present).
- **1d. knowledge-check @ PRE — K CENSUS TOP FINDING, all 5 slices RESOLVED, READY**
  (2026-07-14, `--fix`). Report: `knowledge-check-PRE-2026-07-14.md`. Was
  PRIMITIVE-GAP + SCAFFOLD-GAP: every K census draw was a text-primary MCQ
  (rhyme/shapes text options — wrong modality + answer-leak; questions referencing
  visuals the generator never produced; options never read aloud), two-tap Verify,
  adult "terminal" chrome. knowledge-check is a CONTAINER over per-type problem
  primitives; every K draw resolved to multiple_choice/true_false (the real K
  route). Fix, one loop, 5 layers:
  - **CATALOG:** PRE-READER READ-ALOUD `aiDirective` (`[QUIZ_READ_ALOUD]` reads the
    question + EVERY choice aloud, overrides one-sentence cap, answer-free;
    `[QUIZ_RETRY]` eyes-free hint); scaffoldingLevels enact the question (say it)
    not narrate; struggles eyes-free. tutor-test `--probe` warn→**pass, 0 findings**.
  - **GENERATOR:** emoji-required **picture-primary** MCQ at K (`emoji` on each
    option, required), `PRE_READER_MC_PALETTE` (≤12w question, NO phantom-visual
    reference, no answer-leak, picturable options), **K type-floor** to
    multiple_choice/true_false (matching/categorization/sequencing/fill_in_blanks =
    WRONG-BAND at PRE, coerced out; orchestrated + direct paths). `MultipleChoiceOption.emoji?`.
  - **COMPONENT:** `MultipleChoiceProblem` PRE render — emoji grid, **tap=choose**
    (no Verify), auto-read on first view (IntersectionObserver) + **🔊 replay**,
    feedback on the tapped object; `KnowledgeCheck` threads `preReader`+`onAskTutor`
    (non-silent sendText) and hides terminal header/counter/badges/AI-Helper/
    Scratch-Pad at K. jsdom `MultipleChoiceProblem.reader-fit.test.tsx` **6/6**;
    suite **787/787**; tsc + typecheck:lumina clean.
  - **QA ORACLE:** `option-modality` (emoji on every MCQ option at PRE) +
    `reader-fit` WRONG-BAND (non-MCQ/TF type at PRE) checks; oracle tests **211/211**.
  - **LIVE `--lesson` 3/3 PASS** (0 findings): bespoke `build_knowledge_check_journey`
    added to the harness; the tutor read "Which one is a circle? A… Square. B…
    Circle. C… Triangle." in the lesson greeting/`[PRIMITIVE SWITCH]` path all 3
    runs — the read-aloud survives the one-sentence cap. Report:
    `qa/tutor-reports/knowledge-check-live-lesson-2026-07-14.md`.
  - **Residuals (queued):** true_false @ PRE needs the same PRE read-aloud/chrome
    treatment (container already forwards the props; component has no PRE branch);
    MCQ retry glyph + suppress the text rationale card at K (polish, tutor speaks
    it); spot-check more count-type MCQ draws; pixel browser glance; EMERGING
    (grade 1) complex-type routing re-audit once the K queue drains.
- **1c. poetry-lab — ALL slices RESOLVED** (2026-07-14, via /eval-fix + follow-on
  sessions; EVAL_TRACKER rows RF-1..RF-4 + PL-1..PL-4 all struck). Generator =
  per-mode dispatcher (RF-1); component phase-skipping (RF-2); catalog phantom-TTS
  + K claims stripped (RF-3); **rhyme_hunt K mode + tutoring scaffold SHIPPED**
  (RF-4: catalog ORIENT/STIMULUS/DISAMBIGUATE/RECOVER directives, component reads
  every round via Gemini Live, tutor-test + probe 0 findings, K lesson journey 2/2
  clean); three-mode ContentOracle registered (PL-4, 0/9 flaky). **Census
  confirmation 2026-07-14:** the K rhyme topic-trace routed poetry-lab in
  rhyme_hunt mode and the draw met the spec (4 rounds, one rhyme pair, emoji
  candidates) — K demand is being served in the wild. Residual: candidate emoji
  quality (mat→🧘) is content-polish, oracle guards structure.
- **6. letter-sound-link @ PRE — audit + `--fix`, READY (live-confirmed 3/3)** (2026-07-14). Report:
  `letter-sound-link-PRE-2026-07-14.md`. Was PRIMITIVE-GAP + SCAFFOLD-GAP — a strong
  audio-discrimination core whose two-tap **audition-then-commit** protocol (a legitimate rule-2
  multi-part confirm) and production invite were gated behind **10px text, never spoken**. Fixed
  by band-gating the COMMUNICATION, not deleting the mechanic. All 4 layers, one loop:
  - **GENERATOR:** `resolvePreReaderGradeKey(ctx)` stamps `gradeLevel` into the data (K→'K',
    grade1→'1', no over-gating). New `LetterSoundLinkData.gradeLevel?` field.
  - **SCAFFOLD (catalog):** two `aiDirectives` — **HOW TO PLAY** (voice the protocol per mode,
    answer-free, overrides the lesson one-sentence cap = durable ORIENT carrier) + **THEIR TURN
    TO SAY IT** (spoken production invite). tutor-test `--probe` pass, 0 findings, keys resolved.
  - **COMPONENT (K band-gate):** 10px "tap to hear/choose" → wordless **ear→check** glyphs;
    footer/task/shared-sound sentences hidden; keyword hint = emoji only; chrome hidden
    (Group/mode badges, counter); real grade → `useLuminaAI` (was hardcoded 'K'). Two-tap KEPT.
    `LetterSoundLink.reader-fit.test.tsx` 4/4; full suite **781/781**; tsc/typecheck:lumina clean.
  - **Live `--lesson` 3/3 PASS** (0 findings; report `qa/tutor-reports/letter-sound-link-live-lesson-2026-07-14.md`):
    the HOW-TO-PLAY protocol is voiced in the greeting AND `[ACTIVITY_START]` ("Tap a bubble to hear
    it… tap it again to keep it!"), keyword said, "Now YOU say sun!" fires on correct, protocol
    re-enacted on advance — durable carrier survives the one-sentence cap. Bespoke
    `build_letter_sound_link_journey` added to `run_tutor_live.py` `JOURNEYS`. Enabled by launching
    the backend `--reload-dir app` (writes under `tests/` no longer restart it).
  - Follow-up: human browser glance at the ear→check glyphs (pixel-only). Audit-C chrome for
    K-stage: **PhaseSummaryPanel % ledger + progress bar**.
- **deep-dive @ PRE — audit + `--fix`, READY pending live** (2026-07-14, user-observed
  K goats lesson: text-only Quick Quiz + unreadable "Read this section" button).
  Report: `deep-dive-PRE-2026-07-14.md`. Was PRIMITIVE-GAP + SCAFFOLD-GAP.
  - CATALOG: PRE-READER READ-ALOUD aiDirective ([QUIZ_READ_ALOUD]/[BLOCK_READ_ALOUD]
    word-for-word, overrides lesson one-sentence cap; [FACT_EXPLORE] reads card text
    first at PRE; [QUIZ_RETRY] answer-free hint). Probe: renders, 0 findings.
  - COMPONENT: `isPreReaderGrade` band-gate — quiz auto-reads itself on first view
    (IntersectionObserver once) + 🔊 replay, picture-primary options (optionEmojis),
    tap=choose, spoken retry hint + spoken explanation, chrome hidden (counts,
    attempts, protocol text). Prose → one big "🔊 Read to me". 7/7 jsdom tests
    (`MultipleChoiceBlock.test.tsx`). **TU-5 closed en route** (12 onAskTutor
    forwards made silent).
  - GENERATOR: PRE palette (prompt + code-owned gate strips fill-in-blank/data-table/
    timeline/compare-contrast/perspectives/hypothesis-lab at K); MC emoji options
    required at K (all-or-nothing ship), ≤12w question / 1-4w options; key-facts one
    short sentence; prose exactly 2 short spoken-style paragraphs. Verified across
    3 K draws + 1 G4 regression draw (G4 unchanged, no emojis).
  - Follow-ups: live `--lesson` 3-run confirmation (needs bespoke deep-dive journey),
    browser glance, mini-sim prediction + diagram-label text at PRE if K draws start
    including them.
- **4b. word-sorter @ PRE — `--fix` complete, READY** (2026-07-14). Report (loop log):
  `word-sorter-PRE-2026-07-14.md`. All 4 slices shipped + verified:
  - CATALOG: aiDirectives ORIENT+STIMULUS beats; scaffold reworded eyes-free —
    tutor-test fail→**pass (0 findings)**; closes RF-1/RF-2 **and TU-3**.
  - COMPONENT: K staged-word presentation (tap-bucket=choose, `[WORD_STAGED]`/
    `[WORD_TAP]` spoken, bucket-flash feedback, chrome hidden) — 6/6 jsdom
    behavioral tests (`WordSorter.test.tsx`) + user browser check (RF-3).
  - GENERATOR: emojis required at K + bucketEmoji field — 15/15 fresh challenges
    full coverage (RF-4). ROUTING: match_pairs floored Grade 1+ (RF-5).
  - **Live `--lesson` 3/3 PASS** (zero confirmed findings; bespoke journey added to
    the harness): `qa/tutor-reports/word-sorter-live-lesson-2026-07-14.md`.
  - Residuals → K-stage systemic item: PhaseSummaryPanel ledger, "Next Challenge"
    text button. G1/EMERGING follow-up: match_pairs words not spoken on tap.
- **3. decodable-reader @ PRE/EMERGING — audit + `--fix`, READY** (2026-07-14).
  Report: `decodable-reader-PRE-2026-07-14.md`. Was WRONG-BAND at PRE (connected-text
  decoding is not a K skill) + PRIMITIVE-GAP + SCAFFOLD-GAP at EMERGING. Per user call:
  built a NEW in-primitive read-along mode rather than band-floor + external rebuild.
  - **PRE served by a new `read_along` eval mode** (Tier 0, β 0.5, K floor): the tutor
    reads the whole passage aloud (component `[READ_ALONG_START]` + catalog directive
    that overrides the lesson one-sentence cap), child answers a **picture** question.
    Generator forces K + a tiny 2-3 sentence passage + picturable question; stamps
    `readingMode` (renamed from `mode` — collided with eval-test's challenge-type
    field auto-detection, flipping status to fail).
  - **SCAFFOLD-GAP FIXED:** the comprehension question + every answer choice are now
    READ ALOUD (new catalog `aiDirectives` + `comprehensionChoices` forwarded into the
    bag; passage stays student-decoded in decode mode, by design). ORIENT beat on open.
  - **PRIMITIVE-GAP FIXED (K-1 band-gate):** single tap=choose **picture** options
    (generator requires a distinct `emoji` per option), no typing, no phoneme notation,
    chrome hidden (stepper/legend/counter/score-ledger/badges), larger warm passage,
    auto-finish review. Gr2+ decode UI unchanged.
  - **Generator reliability (user Q on orchestration):** kept the single call — schema
    is complex but essential (per-word tagging IS the interaction surface); hardened
    with `maxOutputTokens` + 2-attempt retry + short-passage prompt caps. NO orchestrator.
    `maxItems` bounds rejected by this @google/genai version (400) → caps live in prompt.
  - Verified: tsc clean; eval-test all modes `pass` (read_along→K tiny passage picturable
    options; literal/main_idea unaffected; distinct emoji 3/3 draws); tutor-test `--probe`
    pass 0 findings, all keys resolve from component; **live `--lesson` read_along 3/3
    clean** — passage + question + every choice read aloud, eyes-free ORIENT. Harness
    gained `build_decodable_reader_journey` (registered). Report:
    `qa/tutor-reports/decodable-reader-live-lesson-2026-07-14.md`.
  - Follow-ups: tap=choose click behavior wants a human browser glance (render+data
    verified, click not exercised headlessly); ~~manifest routing K→read_along relies on
    the catalog `constraints` band-floor note — verify the resolver prefers it at K~~
    **VERIFIED 2026-07-14** via the K CVC topic-trace census: the manifest intent
    explicitly instructed read_along for K and the draw generated a K read-along
    passage with emoji comprehension options (`qa/topic-traces/k-cvc-short-a-2026-07-14.md`).
- **5. cvc-speller @ PRE — audit + `--fix`, READY** (2026-07-14). Report:
  `cvc-speller-PRE-2026-07-14.md`. All slices shipped same day: catalog
  SAY-THE-WORD `aiDirectives` beat (live `--lesson` 3/3: word said at the
  greeting/switch); struggle #3 + production invite eyes-free; bank tier-capped
  (union bug had defeated the distractor lever), Clear removed, one tap-ladder
  audio button, emoji-only cue → 11 elements; `short-a` slug + IPA leaks closed
  (generator title sanitizer caught a live IPA title immediately). **Bonus
  CRITICAL found by the new jsdom test (RF-6): evaluation was NEVER submitted**
  (session-end gates on `allChallengesComplete` made Finish unreachable) — fixed,
  regression-tested; sweep other `useChallengeProgress` consumers.
  `CvcSpeller.reader-fit.test.tsx` 4/4; suite 760/760. Live note (pre-existing,
  1/3): tutor spoke "[PRIMITIVE SWITCH]" aloud — harness TAG_SYNTAX_RE patched to
  catch spaced tags; root cause = lesson switch prompt (backend follow-up).
  - Audit-C chrome evidence (for K-stage): title, vowel/task badges, "1/N"
    counter, progress dots, begin/middle/end micro-labels, PhaseSummaryPanel
    percentage ledger remain in the child's field.
- **1b. addition-subtraction-scene @ PRE — typing + create_story** (2026-07-14,
  `--fix`). Report: `addition-subtraction-scene-PRE-1b-2026-07-14.md`.
  - **PRIMITIVE-GAP (rule 6/2) FIXED:** act-out + solve-story at K now answer via a
    tappable `NumberTileRow` (0…maxNumber, tap=choose, no keyboard, no Check). Grade 1
    keeps input.
  - **create_story REBUILT K-capable** (per user call: extend the primitive, don't
    ban the mode). At K it's a construction-judged "build the story" production task —
    add objects up to resultCount (addition) / remove down to it (subtraction),
    auto-judges, tutor reads the equation aloud (new `orientLineForChallenge`). The
    first-pass generator band-floor was **reverted** (generator `git diff` clean).
    Catalog create_story description updated ("build the scene… pre-reader capable").
    Grade-1 picker→builder is a queued follow-up (hollow there too).
  - Verified: tsc + typecheck:lumina 0-err; eval-test @ K (tile-answer-complete +
    build-ready data); tutor-test `--probe` pass 0 findings; **first Lumina component
    behavioral test** (`AdditionSubtractionScene.reader-fit.test.tsx`, jsdom) 3/3 —
    number-tile tap, add-build, remove-build all auto-complete. Full suite 745/745.
    Pixel-level visual still wants a human browser glance.
  - Infra: vitest.config gained `@vitejs/plugin-react` (declared devDep), `@` alias,
    and `.test.tsx` include so component behavioral tests run under `npm test`.
  - Chrome findings (mode tabs, counter, badges, ten-frame toggle) unchanged → K-stage
    systemic item.
- **2. comparison-builder @ PRE — scaffold P1–P3 + component P1** (2026-07-14, `--fix`).
  Report: `comparison-builder-PRE-2026-07-14.md`. Was PRIMITIVE-GAP + SCAFFOLD-GAP.
  - **Scaffold (catalog `math.ts`) — READY (probe-verified):** added the ORIENT+
    DISAMBIGUATE `aiDirectives` beat (read the question aloud + NAME the specific
    comparison per challenge type; overrides the lesson one-sentence cap; answer-free);
    rewrote `level3` answer-free (killed the `{{correctAnswer}}` spoken leak, TU-family);
    flattened `taskDescription`+`level2` (removed all `{{#if}}` handlebars). tutor-test
    `--probe` now `pass`, 0 findings, no literal handlebars.
  - **Component (`ComparisonBuilder.tsx`) P1 — READY (behaviorally verified):** at
    `gradeBand==='K'` the two group PICTURES + a middle `=` are the tappable answer
    surface (tap=choose, picture-primary) — no "More/Fewer/The Same" text buttons, no
    Check button. `checkCompareGroups(answerArg)` refactor evaluates the tapped side
    without a state-flush race. `ComparisonBuilder.reader-fit.test.tsx` 5/5 (jsdom);
    full suite 750/750; tsc + typecheck:lumina clean.
  - **Tutor beat live-confirmed:** Tier-3 `run_tutor_live.py --lesson --runs 3` (new
    bespoke `comparison-builder` journey + `--eval-mode` passthrough) → **3/3 PASS**,
    0 findings; the tutor reads the question + names the choice at every challenge
    start and in the lesson greeting (survives the one-sentence cap). Report
    `qa/tutor-reports/comparison-builder-live-lesson-2026-07-14.md`.
  - Remaining → item **2b**: component P2 chrome band-gate, rule-5 feedback-on-object,
    the other three eval modes. Pixel glance of the SVG still wants a human browser look.
- **4. word-sorter @ PRE — audit** (2026-07-14, no `--fix`). Report:
  `word-sorter-PRE-2026-07-14.md`. Overall **PRIMITIVE-GAP**; all 3 modes fail
  ORIENT/STIMULUS/DISAMBIGUATE/RECOVER; Audit C 6/8 FAIL (two-tap, text-primary,
  8-13 elements, "N wrong" badge, chrome). match_pairs @ PRE = WRONG-BAND (text
  rhyme-matching). Scaffold confirmed broken via probe: `{{currentWord}}`/
  `{{correctCategory}}` → `(not set)`, `[word]` literal, hardcoded noun/verb hints
  wrong for non-grammar sorts. Fix slices queued as item 4b.
  - Audit-C chrome evidence (for K-stage): "1 / 3" counter badge, "N wrong" amber
    badge, challenge-type badge, description paragraph, WORDS/MATCHES column
    headers, PhaseSummaryPanel score ledger — all in the child's field.
- **1. addition-subtraction-scene @ PRE — STIMULUS + ORIENT** (2026-07-13,
  `--fix`). Report: `addition-subtraction-scene-PRE-2026-07-13.md`. Made read-aloud
  a mandatory catalog `aiDirectives` beat (overrides the lesson one-sentence cap);
  fixed `{{instruction}}`→`(not set)` by forwarding `instruction` into the
  component bag. Verified: tutor-test `pass` (0 findings); lesson-mode live 3/3 read
  the full story verbatim. Chrome/typing follow-ups → item 1b. Harness gained a
  bespoke journey + `--lesson` flag + `stimulus-not-read` oracle.
  - Audit-C chrome evidence (for K-stage): `LuminaModeTabs`, `LuminaChallengeCounter`,
    "Kindergarten"/operation `LuminaBadge`, ten-frame toggle all sit in the child's
    field — per-primitive internal chrome the stage MVP does not yet remove.
