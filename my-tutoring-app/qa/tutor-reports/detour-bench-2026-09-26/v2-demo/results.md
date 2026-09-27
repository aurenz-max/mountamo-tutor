# Detour bench (LA-15 D0) — raw results

Scores: obstacle/easier/representation/scope/usable, each 0-2.

```json
{
  "resolver": {
    "n": 10,
    "medianReadyMs": 5790,
    "maxReadyMs": 183035,
    "errors": 1,
    "targetsObstacle": 1.5,
    "easierOrPrerequisite": 1.2,
    "differentRepresentation": 1.6,
    "inScope": 1.6,
    "contentUsable": 1.4,
    "leaks": 0,
    "nonSingleMode": 0,
    "none": 0
  },
  "demo": {
    "n": 5,
    "medianReadyMs": 1281,
    "maxReadyMs": 1495,
    "errors": 0,
    "targetsObstacle": 2,
    "easierOrPrerequisite": 2,
    "differentRepresentation": 1,
    "inScope": 2,
    "contentUsable": 2,
    "leaks": 0,
    "nonSingleMode": 0,
    "none": 5
  },
  "demo+fallback": {
    "n": 10,
    "medianReadyMs": 5203,
    "maxReadyMs": 69572,
    "errors": 0,
    "targetsObstacle": 2,
    "easierOrPrerequisite": 1.7,
    "differentRepresentation": 1.5,
    "inScope": 2,
    "contentUsable": 1.8,
    "leaks": 0,
    "nonSingleMode": 0,
    "none": 0
  }
}
```

| scenario | arm | pick | mode | scores | leak | judge verdict |
|---|---|---|---|---|---|---|
| g1-cvc-blend | demo | ERR |  | — |  |  |
| g1-cvc-blend | resolver | phoneme-explorer | blend | 2/2/2/2/2 |  | Yes, this directly targets oral phoneme blending to help the student synthesize sounds before returning to blending printed letters in the reader. |
| g1-subtract-hops | demo | demo:number-line/subtract |  | 2/2/0/2/2 |  | Yes, a teacher would gladly use this worked demonstration to directly model that movement—not the starting number—is what gets counted. |
| g1-subtract-hops | resolver | annotated-example |  | 0/0/0/0/0 |  | No teacher could use this detour because no content was generated. |
| g2-main-idea | demo | ERR |  | — |  |  |
| g2-main-idea | resolver | comparison-panel |  | 2/2/2/2/2 |  | A teacher would readily use this side-by-side comparison to clarify the difference between an umbrella topic and a small supporting detail before sending the student back to the passage. |
| g2-regroup | demo | demo:place-value/make-a-ten |  | 2/2/1/2/2 |  | Yes, this demo directly targets the misconception that both digits can sit in the ones place by demonstrating bundling 14 ones into 1 ten and 4 ones. |
| g2-regroup | resolver | number-bond | ten_and_ones | 2/2/2/2/2 |  | This detour effectively targets the prerequisite place value understanding of teen numbers using an intuitive number bond representation. |
| g3-clock-minutes | demo | demo:clock/minutes-from-numeral |  | 2/2/1/2/2 |  | Yes, a teacher would immediately use this demonstration to show the student that numerals for the minute hand represent multiples of five rather than single minutes. |
| g3-clock-minutes | resolver | skip-counting-runner | count_along | 1/2/2/2/2 |  | This detour reviews counting by fives on a number line, but without explicitly mapping the clock hand's numbers (1 to 12) to those minutes, it misses the crucial bridge needed to fix the student's misconception. |
| g3-mult-groups | demo | ERR |  | — |  |  |
| g3-mult-groups | resolver | multiplication-explorer | build | 2/0/2/2/1 |  | While the representation of equal groups directly addresses the misconception, the numbers chosen (like 8x4 and 10x4) are too large and complex for a struggling student needing a simpler reset. |
| g4-compare-digits | demo | demo:place-value/compare |  | 2/2/1/2/2 |  | A teacher would immediately use this worked demo because it specifically confronts the student's belief that nines make a number larger regardless of place value. |
| g4-compare-digits | resolver | annotated-example |  | 2/1/2/2/2 |  | A solid detour that explicitly walks through comparing the largest place value first to counter the belief that having 9s makes a number bigger. |
| g4-fraction-add | demo | demo:number-line/add |  | 2/2/2/2/2 |  | Yes, this worked demo uses a clear number-line model to directly illustrate why adding fifths leaves the denominator unchanged without leaking the exact problem. |
| g4-fraction-add | resolver | number-line | jump | 0/0/0/0/0 |  | A teacher would reject this detour because it generates basic whole-number jump addition rather than fraction operations, completely missing the student's need to understand common denominators. |
| g5-particles | demo | ERR |  | — |  |  |
| g5-particles | resolver | custom-visual |  | 2/1/2/2/1 |  | This focused interactive visual is ideal for helping a student see that particles in a solid vibrate continuously in fixed positions rather than staying completely motionless. |
| k-count-tracking | demo | ERR |  | — |  |  |
| k-count-tracking | resolver | ten-frame | build | 2/2/2/2/2 |  | This is an excellent detour because the ten-frame visually enforces one-to-one placement to fix the student's double-counting habit. |
