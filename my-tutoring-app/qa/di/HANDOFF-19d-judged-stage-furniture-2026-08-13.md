# HANDOFF — 19d: judged stage furniture (`JudgedMicPanel` + `phaseResultsFromSummary`)

> ✅ **EXECUTED 2026-08-13 — 19d is SHIPPED. This file is kept as the pre-measurement, not
> as a pull.** What it predicted and what it got wrong is written up in `qa/di/BACKLOG.md`
> item 19d; the two corrections worth carrying forward are (1) the label lie was **four**
> ports wide, not just cvc-speller, and (2) **no** status-line block was wholly redundant —
> the redundancy was 41 individual lines, and read-aloud-studio had none at all.
> **The next machine pull is 19b, and it must ship with a mic drive.**

**Written 2026-08-13, at the close of the 19a testkit sweep. Owning queue: `qa/di/BACKLOG.md` item 19.**
Read item 19's header block first — it is the diagnosis this whole item series answers.

---

## 1. Where the lane is

- **19a SHIPPED** (this session): all 13 di-script suites on `checkPackGates` +
  `checkDiCatalogEntry` + `spokenSpanOf`. Nine packs' contract wording fixed to the
  fact-form. Full write-up is BACKLOG item 19a — including three gate-level corrections
  the plan did not anticipate.
- **19d is the next pull.** The Runner API migration (item 19's point 3) rides along inside
  it — do not give it its own slice.
- **NOT yet in scope, and each for a stated reason:**
  - **19b** (micLevel context churn) — biggest win per line, but it MUST ship with a real
    mic drive. Never on tsc. See `[[feedback_lumina-context-identity-churn]]`.
  - **19c** (runner absorbs the falling-edge + stillness timers) — wants the **#98
    ten-frame sitting first**; it rewrites the exact machinery that sitting exercises.
  - **19e/19f/19g/19h** — after these.
- **The lane's named pull is still the MIC SITTING (#98 + #86).** 19d is machine work that
  proceeds in parallel without waiting on ears.

⚠️ **The tree is uncommitted and large.** `main` == `origin/main` == `6161a0f` and holds
none of ports 8–12. Check `git status` before assuming a file is yours.

---

## 2. What 19d is, with the anchors already measured

### (a) `phaseResultsFromSummary` — **14 copies, confirmed by census**

```
literacy/  CvcSpeller · DecodableReader · LetterSoundLink · LetterSpotter · PhonemeExplorer
           PhonicsBlender · PictureVocabulary · RhymeStudio · SoundSwap · WordFlip
math/      CountingBoard · TenFrame
physics/   PushPullArena
direct-instruction/ DiSpokenPractice
```

Every one is `useMemo<PhaseResult[]>` over `runner.summary.outcomes`. The canonical shape
(from [LetterSpotter.tsx:410-423](../../src/components/lumina/primitives/visual-primitives/literacy/LetterSpotter.tsx#L410-L423)):

```ts
const phaseResults = useMemo<PhaseResult[]>(() => {
  if (!evaluation.hasSubmitted || !runner.summary) return [];
  return items.map((item) => {
    const outcome = runner.summary!.outcomes.find((o) => o.id === item.id);
    const meta = MODE_META[item.mode];
    return {
      label: meta.badge, icon: meta.icon,
      score: outcome?.score ?? 0,
      attempts: (outcome?.corrections ?? 0) + 1,
      firstTry: !!outcome?.solved && (outcome?.corrections ?? 0) === 0,
    };
  });
}, [evaluation.hasSubmitted, runner.summary, items]);
```

Everything except `MODE_META[item.mode]` is invariant. Signature to aim for:
`phaseResultsFromSummary(items, summary, (item) => PhaseConfig)`.

**Check the outliers before sweeping** — `ReadAloudStudio` has `statusLines` but did NOT
appear in the `useMemo<PhaseResult[]>` census, so it builds its summary some other way;
`TenFrame` groups outcomes by `kindOf(o.id)` before mapping. Two shapes, not one. Do not
force the odd ones through the shared helper if it costs a lie.

⚠️ There is already a `hooks/usePhaseResults.ts` for the **non-judged** path
(`useChallengeProgress` results, phase GROUPING, `getScore`). Different input, different
job. Decide deliberately whether the new helper lives beside it or inside it — but do not
let a reviewer think the duplication was unnoticed.

### (b) `JudgedMicPanel` — pilot on **letter-spotter**

`LuminaMicListener` has **47 call sites repo-wide**; the judged ones are the ~14 above.
The per-port block is `LuminaMicListener` + `<p>{runner.statusLine}</p>` with the same
props ([LetterSpotter.tsx:660-680](../../src/components/lumina/primitives/visual-primitives/literacy/LetterSpotter.tsx#L660-L680)).

**Pilot letter-spotter because it is the only port with the answerKind-aware label already**
— the shared panel then inherits proven behavior rather than inventing it:

```tsx
listeningLabel={currentItem?.answerKind === 'voice' ? 'I’m listening' : 'Your turn — tap it'}
```

**This fixes a real lie as a side effect:** [CvcSpeller.tsx:1109](../../src/components/lumina/primitives/visual-primitives/literacy/CvcSpeller.tsx#L1109) hardcodes
`listeningLabel="I’m listening"` and CvcSpeller has BUILD items (`spell-word`) where the
answer is the placement, not speech. The orb currently claims to be listening for an answer
it will not receive.

⚠️ **`LuminaMicListener` is the shared live-capture orb — never re-roll it**
(`[[project_lumina-mic-listener]]`). `JudgedMicPanel` WRAPS it; it does not replace it.
The Lumina kit is the frame, never the interaction (`lumina/CLAUDE.md`).

### (c) statusLines that re-supply runner defaults — **11 blocks, 4 suspected redundant**

```
DiSpokenPractice:135 · DecodableReader:342 · LetterSoundLink:276 · LetterSpotter:303
PhonemeExplorer:255 · PictureVocabulary:235 · ReadAloudStudio:225 · RhymeStudio:268
CountingBoard:423 · TenFrame:307 · PushPullArena:526
```

The item claims 4 of these just restate the runner's own defaults. **Measure, do not trust
the number** — diff each block against the defaults in `useJudgedScriptRunner.ts` and delete
only exact matches. Status-line text is pack-owned PEDAGOGY (`JudgedStatusLines` docblock);
a near-match is a deliberate difference, not noise.

---

## 3. The Runner API migration — rides along, no separate slice

The additive API is already shipped: `runner.canAttempt` and `runner.currentSolved`
(19-review slice; ten-frame already consumes `currentSolved`).

**As each component is opened by (a) or (b) above** — and only those — swap its
hand-composed gates for the runner's and delete the local `revealed`/`solved` latches.
A few lines per port. Do not open a component just to migrate it.

---

## 4. Gates for this slice

```
cd "c:/Users/xbox3/claude web tutor/my-tutoring-app"
npx vitest run di-script judgedScript      # 15 files / 429 tests as of this handoff
npx vitest run                             # 3043 pass · 4 skipped is the baseline
npm run typecheck:lumina                   # must be 0
./node_modules/.bin/tsc --noEmit           # 803 repo baseline; 0 in every TOUCHED file
```

The canvas-confetti `clearRect` unhandled error out of
`SolarSystemExplorer.eval-loop.test.tsx` is **pre-existing and unrelated** — do not chase it.

⚠️ **19d is a RENDER change, and tsc says nothing about render.** Per the Verification
Doctrine this cannot be reported as "fixed and verified" on machine gates alone. Either
drive one port in the browser, or say plainly *"should work — needs a browser check on the
mic panel"*. The honest fold: **the CvcSpeller label fix and the shared panel both want a
glance during the #85/#98 drives already scheduled** — add them to those rows, do not file
new ones.

---

## 5. Traps this session hit that will recur

1. **A gate can be ON and ASLEEP.** `findRepeatedConsecutiveAsks` compares consecutive
   SAME-action items, and every port's fixture pack was one-item-per-mode — the one shape
   that can never trigger it. Adopting it was a no-op on 12 of 13 suites until each got a
   second pack in the real session shape. **Before trusting a green gate, ask what fixture
   shape would make it fire.** Same question applies to whatever 19d asserts about a shared
   panel: a test that renders one port proves the panel renders, not that 14 ports kept
   their behavior.
2. **A shared helper can quietly LOSE a check.** `catalogProseCues` had to start scanning
   directive TITLES because rhyme-studio's hand-rolled scan covered them and the shared one
   did not. **Diff what each hand-rolled copy checked before deleting it.** This is the
   exact risk in (a) and (c) above.
3. **The doctrine is FACTS about the turn, never orders.** Applies to any new prose.
4. **User ruling, standing: the pre-runner four** (phonics-blender, sound-swap, word-flip,
   cvc-speller) **stay off `useJudgedScriptRunner` until one needs real work.** 19d touches
   their FURNITURE (they render mic panels and phase results like everyone else) — that is
   fine and in scope. Moving their loop is not.
5. **Do not touch the five di-bench `direct-instruction/di*Script.ts` packs.** They still
   carry `"and stop, then wait again"` (11 sites) deliberately — no di-script suite, own
   support-tiers tests, they adopt with their next touch.
6. **Serial, not fan-out** (`[[feedback_serial-over-workflow-token-budget]]`). One port at a
   time. Pilot letter-spotter, exercise it, then sweep.

---

## 6. Close-out

Whoever closes 19d updates **`qa/di/BACKLOG.md` item 19d AND `WORKSTREAMS.md` stream 2 in
the same slice** (CLAUDE.md §Project Management), and folds any un-heard render change into
an EXISTING mic row in `qa/HUMAN-CHECKS.md` — see the ➕ block above the 2026-08-11 header
for the pattern 19a used. Next free HUMAN-CHECKS ID is 99; you should not need it.
