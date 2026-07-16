# Handoff — Reader-fit explainer-tail #9b–#9d (2026-07-16)

Three ready-to-paste prompts for the remaining reader-fit BACKLOG tail after
#2b / #11 / #9a were delegated to their own sessions (see
`HANDOFF-reader-fit-pulse-2026-07-16.md`). These three are the explainer-tail
text surfaces that did NOT match the fact-file MCQ helper shape — each is bespoke.
Source: `qa/reader-fit/BACKLOG.md` items **9b**, **9c**, **9d**.
Owning stream: reader-fit K queue (ACTIVE, single-stream).

**Shared house rules (apply to all three):**
- **Verification doctrine (CLAUDE.md):** done only after the flow is exercised at
  *runtime* — `/eval-test`, live `--lesson`, or a driven probe. tsc is necessary, not
  sufficient: `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` (0 NEW) +
  `npm run typecheck:lumina`.
- **Contract-first (CLAUDE.md):** read `docs/contracts/<primitive-id>.md` if it exists;
  derive via `/primitive-contract` when the edit is non-trivial. Fork on conflict.
- **Pedagogy rule #1:** never leak the answer via labels, defaults, or chrome.
- **flash-lite emoji footgun (memory):** flash-lite silently EMPTIES a nested schema
  array when you also ask it to emit emojis in that array. When adding a card-face/option
  emoji field, make it a **flat** field (`option1Emoji`, `cardEmoji`) OR attach the emoji
  **deterministically in post-process** from a curated menu — never a nested `{word, emoji}[]`.
- **PRE read-aloud pattern (proven):** the durable carrier is a catalog PRE-READER READ-ALOUD
  `aiDirective` that overrides the lesson one-sentence cap at Grade K, spoken answer-free.
  Reuse the shape shipped on foundation-explorer / fact-file / knowledge-check.
- **Parallel-session hygiene (several reader-fit sessions are live right now):** #2b/#11/#9a
  are running elsewhere. These three touch DIFFERENT primitives, so component collisions are
  unlikely — but `BACKLOG.md`, `WORKSTREAMS.md`, the catalog files, `run_tutor_live.py`, and
  `EVAL_TRACKER.md` are SHARED. Re-read a shared file immediately before editing it, expect it
  to have changed on disk, and commit each primitive's own files + its BACKLOG/WORKSTREAMS
  strike in a tight slice. If you touch a catalog file another session is in, keep your edit
  localized to your primitive's block.

---

## 9b. concept-card-grid @ PRE — bespoke (flip-to-read, NO self-check)

**Paste this:**

> Work reader-fit BACKLOG item **9b** (concept-card-grid @ PRE). The `PreReaderSelfCheck` helper
> does NOT apply — there is no MCQ; it's a flip-to-read card (`definition` / `curiosityNote` /
> `timelineContext` prose; `originStory` / `subheading` are generated-but-unrendered).
>
> **Treatment (bespoke):** read-aloud-on-flip (voice `definition` + curiosity note when a card
> flips), an emoji/image-primary card FACE, and hide chrome at K ("Exhibit 0N", "Flip to Analyze",
> section headers, the `el.type` badge).
>
> **Prerequisite plumbing (do this first):** the generator is POSITIONAL `(topic, gradeContext,
> config)` — refactor to ctx-native (read `ctx.grade`), stamp a `gradeLevel` field, add a
> pre-reader signal to `contextKeys` + component props (currently NONE threaded), and add a catalog
> PRE-READER READ-ALOUD `aiDirective` (catalog has `CARD EXPLORATION` / `CARD RETURNED` only). The
> card-face emoji must be a flat field or code-attached (flash-lite footgun above).
>
> Contract-first: derive `docs/contracts/concept-card-grid.md` via `/primitive-contract` before the
> generator refactor (reader-grade behavior is a live requirement — band-gate, don't remove). Verify:
> tsc 0-new + `typecheck:lumina` 0; jsdom band tests (read-aloud-on-flip fires at K, chrome hidden at
> K / present at grade-1 control); `/tutor-test --probe` 0 findings (new directive + keys resolve);
> `/eval-test` @ K (card-face emoji present + distinct); live `--lesson` if a bespoke journey is
> feasible (else note "needs a browser check on the flip read-aloud"). Executor:
> `/reader-fit --fix concept-card-grid PRE`. Close item 9b + WORKSTREAMS in the same slice; pixel → HUMAN-CHECKS.

---

## 9c. comparison-panel @ PRE — bespoke (picture true/false gate, not MCQ)

**Paste this:**

> Work reader-fit BACKLOG item **9c** (comparison-panel @ PRE). The graded gate is **boolean**
> (`gates[].correctAnswer: boolean`, two hardcoded True/False text buttons + Submit) — NOT the MCQ
> helper's shape. Prose walls: `points[]` / `synthesis.*` paragraphs.
>
> **Treatment (bespoke):** a **picture true/false gate** (👍/👎 or two picture cards, tap=choose,
> no Submit) + read-aloud of the gate question at K; hide chrome (Option A/B badges, "Comprehension
> Check N of M", the VS badge, synthesis section labels).
>
> **Prerequisite plumbing:** the generator is POSITIONAL with no ctx and passes no grade to the
> component — same ctx-native refactor + `gradeLevel` stamp + grade-threading as 9b. Catalog has 5
> `aiDirectives` but no PRE read-aloud — add one. **Check for `{{#if}}` handlebars in the scaffold**
> (unsupported by the backend — flatten to a component-derived field if present; ref SP-27 invariant
> 6.1). 
>
> Contract-first: derive `docs/contracts/comparison-panel.md` before editing. Verify: tsc 0-new +
> `typecheck:lumina` 0; jsdom band tests (picture T/F tap=choose at K, chrome hidden at K / present
> at grade-1 control; no literal `{{...}}` survives); `/tutor-test --probe` 0 findings; `/eval-test`
> @ K; live `--lesson` if feasible else flag the browser check. Executor:
> `/reader-fit --fix comparison-panel PRE`. Close item 9c + WORKSTREAMS in the same slice; pixel → HUMAN-CHECKS.

---

## 9d. flashcard-deck @ PRE — bespoke (flip + self-rate; **no tutoring block exists yet**)

**Paste this:**

> Work reader-fit BACKLOG item **9d** (flashcard-deck @ PRE). No self-check — it's flip
> term/definition + a "Study Again" / "Got It" self-rate. `PreReaderSelfCheck` does NOT apply.
>
> **Treatment (bespoke):** read-aloud-on-flip (voice `term`, then `definition`), a per-card
> emoji/image field as the card FACE (none exists today — add it flat / code-attached per the
> flash-lite footgun), and hide chrome (the "3/8" card counter, progress dots, "Click to Reveal",
> button sublabels).
>
> **Prerequisite plumbing (LARGEST of the three):** `FlashcardDeckData` has no `gradeLevel`; the
> generator reads `ctx.gradeContext` not `ctx.grade`; and **the catalog entry has NO `tutoring`
> block at all** — you must AUTHOR one (taskDescription + contextKeys + a PRE-READER READ-ALOUD
> directive) before any scaffold can reach the tutor. Use `/add-tutoring-scaffold` for the new
> block, then band-gate the PRE read-aloud.
>
> Contract-first: derive `docs/contracts/flashcard-deck.md` before editing (this primitive may have
> no contract yet — that's fine, `/primitive-contract` creates it). Verify: tsc 0-new +
> `typecheck:lumina` 0; jsdom band tests (read-aloud-on-flip fires at K, card-face emoji present,
> chrome hidden at K / present at grade-1 control); `/tutor-test --probe` 0 findings on the NEW
> block (keys resolve from the component); `/eval-test` @ K; live `--lesson` if a bespoke journey is
> feasible, else flag "needs a browser check on flip read-aloud + new tutor block". Executor:
> `/reader-fit --fix flashcard-deck PRE` (+ `/add-tutoring-scaffold` for the missing block). Close
> item 9d + WORKSTREAMS in the same slice; pixel → HUMAN-CHECKS.

---

### Sequencing recommendation
**9c comparison-panel** first (picture T/F is a clean, well-scoped bespoke shape) → **9b
concept-card-grid** (read-aloud-on-flip, moderate plumbing) → **9d flashcard-deck** (heaviest —
needs a whole new tutoring block authored). All three share the same ctx-native generator refactor
+ grade-threading pattern, so whoever does the first one should note the pattern for the next two.

### After #9b–#9d + #2b close, the K queue drains
Remaining reader-fit work is then: #2b's other eval modes (one_more_less / compare_numbers / order),
the lesson-mode sweeps, and the systemic items (direct-manipulation audit, "🔊 Read me" generalize).
Milestone: re-run the topic-trace census at **grade 1 (EMERGING)** to re-seed the queue at the next band.
