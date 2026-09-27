# Detour bench (LA-15 D0) — raw results

Scores: obstacle/easier/representation/scope/usable, each 0-2.

```json
{
  "sandbox": {
    "n": 10,
    "medianReadyMs": 3416,
    "maxReadyMs": 4771,
    "errors": 0,
    "targetsObstacle": 0.7,
    "easierOrPrerequisite": 1.2,
    "differentRepresentation": 1.1,
    "inScope": 1.5,
    "contentUsable": 1.4,
    "leaks": 0,
    "nonSingleMode": 0
  },
  "resolver": {
    "n": 10,
    "medianReadyMs": 6123,
    "maxReadyMs": 130843,
    "errors": 0,
    "targetsObstacle": 1.7,
    "easierOrPrerequisite": 1.5,
    "differentRepresentation": 1.6,
    "inScope": 1.8,
    "contentUsable": 1.5,
    "leaks": 1,
    "nonSingleMode": 0
  }
}
```

| scenario | arm | pick | mode | scores | leak | judge verdict |
|---|---|---|---|---|---|---|
| g1-cvc-blend | resolver | phoneme-explorer | blend | 2/2/2/2/2 |  | A teacher would immediately use this auditory blending detour to help the student combine individual sounds into whole words before returning to print. |
| g1-cvc-blend | sandbox | phonics-blender | cvc | 2/2/2/2/2 |  | A teacher would immediately use this targeted blending detour to help the student bridge the gap between individual sounds and blended CVC words. |
| g1-subtract-hops | resolver | comparison-panel |  | 2/1/1/2/2 |  | Yes, a teacher would use this detour because it explicitly contrasts the student's exact counting error against the correct movement-based counting. |
| g1-subtract-hops | sandbox | number-line | jump | 1/1/0/2/2 |  | A teacher would likely not use this detour because it repeats the same number-line task without isolating the fencepost error or offering a concrete step-by-step movement representation. |
| g2-main-idea | resolver | comparison-panel |  | 2/2/2/2/2 |  | A teacher would definitely use this detour right now because it clearly contrasts a broad main idea from a specific detail using intuitive 2nd-grade metaphors. |
| g2-main-idea | sandbox | decodable-reader | main_idea | 1/1/1/2/2 |  | While the comprehension question contrasts a main idea with details, switching to an oral decodable reader adds phonics-decoding friction rather than directly scaffolding the comprehension concept. |
| g2-regroup | resolver | ten-frame | decompose_teen | 2/2/2/2/2 |  | This is an effective detour that grounds the student in seeing ten ones inside a teen number using a ten-frame before returning to regrouping. |
| g2-regroup | sandbox | base-ten-blocks | regroup | 0/0/1/1/1 |  | A teacher would not use this detour because it deals with decomposing 3-digit numbers rather than composing 10 ones into 1 ten to fix the 13 ones obstacle. |
| g3-clock-minutes | resolver | skip-counting-runner | predict | 1/2/2/2/2 | LEAK | This detour only practices rote skip counting without connecting clock numerals to 5-minute increments, and it directly computes the 20-minute mark from the original error. |
| g3-clock-minutes | sandbox | number-line | jump | 0/1/2/1/1 |  | A teacher would not use this detour because it practices arbitrary single-digit addition jumps rather than skip-counting by 5s to understand clock minute markings. |
| g3-mult-groups | resolver | multiplication-explorer | build | 2/1/2/2/1 |  | This detour helps illustrate equal groups versus addition, but contains overly difficult facts like 6 x 8 that distract from addressing the core conceptual hurdle. |
| g3-mult-groups | sandbox | counting-board | group | 1/2/2/0/0 |  | A teacher would not use this detour because the generated content is mathematically incorrect, stating that 4 groups of 3 totals 9 or 6. |
| g4-compare-digits | resolver | annotated-example |  | 2/2/1/2/1 |  | A teacher would use this worked example because it specifically addresses the misconception that high digits override the thousands place, despite the problem statement being worded awkwardly. |
| g4-compare-digits | sandbox | place-value-chart | compare | 0/1/0/2/1 |  | A teacher would not use this detour because it repeats isolated place-value identification instead of helping the student compare two numbers by their highest place value. |
| g4-fraction-add | resolver | number-line | jump | 0/0/0/0/0 |  | A teacher would reject this immediately because it generates whole-number addition jumps instead of fractions, failing to address the fraction denominator misconception entirely. |
| g4-fraction-add | sandbox | fraction-circles | build | 0/2/2/1/2 |  | No teacher would use this detour because it only practices building isolated unit/simple fractions and does not address why adding fifths leaves the denominator unchanged. |
| g5-particles | resolver | custom-visual |  | 2/1/2/2/1 |  | A teacher would use this focused visual of solid particle vibration to clear up the misconception, provided the truncated HTML is repaired. |
| g5-particles | sandbox | states-of-matter | observe | 0/1/0/2/1 |  | A teacher would not use this detour because the generated questions merely ask to name the state of matter instead of confronting the misconception that particles in solids are completely still. |
| k-count-tracking | resolver | ten-frame | build | 2/2/2/2/2 |  | Yes, using structured placement on a ten-frame provides the exact spatial grounding needed to fix skipping and double-counting. |
| k-count-tracking | sandbox | counting-board | recount_moved | 2/1/1/2/2 |  | A teacher would use this detour because the linear arrangement and highlight-on-tap feature directly scaffold one-to-one correspondence and prevent double counting. |
