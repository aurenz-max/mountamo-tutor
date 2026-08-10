# Spoken Interaction Doctrine

**Status: REFERENCE, not an authoring path.** This is the doctrine home for every
spoken surface in Lumina. It was extracted verbatim from `/add-spoken-judge` when that
skill was **retired on 2026-08-09** (user ruling) — the laws below outlived the skill
that carried them, and they are cited by `/add-voice-control`, `/primitive`, and the
engine hooks themselves.

> **Why the skill was retired.** `/add-spoken-judge` wired **push-to-talk one-shot
> capture** — the student taps the mic, says one word, and the beat ends. Six literacy
> primitives were built that way: `cvc-speller`, `interactive-book`,
> `letter-sound-link`, **`phonics-blender`**, `rhyme-studio`, `sound-swap`. PTT is
> superseded for multi-item runs by the open-mic controllers (`/add-voice-control`)
> and, for the basic literacy set, by the DI judged loop. The skill that keeps
> producing the weaker shape was removed rather than left as a tempting path.
> **Voice on the ANSWER is not the same property as voice owning the LOOP.**
>
> **⚠️ Measured 2026-08-09 — and the result is NOT what the PTT/open-mic split
> predicts.** Across the 11 voice-carrying literacy primitives, **7 advance on a
> stopwatch** (`setTimeout(next, 1400)` or `AUTO_ADVANCE_MS`: `cvc-speller`,
> `letter-sound-link`, `rhyme-studio`, `sound-swap`, `picture-vocabulary`, `word-flip`,
> `phoneme-explorer`) and **4 advance on a click** (`interactive-book`,
> `phonics-blender`, `word-workout`, `story-talk`). **Both hook families produce both
> behaviours** — PTT primitives auto-advance, open-mic primitives tap. So the axis that
> matters is not push-to-talk vs open mic at all: **it is timer vs tutor, and NONE of
> the eleven is tutor-driven.** That is why the retirement is about authoring paths and
> the real work is the loop port below.
>
> **What to use instead:**
> - **Open-mic answer / choice on an existing primitive** → `/add-voice-control`
>   (consumes `useVoiceAnswer` / `useVoiceChoice`; auto-advances).
> - **The full DI live-judged loop** → the DI engine (`useJudgedSpeechLoop`,
>   `useLiveVoiceTurns`). The loop-port rung does not exist as a skill yet; it is
>   being extracted from the `phonics-blender` pilot — `qa/di/BACKLOG.md` item 16.
> - **Push-to-talk** (a single culminating word after solve-work) → still legitimate,
>   still `useSpokenWordCapture`, and this document is its only wiring reference
>   (below). It is a deliberate narrow choice now, not a default.

**Nothing in the running app changed when the skill was retired.** All eleven
voice-carrying primitives and every hook (`useSpokenWordCapture` included) are
untouched and supported. This was a change to how new work is authored.

---

## Architecture (why it's shaped this way)

Two channels, never crossed:

```
WARMTH CHANNEL  Gemini Live tutor session (useLuminaAI.sendText)
                Speaks, coaches, celebrates. NEVER judges. Can flake harmlessly.

TRUTH CHANNEL   useSpokenWordCapture → stateless clip judging over /api/lumina
                mic → RMS endpointing (250ms speculative snapshot, 750ms stop)
                → ladder:
                  1. Azure dual-signal (~400ms): plain STT transcript
                     (minimal-pair discriminator) + Pronunciation Assessment
                     (per-phoneme scores). High confidence → final.
                  2. gemini-flash-latest clip judge (~1.9s): second opinion
                     only when Azure is unsure/unreachable.
                  3. outcome 'unclear' → primitive's deterministic fallback.
```

This split exists because Gemini Live tool-calling stalls/blocks (bench 2026-07, see
memory `no-live-audio-judging`). The judge is request/response: it cannot stall the
interaction, and every rung degrades into the next.

**Env (server-side, `my-tutoring-app/.env.local`):** `AZURE_SPEECH_KEY`,
`AZURE_SPEECH_REGION` (same subscription as backend TTS), `GEMINI_API_KEY`.

> **Note on the DI family.** DI runs a *different* truth channel: the Live tutor judges
> the AUDIO in-band per the cue's judging contract, and a sentinel scan reads which
> branch it took. That is not a contradiction of the split above — DI's judge is the
> tutor by design, benched per response class before any primitive wires it. See
> `qa/di/BACKLOG.md` § Architecture.

## Design Themes (doctrine settled 2026-07-05 — every spoken surface obeys these)

1. **Honest speak cue.** Never show "Listening…" or cue "speak now" before audio frames actually flow — getUserMedia + AudioContext warm-up costs 200–800ms, and a premature cue clips the student's onset (THE "app feels buggy" root cause; it is not tutor bleed). The kit encodes it: `LuminaMicListener` has an `'opening'` state (dim, unbreathing orb), the ready earcon fires on the FIRST audio frame, and the engine keeps a ~250ms pre-roll so late-detected onsets still land in the clip. Never defensively gate the mic to protect against tutor pickup — honest cues are the fix, not blocked capture.
2. **Open mic is the native always-listening shape; the turn loop is DEPRECATED.** `useSpokenTurn`'s windowed re-arm (arm timeouts, silence strikes, "tap the orb when ready") was spend plumbing that leaked into UX — and it isn't even cheaper: judges fire only on actual utterances, so silence on a hot mic costs zero API calls, while every window pays a cold mic re-open. New always-listening work uses `useVoiceCapture` with `modality: 'open'` (persistent mic, continuous utterance segmentation, judging overlaps listening; bounds = explicit stop + 60s walked-away idle close) — in practice via the controllers `useVoiceAnswer` / `useVoiceChoice` (see `/add-voice-control`, the mechanical wiring skill). `useSpokenTurn` was DELETED 2026-07-05 after PictureVocabulary migrated.
3. **Voice targeting.** When more than one answerable unit shares the screen with a live mic, exactly ONE must visibly hold the voice focus — wrap units in `LuminaVoiceTarget` (accent frame + "🎙 Problem N" chip + pulsing hint; tap-to-target; ✓ when done). The engine freezes the target context into each utterance at capture time, so a verdict landing after a focus switch still actuates what the student was aiming at.
4. **Control levers for voice-control beats** (spoken choice / selection via `judgeChoiceAudio`): *act-on* (`high` confidence only vs `any` match) and *voice action* (`submit` vs `highlight — tap confirms`), with the degrade rule: low confidence under act-on:high degrades submit → highlight. Voice never silently no-ops when something was heard — surface what WAS heard. The judge identifies WHICH option; the primitive grades (the correct answer is never sent).
5. **Session-level auto-listen switch.** Hands-free listening is globally gated by `utils/voiceMode.ts` — mount `LuminaVoiceToggle` in the lesson/Pulse navbar; Ctrl+M toggles it. OFF suppresses auto-starts and stops live ambient sessions in one place; explicit gestures (push-to-talk taps, a manual "Open mic" press) still work. `useVoiceCapture` enforces this automatically — never wire a primitive that bypasses it.

## The asymmetric grading law (non-negotiable)

- `match` → award credit, `SoundManager.playCorrect()`, celebrate
- `no-match` → **nothing is scored against the student**, the fallback stays available. Whether the tutor *coaches by voice* here is architecture-dependent (see **Capture architecture**): push-to-talk may coach into the closed mic; always-listening stays silent and leans on the visible fallback.
- `unclear` → invite a retry or the fallback, silently — no error state, no red X

A kid who said the word right but got misheard must never be punished by the judge.

## The quiet-tutor law

*(Spoken modality is where "less is more" bites hardest.)*

The warmth channel should be RARE, not per-beat. A tutor that says *"say it! … good job! … say it! … good job!"* on every single word makes a student want to turn the tutor off (user ruling, PictureVocabulary 2026-07-04). The mic prompt, the level meter, and the `playCorrect()` snap already tell the student what to do and that they succeeded — the tutor voicing it too is redundant weight, and its voice competes with the very silence the student needs to speak into.

- **Frame once, up front** ("say each word as it comes up"), then step back. Don't re-elicit ("what is this? say it!") every beat when the screen already prompts it.
- **Routine `match` → no voice.** Let `playCorrect()` + the visual + auto-advance carry it. Reserve `sendText` celebration for a moment that earns it: the student's **first spoken word** of the session, or a **comeback right after a miss**.
- **`no-match` / `unclear` → depends on the capture architecture (below).** *Push-to-talk:* one short warm sentence, at most a tiny clue — this is the tutor's real job; keep it terse, never scold. *Always-listening:* **say nothing** — the mic is open, so any "try again!" lands on top of the child who is already trying; lean on the always-visible fallback choices instead.
- **Speak only to deliver audio the screen can't** (a word to be tapped, a sentence to be completed for a pre-reader). If the beat is self-evident on screen, the tutor stays silent.

Net: a smooth multi-word session should be ~3 tutor utterances (open, first-voice, finish), not one per word. Encode the same restraint in the catalog `aiDirectives` ("routine successes will NOT ping you — that silence is by design; do not fill it") so the tutor stays terse even when invoked.

## Capture architecture — pick one, and mind the tutor rule it carries

Two live shapes (plus one deleted). Interchangeable at the judge/grading layer, but they impose **opposite** tutor rules because one closes the mic between tries and the other never does.

| | Push-to-talk (`useSpokenWordCapture`, or `useVoiceCapture` `'ptt'`) | Open mic (`useVoiceCapture` `'open'` via `useVoiceAnswer`/`useVoiceChoice`) | ~~Turn loop~~ DELETED |
|---|---|---|---|
| Mic | Closed until the student taps 🎙️ | Opens once, stays hot; utterances segmented continuously | Windowed re-arm with dormancy taps |
| Best for | A single culminating word ("now say it") | A run of items / voice-controlled surface | Nothing new — legacy comparison only |
| Echo gate | The tap — the student presses when the tutor is quiet | **None** — the mic never closes | — |
| **Tutor on `no-match` / `unclear` / no-speech** | **May** coach by voice — the closed mic means nothing is talked over | **Must stay SILENT** — a voice plays straight over the student's next attempt | (same as open) |
| Miss support net | The tutor's warm re-invite | The **always-visible fallback choices** | — |

**Push-to-talk for a single culminating word; open mic for a run of items or a voice-controlled surface.** The tap is an echo gate that keeps the tutor's voice out of the clip; the open mic trades that gate for zero friction and leans on the safety rails (asymmetric grading, PROMPT LAW, echoCancellation). The old `useSpokenTurn` window shape is gone (deleted 2026-07-05; user ruling in memory `open-mic-over-turn-windows`) — do not recreate re-arm windows or dormancy taps by hand. Going always-listening inherits this discipline (user rulings, PictureVocabulary 2026-07-04 — memory `spoken-mic-decoupled-from-tutor`):

- **Mic decoupled from tutor state.** Never gate capture on "tutor is busy" — a missed student answer is worse than a little tutor bleed (which only ever lands as `no-match`/`unclear`, never a false positive).
- **Tutor silent on every non-match.** No coach on `no-match`, `unclear`, or no-speech. The visible fallback choices are the support net; reveal them from the start of each item.
- **Celebration still applies** (first-voice, comeback, finish) — those fire *after* the student has stopped speaking, so they don't collide.

## The third column: who owns the clock

**⚠️ The most important distinction on this page is the one the table above cannot
express.** Both shapes leave the **primitive** advancing itself; the tutor only
comments. The DI modality moves the clock to the tutor, and that is a different
product, not a nicer version of the same one.

| | Voice control (`useVoiceAnswer` / `useVoiceChoice`) | **DI judged loop** (`useJudgedSpeechLoop` + `useLiveVoiceTurns`) |
|---|---|---|
| Who advances | **The component, on a stopwatch** — `setTimeout(advance, AUTO_ADVANCE_MS)` fires once a verdict lands | **The tutor's own utterance.** The loop scans the tutor's speech for sentinel openers (`affirm: [['yes']]`, `correct: [['my','turn']]`) — the affirmation *is* the advance event |
| Timer | Fixed `AUTO_ADVANCE_MS` | **None.** Pacing is conversational |
| Tutor's role | Commentator, after the fact; may be silent entirely | The lesson itself — hand-authored cue script, DISTAR discipline |
| A miss | An error/retry state the component renders | A **contrastive correction branch**: *"My turn: not four — this shape has three sides"* |
| Feels like | Talking to a machine that is on a stopwatch | Talking to a teacher who is waiting for you |

Concrete reference pair: `WordFlip.tsx` (`autoAdvancedForRef` + `AUTO_ADVANCE_MS`) versus
`hooks/judgedLoopModel.ts` (`SentinelScan = 'affirmed' | 'corrected' | 'pending' | 'none'`).

**Consequence — a fixed timer rushes the slow child and holds back the fast one, and no
tuning of `AUTO_ADVANCE_MS` fixes both.** That is why the DI shape is the target for the
basic literacy set rather than a stylistic preference.

**The checkable criterion for any DI loop port: there is no advance timer in the ported
path.** If a `setTimeout`-to-advance survives the port, the loop was not ported — voice
was merely added to the answer. See `qa/di/BACKLOG.md` item 16.

Before picking push-to-talk or open mic for a **basic literacy** primitive, check whether
the answer is actually "port the DI loop" or "route this demand to an existing DI pack".

---

## Push-to-talk wiring reference

Kept because this is the only documented PTT wiring and PTT remains a legitimate
narrow choice (a single culminating word after solve-work). **It is not a default.**

```tsx
import { useSpokenWordCapture, type SpokenJudgeResult } from '../../../hooks/useSpokenWordCapture';
```

Track judge-confirmed words for metrics:

```tsx
const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
```

Result handler — follow the asymmetric law exactly:

```tsx
const handleSpokenResult = useCallback((result: SpokenJudgeResult) => {
  if (!currentItem || alreadyDone) return;
  if (result.outcome === 'match') {
    SoundManager.playCorrect();
    // Quiet-tutor law: SFX + auto-advance carry a routine success. Only speak
    // when earned — first spoken word this session, or a comeback after a miss.
    const firstVoice = spokenWords.size === 0;
    const recovered = missesThisItem > 0;
    if (firstVoice || recovered) {
      sendText(`[SPOKEN_MATCH] Student said "${target}" out loud${firstVoice ? ' — their FIRST spoken answer' : ' after trying again'}! ONE short joyful sentence, then STOP.`, { silent: true });
    }
    setSpokenWords(prev => new Set(Array.from(prev).concat(currentItem.id)));
    handleExistingSuccessPath(/* spokenAloud */ true);
  } else if (result.outcome === 'no-match' && result.verdict?.heard) {
    sendText(`[SPOKEN_MISS] Student tried to say "${target}" but said "${result.verdict.heard}". Gently model it and invite one more try. Never scold.`, { silent: true });
  } else {
    sendText(`[SPOKEN_UNCLEAR] Mic didn't catch it. One friendly sentence: try again louder, or use the button.`, { silent: true });
  }
}, [/* deps */]);

const spokenCapture = useSpokenWordCapture({
  targetWord: currentItem?.word ?? '',
  gradeLevel,
  onResult: handleSpokenResult,
  onNoSpeech: () => { /* same as unclear */ },
});
```

Cancel on item advance: call `spokenCapture.cancel()` at the top of your next-item
handler. A live mic must never carry across items.

## Design rules (Do / Don't)

- **Do** keep the deterministic path reachable — the beat is additive, never a gate. "Additive" ≠ "visually co-equal": it's fine (better, even) to make the mic the primary CTA and demote the fallback to a quiet skip, as long as the skip is always there.
- **Do** pick the capture shape by the moment: push-to-talk for one culminating word (the tap is the echo gate); open mic (`useVoiceCapture` `'open'`) for multi-item runs and voice-controlled surfaces, with its full discipline: mic decoupled from tutor state **and** tutor silent on every non-match. Auto-listen must respect the global switch (`utils/voiceMode`) — the engine enforces it; don't bypass. Never build new work on `useSpokenTurn`.
- **Don't** let a `no-match` write anything into attempts/accuracy metrics.
- **Don't** call the judge with anything but the hook — the endpointing, sounds, and ladder policy live there for a reason.
- **Don't** substitute `gemini-flash-lite` anywhere in the ladder — it false-positives minimal pairs with high confidence (benched).
- **Don't** send the tutor a `sendText` right before starting capture — the tutor's voice can bleed into the clip. Let the student press the mic when the tutor is quiet (push-to-talk is the echo gate).
- **Don't** voice-celebrate every `match` — that's the "good job × 5" chatter students turn off. Speak on success only when it's earned (first spoken word, or a comeback after a miss); let `playCorrect()` + auto-advance carry the rest.

## Gotchas

- **Azure PA is reference-biased**: a "mop" clip scores 86/100 against reference "map". That's why the Azure rung makes two parallel calls (plain transcript + PA) and why you must not "simplify" it to PA-only.
- **Thresholds are adult-TTS-tuned**: `MATCH_THRESHOLD = 55` in `azure-blend-judge.ts` awaits a real kid-voice bench. Tune from Lab trials, not intuition.
- **First judge call after a dev-server restart is slow** (route compile) — not production behavior.
- **The `reasoning` field and thinking levels are accuracy features on small models**, not latency fat — don't strip them when tinkering with the Gemini rung.

## Reference implementations

| File | What to look at |
|---|---|
| `primitives/visual-primitives/literacy/PictureVocabulary.tsx` | **Always-listening** archetype on `useVoiceAnswer` (open-mic engine): tutor SILENT on every non-match, always-visible fallback choices, auto-advance |
| `primitives/visual-primitives/direct-instruction/DiLetterSounds.tsx` | **DI judged loop** — the tutor holds the floor and drives the lesson. The shape the literacy set is being ported toward |
| `primitives/visual-primitives/literacy/PhonicsBlender.tsx` | **Historical PTT archetype.** Mic replaces the "Blend!" click — but the loop still ends on a `Next Word` button (`:1068`). Read it to understand what the port must remove, not as a template |
| `primitives/visual-primitives/literacy/CvcSpeller.tsx` | Culminate-after-solve PTT: beat gated on `wordComplete`, primary-CTA/quiet-skip layout, auto-advance on match |
| `ui/LuminaMicListener.tsx` | The shared capture surface — state-driven orb (incl. honest `'opening'` state), voice-reactive spike ring + mini sound bar. Don't hand-roll a mic UI |
| `ui/LuminaVoiceTarget.tsx` | The "current target" frame — required when several answerable units share a screen with a live mic |
| `ui/LuminaVoiceToggle.tsx` + `utils/voiceMode.ts` | Session-level auto-listen switch (navbar chip, Ctrl+M) — the engine honors it automatically |
| `hooks/useVoiceCapture.ts` | The generic engine — all modalities, first-frame cue, pre-roll, frozen capture context, auto-start |
| `hooks/useVoiceAnswer.ts` / `hooks/useVoiceChoice.ts` | The controllers over the engine — spoken production / spoken choice. Wire via `/add-voice-control` |
| `hooks/useJudgedSpeechLoop.ts` / `hooks/useLiveVoiceTurns.ts` | The DI live-judged loop engine — generic, driven by all five DI packs |
| `hooks/useSpokenWordCapture.ts` | The push-to-talk capability — capture, endpointing, ladder, outcome mapping |
| `utils/spokenWordJudge.ts` | Ladder policy + outcome semantics |
| `service/literacy/azure-blend-judge.ts` | Azure dual-signal ('say') + plain-recognition choice lane; tunable thresholds |
| `service/literacy/gemini-blend-judge.ts` / `gemini-choice-judge.ts` | LLM rungs: production yes/no + closed-set option discrimination |
| `components/voice-studio/` | The Voice Studio — design bench, scenario plug-ins, spec export. Not a wiring template; the spec it exports IS the wiring input |
