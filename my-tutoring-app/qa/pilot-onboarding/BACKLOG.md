# Pilot Onboarding — Queue

Lane opened by user 2026-08-10: a real pilot family (friend's daughter, starting
school) gets an invite-only Lumina account; the platform owner needs to see what
happened in her sessions and gather feedback. Queue is authority; strike items
here AND update WORKSTREAMS.md in the same slice.

## SHIPPED (slice 1, 2026-08-10 — invite-gated signup)

Firebase Auth has no native invite codes; ours are a Firestore collection
(`invite_codes`) validated at the one place accounts are minted,
`POST /api/auth/register` (the client never calls `createUserWithEmailAndPassword`).

- `backend/app/services/invite_service.py` — mint / validate / transactional redeem.
- `POST /api/auth/register` — 403s without a valid code while
  `INVITE_REQUIRED_FOR_SIGNUP` (config, default **ON**); invite's `grade_level`
  is authoritative over the form dropdown.
- **Bug fixed in the same path:** register now write-throughs
  `students/{id}.grade_level` to Firestore. Before this, a brand-new K signup
  planned against the **Grade 1** graph (first-doc-wins lexicographic scan).
- `GET /api/auth/invite/{code}` — powers the `/login?mode=signup&invite=CODE`
  deep link: greets the child by name, locks the pre-provisioned grade.
- `backend/scripts/mint_invite.py` — `--grade K --name "Ava" --note ...`,
  `--list`, `--revoke`. Prints the link to send.
- Verified at runtime: `backend/scripts/probe_invite_flow.py` 6/6 against the
  live backend (403 without code, 200 with, code single-use, invite grade `1st`
  beat form `K` on `students/{id}`). **Browser pass on the signup form itself
  still owed — needs a human sitting (drive the deep link end-to-end).**

## QUEUE

1. **Lesson session record (the "decipher what happened" backbone).**
   A normal lesson writes NO server-side session document — which primitives
   were served, in what order, exists only in browser memory.
   `EvaluationContext.getSessionSummary()` already computes the exact payload
   and `POST /api/evaluations/session-summary` is a deliberately-deferred stub
   (`evaluations.py` docstring). Executor: direct slice — register the route,
   persist to `students/{id}/lumina_sessions/{session_id}`, and add `session_id`
   to `convertToProblemSubmission` → attempt `additional_data` so every attempt
   is groupable into its lesson. Without this, pilot reconstruction = joining
   attempts by timestamp proximity.
2. **In-lesson feedback capture.** Greenfield — zero feedback UI exists
   (searched: no thumbs/report/rating anywhere in lumina; no backend route).
   Attach points: `ExhibitCompleteFooter` / `LessonSummary`, carrying the
   `EvaluationContext.sessionId`. Two channels, one POST: kid-facing emoji
   scale ("how was that?") + optional parent free-text note. Store beside the
   session record from item 1 (do item 1 first).
3. **Pilot observer digest.** What the owner opens after the daughter's
   session. Today: `StudentActivityPanel` + `GET /api/analytics/student/{id}/recent-activity-detailed`
   exist but 403 across accounts unless `ALLOW_ANY_STUDENT_ANALYTICS` is set.
   Executor: script first (`scripts/pilot_digest.py --student N --since 48`),
   joining attempts + reviews (full metrics blobs) + sessions + feedback from
   items 1–2 into a dated markdown report Claude can read and narrate
   (what was served, where she struggled, what she said about it). Decide the
   analytics-flag question there (per-observer allowlist beats a global flag).
4. **WATCH (blocks wider invites, fine for one trusted family):**
   `POST /api/parent/link-student` has a literal `# TODO` where verification
   should be — any signed-in user can link any numeric student_id and read that
   student's dashboard. Also: `/lumina` has no client route guard (backend 401s
   are the only fence), and client-side runtime errors in lessons go
   console-only. None of these bite while every account holder is trusted;
   items 1–3 outrank them for the pilot. Close #4 before invite #2 goes out.
