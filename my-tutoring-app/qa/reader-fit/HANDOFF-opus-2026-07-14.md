# Handoff: K-census generator-fidelity fixes (3 targeted tasks + 1 optional)

Paste-ready brief for an Opus session. Source: the 2026-07-14 K topic-trace census
(`qa/topic-traces/k-*-2026-07-14.md`) and reader-fit BACKLOG items **1f, 1g, 10**
(+ optional **2b-P2**). These are deliberately narrow: each is one generator (or one
component band-gate) with a code-checkable definition of done. Work them **in order,
one task per commit-sized slice**. Do NOT start the audit items (1e, 7, 8, 9) — those
need reader-fit band judgment and stay in the main queue.

## Ground rules (non-negotiable)

- **Verification doctrine (CLAUDE.md):** a fix is done only when the affected flow is
  exercised at runtime. For generators that means REAL DRAWS: `/eval-test <primitive>`
  or a replay POST against `/api/lumina` (each census trace JSON has a ready `replay`
  body), 3+ draws. Type check alone is NEVER "fixed".
- **Type check exactly:** `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit`
  (project-local binary, absolute path). Zero NEW errors vs baseline. Also run
  `npm run typecheck:lumina`.
- **LLM window / code builds structure:** where a value must be internally consistent
  (paths, offsets, counts), derive it IN CODE from the LLM's semantic choice — don't
  prompt the LLM to be consistent.
- **Schema over prompt:** constraints flow through response schemas where possible.
  Note: `maxItems` bounds 400 on this @google/genai version — array caps live in the
  prompt + `maxOutputTokens`.
- Dev servers: Next.js :3000 and backend :8000 may already be running — do NOT
  restart them, and don't write under `backend/app/` mid-run (uvicorn --reload).
- Don't commit or push unless the user asks. Update the BACKLOG entry (move to Done
  with evidence) + add an EVAL_TRACKER row per fix. Save a short dated report per
  task under `qa/topic-fidelity/` (pattern: `sorting-station-2026-07-14.md`).

---

## Task 1 — shape-tracer: instruction/path mismatch (CRITICAL, breaks ALL grades)

**Evidence** (`qa/topic-traces/k-2d-shapes-2026-07-14.md`): in one live draw,
challenges c2 ("Trace the square") and c3 ("Trace the rectangle") shipped
`targetShape: "triangle"` and 3-point triangle `tracePath`s. The student traces a
triangle while being told it's a square — inverts the exact objective concept
(shape name ↔ side count).

**Fix — in `my-tutoring-app/src/components/lumina/service/math/gemini-shape-tracer.ts`:**
1. Let the LLM choose only the SEMANTIC window: which shape each challenge targets
   (+ instruction wording, size/position hints if the schema has them).
2. Build `tracePath` (and `targetShape` consistency) IN CODE from the chosen shape:
   canonical vertex sets for triangle/square/rectangle/circle (circle = sampled arc
   points if the component expects a polyline — read the component's tracePath
   consumption in `ShapeTracer.tsx` first to match its expectations exactly).
   Derive, don't validate-and-retry.
3. Make the instruction name the same shape (either code-template the instruction
   or overwrite the shape word — check how instructions are rendered before choosing).
4. **ContentOracle** (`service/qa/oracles/`, follow `poetry-lab.ts` + registry
   pattern): vertex-count ↔ named-shape invariant (triangle=3, square/rectangle=4
   with right angles, square equal sides within tolerance), instruction text
   mentions targetShape, path is closed if the component expects closure. Register
   it; run `/oracle-test shape-tracer` (or the oracle test suite) with seeded fail
   fixtures.

**Done when:** 3+ fresh draws across grades show instruction/targetShape/path
agreement for every challenge; oracle green incl. seeded-fail; tsc + typecheck:lumina
clean; component still renders a draw (eval-test or replay POST).

---

## Task 2 — phoneme-explorer: ending-sound task silently substituted

**Evidence** (`qa/topic-traces/k-rhyme-identify-2026-07-14.md`): objective + manifest
intent = ENDING sounds / rime ("match words based on their ending phonemes" for rhyme
comparison); generated `mode: "isolate"` data matched by INITIAL phoneme (Cat→Cup via
/k/, Dog→Duck via /d/). The generator has no ending-position concept, so it swapped
the task without failing.

**Fix — in `my-tutoring-app/src/components/lumina/service/literacy/gemini-phoneme-explorer.ts`:**
1. Read the component first (`PhonemeExplorer.tsx` or equivalent) to learn what the
   data can express: is there a position field (initial/final), or is position
   implicit in prompt copy? Fix must be renderable — do NOT invent fields the
   component ignores (dead-field trap: verify by probing a draw through the
   component's data path, not by grep).
2. If the component can present final-sound matching: add a position dimension
   (schema enum `initial|final`), derive it from `ctx.intent`/objective text
   (conditional intentFocus pattern — see the science sweep or
   `gemini-sorting-station`'s 2026-07-14 intent-binding fix as the template), and
   constrain choices so the correct option shares the FINAL phoneme and distractors
   don't.
3. If the component canNOT render final-sound tasks: do the ROUTING fix instead —
   catalog description/constraints (`service/manifest/catalog/literacy.ts`) must
   lead with "initial/beginning sounds ONLY (never rhyme/ending-sound objectives)"
   within the first 160 chars (that's what resolveLessonEvalModes reads), and note
   the WHY in the report. Don't do both halves halfway.
4. Fidelity check: `/topic-fidelity gemini-phoneme-explorer` style probe — fixed
   topic "Compare the ending sounds of two words to determine if they rhyme",
   kindergarten, 3 draws: every challenge must be an ending-sound match (or, if
   routing fix chosen, the manifest must stop selecting phoneme-explorer for that
   objective — re-run the rhyme topic-trace with
   `componentId=phoneme-explorer` absent from selection to confirm).

**Done when:** 3/3 probe draws honor ending-sound intent (or routing verified),
initial-sound topics still generate correctly (regression: 1 draw on "Identify the
beginning sound in a word"), tsc clean.

---

## Task 3 — word-workout + word-flip: K CVC scope binding

**Evidence** (`qa/topic-traces/k-cvc-short-a-2026-07-14.md`), topic "Decode CVC words
with short 'a'":
- `gemini-word-workout.ts` word-chains left the topic vowel in 5/5 challenges
  (cat→bat→bad→**bed**; **sit/tip/top/rot/bug/tug**...) and stamped
  `masteredVowels: [a,e,i,o,u]`.
- `gemini-word-flip.ts` drew plural_s grammar with non-decodable words (**cloud**)
  — the manifest intent itself drifted to grammar, generator compounded it.

**Fix:**
1. **word-workout:** wire the scope-context pattern (`buildScopePromptSection` from
   the shared `scopeContext.ts` — check whether this generator already imports it;
   the ~34 context-native gens are listed in the vitest intent-contract ledger,
   `CONTEXT_NATIVE_IDS`). When the objective names a vowel (parse from
   topic/intent, e.g. /short '?([aeiou])'/), constrain: every chain word uses that
   vowel EXCEPT explicitly-allowed contrast steps — decide ONE rule (recommend: all
   chain words keep the target vowel at K; onset/coda changes only) and encode it in
   the prompt + verify in code post-parse (filter/regenerate offending challenges,
   the deterministic-sanitizer pattern from cvc-speller). `masteredVowels` must
   reflect the scoped vowel(s), not all five.
2. **word-flip:** two links. GENERATOR: when the topic is a decoding/CVC objective,
   words must be K-decodable CVC (schema/prompt constraint + code check: 3-letter
   CVC regex against the target vowel). INTENT: this is manifest-side — do NOT edit
   the frozen manifest schema; if the intent drift needs fixing, the lever is
   word-flip's catalog entry description/constraints (lead with what it's FOR so the
   manifest stops picking plural_s for decoding objectives). Keep this slice small;
   if catalog wording alone can't fix routing, record it in the BACKLOG as
   manifest-prompt follow-up rather than expanding scope.
3. Add both to the vitest intent-contract test ledger if you make them
   context-native (`npm test` must stay green).

**Done when:** fixed-topic probes (short-a decode topic, K): word-workout 3/3 draws
all-short-a chains; word-flip 3/3 draws all K-decodable CVC words (or routing no
longer selects plural_s for the decode objective); a non-CVC topic regression draw
each (e.g. word-workout on a grade-1 mixed-vowel topic) unchanged; `npm test` green;
tsc clean.

---

## Task 4 (OPTIONAL, only if time) — comparison-builder 2b component P2: chrome band-gate

Mechanical application of an established pattern (see word-sorter/letter-sound-link
Done entries in `qa/reader-fit/BACKLOG.md`). In `ComparisonBuilder.tsx` at
`gradeBand==='K'`: hide mode tabs, "1/N" counter, "Kindergarten"/type badges, and the
"Left: N / Right: N" count badges (those partially LEAK the answer — pedagogy rule 1).
Extend `ComparisonBuilder.reader-fit.test.tsx` (jsdom) asserting the chrome is absent
at K and present at grade 2. Do NOT touch the eval modes or scaffold (that's the rest
of 2b, not this slice). Done when: jsdom tests green, full suite green, tsc clean.

---

## Reporting back

For each task: short report in `qa/topic-fidelity/` (Task 4: append to the
comparison-builder reader-fit report), strike/move the BACKLOG item with a one-line
evidence summary, add EVAL_TRACKER rows. End your final message with a per-task
verdict table: FIXED+VERIFIED (say how) / FIXED-NEEDS-BROWSER-CHECK (say what to
click) / BLOCKED (say why). Never report "fixed and verified" on tsc alone.
