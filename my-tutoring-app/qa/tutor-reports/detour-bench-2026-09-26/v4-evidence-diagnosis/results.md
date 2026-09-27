# Detour bench (LA-15 D0) — raw results

Scores: obstacle/easier/representation/scope/usable, each 0-2.

```json
{
  "demo-evidence": {
    "n": 15,
    "medianReadyMs": 1260,
    "maxReadyMs": 2349,
    "errors": 0,
    "targetsObstacle": 2,
    "easierOrPrerequisite": 2,
    "differentRepresentation": 1.2,
    "inScope": 2,
    "contentUsable": 2,
    "leaks": 0,
    "nonSingleMode": 0,
    "none": 15
  }
}
```

| scenario | arm | pick | mode | scores | leak | judge verdict |
|---|---|---|---|---|---|---|
| g1-cvc-blend | demo-evidence | ERR |  | — |  |  |
| g1-cvc-blend | demo-evidence | ERR |  | — |  |  |
| g1-cvc-blend | demo-evidence | ERR |  | — |  |  |
| g1-subtract-hops | demo-evidence | demo:number-line/subtract |  | 2/2/1/2/2 |  | Yes, this worked demo directly models and explains the concept of hopping before counting. |
| g1-subtract-hops | demo-evidence | demo:number-line/subtract |  | 2/2/1/2/2 |  | A teacher would definitely use this clear, targeted worked example to clarify that the first hop lands on the next number. |
| g1-subtract-hops | demo-evidence | demo:number-line/subtract |  | 2/2/1/2/2 |  | A teacher would immediately use this worked demo because it directly targets and clarifies why the starting number is not counted as hop 1. |
| g2-main-idea | demo-evidence | ERR |  | — |  |  |
| g2-main-idea | demo-evidence | ERR |  | — |  |  |
| g2-main-idea | demo-evidence | ERR |  | — |  |  |
| g2-regroup | demo-evidence | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | A teacher would definitely use this detour right now because it directly explains why 14 (analogous to the student's 13) cannot sit entirely in the ones place. |
| g2-regroup | demo-evidence | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, this demo directly targets the misconception that more than 9 ones can stay in the ones place by clearly demonstrating bundling ten ones into one ten. |
| g2-regroup | demo-evidence | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, this cleanly demonstrates the core concept of bundling 10 ones into 1 ten to explain why 13 cannot be written in the ones column. |
| g3-clock-minutes | demo-evidence | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | A teacher would definitely use this clear worked example to correct the student's direct reading of the minute numeral. |
| g3-clock-minutes | demo-evidence | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, a teacher would immediately use this targeted demonstration to directly tackle the misconception that the minute hand's numeral represents literal minutes. |
| g3-clock-minutes | demo-evidence | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, this directly confronts the student's exact error with a clear, step-by-step skip-counting demonstration. |
| g3-mult-groups | demo-evidence | ERR |  | — |  |  |
| g3-mult-groups | demo-evidence | ERR |  | — |  |  |
| g3-mult-groups | demo-evidence | ERR |  | — |  |  |
| g4-compare-digits | demo-evidence | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, a teacher would definitely use this clear, direct demonstration to dispel the misconception about nines making numbers bigger. |
| g4-compare-digits | demo-evidence | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, a teacher would definitely use this clear, worked demonstration to explicitly counter the belief that having 9s in smaller places makes a number larger. |
| g4-compare-digits | demo-evidence | demo:place-value/compare |  | 2/2/1/2/2 |  | A teacher would immediately show this demonstration because it directly addresses the belief that nines make a number larger. |
| g4-fraction-add | demo-evidence | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, this worked demonstration effectively uses a number line to show that moving by fifths keeps the denominator unchanged. |
| g4-fraction-add | demo-evidence | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, this worked example clearly demonstrates why the denominator remains unchanged when hopping along a number line without giving away the original problem's answer. |
| g4-fraction-add | demo-evidence | demo:number-line/add |  | 2/2/2/2/2 |  | A teacher would definitely use this clear, worked visual demonstration to show why the denominator remains unchanged when adding fractions. |
| g5-particles | demo-evidence | ERR |  | — |  |  |
| g5-particles | demo-evidence | ERR |  | — |  |  |
| g5-particles | demo-evidence | ERR |  | — |  |  |
| k-count-tracking | demo-evidence | ERR |  | — |  |  |
| k-count-tracking | demo-evidence | ERR |  | — |  |  |
| k-count-tracking | demo-evidence | ERR |  | — |  |  |
