# Voice Transport Unification — implementation review (2026-08-05)

## Result

The charter's four phases are implemented in code. The authenticated three-run
refer-back gate passed; physical speaker/microphone acceptance remains open.

| Phase | Implementation | Automated gate |
|---|---|---|
| Calibration beat | Robust ambient/echo floor sampling; each regime must collect 8 frames before it may open a turn; device-relative open bars continue adapting. | `voiceTurnCalibration.test.ts` + voice machine suite |
| Session-wide authority | Every lesson authenticates with `manual_activity`; `LuminaAIProvider` owns one `useLiveVoiceTurnsWithTransport`; judged DI subscribes to closes and retains a private authority only in standalone mode. | `useJudgedSpeechLoop.shared-turns.test.tsx` + judged-loop suites |
| Contextual close + viewport claim | The existing viewport `switchPrimitive` updates the provider's active type; held phonemes close at 300 ms, word/fact responses at 420 ms, sentences at 600 ms, conversation at 900 ms. | `lessonVoiceTurnPolicy.test.ts` |
| Refer-back journey | `lesson-refer-back` drives excavator parts → hydraulics → construction application in one lesson session. `grounds-in-prior-section` requires the final response to recover boom, stick, bucket, and the hydraulic mechanism. | **PASS 3/3 real Gemini Live sessions**, no findings |

The Pip control is now pause/resume for a persistent lesson mic. DI stages no
longer stop the lesson mic when a section unmounts, and their idle start control
still starts the judged run even when the shared mic is already open.

## Verification completed

- Focused Vitest: 51/51 passing across calibration, close policy, voice machine,
  shared-stream consumption, judged-loop diagnostics/liveness/verdict text, and
  fuzz coverage.
- `npm run typecheck:lumina`: pass, 0 errors.
- Full TypeScript output filtered to all touched voice/context/DI files: 0
  errors. The repository-wide command remains red on pre-existing unrelated
  legacy errors.
- `python -m py_compile backend/tests/tutor_live/run_tutor_live.py`: pass.
- `python backend/tests/tutor_live/run_tutor_live.py --help`: pass.
- Refer-back journey/oracle pytest: 3/3 passing.
- Tier-3 live refer-back: PASS, 3/3 sessions, no findings. Transcript report:
  `qa/tutor-reports/lesson-refer-back-live-lesson-2026-08-05.md`.

## Runtime gates still required

1. Speaker + mic mixed lesson: talk over Pip, talk during a non-DI section,
   enter DI, finish/leave DI, then keep conversing. Confirm one bracket stream,
   no echo-opened turns, no phantom verdicts, and no lost mic after DI unmount.
2. Calibration hardware spread: run quiet/loud laptop speakers, headset, fan or
   HVAC, and a second microphone. Record ambient/echo floors and derived bars.
The refer-back transcript has also been manually read. All three final turns
grounded naturally in the earlier sections; run 2 had one awkward greeting
sentence, a non-repeating model-improv note rather than a transport finding.
