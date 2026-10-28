"""Build the Grade 2 Math curriculum design review: manifests, bundle, briefs, HTML.

Run from anywhere: python build.py. Reads sample.json, catalog.json and evidence/*.json
from this directory; writes manifests/, briefs/, manifest-bundle.json and index.html.
The lesson decisions below are authored review content, not generated.
"""
import hashlib
import html
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
sample = json.loads((HERE / 'sample.json').read_text(encoding='utf-8'))
catalog = {p['id']: p for p in json.loads((HERE / 'catalog.json').read_text(encoding='utf-8'))}
published = {s['id']: (g, s) for g in sample['selected'] for s in g['selectedSubskills']}
SUBJECT, GRADE, GRADE_LABEL, RUN = 'MATHEMATICS', '2', 'Grade 2', 'math-g2-2026-10-27'
LUMINA = 'my-tutoring-app/src/components/lumina/'

# ---------------------------------------------------------------------------
# Probe evidence: one draw per binding at grade 2, difficulty medium, judged by
# reading the payload. verdict: usable | partial | unfit | defect
# ---------------------------------------------------------------------------
PROBES = {
    ('OPS002-03-a', 'tape-diagram', 'solve_part_whole'): ('partial',
        'Bars of four parts with "Total = 51" and two parts unknown (9 + 7 + ? + ? = 51). No story: only labels and numbers. It practises parts and totals, not a two-step story.'),
    ('OPS002-03-a', 'tape-diagram', 'multi_step'): ('unfit',
        'Three two-step stories within 100, every one with a subtraction step ("had 38, gave 28, received 56"). The generator forces one + and one − into every chain, so an addition-only two-step story cannot be drawn.'),
    ('OPS002-03-c', 'tape-diagram', 'solve_comparison'): ('partial',
        'Four one-step compare stories within 100; the unknown is the larger amount, the smaller amount, or uses "more" with a subtraction ("Emma read 77 more pages than Noah"). Good compare practice, but one step only.'),
    ('OPS002-03-c', 'tape-diagram', 'multi_step'): ('partial',
        'Two-step change stories (+ then −, − then +). None has a comparison or an unknown amount being compared.'),
    ('OPS002-04-a', 'addition-fact-strategies', 'doubles'): ('usable',
        'Six doubles from code: 4+4, 6+6, 8+8, 2+2, 5+5, 7+7. Tap the sum on a 0-18 pad or say it.'),
    ('OPS002-04-a', 'addition-fact-strategies', 'big_facts'): ('partial',
        'facts_mixed: 7+4, 9+5, 4+6, 4+7, 6+4, 4+8. Sums to 18 and correct, but no near-doubles; nothing ties these facts to the doubles strategy the objective names.'),
    ('OPS002-04-a', 'di-math-facts', 'answer_fact'): ('usable',
        'Exactly the objective\'s facts, seeded from its text: 9+9, 8+7, 6+6, 5+9, 9+6. Spoken answer judged by the tutor. Needs a microphone.'),
    ('OPS002-04-c', 'math-fact-fluency', 'equation_solve'): ('usable',
        'Six facts within 20 from the add-sub-20 space, two of them subtraction (15−5, 17−13) and four addition. Options are the answer and its neighbours (±1, ±2). The mix is incidental, not balanced. Payload gradeBand is "1".'),
    ('OPS002-04-c', 'di-math-facts', 'subtraction_fact'): ('defect',
        'Served 8−3, 9−5, 9−8, 7−4, 7−5: all within 10, although the objective text says within 20 and lists 18−9, 15−7 and 14−5.'),
    ('OPS002-01-a', 'regrouping-workbench', 'add_no_regroup'): ('partial',
        'Code-owned: 22+27, 43+51, 40+55, 40+26, none needing a carry. The numbers fit. The source review found the starting board already shows the sum (3 tens / 6 ones for 24+12) and credit is the typed digits only.'),
    ('OPS002-01-c', 'di-word-problem-setup', 'build_family'): ('partial',
        'maxNumber resolved to 100 from the objective text. Three stories: part-whole 15 and 13, compare 9 and 6, change-loss 67 and 19. Two of three are subtraction stories and two use numbers under 20.'),
    ('OPS002-02-a', 'regrouping-workbench', 'subtract_no_regroup'): ('usable',
        'Code-owned: 97−94, 69−27, 58−48, 66−20, none needing a borrow. The blocks show only the top number; nothing is taken away (source review).'),
    ('OPS002-02-b', 'regrouping-workbench', 'subtract_regroup'): ('partial',
        'Code-owned: 71−12, 91−16, 60−42, 50−13, each with one borrow, including zero in the ones. The Borrow button shows one ten breaking into ten ones, but the trade is not required for credit.'),
    ('OPS002-02-b', 'base-ten-blocks', 'regroup'): ('unfit',
        'Three-digit numbers (575, 763, 248, 557) with a hundreds column and "showBlocksTotal": true, for a within-100 grade 2 objective. It trades on one number; no subtraction.'),
    ('MEAS002-04-b', 'analog-clock', 'set_time'): ('partial',
        'Code-owned: 1:45, 4:50, 5:15, 12:15, 11:45, "Set the clock to H:MM." No a.m. or p.m. anywhere. Payload gradeBand "3-5" for a grade 2 request.'),
    ('MEAS002-04-b', 'time-sequencer', 'time-of-day'): ('defect',
        'Morning/afternoon/evening/night taps for party events. Every instruction says "Set your clock to 7:00 a.m. and choose when this happens!" in a mode that has no clock to set, and the printed time gives away the period.'),
    ('MEAS002-04-c', 'time-sequencer', 'sequence-5'): ('partial',
        'Five sets of 4 cards (never 5). Every instruction says "Read the time on each card, earliest to latest", but the medium tier hides card times (gemini-time-sequencer.ts:209), so the instruction refers to something that is not on screen. When times show (easy), ordering becomes reading clock times.'),
    ('MEAS002-04-c', 'timeline-builder', 'sequence-daily'): ('usable',
        'Four days of 5 events each (school day, weekend, camp, rainy day), Morning-to-Night scale. Descriptions are neutral ("Clean your teeth with toothpaste"). The bank never starts in order.'),
}


def binding(cid, mode, title, intent, role, difficulty=None):
    return {'componentId': cid, 'mode': mode, 'title': title, 'intent': intent, 'role': role, 'difficulty': difficulty}

# ---------------------------------------------------------------------------
# Lessons (authored). Each binding uses a current catalog id + eval mode.
# ---------------------------------------------------------------------------
LESSONS = [
  dict(id='OPS002-03-a', title='Two Steps, Both Adding', verb='solve',
    action='Read a story where an amount grows twice (12 birds, 12 more land, then 4 more), draw it as one tape with three parts, and find the total.',
    sequence=[
      binding('tape-diagram', 'solve_part_whole', 'Parts Make the Whole',
              'Grade 2. Tapes of three parts with the total; find the missing part or the total. Values within 100.', 'introduction (reading a tape)', 'medium'),
      binding('tape-diagram', 'multi_step', 'Two-Step Stories',
              'Grade 2 two-step stories within 100, solved one step at a time on the tape.', 'practice (two-step, mixed operations)', 'medium'),
      binding('tape-diagram', 'multi_step', 'New Two-Step Stories',
              'Grade 2, fresh two-step stories within 100.', 'fresh review', 'hard'),
    ],
    minutes=15,
    evidence=['Solves each step of a two-step story on the tape (tape-diagram multi_step). Every story contains a subtraction step, so this is near-transfer practice, not the objective.',
              'Solving a two-step story where both steps add. NOT available: no mode generates an add-then-add chain.'],
    limits=['multi_step forces one + and one − into every chain (gemini-tape-diagram.ts:112-114); with a tier, the two-step item space lists only +− and −+ and stops at 20 (itemSpace/addSub20.ts:128-137).',
            'solve_part_whole has no story; it is a labelled bar (probe).',
            'The student never builds the tape; code draws it and the child types values.',
            'Source-inferred: the attempt count is recorded one lower than real, so one wrong answer per challenge is free (TapeDiagram.tsx:513-518).'],
    decision='new-mode', decisionText='Add two-step stories with a chosen operation pattern to tape-diagram, including add-then-add within 100. Shared with OPS002-03-c. See brief 1.'),
  dict(id='OPS002-03-c', title='Compare in Two Steps', verb='solve',
    action='Combine two amounts, then compare the result with a third ("Tia has 20 red and 5 blue beads. She has 10 more than Sam. How many does Sam have?"), placing the unknown wherever the story puts it.',
    sequence=[
      binding('tape-diagram', 'solve_comparison', 'How Many More?',
              'Grade 2 compare stories within 100; the unknown may be the difference, the bigger amount or the smaller amount.', 'introduction (one-step compare)', 'medium'),
      binding('tape-diagram', 'multi_step', 'Two Steps on the Tape',
              'Grade 2 two-step stories within 100.', 'practice (two-step change)', 'medium'),
      binding('tape-diagram', 'solve_comparison', 'Compare Again',
              'Grade 2, fresh compare stories within 100, including "more" stories that need subtraction.', 'fresh review', 'hard'),
    ],
    minutes=15,
    evidence=['Solves one-step compare stories with the unknown in any of three places (solve_comparison).',
              'Solving a two-step compare story. NOT available: solve_comparison is one step and multi_step never compares.'],
    limits=['The two parts of the objective (combine, then compare) are taught in separate activities and never put together in one story.',
            'solve_comparison widths are proportional even for the unknown; a small cue when the difference is unknown (TapeDiagram.tsx:870).',
            'Easy/medium hints name the operation after a wrong answer.'],
    decision='new-mode', decisionText='Same tape-diagram extension as OPS002-03-a: a two-step pattern whose second step is a comparison with the unknown in any position. See brief 1.'),
  dict(id='OPS002-04-a', title='Doubles and Near Doubles', verb='recall',
    action='Say or tap sums to 20 without counting, starting from doubles (6+6) and using them for near doubles (6+7 is one more than 6+6).',
    sequence=[
      binding('addition-fact-strategies', 'doubles', 'Double It',
              'Grade 2 doubles to 9+9.', 'introduction + practice', 'medium'),
      binding('di-math-facts', 'answer_fact', 'Say the Sum',
              'Grade 2 addition facts within 20, doubles and near doubles: 9+9, 8+7, 6+6, 5+9, 7+8, 9+6, 4+9, 8+8.', 'main retrieval practice (spoken)'),
      binding('addition-fact-strategies', 'big_facts', 'Big Facts Review',
              'Grade 2 sums from 11 to 18.', 'fresh review', 'hard'),
    ],
    minutes=14,
    evidence=['Says the sum of each named double or near double the first time (di-math-facts, tutor-judged; first-response score).',
              'Taps the sum of doubles without counting (addition-fact-strategies, scored 100/50/25 by try).',
              'Using a double to work out a near double. NOT assessed: no near-doubles family; the near double exists only as a help lever.'],
    limits=['No timer anywhere, which matches the no-timer ruling for fact fluency; response time is recorded silently and never scored. The curriculum\'s "timed mode" is not built and should not be.',
            'big_facts drew no near doubles (probe).',
            'di-math-facts "doubles" objectives stop at 5+5 unless the facts are named in the text (gemini-di-math-facts.ts:292). The intent above names them for that reason.'],
    decision='new-mode', decisionText='Add a near-doubles family to addition-fact-strategies: a double shown, then its neighbour, with credit for the near double. See brief 2.'),
  dict(id='OPS002-04-c', title='Plus or Minus, Facts to 20', verb='recall',
    action='Answer a shuffled set of addition and subtraction facts within 20 (8+7, 15−6, 18−9) without counting.',
    sequence=[
      binding('math-fact-fluency', 'equation_solve', 'Plus or Minus?',
              'Grade 2 mixed addition and subtraction facts within 20, about half of each, in random order.', 'main practice', 'medium'),
      binding('di-math-facts', 'subtraction_fact', 'Say the Difference',
              'Grade 2 subtraction facts within 20: 18−9, 15−7, 12−6, 14−5, 16−8, 13−6, 11−4, 17−9.', 'spoken practice'),
      binding('math-fact-fluency', 'equation_solve', 'Mixed Facts Check',
              'Grade 2, fresh mixed facts within 20; no fact from the earlier set.', 'fresh review', 'hard'),
    ],
    minutes=13,
    evidence=['Picks the right answer to mixed facts within 20 (math-fact-fluency). Credit is retry-until-correct; only the runner\'s first-response score separates recall from guessing among four adjacent options.',
              'A balanced random mix of + and −. NOT guaranteed: the probe served 2 subtraction out of 6.'],
    limits=['subtraction_fact served facts within 10 for a within-20 objective (probe).',
            'math-fact-fluency catalog text still says "within 3, 5, or 10" and K-1 (catalog/math.ts:2769-2770); a Grade 2 child sees a "Grade 1" badge.',
            'Source: visual_fact draws the total as dots and match distractors are always "+". These modes are left out of this lesson for that reason.',
            'Source: in the stepper modes, measured response time includes the taps, so it is not a fluency signal.'],
    decision='repair', decisionText='Repair math-fact-fluency for Grade 2 mixed sets (balanced operations, grade label, leaks) and the di-math-facts subtraction ceiling. See brief 5.'),
  dict(id='OPS002-01-a', title='Tens with Tens, Ones with Ones', verb='apply',
    action='Add two two-digit numbers with no carry (43+51) by putting tens with tens and ones with ones, on blocks and in the written column.',
    sequence=[
      binding('regrouping-workbench', 'add_no_regroup', 'Add the Columns',
              'Grade 2, two two-digit numbers, no carrying. Build both numbers before writing the answer.', 'introduction + practice', 'medium'),
      binding('regrouping-workbench', 'add_no_regroup', 'Fresh Sums',
              'Grade 2, fresh two-digit sums with no carrying.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Types the correct sum in each column (regrouping-workbench).',
              'Combining tens and ones on the blocks. NOT assessed: the board starts showing the sum, and credit is the typed digits.'],
    limits=['The starting blocks for addition are each column\'s sum, with the count as a large numeral (regroupingWorkbenchWorkspace.ts:46, RegroupingWorkbench.tsx:724-729). The answer is on screen before the child acts.',
            'The easy tier draws two-digit ± one-digit problems (51+3) from the bottom-third fallback (itemSpace/index.ts:89-99; recorded in qa/difficulty-demo/2026-10-13/rw/). This lesson pins medium and hard for that reason.',
            'Probe numbers fit: 22+27, 43+51, 40+55, 40+26.'],
    decision='repair', decisionText='Repair regrouping-workbench so the blocks start as the two addends and the child makes the combined model. Shared with OPS002-02-a and 02-b. See brief 3.'),
  dict(id='OPS002-01-c', title='Adding Stories to 100', verb='solve',
    action='Hear a story with two amounts, decide that it is an adding story, and find the total within 100 (Leo picked 47 apples and 14 more).',
    sequence=[
      binding('di-word-problem-setup', 'build_family', 'Build the Story',
              'Grade 2 one-step addition stories within 100 (two-digit numbers): put the numbers in the family, say add or subtract, then say the total.', 'introduction + practice (spoken)'),
      binding('di-word-problem-setup', 'build_family', 'New Stories',
              'Grade 2, fresh one-step stories within 100 with two-digit numbers.', 'fresh review (spoken)'),
    ],
    minutes=13,
    evidence=['Chooses the operation from the number family and says the answer (di-word-problem-setup; each step is judged).',
              'An addition-only set within 100. NOT controllable: the session rotates comparison, change and part-whole frames including subtraction (gemini-di-word-problem-setup.ts:282-297).'],
    limits=['The curriculum\'s target, addition-subtraction-scene, cannot serve this: spoken answers and items are capped at 20 and the grade band is forced to K or 1.',
            'Probe: two of three stories were subtraction and two used numbers under 20, although maxNumber was 100.',
            'Spoken numbers above 20 use a number-word class the code calls build-ahead (diWordProblemModes.ts:63). Needs a Live check before relying on it.',
            'Needs a microphone and the live tutor; there is no tap fallback for this objective at 100.'],
    decision='repair', decisionText='Let a lesson ask di-word-problem-setup for addition stories only and for two-digit numbers, and confirm spoken answers 21-100. No brief: a queue item for the owning primitive.'),
  dict(id='OPS002-02-a', title='Take Away Tens and Ones', verb='apply',
    action='Subtract a two-digit number with no borrow (69−27) by taking away tens from tens and ones from ones.',
    sequence=[
      binding('regrouping-workbench', 'subtract_no_regroup', 'Take Away the Columns',
              'Grade 2, two-digit minus two-digit, no borrowing.', 'introduction + practice', 'medium'),
      binding('regrouping-workbench', 'subtract_no_regroup', 'Fresh Differences',
              'Grade 2, fresh two-digit differences with no borrowing.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Types the correct difference in each column (regrouping-workbench).',
              'Taking the second number away on the blocks. NOT available: blocks show the first number only and nothing is removed.'],
    limits=['Without a tier, Gemini writes the problems and only the range is checked, so a borrow can appear (source). This lesson sets a tier.',
            'Easy draws two-digit minus one-digit (same fallback as OPS002-01-a).'],
    decision='repair', decisionText='Same regrouping-workbench repair: the child removes the subtrahend on the blocks. See brief 3.'),
  dict(id='OPS002-02-b', title='Break a Ten to Subtract', verb='apply',
    action='Subtract when there are not enough ones (52−27): break one ten into ten ones, then take away tens and ones.',
    sequence=[
      binding('base-ten-blocks', 'regroup', 'Trade a Ten',
              'Grade 2, two-digit numbers only (within 99). Break one ten into ten ones and say how many tens and ones there are now.', 'introduction (the trade)'),
      binding('regrouping-workbench', 'subtract_regroup', 'Borrow and Subtract',
              'Grade 2 two-digit subtraction with one borrow, including a zero in the ones (70−24).', 'main practice', 'medium'),
      binding('regrouping-workbench', 'subtract_regroup', 'Fresh Borrowing',
              'Grade 2, fresh two-digit subtraction with one borrow.', 'fresh review', 'hard'),
    ],
    minutes=15,
    evidence=['Types the correct difference for problems that need a borrow (regrouping-workbench).',
              'Breaking the ten before subtracting. Visible but NOT required: the Borrow button is optional, and the trade is recorded as a metric only.'],
    limits=['base-ten-blocks regroup drew three-digit numbers with a running total shown (probe), so the trade intro is out of scope for this grade unless the intent is followed.',
            'Probe numbers fit: 71−12, 91−16, 60−42, 50−13.',
            'The subtrahend is never taken away on the blocks.'],
    decision='repair', decisionText='Same regrouping-workbench repair: the trade and the take-away are part of what earns credit. See brief 3.'),
  dict(id='MEAS002-04-b', title='Morning or Night? Set the Clock', verb='apply',
    action='Hear an event ("bedtime, 7:30"), decide whether it is a.m. or p.m., and set the clock hands to the time.',
    sequence=[
      binding('time-sequencer', 'time-of-day', 'Morning, Afternoon or Night?',
              'Grade 2 daily events; choose the part of the day. Do not print a clock time on the card.', 'introduction (parts of the day)', 'medium'),
      binding('analog-clock', 'set_time', 'Set the Clock',
              'Grade 2, set the hands to times at five-minute intervals.', 'practice (setting hands)', 'medium'),
      binding('knowledge-check', 'recall', 'A.M. or P.M.?',
              'Grade 2. Name a daily event and a clock time (eat breakfast at 7:15; go to bed at 8:00; lunch at 12:15) and ask whether it is a.m. or p.m. Options: a.m., p.m.', 'independent check (tap, not probed)'),
    ],
    minutes=14,
    evidence=['Sets the hands to a given five-minute time (analog-clock).',
              'Says a.m. or p.m. for an event (knowledge-check, unprobed).',
              'Setting the clock AND choosing a.m./p.m. for one event. NOT available: no clock mode has a.m./p.m.'],
    limits=['ClockChallenge has only targetHour 1-12 and targetMinute; scoring is hour mod 12 and minute (AnalogClock.tsx:39-80, :824-828).',
            'The timeline scrubber stays live in set_time, so a child can slide a bar instead of turning the hands (AnalogClock.tsx:1170-1181).',
            'The day/night strip spaces 24-hour sun and moon icons over a 12-hour slider, so "12 PM" sits at 6:00 (AnalogClock.tsx:123-132, :478-480).',
            'time-of-day instructions told the child to set a clock that is not there and printed the time (probe).',
            'Only the minute hand is draggable; the hour hand follows, so its position between numbers is never assessed.'],
    decision='new-mode', decisionText='An a.m./p.m. setting mode in analog-clock, with the scrubber and day strip fixed. See brief 4.'),
  dict(id='MEAS002-04-c', title='My Day in Order', verb='sequence',
    action='Put 4-5 everyday events in order from morning to night and say why one comes before another (homework before dinner).',
    sequence=[
      binding('timeline-builder', 'sequence-daily', 'Build My Day',
              'Grade 2, five everyday events per day (school day, weekend, rainy day) on a morning-to-night line. No clock times on cards.', 'introduction + practice', 'medium'),
      binding('time-sequencer', 'sequence-5', 'What Comes Next?',
              'Grade 2, five events per set ordered by reasoning about the day. Do not print or mention clock times.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Places every event in the right slot of a daily timeline (timeline-builder).',
              'Orders a fresh set without time cues (time-sequencer at hard, which withdraws card times).',
              'Saying why. Only through the tutor; no scored reason step.'],
    limits=['time-sequencer instructions said "Read the time on each card" while the medium tier hides times (probe). Hard was chosen because it withdraws times and prelabels nothing; its instruction text is still Gemini-written.',
            'sequence-5 probe returned 4 cards in every set; nothing enforces 5 (gemini-time-sequencer.ts:708).',
            'time-sequencer shuffles with no guard against an already-sorted start (TimeSequencer.tsx:762-770); timeline-builder does guard.'],
    decision='reuse', decisionText='Reuse timeline-builder. Queue the time-sequencer fixes (instruction vs tier, 5-card check, shuffle guard) for the owning primitive.'),
]

ISSUES = [
    ('regrouping-workbench', 'add_no_regroup starts with the sum on the blocks and as column numerals.', 'source', 'regroupingWorkbenchWorkspace.ts:46; RegroupingWorkbench.tsx:724-729'),
    ('regrouping-workbench', 'Easy tier draws two-digit ± one-digit problems for "two two-digit numbers" objectives.', 'recorded run', 'service/itemSpace/index.ts:89-99; qa/difficulty-demo/2026-10-13/rw/'),
    ('regrouping-workbench', 'Credit is the typed digits; trades are never checked, the subtrahend is never removed.', 'source', 'regroupingWorkbenchWorkspace.ts:105-107, :44-47'),
    ('analog-clock', 'set_time scrubber bypasses hand setting; day strip maps 24-hour icons onto a 12-hour slider.', 'source', 'AnalogClock.tsx:1170-1181, :123-132, :478-488'),
    ('analog-clock', 'Payload gradeBand "3-5" for a grade 2 request; catalog says G1-2 quarter-hour, item space uses 5-minute.', 'probe + source', 'catalog/math.ts:3014; analogClockItemSpace.ts:30-38'),
    ('time-sequencer', 'time-of-day instructions say "Set your clock to …" (no clock in the mode) and print the time.', 'probe', 'evidence/MEAS002-04-b-time-sequencer-time-of-day.json'),
    ('time-sequencer', 'sequence-5: instruction says read card times while medium hides them; 4 cards every set; no sorted-start guard.', 'probe + source', 'gemini-time-sequencer.ts:209, :708; TimeSequencer.tsx:762-770'),
    ('di-math-facts', 'subtraction_fact served within-10 facts for a within-20 objective that lists 18−9.', 'probe', 'evidence/OPS002-04-c-di-math-facts-subtraction_fact.json'),
    ('di-math-facts', 'Catalog claims response time is captured; the component sends meanResponseMs: null.', 'source', 'catalog/di.ts:96; DiMathFacts.tsx:215-222'),
    ('math-fact-fluency', 'visual_fact draws the total as dots; match distractors always "+"; Grade 2 shown "Grade 1"; catalog text says within 10.', 'source', 'gemini-math-fact-fluency.ts:678, :741; MathFactFluency.tsx:80; catalog/math.ts:2769'),
    ('tape-diagram', 'multi_step cannot produce a same-operation chain (always one + and one −).', 'probe + source', 'gemini-tape-diagram.ts:112-114; itemSpace/addSub20.ts:128-137'),
    ('tape-diagram', 'Attempt count read before increment (one wrong answer free); represent ignores the tier bracket.', 'source (inferred)', 'TapeDiagram.tsx:513-518, :942'),
    ('di-word-problem-setup', 'Cannot pin addition-only stories; small numbers appear in within-100 sessions.', 'probe + source', 'gemini-di-word-problem-setup.ts:282-297'),
    ('base-ten-blocks', 'regroup drew three-digit numbers with a running total for a grade 2 within-100 objective.', 'probe', 'evidence/OPS002-02-b-base-ten-blocks-regroup.json'),
]

# ---------------------------------------------------------------------------
# Briefs (authored). Each stands alone for a new session.
# ---------------------------------------------------------------------------
def curr(ids):
    out = []
    for i in ids:
        g, s = published[i]
        out.append(f"- **{i}** ({g['skill']['id']} {g['skill']['description']}): {s['description']}")
    return '\n'.join(out)

HANDOFF = ('**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive\'s contract in '
           '`docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, '
           'architecture, mode naming, generator approach and build order are yours to choose. Deliver the working '
           'capability with the verification those skills require, and recheck the observations below against the code first: '
           'they describe the code on 2026-10-27 (commit {commit}).')

BRIEFS = [
  dict(slug='1-two-step-tape-diagrams', title='Two-step tape-diagram stories with a chosen operation pattern', kind='new-mode',
    ids=['OPS002-03-a', 'OPS002-03-c'],
    body='''## Learning goal and gap
Grade 2 students solve two-step word problems within 100 by drawing the story as a tape and solving one step at a time. The curriculum asks for two patterns that Lumina cannot produce today:
- both steps add (12 birds, 12 more land, then 4 more);
- combine two amounts, then compare with a third, with the unknown in different places.

`tape-diagram` `multi_step` is the closest tool. In this review its probe drew three stories, each with one addition and one subtraction step, and the source forces that mix for every chain. With a tier, the two-step item space lists only +− and −+ and stops at 20. `solve_comparison` compares well (the unknown can be the difference, the larger or the smaller amount) but only for one step. Recommendation: extend tape-diagram rather than build a new primitive; the representation and the step-by-step solve already exist.

## Essential behavior
- The student works through one story with two steps, using the result of step one in step two.
- A lesson can ask for a pattern: add-add, add-subtract (either order), or combine-then-compare. Within the compare pattern the unknown can be the combined amount, the compared amount, or the difference.
- Code owns the numbers and answers, within 100 at Grade 2.
- The tape for step two is built from step one, so the child sees why the first answer matters.
- Suggestion: let the student choose or build the step-two bar rather than seeing it finished; the curriculum names "step-by-step logic input".

## Worked example
"Tia has 20 red beads and 5 blue beads. She has 10 more beads than Sam. How many beads does Sam have?"
Step 1: 20 + 5 = 25 (Tia's total). Step 2: 25 − 10 = 15 (Sam).
Misconception: the child sees "more" and adds, 25 + 10 = 35. A second one: the child skips step 1 and compares 20 with 10.

## Evidence of success
- Independent: the right value at each step on a fresh story of the requested pattern, first try.
- Supported: hints that name the operation (the current easy/medium behaviour) mark the item as supported.
- No credit for a final answer typed without step one, if the design records steps.
- Uncertain: "more" with subtraction is the hard case; treat it as a structural difficulty level, not an error in the item.

## Constraints and open questions
- Grade 2, within 100; regrouping allowed.
- Observation to recheck: segment widths are proportional even for the unknown, which hints when the difference is unknown.
- Observation to recheck: the attempt count may be recorded one low (TapeDiagram.tsx:513-518), which would make first-try evidence wrong for this mode too.
- Open: whether add-add is a new mode or a pattern option on multi_step.
'''),
  dict(slug='2-near-doubles-family', title='Near-doubles family for addition facts', kind='new-mode',
    ids=['OPS002-04-a'],
    body='''## Learning goal and gap
Grade 2 students recall addition facts to 20, with doubles (6+6) and near doubles (6+7, 8+7) as the named focus. `addition-fact-strategies` already teaches doubles from a code-owned pool and has a near double only as a help lever. Its `big_facts` probe drew 7+4, 9+5, 4+6: correct but not near doubles. `di-math-facts` will ask named near doubles aloud, but only when the objective lists them, and nothing teaches the step from the double to its neighbour.

Recommendation: a near-doubles family in `addition-fact-strategies`, which already has the families-of-facts structure, the 0-18 pad and the try-weighted score.

## Essential behavior
- The child meets a double and then its neighbour (6+6, then 6+7), and later the near double alone.
- Teaching shows the near double as the double plus or minus one. Suggestion: a picture of two equal rows with one extra counter.
- Both orders appear (7+6 and 6+7).
- Later items show the near double with no double beside it.

## Worked example
"7 + 8 = ?" A good response: "15, because 7 + 7 is 14 and one more is 15."
Misconception: answering 14 (the double, forgetting the extra one) or 16 (doubling the larger number without subtracting one).

## Evidence of success
- Independent: correct first try on near doubles shown without their double.
- Supported: correct after the double is shown.
- 14 for 7+8 and 16 for 7+8 are diagnostic wrong answers worth recording as such.
- No timer. Project ruling: no timer on fact fluency. Response time may be recorded but should not set credit.

## Constraints and open questions
- Sums to 18 with one-digit addends; the curriculum examples include 9+9 and 4+9.
- Open: does a near double include ±2 (6+8)? The curriculum examples are ±1 only.
'''),
  dict(slug='3-regrouping-workbench-model-evidence', title='Regrouping workbench: the blocks do the work', kind='repair',
    ids=['OPS002-01-a', 'OPS002-02-a', 'OPS002-02-b'],
    body='''## Learning goal and gap
Grade 2 students add and subtract two-digit numbers with place-value blocks: without regrouping, and subtraction by breaking a ten into ten ones. `regrouping-workbench` is the curriculum's target and its numbers fit (probe: 22+27, 69−27, 71−12, 60−42). Three things stop it from teaching or measuring the place-value action:
1. **Answer on screen at the start (confirmed in source).** For addition the starting blocks are each column's sum and each column shows its count as a large numeral, so 24+12 reads 3 tens / 6 ones before the child acts.
2. **Off-structure problems at easy (recorded run).** The easy tier draws two-digit ± one-digit problems (51+3, 78−3) through the bottom-third fallback, which breaks "two two-digit numbers".
3. **The blocks never count.** Credit is the typed digits. The Carry/Borrow trade is optional and recorded as a metric; in subtraction, blocks show the first number and nothing is taken away.

Recommendation: repair the existing modes. A new mode would hide a scoring defect behind a new name.

## Essential behavior
- Addition: the child sees two numbers as blocks and puts them together; the total is not shown before the child makes it.
- Subtraction: the child starts with the first number and removes the second; when there are not enough ones, the child breaks a ten into ten ones first.
- The written column stays linked to the blocks, so the written algorithm and the model describe the same action.
- At every tier, both operands are two-digit for these objectives.

## Worked example
52 − 27: the child has 5 tens and 2 ones, cannot take 7 ones, breaks a ten (4 tens, 12 ones), removes 2 tens and 7 ones, and has 2 tens and 5 ones = 25.
Misconception: 52 − 27 = 35 (subtracting the smaller digit from the larger in each column, 7 − 2 = 5).

## Evidence of success
- Independent: correct difference or sum with the matching block action (trade when needed, no trade when not).
- The answer typed without the matching block action should be recorded as such, not as full evidence. Whether it still scores is a design decision; it should not be indistinguishable from a modelled answer.
- An unneeded trade in a no-regroup problem is information, not an error to punish.

## Constraints and open questions
- The primitive contract (`docs/contracts/regrouping-workbench.md`) lists what other skills depend on; check it before changing the starting state.
- Observation: without a tier, Gemini writes the problems and only the range is checked, so a borrow can appear in subtract_no_regroup.
- Open: whether the trade is required (blocked until done) or observed (recorded). Pick whichever keeps support tiers working.
'''),
  dict(slug='4-clock-am-pm-setting', title='Setting the clock with a.m. and p.m.', kind='new-mode',
    ids=['MEAS002-04-b'],
    body='''## Learning goal and gap
Grade 2 students set an analog clock to a time and say whether it is a.m. or p.m. from what is happening (waking up, lunch, bedtime). No Lumina primitive represents a.m./p.m.: `analog-clock` stores hour 1-12 and minute and scores hour mod 12. `time-sequencer` `time-of-day` asks morning/afternoon/evening/night with no clock, and its probe told the child to "set your clock to 7:00 a.m." in a mode with no clock. `clock-sequence` deliberately drops sets that mix morning and afternoon.

Recommendation: a mode on `analog-clock`, because the objective requires moving the hands.

## Essential behavior
- An event and a time are given in words ("Bedtime is at 7:30"); the child sets the hands and chooses a.m. or p.m.
- The event decides a.m./p.m.; the printed time does not include it.
- Include the times children confuse: just after noon (12:15 p.m., lunch), early morning (6:45 a.m.) and evening (7:30 p.m.).
- Five-minute times, as in the Grade 2 item space.

## Worked example
"School lunch is at 12:15." The child moves the minute hand to the 3 and the hour hand just past 12, and picks p.m.
Misconceptions: choosing a.m. because 12 looks like the start of the day; setting the hour hand to 3 and the minute hand to 12.

## Evidence of success
- Independent: correct hands and correct a.m./p.m. on a fresh event.
- Record the two parts separately: correct time with wrong a.m./p.m. is a different gap from the reverse.
- No credit for a time reached by the timeline slider (see below).

## Constraints and open questions
- Observation to recheck: the timeline scrubber stays active in `set_time`, so the hands can be bypassed (AnalogClock.tsx:1170-1181).
- Observation to recheck: the day/night strip spaces 24-hour sun/moon icons over a 12-hour slider, so its "12 PM" sun sits at 6:00 (AnalogClock.tsx:123-132, :478-480). Fix it or remove it before a.m./p.m. reasoning relies on it.
- Observation: only the minute hand is draggable; the hour hand follows. Whether Grade 2 should place the hour hand is open.
- Open: whether 12:00 noon and midnight belong at Grade 2.
'''),
  dict(slug='5-mixed-facts-within-20', title='Mixed addition and subtraction facts within 20', kind='repair',
    ids=['OPS002-04-c'],
    body='''## Learning goal and gap
Grade 2 students answer a shuffled set of addition and subtraction facts within 20 without counting. Lumina has the facts (the add-sub-20 item space) but no session promises a mix:
- `math-fact-fluency` `equation_solve` drew 2 subtraction and 4 addition facts within 20. The mix is incidental to difficulty, and the primitive is labelled K-1 ("Grade 1" badge, catalog text "within 3, 5, or 10").
- `di-math-facts` `subtraction_fact` served 8−3, 9−5, 9−8 for an objective that lists 18−9 and 15−7.
- `di-math-facts` blends round-robin + and − in a fixed alternating order, and blends get no difficulty tier.

Recommendation: repair existing primitives (an operation balance for a mixed set, grade labelling, the subtraction ceiling) rather than add a primitive.

## Essential behavior
- A lesson can ask for a mixed set; the session then has a real share of both operations in an unpredictable order.
- Subtraction facts reach 20 when the lesson says within 20 (18−9, 17−9).
- Grade 2 sees Grade 2 labelling.
- No timer (project ruling). If response time is recorded, it should exclude input mechanics such as stepper taps.

## Worked example
Set: 8+7, 15−6, 9+9, 12−4, 7+6, 18−9. Good: 15, 9, 18, 8, 13, 9.
Misconception: adding in a subtraction item after several addition items (15−6 → 21), the error a random order is meant to catch.

## Evidence of success
- Independent: first-try accuracy across both operations in a mixed set.
- Report accuracy per operation; a child at 100% on + and 50% on − has not met the objective.
- Observation to recheck: `visual_fact` draws the total as dots and `match` distractors are always "+", so a subtraction answer is the only "−" option. Those modes cannot carry this evidence until fixed.

## Constraints and open questions
- Within 20, no negative results.
- Open: which primitive owns mixed sets; math-fact-fluency (tap) and di-math-facts (spoken) could both.
'''),
]

# ---------------------------------------------------------------------------

def esc(s):
    return html.escape(str(s), quote=True)

def comp(lesson, i, b):
    g, s = published[lesson['id']]
    cfg = {'targetEvalMode': b['mode'], 'subject': 'Mathematics', 'unitTitle': g['unitTitle']}
    if b['difficulty']:
        cfg['difficulty'] = b['difficulty']
    return {'componentId': b['componentId'], 'instanceId': f"{lesson['id'].lower()}-{i}-{b['componentId']}",
            'title': b['title'], 'intent': b['intent'], 'config': cfg}

def manifest_for(lesson):
    g, s = published[lesson['id']]
    comps = [comp(lesson, i + 1, b) for i, b in enumerate(lesson['sequence'])]
    return {'topic': lesson['title'], 'gradeLevel': GRADE_LABEL, 'themeColor': '#3b5bdb', 'subject': SUBJECT,
            'objectiveBlocks': [{'objectiveId': 'obj1', 'objectiveText': s['description'], 'objectiveVerb': lesson['verb'], 'components': comps}],
            'layout': [dict(c, objectiveIds=['obj1']) for c in comps]}

def wrapper(lesson, n):
    g, s = published[lesson['id']]
    return {'lessonId': f'lesson-{n:02d}',
            'curriculum': {'subject': SUBJECT, 'grade': GRADE, 'unitId': g['unitId'], 'skillId': g['skill']['id'], 'subskillId': s['id'],
                           'description': s['description'], 'targetPrimitive': s.get('target_primitive'), 'difficultyRange': s.get('difficulty_range')},
            'status': 'authored; catalog-checked; each binding generator-probed once at grade 2 (knowledge-check unprobed); not hydrated as a lesson; not runtime-tested',
            'learnerAction': lesson['action'], 'estimatedMinutes': lesson['minutes'],
            'manifest': manifest_for(lesson),
            'sequence': [{'instanceId': f"{lesson['id'].lower()}-{i+1}-{b['componentId']}", 'role': b['role']} for i, b in enumerate(lesson['sequence'])],
            'evidenceCriteria': lesson['evidence'], 'coverageLimits': lesson['limits'],
            'recommendation': {'kind': lesson['decision'], 'proposedBinding': None, 'rationale': lesson['decisionText']}}

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=HERE, capture_output=True, text=True).stdout.strip()

# --- validate --------------------------------------------------------------
assert len(LESSONS) == 10 and len({l['id'] for l in LESSONS}) == 10
assert {l['id'] for l in LESSONS} == set(published)
assert len({published[l['id']][0]['skill']['id'] for l in LESSONS}) == 5
for gsel in sample['selected']:
    sib = {c['id'] for c in gsel['skill']['subskills']}
    assert all(s['id'] in sib for s in gsel['selectedSubskills'])
for l in LESSONS:
    for b in l['sequence']:
        assert b['componentId'] in catalog, b['componentId']
        assert b['mode'] in [m['id'] for m in catalog[b['componentId']]['modes']], (b['componentId'], b['mode'])
        key = (l['id'], b['componentId'], b['mode'])
        if b['componentId'] != 'knowledge-check':
            assert key in PROBES and (HERE / 'evidence' / f"{key[0]}-{key[1]}-{key[2]}.json").exists(), key
for b in BRIEFS:
    assert all(i in published for i in b['ids'])

(HERE / 'manifests').mkdir(exist_ok=True)
(HERE / 'briefs').mkdir(exist_ok=True)
wrappers = []
for n, lesson in enumerate(LESSONS, 1):
    w = wrapper(lesson, n)
    wrappers.append(w)
    (HERE / 'manifests' / f"{w['lessonId']}-{lesson['id']}.json").write_text(json.dumps(w, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(HERE / 'manifest-bundle.json').write_text(json.dumps(wrappers, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
inst = [c['instanceId'] for w in wrappers for c in w['manifest']['objectiveBlocks'][0]['components']]
assert len(inst) == len(set(inst))
for f in (HERE / 'manifests').glob('*.json'):
    json.loads(f.read_text(encoding='utf-8'))

for b in BRIEFS:
    text = f"# {b['title']}\n\n*Kind: {b['kind']} · Curriculum design review {RUN} · written 2026-10-27*\n\n## Curriculum (published, verbatim)\n{curr(b['ids'])}\n\n{b['body']}\n{HANDOFF.format(commit=commit[:10])}\n"
    (HERE / 'briefs' / f"{b['slug']}.md").write_text(text, encoding='utf-8')

# --- HTML ------------------------------------------------------------------
DEC = {'reuse': ('Reuse', 'ok'), 'repair': ('Repair existing', 'warn'), 'new-mode': ('New mode', 'new'), 'new-primitive': ('New primitive', 'new')}
VER = {'usable': ('usable', 'ok'), 'partial': ('partial', 'warn'), 'unfit': ('wrong fit', 'bad'), 'defect': ('defect', 'bad')}
brief_for = {i: b for b in BRIEFS for i in b['ids']}

def lesson_html(n, l, w):
    g, s = published[l['id']]
    d, dc = DEC[l['decision']]
    rows = []
    for i, b in enumerate(l['sequence']):
        pv = PROBES.get((l['id'], b['componentId'], b['mode']))
        badge = f'<span class="tag {VER[pv[0]][1]}">{VER[pv[0]][0]}</span> {esc(pv[1])}' if pv else '<span class="tag">not probed</span>'
        rows.append(f"<tr><td>{i+1}</td><td><code>{esc(b['componentId'])}</code><br><code>{esc(b['mode'])}</code>{' · '+esc(b['difficulty']) if b['difficulty'] else ''}</td><td><b>{esc(b['title'])}</b><br><span class='muted'>{esc(b['role'])}</span></td><td>{badge}</td></tr>")
    fname = f"manifests/{w['lessonId']}-{l['id']}.json"
    br = brief_for.get(l['id'])
    brl = f' <a href="briefs/{esc(br["slug"])}.md">Brief: {esc(br["title"])}</a>' if br else ''
    return f'''<section class="card" id="{esc(l['id'])}">
  <div class="head"><span class="num">{n}</span><div><h3>{esc(l['title'])}</h3><p class="muted"><code>{esc(l['id'])}</code> · {esc(g['skill']['id'])} {esc(g['skill']['description'])} · {esc(g['unitTitle'])}</p></div><span class="tag {dc}">{d}</span></div>
  <blockquote>{esc(s['description'])}<br><span class="muted">Curriculum target: <code>{esc(s.get('target_primitive'))}</code> · difficulty range {esc(s.get('difficulty_range'))}</span></blockquote>
  <p><b>Learner action.</b> {esc(l['action'])} <span class="muted">(~{l['minutes']} min)</span></p>
  <div class="scroll"><table><thead><tr><th>#</th><th>Binding</th><th>Activity</th><th>Probe (one draw, grade 2)</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
  <div class="two"><div><h4>Evidence</h4><ul>{''.join(f'<li>{esc(x)}</li>' for x in l['evidence'])}</ul></div>
  <div><h4>Limits</h4><ul>{''.join(f'<li>{esc(x)}</li>' for x in l['limits'])}</ul></div></div>
  <p class="decision"><b>Decision: {d}.</b> {esc(l['decisionText'])}{brl}</p>
  <details><summary>Manifest JSON · <a href="{esc(fname)}">{esc(fname)}</a></summary><pre>{esc(json.dumps(w['manifest'], indent=2, ensure_ascii=False))}</pre></details>
</section>'''

sample_rows = ''.join(
    f"<tr><td><a href='#{esc(l['id'])}'>{n}</a></td><td><code>{esc(published[l['id']][0]['skill']['id'])}</code> {esc(published[l['id']][0]['skill']['description'])}</td><td><code>{esc(l['id'])}</code></td><td><code>{esc(published[l['id']][1].get('target_primitive'))}</code></td><td><span class='tag {DEC[l['decision']][1]}'>{DEC[l['decision']][0]}</span></td></tr>"
    for n, l in enumerate(LESSONS, 1))
brief_rows = ''.join(f"<li><a href='briefs/{esc(b['slug'])}.md'>{esc(b['title'])}</a> <span class='tag {DEC[b['kind']][1]}'>{DEC[b['kind']][0]}</span> <span class='muted'>{', '.join(b['ids'])}</span></li>" for b in BRIEFS)
issue_rows = ''.join(f"<tr><td><code>{esc(p)}</code></td><td>{esc(t)}</td><td>{esc(e)}</td><td><code>{esc(r)}</code></td></tr>" for p, t, e, r in ISSUES)
sources = sorted({b['componentId'] for l in LESSONS for b in l['sequence']})
sel = '; '.join(f"{g['skill']['id']} → {', '.join(s['id'] for s in g['selectedSubskills'])}" for g in sample['selected'])

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grade 2 Math Review</title>
<style>
:root{{--bg:#f7f7f5;--fg:#1d1f24;--muted:#5f6470;--card:#fff;--line:#e3e3df;--ok:#2b7a4b;--okb:#e5f3ea;--warn:#8a5a00;--warnb:#fbf0d9;--bad:#a12d2d;--badb:#f9e3e3;--new:#3b4fc4;--newb:#e6e9fb;--code:#f0f0ec}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#16181c;--fg:#e6e7ea;--muted:#9aa0ab;--card:#1f2228;--line:#30343c;--ok:#7fd0a0;--okb:#1e3328;--warn:#e8c27a;--warnb:#3a2f17;--bad:#f09a9a;--badb:#3d2020;--new:#a9b4ff;--newb:#262c4d;--code:#2a2e35}}}}
:root[data-theme="dark"]{{--bg:#16181c;--fg:#e6e7ea;--muted:#9aa0ab;--card:#1f2228;--line:#30343c;--ok:#7fd0a0;--okb:#1e3328;--warn:#e8c27a;--warnb:#3a2f17;--bad:#f09a9a;--badb:#3d2020;--new:#a9b4ff;--newb:#262c4d;--code:#2a2e35}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}}
main{{max-width:1040px;margin:0 auto;padding:24px 16px 64px}}a{{color:var(--new)}}h1{{font-size:1.7rem;margin:.2em 0}}h2{{margin-top:2.2em;border-bottom:1px solid var(--line);padding-bottom:.3em}}
h3{{margin:0;font-size:1.15rem}}h4{{margin:.6em 0 .2em}}.muted{{color:var(--muted)}}code{{background:var(--code);padding:0 4px;border-radius:4px;font-size:.88em;overflow-wrap:anywhere}}
nav{{display:flex;flex-wrap:wrap;gap:6px 14px;margin:12px 0}}.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:18px 0}}
.head{{display:flex;gap:12px;align-items:flex-start}}.head>div{{flex:1;min-width:0}}.num{{background:var(--newb);color:var(--new);border-radius:50%;min-width:30px;height:30px;display:grid;place-items:center;font-weight:600}}
.tag{{display:inline-block;padding:1px 8px;border-radius:99px;font-size:.78rem;font-weight:600;background:var(--code);white-space:nowrap}}.ok{{background:var(--okb);color:var(--ok)}}.warn{{background:var(--warnb);color:var(--warn)}}.bad{{background:var(--badb);color:var(--bad)}}.new{{background:var(--newb);color:var(--new)}}
blockquote{{margin:12px 0;padding:8px 12px;border-left:3px solid var(--line);background:var(--bg);border-radius:4px}}
.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:.92rem}}th,td{{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--line)}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}@media (max-width:720px){{.two{{grid-template-columns:1fr}}}}ul{{padding-left:1.2em;margin:.3em 0}}
.decision{{background:var(--bg);padding:8px 12px;border-radius:6px}}details{{margin-top:10px}}pre{{background:var(--code);padding:10px;border-radius:6px;overflow:auto;font-size:.8rem;max-height:420px}}
dl{{display:grid;grid-template-columns:170px 1fr;gap:6px 14px}}@media (max-width:640px){{dl{{grid-template-columns:1fr}}}}dt{{font-weight:600}}dd{{margin:0;overflow-wrap:anywhere}}
</style></head><body><main>
<p class="muted">Curriculum design review · {RUN}</p>
<h1>Grade 2 Math: 10 sampled lessons</h1>
<p><b>Conclusion.</b> No new primitive is needed. Every sampled objective has a primitive with the right representation (tape diagram, blocks with a written column, fact pad, clock, timeline). Most fall short on the task they set or the evidence they score.
Only one lesson is a straight reuse (daily event order). Four lessons need one of three new modes: two-step tape stories with a chosen operation pattern, near doubles, and setting a clock with a.m./p.m. Five need repairs. The largest is <code>regrouping-workbench</code>, which the curriculum names for three of the ten subskills: its addition board starts by showing the answer, its easy tier serves two-digit ± one-digit, and the blocks never count toward credit.</p>
<nav><a href="#sample">Sample</a><a href="#lessons">Lessons</a><a href="#recs">Recommendations</a><a href="#issues">Defects to queue</a><a href="#prov">Provenance</a></nav>

<h2 id="sample">Sample</h2>
<p class="muted">Seeded random draw: 5 of 21 eligible skills, then 2 subskills per skill, without replacement. A random sample, not a coverage audit.</p>
<div class="scroll"><table><thead><tr><th>#</th><th>Skill</th><th>Subskill</th><th>Curriculum target</th><th>Decision</th></tr></thead><tbody>{sample_rows}</tbody></table></div>

<h2 id="lessons">Lessons</h2>
{''.join(lesson_html(n, l, w) for n, (l, w) in enumerate(zip(LESSONS, wrappers), 1))}

<h2 id="recs">Recommendations</h2>
<ol>
<li><b>Repair <code>regrouping-workbench</code></b> (3 subskills, the curriculum's named target): start from the addends, keep easy-tier problems two-digit ± two-digit, make the block action part of the evidence. Brief 3.</li>
<li><b>Two-step tape-diagram patterns</b> (2 subskills): add-add and combine-then-compare. Brief 1.</li>
<li><b>a.m./p.m. clock setting</b> on <code>analog-clock</code>, with the scrubber and day strip fixed. Brief 4.</li>
<li><b>Mixed facts within 20</b>: operation balance, Grade 2 labelling, subtraction ceiling. Brief 5.</li>
<li><b>Near-doubles family</b> in <code>addition-fact-strategies</code>. Brief 2.</li>
<li>Queue items without briefs: <code>di-word-problem-setup</code> addition-only and two-digit numbers (OPS002-01-c); <code>time-sequencer</code> instruction vs tier, 5-card check, shuffle guard (MEAS002-04-c).</li>
</ol>
<p>Briefs:</p><ul>{brief_rows}</ul>
<p class="muted">Curriculum notes: OPS002-04-a/c ask for a "timed mode"; the project rule is no timer on fact fluency, so these lessons use untimed retrieval. OPS002-01-c names <code>addition-subtraction-scene</code>, which is capped at 20.</p>

<h2 id="issues">Defects to queue</h2>
<p class="muted">Found during this review; none fixed here. Evidence: "source" = read in code; "probe" = seen in a saved generation; "recorded run" = earlier saved QA output.</p>
<div class="scroll"><table><thead><tr><th>Primitive</th><th>Finding</th><th>Evidence</th><th>Where</th></tr></thead><tbody>{issue_rows}</tbody></table></div>

<h2 id="prov">Provenance</h2>
<dl>
<dt>Curriculum</dt><dd>{esc(sample['sourceUrl'])} · retrieved 2026-10-27 · snapshot.json SHA-256 <code>{sha(HERE/'snapshot.json')}</code></dd>
<dt>Sampling</dt><dd>{esc(sample['algorithm'])} · seed <code>{sample['seed']}</code> · Python {esc(sample['pythonVersion'])} · {sample['scopedSkillCount']} skills in scope, {len(sample['eligibleSkillIds'])} eligible, none excluded · selected: {esc(sel)}. An earlier sampler run in this session (seed 6737553095333780287) wrote its output to an unresolved path and was lost; it was not inspected, and this draw replaced it.</dd>
<dt>Catalog</dt><dd>Live UNIVERSAL_CATALOG exported via export-catalog.mjs (Vite module runner), 237 primitives · catalog.json SHA-256 <code>{sha(HERE/'catalog.json')}</code></dd>
<dt>Code</dt><dd>Commit <code>{esc(commit)}</code> (branch ship/2026-08-10-judged-loop). Generators, components, item spaces and catalog entries for: {', '.join(f'<code>{esc(s)}</code>' for s in sources)}, plus equation-builder, addition-subtraction-scene, number-bond, number-line, place-value-chart and strategy-picker (ruled out). Paths in this report are relative to <code>{LUMINA}</code>.</dd>
<dt>Probes</dt><dd>18 draws through <code>/api/lumina/eval-test</code> (probe.mjs), exact published text as topic and intent, grade 2, difficulty medium, one draw each; saved in evidence/. Gemini spend recorded: $0.00. knowledge-check (lesson 9) not probed.</dd>
<dt>Validated</dt><dd>10 distinct subskills under 5 distinct skills with parent membership; every binding's component and eval mode exists in the live catalog; instance IDs unique; every probed binding has its evidence file; manifests are valid JSON; curriculum text copied from the snapshot, not retyped.</dd>
<dt>Not done</dt><dd>No lesson hydrated through useExhibitSession; nothing rendered or played; no Live tutor run; one draw per binding is not a distribution. Defects marked "inferred" were read in code but not reproduced.</dd>
</dl>
<p class="muted">Files: <a href="manifest-bundle.json">manifest-bundle.json</a> · <a href="sample.json">sample.json</a> · manifests/ · briefs/ · snapshot.json, catalog.json, evidence/ (qa/curriculum-design-review/{RUN}/)</p>
</main></body></html>
'''
(HERE / 'index.html').write_text(page, encoding='utf-8')
print('ok', len(wrappers), 'lessons', len(inst), 'bindings', len(BRIEFS), 'briefs')
