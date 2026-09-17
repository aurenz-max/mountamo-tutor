# Host-owned live capabilities — 2026-09-17

The earlier cleanup removed dead fixtures but left the architectural duplication
the user wanted removed. This change migrates the active path.

## Responsibility changes

- Deleted Python VISUAL_INSTRUCTION, TEN_FRAME_RUNNER_RULES,
  TEN_FRAME_INSTRUCTION, NUMBER_LINE_PLAN_RULES and ACTIVITY_MODES.
- Removed backend primitive-ID checks for available activities, modes, advance,
  silent preparation/mount, runner-ready events, scaffold assembly and visual state.
- Deleted live_visual_tools.py. Direct-visual schemas and data validation now live
  beside the frontend renderer in directVisualContract.ts. The host reports the
  valid highlighting range with its mounted receipt.
- Extended existing LIVE_ADAPTERS with supported modes, canAdvance and guidance.
  The existing component scripts/catalog tutoring remain the teaching source.
  liveActivitySpec.ts projects those registrations into the connection envelope.
- Python validates that bounded envelope, builds the advertised tool declarations,
  routes parameters and correlates results. Its remaining prompts cover shared
  session protocol, ownership, visibility and plan order. Runner behavior follows
  teachingOwner, including for a primitive ID Python has never seen before.
- Migrated the host/provider and all active Live probes. Probes read the same host
  registry through the dev capabilities endpoint or the prepared-fixture importer;
  they do not maintain another Python catalog. Legacy enabledPrimitives configs
  fail explicitly instead of selecting a fallback prompt.

The shared runtime still owns current-task actions and help/return. Number-line's
existing checked advance and standalone direct visuals keep their current host
handlers; this is not a full primitive runtime migration or new learning behavior.

## Verification

39 backend tests plus 7 subtests pass, including a synthetic new runner family,
tool-name collision rejection, mode/plan validation, owner conflicts, visual
validation failures, scoped actions and silent versus audible responses.
99 affected frontend tests across 14 files pass, including actual host visual
rendering/taps/highlights, mount receipts, startup metadata, planned mounts, and
the real TenFrame/shared-runner lifecycle.
Lumina typecheck is clean; the changed provider and API routes have no TypeScript
diagnostics (unrelated legacy diagnostics remain excluded).

The browser's actual capability envelope was fetched and validated by Python,
including all three visual schemas. Live evidence is recorded in
[final startup/help journeys](ten-frame-host-capabilities-final-2026-09-17.json).
These use real model tool calls, the actual host metadata and mounted TenFrame,
its shared judge, runtime and surface. The saved real generated payload is reused
when the model requests an activity; generation, microphone/playback and browser
paint are not newly certified by this drive.

A separate [real-model visual schema smoke](host-visual-capabilities-smoke-2026-09-17.json)
accepted the frontend tool schemas and selected show_fraction with numerator 3,
denominator 4. This checks tool declaration/selection; actual visual rendering and
parameter rejection are covered by the host tests, not that text-driven smoke.

**Final result: 3/3 startup-to-completion journeys passed.** Each model requested
the supported activity/mode, waited for the correlated silent mount/runner-ready
handoff, corrected a wrong answer, executed hint/example/return, described six plus
four making ten from the prepared example, returned the same unfinished frame,
judged the two correct answers and completed once. All nine runtime receipts were
visible. All full transcripts were reviewed: no premature greeting, duplicate
return question, protocol leakage or button-only grading. The temporary verification
backend was stopped; the normal development servers remain running.

Initial [capability journeys](ten-frame-host-capabilities-2026-09-17.json) passed the
flow checks but transcript review rejected the vague worked-example explanations
in all three. The generic support rule now explicitly permits explaining the
separate example's supplied solution while protecting the saved task's answer.
The final harness requires the example's actual quantities, in addition to return,
judging and completion. No per-primitive prompt was added to Python to fix it.

One later startup run verbally gave a hint without executing the scaffold. The
[action-omission trace](ten-frame-host-capabilities-action-omission-2026-09-17.json)
was deliberately stopped for repair; its subsequent two entries are connection
failures from stopping that isolated server, not repeated model failures. The
generic action rule now explicitly requires performing an advertised visible
change before describing it. Final runs below use both prompt corrections.

Browser/microphone acceptance and both planned activity orders remain separate
gates. No learning records are written. Reload the development page to connect
with the new host capability envelope.
