# HANDOFF — reader-fit supply-side sweep, after 15B closed 8/8

> ## ⛔ CORRECTED 2026-08-07 (later, after S2 closed) — READ THIS BEFORE THE REST
>
> **1. The 15A BAND-FLOOR theory below is OVERTURNED by user ruling.** Do not
> write a band floor. The ruling:
> *"i dont like band floor method, like if lumina routes to a certain primitive,
> its okay to use it and we should make it age friendly?"*
> A floor removes a K failure by removing the primitive, shrinking supply at the
> band with the least content. **The fix is a component pass that makes the
> primitive work at that band** — band-gate the chrome, collapse continuous or
> numeric controls to picture-primary `tap = choose`, add the scaffold and
> read-aloud. WRONG-BAND is now a **last resort**, legitimate only when the core
> act cannot exist at the band at all AND another primitive already covers the
> objective — and even then, design the band-fit interaction first and say what
> it would be. → [[feedback_make-age-friendly-not-band-floor]].
> Corroborated live: a K `topic-trace` **did select** `orbit-mechanics-lab`.
> **`telescope-simulator` (S1, `96c3eb6`) shipped a floor under the old theory —
> revisit candidate, NOT a precedent to copy.**
>
> **2. S2 `orbit-mechanics-lab` is CLOSED** (`1ad319f`, report
> `qa/reader-fit/orbit-mechanics-lab-PRE-2026-08-07.md`). **Next = S3
> `rocket-builder`.**
>
> **3. PROBE THE NEIGHBOURING GRADE, NOT JUST K.** S2's generator was *clean at K
> on the happy path* and returned **Grade 3 content for a Grade 1 ask**. A K-only
> probe would have passed it. Probe K **and** G1.
>
> **4. A correct grade resolver is not the whole grade fix.** S2 carried THREE
> distinct grade bugs: prose `ctx.gradeContext`; `gradeLevel >= '3'` being **TRUE
> for `'K'`** (lexical compare — survives a correct resolver, and a grep for the
> resolver misses it); and the resolved rung **never being stamped onto the
> output**, which would have left every new band gate dead on arrival. Check all
> three per slice.
>
> **5. Check for declared-but-unread flags.** S2's `showOrbitPath` was declared,
> generated at every grade, and read by NOBODY — and it was the catalog's entire K
> rung. `grep` the component for each display flag the generator sets.
>
> **6. Anchors below are re-derived AGAIN (S2 added a tutoring block to
> `catalog/astronomy.ts`).** Current: `rocket-builder:305` (unchanged),
> `orbit-mechanics-lab:311`, **`mission-planner:391`** (was 317),
> **`telescope-simulator:397`** (was 323), `light-shadow-lab:403`,
> `constellation-builder:457`, `planetary-explorer:511`.
>
> **7. The "catalog-only, no component work" estimate for 15A is DEAD.** S2 needed
> a generator fix, a catalog block AND a full component pass. Budget every
> remaining 15A slice like a 15B slice.
>
> Queue of record — authority over this file — is `qa/reader-fit/BACKLOG.md`
> item 15A, which carries the full corrected story.

Written 2026-08-07. Supersedes `qa/HANDOFF-reader-fit-supply-sweep-2026-08-06.md`
for everything except its origin story (the enumeration and the two-channel test
— still accurate, still worth reading once).
**Its line-exact anchors are now STALE** — 15B added large `tutoring` blocks to
`catalog/astronomy.ts` and `catalog/biology.ts`, shifting every id below them.
The anchors in *this* file were re-derived 2026-08-07.

Owning queue: `qa/reader-fit/BACKLOG.md` item **15**.
Reports carry `-2026-08-06` filenames (the sweep's start date) even though the
later slices landed on 08-07; don't read the dates as separate sittings.

---

## Paste-able prompt

> Continue the reader-fit supply-side sweep. **15B is CLOSED 8/8** — read
> `qa/HANDOFF-reader-fit-2026-08-07.md` first, then pick up at **15A, item S2
> `orbit-mechanics-lab`**. The 15A theory is that a catalog BAND FLOOR is the
> whole fix and no component work is needed. **15B disproved that theory eight
> times out of eight for its own class, so verify it per primitive rather than
> assuming it:** run the probe at `grade=K` and an Audit C before deciding the
> slice is catalog-only. The S1 precedent
> (`qa/reader-fit/telescope-simulator-PRE-2026-08-06.md`) is the fix template for
> a genuine floor; `qa/reader-fit/moon-phases-lab-PRE-2026-08-06.md` is the
> template for a slice that turns out to need a component pass.

---

## Status

**15B — SCAFFOLD-GAP: COMPLETE, 8/8, all READY at PRE.**

| Slice | Primitive | Commit |
|---|---|---|
| S8 | moon-phases-lab | `fde46ed` |
| S9 | classification-sorter | `e7c0d63` |
| S10 | day-night-seasons | `4bdd3fa` |
| S11 | solar-system-explorer | `6bc94f6` |
| S12 | scale-comparator | `855987c` |
| S13 | life-cycle-sequencer | `20ac5ac` |
| S14 | habitat-diorama | `4b9a8c9` |
| S15 | organism-card | `ff31a95` |

**15A — WRONG-BAND: S1 closed (`96c3eb6`), S2–S7 open.** This is the next pull.

Cumulative: vitest **1801 → 1978**, src-scoped tsc **803 vs the 804 baseline**,
`typecheck:lumina` 0 throughout, tutor-test Tier 1 `pass` on all eight.

---

## What is already true — do not re-derive

**The enumeration.** 196 catalog entries · 118 K-selectable · 90 never audited
(as of 08-06). It cost a vitest harness against `UNIVERSAL_CATALOG`; the numbers
are in `qa/reader-fit/supply-sweep-triage-2026-08-06.md`. Don't re-run it.

**The two-channel test.** A primitive reaches a non-reader only via (a) a catalog
`tutoring` block or (b) `useLuminaAI`/`sendText(` in the component. Either
suffices — `story-talk` has no catalog block and is still the PRE reference model.
Score both channels or you get false positives.

**11 of the 26 mute primitives are OWNED** by
`qa/engineering-tutoring-scaffold/BACKLOG.md` Phase A. Confirm, never re-file.

**The 8 primitives of 15B now have a voice, a band gate and a correct grade rung.**
Do not re-audit them; they have reports.

---

## ⚠️ Read this before planning any remaining slice

**The 15B triage label was wrong 8 times out of 8.** *"Interaction is genuinely
K-fit, only the voice is missing"* was true of the **core mechanic** every time
and false about the **screen** every time:

| | also found, unqueued |
|---|---|
| S9 | drag-and-drop was the only placement path |
| S10 | a free-text answer box at Kindergarten, scored by any non-empty string |
| S11 | six classes of adult chrome around the tap |
| S12 | km figures, a log-scale checkbox, a "3.7× larger" ratio panel |
| S13 | two-act ordering; `imagePrompt` printed as body text |
| S14 | five correct band gates that had never once run |
| S15 | five facts with no way to hear any of them |

**A triage read from catalog text cannot see chrome, protocol, or a grade-blind
generator.** Only an Audit C and a probe at the band can. Budget every remaining
slice for a component pass and be pleasantly surprised, not the reverse.

**Every one of the 8 also sat on a grade-resolution defect** — the scaffold fix
alone would have shipped inert in all of them, because a new component band gate
keys off a field the generator could never populate. **Probe at `grade=K` FIRST,
every time.**

---

## 15A — the next queue, with anchors verified 2026-08-07

The 15A theory: these primitives cannot serve K by design, so the fix is a
catalog **BAND FLOOR** plus a generator backstop, with no component work. That
theory is sound for a genuine WRONG-BAND — S1 proved it — but **verify per
primitive.**

| # | Primitive | Catalog anchor | Generator | Predicted grade shape |
|---|---|---|---|---|
| **S2** | **`orbit-mechanics-lab`** | `catalog/astronomy.ts:311` | `astronomy/gemini-orbit-mechanics-lab.ts` | `= ctx.gradeContext` @ **:251** — astronomy regex shape |
| S3 | `rocket-builder` | `catalog/astronomy.ts:305` | `gemini-rocket-builder.ts` | `= ctx.gradeContext` @ **:181** |
| S4 | `story-planner` | `catalog/literacy.ts:1649` | `literacy/gemini-story-planner.ts` | **CLEAN — already canonical** (reads `ctx.grade` @ :117 with an explicit contract comment). Do not "fix" it. |
| S5 | `bio-compare-contrast` | `catalog/biology.ts:287` | `biology/gemini-compare-contrast.ts` | **Third shape:** `gradeBand` is a **function parameter defaulting to `'3-5'`** (:200) — check the CALL SITE, not the body |
| S6 | `species-profile` | `catalog/biology.ts:70` | `biology/gemini-species-profile.ts` | `= ctx.gradeContext` @ **:241** |
| S7 | `mission-planner` | `catalog/astronomy.ts:317` | `gemini-mission-planner.ts` | `= ctx.gradeContext` @ **:252** |

**S4 is the reason to probe rather than assume.** `story-planner` already does
the right thing and says so in a comment. A blanket "assume the defect" heuristic
would have produced a pointless diff on it. Predict from the code, **confirm by
probe**, fix only what the probe shows.

**Note on S5's shape.** `gemini-compare-contrast.ts` never reads `ctx` for its
band — it takes `gradeBand: 'K-2' | '3-5' | '6-8' = '3-5'` as a parameter. So the
defect (if any) lives in whoever calls it. That is a fourth variant of the same
family and a grep for the other three misses it entirely.

**Biology slices should import `service/biology/gradeBand.ts`**
(`resolveBiologyBand`) — four generators already do. Do not write a fifth copy.

---

## The proven per-slice recipe (15B template)

1. **Probe FIRST**, before reading much code:
   ```bash
   curl -s -m 280 "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>&gradeLevel=kindergarten&grade=K&topic=<worst-case topic>"
   ```
   Read `fullData`. Compare every field against the catalog's own K rung. This is
   what exposed the grade defect in 7 of 8 slices, and it takes 30 seconds.
   *(`evalMode` is required by the route even when the primitive declares none —
   any string works; validation is skipped with a note.)*

2. **Audit C against the 8 band-contract rules from the RENDERED state.** Grep
   the component for `input type="text"`, `<select`, `draggable`, `%`, `km`,
   `Grade Band`, counters, and any `imagePrompt` rendered as text. Five of eight
   slices had a rule-2/6/7 failure the triage never saw.

3. **Fix the generator's grade resolution** — canonical-first, prose kept as
   fallback, never deleted. Export the resolver so it is testable.

4. **Catalog `tutoring` block.** Include a `PRE-READER READ-ALOUD` directive with
   the *"this OVERRIDES any instruction to keep it to one sentence"* clause, so
   the beat survives the lesson `[PRIMITIVE SWITCH]` cap. Name the specific things
   the tutor must NOT say for this primitive (measurements, ratios, Latin names,
   jargon, the answer) and **supply the replacement register**.

5. **Component:** `useLuminaAI` + a **flat-literal** `aiPrimitiveData` + moments +
   `LuminaReadAloud` on every load-bearing string + band-gate the chrome by
   conditional render.

6. **Two test files**: a resolver/catalog test and a `// @vitest-environment jsdom`
   render test. Copy `MoonPhasesLab.reader-fit.test.tsx` for the shape.

7. **Revert-bite both halves** — restore the pre-fix logic, watch tests fail,
   restore. Every 15B slice bit 4–12 tests. A test that does not bite is decoration.

8. Report → strike the BACKLOG row → update `WORKSTREAMS.md` → commit, **in the
   same slice**.

---

## Gates per slice (non-negotiable)

1. Focused test + **revert-bite proven**.
2. **`tsc` — gate on the `src/`-scoped error SET diff, NOT the count:**
   ```bash
   ./node_modules/.bin/tsc --noEmit 2>&1 | grep "error TS" | grep "^src/" | sort > now.txt
   comm -13 baseline.txt now.txt     # must be empty
   ```
   **The absolute count is unusable while the dev server runs** — `.next/types` is
   in the tsc program and churns (measured 805→806→807 on an unchanged tree). The
   `src/` baseline as of `ff31a95` is **803**.
3. `npm run typecheck:lumina` = 0. **Run it AFTER writing the last test file** —
   an S8 residual slipped through because it was run before the jsdom test existed.
4. Full `./node_modules/.bin/vitest run` — **1978/1978** as of `ff31a95`.
5. **Runtime A/B**: eval-test at K plus a **higher-grade control** proving the
   ladder was not flattened. For a genuine BAND FLOOR (15A), the decisive
   evidence is the **curator A/B** instead:
   ```bash
   curl -s -m 280 "http://localhost:3000/api/lumina/topic-trace?topic=<most adversarial topic>&gradeLevel=kindergarten&manifestOnly=true"
   ```
   Run it **pre-fix** (`git stash push -- <catalog file>`) to reproduce the
   selection, then post-fix. Component ids are at `response.objectives[].componentIds`.
6. `tutor-test?componentId=<id>` Tier 1 `pass`, then `&probe=1&gradeLevel=kindergarten`
   with zero literal `(not set)`.

**The dev server must be up** (`cd my-tutoring-app && npm run dev`). It died once
mid-sweep; symptom is `HTTP:000` from curl.

---

## Traps found in 15B — each cost real time

- **CSS `hidden` is not gone.** Tailwind `hidden` leaves text in the DOM and
  reachable by assistive tech. The jsdom test correctly failed it. Conditional-render.
- **A component containing band-gating code is not evidence that gating happens.**
  S14 had five correct gates that had never run.
- **An `as` cast at a module boundary propagates a contract violation into a
  second file where nothing looks wrong.** S12's `gradeLevel as 'K'|…|'5'` pushed
  prose into the component and killed its own pre-existing K branch.
- **Keep `aiPrimitiveData` a flat object literal.** Assembled behind local
  statements, `tutor-test` reports every contextKey as "dynamic — verify at
  runtime", turning a real check into a shrug.
- **Never set a flag inside a `setState` updater and read it after** — React runs
  functional updaters during render processing. (Firing a cue from inside one
  double-emits it; see `LuminaAIContext`'s cue dedup.)
- **`silent: true` still makes the tutor SPEAK.** It suppresses only the chat
  transcript entry (`LuminaAIContext.sendText:930-953`). Read-aloud beats must be
  silent; non-silent posts a machine prompt as if the child typed it.
- **`tutor-test`'s `directive-tag-never-emitted` caught a scaffold describing a
  primitive that did not exist, twice** (S10, S15). Trust it.

---

## Beyond item 15 — the rest of the frontier, ranked

**1. `planetary-explorer` + `constellation-builder` — audit these next after 15A.**
Both were flagged in the triage as *no read-aloud, no band gate*; both are
`= ctx.gradeContext` (`gemini-planetary-explorer.ts:630`,
`gemini-constellation-builder.ts:335`). **They are not in item 15 because they
each have a channel** — but S1's floor and 15B's fixes push K astronomy demand
squarely onto them. They are the most likely place for the next real K failure.

**2. The ~64 other unaudited K-selectable entries.** Deliberately unqueued
([[feedback_qa-is-a-gate-not-a-census]]) — they have at least one channel, so each
needs a real per-primitive audit. The ranked table is in the triage report. Pull
from it by demand, not alphabetically.

**3. The G2 / DEVELOPING band census.** Legitimate, never run, queued below item 15.

**4. Engineering Phase A's 11.** Owned by
`qa/engineering-tutoring-scaffold/BACKLOG.md`. **Carry one finding to them:**
their `readBlockAloud` pattern sends read-alouds **non-silent**, so machine
prompts land in the conversation as if the child typed them. It evades the static
check only because the tag is interpolated (`` `${tag} …` ``) rather than literal.
Filed, not fixed — different owner.

---

## Open residuals from 15B

- **No Tier-3 live audio run on any of the 8.** → `qa/HUMAN-CHECKS.md` **#73**,
  which covers moon-phases-lab, classification-sorter and day-night-seasons in
  one sitting. **One item in it is a genuine open question, not a formality:**
  day-night-seasons' day/night reading at a tapped location. It is derived from
  the same expressions that draw the terminator, so it cannot disagree with the
  *shape* — but nobody has confirmed the angle convention matches what a human
  reads as "day". **If inverted, the fix is one `!` in `isDaytimeAtMarker`.**
- **All 8 still have 0 eval modes** → `/add-eval-modes` (L1) is a separate layer.
  This was always out of 15B's scope.
- **S11, S12 and S15 have no evaluation hook at all** — pure instruments, so
  band-contract rule 8 is N/A rather than passing. **This needs a portfolio
  decision, not a slice:** either they get `/add-eval-modes`, or they are declared
  exploration-only so the manifest stops routing assessment demand at them.
- **Rule 3 is PARTIAL on the two biology sorters** (S9, S13): item cards are a
  word label plus a placeholder glyph. `imagePrompt` exists in the data but no
  image pipeline is wired. Wiring images for both together would be one slice.
- **`habitat-diorama` picks each organism's emoji by string-matching
  `imagePrompt`** (`includes('bird')` → 🦅, else falls through to 🐰). A scene
  whose prompts lack those substrings renders rabbits for everything. Content
  fidelity, not band — worth its own item if biology scenes get more use.
- **`telescope-simulator` (S1) still has no tutoring block and 0 eval modes** at
  the grades it *does* serve. A floor makes a primitive unreachable by
  non-readers; it does not give it a tutor.

---

## Scope fence — do not creep

- Don't re-run the census.
- Don't re-file engineering Phase A's 11.
- Don't add eval modes as part of a reader-fit slice; it is a different layer.
- Don't fix `planetary-explorer`/`constellation-builder` inside a 15A slice —
  audit them properly as their own items.
- Don't "fix" `story-planner`'s grade resolution. It is already correct.
