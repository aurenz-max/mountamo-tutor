---
name: eval-fix
description: >-
  Diagnose and fix confirmed Lumina evaluation findings by tracing the failed
  learning contract to its cause, repairing the responsible layer, and verifying
  the failure family and affected runtime flow. Accepts primitive IDs, issue IDs,
  and reports from eval-test or assembled-lesson QA.
---

# Eval Fix

Restore the intended learning task and close the mechanism that broke it. Choose
the smallest coherent repair that satisfies the contract; patch size and familiar
SP-* recipes are not evidence of correctness.

**Arguments:** `/eval-fix <primitive-id | issue-id | report-path>`.
When asked to review the workflow or propose improvements, stay in that scope;
do not fix application findings merely because they are the example.

## 1. Establish what failed

Read the report, its raw artifacts, relevant tracker/queue entries, and current
source. Accept lesson QA findings even without eval-test wiring or a tracker row.
If an ID cannot be resolved, search reports and queues before requesting context.

Separate **observations** (input, mode, output, learner behavior, sample counts),
**inferences** (the report's explanation and suggested fix location), and
**unknowns** (missing routing history, untested modes, unreproduced behavior).
Preserve the original failing artifact.

Report recommendations and SP-* patterns are hypotheses to check against code.
Identify whether evidence came from a full lesson, an unpinned resolver call,
a pinned generator call, or a mocked test. A forced mode cannot demonstrate
that the automatic selector chose that mode.

Find files through the registry and search; do not infer the domain from the ID.
Read the existing `docs/contracts/<primitive-id>.md` when present. Always inspect
the catalog mode definitions, generator, and component consumer, including
script/judge helpers determining what the learner sees, hears, or submits.

## 2. Trace the contract before choosing the fix

Write a short causal account with file/function references:

> The learner should [action] using [available information]. [Layer] receives
> [input], but [mechanism] produces/permits [bad state]. [Consumer] then [observed
> failure]. The missing or contradictory invariant is [specific requirement].

Trace the relevant path:
`objective + intent → catalog/selection → config propagation → prompt/schema →
reconstruction/filters/retry → display + spoken ask → judged answer`.

Inspect upstream producers until you locate the earliest demonstrated divergence
and the layer with enough information to own the repair. Bad generated content
may originate in selection, lost context, or contradictory contracts. Bad
rendering may originate in reconstruction or defaults.

For uncertain or cross-layer diagnoses, state plausible alternatives and run
the smallest distinguishing probe, such as automatic selection versus explicit
pins on the same objective. Do not infer a stochastic rate from one observation
or infer causation from co-occurring symptoms.

Define the relevant invariants before editing:

- **Task identity:** learner action, visible versus spoken information, correct
  response. A valid mode label alone proves little.
- **Item integrity:** stimulus, answer, alternates, correction, and judging rules
  agree; the item is solvable from information actually supplied.
- **Session integrity:** required coverage, usable item count, variety, and scope
  survive reconstruction, filtering, and fallback.

Not every defect needs an architectural refactor. A local implementation error
can have a local fix once its cause and valid neighboring behavior are clear.

## 3. Choose the repair and its evidence

Briefly explain the cause, responsible layer, intended change, and verification
before implementation. Continue within the user's authorization; do not impose
a separate approval round for routine fixes. Ask only for an unresolved product
choice, incompatible contract, or action requiring additional authorization.

Select by mechanism, not a mandatory prompt-first escalation ladder:

| Demonstrated cause | Repair direction |
|---|---|
| Wrong task selected or input lost | Fix the owning catalog, selector, or propagation path; verify real routing and pins |
| Prompt/schema contradict the task or each other | Reconcile the contract across producer and consumer |
| Model invents a value determined by trusted data | Derive it and synchronize dependent fields |
| Model controls required membership or coverage | Represent the required set explicitly and allocate/check coverage at the session boundary |
| Invalid output can be recognized reliably | Enforce the invariant with a defined reject/repair/retry outcome |
| Task remains generative or semantic | Improve instructions/representation; probe varied examples and state what remains probabilistic |
| Modes interfere through shared fields/instructions | Separate conflicting responsibilities where evidence warrants it; mode count alone does not justify a rewrite |
| Component violates valid data | Repair initialization, transitions, or rendering and drive the affected interaction |

For required-set planning, establish the authoritative source. Prefer existing
structured objective/config data. If interpreting free text is necessary, check
that interpretation against the objective before treating it as authoritative.
Deterministic allocation over a wrongly extracted set is still wrong. Do not
assume every bug needs a new planner.

When the source already contains exact text, glyphs, or identifiers that the
model corrupts while copying, let code retain that source and have the model
select references into it. Validate selected membership and meaning separately.
This changes who owns the value; replacing one observed wrong character does not.

An interpreter, reviewer, or repair step is part of the failure path too. Test
whether it can misclassify required content as optional/open practice and bypass
the invariant. Review both the closed plan and the claimed absence of one.
A second model call is not independent evidence of correctness by itself: use
the repository's established model for semantic judging, calibrate it on known
valid and invalid plans, and distinguish source integrity from semantic certainty.

### Guardrails must enforce the task

Regex suits a defined syntactic grammar. It is not a general classifier for
instructional intent, phonetics, or semantic correctness. Before adding an
exclusion, keyword router, clamp, or post-filter, establish:

- Which invariant it enforces and why the available data can establish it.
- A valid nearby case to preserve and a different failing case to catch.
- What happens after rejection, including partial/empty sessions and exhausted
  retries. Fallbacks must satisfy the same objective, mode, and coverage rules.

Do not repair the example by substituting characters, flipping an answer flag,
or changing a mode label while leaving the task inconsistent. Mutating operands,
targets, or stimuli requires updating dependent content or regenerating the item.
Derivation is only as sound as its inputs and assumptions: the first
`.indexOf()` is insufficient for repeated occurrences; spelling cannot generally
determine phonemes.

Prompt changes can correctly repair ambiguous instructions. Repeated failures
of an explicit requirement are evidence to reconsider who controls it, rather
than append emphatic wording. Rejecting everything prevents bad content but
does not restore the activity.

Use SP-* entries in `qa/EVAL_TRACKER.md` as historical leads after diagnosis;
verify their preconditions. A shared utility can be the right owner, but change
it with evidence and regression coverage across affected callers. Do not
special-case one objective in a global router.

## 4. Implement and verify the failure family

Implement the coherent repair, including dependent content and failure handling.
Follow repository edit conventions and preserve unrelated work.

For content/contract regressions, add or extend focused behavioral checks that
would fail on the original defect. Use saved failing inputs and independent
expected outcomes. Do not merely assert that the new regex matches its examples
or that the prompt contains the instruction. Cosmetic edits need no artificial tests.

Choose a compact verification matrix from the actual risk:

| Case | What it establishes |
|---|---|
| Original failing input/artifact | Demonstrated failure is corrected |
| Different instance of the mechanism | Fix extends beyond the reported literal |
| Nearby valid case or paraphrase | Legitimate content is preserved |
| Relevant boundary/failure path | Partial output, retries, fallback, or impossible coverage has an honest outcome |
| Affected sibling modes/callers | Shared changes preserve distinct tasks |
| Original runtime entry path | Fix reaches the consumer that failed |

For routing changes, test automatic selection and explicit pins separately;
exercise mixed/blended behavior when affected. For primitive-wide prompt,
schema, or filtering changes, check every supported mode. For shared changes,
include representative callers that could regress.

**Type check:** capture/compare the project-local baseline using the absolute
app directory and local binary, e.g. on PowerShell:

```powershell
Set-Location '<absolute-repo>/my-tutoring-app'
& ./node_modules/.bin/tsc.cmd --noEmit
```

Use the platform equivalent elsewhere. Never bare `npx tsc` from the repo root.
Require zero new diagnostics; compare diagnostics, not only total counts.

**Runtime:** use `/eval-test` when its tester exists and exercises the affected
path. Otherwise use the existing module runner, DI tester, or lesson harness
with real inputs. An unsupported tester, HTTP success, or mocked model response
is not a generation pass. Inspect the content and its consumer contract.

Re-drive UI/audio/state failures in the relevant runtime. For assembled-lesson
findings, a direct generator probe verifies only that boundary. A lesson rerun
that did not select the primitive did not test the fix. Use a saved manifest or
slot through the existing hydration path where supported to isolate downstream
behavior, and verify automatic selection separately.

**Stochastic generation:** choose and record a bounded probe matrix before
running, covering the original objective and distinct neighboring objectives.
Inspect individual items and complete sessions. Record all draws, failures,
retries, discarded items, and fallback usage; do not stop at the first green
sample. A remaining violation of a required invariant keeps that finding open.
Two passes out of three is improvement, not resolution. Zero observed failures
in a small sample is supporting evidence, not proof of reliability.

Record usable-session yield as well as invalid-content rejection. Test the
reviewer's own contract: a valid open arithmetic/counting plan should not be
rejected for lacking an enumerated target list. Do not call an all-empty result
robust, or call a session correct solely because its production gates pass;
independently inspect the original objective's scope and expected answers.

If verification fails, revisit the causal account before adding another patch.
If runtime access is unavailable, complete independent work and identify exactly
which behavior remains unverified; do not promote it to a pass.

## 5. Record the outcome without erasing evidence

Append dated fix/retest evidence to the report. Preserve original failures,
denominators, and artifacts; label updated results clearly. Distinguish diagnosed,
implemented, runtime-verified, and still-open findings.

Update `qa/EVAL_TRACKER.md` and the owning queue when the task changes their
status, following repository portfolio rules. Resolve only findings supported
by the required checks. Keep residuals explicit and untested modes unpassed.
Update dashboard totals from the actual evidence.

Tell the user the cause, what changed, how verification extends beyond the
original example, and remaining limitations. Do not claim "Regressions: None"
when only a narrow probe ran.

## Case reference

For a worked source review, read
[di-spoken-practice](references/di-spoken-practice.md). Apply its method, not its
particular symbols or proposed implementation, to other primitives.
