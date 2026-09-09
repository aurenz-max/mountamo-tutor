# Handoff — frontmatter descriptions for 29 skills

Tier 2 of the 2026-09-09 prompt audit (`2026-09-09-prompt-audit.md`, finding M12). One docs
slice, executor `/ship`. Owed WORKSTREAMS row: `/pm` adds it when the slice is pulled (the
file is over its 10,000-byte gate as of 09-09, so trim before adding).

## Outcome

Every `.claude/skills/*/SKILL.md` opens with a frontmatter block whose `description` says,
in three or four sentences, **what the skill does, when to use it, and when not to (naming
the neighbor skill instead)**. Today 29 of 32 skills have no `description`, so sessions
route on the H1 alone ("primitive: Add New Lumina Primitive"). This is trigger text: it may
carry calibrated urgency, never shouting, and it does not restate the body.

## Rules

- `name:` equals the directory name. Keep the existing H1 and body untouched below the block.
- Under ~80 words. No history, no dates, no incident IDs, no "now"/"no longer".
- The "not for" clause names the skill that owns the neighboring job. Neighbor map below.
- Do not describe the grader or the verification steps; say what the skill produces.
- Format model (already in the repo, `eval-fix/SKILL.md`):

```yaml
---
name: eval-fix
description: >-
  Diagnose and fix confirmed Lumina evaluation findings by tracing the failed
  learning contract to its cause, repairing the responsible layer, and verifying
  the failure family and affected runtime flow. Accepts primitive IDs, issue IDs,
  and reports from eval-test or assembled-lesson QA.
---
```

## Four drafted in the audit (use as written or tighten)

```yaml
# primitive
description: >-
  Birth a new Lumina primitive at L0 — component, types, catalog entry, Gemini
  generator, and tester — in phases. Use when a curriculum demand has no primitive
  or the user asks to build, scaffold, or add a visual primitive. Not for raising an
  existing primitive's layer (the /add-* skills) or kit migration (/migrate-primitive).

# ship
description: >-
  Turn the working tree into verified, sliced, pushed commits and keep main fresh.
  Use when the user says ship, commit, or push, or asks what is uncommitted. Runs the
  typecheck gates before slicing and never commits over a red typecheck:lumina.

# pm
description: >-
  Portfolio reconciliation and planning over WORKSTREAMS.md and the owning queues:
  pull the top item of an active stream, file a new finding with its executor skill,
  or close work in the queue. Use for "what's next", queue updates, and reconciling
  stale reports against queues.

# tutor-test
description: >-
  Verify a primitive's tutoring scaffold reaches the Gemini Live tutor intact —
  catalog block, {{key}} interpolation, and with --di the judged loop — driven
  headlessly. Use after wiring or editing a tutoring block, or when the tutor goes
  silent or off-script on one primitive.
```

## The remaining 25 — seed line and neighbor

Seed = the body's own first sentence (already accurate; compress it). Neighbor = the
skill to name in the "not for" clause.

| Skill | Seed (from the body) | Not for → neighbor |
|---|---|---|
| add-affordances | Tag ONE primitive's catalog entry with the facts the curator needs to place it well | grade floors (affordances are facts, never floors); eval modes → `/add-eval-modes` |
| add-di-loop | Convert a click/timer-advanced primitive to the DI modality: the Live tutor owns the clock, asks, waits, judges | L0 with no tutoring block → `/add-tutoring-scaffold` first; voice answer capture alone → `/add-voice-control` |
| add-eval-modes | Add eval modes (distinct task identities, not difficulty levels) to an existing generator | difficulty → `/add-support-tiers`, `/add-structural-difficulty` |
| add-number-pool-service | Wire a generator to the number pool so values differ every run, within and across sessions | categorical variety; values the LLM authors by design |
| add-sound | Wire procedural UI sound into an existing primitive: taps, selections, drags, steppers, answer feedback | `navigate` and celebration sounds (automatic) |
| add-structural-difficulty | Make `config.difficulty` produce a harder problem by SHAPE at higher tiers | help-text withdrawal → `/add-support-tiers`; task identity → `/add-eval-modes` |
| add-support-tiers | Make `config.difficulty` change what the student sees, withdrawing scaffolds intrinsic to the interaction | harder problems by shape → `/add-structural-difficulty` |
| add-tutoring-scaffold | Add the AI tutoring block (context, hints, struggle responses) to a primitive | the judged loop → `/add-di-loop` |
| add-voice-control | Wire a primitive so students answer or select by voice using the built platform layers | the DI judged loop → `/add-di-loop`; building capture layers (they exist) |
| curriculum | Explore the curriculum hierarchy; drill into a subject, look up a subskill | authoring → `/curriculum-author`; graph diagnosis → `/curriculum-graph` |
| curriculum-author | Create, review, and manage curriculum content via the authoring service, then build the prerequisite graph | exploring → `/curriculum`; diagnosing an existing graph → `/curriculum-graph` |
| curriculum-graph | Analyze the knowledge graph for structural issues that hurt Pulse diversity and adaptivity | authoring → `/curriculum-author` |
| eval-test | Test that a primitive's generated data works with its component; report only what is broken (agent-judged) | code-judged contracts → `/oracle-test`; fixing → `/eval-fix` |
| lumina-densify-primitives | Audit and densify eval-mode beta ladders so adjacent modes differ by ≤1.0 beta, catalog and registry together | adding modes → `/add-eval-modes` |
| lumina-portfolio | Decide what to build next across the primitive portfolio, then hand off to the building skills | building anything itself |
| migrate-primitive | Move an existing primitive onto the Lumina UI kit, replacing hand-written glass classes | new primitives → `/primitive` |
| misconception-test | Verify ONE primitive's misconception loop end-to-end with real generations | general QA → `/eval-test` |
| oracle-test | Give a primitive a machine-checkable content contract and run it N times against real generations | agent-judged QA → `/eval-test` |
| primitive-contract | Derive or refresh what ONE primitive must keep true for every skill it serves; `--check` guards edits | an improvement queue (it records, never plans) |
| pulse-agent | Run synthetic student profiles through the adaptive machinery and report what the engine did | fixing → `/pulse-fix` |
| pulse-fix | Fix bugs from `/pulse-agent` reports with root cause first | primitive content findings → `/eval-fix` |
| reader-fit | Verify a student at a given reading band can complete a primitive or lesson | topic scope → `/topic-fidelity` |
| student-data-loop | The map of the backend core loop: submission → events → profile → next problem (reference, not a builder) | any build; it says where to build |
| topic-fidelity | Verify ONE generator honors the lesson's topic, intent, and grade | the whole pipeline → `/topic-trace` |
| topic-trace | Run a topic through the real pipeline and assess how scope flows into each generator | one generator → `/topic-fidelity` |

`curriculum-fit`, `curriculum-lumina-audit`, `eval-fix` already have descriptions — leave them.

## Verification

1. `grep -L '^description:' .claude/skills/*/SKILL.md` prints nothing.
2. Each `name:` matches its directory: `for f in .claude/skills/*/SKILL.md; do d=$(basename $(dirname $f)); grep -q "^name: $d$" $f || echo "MISMATCH $f"; done`.
3. Routing probe in a fresh session: the skill listing shows the new descriptions, and these three asks pick the named skill without prompting — "what's next" → `/pm`; "wire IRT eval modes for ten-frame" → `/add-eval-modes`; "can a kindergartner read this lesson" → `/reader-fit`.
4. Land as one commit: `docs(skills): add frontmatter descriptions to 29 skills`.
