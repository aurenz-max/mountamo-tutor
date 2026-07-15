# PRD: Tutoring Context Integrity

**Status:** Proposed  
**Date:** 2026-07-14  
**Tracking:** SP-27  
**Primary gate:** `/tutor-test`

## 1. Outcome

Every scaffolded Lumina primitive must give the live tutor a valid, current,
minimal runtime context. A scaffold must never reach Gemini with unresolved
`(not set)` values, literal unsupported `{{...}}` syntax, answer-bearing spoken
scripts, or a catalog contract that describes interaction state the component
does not have.

The finished system makes tutoring context a checked interface:

```text
catalog scaffold
    │ references flat context keys
    ▼
component aiPrimitiveData
    │ validated at build time and at connect/switch time
    ▼
LuminaAIContext
    │ sends scaffold + data only when their contract is valid
    ▼
primitive-agnostic backend
    │ strict interpolation; safe generic fallback on contract failure
    ▼
Gemini receives a complete, answer-safe tutoring prompt
```

## 2. Current evidence

Fresh Tier-1 sweep on 2026-07-14:

| Metric | Current |
|---|---:|
| Catalog scaffolds audited | 133 |
| PASS | 66 |
| WARN | 25 |
| FAIL | 42 |
| Unresolvable flat template variables | 80 HIGH |
| Unresolvable `contextKeys` | 75 HIGH |
| Spoken answer leaks | 1 HIGH (`fast-fact`) |
| Orphan scaffolds | 1 HIGH (`machine-profile`) |
| Dynamic/unparsed data-bag primitives | 8 |
| Dynamic-bag key references requiring probes | 43 WARN |
| Silent tutors with no `sendText` moments | 5 WARN |
| Directive tags never emitted | 4 WARN |

The existing audit also has a blind spot: the backend accepts only flat
`{{word}}` placeholders, but the catalog contains 48 unsupported expressions or
nested paths across 16 primitives, including ternaries, dotted paths, array
access, `Math.*`, and `{{#if}}`. Eight of those primitives currently pass the
static audit. Therefore the known broken or malformed scaffold population is at
least **50 primitives**, not merely the 42 reported failures.

Failing primitives by catalog domain:

| Domain | Tier-1 FAIL |
|---|---:|
| Math | 25 |
| Physics | 4 |
| Engineering | 4 |
| Core | 2 |
| Chemistry | 2 |
| Calendar | 2 |
| Literacy | 2 |
| Astronomy | 1 |

The highest-density failures are `sound-wave-explorer` (12 HIGH),
`push-pull-arena` (12), `sentence-analyzer` (10), `gravity-drop-tower` (9),
`length-lab` (9), `function-machine` (8), and `time-sequencer` (8).

## 3. Root causes

1. `TutoringScaffold.contextKeys` is `string[]`; catalog keys have no type-level
   relationship to a component.
2. `useLuminaAI` accepts `primitiveData: any`, so a component can omit every
   catalog key without a TypeScript error.
3. Catalog scaffolds and component bags were authored or refactored separately.
4. Backend interpolation replaces a missing flat key with `(not set)` and emits
   no error or telemetry.
5. Unsupported Mustache-like expressions remain literal because the backend
   deliberately implements only `{{word}}` replacement.
6. `/tutor-test` is an API/tooling gate, not an enforced CI invariant.
7. The static scanner downgrades spread/computed bags to WARN, so dynamic bags
   remain unproven until a Tier-2 probe.

## 4. Goals

- Zero unresolved scaffold variables and context keys.
- Zero unsupported template syntax.
- Zero literal `(not set)` or `{{...}}` in assembled tutor prompts.
- Zero answer-key interpolation in student-audible scaffold sections.
- Zero orphan scaffolds and stale `primitiveType` ids.
- Make regressions fail CI before reaching a live tutor.
- Detect runtime-only contract failures with structured telemetry.
- Preserve focused data bags; do not solve this by sending full generator output.

## 5. Non-goals

- Evaluating JavaScript, ternaries, Handlebars, or nested object paths in Python.
- Adding primitive-specific logic to the backend.
- Rewriting all scaffold pedagogy as part of key repair.
- Treating `hookNoScaffold` L0/L1 primitives as SP-27 defects.
- Proving Gemini's live behavior with static checks; Tier 3 remains necessary.

## 6. Contract invariants

### 6.1 Flat-key syntax only

The only valid placeholder grammar is:

```text
{{identifier}}
identifier := [A-Za-z_][A-Za-z0-9_]*
```

Nested or computed values must be flattened by the component:

```ts
// Invalid catalog template
'Wing span: {{designParameters.wingSpan.value}}'

// Valid component bag + catalog template
const aiPrimitiveData = { wingSpan: designParameters.wingSpan.value };
'Wing span: {{wingSpan}}'
```

Conditional prose must also be derived in the component:

```ts
const forceDescription = forceLevel > 3 ? 'really hard' : 'gently';
```

The backend must never become an expression evaluator.

### 6.2 Declared keys are required

Every `contextKey`, every valid template variable, and every
`studentPrompts.showWhen.key` must be present in `primitiveData` when its scaffold
is active. Presence is based on key existence and a non-null value; `false`, `0`,
and an empty array are valid values.

If a value is optional in the UI, the component must send a stable explicit field
such as `hasSelection: false`, or the catalog must stop claiming that value.

### 6.3 Runtime data is a teaching projection

`aiPrimitiveData` is not raw component state or the full generated payload. It is
a small projection containing the state a human tutor needs:

- current stimulus/task;
- current interaction phase or challenge type;
- student attempt/progress state;
- relevant visible parameters;
- tutor-reference answer data only when needed for feedback.

### 6.4 Tutor-reference and spoken text are separate trust zones

Answer keys may appear in `contextKeys`/RUNTIME STATE so the tutor can judge or
withhold correctly. They must not appear in:

- `scaffoldingLevels`;
- `commonStruggles.response`;
- student-facing prompt labels;
- any directive that instructs the model to say the value.

### 6.5 Fail closed, visibly

Missing context must never silently become plausible-looking tutoring copy.
Development and CI should fail loudly. Production should log a structured
contract event and use the generic tutor fallback for that primitive rather than
send a malformed scaffold.

## 7. Target implementation

### 7.1 Strengthen the deterministic auditor

Extend `scaffoldAudit.ts` with:

1. `invalid-template-syntax` HIGH for every `{{...}}` token that is not a flat
   identifier.
2. Coverage of `studentPrompts.label`, `studentPrompts.prompt`, and
   `studentPrompts.showWhen.key` as first-class contract surfaces.
3. Stable finding fingerprints:
   `componentId/check/key/location`.
4. Counts for unique broken primitives and unique missing keys, not only raw
   duplicate references.
5. A machine-readable full-sweep artifact for CI and remediation batches.
6. Shared interpolation fixtures mirrored in TypeScript and Python so the audit
   grammar cannot drift from backend behavior.

Add a Vitest contract gate that directly invokes the auditor without requiring a
running Next server.

Because the repository starts with known failures, introduce a checked-in
monotonic baseline of finding fingerprints:

- new findings fail CI;
- removed findings are allowed;
- changed findings are treated as remove + add;
- after migration reaches zero HIGH/invalid findings, delete the baseline and
  enforce an empty result permanently.

### 7.2 Add a frontend runtime guard

Before `connect` and `switchPrimitive` send tutoring context, validate the catalog
scaffold against the actual `primitiveData` object using the same flat-key rules.

Behavior:

| Environment | Contract failure |
|---|---|
| Development/test | `console.error` with component, missing keys, and locations; expose failure in Tutor Tester |
| Production | emit structured telemetry; send `tutoring: null` for this activation so the safe generic tutor is used |

Validation is primitive-agnostic and O(number of scaffold references). It runs on
connect/switch; context updates only need key-presence checking when their shape
changes.

Replace `primitiveData: any` with
`Readonly<Record<string, unknown>>` immediately. A future typed
`TutorContextByComponent` map can provide compile-time key checking, but it is not
required to close SP-27 and should not delay the runtime/CI gates.

### 7.3 Add a backend last line of defense

Keep the backend primitive-agnostic. Change interpolation to return both rendered
text and missing keys. If any required key is absent or any raw `{{...}}` token
survives:

- log `tutor_scaffold_contract_failure` with primitive id and key names (never
  student values);
- use the generic primitive fallback for that activation;
- never include literal `(not set)` or raw template syntax in the Gemini prompt.

Frontend/CI validation remains the primary defense; backend handling protects old
clients, races, and runtime-only data shapes.

## 8. Per-primitive repair decision matrix

For every finding, inspect the component interaction—not just its generator—and
choose exactly one repair:

| Situation | Repair |
|---|---|
| Value already exists in component state under another name | Add a clearly named derived field to `aiPrimitiveData` |
| Value exists only in current generated challenge and is pedagogically needed | Forward the current challenge's field, flattened |
| Scaffold describes state/interaction the component does not have | Rewrite or remove that scaffold reference; do not fabricate state |
| Template uses a nested path/expression | Derive one flat semantic field in the component and rewrite the template |
| Key is optional | Send an explicit boolean/count/empty collection, or remove it from the scaffold |
| Answer key appears in spoken copy | Rewrite the copy; retain the key only in tutor-reference context if needed |
| Scaffold has no hook | Wire and runtime-test the hook if tutoring adds value; otherwise remove the dead scaffold |
| Static bag is dynamic/unparsed | Run Tier-2 probe first; make the bag explicit when practical |

Do not bulk-add names merely to satisfy the audit. Every field must be truthful,
current, and useful to tutoring.

## 9. Rollout strategy

### Phase 0 — Make the inventory trustworthy

1. Add invalid-syntax detection and student-prompt coverage.
2. Produce the fingerprint baseline.
3. Add the monotonic CI gate.
4. Add frontend runtime validation in report-only mode.

Exit: current failures cannot grow, and “PASS” no longer hides unsupported
templates.

### Phase 1 — Runtime-validated pilot: `how-it-works`

This is the recommended pilot because it exposes the key judgment SP-27 requires:
the catalog assumes a single navigated `currentStep`, but the component is a scroll
timeline with intersection-tracked `visitedSteps`. Blindly adding `currentStep`
would make the contract compile while remaining pedagogically false.

Pilot repair:

- rewrite task/scaffolding copy around real scroll state;
- keep existing `title`, `overview`, `stepsExplored`, and challenge progress;
- add a truthful derived `detailsExpandedCount` field;
- remove or rename dead `[STEP_NAVIGATION]` instructions rather than inventing a
  navigation event;
- preserve `[DETAIL_EXPANDED]` and challenge feedback moments;
- add/update a bespoke live journey matching the actual scroll/detail/challenge
  sequence.

Gates:

1. Tier 1: zero HIGH and zero invalid syntax.
2. Tier 2: real prompt preview contains no `(not set)` or raw `{{...}}`.
3. Tier 3: three runs on the same content; transcript reviewed; no context errors,
   answer leaks, stale state, or doubled turns.
4. User reviews the pilot before fan-out, per `/add-tutoring-scaffold`.

### Phase 2 — Immediate safety defects

After the pilot is approved:

1. Remove the `fast-fact` spoken answer leak.
2. Resolve `machine-profile` orphan status (recommended: wire a focused display
   context and section-opening moments; otherwise remove the scaffold).
3. Repair all 48 unsupported expressions/nested paths across 16 primitives.

Exit: no spoken answer leak, no orphan, no unsupported template syntax.

### Phase 3 — High-density context batches

Repair in coherent families, not one 40-primitive mega-change:

1. **Physics simulation batch:** `sound-wave-explorer`, `push-pull-arena`,
   `gravity-drop-tower`, `race-track-lab`. These account for 39 HIGH references
   and are the most context-blind.
2. **Math foundations batch:** visible manipulatives and K-5 sessions.
3. **Math advanced batch:** function/equation/distribution workspaces.
4. **Engineering/science/calendar/core/literacy batch:** remaining lower-density
   failures.

Each batch receives its own report and must return all touched primitives to Tier-1
PASS. Run Tier 2 for every touched primitive. Tier 3 is mandatory for scaffold
rewrites, new/changed speech triggers, answer-bearing flows, and one representative
of any otherwise component-data-only batch.

### Phase 4 — Resolve dynamic bags

Probe the eight currently dynamic/unparsed bags. Prioritize `passage-studio` (27
warned key references) and `light-shadow-lab` (11). Classify every reference as
component, generator-only, or unresolved. Prefer explicit `aiPrimitiveData` objects
over spreads so future static audits are decisive.

Exit: zero `data-bag-unparsed` and zero unresolved dynamic-bag warnings.

### Phase 5 — Enforce zero baseline

1. Delete the temporary finding baseline.
2. Require zero HIGH, invalid syntax, orphan, and stale-hook findings in CI.
3. Turn frontend runtime validation from report-only to safe fallback.
4. Add a dashboard/telemetry alert for any production contract fallback.

## 10. Verification matrix

| Gate | Proves | Required |
|---|---|---|
| Typecheck | component changes compile | every change |
| Tier-1 `/tutor-test` | static key, syntax, hook, tag, and leak contract | every primitive |
| Tier-2 `&probe=1` | real generated content and assembled prompt | every migrated primitive |
| Component test | derived bag values follow interaction state | whenever new derived/runtime state is added |
| Tier-3 live journey | tutor behavior, withholding, timing, and trigger compliance | pilot + material scaffold/trigger changes |
| Manual Tutor Tester | audio quality and edge interactions | release sampling |

## 11. Acceptance criteria

- 133/133 scaffolded primitives have no HIGH contract findings.
- No invalid `{{...}}` syntax exists in catalog tutoring blocks.
- Every dynamic bag is either explicit or probe-verified.
- Prompt previews contain zero `(not set)` and zero raw template tokens.
- No spoken section interpolates an answer-shaped key.
- No catalog scaffold lacks a live `useLuminaAI` hook.
- No tagged system trigger omits `{ silent: true }`.
- CI prevents new failures; production telemetry reports zero fallbacks during the
  release observation window.

## 12. Explicitly rejected shortcuts

- Sending the entire generated payload to the tutor.
- Replacing missing values with believable defaults.
- Deleting contextKeys solely to make the audit green.
- Adding fake component state that mirrors an outdated scaffold model.
- Implementing expression evaluation in backend template strings.
- Declaring success from static PASS without a real prompt probe and pilot runtime
  transcript.

