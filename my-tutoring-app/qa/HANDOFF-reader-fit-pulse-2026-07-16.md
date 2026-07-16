# Handoff — Reader-fit findings from the Pulse walk (2026-07-16)

Three ready-to-paste prompts for the K-math + reading findings the user observed
in a live Pulse session on 2026-07-16. Source queue entries:
`qa/reader-fit/BACKLOG.md` items **2b**, **11**, and **9a** (+ two systemic items).
Owning stream: reader-fit K queue (ACTIVE, single-stream after SP-27 parked).

**Shared house rules (apply to all three):**
- **Verification doctrine (CLAUDE.md):** a change is done only after the flow is
  *exercised at runtime* — `/eval-test`, a live `--lesson` run, or a driven probe.
  tsc is necessary, not sufficient. Typecheck with the project-local binary:
  `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` (0 NEW vs baseline).
- **Contract-first (CLAUDE.md):** before editing an existing primitive's component or
  generator, read `docs/contracts/<primitive-id>.md` if it exists; derive/refresh via
  `/primitive-contract`. If a new demand contradicts a live requirement, **fork** — do
  not edit in place over a conflict.
- **Pedagogy rule #1:** never leak the answer via labels, default values, or chrome.
- Update the BACKLOG item + `WORKSTREAMS.md` "last touched" in the SAME slice you close.

---

## 1. comparison-builder #2b — kill the K count-leak + fix the "one less" scaffold + add "🔊 Read me"

**Paste this:**

> Work reader-fit BACKLOG item **2b** (comparison-builder @ PRE), browser-confirmed open
> in the 2026-07-16 Pulse walk. Three fixes, one loop, in priority order:
>
> 1. **PEDAGOGY-CRITICAL — component P2 chrome band-gate.** At `gradeBand==='K'` the screen
>    still shows the **"Left: 3   vs   Right: 5" count badges** (this literally hands the child
>    the answer — a rule-#1 violation), plus the "Challenge 1 of 5" counter and all four mode
>    tabs. Hide at K: the "Left: N / Right: N" count badges, the "1/N" counter,
>    "Kindergarten"/type badges, and the mode tabs. Keep the tappable group pictures + middle
>    symbol (that's the answer surface). Coordinate with the K-stage systemic chrome item.
> 2. **one_more_less scaffold asymmetry.** The tutor voices the beat after the child does
>    "one MORE" but is SILENT on "one LESS" at K. Find where the ORIENT/DISAMBIGUATE beat (catalog
>    `aiDirectives` in `service/.../math.ts`) or the component `[…]` trigger fires and add the
>    decrement case so "one less" is voiced identically. Verify with `/tutor-test --probe`.
> 3. **On-demand "🔊 Read me" replay (pilots a systemic pattern).** Add a persistent
>    LuminaReadAloud button in the prompt/feedback area that repeats the current
>    instruction/question, in the SAME position across compare_groups / compare_numbers / order /
>    one_more_less. Build it so it can generalize (see the systemic item in BACKLOG) — a small
>    shared helper is preferred over a per-mode one-off.
>
> Contract-first: read/derive `docs/contracts/comparison-builder.md` first (item 1b's tap=choose
> and the compare_groups picture-answer surface are live requirements — band-gate, don't remove).
> Verify: `./node_modules/.bin/tsc --noEmit` 0-new + `typecheck:lumina` 0; jsdom band tests
> (chrome hidden at K, present at grade-1 control; count badges absent at K); `/tutor-test --probe`
> 0 findings incl. the one_less beat; live `--lesson --runs 3` on the one_more_less mode. Residual
> pixel look → HUMAN-CHECKS. Close the BACKLOG 2b item + WORKSTREAMS in the same slice.

---

## 2. addition-subtraction-scene item 11 — make `act_out` truly hands-on (direct-manipulation)

**Paste this:**

> Work reader-fit BACKLOG item **11** (addition-subtraction-scene @ K, direct-manipulation gap),
> observed in the 2026-07-16 Pulse walk. In subtraction `act_out` the story reads "…2 frogs hop
> away — **Drag them out of the scene**" but the child CANNOT drag the frogs; the only interaction
> is a NumberTileRow ("How many frogs are there now? 0-5"). User ruling: **K learns by doing** —
> the removal/addition must BE the interaction, with the count *derived from the enacted scene*,
> not entered as a proxy number.
>
> **This forks from item 1b, it does NOT undo it.** 1b correctly replaced *typing* with tap-a-number
> (no keyboard at K), and number tiles STAY for `solve_story`. Only `act_out` (and `create_story`,
> which already builds a scene) become true direct manipulation: drag/tap objects OUT for
> subtraction, add objects up to the count for addition; auto-judge on the resulting scene count.
>
> Expect a **schema change**: `act_out` likely carries only a target number today — check
> `AdditionSubtractionSceneData` + the generator and give the component a manipulable scene-object
> model (removable/addable objects). Keep it flash-lite-safe (bounded arrays). Reconcile the
> instruction copy with the interaction (no "drag" text when the mode can't drag, and vice-versa).
>
> Contract-first: read/derive `docs/contracts/addition-subtraction-scene.md` first — 1b's
> tap=choose is a live requirement; fork the interaction BY BAND/MODE, don't edit over it.
> Direction is already set by the direct-manipulation-first ruling — no design question to ask.
> Verify: tsc 0-new + `typecheck:lumina` 0; jsdom behavioral tests (drag/remove for subtraction,
> add-build for addition, auto-complete on the right scene count); `/eval-test` @ K; live
> `--lesson` (a bespoke journey already exists). Residual pixel/feel → HUMAN-CHECKS. Also record
> any sibling K scene primitives with the same read-then-tap-a-number proxy under the BACKLOG
> "direct-manipulation-first" systemic item (don't fix them here). Close item 11 + WORKSTREAMS
> in the same slice.

---

## 3. media-player #9a — REIMAGINE as a multi-band reading primitive (not a band-gate)

**Paste this:**

> Work reader-fit BACKLOG item **9a**, reframed by the user on 2026-07-16 from a PRE band-gate
> into a **reimagining**. media-player is an early, ambitious primitive whose segment +
> per-segment-MCQ design now comes up short as a *reading* surface next to deep-dive and
> interactive-passage. Do NOT just band-gate the old MCQ — re-imagine it. Work in strict order:
>
> **Step 1 — contract FIRST (nothing is edited before this exists).** Run
> `/primitive-contract media-player` (add `--census` if the catalog projection helps). Capture:
> (a) what media-player must keep true and for WHICH consumers — existing curriculum homes, skills,
> and eval modes that route to it today, so the reimagining doesn't ablate live dependencies; and
> (b) the current interaction/data contract (segments, `knowledgeCheck.options`/`correctOptionIndex`,
> `[READ_ALOUD]`/`[READ_KNOWLEDGE_CHECK]` narration, generator grade handling). Write
> `docs/contracts/media-player.md`.
>
> **Step 2 — modality map.** Define the reading modalities media-player should serve at K (PRE),
> EMERGING (grade 1), and ESTABLISHED (grade 2+) — e.g. PRE = read-aloud + picture-primary
> comprehension check; EMERGING = read-along + light decoding + tap comprehension; ESTABLISHED =
> richer interactive segments (annotate/predict/evidence) in the deep-dive spirit. Borrow proven
> capabilities from deep-dive + interactive-passage (their PRE read-aloud palette, picture-primary
> MCQ, block model) rather than re-inventing. Confirm real homes with `/curriculum-fit`.
>
> **Step 3 — build band by band, fork on conflict.** Treat like the reimaginings family
> (hydraulics/dump-truck/excavator template, reading-focused). New/rebuilt modes via `/primitive`
> layers + `/add-eval-modes`; if any new capability contradicts a Step-1 requirement, FORK
> (eval-mode split → band gate → config axis → variant) — never edit in place over it. Close each
> band with `/eval-test` + `/reader-fit`, PRE first (the observed K demand). Reuse `PreReaderSelfCheck`
> for whatever ends up as a PRE picture-MCQ. Reconcile the wrong "grades 3+" catalog `constraints`
> (census routes it at K) and move the generator off `inferGradeLevel(ctx.gradeContext)` → `ctx.grade`
> + stamp `gradeLevel`.
>
> **Scope flag:** this is heavier than #9b–#9d. After Step 1 shows the blast radius, propose to the
> user whether to promote it to its own short workstream. Verification doctrine applies at every band
> (runtime-exercise, not tsc-only). Close item 9a + WORKSTREAMS in the same slice.

---

### Sequencing recommendation
1 (comparison-builder #2b — pedagogy-critical, smallest) → 2 (item 11 direct-manipulation — deeper,
schema) → 3 (media-player reimagining — heaviest, contract-first, may spin off its own stream).
#9b–#9d and #2b's remaining eval modes follow behind.
