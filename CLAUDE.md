# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
  - `TutoringService` - Real-time WebSocket tutoring sessions with audio
  - `ProblemService` - Adaptive problem generation based on competency
  - `LearningPathsService` - Skill progression recommendations via decision trees
  - `EducationService` - Educational content management and delivery
  - `BigQueryAnalyticsService` - Analytics using BigQuery for scalable data processing
  - `DailyActivitiesService` - Personalized daily learning plans
- **AI Integration**: Gemini AI for tutoring conversations, problem generation, and Gemini Live for real-time audio interaction
- **Audio Processing**: Azure Speech Service for TTS, real-time audio streaming via WebSocket
- **Database**: BigQuery for analytics (replaced PostgreSQL), CosmosDB for session storage

### Key Backend Endpoints
- **Analytics**: `/analytics/*` - BigQuery-powered analytics with caching, student progress metrics, competency analysis
- **Competency**: `/competency/*` - Student skill tracking, progress updates, curriculum structure
- **Curriculum**: `/curriculum/*` - Educational content structure and problem types
- **Daily Activities**: `/daily-activities/*` - Personalized daily learning plans using BigQuery recommendations
- **Education**: `/education/*` - Core educational content delivery and management
- **Learning Paths**: `/learning-paths/*` - Skill progression recommendations via decision trees
- **Packages**: `/packages/*` - Content package management and delivery

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

#### Packages (`/src/components/packages/`)
- Content package management system for educational materials
- Integration with backend package endpoints
- Support for filtering, searching, and organizing learning content

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
- **Competency System**: Session performance updates student skill assessments via BigQuery
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