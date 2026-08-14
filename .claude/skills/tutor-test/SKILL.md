# Tutor Test — Verify the AI Tutoring Connection for a Primitive

Confirm that a primitive's tutoring scaffold actually reaches the AI tutor intact: the catalog block is wired to a live `useLuminaAI` hook, every `{{key}}` and contextKey resolves against the component's real `primitiveData` bag, pedagogical moments fire, and nothing in the scaffold leaks answers. This is the QA gate for the L2 layer (`/add-tutoring-scaffold`), the way `/eval-test` gates L1.

**Why this exists:** the backend renders any unresolvable `{{key}}` as the literal string `(not set)` — no error, no log (`interpolate_template`, `lumina_tutor.py`). A broken scaffold degrades invisibly into a vague, context-blind tutor. Type checks catch none of it.

**Arguments:** `/tutor-test <primitive-id> [--probe] [--di]`
- Omit the id to sweep every catalog entry with a `tutoring:` block
- `--probe` adds Tier 2 (real generated content + assembled prompt preview)
- `--di` runs Tier 3-DI on a judged-loop port (see below) — the only tier that exercises the JUDGE

## The tiers

| Tier | What | Cost | Judged by |
|------|------|------|-----------|
| 1 — Static contract audit | orphan check, `{{var}}`/contextKey resolvability, sendText silent flags, directive tags, answer-leak lint | free, CI-able | code |
| 2 — Prompt-assembly probe (`&probe=1`) | real generator output → assembled system-prompt preview, per-var resolution source | 1 Gemini generation | code + you |
| 3 — Live journey harness | headless synthetic student drives the REAL backend WS + Gemini Live session through the primitive's natural interaction order; per-beat `ai_transcription` captured + code oracles | 1 generation + 1 Live session (~4 min) | code + you (read the transcript report) |
| **3-DI — Judged-loop harness (`--di`)** | **the same session, driven as a DI loop: real cues from the primitive's own script module, answered WRONG on purpose then right, in TEXT** | 1 generation + 1 Live session (~6 min) | code + you (read the judgment matrix) |
| 3b — Manual bench | edge behaviors the scripted journey doesn't cover; actual audio quality | Gemini Live session | human, in the Lumina Tutor Tester dev panel |

Tiers 1–2 are this skill's fast path. Tier 3 runs on demand for scaffolds that are new, materially changed, or Tier 1/2-green but "tutor feels off".

### Tier 3-DI: the judged loop, headless

```bash
cd backend/tests/tutor_live
python run_tutor_live.py --component ten-frame --di --eval-mode subitize \
  --topic "counting to ten" --grade Kindergarten --runs 3
python run_tutor_live.py --component ten-frame --di --di-cap     # drill past the corrections cap
python run_tutor_live.py --component ten-frame --di --di-wrong signature   # the fluent miss
```

**Every spoken item is answered wrong on purpose, then right.** A drive that answers
everything correctly proves nothing — it is what every open mic row's criteria say not to do.
Report: `qa/tutor-reports/<id>-live-di-<wrong-kind>-<date>.md`; read the **judgment matrix**
first (per item: was the wrong answer refused, was the right one affirmed), then the transcript.

**No TTS, and that is the whole trick.** The student's answer goes back as a plain text turn,
which reaches Gemini through the same `send_realtime_input` floor a spoken answer does
(`classify_cue` returns `"text"` for anything untagged, so it is not a cue and arms no mute
window) and is judged under the identical contract. Synthesizing audio would make every
finding a question about our synthesizer's diction instead of the judge's.

**So be precise about what a green run buys.** It exercises the LOOP and the JUDGE'S
SEMANTICS — refusal, affirmation, leak discipline, sentinel discipline, correction shape,
cue compliance. It does **not** exercise acoustics, ASR, the mic transport, VAD, or the audio
tail. Ear-separability and "can the judge hear a five-year-old say /s/" stay human-drive
questions. **A green run retires the semantic half of a mic row's criteria, never the row.**

Nothing in the journey is authored in Python: `/api/lumina/tutor-test?...&di=1` builds the plan
from the port's own script module (real `itemFromChallenge` gates, real `itemCue`, real judging
contract, the runner's opening/how-to-play policy), so the harness cannot drift from production.
It also runs `checkPackGates` over a pack built from LIVE generated content — the sentinel scan
over generated words that `/add-di-loop` step 7.3 otherwise buys with a delete-after-run file.

**Judged cues ride clean of the state block (`scripted: true`, 2026-08-14).** The runner and the
harness both send judged cues with `scripted: true`, which stops the backend prepending its
`[CURRENT STATE]` block (`TextQueueEntry.scripted` → `PrimitiveState.attach` skipped). Without
it the Live model NARRATES the preamble — *"[CURRENT STATE]: … The target answer for this new
item is 'four'"*, answer included, on 6/6 state-attached cues in the first ten-frame cap drill —
despite a prompt rule forbidding exactly that. **If `di-tag-spoken` and `di-answer-leak-in-ask`
fire together on ask/moveon beats, suspect the state block before the pack's script**: check
`state_attached` in the backend session ledger — on a judged run it must stay 0 after connect.
The report's findings table clusters one row per MECHANISM (beat list carries the instances), so
this class reads as one defect, not a 12-row wall.

**Adding a port** = one `DiPortAdapter` in `service/qa/di/diDrivePlan.ts` naming the port's
exported cue surface (`<primitive>PackBase`) and its answer material. It must never re-declare
cues. If a port has no exported cue surface yet, extract one — the component spreads it, which
is what makes the harness honest.

#### DI oracles

| Check | Severity | What it means |
|---|---|---|
| `di-false-affirm` | HIGH | **the one that matters** — a wrong answer was affirmed |
| `di-false-refusal` | HIGH | a right answer was corrected |
| `di-no-verdict` | HIGH | neither sentinel opened a sentence; the loop stalls here |
| `di-answer-leak-in-ask` | HIGH | the ask contains the answer the child is about to say |
| `di-tag-spoken` | HIGH | read control syntax aloud (the fabricated-`[LSP_TAP]` class) |
| `di-performed-stage-direction` | HIGH | announced the wait instead of simply stopping |
| `di-improvised-turn` | HIGH | spoke during a hands item, which the bracket owes no reply |
| `di-false-completion-claim` | HIGH | told the child the work is over with items still queued |
| `di-silent-turn` | HIGH | no speech in 60s — the loop cannot advance |
| `di-verdict-embellished` | WARN | added ≥5 unscripted words to a `say exactly` line |
| `di-off-script-ask` / `di-off-script-verdict` | WARN | <60% of the scripted line survived |
| `di-correction-verbatim-repeat` | WARN | same correction word for word; DISTAR firms by escalating |
| `di-capped-item-asks-then-withdraws` | WARN | last correction re-asks, then the move-on cue retracts it |
| `di-sentinel-on-ask` | WARN | an ask opens with a verdict sentinel; the reducer misreads it |

The click-path oracles are deliberately NOT run on `--di`: they score an improvising tutor, and
on a judged loop a question per turn is the method, not interrogation cadence.

### Tier 3: live journey harness

```bash
# plumbing gate (connect + auth + greeting transcript only)
cd backend/tests/tutor_live && python run_tutor_live.py --component <id> --plumbing
# full journey (intro → natural student actions → boundary pokes → adversarial probes)
cd backend/tests/tutor_live && python run_tutor_live.py --component <id> --runs 3
```

Needs backend :8000 + frontend :3000 running, and `content-pipeline/.env` Firebase test creds. The harness fetches real generated content + the raw tutoring block via `&probe=1&live=1`, authenticates on `/api/lumina-tutor` exactly like `LuminaAIContext`, replays the component's sendText `[TAG]` templates and `update_context` slider moves beat by beat, and judges the per-beat transcript with the code oracles below. Report: `qa/tutor-reports/<id>-live-<date>.md` with all runs' transcripts — always read it; oracles are tripwires, the transcript is the evidence.

**Rate-based scoring:** sessions are nondeterministic — `--runs N` replays the same journey over the SAME generated content; a finding is **CONFIRMED at ≥2/3 of runs**, otherwise it's a single-run note. Default to `--runs 3`; never file a finding off one run.

Journeys live in `run_tutor_live.py` (`JOURNEYS` registry — `states-of-matter` is the template; unknown ids get a generic greeting/orientation/answer-fish journey). A bespoke journey mirrors the component's actual sendText templates — keep them in sync when the component changes.

## Failure modes — what "bad tutor" actually means, and which tier catches it

Each journey beat encodes a pedagogical moment with an expected move (greet-brief, stay-silent, celebrate-then-explain, elicit-don't-tell, hint-don't-reveal). Failures cluster into five families:

| Family | Failure | Check / method | Tier |
|---|---|---|---|
| **Floor control** | speaks with no trigger on context updates | `quiet-by-default-violation` | 3 |
| | every turn ends with a question (interrogation) | `interrogation-cadence` (>80% of turns) | 3 |
| | 2+ questions in one breath | `question-stacking` (>50% of turns); `stacked-questions-script` (≥3 ?s in a scripted line) | 3 / **1** |
| **Grounding** | narrates the UI — "the challenge asks…" instead of asking the question | `indirect-utterance`; `indirect-script` | 3 / **1** |
| | asserts the wrong current state ("right now it's a solid" when it's gas) | `stale-state-utterance` (vs the harness-driven state) | 3 |
| | generic-tutor drift (utterance fits any primitive) | LLM judge (not built) | — |
| **Pedagogy** | answer leak — current challenge's answer in an ASSERTIVE sentence ("it's a liquid!"). Option-listing questions ("solid, liquid, or gas?") and other challenges' answers as framing are NOT leaks | `answer-leak-live`; `answer-leak-in-scaffold` | 3 / 1 |
| | laundered leak ("starts with L…", eliminating options), telling instead of eliciting, hint-level jumping | LLM judge (not built) | — |
| | praise inflation / person-praise ("you are a keen observer!") | `praise-inflation` (>0.75 superlatives/turn) | 3 |
| **Compliance** | reads tag syntax / "[STUDENT ACTION]" aloud | `tag-syntax-spoken` | 3 |
| | speaks a literal "(not set)" | `not-set-spoken` | 3 |
| **Modality** | dead air after a trigger; silent beat | per-beat elapsed + `silent-turn` | 3 |

The report's **style metrics** row (words/turn, ends-with-? rate, stacked-? rate, superlatives/turn) is the trend line — watch it across reports even when no threshold trips.

**Triage by layer — every finding must name where the fix lives:**
1. **CATALOG script** (`indirect-script`, `stacked-questions-script`, leak-in-scaffold): the scaffold text itself is bad — copy edit, caught free in Tier 1.
2. **Backend system prompt** (`quiet-by-default-violation`, cadence/praise habits): cross-primitive model behavior — fix once in `lumina_tutor.py` prompt, benefits all 130 scaffolds.
3. **Model improv** (`indirect-utterance`, `stale-state-utterance` on otherwise-clean scripts): what Gemini adds around a good script — prompt phrasing rules ("at most one question per turn", "praise the strategy, not the student").

The harness knows exactly what script it fed each beat, so diff the utterance against the script before blaming the model: if the bad phrase is IN the script, it's layer 1.

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
| `indirect-script` | WARN | script narrates the UI ("answer the question") instead of enacting the question | CATALOG (copy edit) |
| `stacked-questions-script` | WARN | one scripted line asks 3+ questions | CATALOG (copy edit) |
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
| `src/app/api/lumina/tutor-test/route.ts` | API endpoint (sweep / single / probe / `&di=1`) |
| `src/components/lumina/service/qa/tutoring/scaffoldAudit.ts` | Static analyzer + prompt-preview mirror |
| `src/components/lumina/service/qa/di/diDrivePlan.ts` | Tier 3-DI: port adapters + the serialized judged loop |
| `src/contexts/LuminaAIContext.tsx` | Sends `componentDef.tutoring` verbatim in the WS auth message |
| `backend/app/api/endpoints/lumina_tutor.py` | `interpolate_template` + prompt assembly (the mirror's source of truth) |
| `backend/tests/tutor_live/run_tutor_live.py` | Tier-3 live journey harness (headless synthetic student) |
| `src/components/lumina/components/LuminaTutorTester.tsx` | Tier-3b manual bench |

## Gotchas

- The resolvable key space is EXACTLY the component's `aiPrimitiveData` — `topic`/`gradeLevel` travel as separate auth fields and are NOT merged into `primitive_data`. `{{gradeLevel}}` only resolves if the component includes it in the bag.
- `correctAnswer`-style keys in `contextKeys` are fine (tutor-reference RUNTIME STATE); the same key interpolated into `scaffoldingLevels` or a struggle `response` is a leak — those are scripts the tutor reads aloud.
- The prompt-preview in `scaffoldAudit.ts` mirrors `get_primitive_specific_instructions` in `lumina_tutor.py`. If the backend format changes, update the mirror in the same commit.
- Sweep results with a dynamic data bag (spreads/computed keys) are downgraded to WARN, not silenced — verify those with `--probe` before trusting them.
