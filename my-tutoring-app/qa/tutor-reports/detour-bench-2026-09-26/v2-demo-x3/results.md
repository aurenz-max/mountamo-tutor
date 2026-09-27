# Detour bench (LA-15 D0) — raw results

Scores: obstacle/easier/representation/scope/usable, each 0-2.

```json
{
  "demo": {
    "n": 15,
    "medianReadyMs": 1348,
    "maxReadyMs": 2872,
    "errors": 0,
    "targetsObstacle": 2,
    "easierOrPrerequisite": 2,
    "differentRepresentation": 1.13,
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
| g1-cvc-blend | demo | ERR |  | — |  |  |
| g1-cvc-blend | demo | ERR |  | — |  |  |
| g1-cvc-blend | demo | ERR |  | — |  |  |
| g1-subtract-hops | demo | demo:number-line/subtract |  | 2/2/0/2/2 |  | Yes, this worked demo directly models and explains the concept of hopping before counting, directly addressing the student's counting error. |
| g1-subtract-hops | demo | demo:number-line/subtract |  | 2/2/1/2/2 |  | A teacher would definitely use this clear worked demonstration because it directly addresses the student's off-by-one counting error. |
| g1-subtract-hops | demo | demo:number-line/subtract |  | 2/2/1/2/2 |  | A teacher would definitely use this worked demo because it directly names and visually clarifies that counting begins with the first movement, not the starting mark. |
| g2-main-idea | demo | ERR |  | — |  |  |
| g2-main-idea | demo | ERR |  | — |  |  |
| g2-main-idea | demo | ERR |  | — |  |  |
| g2-regroup | demo | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, a teacher would immediately use this worked demo to show why 14 ones cannot stay in the ones place and how bundling creates one ten and leftover ones. |
| g2-regroup | demo | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, this is an excellent, direct worked example showing why a two-digit ones total must be bundled into tens and ones before writing the answer. |
| g2-regroup | demo | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, a teacher would definitely use this clear, focused demonstration to show why two digits cannot sit in the ones place and how bundling works. |
| g3-clock-minutes | demo | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | A teacher would definitely use this concise demonstration because it explicitly targets the exact misconception with clear skip-counting visual steps. |
| g3-clock-minutes | demo | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, this directly addresses the exact misconception with a clear worked demonstration without spoiling their original problem. |
| g3-clock-minutes | demo | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, this demo directly targets the student's exact misconception with a clear worked example showing skip-counting by fives. |
| g3-mult-groups | demo | ERR |  | — |  |  |
| g3-mult-groups | demo | ERR |  | — |  |  |
| g3-mult-groups | demo | ERR |  | — |  |  |
| g4-compare-digits | demo | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, this directly addresses the student's exact misconception about 'lots of nines' with an isomorphic worked demonstration before returning to practice. |
| g4-compare-digits | demo | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, this directly addresses the misconception that nines in lower places outweigh a larger digit in the highest place value. |
| g4-compare-digits | demo | demo:place-value/compare |  | 2/2/1/2/2 |  | A teacher would immediately use this targeted worked demo because it explicitly tackles the misconception that nines in lower places outweigh a larger leading digit. |
| g4-fraction-add | demo | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, a teacher would definitely use this visual number-line demo to show that adding fractional parts does not change their unit size. |
| g4-fraction-add | demo | demo:number-line/add |  | 2/2/2/2/2 |  | A teacher would definitely use this clear number-line walkthrough to show that adding parts does not change their size. |
| g4-fraction-add | demo | demo:number-line/add |  | 2/2/2/2/2 |  | A teacher would definitely use this demo to clearly show on a number line that hopping fifths counts parts while keeping the denominator unchanged. |
| g5-particles | demo | ERR |  | — |  |  |
| g5-particles | demo | ERR |  | — |  |  |
| g5-particles | demo | ERR |  | — |  |  |
| k-count-tracking | demo | ERR |  | — |  |  |
| k-count-tracking | demo | ERR |  | — |  |  |
| k-count-tracking | demo | ERR |  | — |  |  |
