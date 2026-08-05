# di-math-facts `counting_next` — reader-fit 14g, fork resolved as Option B (gated)

**Date:** 2026-08-05 · **Lane:** Direct Instruction (serial, no Workflow fan-out —
user token ruling 08-05) · **Handoff:** `qa/HANDOFF-di-14g-counting-next-2026-08-05.md`
· **User call:** Option B (extend the pack to 120), with the bench sitting
accepted as development-enabling.

## What shipped

Two slices, in the handoff's order. Slice 1 is the parse fix Option B builds on;
slice 2 is the bench probe that the Option-B extension is gated behind.

### Slice 1 — the parse bug (unambiguous, closed)

`resolveTextScope` matched `(\d{1,2})`, so the published Grade-1 objective
`NBT001-01-a` ("Identify missing numbers when counting forward … within 120")
parsed as **"within 12"**. That fed `ceilingOf` → `buildCountingPool(12)` →
starts `a = 0..11` → the census's "values only through 12". Any three-digit ask
was silently mangled the same way (100 → 10), which is the worst failure shape
available: not a refusal, not a saturation, a wrong number that looks deliberate.

Fixed to `(\d{1,3})\b`. The `\b` is load-bearing — a bare `\d{1,3}` would read
"202" out of "to 2026"; anchored, a non-range number now pins nothing and falls
through to the model hint / grade default.

**The clamp did not move.** `Math.min(20, …)` stays, so a 120 ask now
**saturates at twenty honestly** instead of collapsing to twelve. That is the
di-sentence-reading precedent applied verbatim (its benched 8-word ceiling is a
hard cap that saturates, never a knob), and twenty is not arbitrary: it is the
last single-word entry in `NUMBER_WORDS`, i.e. the edge of the response class
the #46 probe sitting validated.

### Slice 2 — the bench probe for the MULTI-WORD NUMERAL class

Option B's substance (code-owned numerals to 120, decade-transition pool
windows) is blocked by DI standing gate 1: a new class of expected spoken
response benches before any primitive wires it. That gate is a ~30-min human
sitting, so what this slice could deliver is the sitting itself — wired, item by
item, so it can be run and read.

New bench set **"Counting to 120"** (`counting-120`, 10 hand-rolled items) and a
new `DIItemKind: 'counting'`.

**Why a new kind rather than more `fact` items.** The cue LINES are shared
byte-for-byte — the #46-benched wording is `problem`-phrased and already reads
correctly for counting ("Listen: the number after twenty-nine is thirty."), so
the probe tests the numeral class rather than new sentences. What forks is the
JUDGING BAR. The generic `fact` criterion is *"correct or reasonably close for a
kindergartener"*, and past twenty the plausible near-miss is no longer a
different-sounding number but the item's own teen/decade sibling. "Reasonably
close" would rubber-stamp exactly the error the sitting exists to detect. The
`counting` branch therefore mirrors the pack's shipped
`diMathFactsScript.judgingContract`: strict on a different number, strict on an
incomplete compound, permissive on child pronunciation and on counting up.
Splitting the kind leaves the #46-benched `fact` branch untouched.

**What the sitting decides** (named in the probe docblock, the
`SENTENCE_READING_PROBE_ITEMS` pattern):

- **(a) Teen/decade confusability — make-or-break.** Thirteen/thirty,
  fourteen/forty, sixteen/sixty, seventeen/seventy sit adjacent in exactly the
  range a 1–120 objective drills. Items 1–6 put both sides on the table. If Live
  affirms "thirty" for "thirteen", the pack cannot measure counting accuracy
  past twelve at all and **the honest answer is to keep saturating at twenty** —
  Option B dies on evidence, the way 14g's word-reading half flipped to
  WRONG-PRIMITIVE when steering was measured.
- **(b) Completeness + `silenceCloseMs`.** A compound numeral is one answer that
  arrives in pieces, so "twenty" for "one hundred twenty" is a wrong answer that
  sounds like a right one ending. A child who pauses between "one hundred" and
  "seven" also splits one answer into two voice turns at the family's 500ms
  close — the exact break di-sentence-reading hit at 3–8 words. If it shows,
  the fix is a PACK-scoped `silenceCloseMs`, never the family default.
- **(c) Cue readability at length** — does the model+guide pair drag once every
  line carries two long numerals?

**Deliberately not cross-aliased:** a teen never lists its decade sibling in
`asrAliases`. The alias check is the judge-vs-transcript disagreement meter, so
listing "thirty" under thirteen would hide the very confusion being measured.
Pinned by a test.

The bench's session scaffold gains one directive, **MULTI-WORD NUMBERS**, scoped
to compound and teen/decade forms so it cannot change the conditions #46
validated (that set's answers are one..ten, where neither shape exists).

## Gates

| Gate | Result |
|---|---|
| Non-vacuity — focused scope suite | **4 of 6 fail** when the regex is reverted to `\d{1,2}`, including the census-objective assertion and the end-to-end counting run |
| New tests | 6 scope (`gemini-di-math-facts.scope.test.ts`) + 6 bench (`diBenchModel.test.ts`) |
| DI + bench suites | 212/212 |
| Full Vitest | **1601/1601** for this slice alone (1,589 baseline + 12 new). Re-run at slice end with the concurrent voice-transport session's in-flight files also in tree: **1608/1608** — still all green, the extra 7 are theirs |
| `typecheck:lumina` | **0** |
| `tsc --noEmit` | **1021 = HEAD baseline, 0 NEW** (measured by stashing the slice and re-running; note the recent reader-fit entries cite "803", a different measurement — 1021 is what this tree produces at `a7689d6` with the slice absent) |
| Standing gate 2 (sentinel collision) | mechanically scanned over the assembled counting prompt: **241 sentences, 0 unexpected `Yes`/`My turn` openers** |
| Standing gate 3 (correction re-models) | `correctionLine` re-models the whole item then re-elicits, unchanged shape |
| Real pipeline | **5/5** (below) |

### Real-pipeline probes (dev server :3005, eval-test route, real Gemini)

| # | Probe | Result |
|---|---|---|
| A | census objective, `counting_next` pinned, G1 | `16 → seventeen`, `15 → sixteen`, `13 → fourteen`, `11 → twelve`, `0 → one` — **max answer 17**, above the old 12 ceiling; every `answerWord` defined |
| B | same + `difficulty=hard` | max answer **18**, all 5 stamped `supportTier: hard`; the L4 cross-ten rung now has real pool support (`9 → ten`, `10 → eleven`) |
| C | CONTROL — `answer_fact`, "addition facts within 10" | unchanged: sums 3–10, within-10 pool intact |
| D | CONTROL — K, "count forward within 5" | unchanged: ceiling 5, starts 0–4 |
| E | census objective, `subtraction_fact` | shares the raised ceiling honestly — minuends to 20, every answer still a single number word |

No item anywhere produced an `undefined` answer word, which is the failure mode
that would appear the moment the ceiling passed twenty without the numeral
builder (`NUMBER_WORDS[21]`).

## Honest residual

**A 1–120 counting objective is served within twenty, not within 120.** That is
saturation, not the defect — but it is not what the objective asks for, and it
stays that way until the sitting passes. Two things follow:

1. **The extension is queued, not built** (`qa/di/BACKLOG.md` item 10, with the
   post-sitting implementation named line-exact). Writing the numeral builder
   before the sitting would be building against an unmeasured assumption; if (a)
   fails, the right code is *no* code.
2. **Option A's catalog steering was deliberately NOT taken.** The handoff scopes
   it to Option A and says only the regex fix carries into B — correctly, since
   naming "counting beyond twenty" out of scope now would be reversed by B
   itself. The cost is real and worth stating: while the gate is open, a G1
   "within 120" ask still routes here and gets a within-20 session, where
   number-sequencer (14h) and number-line (14k) genuinely reach 120 today. **If
   the sitting slips, take A's steering as an interim** — it is a one-sentence
   `constraints` edit plus the `manifestOnly` before/after measurement 14g's
   word-reading half already templated.

## Bookkeeping

- `qa/di/BACKLOG.md` — **item 10** opened (the gated extension + the sitting).
- `qa/reader-fit/BACKLOG.md` §14g — closed out of that queue; ownership recorded
  as transferred to DI item 10. The EMERGING census is now fully drained.
- `qa/HUMAN-CHECKS.md` — **#63**, the bench sitting.
- `EVAL_TRACKER.md`, `WORKSTREAMS.md` — updated in this slice.

## Files

- `src/components/lumina/service/direct-instruction/gemini-di-math-facts.ts`
- `src/components/lumina/service/direct-instruction/gemini-di-math-facts.scope.test.ts` (new)
- `src/components/lumina/components/di-bench/diScript.ts`
- `src/components/lumina/components/di-bench/diBenchModel.ts`
- `src/components/lumina/components/di-bench/diBenchModel.test.ts`
- `src/components/lumina/components/di-bench/DirectInstructionBench.tsx`
