# CLAUDE.md

## Product Philosophy

This is Lumina — an adaptive learning platform where students interact with visual primitives, not worksheets. The primitives ARE the product. Everything else (backend, curriculum service, planning engine) exists to serve the right primitive to the right student at the right difficulty at the right time.

**What matters most, in order:**
1. **Pedagogy** — Every primitive must teach something real. Never reveal answers in placeholder text, labels, or default UI state. Students should not be able to trivially solve challenges from visual layout or default values. If a primitive isn't pedagogically sound, it ships nothing.
2. **Primitive quality** — Tight interaction loops, clear feedback, smooth difficulty progression. Use `/primitive` to build, `/add-eval-modes` to wire IRT difficulty, `/eval-test` to verify.
3. **Content density** — The adaptive engine only works when there's enough content to route through. More primitives with fine-grained eval modes > more backend sophistication.

**Key architectural principle:** The curriculum defines *what* to teach (skills, standards, prerequisites). The manifest resolves *how* to teach it (which primitive, which eval mode) at runtime from the live catalog. Never pre-map primitives into curriculum data — it creates a maintenance treadmill every time a primitive is added or changed.

**Lesson-entry principle:** Every Lumina lesson launches through `useExhibitSession.generate`, scoped by `preBuiltObjectives`. New lesson-selection intelligence ships as a Lesson Builder fill mode (a producer of `preBuiltObjectives`) — never as a new launch surface, page, or endpoint without a consumer. Contract + deprecation ledger: `.claude/skills/student-data-loop/SKILL.md` §7.

## Primitives

When building new primitives, always use the Gemini generator pattern — never hardcode test data. Follow the established registration pattern: component, types, catalog entry, generator, and tester. Follow the `ADDING_PRIMITIVES.md` checklist exactly. Create all files before moving to verification.

When Gemini schemas are too complex (6+ types, deeply nested), the LLM will produce malformed JSON. Simplify schemas proactively to 3-4 types max and reduce redundancy.

**Lifecycle:** primitives are built in layers, not one pass. `/primitive` births at L0 (sound, measurable, single core mode) and ends with a birth certificate + follow-up queue; the add- skills raise it one layer each (`/add-eval-modes` L1 → `/add-tutoring-scaffold` L2 → `/add-support-tiers` L3 → `/add-structural-difficulty` L4 → `/add-sound`, `/add-spoken-judge`, `/add-voice-control` L5), with `/eval-test` closing every layer. Ladder + detection signals: `my-tutoring-app/src/components/lumina/docs/PRIMITIVE_LIFECYCLE.md`.

**Key skills:** `/primitive` (birth L0), `/add-eval-modes` (wire IRT), `/eval-test` (verify, agent-judged), `/oracle-test` (verify, code-judged content contracts — CI-able), `/eval-fix` (fix issues).

**Contract-first edits:** one primitive serves many skills; an edit for skill N must not ablate what skills 1..N−1 depend on. Before modifying an existing primitive's component or generator, read `my-tutoring-app/src/components/lumina/docs/contracts/<primitive-id>.md` if it exists (`/primitive-contract` derives/refreshes it; `--check` runs the edit guard). If the new demand contradicts an existing requirement, fork (eval-mode split → band gate → config axis → variant) — never edit in place over a conflict.

**Key docs:** `my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md`, `PRIMITIVE_LIFECYCLE.md`

## Project Management

Work is managed as **tasks in queues, executed by skills** — not ad-hoc orchestration.
`WORKSTREAMS.md` (repo root) is the portfolio index: ACTIVE/DELEGATED/PARKED streams,
WIP limit 2+1, each stream pointing at its queue file. Sessions answering "what's next"
read `WORKSTREAMS.md` and pull the TOP item of an ACTIVE stream's queue; new findings
get QUEUED in the owning register (reader-fit BACKLOG, EVAL_TRACKER, SP-27 PRD phases,
HUMAN-CHECKS) with an executor skill named — not fixed inline unless they are the active
task. Whoever closes work updates the owning queue AND `WORKSTREAMS.md` in the same
slice. `/pm` runs the reconciliation function (staleness sweep, human-check refresh,
WIP enforcement, next-3-moves plan); queues are authority over memory and over stale
reports. Human-only browser/pixel verification debt lives in
`my-tutoring-app/qa/HUMAN-CHECKS.md`, never buried in per-stream Done entries.

## Development Workflow

### Verification Doctrine

A change is "fixed" or "done" only after the affected flow has been **exercised at runtime** — driven in the running app, an `/eval-test` run, or a probe with real inputs. A type check is never verification of behavior.

- **Type check (necessary, not sufficient):** run exactly `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — project-local binary with an absolute path. Bare `npx tsc --noEmit` from the repo root false-passes without compiling anything. Zero NEW errors vs. the current baseline.
- **Runtime/UI bugs (rendering, CSS, timing, mic, races):** tsc says nothing about these. Reproduce the failure, fix, then re-drive the exact flow that failed before calling it fixed.
- **If you cannot exercise the flow yourself,** say so explicitly: report *"should work — needs a browser check on \<flow\>"*, never "fixed and verified". A fix the user has to bounce back with "same issue" was not verified.
- **Close the channel, not the symptom:** when a fix removes a symptom, hunt the mechanism that produced it (index fallbacks, positional bindings, object-identity effect keys) before declaring done — otherwise it regresses.
- **Pilot-then-sweep:** never roll a pattern across generators/primitives via workflow until the pilot has been exercised at runtime, not just type-checked.

When editing React components, prefer writing complete replacement files over incremental multi-step edits. Partial edits with missing closing tags or broken JSX structure have caused repeated issues.

## UI / Styling

Lumina has a UI kit at `my-tutoring-app/src/components/lumina/ui/` (glass aesthetic): `LuminaCard`, `LuminaButton`, `LuminaPanel`, `LuminaAccordion`, `LuminaPrompt`, `LuminaFeedbackCard`, `LuminaAnswerChoice`, `LuminaChallengeCounter`, `LuminaMicListener`, and more — see `ui/index.ts` and design tokens in `ui/tokens.ts`.

**IMPORTANT: build primitive UI from the Lumina kit — not raw shadcn, not custom div patterns.** `/migrate-primitive` exists to move older raw-shadcn primitives onto the kit; never author new code that would need migrating.

**The kit is the frame only, never the interaction surface.** Headers, cards, buttons, feedback, counters, prompts come from the kit; the core manipulative (canvas, draggable objects, simulation) is bespoke per primitive.

For surfaces the kit doesn't cover, fall back to shadcn/ui with Lumina theming: glass `bg-slate-900/40 border-white/10 backdrop-blur-xl`, text `text-slate-100` (primary) / `text-slate-400` (secondary) / `text-slate-600` (muted).

## Curriculum Rules

**Draft-first rule:** NEVER edit `curriculum_published` directly. All curriculum changes go through: edit draft → `lineage-check` → publish → deploy. The publish pipeline in `draft_curriculum_service.py` is the ONLY writer to `curriculum_published`.

**Before any subskill ID change:** Create a lineage record via `POST /api/lineage/` BEFORE modifying the draft. The `curriculum_lineage` collection maps old subskill IDs to canonical successors so student data survives curriculum iteration.

## Development Commands

### Frontend (Next.js)
- `cd my-tutoring-app && npm run dev` - Start development server
- `cd my-tutoring-app && npm run build` - Build for production
- `cd my-tutoring-app && npm run lint` - Run ESLint

### Backend (FastAPI)
- `cd backend && uvicorn app.main:app --reload` - Start development server
- `cd backend && python -m pytest tests/` - Run backend tests

## Architecture (brief)

- **Frontend:** Next.js 14 + React + TypeScript + shadcn/ui. Lumina primitives live in `my-tutoring-app/src/components/lumina/`.
- **Backend:** FastAPI + Firestore + BigQuery (analytics only). Key services: CompetencyService, MasteryLifecycleEngine (4-gate model), PlanningService (stateless, Firestore-native).
- **AI:** Gemini for content generation (manifests, generators, tutoring). Azure Speech for TTS. Gemini Live for real-time audio tutoring.
- **Manifest pipeline:** Topic → Gemini manifest (picks primitives from live catalog) → per-primitive Gemini generators → hydrated interactive content.
- **Auth:** Firebase Auth on all endpoints.
