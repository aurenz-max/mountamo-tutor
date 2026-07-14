# Reader Fit: word-sorter @ PRE — 2026-07-14

Modes audited: binary_sort, ternary_sort, match_pairs (all three claimed at K via
"ESSENTIAL for K-2" catalog description) | Probes: eval-test ✓ (3 modes, grade=K)
tutor-test --probe ✓ (status: **fail**, 3 HIGH) | live: not run — scaffold fails on
paper; live lesson-mode run is the post-fix verification step, not needed to
establish these findings.

Backlog item 4 (audit rank 2 from the 2026-07-12 cognitive-load audit). Invoked
without `--fix` — audit only.

## Phase 0 — artifacts

- Component: `src/components/lumina/primitives/visual-primitives/literacy/WordSorter.tsx`
- Generator: `src/components/lumina/service/literacy/gemini-word-sorter.ts` (orchestrator, 3 per-mode sub-generators)
- Catalog: `src/components/lumina/service/manifest/catalog/literacy.ts` (~line 1692)
- Worst-case renders observed: ternary K draw = **0/8 word emojis** (K guideline says
  "every word card MUST have an emoji" — schema doesn't `require` them, so flash-lite
  drops them); match_pairs = **match column has 0 emojis in all 3 challenges** across
  the draw (`pairNMatchEmoji` optional, never emitted); rhyme challenge (Pig→Wig,
  Cat→Hat) shipped with zero emojis on either column.

## Audit A — text census

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| Challenge instruction ("Sort these words by what the animal does: Walk, Swim, or Jump.") | LuminaPanel | Load-bearing | `[ACTIVITY_START]`/`[NEXT_ITEM]` sendText include it, but the directive's canned quote ("Let's sort some words together!") doesn't enact it; **no catalog aiDirectives** → droppable under the lesson one-sentence cap | **UNCOVERED (lesson)** / weak standalone |
| Word chip text (cat, jump, march, trot…) | Word pool | Load-bearing (the sortable object) | None — `handleWordClick` plays tap SFX only, no tap-to-hear; emoji carries meaning only when present (0/8 in ternary draw) | **UNCOVERED** |
| Bucket labels ("Farm Animals" / "Zoo Animals" / "Small/Medium/Big") | Bucket headers (the answer surface) | Load-bearing | None — `bucketLabels` is a contextKey (tutor reference only); no icon field exists in the schema | **UNCOVERED** |
| "Tap a word, then tap the bucket it belongs in:" | Small text above pool | Load-bearing (protocol) | None; bucket buttons are `disabled` until a word is selected, so bucket-first taps do nothing (silent dead end) | **UNCOVERED** |
| "Tap a word on the left, then tap its match on the right:" | match_pairs | Load-bearing (protocol) | None | **UNCOVERED** |
| Match column words (Slow, Night, Wig…) | Right column | Load-bearing | None; no emoji in any observed draw | **UNCOVERED** |
| 'Try again — "lion" doesn\'t belong in "Farm Animals".' | Transient feedback card (2s) | Load-bearing (correction) | `[ANSWER_INCORRECT]` silent send → tutor speaks a hint | COVERED |
| "Correct!" | Transient feedback card | Supportive | `SoundManager.playCorrect()` | COVERED |
| "Next Challenge →" | LuminaActionButton | Load-bearing (gates advance) | None — only active element at that moment, discoverable-ish | UNCOVERED (weak) |
| Title, description, "1 / 3", "N wrong", "📂 Two Buckets", "WORDS"/"MATCHES" headers, "All words sorted!", PhaseSummaryPanel | Chrome | Decorative/adult | — | rule-7 offenders (Audit C) |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| binary_sort | **FAIL** — canned greeting doesn't state the task; no aiDirectives beat; dropped in lesson mode | **FAIL** — words + bucket names never guaranteed spoken; no tap-to-hear | **FAIL** — sort criterion lives only in on-screen instruction text; no script enacts "Is it an animal, or something animals DO?" | PASS (SFX right/wrong + spoken hint on wrong) — caveat: "N wrong" badge | **FAIL** — see below |
| ternary_sort | **FAIL** (same) | **FAIL** (worse: 0-emoji draw = pure text) | **FAIL** (same) | PASS (same caveat) | **FAIL** (same) |
| match_pairs | **FAIL** (same) | **FAIL** (worst: match column always text-only; rhyme-matching by TEXT requires decoding — a phonological task delivered via print) | **FAIL** (same) | PASS (same caveat) | **FAIL** — all 3 commonStruggles are bucket-specific; none covers pair-matching at all |

RECOVER detail (all modes): scaffold scripts **assume decoding** ("Read it aloud",
"look at the bucket labels — which group…"); hardcode noun/verb/adjective
metalanguage regardless of the actual criterion (this draw sorts farm vs zoo
animals — the hint is simply wrong); Level 2 renders `The word is (not set)… Is it
a Animals,Food word?` (unresolved `{{currentWord}}` + raw array join); Level 3
renders `(not set) is a (not set) word…` AND is the TU-3 answer leak
(`{{correctCategory}}` in a spoken line — naively resolving the key would START
leaking; reword instead); struggle #1 contains a literal `[word]` placeholder the
tutor would read verbatim.

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1. Audio is the instruction channel | **FAIL** | Instruction panel + protocol line gate progress; intro droppable in lesson mode |
| 2. Tap = choose | **FAIL** | Two-tap word→bucket and term→match; buckets disabled until a word is selected (bucket-first taps silently do nothing) |
| 3. Pictures are the answer surface | **FAIL** | Words primary, emoji an optional inline prefix; bucket labels text-only (no icon field); worst-case draws ship zero emojis |
| 4. One thing per screen, ≤5 elements | **FAIL** | binary 6-8 words + 2 buckets = 8-10; ternary up to 13; match_pairs 10 |
| 5. Feedback on the touched object | **FAIL** | Centered transient text card (2s); wrong-word chip gets no animation; "N wrong" = quantitative error prose. SFX partially compensates |
| 6. No typing | PASS | — |
| 7. No adult chrome | **FAIL** | "1 / 3" counter, "N wrong" amber badge, challenge-type badge, description paragraph, WORDS/MATCHES uppercase headers, PhaseSummaryPanel score ledger |
| 8. Assessment hides in mechanics | PASS | The sort itself is instrument-like; attempt-based partial credit is silent |

**Overall: PRIMITIVE-GAP** — the bucket-sort core is sound (not REBUILD), but at PRE
the surface is text-primary, two-tap, over-populated, and chrome-laden; the scaffold
beneath it is insufficient AND broken; match_pairs shouldn't claim PRE at all.

Findings → fix layer:

1. **SCAFFOLD-GAP (HIGH, all modes) → CATALOG.** No ORIENT/STIMULUS/DISAMBIGUATE
   beat. Add `aiDirectives` (survives the lesson one-sentence cap — the
   addition-subtraction-scene pattern): at challenge start, state the sort in child
   terms, NAME each bucket aloud, and ask the criterion question ("Which side has
   the animals?"). Component `[ACTIVITY_START]`/`[NEXT_ITEM]` sends may reinforce
   but are droppable alone.
2. **SCAFFOLD-GAP (HIGH, all modes) → CATALOG.** Reword all three scaffoldingLevels
   + commonStruggles: eyes-free (never "read it" / "look at the labels"),
   criterion-agnostic (drop hardcoded noun/verb/adjective), no `{{currentWord}}` /
   `{{correctCategory}}` (TU-3: reword, do NOT resolve the key), no `[word]`
   literal, add a match_pairs struggle. Optionally forward `selectedWord` into
   `aiPrimitiveData` for a spoken-safe "the word you're holding" reference.
3. **PRIMITIVE-GAP (HIGH) → COMPONENT.** Band-gate a PRE presentation
   (`gradeLevel === 'K'`): one word staged at a time (big, emoji-primary, word as
   caption) with tap-a-bucket = choose (collapses two-tap, drops element count to
   1 + buckets); tap-to-hear on the staged word and bucket headers; feedback lands
   on the object (chip shake/settle animation); hide "N wrong", counter, type
   badge, description at PRE (also record to K-stage systemic item).
4. **GENERATOR (HIGH) → Tier 3.** Emojis are schema-optional so K draws ship
   without them: add `wordNEmoji` to `required` at K, add a `bucketEmoji` field,
   require `pairNMatchEmoji`. Same pilot-then-sweep discipline as topic-fidelity.
5. **WRONG-BAND (routing) → CATALOG.** match_pairs @ PRE: text↔text rhyme/antonym
   matching requires decoding by design (Tier 3, β 3.5). Set a band floor (grade
   1+) in the eval mode / tighten the catalog description so K routes only to
   binary_sort (and ternary_sort once picture-primary). Rhyme-matching at K should
   be an audio task, not a print task.

## `--fix` loop log (2026-07-14, same day)

| # | Slice | Change | Verification | Re-audit |
|---|---|---|---|---|
| 1 | CATALOG + bag (RF-1, RF-2, TU-3) | `aiDirectives`: "SAY THE SORT OUT LOUD FIRST" (ORIENT — instruction in child terms + name every bucket + ask the sorting question; overrides the lesson one-sentence cap) + "SAY WORD CARDS ALOUD" (`[WORD_STAGED]`/`[WORD_TAP]`). All 3 scaffoldingLevels + struggles reworded eyes-free, criterion-agnostic; `{{currentWord}}`/`{{correctCategory}}`/`[word]` gone; match_pairs struggle added. Bag: `challengeNumber`, `selectedWord` (stimulus only). | typecheck:lumina 0-err; tutor-test probe **fail→pass, 0 findings** | Audit B ORIENT/STIMULUS/DISAMBIGUATE/RECOVER now enacted on paper |
| 2 | COMPONENT PRE band-gate (RF-3) | `gradeLevel==='K'`: one staged word card (emoji-primary, 🔊 tap-to-hear), tap-a-bucket = choose, `[WORD_STAGED]` announce per word (latched per challenge+word), bucket-flash object feedback, chrome hidden (counter, type/attempt badges, instruction paragraph, protocol line, feedback text card, description). Reader grades unchanged. `bucketEmojis?: string[]` added to challenge type. | typecheck:lumina 0-err; **6/6 jsdom behavioral tests** (`WordSorter.test.tsx`: staging, announce-once, tap=choose, no-leak on stage, no text correction at PRE, reader control); user browser check confirmed the K render | Audit C rules 1-6, 8 PASS at PRE; rule 4 now 3-4 elements |
| 3 | GENERATOR (RF-4) | Word emojis + `bucket0-2Emoji` REQUIRED in schema at K; match term+match emojis required at K-1; prompts updated; reconstruction emits `bucketEmojis` | 5 fresh eval-test draws @ K/1: **15/15 challenges full emoji coverage** (was 0/8 ternary, 0-emoji match column) | Audit A: pictures now the answer surface in worst-case draws |
| 4 | ROUTING (RF-5) | match_pairs description now leads "Grade 1+ ONLY (never Kindergarten — text-to-text matching requires decoding)" (within the resolver's 160-char read) + `BAND FLOOR:` clause in constraints | text change; decodable-reader precedent | WRONG-BAND routed |
| 5 | Live behavioral gate | Added `build_word_sorter_journey` to `run_tutor_live.py` (verbatim `[ACTIVITY_START]`/`[WORD_STAGED]`/`[ANSWER_INCORRECT]`/`[NEXT_ITEM]` replays; ORIENT bar = every bucket + question word; STIMULUS bar = staged word spoken; leak bar = correct bucket never asserted) | `--lesson --runs 3`: **all beats spoke 3/3; zero confirmed findings** — no `stimulus-not-read`, no `answer-leak-live`, no `not-set-spoken`. e.g. activity_start: "Let's sort things into 'Animals' and 'Things We Do!' Our buckets are Animals and Actions." word_staged: "pig". Report: `qa/tutor-reports/word-sorter-live-lesson-2026-07-14.md` | Audit B confirmed behaviorally in LESSON mode |

**Final verdict: READY @ PRE (binary_sort, ternary_sort); match_pairs = WRONG-BAND, floored to Grade 1+.**

Residuals (recorded, not blocking):
- PhaseSummaryPanel score ledger still renders at completion (rule 7) → K-stage
  systemic item (LuminaCompletionScreen roadmap).
- "Next Challenge →" is still a text button (single active element, arrow icon —
  discoverable; candidate for the K-stage wordless-advance pattern).
- `tag-syntax-spoken` at 1/3 runs (one run voiced "[PRONOUNCE] pig") — unconfirmed
  single-run note; global tutor-prompt hygiene, not primitive-local.
- EMERGING (grade 1) follow-up: match_pairs words aren't spoken on tap; the
  EMERGING contract wants single words spoken on tap — queue with the grade-1
  pass, out of PRE scope.
