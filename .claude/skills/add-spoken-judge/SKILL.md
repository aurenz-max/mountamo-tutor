# Add Spoken Judge to a Literacy Primitive

This skill adds a **spoken production beat** to an existing literacy primitive: the student says a target word aloud, a judge ladder confirms it in ~0.65s (fast path), and the primitive awards credit — with the existing tap/click interaction as the always-available fallback. It turns recognition tasks ("click the word") into production tasks ("say the word"), the highest-value modality on the production roadmap.

**Outcome:** a push-to-talk "🎙️ Say it!" beat wired into one primitive, judged by the Azure → Gemini ladder, graded asymmetrically (spoken success adds credit; spoken failure never subtracts), with the tutor coaching misses by voice.

## Required Reading

- `my-tutoring-app/src/components/lumina/hooks/useSpokenWordCapture.ts` — the shipped push-to-talk hook (capture, endpointing, ladder, outcomes).
- `my-tutoring-app/src/components/lumina/hooks/useVoiceCapture.ts` — the NEW generic engine (all modalities, honest cue timing, frozen capture context). New always-listening work targets this.
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/literacy/PhonicsBlender.tsx` — reference implementation (Blend phase).

**Design in the Voice Studio first** (IdleScreen → Developer Tools → 🎙️ Blend Judge Lab, now the Voice Studio): pick a scenario, tune modality + control levers + judge against real voice, then hit **📋 Copy Spec** — the exported JSON (capture/judge/control blocks) is the configuration this skill wires, so attach it to the task instead of re-describing settings. New interaction shapes get benched by adding a scenario plug-in (`components/voice-studio/scenarios/` — one component + one registry entry; `SayWordScenario.tsx` is the minimal reference).

## When to Use This Skill

Use when a literacy primitive has a moment where the student *knows the word* and clicking merely reports it — blending, sight words, rhyme production, letter-sound naming. The spoken beat replaces button-theater with real production.

**DO NOT use this skill for:**
- Free-form speech (sentences, retells) — the judge is single-word/short-phrase only
- Math or non-verbal primitives
- An open mic paired with a *coaching* tutor — if you go always-listening (open mic), the tutor MUST fall silent on every non-match (see **Capture architecture**). Never pair a continuously-open mic with a voice that talks over the student.

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

This split exists because Gemini Live tool-calling stalls/blocks (bench 2026-07, see memory `no-live-audio-judging`). The judge is request/response: it cannot stall the interaction, and every rung degrades into the next.

**Env (server-side, `my-tutoring-app/.env.local`):** `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` (same subscription as backend TTS), `GEMINI_API_KEY`.

## Design Themes (doctrine settled 2026-07-05 — every spoken surface obeys these)

1. **Honest speak cue.** Never show "Listening…" or cue "speak now" before audio frames actually flow — getUserMedia + AudioContext warm-up costs 200–800ms, and a premature cue clips the student's onset (THE "app feels buggy" root cause; it is not tutor bleed). The kit encodes it: `LuminaMicListener` has an `'opening'` state (dim, unbreathing orb), the ready earcon fires on the FIRST audio frame, and the engine keeps a ~250ms pre-roll so late-detected onsets still land in the clip. Never defensively gate the mic to protect against tutor pickup — honest cues are the fix, not blocked capture.
2. **Open mic is the native always-listening shape; the turn loop is DEPRECATED.** `useSpokenTurn`'s windowed re-arm (arm timeouts, silence strikes, "tap the orb when ready") was spend plumbing that leaked into UX — and it isn't even cheaper: judges fire only on actual utterances, so silence on a hot mic costs zero API calls, while every window pays a cold mic re-open. New always-listening work uses `useVoiceCapture` with `modality: 'open'` (persistent mic, continuous utterance segmentation, judging overlaps listening; bounds = explicit stop + 60s walked-away idle close) — in practice via the controllers `useVoiceAnswer` / `useVoiceChoice` (see `/add-voice-control`, the mechanical wiring skill). `useSpokenTurn` was DELETED 2026-07-05 after PictureVocabulary migrated.
3. **Voice targeting.** When more than one answerable unit shares the screen with a live mic, exactly ONE must visibly hold the voice focus — wrap units in `LuminaVoiceTarget` (accent frame + "🎙 Problem N" chip + pulsing hint; tap-to-target; ✓ when done). The engine freezes the target context into each utterance at capture time, so a verdict landing after a focus switch still actuates what the student was aiming at.
4. **Control levers for voice-control beats** (spoken choice / selection via `judgeChoiceAudio`): *act-on* (`high` confidence only vs `any` match) and *voice action* (`submit` vs `highlight — tap confirms`), with the degrade rule: low confidence under act-on:high degrades submit → highlight. Voice never silently no-ops when something was heard — surface what WAS heard. The judge identifies WHICH option; the primitive grades (the correct answer is never sent).
5. **Session-level auto-listen switch.** Hands-free listening is globally gated by `utils/voiceMode.ts` — mount `LuminaVoiceToggle` in the lesson/Pulse navbar; Ctrl+M toggles it. OFF suppresses auto-starts and stops live ambient sessions in one place; explicit gestures (push-to-talk taps, a manual "Open mic" press) still work. `useVoiceCapture` enforces this automatically — never wire a primitive that bypasses it.

**The asymmetric grading law (non-negotiable):**
- `match` → award credit, `SoundManager.playCorrect()`, celebrate
- `no-match` → **nothing is scored against the student**, the fallback stays available. Whether the tutor *coaches by voice* here is architecture-dependent (see **Capture architecture**): push-to-talk may coach into the closed mic; always-listening stays silent and leans on the visible fallback.
- `unclear` → invite a retry or the fallback, silently — no error state, no red X

A kid who said the word right but got misheard must never be punished by the judge.

**The quiet-tutor law (spoken modality is where "less is more" bites hardest):**

The warmth channel should be RARE, not per-beat. A tutor that says *"say it! … good job! … say it! … good job!"* on every single word makes a student want to turn the tutor off (user ruling, PictureVocabulary 2026-07-04). The mic prompt, the level meter, and the `playCorrect()` snap already tell the student what to do and that they succeeded — the tutor voicing it too is redundant weight, and its voice competes with the very silence the student needs to speak into.

- **Frame once, up front** ("say each word as it comes up"), then step back. Don't re-elicit ("what is this? say it!") every beat when the screen already prompts it.
- **Routine `match` → no voice.** Let `playCorrect()` + the visual + auto-advance carry it. Reserve `sendText` celebration for a moment that earns it: the student's **first spoken word** of the session, or a **comeback right after a miss**.
- **`no-match` / `unclear` → depends on the capture architecture (below).** *Push-to-talk:* one short warm sentence, at most a tiny clue — this is the tutor's real job; keep it terse, never scold. *Always-listening:* **say nothing** — the mic is open, so any "try again!" lands on top of the child who is already trying; lean on the always-visible fallback choices instead.
- **Speak only to deliver audio the screen can't** (a word to be tapped, a sentence to be completed for a pre-reader). If the beat is self-evident on screen, the tutor stays silent.

Net: a smooth multi-word session should be ~3 tutor utterances (open, first-voice, finish), not one per word. Encode the same restraint in the catalog `aiDirectives` ("routine successes will NOT ping you — that silence is by design; do not fill it") so the tutor stays terse even when invoked.

**Capture architecture — pick one, and mind the tutor rule it carries:**

Two live shapes (plus one deprecated). Interchangeable at the judge/grading layer, but they impose **opposite** tutor rules because one closes the mic between tries and the other never does.

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

## Step-by-Step Workflow

### Phase 1: Find the Production Moment

The moment takes one of two shapes — identify which before wiring:

- **Replace-the-report** (PhonicsBlender): a "reveal"/"check" click *merely reports* knowledge the student already has (they built the word, now they click "Blend!"). The mic replaces that click; the click stays as the fallback. Gate: the beat renders instead of / beside the report button.
- **Culminate-after-solve** (CvcSpeller): the primitive makes the student do real decoding work first (spell / pick the vowel / sort), so there's *no report click to replace*. The beat is additive — it appears once the item is resolved (`wordComplete === true`) as "now say the whole word." It never bypasses the challenge, because it only exists after the work is done. Gate: the beat renders in the post-solve state, keyed off the completion flag.

If you can't find a replace-the-report click, you're in the second shape — don't force a fake one. Either way:

1. Locate the gate (report-click handler, or the completion flag). The existing path forward — the report click, or the "Next" button — is your **fallback**; it must survive unchanged.
2. Identify the target word at that moment (must be a single word the student should say).
3. Confirm the primitive uses `useLuminaAI` (`sendText`) — the coaching responses need it. If not, run `/add-tutoring-scaffold` first.

### Phase 2: Wire the Hook

4. Imports:
   ```tsx
   import { useSpokenWordCapture, type SpokenJudgeResult } from '../../../hooks/useSpokenWordCapture';
   ```
5. Track judge-confirmed words for metrics:
   ```tsx
   const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
   ```
6. Result handler — follow the asymmetric law exactly:
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
7. Cancel on item advance: call `spokenCapture.cancel()` at the top of your next-item handler. A live mic must never carry across items.

### Phase 3: Render the Beat

8. Render the capture surface with the shared **`LuminaMicListener`** — never hand-roll a mic button + level bar. (Six primitives each hand-rolled a slightly different meter before this component existed; that's the whole reason it exists.) Import it from the ui barrel and feed it the hook's state directly, next to the existing fallback (never replacing it):
   ```tsx
   import { LuminaMicListener } from '../../../ui';
   ...
   {/* push-to-talk: OMIT `dormant` — for this hook `idle` alone means "offer the button" */}
   <LuminaMicListener
     state={spokenCapture.state}          // 'idle' | 'armed' | 'recording' | 'judging'
     level={spokenCapture.level}          // raw RMS; the orb normalizes it internally
     isSupported={spokenCapture.isSupported}
     onStart={() => void spokenCapture.start()}
     onCancel={spokenCapture.cancel}      // renders a quiet "✕ stop" while live
     accent="emerald"                     // tint to the primitive / phase accent
     idleLabel="Say it!"                  // prompt on the tap-to-talk orb
     listeningLabel="Your turn — say it!" // prompt while armed/recording (optional)
   />
   ```
   The component owns **every** visual state — the tap-to-talk orb, the breathing "mic is live" ring, the voice-reactive spike ring driven by `level`, and the "Checking…" settle spinner while the judge runs. You own only *when* to mount it and *what the answer means*. `isSupported === false` → it renders nothing, so the primitive falls back to the tap path exactly as before.

   **Always-listening variant (`useVoiceAnswer`):** the same component, but **pass `dormant={spoken.dormant}`** — the hook computes honest dormancy (engine dormancy ∪ student ✕-stop ∪ no mic grant yet), so the orb is a tappable button whenever the mic is truly closed; that first tap also doubles as the permission-grant gesture. Wire `onStart={spoken.startManual}` and `onCancel={spoken.cancel}`, and gate the whole surface behind your `spokenActive` flag. See PictureVocabulary's `renderListeningState()` for the reference wiring, and `/add-voice-control` for the full always-listening workflow.

   Props at a glance: `state`, `level`, `isSupported`, `onStart` (required); `onCancel`, `dormant`, `accent` (`LuminaAccent`), `size` (`'sm'|'md'|'lg'`), and the four labels `idleLabel`/`listeningLabel`/`recordingLabel`/`judgingLabel` (optional).
9. Do NOT add capture sounds — the hook already plays `snap()` ("heard you") and the sustained processing pulse. The primitive adds only `playCorrect()` on match (Phase 2). No sound on miss — for push-to-talk the tutor's voice IS the miss feedback; for always-listening the revealed fallback choices are (the tutor stays silent).

### Phase 3b (optional but high-value): Make the beat the primary flow

If the beat sits at a *culminate-after-solve* moment, don't leave it as a peer button next to "Next" — it reads as skippable garnish. Promote it to the primary path and let a spoken success carry the student forward. The line that makes this safe: **auto-advance yes, auto-listen no.** You may advance the flow automatically once the word is judged; you may never open the mic automatically (the tutor's celebration voice would bleed into the clip → false no-match). The tap that starts the mic is the echo gate and must stay.

- **Elevate the CTA, demote the fallback.** Idle state = a prominent primary mic button under a short prompt ("Your turn — say the word!"). Render "Next" as a quiet `Skip →` text link, and hide it entirely while `recording`/`judging` so nothing competes with the mic. The skip must always exist (never trap a mic-less or unwilling student), just visually recede.
- **Auto-advance on match.** Drive it off the confirmed-word set, not the result callback, so it survives re-render:
  ```tsx
  // ref so the timer always calls the latest advance handler (defined below it)
  const advanceRef = useRef(advance); advanceRef.current = advance;
  useEffect(() => {
    if (!currentItem || !spokenWords.has(currentItem.id)) return;
    const t = setTimeout(() => advanceRef.current(), 1400); // celebrate, then glide
    return () => clearTimeout(t);
  }, [spokenWords, currentItem]);
  ```
- **Guard against double-advance.** Once spoken, show only the celebration + auto-advance — remove the manual "Next" from that branch so a timer *and* a click can't both fire `advance()` and skip an item.

### Phase 4: Metrics

10. Add `spokenWords: Array.from(spokenWords)` to the `submitEvaluation` extras (untyped `studentWork` — no evaluation-type changes needed). If the primitive's summary shows a celebration message, mention the spoken count.

### Phase 5: Verify

11. `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — hold the error baseline (project-local binary, absolute path; bare `npx tsc` false-passes).
12. Test by voice in the domain tester: clean word, a minimal-pair neighbor (say "mop" for "map"), a mumble, and silence. Confirm: match celebrates; miss gets voice coaching and no penalty; unclear invites retry; the fallback button always works.
13. If verdicts feel wrong, bench in the Blend Judge Lab (same clip, `auto:ladder` vs individual engines) and tune `MATCH_THRESHOLD` in `service/literacy/azure-blend-judge.ts`.

## Design Rules (Do / Don't)

- **Do** keep the deterministic path reachable — the beat is additive, never a gate. "Additive" ≠ "visually co-equal": it's fine (better, even) to make the mic the primary CTA and demote the fallback to a quiet skip, as long as the skip is always there.
- **Do** pick the capture shape by the moment: push-to-talk for one culminating word (the tap is the echo gate); open mic (`useVoiceCapture` `'open'`) for multi-item runs and voice-controlled surfaces, with its full discipline: mic decoupled from tutor state **and** tutor silent on every non-match (see **Capture architecture**). Auto-listen must respect the global switch (`utils/voiceMode`) — the engine enforces it; don't bypass. Never build new work on `useSpokenTurn`.
- **Don't** let a `no-match` write anything into attempts/accuracy metrics.
- **Don't** call the judge with anything but the hook — the endpointing, sounds, and ladder policy live there for a reason.
- **Don't** substitute `gemini-flash-lite` anywhere in the ladder — it false-positives minimal pairs with high confidence (benched).
- **Don't** send the tutor a `sendText` right before starting capture — the tutor's voice can bleed into the clip. Let the student press the mic when the tutor is quiet (push-to-talk is the echo gate).
- **Don't** voice-celebrate every `match` — that's the "good job × 5" chatter students turn off. Speak on success only when it's earned (first spoken word, or a comeback after a miss); let `playCorrect()` + auto-advance carry the rest. See **the quiet-tutor law**.

## Gotchas

- **Azure PA is reference-biased**: a "mop" clip scores 86/100 against reference "map". That's why the Azure rung makes two parallel calls (plain transcript + PA) and why you must not "simplify" it to PA-only.
- **Thresholds are adult-TTS-tuned**: `MATCH_THRESHOLD = 55` in `azure-blend-judge.ts` awaits a real kid-voice bench. Tune from Lab trials, not intuition.
- **First judge call after a dev-server restart is slow** (route compile) — not production behavior.
- **The `reasoning` field and thinking levels are accuracy features on small models**, not latency fat — don't strip them when tinkering with the Gemini rung.

## Reference Implementation

| File | What to look at |
|---|---|
| `primitives/visual-primitives/literacy/PhonicsBlender.tsx` | **Replace-the-report** archetype: mic replaces the "Blend!" click. Full wiring — handler, hook, cancel-on-advance, UI beat, metrics, tutor cues |
| `primitives/visual-primitives/literacy/CvcSpeller.tsx` | **Culminate-after-solve** archetype: beat gated on `wordComplete`, primary-CTA/quiet-skip layout, auto-advance on match (Phase 3b) |
| `primitives/visual-primitives/literacy/PictureVocabulary.tsx` | **Always-listening** archetype on `useVoiceAnswer` (open-mic engine): tutor SILENT on every non-match, always-visible fallback choices |
| `ui/LuminaMicListener.tsx` | The shared capture surface — state-driven orb (incl. honest `'opening'` state), voice-reactive spike ring + mini sound bar. Don't hand-roll a mic UI |
| `ui/LuminaVoiceTarget.tsx` | The "current target" frame — required when several answerable units share a screen with a live mic |
| `ui/LuminaVoiceToggle.tsx` + `utils/voiceMode.ts` | Session-level auto-listen switch (navbar chip, Ctrl+M) — the engine honors it automatically |
| `hooks/useVoiceCapture.ts` | The NEW generic engine — all modalities, first-frame cue, pre-roll, frozen capture context, auto-start. Target for new always-listening work |
| `hooks/useSpokenWordCapture.ts` | The shipped push-to-talk capability — capture, endpointing, ladder, outcome mapping |
| `hooks/useVoiceAnswer.ts` / `hooks/useVoiceChoice.ts` | The controllers over the engine — spoken production / spoken choice. Wire via `/add-voice-control` |
| `utils/spokenWordJudge.ts` | Ladder policy + outcome semantics |
| `service/literacy/azure-blend-judge.ts` | Azure dual-signal ('say') + plain-recognition choice lane; tunable thresholds |
| `service/literacy/gemini-blend-judge.ts` / `gemini-choice-judge.ts` | LLM rungs: production yes/no + closed-set option discrimination |
| `components/voice-studio/` | The Voice Studio — design bench, scenario plug-ins, spec export. Not a wiring template; the spec it exports IS the wiring input |

## Checklist

- [ ] Found the production moment; fallback click-path unchanged
- [ ] `useSpokenWordCapture` wired with asymmetric outcome handling
- [ ] `spokenCapture.cancel()` on item advance
- [ ] Capture surface rendered via `LuminaMicListener` (not hand-rolled); hidden when `!isSupported`; `dormant` passed only for the always-listening variant
- [ ] `playCorrect()` on match only; no sounds added for capture (hook owns them)
- [ ] Tutor-on-miss matches the architecture: **push-to-talk** → warm `sendText` cues for miss/unclear (never scolding); **always-listening** → miss/unclear/no-speech are voice-SILENT, fallback choices revealed
- [ ] Quiet-tutor law honored: framed once up front, routine `match` is voice-silent, celebration `sendText` gated on first-voice/comeback
- [ ] `spokenWords` in evaluation extras
- [ ] (culminate-after-solve) beat is the primary CTA, fallback demoted to a quiet skip; auto-advance on match with a double-advance guard
- [ ] Project-local `tsc --noEmit` holds baseline (never bare `npx tsc`)
- [ ] Voice-tested: clean / minimal-pair / mumble / silence, all four behave per the asymmetric law
