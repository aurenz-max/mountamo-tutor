# Add Voice Control to a Primitive

This skill wires an existing primitive so students answer or select **by voice** — the mechanical rollout skill for the spoken-interaction platform. The platform layers are already built and benched; a primitive consumes one controller hook and paints its existing UI from the controller's state:

```
useVoiceCapture (engine)        mic lifecycle, honest cue timing, endpointing,
                                speculative dispatch, pre-roll, global auto-listen
        ↓
useVoiceAnswer | useVoiceChoice (controllers)   judging ladder, actuation policy,
                                targeting, grading, stale-verdict guards
        ↓
THE PRIMITIVE (this skill)      ~15-40 lines: items/target in, state painted
                                onto buttons it already renders
```

**Outcome:** the primitive listens (open mic by default — no buttons between attempts), voice and tap actuate the same controls, the tap path survives unchanged as the fallback, and every doctrine guarantee (first-frame speak cue, asymmetric grading, Ctrl+M kill switch, stale-verdict routing) is inherited — not re-implemented.

Two shapes — pick ONE in Phase 1:
- **Spoken ANSWER** (production): the student says a target word; the judge answers "did they say it?" Hook: `useVoiceAnswer`. Reference diff: **PictureVocabulary** (migrated 2026-07-05 — a 2-edit swap).
- **Spoken CHOICE** (control): discrete options on screen; saying one selects/answers it. Hook: `useVoiceChoice`. Reference: **ChoiceQueueScenario** (`components/voice-studio/scenarios/`) — its `useVoiceChoice({...})` call + board painting is exactly what a primitive writes; everything else in that file is studio bench apparatus.

## Required Reading

- `.claude/skills/add-spoken-judge/SKILL.md` → **Design Themes** + **asymmetric grading law** + **quiet-tutor law**. That skill explains the doctrine and judge architecture; this one only wires. Do not proceed without the tutor discipline in your head.
- The header comments of `hooks/useVoiceAnswer.ts` and `hooks/useVoiceChoice.ts` — the API contracts.

If the interaction was tuned in the **Voice Studio**, its 📋 Copy Spec JSON is the configuration for this task — honor it (modality, levers) instead of the defaults below.

## When to Use This Skill

- **Answer shape:** a moment where the student *knows the word* and production beats recognition — naming, blending, rhyme production, sight words. Same selection criteria as `/add-spoken-judge` Phase 1.
- **Choice shape:** the interaction is MCQ-shaped — discrete on-screen options, tap-to-answer today. The options must be short, SAYABLE labels (1–2 words a K-2 student can pronounce). Word banks, picture-word matching, cloze choices, sorting targets.

**DO NOT use for:** free-form speech (sentences, retells — no judge for that yet), options that aren't natural speech ("3/4 + 1/8"), or homophone option sets (see Gotchas).

## Phase 1: Pick Shape + Modality

1. Shape: is the voice act *producing* a word (answer) or *picking* one of several (choice)? If the primitive shows options AND the correct answer is one of them, choice is usually right — it also gives partial-recognition students a fair path.
2. Modality: default `'open'` (the native shape — mic stays hot, zero friction). Use `'ptt'` only for a single culminating word after solve-work where the tutor coaches misses by voice (the tap is the echo gate — see add-spoken-judge's capture table).
3. Locate the existing tap/grade path. It must survive unchanged; voice routes INTO it, never around it.

## Phase 2A: Spoken ANSWER wiring (from the PictureVocabulary diff)

```tsx
import { useVoiceAnswer, type SpokenJudgeResult } from '../../../hooks/useVoiceAnswer';

// True exactly while a spoken answer is wanted for the CURRENT challenge:
const spokenActive =
  hasStarted && !showResult && !spokenMatched && voiceOn && isSpokenMode(ch?.type);

const spoken = useVoiceAnswer({
  targetWord: currentChallenge?.word ?? '',
  gradeLevel,
  active: spokenActive,
  onResult: handleSpokenResult,   // asymmetric law — match credits, miss NEVER scores
  onNoSpeech: () => {},           // open mode: rarely fires; stay silent
});
```

- `active` drives everything: true → mic auto-opens (during the previous item's celebration beat, so the reopen is imperceptible); false → mic closes. Flip it off the moment the challenge resolves.
- The **stale-verdict guard is built in** — the target word is frozen per utterance and mismatched verdicts are dropped. Do NOT add your own cancel-on-advance plumbing; flipping `active` is the whole contract.
- `onResult` follows add-spoken-judge Phase 2 exactly (match → credit + `playCorrect()` + advance; no-match/unclear → nothing scored; open mic → tutor SILENT on misses).

Render — **always pass `dormant`** (the hook computes honest dormancy; the orb becomes a tappable button whenever the mic is truly closed, and that tap doubles as the first-session permission grant):

```tsx
<LuminaMicListener
  state={spoken.state} level={spoken.level} isSupported={spoken.isSupported}
  dormant={spoken.dormant}
  onStart={spoken.startManual} onCancel={spoken.cancel}
  accent={modeAccent} idleLabel="Say it!" listeningLabel="Your turn — say it!"
/>
```

## Phase 2B: Spoken CHOICE wiring (from the ChoiceQueue diff)

```tsx
import { useVoiceChoice } from '../../../hooks/useVoiceChoice';

const choice = useVoiceChoice({
  items,   // [{ answer, options }] straight from your generator content (lowercase!)
  gradeLevel,
  onSubmit: (idx, word, correct) => { /* route into your EXISTING grading path */ },
  onQueueComplete: () => { /* advance / summary */ },
  // levers default to actOn:'high' + voiceAction:'submit'; only override per a studio spec
});
```

Paint your existing UI from controller state (no new buttons):

```tsx
// Per unit i — only when MORE THAN ONE answerable unit is on screen:
<LuminaVoiceTarget label={`Problem ${i + 1}`} active={i === choice.focusIdx && !choice.allSolved}
  done={!!choice.answers[i]?.correct} onFocus={() => choice.focusItem(i)} accent="purple">
  {/* per option w — branches ADDED to your existing option button: */}
  //   voice-highlighted: choice.highlight?.idx === i && choice.highlight.word === w
  //   submitted:         choice.answers[i]?.word === w  (correct → emerald, wrong → rose)
  //   onClick={() => choice.tapOption(i, w)}   ← replaces/wraps your tap handler
</LuminaVoiceTarget>

<LuminaMicListener state={choice.voice.state} level={choice.voice.level}
  isSupported={choice.voice.isSupported} dormant={choice.voice.dormant}
  onStart={choice.voice.start} onCancel={choice.voice.stop} accent="purple" />
{choice.note && <p className="text-amber-300 text-sm">{choice.note}</p>}
```

- The hook owns actuation sounds (correct/incorrect/select/tick) — add none.
- `choice.note` is the "Heard X — tap to confirm / that isn't an option" line — always render it; voice must never silently no-op.
- Single-unit screens: skip `LuminaVoiceTarget`, use `items: [oneItem]` and index 0.

## Phase 3: Tutor Discipline + Metrics

4. Tutor: open mic ⇒ SILENT on every miss/unclear/no-speech; frame once up front; celebrate only first-voice/comeback/finish (quiet-tutor law, add-spoken-judge). The elicitation must never contain the answer word (PROMPT LAW).
5. Metrics: add voice outcomes to `submitEvaluation` extras — answer shape: `spokenWords`; choice shape: per-item `{ viaVoice: boolean }` on your existing result records.

## Phase 4: Verify

6. `cd my-tutoring-app && npx tsc --noEmit` — hold the baseline.
7. **Voice smoke (per shape, ~5 minutes in the domain tester):**
   - correct word → credits + advances; mic auto-reopens for the next item (ready chirp)
   - wrong word / minimal pair → choice: selects the wrong option or highlights; answer: nothing scored
   - gibberish → choice: "that isn't one of the options" note; answer: unclear, no penalty
   - ✕ stop → orb flips to a TAPPABLE button (an idle-but-live-looking orb is always a bug)
   - Ctrl+M / navbar toggle → mic dies immediately; tap paths still work
   - tap fallback → identical behavior to before this skill ran

## Design Rules (Do / Don't)

- **Do** keep the tap path unchanged — voice is additive and routes into the same grading code.
- **Do** pass `dormant` to `LuminaMicListener` from these hooks, always.
- **Do** take `items`/`targetWord` from generator content — never hardcode.
- **Don't** hand-roll capture, endpointing, re-arm timers, actuation policy, or mic UI — if you're writing any of those, stop; the layer you want already exists.
- **Don't** send the correct answer to any judge (the choice judge identifies; the primitive grades).
- **Don't** gate the mic on tutor-busy signals, and don't bypass the global auto-listen switch (the engine enforces it).
- **Don't** recreate `useSpokenTurn`-style windows/dormancy-strikes — that shape was ruled out and deleted 2026-07-05.

## Gotchas

- **"Mic never opens on the first item":** the engine's stop latch clears on `autoStart` off→on and on activation-key change. If auto-open fails, your `active` gate probably never transitioned (e.g. it was true at mount before content loaded). Make `active` start false and flip true when the challenge is genuinely live.
- **Options must be distinguishable when SPOKEN.** Homophones (two/too, sun/son) and near-homophones in one option set will misroute — fix the content (distractor selection), never the judge.
- **Judge quality is per content CLASS**, not per primitive. CVC-ish words are benched. A new class (letter names, numbers, multi-word phrases) gets a Voice Studio scenario bench FIRST, then primitives inherit it.
- **`items` identity resets the queue** — memoize `items` (`useMemo`) or every render wipes answers.
- **Answers lowercase.** Both controllers compare lowercased; generator content with stray capitals silently never matches.

## Reference Implementations

| File | What to copy |
|---|---|
| `primitives/visual-primitives/literacy/PictureVocabulary.tsx` | Answer shape, end to end: `spokenActive` gate, asymmetric handler, quiet tutor, auto-advance, orb wiring |
| `components/voice-studio/scenarios/ChoiceQueueScenario.tsx` | Choice shape: the `useVoiceChoice` call + board painting (ignore the config panels — studio apparatus) |
| `hooks/useVoiceAnswer.ts` / `hooks/useVoiceChoice.ts` | API contracts + doctrine notes in the headers |
| `components/voice-studio/` (Voice Studio dev tool) | Tune levers/models/timing against real voice; 📋 Copy Spec = this task's config input |

## Checklist

- [ ] Shape + modality chosen (studio spec honored if provided); tap path unchanged
- [ ] Controller hook wired; `active`/`items` from real content; no hand-rolled capture/actuation/sounds
- [ ] Orb via `LuminaMicListener` with `dormant` passed; `choice.note` rendered (choice shape)
- [ ] `LuminaVoiceTarget` targeting when >1 answerable unit shares the screen
- [ ] Tutor discipline per architecture (open mic ⇒ silent misses; PROMPT LAW)
- [ ] Voice outcomes in `submitEvaluation` extras
- [ ] `npx tsc --noEmit` holds baseline; Phase 4 voice smoke passed (incl. ✕ stop → tappable orb, Ctrl+M kill)
