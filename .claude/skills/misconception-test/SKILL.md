# Misconception Test — Does the Diagnosis Loop Close for One Primitive?

Take a SINGLE primitive and verify its misconception loop end-to-end with REAL
engines: the distiller writes honest diagnoses from this family's failure
signatures (Probe D), the generator turns an active diagnosis into
misconception-consistent content without leaking it (Probe G), and a scripted
student journey closes — diagnosed → remediated → resolved → gone (Probe R).
Outcome: a per-probe verdict table and a PASS/FAIL gate, saved as a dated QA
report. This is the verify half of the campaign pair; `/add-misconception-loop`
is the build half (PRD §5.1).

**This is the student-state companion to the content skills:**
- `/eval-test` asserts about CONTENT (generator → agent judges soundness — no student).
- `/topic-fidelity` asserts about VALUE ORIGIN (does topic/intent/grade reach the output).
- `/misconception-test` asserts about a STATEFUL ROUND TRIP: wrong-rule persona →
  capture → distill → store → exposure → remediation generation → resolution.

**Arguments:** `/misconception-test <primitive-id> [primitive-id ...]`
- `/misconception-test cvc-speller letter-sound-link`
- Batch is normal: probes D and G are per-primitive HTTP calls; Probe R's pytest
  file covers all wired families in one run.

**Doctrine (from the PRD — these are the things being tested, not preferences):**
- Abstain is success. A distiller that generates on noisy evidence is BROKEN.
- No leakage: the diagnosed rule, the correct rule, and the answer never appear
  in student-visible text — not in prompts, labels, options, hints, feedback.
- Misconceptions change content EMPHASIS only: same grade, scope, eval mode,
  difficulty, item counts. Never β/selection ([[pure-irt-no-heuristics]]).
- Identity = `primitive_type` + declared `misconceptionScope` (rev-2 ruling):
  `'primitive'` → key is primitiveType alone, resolves globally; `'skill'` →
  `primitiveType::skillId`, silent outside its skill.

## The loop under test (station map)

```
S1 capture      component pushes {challenge, expected, observed[, judgeFeedback]}
                per wrong attempt → submitEvaluation(..., diagnosisEvidence) 6th arg
                (gates in captureMisconception.ts: failed + tier A/B + real subskill
                 + once-per-(subskill,session))
S2 distill      /api/lumina action distillMisconception → gemini-flash-latest,
                schema {abstain, misconceptionText, confidence, reason}
S3 store        POST /api/student-profile/misconceptions →
                students/{id}/misconceptions/{key} (Firestore, one-slot)
S4 expose       get_generation_context → objectives[].activeMisconception +
                session activeMisconceptionsByPrimitive
S5 generate     ctx.remediationFocus → buildRemediationPrompt() section +
                per-challenge remediationMove enum (code-stamped post-parse)
S6 resolve      submission with metadata.remediation_for_primitive_type tag,
                score ≥80, scope-matched → resolve_misconception
```

Probe D exercises S2. Probe G exercises S5. Probe R exercises S3→S4→S6.
S1 (capture inside the live component) is the one station probes cannot reach —
it stays a browser-owned check; say so in the report, never claim it verified.

## Verdicts

| Probe | Verdict | Meaning |
|---|---|---|
| D | **GENERATIVE** | expectation-generative scenario → clean student-model sentence, no leak |
| D | **ABSTAINED** | expectation-abstain scenario → abstain=true (success!) |
| D | **VAGUE** | generated, but the sentence doesn't predict the wrong answer (useless downstream) |
| D | **OVERREACH** | generated on evidence that demanded abstain — **gate fail** |
| D | **LEAK** | diagnosis text names the target word/answer a student could reuse — **gate fail** |
| G | **TARGETED** | remediation run stamps the right remediationMove AND a distractor a student holding the misconception would pick; null run unchanged |
| G | **DEAD-FIELD** | remediationFocus in, no observable difference out |
| G | **LEAKY** | misconception/correct-rule text visible in student-facing fields — **gate fail** |
| G | **DRIFTED** | null-run baseline changed (remediationMove stamped without focus, or scope/mode/count shifted in the remediation run) |
| G | **AFFORDANCE-BOUNDED** | emphasis shifted and the move stamped, but the misconception-consistent distractor is structurally OUTSIDE the mode's scope (e.g. the confusable letter isn't in the cumulative letter group) — not a gate fail; log it, and consider gating the move stamp on the affordance (PRD: no affordance → abstain, like tape-diagram solve_part_whole) |
| R | **CLOSED** | diagnose → distractor submit stays active → strong matched submit resolves → next read empty |
| R | **NO-CAPTURE** | wrong-rule journey never produced an active misconception |
| R | **STUCK-ACTIVE** | strong matched submit did not resolve |
| R | **PREMATURE-RESOLVE** | weak (<80) or unmatched submit resolved it |
| R | **OUT_OF_SCOPE_RESOLVE** | a tag from another primitive/skill resolved it — scope join broken |
| G | **OUT_OF_SCOPE_BLEED** | a skill-scoped diagnosis reached generation outside its skill |

**Gate (all must hold):** 0 LEAK, 0 OVERREACH, 0 LEAKY, every wired family
TARGETED (not DEAD-FIELD/DRIFTED), Probe R CLOSED with the scope-mismatch
tests green. VAGUE is a warning, not a gate fail — log it; repeated VAGUE on
the same signature means the golden scenario needs richer priorAttempts.

## Workflow

### Phase 0 — Wiring inventory (static, ~2 min, no engines)

For each primitive, confirm all five stations are wired. Any miss → verdict
**NOT-WIRED** for that primitive; stop there and route to `/add-misconception-loop`
(or wire by hand mirroring the cvc-speller pilot) — probes on an unwired
primitive only prove the obvious.

1. **Catalog** (`service/manifest/catalog/<domain>.ts`): entry declares
   `misconceptionScope: 'primitive' | 'skill'`.
2. **Component** (`primitives/visual-primitives/<domain>/<Name>.tsx`): keeps a
   `diagnosisObservationsRef`, pushes on wrong attempts (judge-backed entries set
   `judgeFeedback`), builds `DiagnosisEvidence` on failed completion, passes it
   as `submitEvaluation`'s 6th arg.
3. **Generator** (`service/<domain>/gemini-<name>.ts`): imports
   `buildRemediationPrompt`, interpolates it, schema has a bounded
   `remediationMove` enum, and code (not the LLM) stamps/strips the move
   post-parse via an exported `<name>RemediationMoveFor(...)` helper.
4. **Golden scenarios** (`evaluation/diagnosis/scenarios.ts`): ≥2 generative +
   ≥1 abstain scenario for this family, including one judge-backed (tier-A)
   packet if the primitive has a spoken judge.
5. **Round-trip coverage** (`backend/tests/test_misconception_round_trip.py`):
   a test constructs this primitive's submission and asserts scope-correct
   resolution.

### Phase 1 — Tier 0 pure contracts (seconds, no network)

```bash
cd "<abs>/my-tutoring-app" && npm test -- --run
```

Runs the remediation-prompt guardrails, `<name>RemediationMoveFor` mappings, and
scope-resolver tests. Any red here = fix before burning Gemini calls.

### Phase 2 — Probe D: distiller honesty (REAL Gemini)

Dev server up (`cd my-tutoring-app && npm run dev`). For each of the family's
golden scenarios, POST the packet to the real distiller:

```bash
# body fields mirror DiagnosisScenario: evidence + score/success/subskillId/evalMode/gradeLevel
curl -s -m 60 http://localhost:3000/api/lumina -H 'Content-Type: application/json' \
  -d '{"action":"distillMisconception","params":{"evidence":{...},"score":35,"success":false,"subskillId":"...","evalMode":"...","gradeLevel":"K"}}'
```

Judge each response against the scenario's `expectation` and `note`:
- generative expected → `abstain:false` + a sentence that PREDICTS the wrong
  answer (the `note` says what good looks like); check it names no target word
  the student could copy (LEAK check).
- abstain expected → `abstain:true`. Anything else is OVERREACH.

Run borderline scenarios 2–3× (LLM variance — judge the distribution). Record
one row per scenario. Keep the strongest generative diagnosis text — it becomes
Probe G's `remediationFocus` input, so the probes test the REAL handoff, not a
hand-written focus.

### Phase 3 — Probe G: generation fidelity (REAL Gemini, eval-test route)

Per primitive, per eval mode the misconception plausibly fires in:

```bash
ID=cvc-speller; M=spell_word; G=kindergarten; T="short i words"
enc(){ python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }
base="http://localhost:3000/api/lumina/eval-test?componentId=$ID&evalMode=$M&gradeLevel=$G&topic=$(enc "$T")"
# 1. NULL-RUN baseline — no focus
curl -s -m 120 "$base"
# 2. REMEDIATION run — the Probe D diagnosis as the focus
curl -s -m 120 "$base&remediationFocus=$(enc "The student substitutes the short-e sound for short-i.")"
```

Judge (code-checkable where possible — pull `fullData` and inspect):
- **Null run:** NO challenge carries `remediationMove`; content is normal for
  the topic/grade. Any move stamped, or structure shifted vs. the primitive's
  usual output → DRIFTED.
- **Remediation run:** challenges carry the CORRECT move for their task type
  (the exported `RemediationMoveFor` mapping is the oracle); at least one
  distractor IS the answer the misconception predicts (e.g. short-e/short-i
  focus → the wrong vowel option is `e` on an `i` word, a distractor spelling
  swaps i→e, or the sort contrast isolates e-vs-i) — else DEAD-FIELD (prompt
  section present but inert) or partial.
- **Leak scan (both runs):** grep every student-visible string (prompts,
  feedback, labels, hint text) for the misconception text, the correct rule
  stated pre-attempt, or the answer. Any hit → LEAKY, gate fail.
- Scope/mode/count invariants hold across the two runs (same eval mode, same
  challenge count ±1, same grade band) — remediation changes emphasis only.

Repeat 2× per mode if the first remediation run is ambiguous.

### Phase 4 — Probe R: round trip (backend, no Gemini)

```bash
cd "<abs>/backend" && python -m pytest tests/test_misconception_round_trip.py -q
```

This is the permanent in-memory journey: asserts CLOSED on the happy path,
plus the negative-space tests (unmatched tag cannot resolve, skill-scoped tag
silent outside its skill, primitive-scoped resolves only itself). All green →
CLOSED; map any failure to NO-CAPTURE / STUCK-ACTIVE / PREMATURE-RESOLVE /
OUT_OF_SCOPE_RESOLVE by which assertion broke.

**S4 exposure against real Firestore** (uses a disposable synthetic student,
always cleans up):

```bash
cd "<abs>/backend" && python scripts/probe_misconception_phase2.py --primitive <primitive-id>
```

Expect `"status": "pass"` with `activeMisconception.misconceptionKey` equal to
the primitive id (primitive scope) — proves store→generation-context exposure
for THIS primitive's key shape, not just tape-diagram's.

### Phase 5 — Report + memory

Save to `my-tutoring-app/qa/misconception/<primitive(s)>-<YYYY-MM-DD>.md`
(save by default, don't ask — [[save-run-summaries-by-default]]):

```markdown
# Misconception Test: <primitives> — <YYYY-MM-DD>

Gate: PASS | FAIL

| Probe | Case | Verdict | Evidence (one line) |
|-------|------|---------|---------------------|
| D | cvc-speller-vowel-substitution | GENERATIVE | predicts e-for-i, no target words |
| D | cvc-speller-single-vowel-slip  | ABSTAINED  | — |
| G | cvc-speller spell_word         | TARGETED   | move=phoneme_slots, distractor "peg" for pig |
| G | (null run)                     | clean      | no moves stamped |
| R | journey + scope matrix         | CLOSED     | pytest 6/6 |

**Not verified here:** S1 live capture in the browser (component → evidence →
store on a real wrong session) — still browser-owned.
**Distiller handoff:** Probe G ran on Probe D's actual output: "<text>"
```

Update the misconception-loop memory only if a probe taught something new about
the loop's mechanics (a new failure mode, a scope-join surprise) — not for a
routine PASS.

## Gotchas

- **Probe D/G burn real Gemini quota** — run Tier 0 and Phase 0 first; never
  probe an unwired primitive.
- **The distiller is `gemini-flash-latest`, NEVER flash-lite** — if outputs
  suddenly go vague/truncated, check the model constant before blaming prompts.
- **eval-test's `remediationFocus` tap ≠ production path.** Production stamps
  per-objective via flattenManifestToLayout; the tap enters at config. Probe G
  validates the registry→generator→schema segment. S4 (store→context) is
  Probe R's Firestore probe; the flatten stamp itself is covered by frontend
  unit tests.
- **Judge the distribution, not one draw.** One clean remediation run doesn't
  prove TARGETED; one miss doesn't prove DEAD-FIELD. 2–3 draws on any call you
  are about to verdict on.
- **Scope rules beat remediation instructions in a prompt conflict — by design.**
  When "use ONLY letters from the cumulative group" collides with "make the
  wrong option encode the confusion", the LLM (correctly) keeps scope. If the
  confusable target lives outside the scope window, the mode is
  AFFORDANCE-BOUNDED for that misconception; verify with 2 draws (the miss must
  be deterministic, not variance) and check the sibling modes — a sound-side
  mode may afford the contrast the letter-side mode can't (letter-sound-link
  see_hear can play /d/ against T while hear_see cannot show the letter d).
- **A remediation run that's HARDER is a bug.** If the focus dragged difficulty,
  item counts, or grade band, that's DRIFTED even if the distractor is right —
  a hard-tier student gets hard problems WITH the move, never because of it.
- **`misconceptionKey` shape is scope-dependent**: primitiveType alone
  ('primitive') vs `primitiveType::skillId` ('skill'). When adding Probe R
  coverage for a skill-scoped primitive, assert the composite key.
- **Windows:** `python` not `python3`; backend probes run from `backend/` so
  `app.*` imports resolve; the Bash tool is bash, not PowerShell.
- **Once-per-(subskill,session) capture latch** (S1): a browser check that
  submits twice in one session and sees one doc is CORRECT, not a bug.

## Key Files

| File | Purpose |
|------|---------|
| `src/components/lumina/evaluation/diagnosis/scenarios.ts` | Golden evidence set — Probe D input + regression baseline |
| `src/components/lumina/evaluation/diagnosis/distillMisconception.ts` | S2 distiller (schema, abstain, tier gate) |
| `src/components/lumina/evaluation/diagnosis/captureMisconception.ts` | S1 gates (failed + tier + latch) |
| `src/app/api/lumina/route.ts` (`distillMisconception` action) | Probe D endpoint |
| `src/app/api/lumina/eval-test/route.ts` (`?remediationFocus=`) | Probe G endpoint |
| `src/components/lumina/service/generation/remediationPrompt.ts` | S5 shared prompt block (guardrail text) |
| `backend/tests/test_misconception_round_trip.py` | Probe R journey + scope matrix (in-memory) |
| `backend/scripts/probe_misconception_phase2.py` | S4 exposure vs real Firestore (`--primitive`) |
| `my-tutoring-app/qa/misconception/` | Report output directory |
| `docs/PRD_MISCONCEPTION_LOOP.md` | Full spec (§5.1 = this skill's charter) |
