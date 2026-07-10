# Ship — Verify, Slice, Commit, Push

Turn the working tree into pushed, coherent, verified commits — and keep `main` fresh. The outcome: every slice of work lands as a commit that one sentence can describe, that `git revert` can undo alone, that passed the real gates before it was written, and that `main` receives within days, not weeks.

This skill exists because a month-long retrospective (2026-07-05) found the repo's three ship-time failure modes: work piling up uncommitted or on a stale branch (a full month lived on one branch while `main` aged 33 days), omnibus commits (167-file commits that can't be bisected or reverted), and "fixed" claims committed without the flow ever being exercised. `/ship` is the enforcement point for all three.

## When to Use This Skill

- The user says "commit this", "ship it", "let's commit what we have", or `/ship`
- A slice of work is done and verified and needs to land
- The working tree has accumulated several unrelated changes that need to be untangled into commits

**DO NOT use this skill for:**
- Verifying that a change works (that's `/verify` or the skill's own Phase 1 gates — `/ship` consumes verification, it doesn't replace it)
- Publishing curriculum (draft → lineage-check → publish pipeline; see Curriculum Rules in CLAUDE.md)
- Anything requiring `--no-verify`, `--force`, or amending pushed commits — `/ship` never does these

## The Gates (what "verified" means here)

Per the CLAUDE.md **Verification Doctrine**, a commit claims the work is real. Before writing one:

| Gate | Command | Bar |
|---|---|---|
| Lumina type gate | `cd "<abs>/my-tutoring-app" && npm run typecheck:lumina` | **0 errors** in the active surface (the script ignores the frozen legacy count) |
| Frontend tests | `cd "<abs>/my-tutoring-app" && npm test` | pass |
| Backend tests (if `backend/` touched) | `cd "<abs>/backend" && python -m pytest tests/` | pass |
| Runtime exercise | n/a — a question, not a command | Has the affected flow been driven (browser, tester, `/eval-test`, probe)? |

The runtime gate is the one that catches what tsc can't. If the flow **was** exercised, say so in the commit body (one line: what was driven and what was observed). If it **was not**, stop and tell the user: *"should work — needs a browser check on \<flow\> before I commit"*. Never commit a runtime-behavior change with an unlabeled, unexercised claim.

## Step-by-Step Workflow

### Phase 1: Inventory & verify

1. **Inventory the tree**: `git status --short` + `git diff --stat` (and `git diff --stat --cached` if anything is staged). Read enough of the diff to know what each file's change *is* — never ship a diff you haven't looked at.
2. **Triage untracked files** explicitly, one by one: real source → include with its slice; scratch/debug scripts → leave out (or delete, with the user's OK); generated/log noise → propose a `.gitignore` line. **Never `git add -A` blindly.**
3. **Hunt debug residue** in the staged-to-be diff: stray `console.log` added during debugging, commented-out experiments, hardcoded test student IDs. Remove before shipping (intentional structured logs stay).
4. **Run the gates** (table above). A gate failure stops the ship — fix or explicitly descope the failing file from every slice, and tell the user which.

### Phase 2: Slice

5. **Group the changes into slices** — one slice = one story: a feature and its registry/catalog/types/doc churn ride **together** (hub files like `catalog/math.ts`, `types.ts`, `primitiveRegistry.tsx` belong to the feature that motivated the edit); unrelated work (a drive-by bugfix, a skill edit, an unrelated doc) ships **separately**. If one file contains two stories, `git add -p` it.
6. **Sanity-check slice size**: a slice a sentence can't describe is two slices. Mechanical sweeps (N generators, same recipe) are legitimately large but must contain *only* the sweep.
7. **Present the slice plan** (slice → files → one-line message) to the user before committing if there's more than one slice or anything was descoped/deleted. A single obvious slice can proceed directly.

### Phase 3: Commit

8. **Stage exactly one slice**: `git add <files...>` (or `-p` for mixed files). Verify with `git status --short` that staged = the slice, nothing more.
9. **Write the message via file, not `-m`** — the Bash tool is bash, not PowerShell; multi-line `-m` strings and here-string `@` syntax have corrupted commit subjects before ([[bash-tool-commit-messages]]). Write the message to the session **scratchpad** (never the repo), then:
   ```bash
   git commit -F "<scratchpad>/commit-msg.txt"
   ```
10. **Message format** — match the repo's conventional style:
    - Subject: `feat(lumina): ...` / `fix(lumina): ...` / `refactor`, `chore`, `docs` — imperative, ≤ 72 chars
    - Body: what changed and *why*, plus the one-line verification note (what was exercised / "needs browser check on X" if shipping labeled)
11. **Repeat 8–10 per slice.** Never batch all slices into one commit to save steps — that's the omnibus antipattern this skill exists to kill.

### Phase 4: Push & main freshness

12. **Push the branch**: `git push` (set upstream on first push). If hooks fail, fix the cause — never `--no-verify`.
13. **Check main's staleness**: `git rev-list --count main..HEAD` and the date of `git log main -1`. Report both.
14. **Keep main fresh**: if the branch is stable (gates green, no half-built runtime-unverified surface at the tip) and main hasn't diverged, propose the fast-forward: `git checkout main && git merge --ff-only <branch> && git push && git checkout <branch>`. The standing rule from the retrospective: **main more than a few days stale is a risk, not a preference.** If the tip isn't stable, say what's blocking and when to revisit.

### Phase 5: Post-ship hygiene

15. **Close the loop in memory**: if this ship lands work a memory tracks as "Uncommitted" (check `MEMORY.md`), update that memory line to committed + hash.
16. **Report**: per-slice hash + subject, gates run + results, main's freshness after the ship, anything descoped or left uncommitted and why.

## Gotchas (read before shipping)

- **The `@` in the subject line**: PowerShell here-string syntax leaking into a bash `git commit` produced commits with `@` as the message — twice in one session. The Write-file + `-F` path (step 9) is mandatory, not stylistic.
- **Gitignored files still compile**: a file invisible to ripgrep/`git status` can still break the build. "Not in the diff" ≠ "not affected" — trust the gates, not the file list.
- **Don't rewrite what's pushed**: prefer a new commit over amend; never force-push. If a shipped slice was wrong, revert or fix forward.
- **Descoping is shipping too**: leaving a file out of every slice is a decision — name it in the report so it doesn't silently become next month's "Uncommitted" memory.
- **The legacy tsc count (~1040) is frozen context, not a target**: `typecheck:lumina` is the gate; a change to the legacy count in either direction is worth a sentence in the report, not a blocker.

## Final Checklist

- [ ] Diff read; untracked triaged one-by-one; no blind `git add -A`; debug residue removed
- [ ] Gates green: `typecheck:lumina` 0, `npm test` pass, pytest pass (if backend touched)
- [ ] Runtime exercise stated in each commit body — or the user explicitly OK'd shipping "should work, needs browser check on X"
- [ ] One story per commit; hub-file churn rides with its feature; sweep commits contain only the sweep
- [ ] Message written to scratchpad file, committed with `git commit -F`
- [ ] Pushed; main freshness reported; fast-forward proposed if stable
- [ ] "Uncommitted" memories updated; report lists hashes, gates, and anything descoped
---
name: ship
description: >-
  Verify, slice, commit, and push repository work as coherent changes. Use only when the user asks to ship, commit, or push completed work and the relevant verification gates can be run.
---
