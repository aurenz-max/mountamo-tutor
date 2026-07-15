> **✅ CLOSED 2026-07-15 — executed.** Verdict was PRIMITIVE-GAP + SCAFFOLD-GAP →
> **READY @ PRE for `sort_one` + `odd_one_out`**; `sort_attribute`/`count_compare`/
> `two_attributes`/`tally_record` **floored to Grade 1+**. Report:
> `qa/reader-fit/sorting-station-PRE-2026-07-15.md`. Live: `qa/tutor-reports/sorting-station-live-lesson-2026-07-15.md`.
> tsc 0-new + `typecheck:lumina` 0-err; jsdom 6/6; live `--lesson` 3/3 CONFIRMED.
> Uncommitted — commit on request. The brief below is retained for provenance.

# Handoff: reader-fit item 1e — sorting-station @ PRE (presentation audit + fix loop)

Paste-ready brief for a fresh session. Source: reader-fit `BACKLOG.md` item **1e** (the top
of the ACTIVE Reader-fit K queue) + a 2026-07-15 `/pm` ground-truth pass. Executor skill:
**`/reader-fit sorting-station K --fix`** (or bare `/reader-fit` — 1e is the top item).

## Why this one, and what's already done

sorting-station is a **K workhorse** — the 2026-07-14 K topic-trace census routed it in 4/6
lessons (shapes, needs/wants ×2, helpers, compare). Its **generator objective-drift is already
FIXED** (2026-07-14): `ctx.intent` binds the sorting rule, `category` is first-class, sort_one
varies objects not the taught axis. Report: `qa/topic-fidelity/sorting-station-2026-07-14.md`.
**Do NOT re-open the generator intent work.**

What remains is the thing that has never been done: the **PRE reader-fit presentation audit** —
can a 5-year-old who cannot read actually complete it, eyes + ears + one finger? It has NO
reader-fit report yet.

**It is partially instrumented already** (this is a fix-the-gaps job, not a rebuild):
- Component `SortingStation.tsx` has `gradeBand: 'K' | '1'` (defaults 'K') + `supportTier` in
  config, `useLuminaAI`, and `sendText` moments including `[ACTIVITY_START]` + attempt-tiered
  struggle hints.
- Catalog `service/manifest/catalog/math.ts` (id `sorting-station`, ~line 2989) has a `tutoring`
  block with `scaffoldingLevels`, and claims the band explicitly: *"ESSENTIAL for Kindergarten
  and Grade 1."* A K claim is a promise reader-fit holds it to.

## Files

```
Component:  src/components/lumina/primitives/visual-primitives/math/SortingStation.tsx
Generator:  src/components/lumina/service/math/gemini-sorting-station.ts   (intent already fixed)
Catalog:    src/components/lumina/service/manifest/catalog/math.ts          (id: 'sorting-station', ~2989)
```

**Templates — two structurally-identical PRE fixes already shipped; copy them, don't reinvent:**
`qa/reader-fit/word-sorter-PRE-2026-07-14.md` (staged-object tap-to-bin, bucketEmoji, chrome
hidden, match_pairs floored to Grade 1) and `qa/reader-fit/comparison-builder-PRE-2026-07-14.md`
(picture-primary tap surface, ORIENT+DISAMBIGUATE aiDirectives, live-confirmed). Both are in
BACKLOG Done. The bespoke live journeys those added to `run_tutor_live.py` are the pattern for
this one's journey.

## Ground rules (non-negotiable — from the reader-fit SKILL)

- **Probe REAL artifacts, never audit from source alone.** Dev server up (`npm run dev`), then
  per eval mode:
  - content: `curl -s -m 90 "http://localhost:3000/api/lumina/eval-test?componentId=sorting-station&evalMode=<mode>&gradeLevel=kindergarten&grade=K&topic=..."`
  - scaffold: `curl -s -m 120 "http://localhost:3000/api/lumina/tutor-test?componentId=sorting-station&probe=1&gradeLevel=kindergarten"`
  Judge the **worst-case render** (max objects), not the source — probe several draws.
- **The matching-fallback trap doesn't apply here, but the lesson-cap one does:** STIMULUS/ORIENT
  that lives only in a component `sendText` clause gets **dropped** under the lesson greeting /
  `[PRIMITIVE SWITCH]` "one sentence" cap. Confirm STIMULUS/ORIENT with
  `run_tutor_live.py --component sorting-station --lesson --runs 3` (≥2/3 = CONFIRMED), NOT just
  standalone. A standalone pass is not sufficient (the addition-subtraction-scene lesson bug).
- **Type check exactly:** `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` +
  `npm run typecheck:lumina`. Zero NEW errors vs baseline. Necessary, never sufficient.
- **Visual check is mandatory before re-audit** (`--fix`): drive the real flow in the math tester,
  interact as the child, screenshot for the user on visual changes. A fix not exercised at runtime
  is not fixed.
- Dev servers (:3000 / :8000) may already be running — don't restart; don't write under
  `backend/app/` mid-run (uvicorn --reload).
- Don't commit/push unless the user asks. Save the report at
  `qa/reader-fit/sorting-station-PRE-2026-07-15.md` (skill's format: Audit A / B / C tables +
  overall verdict + loop log); add `RF-N` rows to `EVAL_TRACKER.md` for HIGH findings; move item
  1e to Done in BACKLOG; update WORKSTREAMS "Reader-fit K queue" last-touched. Chrome findings the
  K-stage mode should own go under the BACKLOG systemic K-stage entry, not fixed per-primitive.

## Eval modes — audit each as its own task identity; band-floor what can't serve PRE

Six modes: `sort_one` (scaffoldingMode 1), multi-criterion sort (2), `count_compare` (3),
`odd_one_out` (3), `find_two_criteria` (4), `tally` (4). Confirm exact ids in the catalog block.
- **`sort_one` is THE K census route — audit + fix it FIRST.**
- **scaffoldingMode-4 modes (`find_two_criteria`, `tally`) are prime WRONG-BAND candidates at PRE**
  (two-criteria classification + tally-mark recording exceed a pre-reader). If a mode can't serve
  K, the correct outcome is a **band floor** on that eval mode (catalog constraint / eval-mode
  floor) — a success, not a failure (the word-sorter `match_pairs` → Grade 1 precedent).

## Expected findings to VERIFY (hypotheses from source — confirm by probe, don't assert)

Run the three audits (A: text census, B: sufficiency contract, C: band contract). Likely offenders
already visible in source, to confirm and fix at the named layer:

1. **Bins are text-labeled `Badge`s (cat.label), not picture-primary** → PRIMITIVE-GAP (rule 3).
   A pre-reader can't read "needs"/"wants" bin headers. Fix (COMPONENT, Tier 2): emoji/picture-
   primary bin headers with the word as caption; ensure each bin name is SPOKEN on orient. The
   generator already makes objects emoji-primary — extend to bins (bucketEmoji, per word-sorter).
2. **No `aiDirectives` in the catalog tutoring block** → STIMULUS/ORIENT drop under the lesson
   one-sentence cap → SCAFFOLD-GAP (Audit B). Fix (CATALOG, Tier 1): add the ORIENT + read-the-rule
   + DISAMBIGUATE (name the sorting rule / bin names) `aiDirectives` beat that explicitly overrides
   the one-sentence cap — the comparison-builder directive is the template. Answer-free (never leak
   which object goes where).
3. **Adult chrome in the child's field** — shadcn `Badge` + `LuminaBadge` + "Challenge progress
   badges" + attempt/progress counters → PRIMITIVE-GAP (rule 7). Fix: band-gate on `gradeBand==='K'`
   to hide counters/progress/attempt badges (plumbing already present). Record any lesson-level
   chrome under the K-stage systemic item.
4. **Up to 10 objects per challenge** (catalog constraint) blows **≤~5 interactive elements**
   (rule 4). Fix (Tier 3, generator/catalog): cap objects per challenge at PRE (band-scoped
   constraint), judged from the worst-case render.
5. **Check button (`handleCheckAnswer`/`canCheck`)** — JUDGE, don't reflexively delete. Sorting is
   a multi-item placement (multi-part construction), which rule 2 explicitly EXEMPTS from tap=choose.
   Keep the confirm if the task is batch-place-then-check; only collapse if a mode's selection is
   atomic. "Don't strip pedagogy while decluttering."
6. **FEEDBACK on the object** (rule 5): confirm a wrong placement flashes/shakes the object rather
   than only a text card / "N wrong" prose. Fix in COMPONENT if it's text-only.

## Definition of done

Per the skill's loop: each PRE-routable mode reaches **READY** (or an explicit WRONG-BAND floor
with the eval-mode band-floor applied), verified by re-audit after each fix slice; STIMULUS/ORIENT
**live-`--lesson` confirmed 3/3** (bespoke journey added to `run_tutor_live.py`); tsc +
typecheck:lumina clean; visual check driven. Then: report saved, EVAL_TRACKER RF rows added, BACKLOG
1e → Done, WORKSTREAMS touched. Pixel-level look → a HUMAN-CHECKS row (headless can't judge it).
