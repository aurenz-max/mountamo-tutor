# circuit-workbench `magnet_poles` (2026-11-02, `/add-eval-modes`, SB-6, G3)

**Mode:** two bar magnets lie end to end on the workbench (N half red, S half blue, letters on top). The left magnet
stays put. The learner says a guess to the tutor (no guess buttons, rule 3), taps the right magnet to turn it and the
left magnet to slide them together (rule 8; panel buttons are the fallback), and must test both ways before the
question appears. β 2.0, scaffoldingMode 2, answer `tap`. Home: G3 `SCI001-06-a` (poles).

| Tier | After testing both ways |
|---|---|
| easy | call one untested bar pair (the left magnet's other end; pull or push varies by seed) |
| medium | call two pairs on other magnets (horseshoe ends, ring sides), one pull and one push |
| hard | the right magnet's letters rubbed off, one end striped: is the striped end N or S? |

The right magnet's starting side is random per item, so the first slide is not always a push.

**Misses:** `like_ends_pull`, `unlike_ends_push`, `mystery_backwards`. **Levers:** `pole_tags` (legend: "same ends" /
"different ends" on each test row and each pair; not offered on a striped magnet, where which ends face is what the
learner is working out) and `one_step_less` (one bar pair, every letter showing). The scene never carries a pair's result
or the striped end's pole before a right check.

**Also fixed:** the battery and clip posts are hidden in both magnet modes (the 10-31 report noted the battery sat on the
table in a magnet test doing nothing). Card wording trimmed to stay under the 4,000-char guidance cap (was 4,248).

**Verification:** `poleModel.test.ts` 5; mounted test (calls hidden until both ways; same ends called a pull is
`like_ends_pull`; Try again; striped magnet named; scene keeps the pole out); `test:primitive circuit-workbench` 733/733;
physics vitest 321/321; `typecheck:lumina` 0; full tsc 770 (baseline). Browser Grade 3 medium `drive-poles.mjs` 37/37
(item 1 driven by tapping the 3D magnets). $0 Gemini (code-only). Easy and hard are covered by vitest and the mounted test only,
because the tester has no tier control.

**Owed:** the user's browser check; whether the tutor asks the guess aloud is the same Live question as SB-5's
`drop_test` sample.
