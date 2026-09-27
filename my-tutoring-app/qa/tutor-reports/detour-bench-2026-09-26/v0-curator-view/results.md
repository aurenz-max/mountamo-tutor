# Detour bench (LA-15 D0) — raw results

Scores: obstacle/easier/representation/scope/usable, each 0-2.

```json
{
  "sandbox": {
    "n": 10,
    "errors": 0,
    "targetsObstacle": 1,
    "easierOrPrerequisite": 1.5,
    "differentRepresentation": 1.1,
    "inScope": 1.6,
    "contentUsable": 1.6,
    "leaks": 0,
    "nonSingleMode": 0
  },
  "resolver": {
    "n": 10,
    "errors": 0,
    "targetsObstacle": 1.7,
    "easierOrPrerequisite": 1.6,
    "differentRepresentation": 1.9,
    "inScope": 2,
    "contentUsable": 1.5,
    "leaks": 0,
    "nonSingleMode": 6
  }
}
```

| scenario | arm | pick | mode | scores | leak | judge verdict |
|---|---|---|---|---|---|---|
| g1-cvc-blend | resolver | phonics-blender | cvc | 2/2/2/2/2 |  | A teacher would immediately use this targeted blending detour to help the student transition from isolated phoneme pronunciation to smoothly blending CVC words. |
| g1-cvc-blend | sandbox | phonics-blender | cvc | 2/2/2/2/2 |  | This is an ideal detour that isolates phoneme blending with interactive audio support before returning to full decodable text reading. |
| g1-subtract-hops | resolver | annotated-example |  | 2/1/1/2/1 |  | A teacher would find the side-by-side comparison of the misconception versus actual jumps highly effective, though they would need to look past the prompt text leaking into the problem statement. |
| g1-subtract-hops | sandbox | number-line | jump | 1/1/0/2/2 |  | This keeps the student on the same tool without effectively highlighting why counting the starting point is incorrect. |
| g2-main-idea | resolver | comparison-panel |  | 2/2/2/2/2 |  | Yes, this detour uses an effective concrete metaphor to help a Grade 2 student distinguish between the big overarching idea and a supporting detail. |
| g2-main-idea | sandbox | decodable-reader | main_idea | 1/2/1/2/2 |  | While the question nicely contrasts a central idea against specific details using simpler text, a decodable-reader detour adds unnecessary oral-decoding overhead to address a purely conceptual comprehension obstacle. |
| g2-regroup | resolver | ten-frame | build_teen|decompose_teen | 2/2/2/2/2 |  | This detour directly addresses the student's misconception by using a double ten-frame to show that teen numbers consist of a full ten and leftover ones. |
| g2-regroup | sandbox | base-ten-blocks | regroup | 2/2/1/2/2 |  | A teacher would use this detour because it isolates the physical action of trading 10 ones for 1 ten before returning to the written algorithm. |
| g3-clock-minutes | resolver | skip-counting-runner | count_along|predict | 1/2/2/2/1 |  | This detour practices counting by 5s on a number line, but misses linking the specific clock numeral to the number of 5-minute hops. |
| g3-clock-minutes | sandbox | number-line | jump | 0/1/2/1/1 |  | A teacher would not use this detour because jumping by 5 starting from 6, 9, or 12 does not help the student learn that clock numerals represent multiples of 5 minutes. |
| g3-mult-groups | resolver | multiplication-explorer | build | 2/1/2/2/1 |  | A teacher might hesitate because the numbers abruptly escalate to 8x6 and 3x7, but the early prompts effectively reinforce equal groups over simple addition. |
| g3-mult-groups | sandbox | counting-board | group | 1/2/2/1/1 |  | A teacher would not use this detour because it drops down to a Grade 1 counting activity that doesn't explicitly link groups back to multiplication factors or address 4 x 3. |
| g4-compare-digits | resolver | comparison-panel |  | 2/1/2/2/2 |  | A teacher would immediately use this comparison panel because it directly exposes and corrects the misconception that larger lower-place digits outweigh the leading place value. |
| g4-compare-digits | sandbox | place-value-chart | compare | 1/1/0/1/1 |  | A teacher would not use this detour because it reviews isolated place identification instead of actively comparing two numbers to address the 'bigger digits win' misconception. |
| g4-fraction-add | resolver | fraction-circles | build | 0/2/2/2/2 |  | No teacher would use this detour right now because it only has students shade single fractions rather than addressing or illustrating fraction addition. |
| g4-fraction-add | sandbox | fraction-circles | build | 0/1/2/1/2 |  | No teacher would use this detour because it completely omits addition and fails to address the misconception of adding denominators. |
| g5-particles | resolver | custom-visual |  | 2/1/2/2/0 |  | The detour cannot be used because the HTML/JS content is truncated mid-CSS and completely broken. |
| g5-particles | sandbox | states-of-matter | observe | 0/1/0/2/1 |  | A teacher would not use this detour because the generic state-naming challenges fail to address the misconception that particles in solids are completely motionless. |
| k-count-tracking | resolver | ten-frame | build | 2/2/2/2/2 |  | A teacher would immediately use this structured ten-frame build activity to anchor one-to-one correspondence and physical tracking. |
| k-count-tracking | sandbox | counting-board | count | 2/2/1/2/2 |  | Yes, starting with smaller sets arranged in a clean line with tap highlighting directly scaffolds tracking and one-to-one correspondence. |
