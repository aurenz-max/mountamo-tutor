# Tutor Test — Verify the AI Tutoring Connection for a Primitive

Confirm that a primitive's tutoring scaffold actually reaches the AI tutor intact: the catalog block is wired to a live `useLuminaAI` hook, every `{{key}}` and contextKey resolves against the component's real `primitiveData` bag, pedagogical moments fire, and nothing in the scaffold leaks answers. This is the QA gate for the L2 layer (`/add-tutoring-scaffold`), the way `/eval-test` gates L1.

**Why this exists:** the backend renders any unresolvable `{{key}}` as the literal string `(not set)` — no error, no log (`interpolate_template`, `lumina_tutor.py`). A broken scaffold degrades invisibly into a vague, context-blind tutor. Type checks catch none of it.

**Arguments:** `/tutor-test <primitive-id> [--probe]`
- Omit the id to sweep every catalog entry with a `tutoring:` block
- `--probe` adds Tier 2 (real generated content + assembled prompt preview)

## The three tiers

| Tier | What | Cost | Judged by |
|------|------|------|-----------|
| 1 — Static contract audit | orphan check, `{{var}}`/contextKey resolvability, sendText silent flags, directive tags, answer-leak lint | free, CI-able | code |
| 2 — Prompt-assembly probe (`&probe=1`) | real generator output → assembled system-prompt preview, per-var resolution source | 1 Gemini generation | code + you |
| 3 — Live journey harness | headless synthetic student drives the REAL backend WS + Gemini Live session through the primitive's natural interaction order; per-beat `ai_transcription` captured + code oracles | 1 generation + 1 Live session (~4 min) | code + you (read the transcript report) |
| 3b — Manual bench | edge behaviors the scripted journey doesn't cover; actual audio quality | Gemini Live session | human, in the Lumina Tutor Tester dev panel |

Tiers 1–2 are this skill's fast path. Tier 3 runs on demand for scaffolds that are new, materially changed, or Tier 1/2-green but "tutor feels off".

### Tier 3: live journey harness

```bash
# plumbing gate (connect + auth + greeting transcript only)
cd backend/tests/tutor_live && python run_tutor_live.py --component <id> --plumbing
# full journey (intro → natural student actions → boundary pokes → adversarial probes)
cd backend/tests/tutor_live && python run_tutor_live.py --component <id>
```

Needs backend :8000 + frontend :3000 running, and `content-pipeline/.env` Firebase test creds. The harness fetches real generated content + the raw tutoring block via `&probe=1&live=1`, authenticates on `/api/lumina-tutor` exactly like `LuminaAIContext`, replays the component's sendText `[TAG]` templates and `update_context` slider moves beat by beat, and judges the transcript with code oracles: `answer-leak-live` (current challenge's answer spoken during answer-fish/wrong-answer beats), `not-set-spoken`, `quiet-by-default-violation` (speech during pure context updates), `silent-turn`, `no-output-transcription`. Report: `qa/tutor-reports/<id>-live-<date>.md` with the full beat-by-beat transcript — always read it; oracles are tripwires, the transcript is the evidence.

Journeys live in `run_tutor_live.py` (`JOURNEYS` registry — `states-of-matter` is the template; unknown ids get a generic greeting/orientation/answer-fish journey). A bespoke journey mirrors the component's actual sendText templates — keep them in sync when the component changes.

Gotchas: sessions are nondeterministic — rerun before trusting a single-run finding; a stale uvicorn `--reload` worker on :8000 closes the WS with 1012 right after `session_ready` (restart the backend); the Next dev server intermittently 404s API routes mid-recompile (harness retries 3×, worst case restart `npm run dev`).

## Workflow

### Step 1: Curl the API

```bash
# Full sweep (Tier 1 only, fast, no Gemini)
curl -s "http://localhost:3000/api/lumina/tutor-test"

# Single primitive
curl -s "http://localhost:3000/api/lumina/tutor-test?componentId=<id>"

# Tier-2 probe (real content + prompt preview)
curl -s "http://localhost:3000/api/lumina/tutor-test?componentId=<id>&probe=1&evalMode=<mode>&topic=...&gradeLevel=..."
```

If connection refused, tell the user: `cd my-tutoring-app && npm run dev`

### Step 2: Triage findings

Severity semantics (mirror eval-test discipline — only flag what's actually broken):

| Check | Severity | Meaning | Fix in |
|-------|----------|---------|--------|
| `orphan-scaffold-no-hook` | HIGH | scaffold never sent; generic tutor | COMPONENT (wire `useLuminaAI`) |
| `template-var-unresolvable` | HIGH | `{{key}}` → literal `(not set)` in the prompt | COMPONENT (add key to `aiPrimitiveData`) or CATALOG (fix the var name) |
| `context-key-unresolvable` | HIGH | RUNTIME STATE line reads `(not set)` | same as above |
| `tagged-sendtext-not-silent` | HIGH | system trigger claims focus / shows as student chat | COMPONENT (`{ silent: true }`) |
| `answer-leak-in-scaffold` | HIGH | answer key interpolated into a spoken script (levels / struggle responses) | CATALOG |
| `no-sendtext-moments` | WARN | tutor goes silent after the greeting | COMPONENT |
| `directive-tag-never-emitted` | WARN | dead directive prompt text | CATALOG or COMPONENT |
| `data-bag-unparsed` / dynamic-bag downgrades | WARN | static analysis couldn't see the key set | verify via `--probe` or Tutor Tester |

`staleHookIds` in the sweep = `primitiveType` literals that match no catalog id — the auth message ships `tutoring: null`. Always HIGH.
`hookNoScaffold` = wired but scaffold-less (generic tutor). That's the expected L0/L1 state, not a bug — it's the `/add-tutoring-scaffold` queue.

**Which side to fix:** if the value exists in the component but under another name (e.g. scaffold says `{{dataCount}}`, bag has `dataPoints`), prefer adding the derived key to `aiPrimitiveData` over rewording the catalog — the scaffold copy is usually the pedagogically-reviewed artifact.

### Step 3: Probe review (when `--probe`)

Read `probe.varResolution`:
- `component` — resolves at runtime. Good.
- `generator-only` — the value exists in generated content but the component never forwards it to `aiPrimitiveData`. Broken at runtime; fix in COMPONENT.
- `unresolved` — no source anywhere. Fix the name in CATALOG.

Then skim `probe.promptPreview` — this is (byte-faithfully) the scaffold section the backend will hand Gemini. Any literal `(not set)` is a break; `«runtime:key»` placeholders are fine (component-provided values the probe can't compute).

### Step 4: Save report + tracker

Save to `my-tutoring-app/qa/tutor-reports/<primitive-id>-<YYYY-MM-DD>.md` (sweeps: `sweep-<YYYY-MM-DD>.md`). Keep it short: status table, findings with fix-in column, one-line verdict. Update `my-tutoring-app/qa/EVAL_TRACKER.md` open-issues tables for HIGH findings (prefix ids `TU-N`).

**Do NOT fix code unless the user explicitly asks** — findings route through the normal fix flow.

### Step 5: Tier-3 reminder

For scaffolds that are new or materially changed, run the live journey harness (see above), or end with:
> Tier 1–2 verify the connection, not the behavior. Run `python backend/tests/tutor_live/run_tutor_live.py --component <primitive-id>` for a transcript-judged live session, or open the **Lumina Tutor** dev panel (IdleScreen → Lumina Tutor) to probe manually.

## Key files

| File | Purpose |
|------|---------|
| `src/app/api/lumina/tutor-test/route.ts` | API endpoint (sweep / single / probe) |
| `src/components/lumina/service/qa/tutoring/scaffoldAudit.ts` | Static analyzer + prompt-preview mirror |
| `src/contexts/LuminaAIContext.tsx` | Sends `componentDef.tutoring` verbatim in the WS auth message |
| `backend/app/api/endpoints/lumina_tutor.py` | `interpolate_template` + prompt assembly (the mirror's source of truth) |
| `backend/tests/tutor_live/run_tutor_live.py` | Tier-3 live journey harness (headless synthetic student) |
| `src/components/lumina/components/LuminaTutorTester.tsx` | Tier-3b manual bench |

## Gotchas

- The resolvable key space is EXACTLY the component's `aiPrimitiveData` — `topic`/`gradeLevel` travel as separate auth fields and are NOT merged into `primitive_data`. `{{gradeLevel}}` only resolves if the component includes it in the bag.
- `correctAnswer`-style keys in `contextKeys` are fine (tutor-reference RUNTIME STATE); the same key interpolated into `scaffoldingLevels` or a struggle `response` is a leak — those are scripts the tutor reads aloud.
- The prompt-preview in `scaffoldAudit.ts` mirrors `get_primitive_specific_instructions` in `lumina_tutor.py`. If the backend format changes, update the mirror in the same commit.
- Sweep results with a dynamic data bag (spreads/computed keys) are downgraded to WARN, not silenced — verify those with `--probe` before trusting them.
