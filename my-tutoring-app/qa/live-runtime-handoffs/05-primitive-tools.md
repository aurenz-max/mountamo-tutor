# Handoff: add live tutor tools to the next primitive

The user requested one non-TenFrame adoption, actual action verification, and a
repeatable skill. Number Line is that reference. Implementation lives in the
existing `/lumina/live-activity` host; select **Activity: Number Line**, then
**Lesson: Subtraction jumps**, then **Start lesson**.

Invoke `/add-live-tutor-tools` in a new session. It is installed natively at
`.claude/skills/add-live-tutor-tools/`, with source locations, the driver protocol,
the envelope constraints and exact test commands in its
`references/implementation-map.md`. The earlier copy under
[add-live-tutor-tools/](add-live-tutor-tools/SKILL.md) is the versioned record only.

Suggested session request:

> Use $add-live-tutor-tools for <primitive-id>. Preserve its real learner controls
> and grader in /lumina/live-activity. Add only phase-valid actions with executable
> handlers, expose it in the tester, verify the actual component and live model,
> and update the handoff with supported versus unavailable actions. Use Number
> Line for a tutor-led component or TenFrame for a judged-runner component.

## What is reusable

- Shared `LiveLessonRuntime`, opaque scoped action tickets, `RuntimeTransport`,
  assistance history, visible acknowledgements and `LiveRuntimeSurface`.
- Frontend host capability envelope. No new Python primitive branches were needed.
- `primitive-runtime-driver.mjs` mounts NumberLine or TenFrame, uses actual gesture
  grading or actual speech reduction, and isolates hardware/auth/evaluation writes.
  The old TenFrame driver entry point forwards to it.
- Number Line's synchronous imperative React commit boundary (`flushSync` plus
  layout-published refs) and tests that inspect the new DOM *before dispatch exits*.
  This is a reference approach, not permission to flush from render/effects.
- Host completion deferral until the mounted runtime settles. Number Line suppresses
  duplicate final cues in planned mode; existing standalone behavior is preserved.
- Explicit activity/mode selection, both families in the support shell, and resolved
  plan metadata preserved into the Number Line runtime.

## Number Line capability boundary

Checked advance, retry and focused instruction replay have real-component checks
for jump, plot, find-between and ordering challenges. The text reminder/fade pair
is jump-only. A returnable counter example is advertised only for one positive
integer subtraction operation (start 2-20, remove at least 1 but less than start).
The example has a different starting quantity and answer from the saved task.

No runtime point/highlight handler, spoken-answer judge, skip, challenge reshaping,
generated support images, durable recovery or learning-record integration was added.
The model must use the component's checked result; conversational praise is not
correctness. Number Line remains a gesture-and-Check activity.

## Evidence and remaining work

[Number Line report](../tutor-reports/number-line-runtime-live-2026-09-17.md) owns the
verification results and limitations. It links complete live traces and preserved
failed probes. The separate TenFrame driver regression retains its real runner.

Next integration gate: drive both prepared-plan orders through both real adapters,
then do an actual screen/microphone sitting (HUMAN-CHECKS #167). The single-primitive
machine checks do not close G1-G3 across the combined lesson. Review restraint,
complete example narration and language consistency as teaching-policy work;
executed tool calls alone do not certify teaching quality.
