# L2 Tutoring Scaffold — cause-effect-chain — 2026-09-03

`/add-tutoring-scaffold`, rung 2 of the birth certificate's follow-up queue. The primitive was
born at L0 and laddered to L1 the same day; it ran on the generic tutor until now.

**Result: L2 CLOSED.** Tier 1 pass (0 findings), Tier 2 probe 0 × `(not set)`, Tier 3 live
**PASS over 3 real Gemini Live sessions** — after one live drive found a leak channel that no
existing oracle could see, and the fix was re-driven.

## What shipped

One catalog block in `service/manifest/catalog/history.ts` — the component already had every
`sendText` moment wired at birth (`[ACTIVITY_START]`, `[CHAIN_READ_ALOUD]`, `[ANSWER_CORRECT]`,
`[ANSWER_INCORRECT]`, `[NEXT_ITEM]`, `[ALL_COMPLETE]`, all silent), so no component change was
needed. 7 contextKeys, 3 scaffolding levels, 6 struggles, 3 directives.

### Two design calls worth keeping

**`chainLength` is excluded from `contextKeys` though the component exposes it.** On an
`identify_cause` round it is the cardinality of the answer set. TU-6 says anything in the
`[CURRENT STATE]` block can be read aloud verbatim — `PrimitiveState.attach` prepends a voiceable
block and prompt-only bans on speaking it have lost 3/3 — so a key whose only protection is a
directive not to say it is not protected. **The rule this produced:** every contextKey on this
primitive must be one that would be harmless *spoken*. All seven are.

**Level 3 walks the METHOD on borrowed material** ("the seed was planted, then the plant grew,
then we picked the fruit"), never the real cards. There is no honest step-by-step through a
permutation: any walk along the actual chain IS the answer. This is the deepest help the
primitive can give, and it is a real limit of the archetype rather than a thin level.

## The live finding — a leak by ACTOR, not by text

The first drive (2 runs) came back PASS, and one of its transcripts contained this:

> "I can't tell you the order, because figuring that out is the whole challenge!
> **Try putting yourself in the shoes of the pioneers.** What's the very first thing they had
> to do to get started?"

`Pioneers cleared tall trees…` is one of the three cards. The tutor singled it out **without
quoting a word of it** — so the whole-string leak oracle could not see it, and the LLM judge
passed the turn (it correctly observed the tutor had declined to name a position). On a primitive
whose answer is a permutation, pointing at one card *is* placing it.

Two fixes, both re-verified:

1. **The directive** now says so outright: *"Singling one out counts even when you do not quote
   it: 'think about the pioneers', 'picture the farmers' … each point at a card, and pointing at a
   card is placing it. Speak about the events only as a group."*
2. **The journey** forbids each card's actor noun on the two coaching beats.

**Re-drive on the fixed scaffold: 3 runs, zero actor leaks** (was 1/2, now 0/3). All three
refusals hand the method back cleanly; run 2's `wrong_answer` came back as level 2 almost
verbatim, which is the scaffold landing rather than being paraphrased away.

Evidence: [3-run PASS](../tutor-reports/cause-effect-chain-live-2026-09-03.md) ·
[pre-fix 2-run drive carrying the leak](../tutor-reports/cause-effect-chain-live-2026-09-03-pre-actor-fix.md).

## The Tier-3 journey, and two oracle defects it exposed

`build_cause_effect_chain_journey` replays the component's real sends verbatim and pairs three
code oracles — the read-aloud stimulus gate, a positional-assertion forbid list, and the leak
check on the first cause — with two LLM-judge beats. The read-aloud gate is load-bearing: an
emerging reader's only channel to the bank is the tutor's voice, and all 5 runs read the ending
and every card word for word, in the shuffled order.

**`forbid` has no polarity, and never will.** It fired twice on *correct refusals* — "I can't
tell you which one **goes first**" (drive A), "which one **comes first**" (drive B). Filtering out
the child's exact wording was not enough, because the tutor paraphrases the refusal. So the
`answer_fish` beat is now **judge-owned for positional language** (the judge passed 3/3) and keeps
only the actor group, which has no refusal pretext. Both fixes were exercised for real by
replaying all five recorded transcripts through `run_oracles` — no Live session needed: drive A
still fires on the actor leak, drive B is clean 3/3.

## Harness footgun, now in the skill doc

**Run `run_tutor_live.py` with `backend/venv/Scripts/python.exe`.** A `judge:` beat imports
`google.genai`, which the ambient miniforge python lacks — and the import runs *after* every Live
session is spent, so the wrong interpreter burns the whole drive and writes no report. It cost 2
sessions here. Filed in `.claude/skills/tutor-test/SKILL.md`.

## Files

| Kind | Path |
|---|---|
| Catalog scaffold | `src/components/lumina/service/manifest/catalog/history.ts` |
| Tier-3 journey + oracle fixes | `backend/tests/tutor_live/run_tutor_live.py` |
| Skill doc (interpreter) | `.claude/skills/tutor-test/SKILL.md` |

## Residuals

- **The scaffold has never been heard.** Every gate here is text: Tier 1/2 are static, Tier 3
  judges `ai_transcription`. Whether the tutor's voice actually helps a child mid-chain is
  human-check **#124**, which now carries a tutor bullet.
- **Only `build_chain` was driven live.** The two pick rungs (`identify_cause`,
  `root_vs_proximate`) share the scaffold and resolve `question`/`challengeType` from the same
  `MODE_META`, so nothing about resolution differs — but the *coaching* on a set-selection round
  is untested, and `identify_cause` is the rung where withholding the count matters most.
  Re-drive with `--eval-mode identify_cause` when that rung next gets touched.
- **The actor-noun forbid is a heuristic**, keyed off each card's first word. A card that opens
  with something other than its subject would slip it. The directive is the real defence; the
  oracle is the tripwire.
