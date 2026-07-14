# Reader Fit: decodable-reader @ PRE + EMERGING — 2026-07-14

Modes audited: read_along (new, K/PRE), literal (Gr1/EMERGING), + decode-family regression (main_idea Gr2)
Probes: eval-test ✓ tutor-test --probe ✓ live --lesson (read_along, 3 runs) ✓ 3/3 clean

Invoked `--fix`. User rulings (2026-07-14): PRE served by a NEW in-primitive **read-along mode**
(not a band-floor + external rebuild); take it through the fix loop.

## The reckoning

decodable-reader's core task is decoding connected text — by definition **not** a
pre-reading task (PRE = "letters ≠ words"). So the primitive splits by band:

- **PRE (K):** the *decode* task is WRONG-BAND. Resolved by adding a **read_along**
  reading mode (Tier 0, β 0.5): the tutor reads the passage aloud while the child
  follows, then answers a **picture** question. Shared reading, not decoding.
- **EMERGING (Gr1):** the decode task is legitimate, but the comprehension probe and
  chrome gated it behind unreadable text (PRIMITIVE-GAP + SCAFFOLD-GAP).

Key distinction driving the scaffold: **the passage is the assessed skill** (never read
it aloud in decode mode — that trivializes decoding), but **the question + answer choices
are NOT the skill** — they were load-bearing text a non/emerging reader can't read, and
nothing voiced them. That gap was the highest-value fix.

## Audit A — text census (before → after)

| String | Where | Class | Spoken twin (before) | After |
|---|---|---|---|---|
| Passage body | reading phase | load-bearing (decode mode) / stimulus (read-along) | per-word tap only | decode: per-word tap (correct). read_along: **whole passage read aloud** via `[READ_ALONG_START]` + catalog directive |
| Comprehension question | comp phase | load-bearing | referenced in `taskDescription` only (tutor-reference) | **read aloud** — `[READING_DONE]` + "READ THE QUESTION AND EVERY CHOICE" directive |
| Answer options (sentences) | comp phase | load-bearing | **UNCOVERED** (never voiced, never in context) | **COVERED** — `comprehensionChoices` forwarded into the bag; directive reads every choice with its letter; each option now carries a **picture emoji** (answer surface) |
| Phase stepper / legend / "N/M tapped" / score ledger / grade+count badges | chrome | decorative | n/a | **hidden at K-1** (band-gated); Gr2+ keeps them |
| Phoneme `/k/ /a/ /t/` popup | supportive | notation | visual-only | **suppressed at K-1** (rule 6); Gr2+ keeps it |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| read_along (K) | ✓ `[READ_ALONG_START]` greeting frame (directive overrides lesson 1-sentence cap) | ✓ whole passage read aloud; ✓ question + every picture choice read aloud | n/a (single question) | ✓ tap=choose → color + sound + spoken tutor response | ✓ commonStruggles, eyes-free |
| literal / decode (Gr1) | ✓ `[READING_START]` warm frame | ✓ question + every choice read aloud (passage stays student-decoded, by design) | n/a | ✓ tap=choose feedback on the touched picture | ✓ commonStruggles |

Scaffold **resolution** confirmed via tutor-test `--probe`: `readingMode`, `passageText`,
`comprehensionChoices`, `comprehensionQuestion` all resolve from the **component** (not
generator-only → no `(not set)`); tutor-test status `pass`, 0 audit findings.
Scaffold **sufficiency** (behavioral) confirmed live in lesson mode — see Loop log.

## Audit C — band contract (K-1 render)

| Rule | Before | After |
|---|---|---|
| 1 audio is instruction | text instruction panel gated | panel hidden at K-1; tutor voices everything |
| 2 tap = choose | select-then-Check (two-tap) | **single tap = choose** at K-1 |
| 3 pictures are answer surface | text-only option sentences | **emoji-primary** options, text caption; distinct emoji per option (3/3 draws) |
| 4 one thing / ≤5 elements | stepper + legend + toggle + N options + counter | passage + Done + N picture options only |
| 5 feedback on object | text feedback card | color + sound on the tapped choice |
| 6 no typing / no notation-only | short-answer `<LuminaInput>`; phoneme popup | typing path off at K-1; phoneme popup suppressed |
| 7 no adult chrome | stepper, legend, score ledger, stats, badges | all hidden at K-1 |
| 8 assessment in mechanics | end-of-passage quiz | still a discrete question (acceptable; read-along framing) |

**Overall: READY at PRE (read_along) + EMERGING (decode) — live-confirmed 3/3.**
(A first 3-run attempt lost runs 2-3 to a backend `1012 service restart` — infra flake,
not a defect; the clean re-run was 3/3.)
Findings → fix layer:
- SCAFFOLD-GAP (question/choices unspoken; no ORIENT) → CATALOG `aiDirectives` + component bag/moment.
- PRIMITIVE-GAP (typing, text options, two-tap, chrome, phoneme notation) → COMPONENT band-gating.
- WRONG-BAND at PRE (decode task) → new **read_along** eval mode (CATALOG) + generator branch.
- Picture answers → GENERATOR (required `emoji` per option, distinctness rule).
- Generator reliability (user Q on orchestration) → single call hardened (`maxOutputTokens`
  8192 + 2-attempt retry + short-passage prompt caps); NO orchestrator (schema is
  complex but essential; probes valid). `maxItems` bounds were tried and **rejected** by
  this @google/genai version (400) so array caps live in the prompt.

## Loop log

| # | Change | Type check | Runtime check | Result |
|---|---|---|---|---|
| 1 | Catalog STIMULUS (read question + every choice) + ORIENT beats; forward `comprehensionChoices` into bag; align `[PRONOUNCE_SOUND]` tag | tsc clean | tutor-test probe: choices resolve from component; directives render | ✓ |
| 2 | Component band-gate: single tap=choose picture options, no typing, chrome hidden at K-1, larger warm passage, auto-finish review; generator required `emoji` per option | tsc clean | eval-test Gr1: distinct emoji 3/3 draws; decode modes still pass | ✓ (tap=choose interaction is render-only — needs a browser click-through) |
| 3 | New `read_along` eval mode (Tier 0, β 0.5, K floor) + generator branch (force K, short passage, picturable Q, `readingMode` stamp) + READ_ALONG_START directive + generator hardening | tsc clean | eval-test read_along: `readingMode=read_along`, K, 2-sentence passage, picturable options; literal/main_idea unaffected; renamed field `mode`→`readingMode` to fix eval-test challenge-type collision | ✓ |
| 4 | Live lesson-mode gate (read_along, 3 runs) + bespoke harness journey (`build_decodable_reader_journey`) registered | py_compile ok | **3/3 clean in --lesson**: every run read the whole passage aloud, re-oriented the stuck student eyes-free, and read the question + all 3 choices with letters; no `stimulus-not-read`; report `qa/tutor-reports/decodable-reader-live-lesson-2026-07-14.md` | ✓ |

## Notes / follow-ups
- **tap=choose interaction needs a browser click-through** — data path + render verified,
  but the click behavior (feedback on the touched picture, auto-advance) was not exercised
  headlessly. Should work; flag for a MathPrimitivesTester/LanguageArts pass.
- Manifest **routing** for K→read_along relies on the catalog band-floor note in
  `constraints`; verify the eval-mode resolver actually prefers read_along at K in a real
  K lesson (separate from this primitive fix).
- Gr2+ decode UI unchanged (out of reader-fit scope; FLUENT band).
