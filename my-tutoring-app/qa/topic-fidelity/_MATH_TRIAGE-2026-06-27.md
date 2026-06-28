# Math Generator Topic-Fidelity Triage — 2026-06-27

Full sweep of all 61 math `gemini-*.ts` generators under the context-native API
(workflow: static "does the prompt interpolate ctx.intent?" + runtime probe for the
ambiguous/code-picked cases). Diagnose-only; fixes tracked separately.

**Headline:** the GenerationContext migration put `intent` ON the context but did not
wire it INTO most prompts. 50/61 are dead fields (intent never interpolated). 2 that
look wired do not actually bind (confirmed by probe).

## Verdicts

### HONORS (3) — intent live, no action
counting-board, addition-subtraction-scene, bar-model

### SPECIAL-CASE (2) — no action
- digit-evaluation — Gemini Vision grading helper, not a content generator (no ctx)
- practice-problem — orchestrator-routed; intent already bound via `context: intent`

### NEEDS-PROBE → HONORED (4) — no action
- ten-frame — theme flavor in title/desc; numbers grade-fixed (0–10/0–20)
- number-line — range tracks intent (0–10 vs 0–30 via resolveTopicNumberRange)
- base-ten-blocks — theme tracks (reading-log vs food-drive); numbers code-owned
- hundreds-chart — FIXED earlier today; skipValue concentrates on the named interval

### NEEDS-PROBE → FIDELITY-BUG (2) — RESOLVED
- **number-sequencer** — **FALSE POSITIVE.** The workflow probe had read hundreds-chart
  fields (correctCells/highlight_sequence). Re-probed correctly (fill_missing, grade 1):
  intent "within 20" → range 1..20; "80 to 100" → range 80..100. HONORED; no fix.
- **fraction-circles** — **FIXED (Tier 1).** Real gap: the candidate pool was a grade-only
  Fisher-Yates slice (named family often absent) and only `topic` was authoritative.
  Fix: rollFractionPool now guarantees one fraction per grade-legal denominator (family
  always selectable) + intent made authoritative + "use ONLY the named family" prompt.
  After: "tenths and twelfths" → [10,12,10,12]; "halves and thirds" → 2,3-dominant
  (minor 6/8 leak in identify); generic stays varied. tsc 1417. Residual crisp-honoring
  for small families would need a Tier-2 resolver — deferred (user: leave at Tier-1).

### DEAD-FIELD, real scope — llm/mixed (~18) — Tier-1 wire has real payoff
number-tracer, math-fact-fluency, multiplication-explorer, skip-counting-runner,
number-bond, double-number-line, dot-plot, equation-builder, tape-diagram,
compare-objects, parameter-explorer, pattern-builder, equation-workspace,
function-sketch, ratio-table, analog-clock, coin-counter, coordinate-graph

### DEAD-FIELD, code-picked/na scope (~31) — theme-flavor only, low payoff
place-value, polygon-area-builder, fraction-bar, circle-explorer, comparison-builder,
area-model, time-sequencer, array-grid, spatial-scene, shape-composer, angle-workshop,
ordinal-line, net-folder, transformation-lab, sorting-station, systems-equations, matrix,
shape-sorter, 3d-shape-explorer, histogram, two-way-table, shape-tracer, strategy-picker,
regrouping-workbench, factor-tree, measurement-tools, percent-bar, length-lab,
balance-scale, function-machine, slope-triangle, shape-builder

## Fixes applied (2026-06-28)

**Key reframe during fixing:** the 4 scopeContext-using generators flagged DEAD-FIELD by
the static check (number-tracer, math-fact-fluency, multiplication-explorer,
skip-counting-runner) actually HONOR intent — `buildScopePromptSection` emits
`THIS COMPONENT'S INTENT: "<intent>"` as an authoritative block, so intent reaches the
prompt transitively via `${scopeSection}`. Re-probed: all 4 track (skip "by 2s"→skipValue 2 /
"by 10s"→10; mult "9&10 tables"→facts use 9,10; tracer "teens"→13-19; fluency "within 5"→≤5).
So the static "prompt contains literal ctx.intent" test OVER-counts dead fields by 4 — the real
test is "does the prompt include scopeSection OR interpolate ctx.intent."

**The 14 genuine dead-fields fixed via the [[scope-context-contract]] rollout:** inject
`buildScopePromptSection(ctx.scope)` into each prompt (one import + one `${scopeSection}`).
This is the proven mechanism (same as counting-board/base-ten-blocks/number-line) and gives
range + family + intent-prose binding for free. Orchestrators thread scopeSection into each
sub-generator.

Wired + verified: number-bond, ratio-table, analog-clock, equation-builder, equation-workspace,
coin-counter, pattern-builder, double-number-line, parameter-explorer, dot-plot, tape-diagram,
compare-objects, function-sketch, coordinate-graph. tsc 1417 (no new errors).
Probe spot-checks track scope (equation-builder within-5→max5/within-20→max20; tape 8→15;
number-bond ≤5 / ≤10). **dot-plot** exception: its line-plot data is grade-band-bound (~0–10),
so magnitude is only weakly scope-sensitive (wired, but "up to 20" stays small — acceptable for
a grade-3 line plot).

## Notes
- For the code-picked bucket the LLM only authors title/description; wiring intent adds
  theme flavor, not scope binding — and must guard against answer-leak when an intent
  names a value (pedagogy rule #1).
- The 2 confirmed bugs are the priority: a dead field is at least honest; a wired-but-
  non-binding generator silently looks correct.
- Method note: static read alone classified all 50 dead fields conclusively (a prompt
  that never names intent cannot honor it); probes were spent only on the 6 wired cases.
</content>
