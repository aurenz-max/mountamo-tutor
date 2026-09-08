# Letter Workshop support and structural tiers — 2026-09-07

Implemented `difficulty: easy | medium | hard` for every challenge, including blends/mixed. The Language Arts tester now exposes a Letter difficulty selector. Default/no-tier generation retains its prior selection and support behavior.

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| Trace | Guide, numbered starts, arrows, line labels, reminder | Guide, numbered starts, line labels | Guide and plain writing lines |
| Copy | Separate model, labeled lines, reminder | Separate model and labeled lines | Separate model and plain lines |
| Write | Audible cue, labeled lines, procedural reminder | Audible cue and labeled lines | Audible cue and plain lines |

Copy always keeps its separate model. Write has no target glyph before checking. The tutor receives tier and aid visibility and must not verbally restore hidden starts/arrows or target-stroke recipes. Hard trace retry feedback removes references and correction markers for hidden starting dots. Drawing thresholds and scoring policies are unchanged.

Structural selection uses a code-owned sum of stroke count, curved strokes, corners in short polylines, and lowercase ascender/descender extensions. Within each allowed case, easy anchors on the lowest available score, medium the middle available score, and hard the highest. This is a provisional structural proxy, not empirical difficulty calibration. Templates and letter/case/group scope are never expanded or redrawn. Narrow scopes saturate honestly; the same single letter remains at every tier.

### Band widening — variety defect found and fixed

The first implementation filtered the scoped pool to letters whose complexity *equalled* the anchor score exactly. Where a score was thinly populated that collapsed a broad scope to a single form: **uppercase hard over the full alphabet yielded only `B`, so a four-item session rendered `B B B B`.** Group 2 lowercase hard collapsed to `m`, and Group 1 lowercase easy to `s`. Scope saturation is honest; a tier discarding 25 of 26 in-scope letters is not — it breaks "N challenges = N problems".

The anchor score still *is* the tier. It now widens to the neighbouring score — easy and medium upward first so medium never collapses into easy, hard downward — and stops as soon as the band can supply one distinct form per challenge. `resolveProblemShape` takes the session's challenge count, reports the band as `{min, max}` per case, and `letterStructure` is memoized and frozen because band probing re-measures the same templates. Bands stay monotone across tiers by construction.

| Scope (count 4) | Easy | Medium | Hard |
|---|---|---|---|
| Alphabet uppercase | band 2-2, 8 forms | band 3-3, 13 forms | band 4-5, 5 forms (was **1**) |
| Alphabet lowercase | band 2-2, 7 forms | band 3-3, 7 forms | band 4-5, 12 forms (was 3) |
| Group 2 lowercase | band 2-3, 7 forms | band 3-3, 4 forms | band 4-5, 6 forms (was **1**) |
| Group 1 lowercase | band 2-3, 4 forms (was **1**) | band 3-4, 5 forms | band 3-4, 5 forms |
| Single `lowercase-l` | 1 form | 1 form | 1 form |

Group 1 (six letters, four items) cannot separate medium from hard structurally; the support axis still separates them, and a one-letter scope is unchanged at every tier. That is scope saturation, correctly reported.

## Verification

- **1,563 tests pass across 60 literacy/service files** (4 skipped, 0 failures). The stress test now sweeps 1,000 scoped pools x three modes x three tiers x counts 3-6, asserting scope containment, reported-band containment, one distinct form per challenge wherever the scoped case can supply one, and band monotonicity across tiers. It collects violations and asserts once per run: 9,000 shapes through per-template `expect()` tripped the 5s suite timeout (2.84s alone, 97ms batched).
- **Post-fix live sweep, 13 real generations through the running app** (`POST /api/lumina`, `generateComponentContent`): alphabet uppercase and lowercase x three tiers gave **4/4 distinct letters every time** at complexity 2 -> 3 -> 4-5, with aids withdrawing 1111 -> 1010 -> 0000 (starts/arrows/labels/checklist). Group 1 lowercase gave 4/4 distinct at all three tiers. Single-letter scope saturated at 1/4 as designed. Mixed modes at hard/count 6 gave 6/6 distinct at complexity 4-5 across trace+copy+write. An untiered draw emitted no `supportTier`, `support`, or `structure` fields, so the no-tier path is unchanged.
- **12 live draws (pre-fix):** nine mode/tier alphabet draws plus three mixed lowercase-l draws. Alphabet complexity was 2 → 3 → 5 for every mode. The single-letter shape stayed fixed. Conflicting lowercase-q/Group-1 scope was rejected.
- **Nine browser flows / 36 challenges:** live generation, visible aid assertions, shifted copy/write ink, check/next/finish, and evidence. Browser speech completion was simulated.
- **TypeScript:** 770 full-project baseline errors / 770 after; no new diagnostics. Lumina-scoped check passes at zero.
- **Tutor probe:** passes with no findings; tier/visibility context resolves. Full live speech compliance and actual speaker output remain device checks.

Artifacts: [live draws](letter-workshop-tiers-live.json), browser results for [easy](letter-workshop-modes-browser-easy.json), [medium](letter-workshop-modes-browser-medium.json), and [hard](letter-workshop-modes-browser-hard.json), [hard trace screenshot](letter-workshop-trace-mode-hard.png), [easy copy screenshot](letter-workshop-copy-mode-easy.png), [tutor probe](../tutor-reports/letter-workshop-tier-tutor-probe.json).

Try Developer Tools → Language Arts → Letter Workshop, choose a mode and Letter difficulty, then Generate. Use a broad alphabet/group topic for structural variation, or a single letter to compare support alone. Copy/write feedback remains local-only pending template/device review and calibration.
