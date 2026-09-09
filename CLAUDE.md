# CLAUDE.md

## Product Philosophy

This is Lumina — an adaptive learning platform where students interact with visual primitives, not worksheets. The primitives ARE the product. Everything else (backend, curriculum service, planning engine) exists to serve the right primitive to the right student at the right difficulty at the right time.

**What matters most, in order:**
1. **Pedagogy** — Every primitive must teach something real. Never reveal answers in placeholder text, labels, or default UI state. Students should not be able to trivially solve challenges from visual layout or default values. If a primitive isn't pedagogically sound, it ships nothing.
2. **Primitive quality** — Tight interaction loops, clear feedback, smooth difficulty progression. Use `/primitive` to build, `/add-eval-modes` to wire IRT difficulty, `/eval-test` to verify.
3. **Content density** — The adaptive engine only works when there's enough content to route through. More primitives with fine-grained eval modes > more backend sophistication.

**Key architectural principle:** The curriculum defines *what* to teach (skills, standards, prerequisites). The manifest resolves *how* to teach it (which primitive, which eval mode) at runtime from the live catalog. Never pre-map primitives into curriculum data — it creates a maintenance treadmill every time a primitive is added or changed.

**Lesson-entry principle:** Every Lumina lesson launches through `useExhibitSession.generate`, scoped by `preBuiltObjectives`. New lesson-selection intelligence ships as a Lesson Builder fill mode (a producer of `preBuiltObjectives`) — never as a new launch surface, page, or endpoint without a consumer. Contract + deprecation ledger: `.claude/skills/student-data-loop/SKILL.md` §7.

## Commands (verbatim — these exist because the obvious form false-passes)

All frontend commands run from `my-tutoring-app/` with an **absolute** `cd` and the **project-local binary**. Bare `npx tsc` from the repo root prints "not the tsc command you are looking for", emits no `error TS` lines, and reads as clean without compiling.

```bash
cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit        # full typecheck; compare error count to baseline, never trust 0 alone
cd "<abs>/my-tutoring-app" && npm run typecheck:lumina                 # Lumina-scoped gate; must be 0 — "tsc DID NOT RUN" means tsc didn't run
cd "<abs>/my-tutoring-app" && npm test                                 # vitest run (single file: npm test -- <path>)
cd "<abs>/my-tutoring-app" && npm run dev                              # port 3000 ONLY — see below
cd "<abs>/backend" && venv/Scripts/python -m uvicorn app.main:app --reload --port 8000   # frontend expects :8000
```

- **Never start a second `next dev`.** Probe first: `curl -s -m 120 -o /dev/null -w "%{http_code}" http://localhost:3000/api/lumina/topic-trace` (a cold server takes >5s, so `-m 5` lies). If anything listens on :3000, use it — it hot-reloads the working tree. A second instance corrupts the `.next` pack cache (every page 500s with `reading 'call'`) and can strip `node_modules/.bin`; repair with `npm install --no-audit --no-fund`, never `npm ci`.
- **`uvicorn --reload` can serve stale code** for one request after an edit. If a code-dependent call seems not to take effect, call it again.
- **Multi-line commit messages:** the Bash tool is bash, not PowerShell. Write the message to a file and `git commit -F <file>`; a PowerShell here-string leaks `@` into the subject.
- **`.env` files are pure ASCII.** python-dotenv reads strict UTF-8; PowerShell `Add-Content` writes ANSI, and one em-dash in a comment crashes backend boot with `UnicodeDecodeError`.

## Primitives

When building new primitives, always use the Gemini generator pattern — never hardcode test data. Follow the established registration pattern: component, types, catalog entry, generator, and tester. Follow the `ADDING_PRIMITIVES.md` checklist exactly. Create all files before moving to verification.

When Gemini schemas are too complex (6+ types, deeply nested), the LLM will produce malformed JSON. Simplify schemas proactively to 3-4 types max and reduce redundancy.

**Lifecycle:** primitives are built in layers, not one pass — `/primitive` births L0, each `/add-*` skill raises one layer (L5 = `/add-di-loop`, the tutor-owned judged loop), `/eval-test` closes every layer. Ladder, detection signals, and which skill owns which rung: `my-tutoring-app/src/components/lumina/docs/PRIMITIVE_LIFECYCLE.md`.

**Key skills:** `/primitive` (birth L0), `/add-eval-modes` (wire IRT), `/eval-test` (verify, agent-judged), `/oracle-test` (verify, code-judged content contracts — CI-able), `/eval-fix` (fix issues).

**Contract-first edits:** one primitive serves many skills; an edit for skill N must not ablate what skills 1..N−1 depend on. Before modifying an existing primitive's component or generator, read `my-tutoring-app/src/components/lumina/docs/contracts/<primitive-id>.md` if it exists (`/primitive-contract` derives/refreshes it; `--check` runs the edit guard). If the new demand contradicts an existing requirement, fork (eval-mode split → band gate → config axis → variant) — never edit in place over a conflict.

**Key docs:** `my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md`, `PRIMITIVE_LIFECYCLE.md`

## Project Management

Work is managed as **tasks in queues, executed by skills** — not ad-hoc orchestration.
Sessions answering "what's next" read `WORKSTREAMS.md` and pull the TOP item of an
ACTIVE stream's queue. New findings get QUEUED in the owning register with an executor
skill named — not fixed inline unless they are the active task. Whoever closes work
updates the owning queue AND `WORKSTREAMS.md` in the same slice. Queues are authority
over memory and over stale reports. Mechanics + registers: `/pm`.

## Development Workflow

### Build over ceremony

**The measure of a slice is what reaches the student, and the user reads the diff log.** Reports, queue entries, birth certificates and memories exist to make the *next* slice cheaper — when they outweigh the slice itself, overhead is being counted as output.

- **Check the ratio before writing the report.** If comments + tests + report dwarf production code, say so plainly rather than letting a well-documented small move read as a large one (one rung shipped 66 production lines under 187 of comments, 449 of tests, a 132-line report).
- **This is not anti-testing and does not touch the Verification Doctrine below** — gates still run per slice, and rationale docblocks still earn their space. It re-orders where the *remaining* effort goes: the next lever, not a fifth paragraph about this one.
- **If your own residual names the next executor skill and it is in scope, run it in the same push.** Naming a gap in a report is not closing it. Queue it only when it genuinely needs a separate decision, new data, or a user ruling.
- **A single ladder rung can be structurally low-yield.** Where `/add-support-tiers` only toggles help text and the problems stay byte-identical, the visible change is `/add-structural-difficulty` — pair them rather than shipping the rung alone.

### Verification Doctrine

A change is "fixed" or "done" only after the affected flow has been **exercised at runtime** — driven in the running app, an `/eval-test` run, or a probe with real inputs. A type check is never verification of behavior.

- **Type check (necessary, not sufficient):** run the tsc line from **Commands** above. Zero NEW errors vs. the current baseline; `typecheck:lumina` stays at 0.
- **Runtime/UI bugs (rendering, CSS, timing, mic, races):** tsc says nothing about these. Reproduce the failure, fix, then re-drive the exact flow that failed before calling it fixed.
- **If you cannot exercise the flow yourself,** say so explicitly: report *"should work — needs a browser check on \<flow\>"*, never "fixed and verified". A fix the user has to bounce back with "same issue" was not verified.
- **Close the channel, not the symptom:** when a fix removes a symptom, hunt the mechanism that produced it (index fallbacks, positional bindings, object-identity effect keys) before declaring done — otherwise it regresses.
- **Pilot-then-sweep:** never roll a pattern across generators/primitives via workflow until the pilot has been exercised at runtime, not just type-checked.

When editing React components, prefer writing complete replacement files over incremental multi-step edits. Partial edits with missing closing tags or broken JSX structure have caused repeated issues.

## UI / Styling

Primitive UI is built from the Lumina kit, never raw shadcn — full rules (kit boundary, theming fallbacks) in `my-tutoring-app/src/components/lumina/CLAUDE.md`.

## Curriculum Rules

**Draft-first rule:** NEVER edit `curriculum_published` directly. All curriculum changes go through: edit draft → `lineage-check` → publish → deploy. The publish pipeline in `draft_curriculum_service.py` is the ONLY writer to `curriculum_published`.

**Before any subskill ID change:** Create a lineage record via `POST /api/lineage/` BEFORE modifying the draft. The `curriculum_lineage` collection maps old subskill IDs to canonical successors so student data survives curriculum iteration.

## Architecture (brief)

- **Backend:** FastAPI + Firestore. Key services: CompetencyService, MasteryLifecycleEngine (4-gate model), PlanningService (stateless, Firestore-native).
- **AI:** Gemini for content generation (manifests, generators, tutoring). Gemini Live for real-time audio tutoring.
- **Manifest pipeline:** Topic → Gemini manifest (picks primitives from live catalog) → per-primitive Gemini generators → hydrated interactive content.
- **Auth:** Firebase Auth on all endpoints.
