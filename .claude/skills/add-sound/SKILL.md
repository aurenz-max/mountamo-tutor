# Add Sound to a Primitive

This skill wires procedural UI sound into an existing Lumina primitive so student interactions feel responsive — taps, selections, drag-drops, steppers, and per-challenge answer feedback. All sound is synthesized at runtime via the Web Audio API (no files, no MIDI) by the shared `SoundManager`.

## Required Reading

- `my-tutoring-app/src/components/lumina/utils/SoundManager.ts` — the sound engine and the full palette (`SOUND_SPECS`). This is the single source of truth for what sounds exist.

You can audition every sound live in the **Sound Lab** dev tool (IdleScreen → Developer Tools → Sound Lab), including a "Design your own" panel for tuning new ones by ear.

## When to Use This Skill

Use this skill when:
- Adding interaction sound to an existing primitive (tap, select, snap, tick, etc.)
- Adding immediate per-challenge correct/incorrect audio feedback inside a multi-phase primitive
- Reviewing a primitive that feels "silent" during interaction

**DO NOT use this skill for:**
- Creating new primitives — fold these steps into the `/primitive` build instead
- AI voice tutoring / phonics audio — that is Gemini Live (`/add-tutoring-scaffold`), a completely separate system
- Adding new dev tools or pages

## Architecture Overview

Three layers already exist. **Know what fires automatically so you don't double-wire it.**

```
┌──────────────────────────────────────────────────────────────┐
│  SoundManager (utils/SoundManager.ts)                         │
│  Singleton. Data-driven palette (SOUND_SPECS). Respects a     │
│  global mute + volume persisted to localStorage. Safe to call │
│  anywhere — no-op when muted or during SSR.                   │
└───────────────┬──────────────────────────────────────────────┘
                │
   ┌────────────┴───────────────┬──────────────────────────────┐
   │ AUTOMATIC (do not re-wire)  │ MANUAL (this skill)          │
   ├─────────────────────────────┼──────────────────────────────┤
   │ CelebrationLayer            │ Per-primitive interaction:    │
   │  → correct / incorrect /    │  • tap on manipulation        │
   │    streak / perfect, fired  │  • select on choice           │
   │    on final submitResult()  │  • snap on drag-drop          │
   │    (aggregate, once per      │  • tick on stepper/slider     │
   │    primitive completion)    │  • per-challenge correct/      │
   │                             │    incorrect at each check    │
   │ useChallengeProgress        │                               │
   │  .advance() → navigate      │                               │
   │  (every multi-phase next)   │                               │
   └─────────────────────────────┴──────────────────────────────┘
```

**Key consequence:** `CelebrationLayer` only plays on the **final** `submitResult()` — which most multi-phase primitives call once, at the end. So each intermediate "Check Answer" is **silent** unless you wire per-challenge `playCorrect()` / `playIncorrect()`. That is usually the highest-value sound to add.

## The Sound Palette

Call these on `SoundManager` (imported as below). Grouped by intent.

### Interaction — tiny, frequent, must never annoy

| Method | When to play |
|--------|--------------|
| `SoundManager.tap()` | Neutral press: button, cell, token, generic click |
| `SoundManager.select()` | Confirms a *choice* (multiple-choice option, mode pick) — brighter than a tap |
| `SoundManager.toggle(on: boolean)` | A switch/flip; rising blips when `on`, falling when off |
| `SoundManager.navigate()` | Moving between screens/challenges *(already automatic via the hook — rarely call directly)* |
| `SoundManager.pop()` | An element appears/opens |
| `SoundManager.snap()` | A dragged item lands/snaps into place |
| `SoundManager.tick()` | Slider / stepper increment — barely-there, safe for rapid repeats |
| `SoundManager.invalid()` | A blocked / not-allowed action (NOT a wrong answer) |

### Feedback — answer evaluation

| Method | When to play |
|--------|--------------|
| `SoundManager.playCorrect()` | A correct answer/check (ascending arpeggio) |
| `SoundManager.playIncorrect()` | A wrong answer/check (soft low dip — feedback, not punishment) |

### Celebration — milestones (normally automatic)

| Method | When |
|--------|------|
| `SoundManager.playStreak()` | Several correct in a row — fired by CelebrationLayer |
| `SoundManager.playPerfect()` | Perfect score — fired by CelebrationLayer |

> You rarely call the celebration methods directly. Let `CelebrationLayer` own them via `submitResult()`.

## Step-by-Step Workflow

### Phase 1: Analyze the Primitive

1. **Ask the user which primitive** to add sound to. Get the component file path (usually `primitives/visual-primitives/[domain]/X.tsx`).

2. **Read the component** and locate:
   - **Manipulation handlers** — `handleCellClick`, `handleDrop`, option `onClick`, `onChange`, stepper `+/-` buttons.
   - **Per-challenge check** — the function that computes `correct` (e.g. `handleCheckAnswer`). Note: is it currently silent?
   - **Whether it uses `useChallengeProgress`** — if so, `navigate` on advance is already wired; do not add it.
   - **Whether it submits per-challenge or once at the end** — drives the double-sound check in Phase 3.

3. **Map each event to a sound** using the palette table. Present the mapping to the user before editing. Keep it **sparse** — 2–4 sound points per primitive is plenty. Over-spraying sound is worse than silence.

### Phase 2: Import

4. **Add the import.** Adjust the relative path to reach `components/lumina/utils/SoundManager`:
   ```typescript
   // from primitives/visual-primitives/[domain]/X.tsx
   import { SoundManager } from '../../../utils/SoundManager';
   ```
   (From `primitives/problem-primitives/X.tsx` it is `../../utils/SoundManager`.)

### Phase 3: Wire the Events

5. **Manipulation → tactile sound.** One line at the top of the handler, after any early-return guards:
   ```typescript
   const handleCellClick = useCallback((i: number) => {
     if (locked) return;
     SoundManager.tap();        // ← tactile placement
     // ...existing logic
   }, [locked]);
   ```
   Use `select()` for choosing an option, `snap()` for a drop, `tick()` for steppers/sliders.

6. **Per-challenge check → immediate feedback.** Where correctness is computed:
   ```typescript
   if (correct) {
     SoundManager.playCorrect();
     recordResult({ /* ... */ });
   } else {
     SoundManager.playIncorrect();
   }
   ```

7. **Avoid double-sounds.** Before finishing, trace the **final** check:
   - If the primitive submits once at the end, the last challenge will play per-challenge `correct`, then moments later `CelebrationLayer` plays `perfect`/`streak`/`correct` on `submitResult()`. This escalation is usually *fine* (success → reward). 
   - If it feels like too much, suppress per-challenge feedback on the last challenge, or skip per-challenge feedback entirely and rely on CelebrationLayer.
   - **Never** manually call `playPerfect()`/`playStreak()` in the primitive — that *will* collide with CelebrationLayer.

8. **Do not guard for mute/SSR.** `SoundManager` is a no-op when disabled or server-side. Just call the methods.

### Phase 4: (Optional) Add a New Sound to the Palette

Only if no existing sound fits. The palette is data-driven:

9. Add a `SoundSpec` to `SOUND_SPECS` in `SoundManager.ts` (id, label, group, description, `notes[]`). Add a named helper method if it will be called often. Tune it in the Sound Lab's "Design your own" panel first, then transcribe the waveform/pitch/length into the spec.
   - Design rules: short (50–250ms); consonant intervals for "good"; soft/low/short for "neutral/no"; rising pitch = progress, falling = undo.

### Phase 5: Verify

10. **Type check:**
    ```bash
    cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit
    ```
    (Project-local binary, absolute path — bare `npx tsc` false-passes. Zero NEW errors vs. baseline.)

11. **Report** which events were wired to which sounds, and flag the double-sound decision from step 7.

12. **Remind the user to test by ear** in the domain Primitives Tester (and Sound Lab to tune levels). Sound correctness can only be judged by listening — type-checking proves nothing about how it feels.

## Design Rules (Do / Don't)

- **Do** keep it sparse — a primitive needs a few well-placed sounds, not one per pixel.
- **Do** match the sound's intent to the event (tactile vs. choice vs. feedback).
- **Don't** re-wire what's automatic: `navigate` (the hook) and the celebration sounds (CelebrationLayer).
- **Don't** use `playIncorrect()` for a merely *blocked* action — that's `invalid()`. Reserve correct/incorrect for actual answer judgments.
- **Don't** add guards for mute/volume/SSR — the manager handles them.

## Reference Implementation

**Ten Frame** is the reference. Read for the complete pattern:
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/TenFrame.tsx`
  - `tap()` in `handleCellClick`
  - `tick()` in the subitize / make-ten steppers
  - `playCorrect()` / `playIncorrect()` in `handleCheckAnswer`
- `my-tutoring-app/src/components/lumina/hooks/useChallengeProgress.ts` — `navigate()` in `advance()` (the shared chokepoint, already covers all multi-phase primitives)

## Checklist

- [ ] Read the component; located manipulation handlers and the per-challenge check
- [ ] Confirmed whether it uses `useChallengeProgress` (navigate already wired) and whether it submits once at the end
- [ ] Mapped events → sounds with the user (kept it sparse: ~2–4 points)
- [ ] Imported `SoundManager` with the correct relative path
- [ ] Wired tactile interaction sound(s) (`tap`/`select`/`snap`/`tick`) after handler guards
- [ ] Wired per-challenge `playCorrect()` / `playIncorrect()` at the check (if multi-challenge)
- [ ] Checked the final-challenge double-sound case and made a decision
- [ ] Did NOT manually call celebration sounds or re-wire `navigate`
- [ ] (If new sound) Added `SoundSpec` to `SOUND_SPECS`, tuned in Sound Lab
- [ ] Project-local `tsc --noEmit` holds baseline (absolute path; never bare `npx tsc`)
- [ ] Reminded the user to test by ear in the Primitives Tester + Sound Lab
