"""Authored review content for math-g2-2026-10-28: lessons, probe verdicts, defects, briefs.

Imported by build.py, which validates it and writes manifests/, briefs/, manifest-bundle.json and index.html.
"""

# Probe evidence. Gemini's monthly project spend cap returned 429 for every Gemini-backed generator on
# 2026-10-28, so only code-only generators produced a draw. verdict: usable | partial | unfit | defect
PROBES = {
    ('GEOM002-01-b', 'shape-builder', 'make_shape'): ('usable',
        'Code-owned, empty dot grid: "Make a shape with 5 sides", "3 sides", "4 sides", "4 sides and exactly 4 square corners". No ghost, no side-count badge. Asks by property only; no shape names, no 8 sides.'),
    ('MEAS002-05-c', 'coin-counter', 'show-amount'): ('usable',
        'Code-owned: show 30¢ (sticker), 47¢ (pencil), 53¢ (toy car), 99¢ (bouncy ball), any coins. Tray starts empty, no running total, half-dollar available. Grade band "2". No coin-count limit in any item.'),
}


def binding(cid, mode, title, intent, role, difficulty=None):
    return {'componentId': cid, 'mode': mode, 'title': title, 'intent': intent, 'role': role, 'difficulty': difficulty}


LESSONS = [
  dict(id='GEOM002-02-a', title='Cut the Rectangle into Squares', verb='partition',
    action='Take a rectangle and cut it into rows and columns of same-size squares (3 rows of 4), then say how many squares it makes.',
    sequence=[
      binding('array-grid', 'make_array', 'Fill It with Squares',
              'Grade 2. Make a rectangle from same-size squares, any rows and columns, for totals within 20.', 'introduction (squares fill a rectangle)', 'easy'),
      binding('array-grid', 'build_array', 'Rows and Columns',
              'Grade 2. Build an array with the given number of rows and columns (2 by 3 up to 5 by 5).', 'practice (rows x columns)', 'medium'),
      binding('array-grid', 'count_array', 'How Many Squares?',
              'Grade 2. Count the squares in a rectangle by rows and columns. Use addition words, not multiplication.', 'fresh review (count, not partition)', 'hard'),
    ],
    minutes=15,
    evidence=['Unmet: no Lumina mode asks the child to cut a given rectangle into rows and columns. This is the objective itself.',
              'Supported practice only: make_array (child places unit squares into a full rectangle), build_array (child picks the row and column counts).',
              'Prerequisite evidence: count_array total for a fresh array.'],
    limits=['Every array-grid mode starts from an empty grid or a finished array; none draws a rectangle outline for the child to cut (ArrayGrid.tsx:243, :709, :733-774).',
            'build_array states the dimensions in the ask, and the total field appears only once the build is right, so the screen confirms the build before Check (ArrayGrid.tsx:373, :504, :909).',
            'build_array caps at 5 x 5 (gemini-array-grid.ts:315): the curriculum example 2 by 6 cannot appear.',
            'Cells are separate star icons with gaps (ArrayGrid.tsx:813-825), which reads as objects in rows, not a rectangle covered by squares.',
            'Not probed: Gemini monthly cap.'],
    decision='new-mode', decisionText='Add a partition mode to array-grid: a rectangle outline the child cuts into a given number of rows and columns of equal squares. The array model, caps and levers already exist.'),

  dict(id='GEOM002-02-b', title='Count Rows, Add Them Up', verb='count',
    action='Look at a rectangle cut into squares, name the rows and columns (4 rows of 5), find the total, and check it by adding the rows: 5 + 5 + 5 + 5 = 20.',
    sequence=[
      binding('array-grid', 'count_array', 'Count by Rows',
              'Grade 2. Count the squares in arrays up to 5 by 5 using rows and columns; add row by row. Do not use multiplication.', 'introduction (labels on)', 'easy'),
      binding('array-grid', 'count_array', 'Rows of Squares',
              'Grade 2. Arrays up to 6 rows and 8 columns; find the total by adding equal rows.', 'practice', 'medium'),
      binding('array-grid', 'count_array', 'New Arrays',
              'Grade 2. Fresh arrays, labels off; find the total.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Independent: correct total on a fresh array at hard (labels off), first try.',
              'Unmet: the objective asks the child to verify by repeated addition; count_array grades the total only (ArrayGrid.tsx:380).',
              'Naming rows and columns is visible (axis labels at easy and medium) but not answered or scored.'],
    limits=['After a correct item the screen shows "R x C = P" (ArrayGrid.tsx:986); multiplication notation is Grade 3.',
            'The generator prompt says "Motivate arrays-as-multiplication" (gemini-array-grid.ts:666), and the tiered path resolves count to the mult-div-facts item space (gemini-array-grid.ts:44-63).',
            'Row strips (lever) outline each row, but no row totals or skip-count numbers are ever drawn.',
            'Not probed: Gemini monthly cap.'],
    decision='repair', decisionText='Repair count_array for Grade 2: additive framing (no x sentence, not the mult-div-facts space) and an equal-addends step the child completes and the mode scores.'),

  dict(id='OPS002-01-c', title='Story Problems to 100', verb='solve',
    action='Hear or read a story ("Mia has 25 apples and picks 12 more"), decide whether to add or subtract, and find the total within 100.',
    sequence=[
      binding('tape-diagram', 'solve_part_whole', 'Parts and the Whole',
              'Grade 2 addition stories within 100 about apples and books: two parts, find the whole.', 'introduction (the whole is the sum of the parts)', 'medium'),
      binding('di-word-problem-setup', 'build_family', 'Build the Story',
              'Grade 2 one-step stories within 100 about apples and books: build small + small = big, choose add or subtract, solve.', 'practice (choose the operation)', 'medium'),
      binding('di-word-problem-setup', 'build_family', 'New Stories',
              'Grade 2, fresh one-step stories within 100.', 'fresh review', 'hard'),
    ],
    minutes=15,
    evidence=['Independent: the operation step and the answer step on a fresh story, judged per step by the tutor (di-word-problem-setup).',
              'The tape diagram is supported practice: it has no operation-choice step.',
              'Needs a microphone; with no microphone there is no independent evidence of operation choice in this lesson.'],
    limits=['The curriculum names addition-subtraction-scene, which is K-1 and capped at 20 (gemini-addition-subtraction-scene.ts:687, :849-850). It cannot serve within 100.',
            '10-27 finding: di-word-problem-setup cannot pin addition-only stories, and small numbers can appear in within-100 sessions. For this objective a mix of + and - stories makes the operation choice real, so the first point is not a blocker.',
            'Not probed today: Gemini monthly cap. The generator returned an empty problem list instead of an error (evidence-failed/).'],
    decision='reuse', decisionText='Reuse di-word-problem-setup build_family with tape-diagram as the introduction. Queue the curriculum note: OPS002-01-c names a primitive that cannot meet it, and naming primitives in curriculum data is against the project rule.'),

  dict(id='OPS002-01-a', title='Tens with Tens, Ones with Ones', verb='add',
    action='Show 24 and 12 as blocks, put the tens together and the ones together, and write 36.',
    sequence=[
      binding('regrouping-workbench', 'add_no_regroup', 'Put the Blocks Together',
              'Grade 2, two two-digit numbers within 100, no regrouping, with column counts shown.', 'introduction', 'easy'),
      binding('regrouping-workbench', 'add_no_regroup', 'Add Tens and Ones',
              'Grade 2, two two-digit numbers within 100, no regrouping.', 'practice', 'medium'),
      binding('regrouping-workbench', 'add_no_regroup', 'New Sums',
              'Grade 2, fresh two-digit sums within 100, no regrouping.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Independent: correct sum at hard, first try, with blocksModelled recorded.',
              'Credit is the typed digits; the block action is recorded beside it (blocksModelled), as agreed with the user on 10-27 ("trade observed, not required").'],
    limits=['Repaired 2026-10-27 (commit 804c1fad): each column starts with the top number and the bottom number waiting; the count hides once a column is settled (RegroupingWorkbench.tsx:745-794; regroupingWorkbenchWorkspace.ts:47-55).',
            'Easy-tier column badges still show the count (RegroupingWorkbench.tsx:776-781). That is the tier support.',
            'Not probed today: Gemini monthly cap. 10-27 verify runs are in ../math-g2-2026-10-27/verify/.'],
    decision='reuse', decisionText='Reuse. The 10-27 repair covers this objective; no new work.'),

  dict(id='GEOM002-01-a', title='Count Sides, Name the Shape', verb='identify',
    action='Count the sides and corners of a shape (regular, then irregular) and name it from the count: 5 sides is a pentagon, however it is drawn.',
    sequence=[
      binding('shape-sorter', 'count', 'How Many Sides?',
              'Grade 2. Count sides or corners of triangles, squares, rectangles, rhombuses, pentagons and hexagons.', 'introduction (count the attribute)', 'medium'),
      binding('shape-builder', 'classify', 'Sort by Sides',
              'Grade 2. Sort regular and irregular shapes into triangles, quadrilaterals, and five or more sides by counting sides.', 'practice (name from count)', 'medium'),
      binding('shape-builder', 'classify', 'New Shapes to Sort',
              'Grade 2. Fresh irregular shapes, sorted by number of sides.', 'fresh review', 'hard'),
    ],
    minutes=15,
    evidence=['Supported: spoken side and corner counts (shape-sorter count; microphone required).',
              'Classify sorting is not valid evidence today: each shape carries its name as a label, and the key can be a wrong model label (see limits).',
              'Unmet: octagon, trapezoid and parallelogram appear in no Grade 2 mode; irregular pentagons and hexagons are never drawn by shape-sorter.'],
    limits=['shape-builder classify labels each unsorted shape with its model-written name ("Pentagon") (ShapeBuilder.tsx:1484), which names the bin.',
            'classify keeps the model\'s correctCategory when it is a valid category name, even if the vertex count disagrees (gemini-shape-builder.ts:775-778).',
            'shape-sorter is K-1 (gradeBand enum K/1), always draws regular pentagons and hexagons, and has no octagon, trapezoid, parallelogram or quadrilateral (shapeSorterDomain.ts:44-54; shapeSorterDrawing.tsx:38-41).',
            'Not probed: Gemini monthly cap.'],
    decision='repair', decisionText='Repair shape-builder classify: code draws the shapes (regular and irregular, up to 8 sides), code computes the key from the corners, no name on the shape. Then classify carries the objective.'),

  dict(id='GEOM002-01-b', title='Draw It from the Clue', verb='draw',
    action='Read "draw a pentagon" or "a shape with 5 sides and 5 corners", and draw a closed shape that fits on a dot grid.',
    sequence=[
      binding('shape-builder', 'make_shape', 'Make a Shape',
              'Grade 2. Make a closed shape with the number of sides asked (3 to 6).', 'introduction', 'easy'),
      binding('shape-builder', 'make_shape', 'Shapes by Sides and Corners',
              'Grade 2. Make shapes with a given number of sides, square corners or equal sides.', 'practice', 'medium'),
      binding('shape-builder', 'make_shape', 'New Clues',
              'Grade 2. Fresh asks by sides and corners.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Independent: a closed, simple polygon with the asked properties on a fresh ask, any shape that fits (shapeMakeBuild.ts:47-58, :127-140).',
              'Unmet: drawing from a shape name ("draw a hexagon") and the octagon and trapezoid examples.'],
    limits=['K-2 asks are 3-6 sides plus square-corner and equal-side variants (shapeMakeBuild.ts:237-245); no 8 sides, no parallel sides below Grade 3.',
            'Asks never use a shape name, so the child never turns a name into a side count.',
            'shape-tracer draw_from_description (the curriculum target) is not used: it scores the corner count only, accepts three dots in a line and crossed shapes, and pentagons and hexagons must be regular (shapeTracerWorkspace.ts:32-52; gemini-shape-tracer.ts:848-880).'],
    decision='new-mode', decisionText='Extend shape-builder make_shape with Grade 2 asks by name (triangle to octagon, quadrilateral, trapezoid), judged by the same code. Queue the shape-tracer draw defects separately.'),

  dict(id='GEOM002-03-a', title='Halves, Thirds and Fourths of a Circle', verb='partition',
    action='Cut a circle into 2, 3 or 4 equal shares and name one share: a half, a third, a fourth.',
    sequence=[
      binding('fraction-circles', 'touch_fraction', 'Touch the Half',
              'Grade 2. Hear halves, thirds and fourths in words and touch the matching circle.', 'introduction (names for shares)', 'easy'),
      binding('fraction-circles', 'touch_fraction', 'Find the Share',
              'Grade 2. Halves, thirds and fourths only, in words.', 'practice', 'medium'),
      binding('fraction-circles', 'touch_fraction', 'New Shares',
              'Grade 2. Fresh halves, thirds and fourths, in words.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Supported: recognising a share named in words (touch_fraction).',
              'Unmet: the child making the cuts. Every fraction-circles mode except build_equal pre-cuts the circle (FractionCircles.tsx:737).',
              'Unmet: the child naming the share. identify needs typed "1/4" and cannot accept "one fourth" (FractionCircles.tsx:420-424, :656, :717-722).'],
    limits=['build_equal does let the child cut (buttons for 2, 3, 4 and halving), but it asks for an equal fraction "not d" (3.NF.A.3), and at Grade 2 it credits sixths, eighths and twelfths (fractionEqualBuild.ts:70-77, :89).',
            'fraction-circles is a Grade 3 notation primitive (contract R5, R14); adding Grade 2 word answers in place would conflict with it.',
            'Not probed: Gemini monthly cap.'],
    decision='new-primitive', decisionText='Build a Grade 2 equal-shares primitive (see brief 5) that covers cutting and naming in words for circles and rectangles; fraction-circles stays the Grade 3 notation tool.'),

  dict(id='GEOM002-03-c', title='Equal Shares Can Look Different', verb='compare',
    action='See the same rectangle cut in half two ways (straight down, corner to corner) and decide whether both make equal shares; reject cuts that make unequal parts.',
    sequence=[
      binding('fraction-circles', 'touch_fraction', 'Warm-up: Halves and Fourths',
              'Grade 2. Halves and fourths in words. Warm-up for the equal-shares discussion only.', 'prerequisite warm-up', 'easy'),
    ],
    minutes=8,
    evidence=['Unmet: no Lumina mode shows an unequal partition, a whole cut two ways, or asks the child to judge equal or not equal.',
              'The warm-up is prerequisite practice, not evidence for this objective.'],
    limits=['The only unequal pieces in fraction-circles are ones the child makes by halving, which build_equal rejects (fractionEqualBuild.ts:50, :62).',
            'No primitive cuts a rectangle; shape-composer, shape-builder compose and polygon-area-builder decompose are tangram or area tools.',
            'This lesson cannot be taught honestly with today\'s catalog; the manifest is a placeholder warm-up.'],
    decision='new-primitive', decisionText='Build a Grade 2 equal-shares primitive (brief 5): wholes cut different ways, unequal distractors, an equal / not-equal judgement with a reason.'),

  dict(id='MEAS002-05-b', title='Write It in Dollars', verb='write',
    action='Count a set of coins and write the total the dollar way: 78 cents is $0.78, 105 cents is $1.05.',
    sequence=[
      binding('coin-counter', 'count-mixed', 'Count the Coins',
              'Grade 2. Count mixed coins (quarters, dimes, nickels, pennies) to find the total.', 'introduction (count the total)', 'medium'),
      binding('coin-counter', 'count-mixed', 'New Coin Sets',
              'Grade 2. Fresh mixed coin sets.', 'practice + review (cents only)', 'hard'),
    ],
    minutes=10,
    evidence=['Prerequisite: correct total in cents (count-mixed).',
              'Unmet: the objective itself. No mode accepts "$0.78"; every answer field is a whole number of cents (CoinCounter.tsx:881-892, :410).'],
    limits=['Amounts above 99c never occur at Grade 2 on the tier path (gemini-coin-counter.ts:795-796, :960); $1.05 and $2.50 cannot appear. There are no bills.',
            'formatCents shows $d.cc only for 100c and over (CoinCounter.tsx:198-205), so the child never sees $0.78 written.',
            'Not probed: Gemini monthly cap.'],
    decision='new-mode', decisionText='Add a dollar-notation mode to coin-counter: count, then write the total with $ and a decimal point, including amounts over a dollar (brief 6).'),

  dict(id='MEAS002-05-c', title='Make the Amount', verb='make',
    action='Make 35 cents with coins in more than one way, and then with exactly 5 coins.',
    sequence=[
      binding('coin-counter', 'show-amount', 'Show It Your Way',
              'Grade 2. Show amounts up to 99 cents with any coins; no running total.', 'introduction + practice (any combination)', 'medium'),
      binding('coin-counter', 'make-amount', 'Make the Price',
              'Grade 2. Make a price with coins, within 100 cents.', 'fresh review', 'hard'),
    ],
    minutes=12,
    evidence=['Independent: a correct combination for a fresh amount with no running total (show-amount; make-amount at hard).',
              'Unmet: "using 5 coins". No mode sets or checks a coin count, not even fewest-coins (CoinCounter.tsx:419-428, :455-461).',
              'Unmet: making change with coins. make-change prints "You paid - Item costs = Change ?" and takes a typed number (CoinCounter.tsx:1150-1180).'],
    limits=['make $1.00 needs a 100c ceiling; the Grade 2 tier cap is 99c.',
            'make-amount shows the running total at easy (CoinCounter.tsx:313, :963-967); hard withdraws it.',
            'Only show-amount was probed (code-only); make-amount not probed (Gemini monthly cap).'],
    decision='new-mode', decisionText='Add a coin-count target to coin-counter (brief 6) and repair make-change so the child makes the change with coins.'),
]

ISSUES = [
    ('array-grid', 'Grade 2 count and build show "R x C = P"; prompt motivates multiplication; tiered count resolves to mult-div-facts.', 'source', 'ArrayGrid.tsx:986, :391; gemini-array-grid.ts:44-63, :666'),
    ('array-grid', 'build_array confirms the build before Check (total field appears only when correct); the !correctArray && correctTotal branch is dead.', 'source', 'ArrayGrid.tsx:373, :406, :504, :909'),
    ('shape-builder', 'classify labels each shape with its name and keeps a model key that disagrees with the corners.', 'source', 'ShapeBuilder.tsx:1484; gemini-shape-builder.ts:775-778'),
    ('shape-tracer', 'draw_from_description scores corner count only (no right angles), accepts collinear and crossed shapes.', 'source', 'shapeTracerWorkspace.ts:32-52; ShapeTracer.tsx:394'),
    ('shape-tracer', 'An unknown target shape (e.g. octagon) is drawn silently as a triangle while the instruction names it.', 'source', 'gemini-shape-tracer.ts:448, :858'),
    ('fraction-circles', 'build_equal at Grade 2 credits sixths, eighths and twelfths.', 'source', 'fractionEqualBuild.ts:70-77'),
    ('fraction-bar', 'identify and build ignore the grade (fifths, sixths, eighths for Grade 2).', 'source', 'gemini-fraction-bar.ts:306-317, :333'),
    ('coin-counter', 'make-change prints the subtraction on screen and takes a typed number; the child never makes change with coins.', 'source', 'CoinCounter.tsx:1150-1180'),
    ('coin-counter', 'fewest-coins never checks the number of coins (contract gap G8 open); contract G2 grade-band gap is fixed in code but still marked OPEN.', 'source', 'CoinCounter.tsx:419-428; docs/contracts/coin-counter.md'),
    ('di-word-problem-setup', 'Under a Gemini error the generator returns an empty problem list (status fail) instead of the error.', 'probe', 'evidence-failed/OPS002-01-c-di-word-problem-setup-classify_and_build.json'),
    ('curriculum', 'OPS002-01-c names addition-subtraction-scene (K-1, capped at 20) for a within-100 objective.', 'source', 'gemini-addition-subtraction-scene.ts:687, :849-850'),
]

BRIEFS = [
  dict(slug='1-array-partition-rectangle', title='Cut a rectangle into rows and columns of equal squares', kind='new-mode',
    ids=['GEOM002-02-a'],
    body='''## Learning goal and gap
Grade 2 students partition a rectangle into rows and columns of same-size squares and count them (2.G.A.2), the first step toward area as an array. No Lumina mode asks the child to cut a given rectangle. `array-grid` has four modes, and each starts from an empty grid (`make_array`, `build_array`) or a finished array (`count_array`, `multiply_array`). `polygon-area-builder` and `area-model` are Grade 3 and later. Nothing else in the catalog partitions a rectangle (searched for "partition", "2.G.A.2", "unit square").

Recommendation: a mode on `array-grid`. It already has the rows-by-columns model, Grade 2 caps, row-strip and label levers and a teaching workspace. The implementing session may decide a separate primitive is cleaner after reading the code.

## Essential behavior
- The child starts with a rectangle outline and an ask: "Cut this into 3 rows and 4 columns of equal squares."
- The child places the cuts. Cuts snap so squares come out equal (the curriculum asks for grid snapping).
- After cutting, the child says or enters how many squares there are.
- Suggestion: later items give the rows and the total ("3 rows, 12 squares") and the child finds the columns.
- Squares should read as one covered rectangle, not separate icons. Today's cells are star icons with gaps.

## Worked example
"Cut the rectangle into 2 rows and 6 columns." The child draws one cut across and five cuts down and gets 12 equal squares.
Misconceptions: drawing 6 cuts for 6 columns (7 columns); swapping rows and columns (6 rows of 2); unequal spacing when cuts are free.

## Evidence of success
- Independent: correct rows and columns on a fresh rectangle, and the correct count, first try.
- Supported: help that shows where one cut goes, or a row already cut.
- Cut count and column count are different facts; record which one the child got wrong.

## Constraints and open questions
- Grade 2 sizes from the curriculum: 2x3 to 5x5, including 2x6 and 4x3. Observation: `build_array` caps at 5x5, `count_array` at 6x8.
- No multiplication notation at Grade 2 (see brief 2).
- Open: whether cuts are free lines that snap, or taps on grid positions.
'''),
  dict(slug='2-array-count-repeated-addition', title='Count an array by rows and check with repeated addition (Grade 2)', kind='repair',
    ids=['GEOM002-02-b'],
    body='''## Learning goal and gap
Grade 2 students find the number of squares in a rectangle by its rows and columns and write the total as a sum of equal addends (2.OA.C.4, 2.G.A.2): 4 rows of 5 is 5 + 5 + 5 + 5 = 20. `array-grid` `count_array` is the right surface: a finished array with row and column labels at easy and medium, a total field, and a row-strip lever. Three things make it a Grade 3 multiplication task at Grade 2:
1. After a correct answer the screen shows "4 x 5 = 20" (ArrayGrid.tsx:986), and build says "You built a 4 x 5 array".
2. The generator prompt tells Gemini to "motivate arrays-as-multiplication", and the tiered path routes count to the mult-div-facts item space.
3. Credit is the total only. The curriculum says "verify by repeated addition"; nothing asks for or scores the sum.

Recommendation: repair the mode for Grade 2, not a new mode. The task is the same; its framing and evidence are wrong for the grade.

## Essential behavior
- Grade 2 sees addition language and an equal-addends sentence, never x.
- The child gives the total and the repeated-addition sentence that checks it (5 + 5 + 5 + 5).
- Rows or columns may be the addend; both are correct.
- Grade 3 and later keep the current multiplication framing.

## Worked example
3 rows of 6 squares. Good: "6 + 6 + 6 = 18." Also good: "3 + 3 + 3 + 3 + 3 + 3 = 18."
Misconceptions: 6 + 3 = 9 (adding the dimensions); 6 + 6 = 12 (one row missed).

## Evidence of success
- Independent: a correct total and a matching equal-addends sentence on a fresh array, labels off.
- Correct total with a mismatched sentence (6 + 6 = 18) is partial and should be recorded as such.
- Supported: row strips or labels on.

## Constraints and open questions
- Sizes: the curriculum examples go to 6 rows of 3 and 2 rows of 8; `count_array` caps at 6x8, which fits.
- Observation to recheck: no contract file exists for array-grid; derive one (`/primitive-contract`) before editing, since Grade 3 lessons depend on the x framing.
- Open: whether the sentence is typed, built from tiles, or spoken.
'''),
  dict(slug='3-shape-classify-by-counts', title='Name shapes by counting sides and corners, including irregular shapes', kind='repair',
    ids=['GEOM002-01-a'],
    body='''## Learning goal and gap
Grade 2 students recognise and name triangles, quadrilaterals, pentagons, hexagons and octagons by counting sides and corners, whatever the shape looks like (2.G.A.1). The curriculum adds trapezoid, rhombus and parallelogram, and asks to move from regular to irregular shapes.

The two candidates fall short:
- `shape-sorter` `count` asks the child to say a side or corner count, but it is K-1, requires a microphone, draws pentagons and hexagons regular only, and has no octagon, trapezoid, parallelogram or quadrilateral.
- `shape-builder` `classify` sorts shapes into Triangles / Quadrilaterals / Pentagons & More by side count and can show irregular shapes. But each shape carries its model-written name as a label ("Pentagon"), which names the bin. And the key is the model's own label unless it is missing; a wrong label is kept even when the corners disagree (gemini-shape-builder.ts:775-778).

Recommendation: repair `classify` so code draws the shapes and computes the key from the corners, with no name on the shape; extend its range to 8 sides. A new primitive is not needed; the sort is the right action.

## Essential behavior
- Shapes are drawn by code, regular first and then irregular (a concave pentagon still has 5 sides).
- The child decides by counting; the screen does not name the shape.
- Bins or names cover triangle, quadrilateral, pentagon, hexagon, octagon at Grade 2.
- Suggestion: a second step names special quadrilaterals (square, rectangle, rhombus, trapezoid) by their sides and corners.

## Worked example
An irregular 5-sided shape with one corner pointing in. Good: "Pentagon, it has 5 sides and 5 corners."
Misconceptions: "not a pentagon, it doesn't look like one" (shape matched to a picture, not a count); counting a corner twice when the shape is rotated.

## Evidence of success
- Independent: correct name or bin for fresh irregular shapes, first try.
- Regular shapes alone are not enough; they can be recognised by look.
- Wrong bin on irregular but right on regular is the main gap to record.

## Constraints and open questions
- Observation to recheck: shape-builder has no contract file; derive one before editing classify.
- Open: whether the special quadrilaterals belong here or in a separate step.
'''),
  dict(slug='4-make-shape-by-name', title='Draw a shape from its name (Grade 2)', kind='new-mode',
    ids=['GEOM002-01-b'],
    body='''## Learning goal and gap
Grade 2 students draw shapes with given attributes and named shapes: "draw a pentagon", "draw a quadrilateral", "draw an octagon" (2.G.A.1). `shape-builder` `make_shape` already does the hard part well: an empty dot grid, any closed simple shape that fits passes, and code judges sides, square corners and equal sides. The probe drew "Make a shape with 5 sides", "3 sides", "4 sides", "4 sides and exactly 4 square corners".

Gaps: asks are always properties, never a name, so the child never turns "hexagon" into 6 sides; K-2 asks stop at 6 sides; trapezoid and parallel-side asks exist only at Grades 3-5.

The curriculum target `shape-tracer` `draw_from_description` is not the right base: it scores the corner count only, accepts three dots in a line and crossed shapes, and requires regular pentagons and hexagons.

Recommendation: extend `make_shape` with Grade 2 asks by name.

## Essential behavior
- Asks by name: triangle, quadrilateral, pentagon, hexagon, octagon; square, rectangle, trapezoid.
- Any shape that fits the name passes (an irregular hexagon is a hexagon).
- Some asks combine both ("a quadrilateral with no square corners").
- No picture of the target shape.

## Worked example
"Draw an octagon." The child connects 8 dots into a closed shape with 8 sides. An irregular one passes.
Misconceptions: drawing a hexagon for "octagon" (name confusion); drawing a shape with an extra collinear point (counts as 8 dots, 7 sides).

## Evidence of success
- Independent: a correct shape for a fresh name, first try.
- Record name-to-count errors apart from drawing errors (open shape, crossed sides).

## Constraints and open questions
- Observation: `MAX_CORNERS = 8` in shapeMakeBuild.ts, so octagons may already fit the grid.
- Open: whether "trapezoid" means exactly one pair of parallel sides or at least one; pick one and keep it consistent with any later grade.
- Queue separately: shape-tracer draw_from_description scoring defects.
'''),
  dict(slug='5-equal-shares-grade-2', title='Equal shares: cut, name, and judge halves, thirds and fourths', kind='new-primitive',
    ids=['GEOM002-03-a', 'GEOM002-03-c'],
    body='''## Learning goal and gap
Grade 2 students partition circles and rectangles into two, three or four equal shares, describe a share with words (halves, thirds, half of, a third of, fourths, a quarter of), and recognise that equal shares of the same whole need not have the same shape (2.G.A.3). No fraction notation at this grade.

What Lumina has today:
- `fraction-circles` pre-cuts the circle in every mode but `build_equal`. `identify` needs a typed "1/4" and cannot accept "one fourth". `build_equal` lets the child cut with buttons but asks for an equivalent fraction (Grade 3) and at Grade 2 credits sixths to twelfths. Its contract fixes it as a notation tool.
- `touch_fraction` uses words (half, third, fourth), but the child only touches a picture.
- No primitive shows an unequal partition, cuts a rectangle, or cuts one whole two different ways.

Recommendation: a new Grade 2 primitive. Its main actions (cut a whole, judge equal or not, compare two cuts of the same whole) are not in any current tool, and adding them to fraction-circles would conflict with its Grade 3 contract. The sibling GEOM002-03-b (rectangles, horizontal vs vertical) was not sampled but belongs here.

## Essential behavior
- Cut: the child cuts a circle or rectangle into 2, 3 or 4 equal shares. Equal spacing can be helped (snap), but the child chooses how many cuts and where.
- Name: the child names one share in words ("a third"), and the whole as "three thirds".
- Judge: the child sees a whole cut into parts and decides whether they are equal shares. Unequal cuts must appear, or the judgement means nothing.
- Same whole, different cuts: a square cut in half straight down and corner to corner; the child decides both halves are equal shares, and says why (each is half of the same square).

## Worked example
Two squares of the same size: one cut down the middle (two rectangles), one cut corner to corner (two triangles). "Is the triangle the same amount as the rectangle?" Good: "Yes, both are half of the same square."
Misconceptions: "No, they are different shapes"; calling any two pieces "halves" even when one is bigger; cutting a circle into thirds with three parallel lines.

## Evidence of success
- Independent: correct equal / not-equal judgements on fresh wholes, including the same-whole-different-cut case.
- Independent: correct word name for a share.
- A cut with snapping on is supported practice; without snapping or after a fresh ask it is stronger evidence.
- Do not credit a share name typed as a fraction at Grade 2 as the target behaviour.

## Constraints and open questions
- Shares limited to halves, thirds and fourths.
- Accessibility: the judge step should not depend on colour alone.
- Open: whether verifying equality means a reason chosen from options, a spoken reason judged by the tutor, or moving one share onto another.
'''),
  dict(slug='6-coin-counter-dollars-and-coin-counts', title='Coin counter: dollar notation and coin-count targets', kind='new-mode',
    ids=['MEAS002-05-b', 'MEAS002-05-c'],
    body='''## Learning goal and gap
Grade 2 students solve money problems with dollars and coins, using $ and the cent sign correctly (2.MD.C.8). The curriculum asks for two things `coin-counter` does not do:
1. **Writing amounts as dollars** ($0.78, $1.05, $2.50). Every coin-counter answer field is a whole number of cents with a cent placeholder; "0.78" parses to 0 and $ cannot be typed. Amounts over 99c never occur at Grade 2, and there are no bills.
2. **Making an amount with a set number of coins** ("make 35 cents using 5 coins"). No mode sets or checks a coin count; even `fewest-coins` only checks the total.

`show-amount` already handles "many valid combinations" well (probe: 30c, 47c, 53c, 99c, empty tray, no running total).

Recommendation: two new modes on `coin-counter`, or two options on existing modes; the implementing session decides.

## Essential behavior
- Dollar notation: the child counts coins (and later bills) and writes the total with $ and a decimal point. Totals cross $1 so $1.05 vs $1.50 appears.
- Coin-count target: the child makes an amount with exactly N coins. Code checks both the total and the count. Some targets have one answer (35c with 5 coins: only 2 dimes + 3 nickels), others several (50c with 5 coins: 5 dimes, or 1 quarter + 1 dime + 3 nickels); the item design should know which.
- No running total at the independent level.

## Worked example
Dollar notation: 3 quarters and 3 pennies. Good: "$0.78". Misconceptions: "$78", "$0.078", "78" with no sign, "$.78" (decide whether to accept).
Coin count: "Make 35 cents with 5 coins." Good: 2 dimes + 3 nickels. Misconception: 1 quarter + 1 dime (right amount, 2 coins).

## Evidence of success
- Independent: correct notation for fresh totals on both sides of $1; correct amount and count for a fresh target.
- Right amount with the wrong coin count is partial, recorded separately from a wrong amount.
- Cents written as "78c" is correct money but not the target notation; record it as such.

## Constraints and open questions
- Observation to recheck: the Grade 2 tier ceiling is 99c (gemini-coin-counter.ts:795-796); "make $1.00" and dollar notation need it raised for these modes.
- Observation: the coin-counter contract (docs/contracts/coin-counter.md) lists gap G8 (fewest-coins count) open and still marks the G2 grade-band gap OPEN although code fixed it.
- Queue separately: make-change prints the subtraction and takes a typed number; the child should make the change with coins.
- Open: bills at Grade 2 (the standard says dollar bills).
'''),
]

CONCLUSION = ('<b>Conclusion.</b> One new primitive is warranted: Grade 2 <b>equal shares</b> (cut, name in words, judge equal or not). '
  'It covers two of the ten subskills, and no current tool shows an unequal partition or cuts a rectangle. '
  'Three new modes extend existing primitives: a rectangle-partition mode on <code>array-grid</code>, asks by shape name on <code>shape-builder</code> <code>make_shape</code>, '
  'and dollar notation plus coin-count targets on <code>coin-counter</code>. Two repairs: <code>array-grid</code> <code>count_array</code> uses multiplication at Grade 2 and never checks repeated addition, '
  'and <code>shape-builder</code> <code>classify</code> labels each shape with its name and can keep a wrong key. The two addition subskills (repeats from 10-27) are reuse: the 10-27 regrouping-workbench repair holds. '
  '<b>Gemini\'s monthly project spend cap blocked 17 of 19 generation probes</b>, so most findings are source-level.')

RECS = [
  '<b>New primitive: Grade 2 equal shares</b> (GEOM002-03-a, -03-c; sibling -03-b). Brief 5.',
  '<b>Repair <code>array-grid</code> <code>count_array</code></b> for Grade 2 (no x, equal-addends step) and <b>add a rectangle-partition mode</b>. Briefs 2 and 1.',
  '<b>Repair <code>shape-builder</code> <code>classify</code></b> (code-drawn shapes, key from corners, no name label, up to 8 sides). Brief 3.',
  '<b><code>coin-counter</code>: dollar notation and coin-count targets.</b> Brief 6.',
  '<b><code>shape-builder</code> <code>make_shape</code> asks by name.</b> Brief 4.',
  'Queue without briefs: shape-tracer draw scoring and the triangle fallback; coin-counter make-change; fraction-bar grade-blind identify/build; fraction-circles build_equal Grade 2 denominators; di-word-problem-setup swallowing generation errors; the OPS002-01-c curriculum note.',
]
