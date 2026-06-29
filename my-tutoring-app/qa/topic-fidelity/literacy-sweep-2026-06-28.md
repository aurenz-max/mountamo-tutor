# Topic Fidelity: Literacy line (26 generators) — 2026-06-28

Scope: every literacy generator under `service/literacy/gemini-*.ts`. Question: do
`topic` **and** `intent` reach student-facing output?

## Diagnosis

All 26 register via `registerContextGenerator` and receive the whole `ctx`, so the
registry-level intent drop (mechanism #1) cannot occur — `ctx.topic`/`ctx.intent` are
delivered to every generator. The failure was downstream in the prompt:

| Field | Status (before) | Evidence |
|---|---|---|
| `topic` | **HONORED** — all 26 | Interpolated into every prompt (`Create … about: "${topic}"`). Probe: ocean→"bioluminescent/Deep in the ocean", Egypt→"Nile River". Tracks. |
| `intent` | **DEAD FIELD** — all 26 | 24 never referenced `ctx.intent`; `character-web` `void _i`'d it (line 214); `syllable-clapper` set `config.intent` but the prompt only used `topic`. None interpolated it. |

Empirical confirmation (context-clues-detective, topic held FIXED = "weather", intent varied):

| Probe | intent | result | verdict |
|---|---|---|---|
| C (before) | desert/camels | meteorologist, gale (generic) | intent dropped |
| D (before) | arctic/polar bears | severe, humidity (generic) | intent dropped |
| C2 (after) | desert/camels | **arid, desolate, "golden sand dunes"** | tracks |
| D2 (after) | arctic/polar bears | **glacier, fragile, "North Pole"** | tracks |

**Verdict:** systemic FIDELITY BUG on the intent half → fixed at **Tier 1** across all 26.

## Fix (Tier 1 — prompt interpolation, no schema change)

Each generator now reads `const intent = ctx.intent;` and interpolates a guarded
`SPECIFIC FOCUS:` block into its main prompt, after the topic line. Two framings:

- **Content-flexible (17):** "the broad lesson is `${topic}`, but THIS activity must
  target: `${intent}` … never reveal the answer in this focus text."
  `paragraph-architect, sentence-builder, story-map, evidence-finder,
  context-clues-detective, opinion-builder, text-structure-analyzer, character-web,
  figurative-language-finder, poetry-lab, story-planner, revision-workshop,
  genre-explorer, spelling-pattern-explorer, read-aloud-studio, decodable-reader,
  word-sorter`
- **Phonics/foundational (9):** "lean word/letter choices toward `${intent}` when
  possible — but ALWAYS prioritize the phonics accuracy rules below." (intent largely
  duplicates eval-mode here; framed to defer, never override decoding constraints.)
  `phonics-blender, cvc-speller, letter-spotter, letter-sound-link, rhyme-studio,
  syllable-clapper, phoneme-explorer, sound-swap, word-workout`

Helper-threaded generators (`word-workout`, `word-sorter`) had `intent` threaded
through their sub-generator signatures (`getModePrompt`/`generateModeChallenges`,
`generate{Binary,Ternary,MatchPairs}SortChallenges`).

Guard: `${intent ? … : ''}` — absent intent is a no-op, so the grade-band/topic
default is unchanged (no regression).

## Verify

- `tsc --noEmit`: **1417** errors (baseline 1419) — no new errors; none in `literacy/gemini`.
- Re-probe: intent now tracks (C2/D2 above); topic still honored; no-intent path unchanged.
- No answer leak: focus block carries an explicit "never reveal the answer" guardrail.
