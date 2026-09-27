# Detour bench (LA-15 D0) — raw results

Scores: obstacle/easier/representation/scope/usable, each 0-2.

```json
{
  "demo": {
    "n": 15,
    "medianReadyMs": 1274,
    "maxReadyMs": 4244,
    "errors": 0,
    "targetsObstacle": 2,
    "easierOrPrerequisite": 2,
    "differentRepresentation": 1,
    "inScope": 2,
    "contentUsable": 2,
    "leaks": 0,
    "nonSingleMode": 0,
    "none": 15
  },
  "demo-evidence": {
    "n": 16,
    "medianReadyMs": 1216,
    "maxReadyMs": 2993,
    "errors": 0,
    "targetsObstacle": 1.88,
    "easierOrPrerequisite": 1.88,
    "differentRepresentation": 1.19,
    "inScope": 1.94,
    "contentUsable": 2,
    "leaks": 0,
    "nonSingleMode": 0,
    "none": 14
  }
}
```

| scenario | arm | pick | mode | scores | leak | judge verdict |
|---|---|---|---|---|---|---|
| g1-cvc-blend | demo | ERR |  | — |  |  |
| g1-cvc-blend | demo | ERR |  | — |  |  |
| g1-cvc-blend | demo | ERR |  | — |  |  |
| g1-cvc-blend | demo-evidence | ERR |  | — |  |  |
| g1-cvc-blend | demo-evidence | ERR |  | — |  |  |
| g1-cvc-blend | demo-evidence | ERR |  | — |  |  |
| g1-subtract-hops | demo | demo:number-line/subtract |  | 2/2/0/2/2 |  | A teacher would definitely use this worked demo because it explicitly highlights that the starting point is not counted as hop 1. |
| g1-subtract-hops | demo | demo:number-line/subtract |  | 2/2/0/2/2 |  | Yes, this worked demonstration clearly models not counting the starting number before hopping, directly clearing up the student's specific error. |
| g1-subtract-hops | demo | demo:number-line/subtract |  | 2/2/0/2/2 |  | Yes, a teacher would use this worked demonstration because it directly clarifies that the starting number counts as zero hops before counting begins. |
| g1-subtract-hops | demo-evidence | demo:number-line/subtract |  | 2/2/0/2/2 |  | A teacher would definitely use this clear, worked demonstration to show the student that counting starts on the first hop rather than the starting number. |
| g1-subtract-hops | demo-evidence | demo:number-line/subtract |  | 2/2/1/2/2 |  | Yes, this demo directly targets counting the starting number by explicitly highlighting that standing still is not a hop. |
| g1-subtract-hops | demo-evidence | demo:number-line/subtract |  | 2/2/1/2/2 |  | A teacher would definitely use this demo because it explicitly highlights that the starting point is not counted as a hop. |
| g2-main-idea | demo | ERR |  | — |  |  |
| g2-main-idea | demo | ERR |  | — |  |  |
| g2-main-idea | demo | ERR |  | — |  |  |
| g2-main-idea | demo-evidence | ERR |  | — |  |  |
| g2-main-idea | demo-evidence | ERR |  | — |  |  |
| g2-main-idea | demo-evidence | ERR |  | — |  |  |
| g2-regroup | demo | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | A teacher would definitely use this short demonstration to clearly explain why a place value column cannot hold two digits and how regrouping works. |
| g2-regroup | demo | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, this demo directly explains why a two-digit sum cannot stay in the ones place and clearly shows how bundling makes 1 ten and leftover ones. |
| g2-regroup | demo | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, this demo clearly isolates and explains why a place column cannot hold two digits and demonstrates how 10 ones become 1 ten. |
| g2-regroup | demo-evidence | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | A teacher would definitely use this clear demonstration because it directly targets the single-digit place-value constraint the student is violating. |
| g2-regroup | demo-evidence | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | A teacher would definitely use this concise demo to explain why two digits cannot sit in the ones place before returning to the full addition problem. |
| g2-regroup | demo-evidence | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, this is an ideal short demo to show why you cannot write two digits in the ones place and how regrouping works. |
| g3-clock-minutes | demo | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, this directly confronts the student's exact misconception with a clear, step-by-step visual demonstration of skip-counting by fives. |
| g3-clock-minutes | demo | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | A teacher would definitely use this clear worked example to directly refute the misconception before returning to practice. |
| g3-clock-minutes | demo | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, a teacher would definitely use this worked demo because it explicitly confronts and clarifies the student's exact misconception using clear visual labels and skip-counting. |
| g3-clock-minutes | demo-evidence | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, a teacher would definitely use this clear worked example to correct the exact error of reading numerals directly as minutes. |
| g3-clock-minutes | demo-evidence | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, this directly addresses the student's exact misconception with a clear, prerequisite demonstration of counting by fives. |
| g3-clock-minutes | demo-evidence | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | A teacher would definitely use this worked example to explicitly address the misconception before having the student try again. |
| g3-mult-groups | demo | ERR |  | — |  |  |
| g3-mult-groups | demo | ERR |  | — |  |  |
| g3-mult-groups | demo | ERR |  | — |  |  |
| g3-mult-groups | demo-evidence | ERR |  | — |  |  |
| g3-mult-groups | demo-evidence | ERR |  | — |  |  |
| g3-mult-groups | demo-evidence | ERR |  | — |  |  |
| g4-compare-digits | demo | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, this demo directly targets the student's exact misconception about 'nines' with a clear worked comparison before returning to practice. |
| g4-compare-digits | demo | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, this perfectly targets the misconception that 9s make a number bigger by showing that the thousands place decides the comparison. |
| g4-compare-digits | demo | demo:place-value/compare |  | 2/2/1/2/2 |  | A teacher would immediately use this targeted worked demo because it explicitly refutes the 'all nines' misconception using an analogous comparison. |
| g4-compare-digits | demo-evidence | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, this demo directly addresses the student's exact misconception about smaller places with 9s outweighing a larger leading digit. |
| g4-compare-digits | demo-evidence | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, this is an excellent worked demo that specifically targets the 'more nines' misconception using an isomorphic example. |
| g4-compare-digits | demo-evidence | demo:place-value/compare |  | 2/2/1/2/2 |  | Yes, this demo directly addresses the student's exact misconception with a clean parallel example showing why the largest place decides the comparison regardless of nines. |
| g4-fraction-add | demo | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, a teacher would use this worked demonstration because it provides a visual number-line model reinforcing why fifths stay fifths without spoiling the original problem. |
| g4-fraction-add | demo | demo:number-line/add |  | 2/2/2/2/2 |  | A teacher would definitely use this detour right now because the number-line hops make it visual and intuitive that the unit size (fifths) does not change when adding. |
| g4-fraction-add | demo | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, this worked example clearly demonstrates why the denominator remains fifths using an effective alternate representation without spoiling the original question. |
| g4-fraction-add | demo-evidence | demo:number-line/add |  | 2/2/2/2/2 |  | A teacher would readily use this worked demonstration to help the student visualize why the denominator stays five when adding fifths. |
| g4-fraction-add | demo-evidence | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, this worked demonstration effectively shows on a number line why adding fifths leaves the denominator unchanged without leaking the answer to 2/5 + 1/5. |
| g4-fraction-add | demo-evidence | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, a teacher would definitely use this clear number-line demonstration to visually show why the denominator stays fifths during addition. |
| g5-particles | demo | ERR |  | — |  |  |
| g5-particles | demo | ERR |  | — |  |  |
| g5-particles | demo | ERR |  | — |  |  |
| g5-particles | demo-evidence | ERR |  | — |  |  |
| g5-particles | demo-evidence | ERR |  | — |  |  |
| g5-particles | demo-evidence | ERR |  | — |  |  |
| k-count-tracking | demo | ERR |  | — |  |  |
| k-count-tracking | demo | ERR |  | — |  |  |
| k-count-tracking | demo | ERR |  | — |  |  |
| k-count-tracking | demo-evidence | demo:number-line/add |  | 0/0/2/1/2 |  | A teacher would not use an addition number-line demonstration to remediate a kindergarten student's lack of one-to-one correspondence when counting discrete objects. |
| k-count-tracking | demo-evidence | ERR |  | — |  |  |
| k-count-tracking | demo-evidence | ERR |  | — |  |  |
