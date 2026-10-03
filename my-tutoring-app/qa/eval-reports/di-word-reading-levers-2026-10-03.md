# di-word-reading levers: DI family 5 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 3. Table and failure inventory: `qa/support-levers/di-word-reading-lever-table-2026-10-03.md`. No real-learner evidence: every failure is synthetic (the spoken-miss ids, the JEV probes) or documented.

## What was built

| Item | Help | Simplify |
|---|---|---|
| decodable (cvc_reading; read_word and review on a CVC word) | `model_word` (a different picturable CVC word, blended), `blend_slide`, `sound_dots`, `tracking_arrow` | `short_word` (two letters, R7) |
| sight (sight_word; read_word and review on a sight word) | `model_word` (a different sight word, said whole) | none (R6) |

- **Tier harness (new):** the generator stamps `supportTier` per challenge when `config.difficulty` is a tier; no tier means easy, as in the other DI packs.
- **Model rules:** never a session word, no shared letter with the item, never reversed, never a sight look-alike. Sight pool adds you, are, was, said, of to the menu's eight.
- **Miss lists per mode:** cvc_reading 6 ids, sight_word 3, read_word and review all 7.
- **Catalog guidance** trimmed to fit the 2000-character offer cap with the lever doctrine added.
- **Verdict probe** (`scripts/tutor-verdict-probe.mjs`) now replays the starting-lever facts for words and letters, as the stage publishes them.
- **Replay check fix (class):** a sight word that is also a function word ("and", "the", "is") counted as said whenever the tutor used the word in its own sentence: 19 of 25 lines flagged falsely. `replay_checks.said_key` now counts such a key only when quoted or said as the word ("this word says the"); pinned both ways in `test_replay_checks.py`.
- **New payload:** `di-word-reading.cvc_reading-hard.json` (the saved words at tier hard), so the replay sees the model pulled.

**Size:** 130 lines of lever module and about 130 of component, domain, generator and catalog change, against 220 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diWordReadingLevers.test.ts`, 17) | leak table; every menu word has a safe model alone, and in a six-word worst case; saved items; blend; `short_word` rules; lever set; starting positions; miss → lever; every catalog miss answered, every named miss listed |
| Mounted (`DiWordReading.levers.workspace.test.tsx`, 4) | dots and arrow draw no text and the next try carries both; easy model shares no letter; short word ungraded then the full word credited; a sight word has only the model and refused pulls change nothing |
| Dry journey J1-J9 | 5/5 payloads |
| typecheck | lumina 0 |
| Text replay (Flash, 5 payloads × 5) | 0 flags after the check fix (19 false flags before it, all "and"). The model is voiced "My turn: fff-ooo-ks, fox"; a sight model is said whole |

## Not covered

- A sight word the child does not know has no lever (R6); a delayed re-ask would need a stage mechanism.
- Not browser-checked (HUMAN-CHECKS #183, word-reading row: a second printed word on screen at easy). No Live run: the DI class gate waits for all 37 DI modes.

## Next

DI family 6, di-sentence-reading (plan step 4).
