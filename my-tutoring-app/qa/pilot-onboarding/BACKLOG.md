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

## DEPLOY STATE — ✅ DONE 2026-08-11 (the whole checklist, same day it was filed)

**The 08-10 blocker is closed. Prod is real: frontend on Vercel, backend on
Cloud Run, and a real account minted through the live site.**

- **Backend is UP** at `https://mountamo-education-869605204378.us-east5.run.app`.
  Verified from the public endpoints: `/` returns the v4.0.0 welcome, `/docs`
  serves, and `/api/auth/invite/{bogus}` answers `{"valid":false,"reason":
  "not_found"}` — prod FastAPI reaching prod Firestore, not just booting.
- **The `--set-env-vars` footgun did NOT bite.** Secrets survived (Firestore
  answers), so the deploy either preserved them or set them explicitly.
- **`NEXT_PUBLIC_API_BASE_URL` took.** Zero `http://localhost:8000` across
  9.4MB of deployed JS (that fallback WAS the whole 08-10 defect); the bundle
  carries the run.app URL.
- **✅ USER DROVE THE REAL FLOW END-TO-END** on the live site with a real
  invite — a `test1grade3` account exists in Firestore, **and the profile
  carries grade 3, confirmed in Settings.** This is the runtime verification
  the 08-10 probe could not give (the probe drove the API, not the form).
- **~~Browser pass owed~~ → ✅ HUMAN-CHECKS #88 STRUCK 2026-08-11.** The
  invited grade landing on the profile is the mechanism slice 1 fixed
  (`students/{id}.grade_level` unwritten → first-doc-wins scan to Grade 1),
  and it survived `f4facf5` (the literal `"3"` vs `3rd` vocabulary bug) too.
  **Invite #1 is UNBLOCKED.**

### ⚠️ Residuals — small, but fix before the family session

1. **Service name mismatch.** It deployed as **`mountamo-education`**;
   `cloudbuild.yaml` names **`ai-tutor-backend`**. The next `gcloud builds
   submit` will target a service that isn't the live one. Reconcile the yaml
   (or the service) before deploying again — and note the `--set-env-vars`
   caveat still applies to whichever name wins.
2. **Cold start ~18s** on the first request (measured). That is a long time
   for a seven-year-old's first click, and Cloud Run will scale to zero
   between sessions. Consider `--min-instances=1` for the pilot window.
3. **`probe_invite_flow.py --base-url <prod>` has NOT been run against prod.**
   The user's live drive supersedes most of it, but the probe also checks
   single-use redemption and the invite-grade-beats-form write. ⚠️ It creates
   and deletes a real Firebase user — running it against prod is fine only
   with `--keep` OFF, and it is rate-limited 3/5min per IP.
4. **Curl reads `/login` as a Next error shell.** This is EXPECTED, not a
   defect: `useSearchParams()` without a `<Suspense>` boundary makes Next bail
   out of prerendering, so the static HTML is an error-boundary shell that
   hydrates into the real form in a browser. **Recorded because it cost this
   run a wrong call** — a server-response artifact was read as a user-visible
   failure, and the page was never actually loaded. Any future headless check
   of `/login` must assert on the hydrated DOM, not the served HTML.
- Backend CORS already allows `*.vercel.app` (regex, main.py).
- `INVITE_REQUIRED_FOR_SIGNUP` defaults ON — prod signup is gated.

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
