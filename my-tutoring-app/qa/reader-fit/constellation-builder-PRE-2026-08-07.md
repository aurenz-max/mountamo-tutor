# Reader Fit: constellation-builder @ PRE — 2026-08-07

Item 16 / slice 1 (of 2). Executor `/reader-fit --fix`. Baseline HEAD `98e4928`.

Modes audited: `guided_trace` (the K-routed mode) primary; `free_connect`,
`identify`, `seasonal` assessed for band reachability.
Probes: eval-test ✓ (K, **Grade 1**, Grade 4 control) · tutor-test `--probe` ✓
(before **and** after) · **real-Chrome drive ✓**

---

## What the handoff said, and what probing actually found

The handoff reported a **reproduced** defect and told me to extend it rather than
re-confirm it. Extending it moved the finding twice:

**Extension 1 — the defect was not K-only, it was K *and Grade 1*.**

```ts
const gradeLevel   = ctx.gradeContext;                                  // PROSE
const resolvedGrade = gradeLevel.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3';
```

| request | prose `gradeContext` | old stamp | why |
|---|---|---|---|
| `grade=K` | `kindergarten students (ages 5-6)…` | **`'3'`** | no "grade N" in the prose |
| `grade=1` | `first grade students (ages 6-7)…` | **`'3'`** | **"first grade" is not "grade 1"** |
| `grade=4` | `grade 4 students…` | `'4'` | the only shape the regex ever handled |

The handoff predicted the K miss. Grade 1 missing *the same way* was not in it —
the regex only ever worked on prose that literally spelled "grade N", so the whole
spelled-out band fell to the literal `'3'`. `ctx.grade` was read **zero** times.

**Extension 2 — the primitive was ORPHANED from the tutor, not merely
directive-less.** The handoff correctly noted it is "not mute" (the catalog carries
a real tutoring block: 7 contextKeys, 3 scaffolding levels, 3 struggles) and that it
lacked `aiDirectives`. Probing the channel showed the block was reaching the backend
**empty** — this is [[project_orphaned-tutoring-configs]], measured:

| `tutor-test?probe=1&gradeLevel=kindergarten` | before | after |
|---|---|---|
| status | `warn` | **`pass`** |
| `sendTextTags` | **`[]`** | 5 tags |
| `dataBagDynamic` | `true` | `false` |
| findings | `data-bag-unparsed`, `no-sendtext-moments` | **none** |
| contextKeys resolved **by the component** | **0 / 7** | **7 / 7** |
| `(not set)` in the rendered tutor prompt | **~10** | **0** |
| `Grade Level:` line | **`3`** | `K` |

What the tutor was actually handed at K:

```
**TASK:** Student is building the (not set) constellation.
          Stars connected: (not set)/(not set). Mode: (not set).
Level 2: "(not set) has (not set) main stars. You have found (not set) so far."
```

A scaffold that resolves to `(not set)` is worse than no scaffold: it is a prompt
instructing the tutor to talk about nothing, and no moment ever fired it. **This is
the more severe of the two findings** and it was invisible to the source read that
produced the handoff — the catalog block looks complete.

---

## Audit A — text census (K, from the rendered state)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| `Tap the stars to make the Big Dipper.` | instruction line | **load-bearing** | `[CONSTELLATION_ORIENT]` + `[CONSTELLATION_CHALLENGE_CHANGED]` + `LuminaReadAloud` | COVERED |
| `Tap star 3 of 5` | step counter | **load-bearing** (progress) | **removed at K-1**; the pulsing ring carries it wordlessly | COVERED |
| `2 / 4` | progress badge | adult chrome | **removed at K-1** | COVERED |
| `Look for the star with the sparkly circle!` | wrong-tap hint | **load-bearing** (correction) | `[CONSTELLATION_WRONG_STAR]`, same register | COVERED |
| `The Big Dipper looks like a big soup spoon in the sky.` | Star Lore card | **load-bearing** (the payload) | `[CONSTELLATION_COMPLETE]` reads it word-for-word + replay button | COVERED |
| `You traced Big Dipper!` | feedback | supportive | `[CONSTELLATION_COMPLETE]` | COVERED |
| `Next Constellation` / `See Results` | advance button | **load-bearing** (navigation) | clause appended to `[CONSTELLATION_COMPLETE]` at K-1 | COVERED |
| `Star Connect` / description | header | decorative | ORIENT names the activity | n/a |
| `Star selected — tap another star…` | free_connect protocol | load-bearing | **UNCOVERED** | see residuals |

**Audit A: PASS for `guided_trace` at PRE.** The one uncovered string belongs to
`free_connect` (β 3.0, Tier 2, catalog says grades 1–3), not the K-routed mode.

---

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| `guided_trace` (K) | ✅ fires once on mount, carries the instruction verbatim | ✅ instruction + star story both read aloud | ✅ "tap the star with the ring", answer withheld | ✅ sound + line drawn on the object + spoken correction | ✅ 3 levels now resolve; ring-first, location only at level 3 |
| `free_connect` | ✅ | ✅ | ⚠️ two-tap pairing never stated | ✅ | ✅ |
| `identify` / `seasonal` | ✅ | ✅ | ✅ | ✅ | ✅ |

Before this slice every cell in every row failed — not because the copy was wrong
but because nothing fired it and every variable was `(not set)`.

---

## Audit C — band contract (PRE, `guided_trace`, from the Chrome render)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1. Audio is the instruction channel | **PASS** | 5 moments + 2 read-aloud surfaces; 7/7 contextKeys live |
| 2. Tap = choose | **PASS** | one tap on the ringed star; no confirm step |
| 3. Pictures are the answer surface | **PASS** | the stars *are* the surface; no word options |
| 4. One thing per screen, ≤ ~5 interactive | **PARTIAL** | **7 interactive stars measured** (14 hit circles). The pulsing ring designates exactly one, so the *task* is singular, but the tappable count exceeds the rule. Non-member stars are inert at K — the count is the pattern itself. |
| 5. Feedback on the touched object, instantly | **PASS** | `SoundManager` + the line draws on tap; text is no longer the only channel |
| 6. No typing | **PASS** | — |
| 7. No adult chrome | **PASS** | badge + step counter conditionally removed (not Tailwind `hidden`) |
| 8. Assessment hides in the mechanics | **PASS** | the trace *is* the measurement |

---

## Overall: **READY at PRE** for `guided_trace`

Findings → fix layer:
1. **Prose-grade resolver** (K *and* Grade 1 → `'3'`) → **GENERATOR**. Exported
   `constellationGradeFromGrade` canonical-first; `constellationGradeFromProse`
   demoted to second resolver and taught the spelled-out forms. No band floor —
   constellation-builder is genuinely K-fit.
2. **Grade-3 prose written into K content** → **GENERATOR** (Tier 3). The component
   cannot shorten a sentence the generator already wrote:
   *before* — "Trace these sequential stars to reveal the proud celestial lion
   patrolling the spring skies."
   *after* — "Tap the stars to make the Big Dipper." (7 words)
3. **Orphaned tutor channel** (SCAFFOLD-GAP, severe) → **COMPONENT** `useLuminaAI` +
   flat-literal `aiPrimitiveData` (7/7 contextKeys) + 5 moments, and **CATALOG**
   `aiDirectives` (cap-override read-aloud; never-name-the-next-star; no counts or
   magnitudes at K-1 with the replacement register supplied).
4. **Adult chrome in the child's field** (PRIMITIVE-GAP) → **COMPONENT** band gate.

### Runtime A/B — the ladder is not flattened

| grade | stamp | challenges | instruction |
|---|---|---|---|
| K | **`K`** | 3 | "Tap stars to make the Big Dipper." (7w) |
| 1 | **`1`** | 3 | "Tap the stars to make the Big Dipper." (8w) |
| 4 (control) | **`4`** | 5 | "Which famous star pattern can be easily spotted high in the northern sky during spring nights?" (16w) |

### Two defects found by the gates, not by the audit

- **A pre-existing suite crashed the moment the component gained a tutor channel.**
  `ConstellationBuilder.support-tiers.test.tsx` mocks evaluation/SoundManager/panel
  but not `useLuminaAI`, which **throws** outside a `LuminaAIProvider` — 21 tests
  died. This is the S5 trap generalising exactly as the handoff warned. Mock added.
  (`AstronomyPrimitivesTester` *does* wrap in `LuminaAIProvider` — verified at
  line 553, not taken on faith, and the Chrome drive raised zero page errors.)
- **An unstable `sendText` identity turned the completion effect into a render
  loop** that OOM-killed a vitest worker (`Worker exited unexpectedly` — a crash,
  not a failure, so it reported as a *passing* run with 16 tests silently missing).
  The real hook returns a `useCallback`, so production was never affected, but the
  effect was fragile: `isConstellationComplete` stays true, so the body re-ran on
  any dep change and would have re-read the star story on every render. Fixed by
  latching completion per challenge id — closing the mechanism, not the symptom.

### Residuals (not fixed here, deliberately)

- **`free_connect` is two-tap** (rule 2) and its "star selected" protocol line has
  no spoken twin. It is Tier 2 / β 3.0, catalog-claimed for grades 1–3, and
  collapsing it to one tap would destroy the task identity (the pairing *is* the
  skill). Correct fix if K ever routes there is a band gate, not a redesign.
- **Rule 4 partial** (7 interactive stars). Not primitive-local — it is the shared
  K-stage presentation question; recorded so that case keeps accumulating.

### Gates

- src-scoped tsc **803 = baseline `803`, set diff EMPTY** for this slice.
  ⚠️ A concurrent session's untracked `DiShapes.support-tier-context.test.tsx`
  (mtime 23:39, written during this run) adds 2 errors and currently fails
  `typecheck:lumina`. **Not this slice** — that gate was green on this slice alone.
- Full vitest **2345 passed / 2345**, 185 files, zero errors.
- `tutor-test` Tier 1 `pass`; `--probe` `dataBagDynamic: false`, zero `(not set)`.
- **Every claim revert-bitten**: generator reverts → 8 failures; component band
  gates + moments reverted → 5 failures. No decorative tests.
