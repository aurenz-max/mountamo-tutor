# Handoff — comparison-builder 2b TAIL @ PRE — 2026-07-19

**Execution** handoff for a delegated session. The 2b head (chrome band-gate,
one_more_less symmetry, 🔊 ReadMeButton) shipped 2026-07-16 (`39f2543`) — do NOT
re-touch those. This closes the remaining 2b bullets in
`qa/reader-fit/BACKLOG.md` and drains the last non-#13 reader-fit K item.

## Hot-tree warning (two reader-fit sessions live)
A sibling session is working **#13 counting-board** right now. Shared files WILL
move under you: `qa/reader-fit/BACKLOG.md`, `WORKSTREAMS.md`, `EVAL_TRACKER.md`,
the math catalog, `run_tutor_live.py`. Re-read each before editing; commit your
primitive + your BACKLOG strike in ONE tight slice; never batch shared-file edits.

## Paste this

> Work reader-fit BACKLOG item **2b (tail)** — comparison-builder @ PRE, the two
> remaining open bullets. Executor: `/reader-fit --fix comparison-builder`.
>
> **Contract-first:** `docs/contracts/comparison-builder.md` EXISTS (derived
> 2026-07-16, last edit COMPATIBLE). Read it, then run
> `/primitive-contract comparison-builder --check` on your edits — R1 (group
> pictures + middle "=" are the K answer surface) and the shipped chrome band-gate
> are live requirements; fork, don't ablate. Append the contract changelog.
>
> **Slice 1 — Audit-C rule 5, feedback on the object (K):** a wrong answer at K is
> still a text feedback card + generic beep. Make the TAPPED GROUP itself carry the
> feedback (flash/shake the group picture; SFX + spoken hint stay), text card hidden
> at K only. Reader grades keep the card. Precedent: rhyme-studio / word-workout
> rule-5 treatment (ring/shake + SFX, no text card).
>
> **Slice 2 — per-mode picture passes at PRE** for the three non-compare_groups
> modes, each its own tap/picture-primary + DISAMBIGUATE pass:
> - `one_more_less` — up to 21 number cells on screen is a rule-4 load violation at
>   K; cap/redesign the answer surface picture-primary.
> - `compare_numbers` — currently requires reading `<` `>` `=` symbols; needs a
>   picture-primary treatment (the symbols can't be the only answer surface at K).
> - `order` — direction badge is text; make the direction wordless/pictured.
> The bespoke live journey already supports all four challenge types via
> `disambiguate_groups` (`run_tutor_live.py`, `--eval-mode` passthrough) — reuse it,
> don't add a new journey.
>
> **Verify (doctrine — runtime, not tsc alone):** project-local
> `./node_modules/.bin/tsc --noEmit` 0-new + `npm run typecheck:lumina` 0; extend
> `ComparisonBuilder.reader-fit.test.tsx` (rule-5: wrong tap → group flash/no text
> card at K, card present at Grade-1 control; per-mode: picture-primary surface at
> K); `/eval-test` @ K per touched mode; live `--lesson --runs 3` per touched mode
> via the existing journey. Pixel look → HUMAN-CHECKS (new row, cite your report).
>
> **Close:** write `qa/reader-fit/comparison-builder-PRE-2b-tail-2026-07-19.md`,
> strike the two 2b bullets in BACKLOG, update WORKSTREAMS "last touched" — all in
> the same slice. If a mode turns out WRONG-BAND at PRE (like sorting-station's
> floored modes), band-floor it with catalog constraints + record the ruling rather
> than forcing a picture pass.
