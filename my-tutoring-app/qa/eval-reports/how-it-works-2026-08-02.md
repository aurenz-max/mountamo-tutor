# Eval Report: how-it-works — 2026-08-02

Triggered by a field crash during an exhibit build:
`SyntaxError: Unterminated string in JSON at position 479945 (line 97 column 473840)`
→ `gemini-how-it-works.ts:838` (compiled) → `9/10 components generated`.

**Reproduced.** 9 runs against `/api/lumina/eval-test`
(`topic=How a volcano erupts`, `gradeLevel=grade 4`), 3 per eval mode.

## Results

| Eval Mode | Status | Issues |
|-----------|--------|--------|
| guided    | FAIL | 1 (HW-4) — 1 hard crash + 1 runaway in 3 runs |
| sequence  | FAIL | 1 (HW-4) — 2 runaways in 3 runs |
| predict   | FAIL | 1 (HW-4) — 1 runaway in 3 runs |

**Flakiness: 5/9 runs (56%) emitted a runaway string; 1/9 (11%) crashed outright.**
Content quality on clean runs is fine — steps chronological, MC keys consistent,
sequence keys valid, no answer leaks. The only finding is generation robustness.

### Run ledger

| Run | Payload | Longest string | Field |
|-----|---------|----------------|-------|
| guided #0   | 6,666 B | 236 | (normal) |
| guided #1   | **342,377 B** | **337,382** | `quickFacts.whereItHappens` |
| guided #2   | **CRASH** | — | `Unterminated string … position 457558` |
| sequence #0 | **26,063 B** | **20,784** | `quickFacts.whereItHappens` |
| sequence #1 | 6,632 B | 236 | (normal) |
| sequence #2 | **14,847 B** | **9,047** | `quickFacts.whereItHappens` |
| predict #0  | 6,418 B | 282 | (normal) |
| predict #1  | 7,815 B | 282 | (normal) |
| predict #2  | **106,679 B** | **98,495** | `steps[0].whatsHappening` |

A healthy payload is **~6.5 KB**. Runaways ran 2×–52× that; the crash ran ~73×.

## Issues

### all modes — HW-4: single-string repetition loop → unterminated JSON

- **Severity:** CRITICAL (intermittent, ~11% crash / ~56% degraded)
- **What's broken:** flash-lite falls into token repetition inside **one free-text
  string field** and runs to the model's 65,536-token output ceiling. Nothing in
  the generator bounds it: no `maxOutputTokens`, no retry, no degrade, no output
  length validation, and `JSON.parse(response.text)` at
  [gemini-how-it-works.ts:709](../../src/components/lumina/service/core/gemini-how-it-works.ts#L709)
  is unguarded — the raw `SyntaxError` is re-thrown to the build pipeline.
- **Data:** `quickFacts.whereItHappens` =
  `"Deep underground and at tectonic plate boundaries on the Earth's surface crust surface crust surface crust …"`
  — `"surface crust"` × ~1,700, then it breaks out with
  `"…crustal pressure drop-off caused by magma rising through volcanic conduits."`
- **Fix in:** GENERATOR

**This is NOT the unbounded-array signature.** SP-6's standing template says
"bound EVERY array with `minItems`/`maxItems`". That would not have prevented a
single one of these five runaways — `steps` (4-6) and `challenges` (3) were
correctly sized in every run. The overflow lives *inside one string value*.
Array bounds are still worth adding as cheap insurance, but they are not the fix.

**Where it loops, and why.** 4/5 runaways hit `quickFacts.whereItHappens`, 1/5
hit `steps[].whatsHappening`. Both are open-ended elaboration fields with (a) no
length guidance in the schema description and (b) explicit prompt pressure to
fill them regardless of whether there is anything to say:

- `whatsHappening` — *"ALWAYS provide this"* (prompt line 618)
- `quickFacts` — *"Provide at least 3 of these 5 fields"* (prompt line 630)

`whereItHappens` for "how a volcano erupts" has a genuinely 6-word answer. The
prompt demands elaboration anyway, the model pads, and padding is exactly the
state that induces repetition degeneracy. The two least pedagogically
load-bearing fields in the schema are producing 100% of the crashes.

### all modes — HW-5: runaway string renders unclamped into the Quick Facts card

- **Severity:** HIGH
- **What's broken:** on the 4/9 runs that ran away but still parsed, the payload
  reaches the component intact. `validateHowItWorksData` does
  `qf.whereItHappens = String(raw.quickFacts.whereItHappens)`
  ([gemini-how-it-works.ts:328](../../src/components/lumina/service/core/gemini-how-it-works.ts#L328))
  with no length cap, and `quickFactEntries`
  ([HowItWorks.tsx:220-232](../../src/components/lumina/primitives/visual-primitives/core/HowItWorks.tsx#L220-L232))
  maps every truthy entry into a rendered card. A 337 KB string lands in the
  "📍 Where" card. Not browser-verified, but there is no clamp anywhere on the path.
- **Data:** `quickFacts.whereItHappens.length = 337382`
- **Fix in:** GENERATOR (clamp in validation) — component clamp optional as belt-and-suspenders

### harness — HW-6: eval-test reports `status: pass` on a 342 KB runaway

- **Severity:** HIGH
- **What's broken:** the route's `validation` block only reports
  `challengeCount` and `typesFound`. Run guided #1 returned
  `status: "pass"` with a 337 KB repetition loop in the payload. Any sweep that
  trusts `status` is blind to this whole failure class — which is likely why
  how-it-works last showed 1/3 on 2026-05-03 without this surfacing.
- **Fix in:** eval-test route (add a payload-size / longest-string assertion)

## Is the schema "too complex"?

Partly — but complexity is the *aggravator*, not the cause.

**Genuinely over CLAUDE.md's bar:** 5 object types (root, step, challenge,
summary, quickFacts) vs. the stated "3-4 types max", ~44 total fields, and
`challengeSchema` alone carries 18 properties (10 of them the flat
`sequenceItem0..4Id/Text` slots). The prompt compounds it — "MAGAZINE-QUALITY",
"at least 2-3 key terms", "at least 3 funFacts", "at least 3 of 5 quickFacts",
plus a long `imagePrompt` per step. That is a lot of low-anchor prose to invent,
and prose-under-pressure is where flash-lite degenerates.

**But trimming types alone would not fix it.** The proximate cause is the missing
backstop: nothing caps output, nothing retries, nothing degrades. Fix that first
(it makes the failure survivable), then reduce the pressure that triggers it.

## Recommended fix, in leverage order

1. **`maxOutputTokens: 8192`** — a clean payload is 6.5 KB (~2K tokens), so this
   is 4× headroom and turns a 65K-token runaway into a fast, cheap failure.
2. **Bounded retry (2 attempts) + degrade, never throw** — mirror
   `gemini-vocabulary-explorer.ts:539-577`. Log `finishReason` + char length.
   Generators run under `Promise.all`, so a throw costs the whole exhibit.
3. **Clamp string lengths in validation** — cap every free-text field at a sane
   ceiling (e.g. 400 chars for descriptions, 120 for quickFacts). This is the
   only thing that protects the render path on a *parsed* runaway (HW-5).
4. **Relieve the pressure on the two culprit fields** — add explicit length
   limits to the schema descriptions ("one short phrase, under 15 words"), and
   drop "ALWAYS provide" / "at least 3 of 5" to "only where there is something
   real to say". `quickFacts` is decorative; it should not be able to crash a lesson.
5. **Bound the arrays** (`steps` 4-6, `challenges` 3-4, `realWorldExamples` 2-4,
   `relatedProcesses` 2-3) — cheap insurance, not the fix here. Note `maxItems`
   works fine on `@google/genai` 1.52.0 (live in vocabulary-explorer,
   phoneme-explorer, poetry-lab, comparison-builder, knowledge-check); the
   decodable-reader 400 INVALID_ARGUMENT note appears to be stale or specific to
   that schema shape — re-probe before trusting either way.

Optional follow-up: consider dropping `quickFacts` entirely, or splitting the
magazine content from the challenge content into two calls. Both reduce the type
count toward the 3-4 target, but neither is required to stop the crash.

## Prior issues — status

- **HW-2** (challenge padding with hardcoded `identify`) — appears **fixed**;
  padding removed, see the comment at
  [gemini-how-it-works.ts:448-453](../../src/components/lumina/service/core/gemini-how-it-works.ts#L448-L453).
  Observed types matched the mode in all 9 runs.
- **HW-3** (dropped `sequenceItem*` → empty `correctOrder`) — appears **fixed**;
  the authored-order fallback at
  [gemini-how-it-works.ts:424-441](../../src/components/lumina/service/core/gemini-how-it-works.ts#L424-L441)
  held on every sequence run.
- **HW-1** (explain click no-op) — not re-verified this run; needs a browser check.
