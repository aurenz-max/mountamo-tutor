# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Primitives

When building new primitives, always use the Gemini generator pattern — never hardcode test data. Follow the established registration pattern: component, types, catalog entry, generator, and tester. When implementing new primitives or components, follow the existing ADDING_PRIMITIVES checklist exactly. Create all files before moving to verification. Do not skip steps or deviate from the documented pattern.

Never reveal answers in placeholder text, labels, or default UI state. All educational primitives must be pedagogically sound — students should not be able to trivially solve challenges from visual layout or default values.

When Gemini schemas are too complex (6+ types, deeply nested), the LLM will produce malformed JSON. Simplify schemas proactively to 3-4 types max and reduce redundancy.

## Development Workflow

This is a TypeScript project. Always ensure edits compile cleanly before considering a task done. Run `npx tsc --noEmit` after significant changes to catch type errors early rather than discovering them after multiple edits.

## Code Editing Conventions

When editing React components, prefer writing complete replacement files over incremental multi-step edits. Partial edits with missing closing tags or broken JSX structure have caused repeated issues.

## UI / Styling

This project uses a Lumina design system with glass card styling built on shadcn/ui components.

**IMPORTANT: Always use shadcn/ui components with Lumina theming for primitives.** Do not create custom div-based UI patterns.

**Lumina theming pattern:**
- Cards: `<Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">`
- Buttons: `<Button variant="ghost" className="bg-white/5 border border-white/20 hover:bg-white/10">`
- Accordions: Use `<Accordion>` for expandable sections instead of custom state management
- Text colors: `text-slate-100` (primary), `text-slate-400` (secondary), `text-slate-600` (muted)

See `my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md` for complete guidelines.

## Planning & Mastery System (backend)

The planning engine is a tightly coupled set of services built on a **4-gate mastery lifecycle** model. All state lives in Firestore — no LLM, no BigQuery, no stored plans. See `backend/docs/PLANNING_ARCHITECTURE.md` for the full architecture.

**Gate model:** Gate 0 (not started) → 1 (initial mastery, 3 lesson evals >= 9.0) → 2 (+3d retest) → 3 (+7d retest) → 4 (+14d retest, closed/mastered). Failed retests reset to a shorter interval. Completion % uses actuarial credibility blending (subskill pass rate + global rate, weighted by Z = attempts / 10).

**Key services:**
- `MasteryLifecycleEngine` — processes eval results, manages gate transitions. Entry: `process_eval_result()`. Called as hook from `CompetencyService.update_competency_from_problem()`.
- `PlanningService` — stateless planner reading live Firestore. Produces weekly pacing, monthly forward simulation, and daily session queues.

**Daily plan flow:** reviews first (85% cap, sorted by overdue + lowest gate), then new skills from `LearningPathsService` prerequisites, proportional to weekly deficit per subject. Sessions interleaved: new blocks in front 60%, reviews subject-alternated, tail 40% for lighter reviews.

**Monthly projection:** pipeline delay model (4/5/6 week closure lags for optimistic/best/pessimistic), 3 lesson sessions per new intro, reviews at weeks +1/+2/+4 after introduction. Produces per-subject confidence bands and early-warning flags.

**Key files:** `planning_service.py`, `mastery_lifecycle_engine.py`, `models/planning.py`, `models/mastery_lifecycle.py`, `endpoints/weekly_planner.py`, `endpoints/daily_activities.py`, `endpoints/mastery.py`.

**PRD references:** §2 (lifecycle subcollection), §3 (gate transitions), §4 (completion factor), §5 (planning), §7 (gate blocking/prerequisites), §8 (session interleaving).

## Development Commands

### Frontend (Next.js)
- `cd my-tutoring-app && npm run dev` - Start Next.js development server
- `cd my-tutoring-app && npm run build` - Build for production
- `cd my-tutoring-app && npm run start` - Start production server
- `cd my-tutoring-app && npm run lint` - Run ESLint

### Backend (FastAPI)
- `cd backend && uvicorn app.main:app --reload` - Start FastAPI development server
- `cd backend && python -m pytest tests/` - Run backend tests
- Backend dependencies installed via `pip install -r requirements.txt`

## Architecture Overview

This is a full-stack educational platform with an AI-powered tutoring system:

### Backend (`/backend`)
- **FastAPI** server providing REST APIs and WebSocket connections
- **Core Services**:
  - `CompetencyService` - Student progress tracking and skill assessment
  - `MasteryLifecycleEngine` - 4-gate mastery lifecycle, gate transitions, completion factor
  - `PlanningService` - Stateless weekly/daily/monthly planner (Firestore-native, no LLM)
  - `TutoringService` - Real-time WebSocket tutoring sessions with audio
  - `ProblemService` - Adaptive problem generation based on competency
  - `LearningPathsService` - Skill progression and prerequisite graph (decision trees)
  - `EducationService` - Educational content management and delivery
  - `BigQueryAnalyticsService` - Analytics using BigQuery for scalable data processing
- **AI Integration**: Gemini AI for tutoring conversations, problem generation, and Gemini Live for real-time audio interaction
- **Audio Processing**: Azure Speech Service for TTS, real-time audio streaming via WebSocket
- **Database**: BigQuery for analytics (replaced PostgreSQL), CosmosDB for session storage

### Key Backend Endpoints
- **Analytics**: `/analytics/*` - BigQuery-powered analytics with caching, student progress metrics, competency analysis
- **Competency**: `/competency/*` - Student skill tracking, progress updates, curriculum structure
- **Curriculum**: `/curriculum/*` - Educational content structure and problem types
- **Daily Activities**: `/daily-activities/*` - Algorithmic daily session queue (Firestore-native)
- **Weekly Planner**: `/weekly-planner/*` - Pacing snapshots and monthly forward projections
- **Mastery**: `/mastery/*` - Mastery lifecycle CRUD, eval processing, summaries, forecasts
- **Learning Paths**: `/learning-paths/*` - Prerequisite graph and skill unlock logic


### Frontend (`/my-tutoring-app`)
- **Next.js 14** with React and TypeScript
- **UI Components**: Radix UI with Tailwind CSS and shadcn/ui
- **Key Features**:
  - Real-time tutoring interface with WebSocket connections
  - Audio capture and streaming for voice interaction
  - Interactive problem workspace with visual scenes
  - Student analytics dashboard with progress tracking
  - Learning path visualization and curriculum explorer

### Critical Frontend Components

#### Dashboard (`/src/components/dashboard/`)
- `AICoach.tsx` - Sidebar AI coach with voice interaction using Gemini Live
- `EnhancedLearningDashboard.tsx` - Main student dashboard with progress overview
- `SubskillLearningHub.tsx` - Focused learning interface for specific skills
- `DailyBriefingComponent.tsx` - Daily learning plan presentation
- `ActivityCard.tsx` - Individual learning activity components


#### Practice (`/src/components/practice/`)
- `ProblemSet.tsx` - Interactive problem solving interface
- `DrawingWorkspace.tsx` - Canvas-based drawing workspace for math problems
- `SyllabusSelector.tsx` - Curriculum navigation and selection
- `LoadingOverlay.tsx` - Loading states for practice sessions

#### Key Libraries and Hooks (`/src/lib/`)
- `authApiClient.ts` - Authenticated API client for backend communication
- `packages/api.ts` - Package-specific API methods with authentication
- `packages/hooks.ts` - React hooks for package data management
- Audio services: `AudioCaptureService.ts`, `TutoringWebSocket.ts`
- Analytics: `studentAnalyticsAPI.ts`, `use-student-analytics.tsx`

### Key Integration Points
- **WebSocket Tutoring**: Bidirectional real-time communication between frontend and backend
- **Audio Pipeline**: Browser → MediaRecorder → WebSocket → Azure Speech/Gemini → Audio playback
- **Mastery Pipeline**: CompetencyService → MasteryLifecycleEngine → Firestore lifecycle docs → PlanningService reads on-demand
- **BigQuery Analytics**: Replaces PostgreSQL for scalable analytics and reporting
- **Package System**: Content delivery system for structured learning materials

### Development Notes
- The tutoring system requires microphone permissions and WebSocket support
- Audio processing uses 16kHz sample rate for optimal speech recognition
- BigQuery is used for all analytics (PostgreSQL deprecated)
- Session state is managed through React hooks and context providers
- Backend uses concurrent handlers for different WebSocket message types
- Authentication required for all API endpoints via Firebase Auth
- Package system supports filtering by subject, skill, and status

### Testing and Deployment
- Frontend testing with Next.js built-in tools
- Backend testing with pytest framework
- Production deployment expects environment variables for Azure Speech, CosmosDB, BigQuery, and Gemini AI credentials