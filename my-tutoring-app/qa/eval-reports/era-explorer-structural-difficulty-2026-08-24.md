# era-explorer — L4 structural difficulty (`/add-structural-difficulty`), 2026-08-24

**Outcome: SHIPPED.** `config.difficulty` now produces structurally different PROBLEMS, not just less
help. L3 left every statement byte-identical across tiers by design; this rung makes the JUDGMENT
subtler while the reading level, the era and the eval mode stay put.

Generator-only (`service/history/gemini-era-explorer.ts`). No component change — `options` /
`correctIndex` are still code-built and the component renders whatever it is handed.

## The mechanism: over-generate → measure → select

Prose cannot be reconstructed in code. Where the regrouping-workbench reference re-selects operands to
hit an exact carry count, this generator cannot rewrite an English sentence — so enforcement is:
under a tier the schema asks for a **deeper candidate pool** (challenges 4–6 → 6–9, cause distractors
2 → 4), code **measures** each candidate's shape and **selects** the set that hits the target. Both
widenings are gated on `supportTier`, so the no-tier path — schema, prompt and selection alike — is
byte-identical to before this rung.

`config.difficulty` reaches two places from one key: `buildTierPromptSection` merges axis 1
(scaffolding) and axis 2 (shape) prompt lines into a single section, and `selectForShape` enforces the
hard levers in the post-process. `NUMBERS_NEVER_CHANGE` never existed here; `TIER_GUARDRAIL` was
reworded to tell the truth — structure changes, **magnitude and reading level do not**.

## The lever table (as shipped, confirmed with the user before coding)

| Mode | Lever | easy → hard | Floor | Live result |
|---|---|---|---|---|
| `lens_id` | **cross-lens reach** — how many lens bodies read as plausible | reach ≤1 → ≥2 | paraphrase holds (`VERBATIM_RUN`); exactly one lens genuinely contains it | easy 6/6 on target; hard **partial** — see residual |
| `era_sort` | **subtle-bin share** + artifact→practice→institution subject ladder | 1 → 2 → 3 of 6 | ≥1 subtle **and** ≥1 plain — the three-way judgment IS the mode | **1 / 2 / 3 exactly**, G3 |
| `era_compare` | same, over "Both eras" | 1 → 3 of 6 | ≥1 of each | **1 / 3 exactly**, G4 |
| `cause_of_change` | **distractor distance** — far → near wrong causes | 2 farthest → 2 nearest of 4 | near-duplicates (overlap ≥ 0.8) excluded, so exactly one right answer | pool narrowed 4→2 on every challenge, far vs near end |

## Live `/eval-test` sweep — 13 generations, all `status: pass`

**`era_sort` @ G3 (the anchor rung), the lever landing exactly:**

| tier | subtle bin | subject class visible in the prose |
|---|---|---|
| easy | 1 / 6 | slate boards, tallow candles, spinning wheel, open fire — **objects** |
| medium | 2 / 6 | hand-crafting clothing, sharing a hot evening meal — **practices** |
| hard | 3 / 6 | family meals at day's end, parents teaching children to farm, village play — **institutions & continuities** |

`era_compare` @ G4: 1/6 → 3/6, with hard's subtle items being real cross-period continuities (farming
taught to children, cooking over open fire, building from local materials).

`cause_of_change` @ G5: easy distractors sit in other domains entirely (a lighting question offered
reading laws and farm tractors); hard distractors sit in the same domain and are genuinely plausible
(a hornbook question offered *"paper was expensive"* against *"ink dried too slowly on notebook paper"*).

No-tier baseline: 5 challenges (the 4–6 band, not 6–9), no `supportTier`, no shape logs — the
untiered path is untouched.

### Caught and fixed by the live run

The first `cause_of_change` **hard** run drifted off its own task identity: statements became era
descriptions ("Children learned lessons using a hornbook") instead of changes between then and now.
My hard prompt line said the wrong causes should come from "the SAME part of life and the SAME
**period**", and "period" competed with the mode doc and pulled the whole item back into the era.
Reworded to keep the change framing explicit; the re-run produced "Families stopped cooking…",
"Children no longer carry…" with the near distractors intact. **This is why the rung is not done at
tsc** — the type checker had nothing to say about it.

## Gates

- Project-local tsc: **802 errors, exactly the pre-edit baseline; 0 in era-explorer files.**
- `typecheck:lumina`: **0**.
- Vitest: **35/35** across 3 era-explorer files, including a new **24-test** offline stress suite
  (`gemini-era-explorer.shape.test.ts`) running the selector over 6,000 randomised pools with a
  seeded PRNG.
- **Mutation-checked, non-vacuous** — each of these breaks a test:
  flatten `SUBTLE_SHARE` → 2 fail · drop the `[1, slots-1]` floor clamp → 1 fail ·
  drop the near-duplicate filter → 1 fail.

The floor test was **vacuous on its first pass** and was rewritten. A pinned session has 6 slots, so
even easy's 0.15 share rounds to 1 subtle on its own — the clamp never fired. It only bites in a
**blend**, where `era_sort` gets ~3 slots and 3 × 0.15 rounds to **zero**; without the clamp the
student gets an era_sort run with no continuity judgment at all, which is not an easier era_sort but a
different two-way task. The rewritten test builds that blend, and the mutation now fails.

## Fixed en route

`lensReachOf` originally counted any lens whose overlap sat within **one word** of the best. At the low
overlap counts real statements produce, that let a single stray common adjective ("small", "together")
manufacture a second plausible lens. Replaced with an **anchor floor** (≥2 shared subject words before
a lens counts at all) plus a **relative** competitive band (60% of the best lens's overlap), so the
band widens with the evidence instead of staying a fixed ±1 that is loose at 2 words and tight at 8.

## Residuals (queued, not silently dropped)

1. **`lens_id`'s ceiling is partial.** The lexical reach metric is a proxy for *word-matchability*, and
   it is reliable at the easy end (one lens lexically dominant) but noisy at the hard end, because a
   good paraphrase — which the verbatim tripwire actively pushes the model toward — shares little
   vocabulary with any lens. Of two hard runs, one shipped 2 reach-2 items and one shipped **0/6 and
   saturated honestly** (logged as such). The prompt line does the pedagogical work; the metric only
   orders the pool. A stronger `lens_id` ceiling likely needs a different lever (e.g. asking the model
   to label the second-plausible lens and validating that label) rather than a sharper regex.
2. **Mild sentence-length drift at hard on `era_sort`** (~10 words at easy vs ~18 at hard, G3). Inside
   the G3 band — only K–2 caps length — but the tier should not be the thing moving it. The
   `TIER_GUARDRAIL` already forbids it; worth a look on the next `/eval-test` pass.
3. **Not browser-driven.** All 13 generations came through `/api/lumina/eval-test`; the render tree is
   exercised in jsdom, not Chrome. Unchanged from L3.
4. The **curated Pioneer Times fallback** ships finished `options`, so the distractor-distance lever
   cannot apply there. It saturates honestly (the subtle-bin and reach levers still select within the
   pool) and says so in the log.
