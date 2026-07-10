# Birth Certificate — word-flip (2026-07-10)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core mode, generic tutor.
**One deliberate L5 pull-forward:** the spoken-production beat (`useVoiceAnswer` open mic, PictureVocabulary archetype) ships at birth — spoken production IS this primitive's thesis ("grammar as single spoken words", K Spoken-First slate POC-2), so it is the core interaction, not polish. `/add-spoken-judge`'s row below is therefore already satisfied; what remains at L5 is `/add-sound` and a Voice Studio bench for the plural-final-s content class.

- Core task identity: `plural_s` (regular -s plurals from a counted-picture frame; child says the transformed word)
- Generator fork: content-bearing single-call pool — Gemini authors ONLY `{word, emoji}` nouns (12-16, entropy via 8 shuffled SEED_NOUNS injected into the prompt); code derives answer (`word+'s'`), chips (`[answer, singular, over-regularized 'wordses']`), counts (2-5 with variety) deterministically. The transformation rule IS the answer key — no desync possible.
- sendText tags wired: [ACTIVITY_START] (frame-once), [SPOKEN_MATCH] (first-voice/comeback only), [ANSWER_INCORRECT], [ANSWER_REVEALED], [ALL_COMPLETE]. Quiet-by-default: per-round the tutor is SILENT (frame self-evident on screen). PROMPT LAW: tutor may say the singular, NEVER the plural form.
- Answer-leak audit: singular is the stimulus (shown by design); the plural form never renders pre-solve (blank with underline); chips include the answer as the receptive support net — the same accepted tradeoff PictureVocabulary ships (spoken evidence is flagged separately via `spoken: true` on results + `spokenWords` extras).
- Design gate (Phase 2):
  1. Direct manipulation — **chosen exception:** the learning object is a spoken word-form; production-by-voice is the core interaction; chips are fallback only.
  2. Living simulation — pass: the counted frame embodies one-vs-many semantics (emoji.repeat(count)); code owns count/emoji state.
  3. Production over recognition — pass: spoken production is the primary judged path.
  4. No visible timers — pass: none; duration silent in metrics.
  5. No answer-leak by layout — pass: plural never printed pre-solve; chip tradeoff documented above.
- Curriculum home: **MATCH LA004-03 "Plurals & Articles" @ K (0.790, coherence 5/5)**. G1 abstain-diffuse is a coherence-rule artifact (correct skill LA001-04 ranks #1 but is a single-subskill family) — see qa/curriculum-fit/word-flip-2026-07-10.md.
- QA at birth: eval-test 3/3 runs PASS (all G1/G2/G4/G5; zero plural-guard leaks; noun entropy confirmed across runs; count variety confirmed). Report: qa/eval-reports/word-flip-2026-07-10.md. **NOT voice-smoked in a browser yet** — see queue.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 0 | **Browser voice-smoke + Voice Studio bench** | verify | Plural-final-s minimal pairs ("dog" vs "dogs") are a NEW judge content class — bench in Voice Studio before trusting spoken credit; then the ~5-min voice-smoke checklist (correct word credits+advances, wrong/gibberish never penalizes, ✕-stop → tappable orb, Ctrl+M kills mic, tap-only path identical) |
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder candidates from the POC-2 design: `article_choice` (β≈2.5, TAP-ONLY by design — "a/an" is a single unstressed phoneme, hostile to any speech judge), `plural_es` (β≈3, boxes/dishes), `pronoun_swap` (β≈3.5, Sam→he with picture disambiguation), `verb_past` (β≈4, today/yesterday frame), `irregulars` (β≈5+, mice/ran/went — where spoken production is exactly the wanted evidence). Each mode needs its own deterministic transformation validator (the -es rule set, the pronoun table, an irregulars dictionary). |
| 2 | `/add-tutoring-scaffold` | L2 tutored | contextKeys candidates: challengeType, currentChallengeIndex, totalChallenges, attempts, voiceMode. Struggles to scaffold: tapping the bare singular (no plural marking), tapping the over-regularized form ("dogses" — teach that -s already did the job). aiDirectives must carry the PROMPT LAW (never say the answer form; singular is safe). |
| 3 | `/add-support-tiers` | L3 tiered | Withdrawable scaffolding intrinsic to the interaction: the chip count (3 → hide chips until first miss → no chips), the printed singular word (word+picture → picture-only), the count word label ("Three" → numeral → nothing). |
| 4 | `/add-structural-difficulty` | L4 shaped | (requires L3) Structural lever: noun phonological complexity (CVC dog → CCVC+cluster-final desk? NOTE cluster-final words often end s-adjacent — re-derive the safe set) and count size; once L1 lands, mode mix IS the structural axis. |
| 5 | `/add-sound` | L5 polished | Candidate sound points: chip tap (select), count-frame reveal per emoji (tick ×count — a counting earcon), spoken-match celebration (already playCorrect via hook). |
| ✓ | `/eval-test word-flip` (`&evalMode=plural_s`) | QA loop | NOTE: the eval-test route requires BOTH componentId and evalMode to enter single-test mode — bare componentId falls through to catalog mode. Re-run after every layer. |
