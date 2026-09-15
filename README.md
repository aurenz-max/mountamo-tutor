<p align="center">
  <img src="docs/screenshots/home.jpg" alt="Lumina home: What will you learn about?" width="900">
</p>

<h1 align="center">Lumina</h1>

<p align="center">
  An adaptive K–5 learning platform where every topic becomes something a child can touch, build, and say out loud.<br>
  Type a topic, get an interactive lesson. Come back tomorrow, and the difficulty has moved with you.
</p>

<p align="center">
  <a href="#what-a-lesson-looks-like">Lessons</a> ·
  <a href="#the-primitives">Primitives</a> ·
  <a href="#how-it-adapts">Adaptivity</a> ·
  <a href="#the-live-tutor-and-pip">Tutor</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#repository-layout">Repo layout</a>
</p>

---

## What Lumina is

Lumina is not a worksheet generator. The unit of learning is a **primitive**: a small interactive object such as a ten frame, a fraction bar, a food web, a periodic table, or a bridge you have to build so a school bus can cross. A lesson is a sequence of primitives that Gemini picks and fills for the topic, grade, and student in front of it.

Three things make it different from a chat tutor with pictures:

- **Pedagogy first.** Primitives never reveal answers in labels, placeholders, or default state. A student cannot solve a challenge from the layout.
- **Spoken-first Direct Instruction.** For early learners the Live tutor asks, waits, judges the child's spoken answer, corrects, and its own affirmation advances the lesson. No timers, no "Next" buttons for the child to skip through.
- **Difficulty is structural, not numeric.** Each primitive exposes task identities (eval modes) with calibrated IRT difficulty priors. The adaptive engine routes through them; it never just makes the numbers bigger.

## What a lesson looks like

Type "adding fractions with the same denominator", pick a grade, and Lumina builds this in a couple of minutes: a hook, the big idea, a learning-objective ladder (identify, explain, apply), and then a run of primitives that each teach one piece.

<p align="center">
  <img src="docs/screenshots/lesson-hero.jpg" alt="Generated lesson: adding fractions with the same denominator" width="900">
</p>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/lesson-concepts.jpg" alt="Foundational concepts: numerator diagram"><br><sub><b>Identify.</b> A generated diagram with concept hotspots and a learning objective.</sub></td>
    <td width="50%"><img src="docs/screenshots/lesson-self-check.jpg" alt="Self-check with Ask Lumina"><br><sub><b>Self-check.</b> Every concept card ends in a judged question, with the tutor on call.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/lesson-fraction-bar.jpg" alt="Fraction bar primitive inside a lesson"><br><sub><b>Apply.</b> The fraction-bar primitive, seven problems, three steps each.</sub></td>
    <td><img src="docs/screenshots/lesson-worked-example.jpg" alt="Worked example on a number line"><br><sub><b>Explain.</b> A worked example the student steps through on a number line.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/lesson-say-it-out-loud.jpg" alt="Say it out loud: spoken practice"><br><sub><b>Say it out loud.</b> The Live tutor listens and judges the explanation.</sub></td>
    <td><img src="docs/screenshots/lesson-comparison.jpg" alt="Comparative analysis with generated images"><br><sub><b>Compare.</b> Side-by-side exhibits with generated imagery.</sub></td>
  </tr>
</table>

The same pipeline handles any subject. Here is the top of a science lesson on the water cycle, with Pip in the corner and the tutor controls docked at the bottom right.

<p align="center">
  <img src="docs/screenshots/lesson-water-cycle.jpg" alt="Generated lesson: the water cycle" width="900">
</p>

## The primitives

The catalog currently holds **209 primitives** with **610 eval modes** across math, literacy, science, engineering, and history. Every one is generated live by Gemini from a typed schema, rendered by a React component, and scored by an evaluation contract. None of them ship hardcoded content.

| Domain | Primitives | Examples |
|---|---:|---|
| Math | 61 | Ten frame, base-ten blocks, number line, fraction circles, area model, coordinate graph, analog clock, balance scale |
| Literacy | 38 | Phonics blender, decodable reader, letter tracing, story map, sentence builder, evidence finder, poetry lab |
| Engineering | 24 | Bridge builder, gear train, lever lab, hydraulics lab, excavator arm, paper airplane designer |
| Core exhibits | 19 | Concept cards, annotated example, comparison panel, knowledge check, interactive passage, media player |
| Biology | 17 | Habitat diorama, food web builder, life-cycle sequencer, cell builder, DNA explorer |
| Chemistry | 14 | Periodic table, states of matter, atom builder, reaction lab, pH explorer |
| Astronomy | 11 | Solar system explorer, moon phases, orbit mechanics, constellation builder |
| Direct Instruction | 10 | Tutor-owned spoken loops: deduction, worked procedure, word-problem setup, spoken practice |
| Physics, media, calendar, history, assessment | 15 | Gravity drop tower, sound wave explorer, calendar explorer, cause-and-effect chain |

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/primitive-analog-clock.jpg" alt="Analog clock primitive"><br><sub><b>Analog Clock</b> · read, set, and match times; a day-arc shows when.</sub></td>
    <td width="50%"><img src="docs/screenshots/primitive-base-ten-blocks.jpg" alt="Base ten blocks primitive"><br><sub><b>Base Ten Blocks</b> · build 348 from hundreds, tens, and ones.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/primitive-habitat-diorama.jpg" alt="Habitat diorama primitive"><br><sub><b>Habitat Diorama</b> · observe, connect, predict, restore, defend a living ecosystem.</sub></td>
    <td><img src="docs/screenshots/primitive-food-web.jpg" alt="Food web builder primitive"><br><sub><b>Food Web Builder</b> · draw the energy flow between trophic levels.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/primitive-periodic-table.jpg" alt="Periodic table primitive with Live tutor panel"><br><sub><b>Periodic Table</b> · all 118 elements, with the Live tutor connected on the right.</sub></td>
    <td><img src="docs/screenshots/primitive-solar-system.jpg" alt="Solar system explorer primitive"><br><sub><b>Solar System Explorer</b> · zoom, pan, click planets, answer out loud.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/primitive-story-map.jpg" alt="Story map primitive"><br><sub><b>Story Map</b> · identify characters and setting, then sequence the story.</sub></td>
    <td><img src="docs/screenshots/primitive-sentence-builder.jpg" alt="Sentence builder primitive with tutor transcript"><br><sub><b>Sentence Builder</b> · subject, predicate, punctuation, with the tutor's turn transcript.</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/primitive-fraction-circles.jpg" alt="Fraction circles primitive in Direct Instruction mode"><br><sub><b>Fraction Circles</b> (DI mode) · start the tutor, listen, touch the matching picture.</sub></td>
    <td><img src="docs/screenshots/primitive-bridge-builder.jpg" alt="Bridge builder primitive"><br><sub><b>Bridge Builder</b> · beams and cables across a river, load-tested by a school bus.</sub></td>
  </tr>
</table>

### How a primitive is built

Primitives are built in layers, not in one pass. Each layer is owned by one Claude Code skill in [`.claude/skills/`](.claude/skills/), and `/eval-test` closes every layer against real generations.

| Layer | What it adds | Skill |
|---|---|---|
| L0 Born | Component, Gemini generator, catalog entry, tester, answer-leak audit | `/primitive` |
| L1 Eval-dense | Task-identity ladder with IRT beta priors | `/add-eval-modes` |
| L2 Tutored | Catalog tutoring block so the Live tutor can speak about it | `/add-tutoring-scaffold` |
| L3 Tiered | `config.difficulty` withdraws scaffolding | `/add-support-tiers` |
| L4 Shaped | `config.difficulty` also changes problem shape | `/add-structural-difficulty` |
| L5 Polished | Tactile sound, and the tutor-owned spoken Direct Instruction loop | `/add-sound`, `/add-di-loop` |

Full ladder and detection signals: [`PRIMITIVE_LIFECYCLE.md`](my-tutoring-app/src/components/lumina/docs/PRIMITIVE_LIFECYCLE.md). Human reference for adding one: [`ADDING_PRIMITIVES.md`](my-tutoring-app/src/components/lumina/docs/ADDING_PRIMITIVES.md).

## How it adapts

**Eval modes are task identities, not difficulty levels.** The gravity drop tower below has six of them, from "Observe: what happened?" at kindergarten to "Calculate with h = ½gt²" at high school, each with a calibrated beta prior. The adaptive engine picks the mode; the generator constrains its schema to it.

<p align="center">
  <img src="docs/screenshots/eval-modes-gravity-drop.jpg" alt="Gravity drop tower tester showing the eval-mode ladder with beta priors" width="900">
</p>

**Daily Pulse** is the measurement beat. The planner reads the student's mastery state and prerequisite graph, then assembles today's path across subjects. Each block is a real lesson or practice set, not a quiz.

<p align="center">
  <img src="docs/screenshots/daily-pulse-plan.jpg" alt="Daily Pulse plan expanded on the home screen" width="900">
</p>

**The curriculum is the map, the manifest is the route.** The published K–5 curriculum defines skills, standards, and prerequisites. At runtime the manifest resolves which primitive and which eval mode teach a given subskill from the live catalog. Primitives are never pre-mapped into curriculum data, so adding a primitive never requires a curriculum edit.

<p align="center">
  <img src="docs/screenshots/curriculum-browser.jpg" alt="Curriculum browser: grades K–5 by subject, expanded into units" width="900">
</p>

Under the hood:

- **2PL IRT** ability estimates per skill. `MasteryLifecycleEngine` derives a four-step gate from the lower confidence bound of predicted accuracy, so evidence volume matters as much as the point estimate. Gate 4 means accuracy at the curriculum-required difficulty; a skill is only *mastered* after holding gate 4 with 30 days of earned stability.
- **PlanningService** is stateless and Firestore-native; it builds the next session from mastery state and the prerequisite graph.
- **Misconception loops**: primitives emit factual observations, a shared applicability planner decides what to adapt, and the next generation is signed with that context at launch. The backend is storage and ownership only; generation never calls back into it.
- **Learning velocity** and catch-up planning surface in the analytics and parent views.

<p align="center">
  <img src="docs/screenshots/analytics.jpg" alt="Analytics dashboard: learning velocity by subject" width="900">
</p>

## The Live tutor and Pip

Two characters share every primitive's workspace.

**The Live tutor** is a Gemini Live session over WebSocket. It sees the primitive's tutoring block (task description, context keys, scaffolding levels, common struggles) and can hear the child. In Direct Instruction primitives it owns the clock: it asks, the child answers out loud, it judges, and its affirmation is what advances the lesson.

**Pip** is the on-screen companion. Pip joins from the primitive's own events (introduce, point, receive, celebrate), never from tutor speech, so Pip works with the microphone off and never gates the child.

<p align="center">
  <img src="docs/screenshots/pip-surface.jpg" alt="Pip surface lab: Pip points at an apple on a shared tray" width="900">
</p>

Voice capture, spoken-answer judging, and the judged-loop runner are shared platform hooks (`useVoiceAnswer`, `useVoiceChoice`, `useJudgedScriptRunner`), so a primitive declares what it needs and never hand-rolls audio.

## Architecture

```text
Next.js app (my-tutoring-app)                     FastAPI backend (backend/)
────────────────────────────                      ──────────────────────────
/lumina  ─►  App.tsx + StudentProvider            Firebase Auth on every route
               │                                   │
               ├─ home, curriculum, Daily Pulse    ├─ /api/curriculum      published K–5 graph
               │                                   ├─ /api/competency      2PL ability, mastery
               └─ useExhibitSession                ├─ /api/pulse           Daily Pulse planner
                     │                             ├─ /api/mastery         4-gate lifecycle
                     ├─ curator brief              ├─ /api/problems        submissions, reviews
                     ├─ signed GenerationContext ◄─┤  (/api/student-profile/generation-context, once at launch)
                     ├─ objective-centric manifest ├─ /api/analytics       velocity, rollups
                     └─ per-primitive generators   ├─ /api/parent          parent portal
                           │                       └─ ws  lumina_tutor     Gemini Live relay
                           ▼
                     ExhibitData ─► LessonScreen ─► ManifestOrderRenderer ─► primitiveRegistry
                                          │
                                          ├─ EvaluationProvider   (judged evidence, one observation callback)
                                          ├─ LuminaAIProvider     (Live tutor session)
                                          └─ Pip surface          (event-driven companion)

Gemini: manifests, per-primitive generators, image generation, Live audio tutoring
Firestore: curriculum (draft → lineage-check → publish), students, attempts, mastery, plans
```

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind, Framer Motion, three.js, d3. Content generation runs in Next API routes (`/api/lumina/*`) against `@google/genai`.
- **Backend:** FastAPI, Firestore, `firebase-admin`, `google-genai`. Deployed with the included `Dockerfile` and `cloudbuild.yaml`.
- **Curriculum authoring** is a separate FastAPI service ([`curriculum-authoring-service/`](curriculum-authoring-service/)) with its own Next.js designer ([`curriculum-designer-app/`](curriculum-designer-app/)). The publish pipeline is the only writer to the published curriculum.

Deeper reading: [`ARCHITECTURE.md`](my-tutoring-app/src/components/lumina/ARCHITECTURE.md) (frontend map), [`MANIFEST_ARCHITECTURE.md`](my-tutoring-app/src/components/lumina/docs/MANIFEST_ARCHITECTURE.md), [`EVALUATION_PIPELINE_ARCHITECTURE.md`](my-tutoring-app/src/components/lumina/docs/EVALUATION_PIPELINE_ARCHITECTURE.md), [`backend/docs/`](backend/docs/).

## Developer tools

Every tester, lab, and bench is reachable from the bottom of the Lumina home screen. Each primitive family has a tester that runs the real Gemini generator at any grade and eval mode; the labs cover the tutor, Pip, sound, IRT simulation, misconception loops, and lesson assembly.

<p align="center">
  <img src="docs/screenshots/developer-tools.jpg" alt="Developer tools grid on the Lumina home screen" width="900">
</p>

Verification is code-judged where it can be and agent-judged where it must be:

- `/oracle-test` gives a primitive a machine-checkable content contract and runs it N times against real generations (answer-key desync, scope overruns, answer leaks, value clustering).
- `/eval-test` drives a primitive through every eval mode and difficulty tier and reports only what is broken.
- `/tutor-test` verifies a tutoring block reaches the Live tutor intact, headlessly.
- `/pulse-agent` runs synthetic student profiles through the adaptive engine without a browser.

## Getting started

### Prerequisites

- Node 20+ and Python 3.11+
- A Firebase project (Auth + Firestore) and a service-account key
- A Gemini API key with access to the Live API

### Frontend

```bash
cd my-tutoring-app
npm install --no-audit --no-fund
npm run dev                         # http://localhost:3000 (port 3000 only)
```

Create `my-tutoring-app/.env.local` with at least:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
LUMINA_BACKEND_URL=http://localhost:8000
LUMINA_GENERATION_SIGNING_KEY=          # must match the backend
GEMINI_API_KEY=
```

### Backend

```bash
cd backend
python -m venv venv && venv/Scripts/activate   # source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

`backend/.env` needs at least (ASCII only; the loader is strict UTF-8):

```text
GEMINI_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_ADMIN_CREDENTIALS_PATH=credentials/service-account.json
GCP_PROJECT_ID=
LUMINA_GENERATION_SIGNING_KEY=          # must match the frontend
SECRET_KEY=
```

### Verify

```bash
cd my-tutoring-app
./node_modules/.bin/tsc --noEmit     # full typecheck (use the project-local binary)
npm run typecheck:lumina             # Lumina-scoped gate, must be 0
npm test                             # vitest
```

Then open `http://localhost:3000/lumina`, type a topic, and pick a grade. Developer tools at the bottom of that page let you generate any single primitive without building a whole lesson.

## Repository layout

```text
my-tutoring-app/                      Next.js app (the product)
  src/app/lumina/                     entry route; ?topic=&grade= starts a lesson
  src/components/lumina/
    primitives/                       React components, one per primitive
    service/manifest/catalog/         the primitive catalog (eval modes, affordances, tutoring blocks)
    service/<domain>/                 Gemini generators and schemas
    hooks/                            judged loop, voice capture, Live tutor, exhibit session
    pip/                              Pip companion surface
    pulse/                            Daily Pulse adaptive session
    docs/                             architecture, lifecycle, PRDs, per-primitive contracts
  src/app/api/lumina/                 generation, eval-test, oracle-test, topic-trace endpoints
  qa/                                 eval reports, DI backlog, run summaries

backend/                              FastAPI + Firestore
  app/api/endpoints/                  auth, curriculum, competency, mastery, pulse, parent, tutor ws
  app/services/                       mastery lifecycle, planning, pulse engine, calibration (IRT)
  docs/                               backend and data-loop reference

curriculum-authoring-service/         draft → lineage-check → publish pipeline
curriculum-designer-app/              Next.js UI for curriculum authors
content-pipeline/                     content ops and evaluation scripts
.claude/skills/                       the build, verify, and PM skills used to grow the catalog
WORKSTREAMS.md                        active work queues
CLAUDE.md                             project rules for AI-assisted development
```

## Contributing

Work is tracked as queued tasks in [`WORKSTREAMS.md`](WORKSTREAMS.md) and executed by the skills in [`.claude/skills/`](.claude/skills/). The rules that keep the catalog coherent (answer-leak audits, contract-first edits, structural difficulty, spoken-first DI) are in [`CLAUDE.md`](CLAUDE.md) and [`my-tutoring-app/src/components/lumina/CLAUDE.md`](my-tutoring-app/src/components/lumina/CLAUDE.md). A change counts as done only after the affected flow has been exercised at runtime; a green typecheck is necessary, not sufficient.

## License

MIT. See [LICENSE](LICENSE).
