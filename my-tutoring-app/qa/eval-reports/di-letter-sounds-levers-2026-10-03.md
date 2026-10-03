# di-letter-sounds levers: DI family 4 (2026-10-03)

`/add-support-tiers`, plan `qa/support-levers/di-lever-plan-2026-10-03.md` step 2. Table and failure inventory: `qa/support-levers/di-letter-sounds-lever-table-2026-10-03.md`. No real-learner evidence: every failure is synthetic (the spoken-miss ids) or documented (catalog `commonStruggles`).

## What was built

| Mode | Help | Simplify |
|---|---|---|
| letter_sound, letter_sound_review | `model_sound`, `keyword_picture` (R4), `sound_arrow` (held letters) | none |
| first_sound_in_word | `model_sound` (a different picture and word), `first_box` | none |

- **R4:** the keyword picture is no longer drawn at every tier on a letter item. It starts on screen at easy and is a pull, recorded as help, at medium and hard. Its demonstrate target exists only while it is drawn. To make that possible the shared stage now passes the item's levers to the pack's `scene` (`DiTeachingStage`, one line; other packs ignore it).
- **Model rules:** a different letter of the same kind (held, clipped, short vowel; held only on onset items), never the item's sound (c/k), its confusable or voicing partner, a letter of its keyword, or a letter still to come.
- **Miss lists per mode:** `last_sound` is listed on first_sound_in_word only.
- **Pure menu:** `LETTER_SOUND_MENU` moved from the generator to `diLetterSoundsMenu.ts`.
- **Support fact** replaces the bare tier; **catalog** `levers: true` and the guidance names `model_sound`.

**Size:** 135 lines of lever module and about 90 lines of component, domain and catalog change, against 230 lines of new tests.

## Measured

| Gate | Result |
|---|---|
| Unit (`diLetterSoundsLevers.test.ts`, 17) | every menu letter alone and every held onset has a safe model; every saved item has one; a 20-letter review leaves 2 items without one (the first m and a; pinned, lever not declared); lever set per kind; R4 picture rule; starting positions; miss → lever; every catalog miss answered and every named miss listed |
| Mounted (`DiLetterSounds.levers.workspace.test.tsx`, 4) | picture and its target appear only when pulled at hard; the arrow has no text; easy start not a pull; first_box lights the first of three empty boxes; refused pulls change nothing |
| Dry journey J1-J9 | 4/4 payloads (new: the clipped-stop payload) |
| typecheck | lumina 0 |
| Text replay (Flash, 4 payloads × 5) | 0 flags. The model is voiced "My turn: this letter says rrr, like ring" (onset: "leaf … lll"), then the child's item |

**Read by hand:** after a miss the tutor points at the keyword picture; when stuck it asks the child to name the picture and find its first sound. The child does the work and the pull is recorded as help, so this is accepted. On a stop or vowel the keyword itself is accepted, so a picture-assisted "pig" is credited as an assisted answer.

## Not covered

- No simplify on any mode, by design.
- Not browser-checked (HUMAN-CHECKS #183, letter-sounds row: three objects at easy for a K child). No Live run: the DI class gate waits for all 37 DI modes.

## Next

DI family 5, di-word-reading (plan step 3).
