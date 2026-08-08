# Reader Fit: species-profile @ PRE — 2026-08-07

Item **15A / S6** of the supply-side sweep, worked under
[[feedback_make-age-friendly-not-band-floor]].

Modes audited: the primitive declares no eval modes; it is a single reference-card
identity (the `organism-card`/S15 shape). Probes: eval-test ✓ (K, G1, G4, pre- and
post-fix) · tutor-test Tier 1 ✓ + Tier 2 `--probe` ✓ · **real Chrome drive ✓**
(K-2 and 3-5) · live audio ✗ (→ HUMAN-CHECKS).

**Overall: SCAFFOLD-GAP + PRIMITIVE-GAP + CONTENT-GAP → now READY at PRE.**

---

## The pre-fix K screen, measured

`?componentId=species-profile&grade=K&gradeLevel=kindergarten&topic=Polar Bears`
returned, to a five-year-old who cannot read:

- scientific name **`Ursus maritimus`**, rendered in italic under the title
- a taxonomy accordion with **Kingdom `Animalia` / Phylum `Chordata`** in `font-mono`
- **`"1.3 to 1.6 meters tall at the shoulder"`** and **`"300 to 600 kilograms"`**
- **`"Formally described and named by scientific standards in 1774 by the
  Constantine John Phipps."`**
- `imagePrompt` printed as visible italic body text in three places

and **no `gradeBand` field at all** — the K and G4 payloads were structurally
identical, differing only in prose length (2270 vs 3056 bytes).

---

## Two causes, and the first alone would not have been enough

**1. No rung was ever stamped.** `SpeciesProfileData` had no band field, so the
component had nothing to gate on. This is the S2/S3/S4 defect in its purest form —
**fourth appearance** — and it means every gate added here would have been dead on
arrival without the generator change.

**2. The CONTENT was the load, not just the chrome.** `ctx.gradeContext` prose
reached only the prompt, which is where prose belongs (the S11 posture, and there
were no dead char-comparisons to fix). But it was **one bullet** — *"For younger
students (K-2), use simpler language"* — against **eight mandatory REQUIREMENTS
sections** demanding complete taxonomy ("Kingdom through species"), accurate
measurements, and discovery history ("when and where first discovered").
The prompt asked for Phipps-in-1774 and got it.

**Band-gating the component alone would have hidden the Latin name and left
`"300 to 600 kilograms"` sitting in the size row.** This is S4's lesson restated:
a band failure can be a CONTENT gap, and only the generator can close a content
gap. So requirements 1, 4 and 7 are now band-scoped rather than "simplified":

| | K-2 | 3-5 / 6-8 |
|---|---|---|
| Physical stats | comparison in **every** size field; "NEVER write a number with a unit" | accurate measurements + comparisons |
| Taxonomy | broad everyday group only ("Animals"); phylum/class/order/family/genus **empty** | Kingdom through species |
| Discovery | `discoveryInfo` left **empty** | full historical context |
| Register | named ban list (species, taxonomy, kingdom, adaptation, habitat, predator, carnivore, …) with replacements supplied | scientific vocabulary is the objective |

Belt-and-braces: at K-2 the generator writes a comparison into the **raw** size
fields too, so even a missed component gate cannot leak a number.

---

## Audit A — text census

Pre-fix: **no channel at all** (no catalog `tutoring`, no `useLuminaAI`), so every
load-bearing string was UNCOVERED. Post-fix:

| String | Class | Spoken twin | Verdict |
|---|---|---|---|
| `commonName` "Polar Bear" | load-bearing | `[SPECIES_ORIENT]` + `LuminaReadAloud` | COVERED |
| Each fact title + description | **load-bearing** (the card's whole content) | per-fact `LuminaReadAloud` → `[SPECIES_READ_ALOUD]` reads title **and** body | COVERED |
| Size comparisons | supportive | generator now writes them in child scale; tutor may say them | COVERED |
| `scientificName` `Ursus maritimus` | — | — | **withheld at K-2** |
| `Name Meaning:` etymology | — | — | **withheld at K-2** |
| Taxonomy ranks / "Family Tree" | — | — | **withheld at K-2** |
| `Discovery: … 1774 …` | — | — | **withheld at K-2** (and no longer generated) |
| category badge `MAMMAL` | chrome | — | **withheld at K-2** |
| `imagePrompt` | **not student copy** | — | **removed at every grade** |

`imagePrompt` as visible body text is the **fourth appearance** of the S9 / S13 /
S5 leak.

---

## Audit B — sufficiency contract

| ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|
| PASS — `[SPECIES_ORIENT]` fires once, names the animal, invites a tap | PASS — every fact is tappable and read title-and-body | N/A — a reference card asks nothing | N/A — nothing to be right or wrong about | PASS — 5 struggles |

**This primitive has no answer to protect,** so the directives guard the opposite
risks: `A CARD IS NOT A QUIZ — AND NOT A LECTURE` forbids reading the whole card
unprompted and forbids inventing a fact the card does not contain ("an invented
fact in a reference card is worse than *I don't know*"). And
`NO MEASUREMENTS AND NO LATIN AT K-2` stops the tutor **putting back exactly what
the card deliberately took out** — with the restriction explicitly lifted at 3-5
and 6-8, where that vocabulary is the objective.

---

## Audit C — band contract (K-2)

| Rule | Pre | Post | Note |
|---|---|---|---|
| 1 Audio is the instruction channel | **FAIL** | PASS | no channel existed |
| 2 Tap = choose | N/A | N/A | reference card |
| 3 Pictures are the answer surface | PARTIAL | PARTIAL | image is on-demand behind a text button; no answer surface to speak of |
| 4 One thing per screen | PARTIAL | PARTIAL | accordions keep it collapsed, but the card is long |
| 5 Feedback | N/A | N/A | — |
| 6 No typing | PASS | PASS | — |
| 7 No adult chrome | **FAIL** | PASS | Latin, taxonomy, kg/m, 1774 citation, badge, `imagePrompt` |
| 8 Assessment in mechanics | **N/A** | **N/A** | reference card by design — same posture as S11/S15. **Not a pass.** |

---

## Gates

- **29 focused tests** (15 jsdom + 14 generator/catalog), **12 revert-bites, 12 bite**
  (4/7/1/1/1/1/9/2/1/1/1/1). One bite initially reported ANCHOR NOT FOUND — a
  harness escaping issue with `\'` inside the catalog string, not a test gap; it
  bites when re-anchored.
- **src-scoped tsc 803 = baseline, set-identical.**
- `typecheck:lumina` **0**.
- Full vitest **2248/2248** (2219 + exactly 29).
- `tutor-test` Tier 1 `pass` · Tier 2 `findings: []`, `dataBagDynamic: false`,
  **8/8 contextKeys resolve**, 2 tags emitted, **zero `(not set)`**.

**Runtime A/B (eval-test, real Gemini):**

| field | K PRE | K POST | G4 control POST |
|---|---|---|---|
| `gradeBand` | **undefined** | **`K-2`** | `3-5` |
| height | `1.3 to 1.6 meters tall at the shoulder` | `as tall as a grown-up standing on tippy-toes` | `1.3 to 1.6 meters tall at the shoulder` |
| weight | `300 to 600 kilograms` | `heavier than twenty kids put together in a big pile` | `350 to 700 kilograms for males` |
| taxonomy | `{Animalia, Chordata, Ursus maritimus}` | `{Animals, "", maritimus}` | `{Animalia, Chordata, U. maritimus}` |
| discoveryInfo | *"…1774 by the Constantine John Phipps"* | **absent** | *"Formally described … Phipps in 1774…"* |

**Real-Chrome drive.** K-2: Latin name, Name Meaning, Family Tree, discovery and
category badge all absent; **no kilograms or metres anywhere**; stats read
*"taller than your big kid bed when it stands up on its back legs"*, *"as long as
a big family couch"*, *"heavier than a big sofa full of grown-ups"*; 4 read-aloud
buttons (name + 3 facts); **0 nested buttons; zero console errors.**
3-5 control: Latin name, Name Meaning and Family Tree all present, 0 read-aloud
chrome.

*(The rendered size strings differ from the raw `height`/`weight` values in the
same payload because the K-2 gate shows `heightComparison`/`weightComparison`.
That was checked rather than assumed.)*

---

## Residuals — stated, not buried

- **No Tier-3 live audio run.** → HUMAN-CHECKS.
- **Rule 8 is N/A, not passing.** This is a pure reference card with no evaluation
  hook — the same portfolio question already open for S11, S12 and S15. It should
  either get `/add-eval-modes` or be declared exploration-only so the manifest
  stops routing assessment demand at it. **That is now 4 of the sweep's primitives
  in the same state and it needs a decision, not another slice.**
- **`scientificName` is still generated at K-2** (it is a required schema field, so
  it always comes back) — the component withholds it, and the tutor is forbidden
  from saying it. Data-present-but-never-shown is the correct division here, but
  worth knowing it is there.
- **Rule 3 remains PARTIAL**: the image is on-demand behind a text-labelled
  "Generate Visual" button at every grade. S5 solved the equivalent problem by
  turning images ON at K-2 in the registry; species-profile has
  `generateSpeciesProfileWithImage` available and the same move would work. **The
  single biggest remaining PRE win for this primitive.** Not bundled — it is a
  registry change with a latency cost that deserves its own decision.
- **Observed, not caused by this slice:** one pre-fix G4 draw returned a malformed
  `taxonomy.species` with `class`/`order`/`family` stuffed into the string as
  literal `\n key: value` text. It did not recur post-fix. Draw-to-draw generation
  flakiness in the 3-8 path, worth an `/oracle-test` contract if this primitive
  gets real traffic.
