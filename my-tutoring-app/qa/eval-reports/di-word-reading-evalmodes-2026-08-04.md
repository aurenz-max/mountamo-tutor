# di-word-reading — L1 eval-mode backfill (2026-08-04)

**Layer: L0 → L1.** The original `read_word` identity remains stable and three
birth-certificate pools are now first-class modes.

| Mode | β | Code-owned pool |
|---|---:|---|
| `cvc_reading` | 2.0 | decodable short-vowel CVC only; named vowel binds |
| `read_word` | 2.5 | original mixed CVC/sight base skill |
| `sight_word` | 3.0 | irregular high-frequency words only |
| `word_reading_review` | 3.5 | cumulative CVC-family + sight mix, up to two lesson anchors |

The Fork-A generator resolves single/blend/mixed identities and explicitly
interleaves mode slices. A shared used-set prevents duplicate printed words.
The final menu word rebuilds graphemes, aliases, emoji, word type, and ID.
Registration already passed raw config plus intent and needed no edit.

The live sweep found and fixed one pre-close issue: two review anchors could
consume the default window before a sight word appeared. The review spread now
places sight + distinct vowel families first after the anchors, so a four-item
focused review still crosses decoding and whole-word recall.

## Verification

- Focused eval-mode suite: **12/12**.
- Live `/eval-test`: pinned four modes + focused review + curated CVC/sight
  blend + explicit mixed all **PASS**; mixed contains all four identities.
- Review re-drive: generic `cat/red/the/pig`; short-a focus
  `sam/mat/the/red` — anchors retained and the mixed review identity visible.
- Backend priors compile; catalog β values match the registry. Discrimination
  is omitted intentionally, matching the backend 1.4 default.
- Touched DI surface: **0 TypeScript errors**; full Vitest suite **122 files /
  1,385 tests PASS**. The global Lumina gate is presently blocked only by two
  unrelated concurrent math grade-band test errors.

No spoken copy changed and no new response class was introduced, so no bench or
ear-check row is required.
