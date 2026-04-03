# CLAUDE.md

## Product Philosophy

This is Lumina — an adaptive learning platform where students interact with visual primitives, not worksheets. The primitives ARE the product. Everything else (backend, curriculum service, planning engine) exists to serve the right primitive to the right student at the right difficulty at the right time.

**What matters most, in order:**
1. **Pedagogy** — Every primitive must teach something real. Never reveal answers in placeholder text, labels, or default UI state. Students should not be able to trivially solve challenges from visual layout or default values. If a primitive isn't pedagogically sound, it ships nothing.
2. **Primitive quality** — Tight interaction loops, clear feedback, smooth difficulty progression. Use `/primitive` to build, `/add-eval-modes` to wire IRT difficulty, `/eval-test` to verify.
3. **Content density** — The adaptive engine only works when there's enough content to route through. More primitives with fine-grained eval modes > more backend sophistication.

**Key architectural principle:** The curriculum defines *what* to teach (skills, standards, prerequisites). The manifest resolves *how* to teach it (which primitive, which eval mode) at runtime from the live catalog. Never pre-map primitives into curriculum data — it creates a maintenance treadmill every time a primitive is added or changed.

## Primitives

When building new primitives, always use the Gemini generator pattern — never hardcode test data. Follow the established registration pattern: component, types, catalog entry, generator, and tester. Follow the `ADDING_PRIMITIVES.md` checklist exactly. Create all files before moving to verification.

When Gemini schemas are too complex (6+ types, deeply nested), the LLM will produce malformed JSON. Simplify schemas proactively to 3-4 types max and reduce redundancy.

**Key skills:** `/primitive` (build new), `/add-eval-modes` (wire IRT), `/eval-test` (verify), `/eval-fix` (fix issues).

**Key docs:** `my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md`

## Development Workflow

This is a TypeScript project. Always ensure edits compile cleanly before considering a task done. Run `npx tsc --noEmit` after significant changes to catch type errors early rather than discovering them after multiple edits.

When editing React components, prefer writing complete replacement files over incremental multi-step edits. Partial edits with missing closing tags or broken JSX structure have caused repeated issues.

## UI / Styling

This project uses a Lumina design system with glass card styling built on shadcn/ui components.

**IMPORTANT: Always use shadcn/ui components with Lumina theming for primitives.** Do not create custom div-based UI patterns.

**Lumina theming pattern:**
- Cards: `<Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">`
- Buttons: `<Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10">`
- Accordions: Use `<Accordion>` for expandable sections instead of custom state management
- Text colors: `text-slate-100` (primary), `text-slate-400` (secondary), `text-slate-600` (muted)

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
