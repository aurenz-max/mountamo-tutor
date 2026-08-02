# di-letter-sounds — L3 support tiers (2026-08-01)

Birth-cert follow-up **#3 struck**. The pack is now L0 → L1 → L2 → L3. Third
DI pack to reach L3 — third use of the DI L3 template (di-sentence-reading
07-25 the original, di-math-facts 08-01 the closest sibling); this slice
follows the math worked example point-for-point, with the pack-specific
composition notes below.

## Archetype and lever discovery

Same verdict as both siblings: live-judged spoken production, the Live tutor IS
the interaction surface, **zero `showOptions`** — the whole ladder is modality
**#2 instruction-as-scaffold**, and DISTAR's **model → guide → test IS the
ladder**. The birth certificate specified this fade at L0 (follow-up #3:
"model repetitions (2→1→0), guide phase present/absent"); this slice built
exactly that, composed in the SCRIPT (`leadInFor` + `coldSoundGuard` in
`diLetterSoundsScript.ts`), never a UI flag:

| Tier | Spoken cue (isolated continuant) | What the child must do |
|---|---|---|
| **easy** | `This sound is mmm, as in moon. Listen: mmm.` + `Together: mmm, as in moon.` + `Your turn. What sound?` | produce after hearing the sound twice (the L0 shape) |
| **medium** | model + ask | produce after hearing it once |
| **hard** | `Your turn. What sound?` | **retrieve the sound COLD, never having heard it** |

## Why `hard` matters — and the two per-mode nuances

The model line SPEAKS the very sound the child is about to produce — the echo
route. At `hard` the item becomes a genuine **grapheme→sound retrieval probe**
and the silent `responseMs` becomes true retrieval time rather than partly an
echo delay. The printed grapheme is the stimulus and is NEVER withdrawn.

The handoff's pack-specific caution — three eval modes with DIFFERENT cue
structures — resolved cleanly because the test lines already carry the
stimulus, never the target sound:

- **`first_sound_in_word` (onset):** the ask still speaks the WORD ("Your
  turn. What is the first sound in moon?") — it is the stimulus; that stage
  shows the picture + word, never the lone grapheme, and the withdrawal does
  not touch the display. What `hard` withholds is the onset itself ("Moon
  starts with mmm."). A genuine onset-isolation probe; the inversion is
  test-pinned.
- **Keyword-elicited vowels:** the ask still speaks the keyword ("Your turn.
  Say apple.") — the elicitation requires it. What `hard` withdraws is the
  model's sound-naming ("The first sound in apple is short a"). The cold
  guard therefore guards the **SOUND**, never the word — its wording is "do
  NOT say, stretch, or model the target sound", not "say nothing".

The withdrawal is identical across all three task identities, and that is
correct rather than lazy: every mode is the same act (meet the stimulus,
produce the held sound). A **mode** changes which items are drawn and how the
cue is phrased; a **tier** changes how much of the sequence is handed over.
`resolveSupportStructure` is kept per-type-capable so a future mode can diverge.
**Gate is on TIER, not mode** (math's proven rule): the generator stamps every
challenge from its OWN `challengeType`, so a `mixed` session tiers all three
identities — confirmed live in probe 2.

## What is NEVER withdrawn (and why)

| Kept at every tier | Reason |
|---|---|
| the on-screen **stimulus** (printed grapheme; keyword + picture for onset) | withdrawing it would change the task identity |
| the **correction's re-model** | standing gate 3: DISTAR always re-models on an error. Remediation is not scaffolding. **This pack still carries the PLAIN correction** — the contrastive port stays frozen on HUMAN-CHECKS #55 (family rule); the plain lines are byte-pinned at every tier for all three cue shapes |
| the **restating affirm** | models the sound at the moment it is most useful |
| the **judging contract** | byte-identical across tiers (test-pinned per mode) — a tier changes how much help precedes the attempt, never how it is judged |

## Bench-proven wording preserved

At `easy` (and absent tier) the composed spoken block is **byte-for-byte** the
`"${model} ${guide} ${test}"` string of the L0/L1 live-verified runs (#36,
#42) — pinned by the "absent tier behaves exactly as easy" test, asserted on
full-cue equality for all three modes. `medium`/`hard` speak only *subsets* of
proven lines plus the proven ask; **no spoken line was reworded** (handoff
constraint honored). The one new spoken-adjacent copy is the per-item
`coldSoundGuard` (instruction to the tutor, inside the cue, never spoken) —
the same shape as math's `coldAnswerGuard`.

## The tutor as a second scaffold channel (the tier gotcha)

Audited the whole catalog block; **like di-math-facts (and unlike the sentence
pack), no rewording was needed** — the audit is recorded in `catalog/di.ts`:

- `scaffoldingLevels.level1` ("Repeat the prompt once, slowly.") repeats the
  PROMPT — the ask the tutor just spoke, which never carries the target sound.
  Tier-safe as-is.
- Levels 2–3 and the sound-modeling `commonStruggles` (incl. the
  stays-silent → "invite one try together" response) all describe post-attempt
  or non-attempt remediation — correction territory, which re-models at every
  tier by design.

Three additions close the channel anyway (math's pattern):
1. **Per-item `coldSoundGuard` in the cue** — authoritative, per item,
   sound-scoped (see the vowel nuance above).
2. **`supportTier` as a catalog contextKey**, threaded through the connect
   payload, the `updateContext` sync, and `startDiRunLog` (a cold production
   that leaks is only readable against the tier the run used).
3. **One clause appended to the LIVE-JUDGED directive**: when the quoted text
   is only the "Your turn" line, the learner is answering cold on purpose —
   never say, stretch, or model the target sound first. Sentinel discipline
   re-checked on the new copy (no sentence opens with "Yes"/"My turn").

## Deliberate departure: no `tierSection` in the prompt

Same ruling as both siblings, same reason: under Fork A the model's only job
is picking letters + the wrapper, so a tier line in the prompt could only
nudge WHICH LETTERS are drawn — tier→content leakage, i.e. structural
difficulty through the back door. Item-set composition (continuants-only →
+short vowels → confusable contrasts m/n, f/v) is this pack's structural axis
and belongs to `/add-structural-difficulty` (L4, designed on the birth cert).
The tier is 100% code-composed into the cue.

## Tester

No tester work — as the handoff predicted, the family tier selector (built in
the math L3 slice, riding the eval-test route's `?difficulty=` tap) drives
this pack unchanged; the probes below exercise exactly that tap.

## Verification

| Gate | Result |
|---|---|
| `typecheck:lumina` | **0 errors** |
| new suite `diLetterSoundsScript.support-tiers.test.ts` | **16/16** |
| new generator tier tests (`gemini-di-letter-sounds.test.ts` +4) | **8/8** (4 pre-existing stayed green) |
| non-vacuity probe | **7 tests fail** when `hard` is reverted to the full lead-in (both siblings proved 5) |
| full `npm test` | **1067/1068** — the 1 failure is `CoinCounter.reader-fit.test.tsx`, the concurrent 14b stream's in-flight file (`CoinCounter.tsx` / `gemini-coin-counter.ts` modified by that session; no DI file imports them). File-disjoint per the handoff's serial constraint; owned by 14b, not this slice. |
| **runtime — real pipeline** (dev server, eval-test route, real Gemini) | 3/3 probes pass |

The three runtime probes (math's acceptance shape):
1. `letter_sound` + `difficulty=hard`, objective "letter sounds m s f" →
   **all 4 challenges `supportTier:'hard'`**, objective letters honored exactly
   (m, s, f + starter backfill `a`) — the tier never touched selection.
2. `mixed` + `difficulty=medium` → the SP-21 three-identity interleave
   (`letter_sound` / `letter_sound_review` / `first_sound_in_word`) and
   **every challenge got the tier** — gate-on-tier-presence confirmed live.
3. No `difficulty` param → **no `supportTier` field at all** — pre-L3 sessions
   are byte-compatible. (Also unit-pinned, plus unknown-value → ignored.)

Operational note: probe 1 ran on the shared :3000 dev server, which then went
404-broken under the concurrent 14e session's in-flight edits; probes 2–3 ran
on an isolated `next dev -p 3005` instance (same tree, real Gemini), then the
server was shut down.

The strongest unit test is *"hard NEVER puts the SOUND in the spoken block"* —
it asserts the sound token is absent from everything the tutor may say while
still present in the judging contract. It is one of the 7 that fail under the
non-vacuity probe.

## Ladder position

L0 → L1 → L2 → **L3 (tiered)**. `/add-structural-difficulty` (L4) is now
unblocked and rides this harness; its axis is already designed on the birth
cert (item-set composition: continuants-only → +short vowels →
visually/aurally confusable contrasts (m/n, f/v) in one set). Letter NAMES
stay BLOCKED; blends/digraphs/stops bench first.

**Live behaviour is UNVERIFIED with a mic.** The `hard` cold production is the
highest-value thing to hear — it is the only tier that changes what the tutor
says at the moment that matters, and the first time any DI letter-sounds item
is a pure grapheme→sound retrieval probe. No open letter-sounds sitting row
existed (#36/#42 are Done), so this takes **HUMAN-CHECKS #57** (new row —
mirrors #50(d)/#54(d); includes the onset + vowel glances). Not blocking.
