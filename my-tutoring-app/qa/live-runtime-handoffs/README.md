# Live runtime adoption handoffs

**Next session:** [15: put every answerable primitive on the teaching workspace](15-workspace-rollout.md)
(`/add-live-tutor-tools`). 8 of ~212 primitives are on the workspace. Pilot a minimal binding (W1) on
ten-frame and one more primitive, write the recipe into the skill, build `qa/workspace-rollout/ROLLOUT.md`,
run batch A1. Custom scaffolding (W2) comes after, per primitive, only where testing shows a need.
**Ten-frame W1 done 2026-09-22** ([report](../tutor-reports/ten-frame-w1-2026-09-22.md)); next is number-bond.
The LA-13 follow-ups (shape-sorter `sort` wording, sentence reading's `incorrect` weight, statement-of-fact
credit) are parked W2 work.

**Done 2026-09-22:** [14: the observer refuses credit the tutor clearly gave](14-la13-crediting-reply-abstains.md)
([report](../tutor-reports/la13-crediting-criterion-2026-09-22.md)). Three criterion sentences: verdict probe
445/443 -> 473/478 of 510, 0 false credit in every domain; shape-sorter one case below baseline, owned by
the sort slice above. A tutor turn transcribed as `<no speech>{pause}` is no longer observed (it had reopened
a correctly read item).

**Done 2026-09-22:** [13: the four DI packs' scripted drills are deleted](13-delete-di-scripted-drills.md)
(LA-14 S5, [report](../tutor-reports/di-drill-deletion-2026-09-22.md)). The multi-objective
blocker was unreachable (step-0 probe, 79 lessons); the real unbind cause was a 12-item pool cap,
now per domain.

**Done 2026-09-21:** LA-14 S3 slice 2: Pulse hosts the workspace and Practice is deleted
([report](../tutor-reports/pulse-on-workspace-2026-09-21.md)).

**Done 2026-09-21:** [12: Pulse and Practice host the teaching workspace](12-pulse-practice-on-workspace.md).

**Earlier, 2026-09-20:** [10: DI lesson entry](10-di-lesson-entry.md). Six primitives bind the shared
teaching workspace; only three reach ordinary lessons. The three DI packs are speech-only, so
the gesture-scoped retry blocker does not apply to them. **Done 2026-09-20, and wider than the
brief:** by user ruling no existing mode is withheld from lessons. Every family that declares
`bindsTeachingWorkspace` runs all its modes on the workspace in ordinary lessons — the three DI
packs, `order_cards`, and all ten counting-board modes — and the gesture stall was fixed by
moving the learner's Try again / Next challenge into the shared runtime shell.

**Structure review, 2026-09-20:** [11: what was fixed, what is queued](11-structure-review-residuals.md).
Duplicate wiring across the adapters, teaching components, observers and routes was folded into
shared helpers; seven findings that change tutor or JEV input are queued there with executors.

**Earlier:** [08: lesson workspace follow-through](08-lesson-workspace-follow-through.md).
Repair the recorded JEV completion stalls on the two wired modes, preserve normal
tutor-completed submissions, then retire one replaced pilot path under LA-14 S3.
The brief includes source locations, saved failure evidence, commands and exit criteria.

**Next architectural work, user direction 2026-09-19:**
[07: sunset scripted tutoring](07-sunset-scripted-tutoring.md), owned by roadmap
LA-14. The old runner and exact-script protocol are temporary migration dependencies,
not a permanent parallel architecture. S0/S1 census and extraction are done. S2 now
wires Counting Board `count` and Shape Sorter `identify` into ordinary lessons with
normal evaluation submissions; [wiring evidence](../tutor-reports/lesson-workspace-wiring-2026-09-19.md)
records the remaining model/experience limits. Other modes and shared-runner deletion
remain subsequent work.

**Current, 2026-09-19:** Counting Board's tutor/JEV workspace is mapped into eleven
[invariant principles](../../src/components/lumina/docs/TEACHING_WORKSPACE.md).
The user reports the latest seven-item sitting works well; its log reaches settled
completion. Shape Sorter `identify` is the selected second adopter, using the same
observer, session, and runtime. Read [its report](../tutor-reports/shape-sorter-teaching-2026-09-19.md)
for exact evidence and remaining experience gates. The earlier scripted adapter
recipes below are historical for these two live workspaces. Other Shape Sorter modes
remain standalone while this live pilot advertises identification only.

User direction: prove shared infrastructure first, then migrate primitives in smaller
sessions. The sunset direction is now recorded in handoff 07; earlier briefs are
historical evidence, not permission to delete active consumers without replacement.

**Current, 2026-09-18 (later):** The support shell draws a second shape, `contrast-pair`, and
comparison-builder's detour was driven 3/3 against the real model. The user reviewed the
screenshot: functionally right, but the shell is raw Tailwind and reads as a popup on a static
page rather than a Lumina surface. Next session starts there:
[06: support shapes](06-support-shapes.md).

**Earlier, 2026-09-18:** Twelve primitives are in the host, up from three, under an explicit
user direction to reach 10-15 with the real-model drive SAMPLED rather than run per primitive.
The nine new adoptions are number-sequencer, number-bond, ordinal-line, sorting-station,
compare-objects, place-value-chart, shape-sorter (judged-runner) and number-tracer,
comparison-builder (tutor-led). Evidence, the withheld-action reasons, the misstep inventories and
an explicit list of what was NOT driven:
[live-tutor-tools-math-sweep-2026-09-18.md](../tutor-reports/live-tutor-tools-math-sweep-2026-09-18.md).

Three things any later adoption needs from that session:

1. **The host is a registry now.** `adapters/<primitive>Live.ts` per family, composed by
   `activityContract.ts` with `satisfies`, rendered by `liveRenderers.tsx`. No `primitiveId ===`
   remains in `api/lumina/live-activity/route.ts`. Adding a family touches no shared branching.
2. **`evalMode` must come from the SESSION, not `runner.currentItem`.** An item change rebuilds an
   unstable mount and re-registers into an unreleased owner. Single-item tests do not catch it.
3. **`useLiveAutoStart` is declared AFTER the runtime mount hook**, because `start()` waits for
   `grantOwnership('runner')`, which needs the mount to exist.

And one harness correction: `run_live_runtime.py` now takes the item identity from the RUNTIME's
own `task.itemId` rather than from `data.challenges[i].id`. A judged item is not a challenge — six
of the nine expand one challenge into several asks — and the old assumption held only because
ten-frame and counting-board happen to reuse the challenge id.

**Previously, 2026-09-17:** Counting board now joins Number Line and TenFrame in the
existing host, as the second judged-runner adoption — so the shared runner lifecycle
has two owners, not one. See the [counting-board evidence](../tutor-reports/counting-board-runtime-live-2026-09-17.md),
including the two findings any later judged-family adoption needs: `canYieldForHelp`
gates every affordance while the runner owns the turn (withhold a detour through
`supportArtifacts` instead), and the model may open and close its example inside one
turn, so a journey must capture the saved work when the support command commits.

Number Line joined TenFrame in the existing host before that.
Session 01 has an adapter, real React commit acknowledgement, scoped local actions,
and preserved subtraction help/return. Sessions 02/03 and the TenFrame portion of
04 were already implemented. See the [Number Line evidence](../tutor-reports/number-line-runtime-live-2026-09-17.md)
and [next-primitive handoff + skill](05-primitive-tools.md). The combined two-order
lesson and actual microphone gates remain open.

User review rejected the synthetic connected fixture as a learner demo. The old
/lumina/live-activity/runtime/live URL now redirects to the existing live activity
host at /lumina/live-activity. The [three Live transport journeys](../tutor-reports/live-runtime-connected-2026-09-17.md)
remain transport evidence only: they supplied checked answers and simulated paint.
Continue adoption inside the working host, preserving its actual activity and voice judge.

Number Line now flushes imperative tutor progression to a real React commit before
returning success. The real-component tests assert both the new semantic state and
the new instruction before dispatch exits. Do not copy the old queued-setter wrapper
or infer a visible receipt from a committed state.

Start with the [infrastructure evidence](../tutor-reports/live-runtime-infrastructure-2026-09-17.md)
and [adapter contract](../../src/components/lumina/components/live-activity/runtime/README.md).
The development reference lab is `/lumina/live-activity/runtime`. Real-browser review
is pending; the machine gate exercises the actual runtime and React shell.

| Session | Scope | Dependency / exit |
|---|---|---|
| [01: number-line](01-number-line.md) | Implemented: local actions and subtraction help/return | See Number Line evidence; combined lesson and human acceptance remain open |
| [02: judged runner](02-judged-runner.md) | Shared lifecycle, no broad primitive ports | Prove cancellation, suspension, queued-cue ownership and closing completion |
| [03: ten-frame](03-ten-frame.md) | Adopt the certified runner in one primitive | Requires 02; preserve frame/phase through help and return |
| [05: next primitive tools](05-primitive-tools.md) | Installed skill and shared mounted driver | Choose one requested primitive; certify only its executable actions. Counting board adopted 2026-09-17 (`count` + `take_away` drives); 8 modes and the planned closing cue have component coverage only. Since 2026-09-18 an adoption adds a row to `liveJourneySpec.ts` and edits no harness — see the roadmap's harness-collapse section |
| [04: live bridge and demo](04-live-integration.md) | Existing sandbox/transport integration | Requires 01–03; both orders, then actual microphone sitting |
| [06: support shapes](06-support-shapes.md) | Second prepared shape in the returnable shell; comparison-builder driven 3/3 | Theme the shell with the Lumina kit first (user review), then gate the `[ANSWER_INCORRECT]` answer leak, then a second adopter of the shape |

01 and 02 may be separate sessions, but avoid simultaneous edits to shared runtime
files. Any contract changes need their regression tests first. After 04, decide
keep/change/stop before considering literacy or other primitives. Generated imagery
and persistence remain later roadmap gates.
