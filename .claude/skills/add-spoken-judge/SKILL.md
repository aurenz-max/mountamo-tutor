# Add Spoken Judge to a Literacy Primitive

This skill adds a **spoken production beat** to an existing literacy primitive: the student says a target word aloud, a judge ladder confirms it in ~0.65s (fast path), and the primitive awards credit — with the existing tap/click interaction as the always-available fallback. It turns recognition tasks ("click the word") into production tasks ("say the word"), the highest-value modality on the production roadmap.

**Outcome:** a push-to-talk "🎙️ Say it!" beat wired into one primitive, judged by the Azure → Gemini ladder, graded asymmetrically (spoken success adds credit; spoken failure never subtracts), with the tutor coaching misses by voice.

## Required Reading

- `my-tutoring-app/src/components/lumina/hooks/useSpokenWordCapture.ts` — the hook (capture, endpointing, ladder, outcomes). This is the only API a primitive touches.
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/literacy/PhonicsBlender.tsx` — reference implementation (Blend phase).

Tune thresholds and bench models in the **Blend Judge Lab** dev tool (IdleScreen → Developer Tools → 🎙️ Blend Judge Lab).

## When to Use This Skill

Use when a literacy primitive has a moment where the student *knows the word* and clicking merely reports it — blending, sight words, rhyme production, letter-sound naming. The spoken beat replaces button-theater with real production.

**DO NOT use this skill for:**
- Free-form speech (sentences, retells) — the judge is single-word/short-phrase only
- Math or non-verbal primitives
- Anything that would *auto-listen* — capture must always be a push-to-talk user gesture

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

**The asymmetric grading law (non-negotiable):**
- `match` → award credit, `SoundManager.playCorrect()`, celebrate
- `no-match` → tutor coaches by voice (`sendText`), **nothing is scored against the student**, the tap fallback stays available
- `unclear` → invite a retry or the fallback, silently — no error state, no red X

A kid who said the word right but got misheard must never be punished by the judge.

**The quiet-tutor law (spoken modality is where "less is more" bites hardest):**

The warmth channel should be RARE, not per-beat. A tutor that says *"say it! … good job! … say it! … good job!"* on every single word makes a student want to turn the tutor off (user ruling, PictureVocabulary 2026-07-04). The mic prompt, the level meter, and the `playCorrect()` snap already tell the student what to do and that they succeeded — the tutor voicing it too is redundant weight, and its voice competes with the very silence the student needs to speak into.

- **Frame once, up front** ("say each word as it comes up"), then step back. Don't re-elicit ("what is this? say it!") every beat when the screen already prompts it.
- **Routine `match` → no voice.** Let `playCorrect()` + the visual + auto-advance carry it. Reserve `sendText` celebration for a moment that earns it: the student's **first spoken word** of the session, or a **comeback right after a miss**.
- **`no-match` / `unclear` → one short warm sentence, at most a tiny clue.** This is the tutor's real job; keep it, keep it terse, never scold.
- **Speak only to deliver audio the screen can't** (a word to be tapped, a sentence to be completed for a pre-reader). If the beat is self-evident on screen, the tutor stays silent.

Net: a smooth multi-word session should be ~3 tutor utterances (open, first-voice, finish), not one per word. Encode the same restraint in the catalog `aiDirectives` ("routine successes will NOT ping you — that silence is by design; do not fill it") so the tutor stays terse even when invoked.

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

8. Next to the existing fallback button (never replacing it):
   ```tsx
   {spokenCapture.isSupported && spokenCapture.state === 'idle' && (
     <LuminaButton onClick={() => void spokenCapture.start()}>🎙️ Say it!</LuminaButton>
   )}
   {(spokenCapture.state === 'armed' || spokenCapture.state === 'recording') && (
     /* "Say “word”!" prompt + level meter from spokenCapture.level + ✕ cancel */
   )}
   {spokenCapture.state === 'judging' && <span>Checking…</span>}
   ```
   `isSupported === false` → the beat simply doesn't render; the primitive works exactly as before.
9. Do NOT add capture sounds — the hook already plays `snap()` ("heard you") and the sustained processing pulse. The primitive adds only `playCorrect()` on match (Phase 2). No sound on miss — the tutor's voice IS the miss feedback.

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

11. `cd my-tutoring-app && npx tsc --noEmit` — hold the error baseline.
12. Test by voice in the domain tester: clean word, a minimal-pair neighbor (say "mop" for "map"), a mumble, and silence. Confirm: match celebrates; miss gets voice coaching and no penalty; unclear invites retry; the fallback button always works.
13. If verdicts feel wrong, bench in the Blend Judge Lab (same clip, `auto:ladder` vs individual engines) and tune `MATCH_THRESHOLD` in `service/literacy/azure-blend-judge.ts`.

## Design Rules (Do / Don't)

- **Do** keep the deterministic path reachable — the beat is additive, never a gate. "Additive" ≠ "visually co-equal": it's fine (better, even) to make the mic the primary CTA and demote the fallback to a quiet skip, as long as the skip is always there.
- **Do** start *capture* only from a user gesture (push-to-talk). Never auto-listen. Advancing the *flow* automatically after a judged match is fine and encouraged — auto-advance yes, auto-listen no.
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
| `hooks/useSpokenWordCapture.ts` | The capability — capture, endpointing, ladder, outcome mapping |
| `utils/spokenWordJudge.ts` | Ladder policy + outcome semantics |
| `service/literacy/azure-blend-judge.ts` | Azure dual-signal + tunable thresholds |
| `service/literacy/gemini-blend-judge.ts` | LLM rung (escalation tier) |
| `components/BlendJudgeLab.tsx` | Bench/tuning tool — not a wiring template |

## Checklist

- [ ] Found the production moment; fallback click-path unchanged
- [ ] `useSpokenWordCapture` wired with asymmetric outcome handling
- [ ] `spokenCapture.cancel()` on item advance
- [ ] Push-to-talk button + level meter + judging state rendered; hidden when `!isSupported`
- [ ] `playCorrect()` on match only; no sounds added for capture (hook owns them)
- [ ] Tutor `sendText` cues for miss/unclear (warm, never scolding)
- [ ] Quiet-tutor law honored: framed once up front, routine `match` is voice-silent, celebration `sendText` gated on first-voice/comeback
- [ ] `spokenWords` in evaluation extras
- [ ] (culminate-after-solve) beat is the primary CTA, fallback demoted to a quiet skip; auto-advance on match with a double-advance guard
- [ ] `npx tsc --noEmit` holds baseline
- [ ] Voice-tested: clean / minimal-pair / mumble / silence, all four behave per the asymmetric law
