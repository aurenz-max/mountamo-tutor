# Place-value misconception opportunities

Status: implemented behind an empty reviewed-objective allowlist; production acceptance open.

The place-value score/tag shortcut is removed immediately, including for legacy records. Other primitive families keep their current policy. Ordinary attempts, scoring, competency, IRT, lifecycle and review fan-out retain their existing path. Optional evidence validation runs afterwards and cannot fail the learning submission.

## Authority and identity

Firestore persists backend-owned hypotheses in the existing `students/{student}/misconceptions/place-value-chart::{skill}` slot. New place-value writes have a stable random `hypothesis_id`, monotonically increasing `revision`, and `scope_context` (canonical subject, grade, skill, source subskill and published curriculum version). Re-diagnosis replaces the slot in a transaction. Curriculum parent IDs come from the published subskill index and lineage resolver, never string slicing. Missing grade, parent or version abstains from capture. Existing records without this identity remain active but cannot earn resolution credit until re-diagnosed with canonical scope.

The existing client diagnosis text is still an observation submitted by an authenticated learner; this slice does not turn it into an independently attested clinical or mathematical diagnosis. The backend owns identity, revisions and transitions. A narrow code resolver on the generation server recognizes the reviewed face-value-for-worth capability; issuance records that type on the hypothesis. Client-supplied type, revision or resolved state is not accepted as authority.

The Next.js production generation boundary fetches the active revision before generation and certifies **the registry's generated output**, using the same compiler as the component. It never certifies a posted activity payload. Request-local credentials use AsyncLocalStorage; they do not enter config, logs or generated data.

Two backend routes (`misconception-opportunity-context`, `misconception-opportunities`) require both ordinary Firebase learner authentication and a service HMAC. `LUMINA_GENERATION_SIGNING_KEY` must be a separate server-only secret of at least 32 characters, configured on both services. It is never `NEXT_PUBLIC`. HMAC covers route, timestamp, learner Authorization header and exact request bytes; clock tolerance is 60 seconds. `LUMINA_BACKEND_URL` selects the trusted backend (default localhost:8000). No appropriate existing service credential was found; this introduces a dedicated, disabled-by-default boundary rather than elevating a learner token. Transport must use HTTPS outside local development. Replaying an issuance signature can mint redundant receipts within the freshness window, but all bind the same revision and cannot produce a second transition.

Private records live in `students/{student}/misconception_opportunities/{random UUID}` and contain student, generation-request lesson UUID, component instance, hypothesis revision, capability/policy/compiler versions, canonical objective, SHA-256 content projection and compiled item verification data. Issuance atomically checks the active revision. The child data receives an opaque reference, generation lesson UUID, and public grade/version context, without diagnosis or eligible-item metadata. The lesson UUID identifies the server build request, not a new lesson launcher or the separately minted evaluation session ID.

Published scope revision combines `version_id` and `deployed_at`: the draft publisher copies the former but advances the latter on every publication. Missing either fails closed. The reviewed-objective allowlist uses this combined value.

## Policy: place-value-immediate-retest-v1

This is a bounded product-policy choice for `digit_face_value_for_worth` v1:

- compare / medium / Grade 4, whole numbers, the reviewed canonical objective/version and its allowed range;
- exactly two eligible compiled `say_value` items using the same nonzero digit in different legal non-ones places (tens and hundreds);
- every compiled item presented and completed in order;
- both eligible items answered correctly on their first voiced response, with an agreeing transcript and tutor affirmation bound to the same timed voice turn, without tutor-audio overlap;
- no correction, retry, replay, resync, unavailable judgment or extra response on either eligible item;
- a failed diagnostic item vetoes resolution regardless of the session average; no cross-session accumulation.

Two responses test the two contexts of this specific contrast. This threshold is not universal, durable mastery, delayed transfer, or a replacement for IRT. A successful retest resolves only the current hypothesis revision. Transcript disagreement, missing transcription, out-of-order events and unknown items abstain. A correct repetition after correction cannot qualify. This deliberately favors abstention when the voice event stream is ambiguous.

The browser computes a hash of the mounted activity projection (mode, tier, ordered challenge IDs, numbers and place bounds). The backend compares it with the stored compiler plan and checks the canonical scope against the current published version. The hash covers instructional structure, not decorative title/description or unused click-era choices. It detects accidental substitution; it does **not** attest honest browser execution. Runtime events, transcriptions and judgments remain client-reported observations and can be forged by a modified client. No standalone `independent` boolean is accepted.

Resolution reads the hypothesis and receipt in one Firestore transaction and writes resolution plus the canonical attempt ID and consumed receipt together. Re-diagnosis contends on the same hypothesis document. A consumed receipt cannot resolve again, even with another attempt ID. Optional storage failure returns the normal learning result; it does not trigger a fan-out retry. This does not retrofit universal HTTP submission idempotency: the pre-existing canonical endpoint creates a fresh attempt ID on a separately repeated submission.

## Rollout and remaining gates

`REVIEWED_OBJECTIVES` contains Grade 4 `NBT004-01-b` at published revision `98202434-e96c-42ed-8c8e-6fd801b451ef@2026-06-09T03:49:30.592858`, limited to 1111–9999. Its place/name/value objective allows whole numbers through one million; this retest samples a compatible subset and does not establish full-range mastery. Grade 3 `NBT003-02-a` remains ineligible because it requires three-digit numbers. No curriculum or mode band was changed. Canonical scope is rechecked on issuance and submission; republishing invalidates old receipts. Generation without signing credentials, canonical scope, an active revision or sufficient compiled opportunities continues normally without credit.

The deployed Firestore rules were retrieved through the Firebase Rules API: ruleset `518d3ad9-c7fb-4f26-8f09-bfb4ed5eed4f` denies direct client access to the students tree. A disposable Firebase user received HTTP 403 for both direct read and write attempts on its private hypothesis. Dedicated signing is configured locally; actual Firebase authentication and signed Next issuance pass. Deployment configuration beyond the local environment remains unchanged.

Real authenticated issuance → mounted response → canonical submission → Firestore transition remains an acceptance gate. A disposable-student real Firestore probe now verifies issuance, competing consumers, wrong-response veto and stale-revision rejection, with synthetic observations and verified cleanup. It does not prove HTTP execution or microphone behavior. Existing HUMAN-CHECKS #113/#63 remain open. Submission-level retry safety remains implementation work: receipt idempotence alone does not prevent duplicate normal learning fan-out.

## Amendment 2026-09-14 — launch packet replaces the signed reads

User direction: the backend is storage, learner ownership and curriculum scope resolution; the pipeline lives on the frontend. Applied:

- `misconception-opportunity-context` and `learning-observation-context` are removed. `/generation-context` (the existing launch read) returns one HMAC-signed packet: the owner's deliverable hypotheses (stamped scope, lineage-resolved skill, `hypothesis_id`/`revision`, bounded evidence) and each lesson objective's live published scope. Key, prefix `lumina-learning-observations:v1\n`, TTL 2 hours.
- The packet travels client → build-stream → `withGenerationRequest`, which verifies it once with the same key. The retest consumer reads its own hypothesis from the packet at exactly the task's live scope (`retestHypothesis`); `misconception-opportunities` (issuance) is the only signed generation-server route left, and it still re-resolves the scope and validates the plan against the stored hypothesis. Resolution at submission is unchanged.
- A client can read the packet it carries (the owner already sees this prose in the profile projection) but cannot edit or forge it; a packet without the key is null and generation runs unadapted. `hypothesis_id`/`revision` in the packet grant no authority: no learner route accepts them.
- Verified: backend 78/78 across the observation and misconception sets; `learningObservationPacket.test.ts` + eight ported delivery suites; number-tracer replay with a Python-signed packet (2/2 adapted, 0 backend calls, controls unadapted); generic authenticated smoke. Report: `qa/misconception/launch-packet-delivery-2026-09-14.md`.

## Amendment 2026-09-13 — primitive-agnostic backend

User ruling: production backend code must not require primitive-specific logic (50+ math primitives, 200+ overall). Applied to this contract:

- `REVIEWED_OBJECTIVES`, the capability/policy/compiler constants and the `say_value` item arithmetic are gone from the backend. `validate_plan` binds a signed plan to the hypothesis's own stamped published scope (subject, grade, skill, curriculum revision) and requires complete provenance strings, a 64-hex content hash, unique item ids and non-empty `accepted_answers` on every eligible item. Lesson eligibility and the number band are the signed TS compiler's responsibility (`certifyPlaceValueItems`, `placeValueTaskAllowsContrast`).
- `validates_observations` judges transcripts against the plan's `accepted_answers`; no digit-worth computation server-side.
- Server delivery is a record property (`scope_context` stamped at capture from the catalog's `observationDelivery: 'server'` relayed by the client), not a backend membership set. `resolve_misconception` refuses stamped records. Pilot-era unstamped place-value records would regain score resolution; `backend/scripts/retire_unstamped_hypotheses.py` retires them (09-13 dry run: 0 across 8 students).
- A curriculum republish still invalidates old receipts, because the hypothesis's stamped revision no longer equals the live one; it no longer requires a Python edit to re-enable issuance.
- Verified: backend misconception set 76/76, full suite unchanged vs HEAD; `typecheck:lumina` 0; vitest 133 across the touched sets; `probe_place_value_authenticated.py` PASS (real Firebase auth → capture → status → signed context → Next generation → receipt, cleanup verified).
