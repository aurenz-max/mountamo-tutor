# HANDOFF — 18d on the pre-runner four (2026-08-15)

**Scope:** `phonics-blender`, `sound-swap`, `word-flip`, `cvc-speller` — the four judged packs
that predate `useJudgedScriptRunner`.
**Queue of record:** `qa/di/BACKLOG.md` item **18d** (the parallelizable remainder; the other
~12 entries ride inside the 19h-i-b sweep).
**Executor:** targeted catalog edits in `service/manifest/catalog/literacy.ts` + the gates in §6.
**Est:** ~1 slice for §4 step 1. Step 2 is a ruling, not code.

---

## 1. Why this is separable from 19h-i-b

18d rides *inside* the 19h-i-b sweep for the nine runner ports — each port's slice fixes its own
rungs and re-drives with `--di-cap`, because **the cap drill is 18d's evidence**. These four can
never take that path:

- They are **off `useJudgedScriptRunner` by standing ruling** (user, 2026-08-13): migration stays
  LAZY, only when one of them next needs real work. A 19h-i-b adapter is not "real work" by itself.
- No runner → no `DiPortAdapter` → no `--di` → **no cap drill, ever, on current architecture.**
- They are explicitly **out of 19h-i-b's scope** (its census: 11 ports, these four excluded — they
  match a `useJudgedScriptRunner` grep only in COMMENTS).

So the work is real and it is independent of the sweep's *verification* path.

### ⚠️ It is NOT independent of the sweep's FILES

**Same file, different entries.** Eight of the sweep's nine remaining ports are literacy
(`picture-vocabulary`, `phoneme-explorer`, `letter-spotter`, `letter-sound-link`,
`decodable-reader`, `rhyme-studio`, `read-aloud-studio`, `di-spoken-practice`), so both tracks edit
`service/manifest/catalog/literacy.ts`. Entries do not overlap, but a long-running branch will
conflict. **Rebase often, or take this immediately after a sweep slice lands.** 18d deferred once
already for exactly this reason ("a sweep mid-collision would clobber a concurrent session").

---

## 2. What I found — and it is why this is not a simple "apply the fix"

**The four rungs are ALREADY in the shape 18d is converting the others TO.** Not one of them quotes
a speakable line. All four:

```
// Correction territory, not answer territory: every level here describes
// what happens AFTER an attempt, and re-modeling at every tier is the DI
// rule (standing gate 3 — remediation is not scaffolding).
scaffoldingLevels: {
  level1: 'Ask which sound the first letter makes, then wait.',
  level2: 'Say the sounds of the word in order once, slowly, then hand it back to them.',
  level3: 'Say the sounds and then run them together into the word, then ask them for the word once more.',
},
```
*(phonics-blender, `literacy.ts:187`. sound-swap `:1171`, cvc-speller `:1957`, word-flip `:2537`
carry the identical comment and the same unquoted shape — written that way at their original ports,
2026-08-10.)*

Compare the defective shape 18d was filed against — `counting-board`'s
`"Touch each one just one time as you count."`, `number-bond`'s
`"If the whole is {{whole}}, what two groups could you split it into?"` — a **quoted sentence the
model reads verbatim**.

**Consequence: a symptom grep for a quoted rung finds nothing here.** These four are not part of
the ~12 remaining entries in the form the sweep is fixing them, and anyone who scopes this as
"same edit, four more times" will produce a no-op diff.

### The mechanism does still reach them

- All four call **`useJudgedSpeechLoop`** with no `sentinels` override → default `DI_SENTINELS`
  (`affirm: [['yes']]`, `correct: [['my','turn']]`), and that hook **classifies a verdict from the
  sentinel OPENER**. So an unsentinel'd tutor turn is `di-no-verdict` here exactly as on a runner port.
- An unquoted rung still **authorizes a spoken turn**: *"Say the sounds of the word in order once,
  slowly, then hand it back to them"* is a reply that opens with neither sentinel.

### ⭐ The half that transfers cleanly, and it is a real gap

**None of the four states the two-branch law.** Verified by inspection: phonics-blender has zero
such clauses; the apparent matches in sound-swap (`:179`) and cvc-speller (`:189`) are "nothing
else" about the **ask** shape, not about the reply to an attempt. They predate the law —
`wordWorkoutScript` authored `TWO_BRANCH_LAW` on 2026-08-14, four days after these packs shipped.

This is the defect these four **demonstrably** have, and it is checkable without a drive.

### Two things I checked so you don't have to

1. **No sentinel mismatch.** All four `.tsx` files contain zero `"My turn"` — but that is not a bug:
   their scripted lines live in the **catalog `aiDirectives`**, e.g. phonics-blender's *"must begin
   with 'Yes' and corrections must begin with 'My turn', using the exact quoted lines."* There **is**
   a correction branch to route pedagogy through.
2. **They cannot use `checkPackGates` / `checkDiCatalogEntry`** — those need `answerKind` /
   `responseClass` per item, which these packs genuinely do not carry (19a, 2026-08-13). Fabricating
   them in a test would assert a contract production does not keep. Their suites already run
   `findPerformedStageDirections` over a labelled cue list instead; that is the gate you have.

---

## 3. The open question, stated honestly

> **Does a rung that DESCRIBES a re-model without quoting it stall the loop the way a quoted one does?**

Unknown. Every live reproduction (`number-bond`, `counting-board`, `addition-subtraction-scene`)
was the model reciting a **quoted** line verbatim — the quoting is plausibly what made it treat the
rung as speakable text. And this question is **unprovable on these four**: no cap drill, and the
only channel that could answer it is a live mic drive.

Do not resolve it by assertion in either direction.

---

## 4. The work

### Step 1 — ADD THE TWO-BRANCH LAW (do this; it is the verified gap)

For each of the four catalog entries, state the law **before** the branches in the tutoring
directives, matching what `counting-board` and `addition-subtraction-scene` shipped.

**Consume `wordWorkoutScript`'s `TWO_BRANCH_LAW` — do not re-derive it.** Verbatim:

> Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the
> first time, not any time: no praise, no encouragement, no hint, no observation about how they
> tried, however kind it would be.

These are catalog entries rather than script modules, so it lands as prose in the `aiDirectives`
block (the `counting-board` / ASS pattern), not as an imported constant. Keep the wording identical
so a later grep finds all of them.

**Standing gate 2 applies to every line you write:** no sentence may begin with "Yes" or with
"My turn", or the engine reads your own directive as a verdict.

### Step 2 — DO NOT REWRITE THE RUNGS. File the question instead.

Recommended, and the reasoning is the point:

- The rungs are already in correction territory and already carry the standing-gate-3 comment
  explaining why.
- The quoted-line mechanism has **never** been reproduced on an unquoted rung.
- Rewriting four working packs on an unverifiable hypothesis is precisely the "fixed on tsc alone"
  antipattern (July retrospective, antipattern #1) — there is no gate here that could catch a
  regression you introduce.

**Instead:** add one criterion to the next mic row that touches any of these four — *"on the second
and third wrong answer, does she speak the scripted correction again, or does she improvise a
re-model?"* That is a free rider on a drive somebody is doing anyway, and it is the only thing that
can actually answer §3.

If a future drive **does** reproduce it, the fix is already written above: route the rung's pedagogy
through the correction branch, which already opens "My turn:".

---

## 5. What you cannot do here

- **No `--di`, no `--di-cap`.** No adapter, and building one means putting these packs on the
  runner, which the 2026-08-13 ruling defers until one of them needs real work.
- **No `checkPackGates` / `checkDiCatalogEntry`** (§2).
- So the ceiling on this slice is **inspection + static gates**. Say so in the commit body; do not
  write "verified".

---

## 6. Gates

| Gate | Bar |
|---|---|
| `cd my-tutoring-app && npm run typecheck:lumina` | 0 |
| `npm test` | no regression vs. the 3316-ish baseline at branch tip |
| Catalog sentinel scan | no directive sentence opens with "Yes" / "My turn" |
| `findPerformedStageDirections` over each pack's cue list | already in their suites; must stay clean |
| Runtime | **none available — label the commit accordingly** |

---

## 7. Ledger updates owed on close

- `qa/di/BACKLOG.md` **18d** — record the four as done-or-ruled, and **correct the entry's own
  scope line**: it currently says "the ~12 entries whose ports have not had their adapter turn yet,
  **plus the pre-runner four**", which implies the same edit applies. It does not (§2).
- `WORKSTREAMS.md` — 18d's remaining count.
- If step 2 is taken as recommended, the criterion goes on the relevant mic row in
  `qa/HUMAN-CHECKS.md` (#100 / #101 are open and both touch literacy packs).

---

## 8. One-paragraph version

The pre-runner four cannot ride the 19h-i-b sweep because they will never have a cap drill, so 18d's
remainder is theirs alone — but the edit is **not** the one the sweep is making. Their rungs already
avoid quoting a speakable line and say so in a comment. What they actually lack is the **two-branch
law**, which postdates them by four days; add it, consume `wordWorkoutScript`'s wording verbatim, and
leave the rungs alone. Whether an unquoted rung stalls the loop at all is genuinely unknown and
unprovable without a microphone — put it on the next drive rather than guessing, and do not claim
this slice was verified at runtime, because nothing here can be.
