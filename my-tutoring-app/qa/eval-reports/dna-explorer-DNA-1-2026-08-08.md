# DNA-1 — dna-explorer answer leak: reproduced, fixed, re-measured

**Date:** 2026-08-08
**Primitive:** `dna-explorer` (biology)
**Tracker row:** DNA-1 (`qa/EVAL_TRACKER.md`), measured 2026-07-09, unfixed for a month
**Executor:** `/eval-fix`
**Verdict:** FIXED — 19/20 → 0/20 generations leaking, measured at runtime pre and post.

---

## 1. Pre-fix measurement

Driven through the real pipeline (`/api/lumina/eval-test` → `generateComponentContent` →
`generateDnaExplorer`), 20 generations across two parameter sets, 0 generation failures.

| set | topic | gradeLevel | grade | generations |
|-----|-------|-----------|-------|-------------|
| A | DNA structure and base pairing | middle | — | 10 |
| B | DNA replication and complementary base pairing | middle school | 7 | 10 |

**Result: 19 of 20 generations shipped a build challenge whose answer was already on
screen. 22 of 44 individual challenges leaked.**

```
A1   tmpl=ATCGTTA    LEAK  CGATCG ~ ATCG
A2   tmpl=ATCGGATA   LEAK  ATCG   ~ ATCG
A3   tmpl=ATCGT      LEAK  ATCG   ~ ATCG ; GCTA ~ GCTA(rev)
A4   tmpl=ATCGTA     LEAK  ATCG   ~ ATCG
A5   tmpl=ATCGTATA   LEAK  ATCG   ~ ATCG
A6   tmpl=ATCGGCTA   LEAK  ATCG   ~ ATCG
A7   tmpl=ATCGGATA   LEAK  ATCG   ~ ATCG ; GCTA ~ GCTA(rev)
A8   tmpl=ATCGGATA   LEAK  ATCG   ~ ATCG
A9   tmpl=ATCGGATA   LEAK  CGATCG ~ ATCG
A10  tmpl=ATCGGAT    LEAK  ATCGTA ~ ATCG
B1   tmpl=ATCGGCTA   LEAK  CGATCG ~ ATCG
B2   tmpl=ATCGGATA   LEAK  ATCG   ~ ATCG
B3   tmpl=ATCGGATA   clean
B4   tmpl=ATCGGCTA   LEAK  ATCG   ~ ATCG ; GCTA ~ GCTA
B5   tmpl=ATCGGCTA   LEAK  ATCG   ~ ATCG ; GCTA ~ GCTA
B6   tmpl=ATCGGATA   LEAK  ATCG   ~ ATCG
B7   tmpl=ATCGGATA   LEAK  ATCG   ~ ATCG ; ATCGGATA ~ EXACT ; GCTA ~ GCTA(rev)
B8   tmpl=ATCGGATA   LEAK  CGATCG ~ ATCG
B9   tmpl=ATCGGCTA   LEAK  CGATCG ~ ATCG
B10  tmpl=ATCGGATA   LEAK  ATCG   ~ ATCG
```

### The tracker under-counted, and so did the oracle

DNA-1 was recorded as **6/10**. That number counted only `givenStrand === templateStrand`.
Across these 20 generations the exact-equality form fired **once** (B7). The dominant form
is **partial overlap** — and it leaks just as completely:

- Explore tab renders `templateStrand` and `complementaryStrand` as two aligned rows
  (`DnaExplorer.tsx:603` and `:622`), base above base.
- Build challenge #1 hands the student `ATCG` while the Explore tab displays
  `ATCGGATA` / `TAGCCTAT`. The first four characters of row two — `TAGC` — **are the
  answer**, in order, already typed out.
- `CGATCG` (A1, A9, B1, B8, B9) reads like a fresh strand and is not a prefix of anything;
  it carries `ATCG` at offset 2. Whole-strand comparison finds nothing. A student sliding a
  four-wide window finds it immediately.

My first probe made the same mistake: it tested whole-strand containment and reported 7/10
and 6/10. The regression test caught the fixture I had labelled "clean" and forced the
re-count above. The correct predicate is **any shared run of ≥ 4 bases**, which is what both
the fix and the oracle now use. (Below 4, two strings over a 4-letter alphabet collide by
chance; that is noise, not a leak.)

The shipped oracle had the identical blind spot. Its first run over 10 fresh generations
this session returned `status: pass, totalViolations: 0` **while 7 of those 10 were
leaking**. A blind oracle is worse than none: it is a green light over a broken contract.

---

## 2. Mechanism

`generateDnaExplorer` asked flash-lite for a display sequence and, separately, for build
challenges. Nothing connected the two. The schema (`gemini-dna-explorer.ts:144-165` pre-fix)
constrains each field independently — a JSON response schema cannot express "field X must
differ from field Y", so the constraint was never stated anywhere the model had to obey it.

Prompt prose did not bind it. The pre-fix prompt already carried a no-blanks rule and a
"do not reveal the answer" line, and the model still opened `ATCG` in 12/20 runs — the same
result FF-1 got on `fast-fact`.

Two aggravating factors made collision near-certain rather than occasional:

1. **Template monotony.** All 20 pre-fix templates began `ATCG`. When the display strand
   always starts with the canonical four bases and the challenge strand is also drawn from
   canonical-looking sequences, overlap is the default outcome, not bad luck.
2. **The 7-8 band was unreachable.** `gradeBand` was resolved as
   `gradeBandMap[ctx.gradeContext]`, indexing a token map (`'5'`, `'6'`, `'7'`…) with
   `ctx.gradeContext`, which is *prose* ("middle school students - …"). The lookup missed at
   every grade and `|| '5-6'` always won — probe B ran at `grade=7` and still produced
   `gradeBand: '5-6'`, 6-8 base sequences, and base-pairing mode only. This is the same class
   `service/biology/gradeBand.ts` was extracted to fix for four other biology generators;
   dna-explorer was missed because it uses a `5-6`/`7-8` vocabulary rather than
   `K-2`/`3-5`/`6-8`. Short display strands make a 4-base collision more likely still.

---

## 3. The fix, and why it sits at this layer

Per the repo's `schema-over-regex-and-prompt` doctrine, constraints belong in the response
schema and in code — never in prompt pleading, never in regex post-parsing of prose. A
cross-field constraint has no schema expression, so it lives in **code**. And base pairing is
fully deterministic, which means the answer never has to be *trusted* at all: it can be
*derived*. That is the strongest available position, so the fix takes it.

`validateDnaExplorerData` (`gemini-dna-explorer.ts:326-421`) runs after the config merge —
an override can reintroduce a leak exactly as readily as the model can — and enforces:

1. `sequence.complementaryStrand` is **recomputed** from `templateStrand`, never trusted.
2. No `buildChallenge.givenStrand` shares a 4-base run with the displayed `templateStrand`,
   read forwards or backwards, and none equals it.
3. `correctAnswer` is **always** `complement(givenStrand)` — the key is derived, so the
   answer-key-desync class is closed by construction rather than by check.
4. Challenges are distinct from one another; the set is backfilled to the band's floor
   (2 at 5-6, 3 at 7-8) rather than shipping a one-item demo.

(2) implies the answers are equally unreadable from the displayed complement: complementing
is a bijection on bases, so it maps shared runs to shared runs. The test asserts both
directions rather than relying on the argument.

**It repairs rather than rejects.** `buildNonLeakingStrand` walks the strand left to right
preferring the model's own base at each position and moving one only where it would complete
a forbidden run, so a clean generation passes through byte-identical (asserted) and a leaking
one loses the minimum. Rejecting would drop an otherwise-good lesson block over a fixable
coordinate. The PRNG is seeded from the payload, so a given generation always repairs the
same way.

Supporting changes, all in service of the same contract:

- **Schema + prompt** now state the rule where the model can act on it — `givenStrand` must
  share no 4-base run with the displayed sequence, and the Explore tab is described as
  *already solved on screen*. This does not enforce anything (code does), it just means the
  repair layer usually has nothing to do. Post-fix the model complies on its own.
- **Prompt/schema contradiction removed.** Requirement 5 asked for `givenStrand` "with some
  blanks shown as '_'" while the schema demanded a full strand with none. The component
  renders `_`/`?` as grey boxes and sizes the input from `correctAnswer.length`, so blanks
  produce an unanswerable item. `cleanStrand` also strips them defensively.
- **Grade band resolved canonically** — `ctx.grade` first, prose second, per the
  `generationContext.ts` contract. This was required to *verify* the fix at all: without it
  the 7-8 band, its 6-12 base strands and its 3-4 challenge sets were untestable.
- **Task text guard.** A task that quotes the key, or promises an mRNA transcript the
  component will not grade, is replaced with neutral wording.
- **Build challenges are DNA→DNA by contract, deliberately.** The component renders A/T/C/G
  only and its incorrect-answer feedback says "A pairs with T, and C pairs with G"
  (`DnaExplorer.tsx:318`), so an A→U key would be both unstyled and contradicted on screen.
  Base pairing stays biologically correct (A-T, C-G); RNA is taught in the transcription
  copy at `DnaExplorer.tsx:699`, not in the graded strand. See residual R3.

### The oracle was fixed too, and kept independent

`service/qa/oracles/dna-explorer.ts` now flags any shared run of ≥ 4 bases in either reading
direction. It is written as a from-scratch longest-shared-run scan rather than importing the
generator's predicate, per `/oracle-test` doctrine: a guard must not be allowed to certify
itself. Three new seeded cases prove it fires (partial overlap, reversed overlap) and one
proves it does not over-fire on a 3-base coincidence.

The pre-existing oracle fixture at `oracles/__tests__/dna-explorer.test.ts` — captured from a
real 07-09 generation and labelled "clean" — turned out to be leaking (`GCATGC` against
template `ATGCGT`, sharing `ATGC`). It has been re-pointed at `TTAACG`, and the strand it
used to carry is now a regression case. That fixture is direct evidence the leak was
invisible under the old definition, not merely under-reported.

---

## 4. Post-fix measurement

Same pipeline, same two parameter sets, 20 fresh generations, 0 failures.

| set | generations leaking | challenges leaking | exact `given==template` | key desyncs | non-ATCG strands |
|-----|--------------------|--------------------|------------------------|-------------|------------------|
| A (5-6 band) | **0/10** | **0/20** | 0 | 0 | 0 |
| B (grade 7)  | **0/10** | **0/31** | 0 | 0 | 0 |

**Total: 0/20 generations, 0/51 challenges. Pre-fix was 19/20 and 22/44.**

Independent code-judged confirmation — `/oracle-test`, 10 further generations with the
strengthened oracle:

```
status pass   runs 10   flakiness 0/10   totalViolations 0   byCheck {}
```

Two secondary effects visible in the post-fix runs:

- **The 7-8 band now works.** Set B returns `band=7-8`, `mode=replication`, 3-4 challenges
  of 6-12 bases (e.g. `CCGATTAGCCTA -> GGCTAATCGGAT`). Pre-fix every run was `5-6` /
  `base-pairing` / 2 challenges regardless of grade.
- **Template monotony largely broke.** `ATCG`-prefixed templates went from 20/20 to 0/20
  (now `GCATTAG`, `CGTATAACCG`, `GCAATTGCAT`, …). Not fully solved — see residual R1.

---

## 5. Domain scan — is the leak class domain-wide?

Precedent said yes (FF-1 on `fast-fact`: Math 6 / LA 24 / Science 15 once someone looked).
It is. I scanned all 17 biology generators plus their components for the class *an answer
field equal to, or trivially derivable from, a displayed stimulus field*. **Per the scope
fence I fixed only dna-explorer; everything below is filed, not fixed.**

### CONFIRMED — cell-builder prints the answer on the object being placed

`CellBuilder.tsx:980-984`

```tsx
{organelle.correctZone && (
  <div className="text-[10px] text-slate-500 truncate">
    Zone: {ZONE_LABELS[organelle.correctZone]}
  </div>
)}
```

Every **unplaced** organelle in the drag palette is labelled with the zone it belongs in —
"Zone: Center", "Zone: Near Nucleus", "Zone: Cell Edge" — and the drop zones on the diagram
carry those same names. Grading is `isInZone(pos, o.correctZone)` (`CellBuilder.tsx:416`).
There is **no gate**: not `hasSubmitted`, not a support tier, not a grade band. The student
reads the destination off the card and drags it there.

This is worse than DNA-1 — it is the answer in the default UI state, CLAUDE.md priority #1
verbatim — and it is a **component-layer** defect, so no generator change can close it.
Severity CRITICAL. Confirmed by reading an unconditional JSX block; not yet browser-driven.

### SUSPECTED — filed for measurement, not asserted

| candidate | answer field | displayed field that may give it away | evidence |
|-----------|--------------|--------------------------------------|----------|
| `life-cycle-sequencer` | `correctPosition` (`gemini-life-cycle-sequencer.ts:56`) | `stage.description` renders pre-submit on the scrambled card (`LifeCycleSequencer.tsx:541`); the schema asks for "2-3 sentences describing what happens during this stage", and a sentence like "The egg hatches into a caterpillar" names the next stage's label and gives the order away. `transitionToNext` (`:69`) is the ordering answer written out in prose — currently NOT rendered, so it is a latent leak that any future card redesign would expose. | structural; needs a probe |
| `classification-sorter` | `correctCategoryId` (`gemini-classification-sorter.ts:81`) | `item.hint` (`ClassificationSorter.tsx:490`) — gated behind an incorrect placement, but the item is retryable, and the schema places no constraint against the hint naming the category. This is the SS-5 pattern exactly. | structural; needs a probe |
| `process-animator` | `checkpoints[].correctIndex` (`gemini-process-animator.ts:98`) | the checkpoint asks about "the process so far" while the preceding stage's `narration` is on screen; if the correct option is a verbatim span of that narration it is a copy task, not comprehension. No anti-clustering on `correctIndex` either (FF-2a class — the two in-file examples are index 0 and 1). | structural; needs a probe |

### CHECKED AND CLEAR

- `food-web-builder` — `correctConnections[].relationship` is answer-bearing prose
  ("Rabbits eat grass", `gemini-food-web-builder.ts:76-79`) but is consumed only at check
  time (`FoodWebBuilder.tsx:186,197`); student-drawn edges are labelled from their own
  organism names (`:153`). Not rendered pre-submit.
- `adaptation-investigator` — `expectedReasoning` is gated behind `response?.revealed`
  (`AdaptationInvestigator.tsx:658`), i.e. after answering. Correct.
- The remaining 12 biology generators carry no discrete answer key at all (they are
  explainer/reference primitives), which is itself the BIO-2 finding — `supportsEvaluation:
  true` with nothing the IRT selector can route.

---

## 6. Files changed

| file | change |
|------|--------|
| `src/components/lumina/service/biology/gemini-dna-explorer.ts` | answer-contract layer (`validateDnaExplorerData`, `strandLeaksTemplate`, `buildNonLeakingStrand`, `complementStrand`, `cleanStrand`); schema + prompt state the disjointness rule; blanks contradiction removed; canonical grade-band resolution |
| `src/components/lumina/service/qa/oracles/dna-explorer.ts` | independent shared-run leak detection (was equality-only) |
| `src/components/lumina/service/biology/gemini-dna-explorer.answer-leak.test.ts` | **new** — 17 cases over unmutated pre-fix generations |
| `src/components/lumina/service/qa/oracles/__tests__/dna-explorer.test.ts` | "clean" fixture re-pointed (it was leaking); 3 new seeded cases for the run check |
| `qa/EVAL_TRACKER.md` | DNA-1 struck; CB-1 / LCS-1 / CS-1 / PA-1 / DNA-2 filed |

## 7. Gates

| gate | result |
|------|--------|
| `./node_modules/.bin/tsc --noEmit` | **806 errors = baseline 806, zero new.** Baseline established by restoring pristine `HEAD` versions of the touched files and re-running, then `comm`-diffing the sorted error sets — empty. (An earlier 805 reading was taken while a concurrent session had the tree mid-edit; the pristine-HEAD number is the honest one.) |
| `npm test` | **190/190 files, 2438/2438 tests pass.** |
| pre/post generation measurement | **19/20 → 0/20 generations; 22/44 → 0/51 challenges.** The gate that matters. |
| `/oracle-test` × 10, strengthened oracle | `pass`, 0 violations, 0 flakiness |

## 8. Residuals — honest

- **R1 — template monotony is reduced, not solved.** `ATCG`-prefixed templates went 20/20 →
  0/20, but set A produced `GCATTAG` in 5 of 10 runs and `TTAACG` recurs across challenges.
  The fix guarantees *no leak*; it does not guarantee *variety*. This is the SP-19 class and
  a prompt-entropy lever is known-moderate at best (see SST-1). Filed as DNA-2, low priority.
- **R2 — the fix is verified at the generator boundary, not in a browser.** 40 generations
  through the real pipeline plus 10 oracle runs confirm no shipped payload carries the leak.
  I did not drive DnaExplorer in Chrome. The component was not modified, so nothing in the
  render path changed — but *"should work — needs a browser check on the Build tab"* is the
  accurate claim for the visual, and the payload claim is fully measured.
- **R3 — RNA is deliberately out of contract for build challenges.** A transcription rung
  (A→U keys) would need `BASE_COLORS` to carry `U` and the feedback line at
  `DnaExplorer.tsx:318` to become pairing-aware. Not a bug today — a generation asking for an
  mRNA transcript is now rewritten to the DNA-complement task rather than shipping a
  task/key mismatch. Filed as a follow-up, not a defect.
- **R4 — the domain scan is structural for three of four candidates.** CB-1 is confirmed by
  code; LCS-1, CS-1 and PA-1 name the exact field pair and file:line but were not probed —
  the scope fence said file, do not fix, and an unmeasured severity should not be asserted.
  `/oracle-test` is the right executor and there is no oracle for any of them yet.
- **R5 — `checkAnswerVariety` never fires at the 5-6 band.** It needs ≥3 values; the band
  ships 2 challenges. Clustering is unpoliced there. Minor, folded into DNA-2.
