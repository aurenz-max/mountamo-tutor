"""Reproducible, explicitly authored K Mathematics capability review.

Mirrors curriculum-coverage-review.py (the K Language Arts pilot) but is a separate
review: no decision is inherited from that scope or from the legacy target_primitive
labels on the published rows. Each row names the exact catalog modes reviewed against
the required student action at Kindergarten, with a reason, a next action, and the
development-queue item (if any). A catalog candidate is not content-verified; probes
and content checks are layered on separately by curriculum-coverage-probe/check.

Band-floor policy (user ruling: trust intent over hardcoded caps): where a generator
caps numbers or positions below what the published K objective names, the mode is
reviewed as PARTIAL with a repair item, never as a curriculum problem. Where a catalog
entry gates a mode behind a reader-fit re-audit (sorting-station, compare-objects,
length-lab, time-sequencer, number-bond Grade-1 modes), the row is PARTIAL with the
re-audit item.
"""
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa/curriculum-coverage/math-k'
rows = json.loads((OUT / 'requirements.json').read_text(encoding='utf-8'))
catalog = json.loads((OUT / 'catalog-export.json').read_text(encoding='utf-8'))
lookup = {p['id']: p for p in catalog}
basis = json.loads((OUT / 'review-basis.json').read_text(encoding='utf-8'))
assert {r['id']: hashlib.sha256(r['text'].encode()).hexdigest() for r in rows} == basis['requirements'], 'Curriculum changed; re-review affected decisions before updating review-basis.json'
assert all(hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == h for p, h in basis['catalogSources'].items()), 'Catalog changed; re-review capabilities before updating review-basis.json'
decisions = {}


def put(ids, candidates, fit, reason, action, work=''):
    if isinstance(ids, str):
        ids = ids.split()
    for rid in ids:
        assert rid not in decisions, f'Duplicate review {rid}'
        edges = []
        for spec in candidates.split():
            pid, mode = spec.split(':')
            assert pid in lookup, pid
            assert any(m['id'] == mode for m in lookup[pid]['modes']), spec
            source = 'src/components/lumina/service/manifest/catalog/' + lookup[pid]['domain'] + '.ts'
            assert source in basis['catalogSources'], f'{rid}: edge {spec} cites {source}, which the frozen basis does not cover'
            edges.append({'primitive': pid, 'mode': mode, 'source': source})
        assert (fit == 'development') == (not edges), f'{rid}: development rows have no edges and vice versa'
        decisions[rid] = {'fit': fit, 'candidates': edges, 'reason': reason,
                          'nextAction': action, 'work': work, 'reviewLevel': 'catalog',
                          'content': 'not_tested', 'interaction': 'not_tested', 'evidence': []}


FLOOR = 'k-band-floor-reaudit'
# TEEN ('teen-numbers-ten-plus') was retired 2026-09-08: the two ten-frame teen
# modes and number-bond's ten_and_ones shipped, and all seven K.NBT.1 rows moved
# from PARTIAL to CANDIDATE. Left out of the constants deliberately — a row that
# still needs it would fail loudly rather than re-open a closed item silently.
STORY10 = 'k-story-problems-within-10'
COUNTX = 'counting-extensions'
DATA = 'k-data-recording'
PHYS = 'physical-observation'
LENGTH = 'length-lab-extensions'
MEASIM = 'measure-sim-weight-capacity'
PATTERN = 'pattern-k-gaps'
CLOCK = 'analog-clock-k-parts'

# ---- COUNT001 Counting and Cardinality -------------------------------------------------
put('COUNT001-01-A', 'di-math-facts:name_numeral counting-board:count number-tracer:write', 'candidate',
    'Naming a printed numeral aloud, tapping and counting 1-10 objects, and writing a numeral from its spoken name together cover recognition, counting and spoken-word-to-numeral matching at K without any printed answer.',
    'Generate the published objective for name_numeral and confirm the pool stays in 0-10 and that zero is handled (spoken answers elsewhere are 1-20).')
put('COUNT001-01-B', 'number-tracer:write number-tracer:trace', 'partial',
    'Numeral writing 0-10 is served; writing the number WORDS (seven) and pairing each written numeral with a counted object set are not judged by any mode.',
    'Decide whether number-word spelling is a K demand here; if so add a word-writing prompt, and place a countable object set beside the numeral prompt.')
put('COUNT001-01-C', 'counting-board:count number-tracer:write di-math-facts:name_numeral', 'candidate',
    'K counting-board counts 1-20 objects, number-tracer writes 0-20 at K, and numeral naming reaches 20. Sequence and order are the count sequence itself, served by tapping in order.',
    'Probe counting-board with the exact 11-20 text and confirm counts land in 11-20 rather than defaulting to a 1-10 pool.')
put('COUNT001-01-D', 'number-sequencer:before_after number-sequencer:fill_missing number-sequencer:count_from', 'candidate',
    'The three named actions (before/after, missing numbers, backward counting) are three number-sequencer challenge types inside its K 1-20 window.',
    'Probe a blended session and confirm count_from includes backward counting when the objective names it.')
put('COUNT001-01-E', 'hundreds-chart:highlight_sequence counting-board:group', 'candidate',
    'The catalog text floors skip counting at Grade 1, but the probe shows the hundreds-chart generator honors the objective: a 1-50 grid with 2s and 5s for a K request (it self-promotes the band). counting-board group remains a Grade 1 mode for the concrete-objects half.',
    'Keep hundreds-chart as the K skip-count home; the recorded by-10s drift and the counting-board group floor are the residuals.')
put('COUNT001-01-F', 'di-math-facts:counting_next di-math-facts:name_numeral hundreds-chart:highlight_sequence', 'candidate',
    'Say-the-next-number reaches 120 with decade transitions (39 -> forty), numeral naming covers recognition, and the chart sizes itself to a stated ceiling (to 100).',
    'Probe counting_next with the decade emphasis and confirm the window stays in 21-100 rather than the K default of 1-20.')
put('COUNT001-01-G', 'di-math-facts:counting_next number-sequencer:count_from', 'partial',
    'Counting forward from any number is served by the DI pack to 120; number-sequencer count_from is windowed 1-20 at K. Identifying a sequence ERROR (which number is wrong) is not a mode anywhere.',
    'Add an error-spotting challenge to number-sequencer and widen its K window when the objective names 100.', 'count-to-100-k')
put('COUNT001-01-H', 'number-sequencer:fill_missing', 'candidate',
    'Exact match: fill one missing number in a line of at most 10; the objective even names the primitive and its constraints (one blank, under 10).',
    'Probe with the exact text; check every sequence has exactly one blank, stays under 10, and the blank moves position as in the examples.')
put('COUNT001-01-I', 'number-sequencer:count_from di-math-facts:counting_next', 'candidate',
    'count_from continues from a start anywhere in 1-20 and asks for the next numbers; the objective wants the next three from starts as high as 17. counting_next gives one number per turn, so it is the fluency half only.',
    'Probe count_from; confirm three continuations per item from varied starts up to 17 and no start above 17.')
put('COUNT001-02-A', 'counting-board:count', 'candidate',
    'Tap each object once and say how many: one-to-one correspondence with touching is the mode itself, in the 1-5 range.',
    'Probe with the exact text and confirm object counts stay at 1-5 and tap order is judged, not just the final word.')
put('COUNT001-02-B', 'counting-board:count', 'candidate',
    'Arrangements (scattered, line, circle, groups) are a declared axis of the counting board; 1-10 sits inside the K range.',
    'Check arrangement variety across one session in the probe payload; a session of only lines does not meet the objective.')
put('COUNT001-02-C', 'counting-board:recount_moved counting-board:count', 'candidate',
    'Conservation is recount_moved (slice 7): the same set is rearranged and the child says how many again.',
    'Probe recount_moved with the exact text and confirm sizes vary as well as layouts.')
put('COUNT001-02-D', 'counting-board:count counting-board:give_me_n', 'candidate',
    'Counting up to 20 in lines and arrays is count; counting OUT a requested quantity is give_me_n (slice 7): tap exactly N of many.',
    'Probe give_me_n with the exact text and confirm requests reach into the teens.')
put('COUNT001-02-E', 'comparison-builder:compare_groups counting-board:take_away', 'candidate',
    'Group comparison has its home, and counting backwards on concrete objects is take_away (slice 7): objects leave and the child says the new count.',
    'Probe take_away from 10 down.')
put('COUNT001-02-F', 'counting-board:add_more counting-board:group', 'partial',
    'Tracking a running total as objects are added is add_more (slice 7); counting in groups of 2 is group, still a Grade 1 mode per its constraints.',
    'Probe add_more with pairs; re-audit group at K.')
put('COUNT001-02-G', 'counting-board:count_on counting-board:subitize', 'candidate',
    'Combining a hidden known group with visible objects is count_on, which gained a K route in slice 7 (the started group sits under a basket); flash-then-hide subitizing covers the briefly shown set.',
    'Probe count_on at K with the exact text.')
put('COUNT001-02-H', 'number-sequencer:count_from', 'candidate',
    'count_from runs backward from a start value inside the K window, which is the descending sequence 10 to 0 the objective asks for; the number-line half is a display aid, not a second action.',
    'Probe and confirm backward direction is emitted when the objective says backwards, and that 0 is a legal terminal value here.')
put('COUNT001-03-A COUNT001-03-B', 'comparison-builder:compare_groups counting-board:compare', 'candidate',
    'Visual group comparison with correspondence lines gives more/less/equal over groups of up to 10; the counting board asks the child to say how many are in the group with more.',
    'Probe compare_groups: confirm equal groups occur and the three terms are all exercised, with groups at the stated sizes.')
put('COUNT001-03-C', 'comparison-builder:compare_numbers number-line:order', 'candidate',
    'Symbolic comparison of two numerals 1-10 is the mode; number-line ordering is the visual representation the objective names.',
    'Probe compare_numbers and check both numerals are in 1-10 and the comparison is not answerable from layout.')
put('COUNT001-03-D', 'comparison-builder:order number-sequencer:order_cards number-line:order', 'candidate',
    'Three ordering surfaces cover 3-5 values in either direction within 10.',
    'Confirm both directions (least-to-greatest and greatest-to-least) appear across a session.')
put('COUNT001-03-E', 'comparison-builder:compare_numbers di-spoken-practice:explain_concept', 'candidate',
    'The alligator-mouth comparison mode is exactly < and > over numbers to 10; the spoken justification is explain_concept over the shown comparison.',
    'Probe compare_numbers: both symbols and the equal case must appear; then probe explain_concept with a comparison stimulus.')
put('COUNT001-03-F', 'comparison-builder:one_more_less number-sequencer:before_after', 'candidate',
    'Adjacent-number reasoning to 20 is the mode; before_after is the same fact on the number train.',
    'Confirm values reach into 11-20 rather than staying under 10.')
put('COUNT001-03-G', 'comparison-builder:compare_numbers ten-frame:decompose_teen', 'candidate',
    'Comparing 11-20 is inside the compare_numbers range, and the place-value half now has a judged home: decompose_teen makes the child find the ten inside each teen number on a double frame, which is the one-ten-and-some-ones the objective asks them to compare with. base-ten-blocks is no longer routed here — it shows a ten as one rod, not as ten ones.',
    'Probe compare_numbers with both numerals in 11-20, then pair it with a decompose_teen block on the same lesson.')
put('COUNT001-04-A', 'ordinal-line:identify', 'candidate',
    'At K the tutor names a place (first through fifth) and the child says who is there: the exact recognition action.',
    'Probe with the exact text and confirm positions stay within first-fifth and the front end is announced.')
put('COUNT001-04-B', 'ordinal-line:match', 'candidate',
    'Reading 1st-5th aloud one card at a time is symbol-to-word matching by production; no word column is shown to match against.',
    'Confirm the printed symbol and the accepted word agree on every card.')
put('COUNT001-04-C COUNT001-04-G', 'ordinal-line:sequence_story', 'candidate',
    'A spoken story about who is where, then say the place one character has: daily routines, story sequences and simple real-world word problems are all this contract.',
    'Probe sequence_story; check stories are under 60 words, name at most 5 characters, and never state the answer.')
put('COUNT001-04-D', 'ordinal-line:identify ordinal-line:match', 'candidate',
    'The modes are right and, since slice 3 (2026-09-08), an objective naming positions past fifth raises the K line to ten; re-probed with a ten-character line and targets sixth through tenth.',
    'Drive one K session with the mic to hear the tenth-place ask.')
put('COUNT001-04-E', 'ordinal-line:relative_position', 'candidate',
    'Say who is right before or right after a marked place is exactly "what comes before fourth".',
    'Confirm both before and after are asked and the marked place is announced, not printed as its answer.')
put('COUNT001-04-F', 'ordinal-line:build_sequence', 'candidate',
    'Building the line from spoken clues; the K position cap lifts to tenth when the objective names it (slice 3), and the four-clue hold is kept by pre-filling part of the line.',
    'Probe build_sequence with the exact text and confirm at most four spoken clues over a ten-long line.')
put('COUNT001-05-A', 'ten-frame:decompose_teen ten-frame:build_teen', 'candidate',
    'decompose_teen is this objective exactly: a teen group of 11-19 counters arrives SCATTERED over a double frame and the child turns ten of them yellow, so the group of ten is found rather than handed over. build_teen covers the same identification from the other side, with the ten given as a full frame.',
    'Probe decompose_teen with the exact 11-19 text; confirm the scatter never fills a frame (nineteen is the known exception — the geometry forces it) and that the leftover is never printed.')
put('COUNT001-05-B COUNT001-05-C', 'ten-frame:build_teen number-bond:ten_and_ones', 'candidate',
    'build_teen opens a DOUBLE frame with its top half full — one ten — and the child places the remaining ones to make the teen number: "ten ones plus additional ones" as a manipulative. ten_and_ones is the same composition on the bond. Both are pinned to the double frame at Kindergarten, which is the R2 fork the contract records; base-ten-blocks stays unrouted because it shows a ten as one rod.',
    'Probe build_teen with the exact text for each half of the range and confirm the targets stay inside the window the objective names (11-15 / 16-19), not the full teen band.')
put('COUNT001-05-D COUNT001-05-E', 'number-bond:ten_and_ones ten-frame:decompose_teen', 'candidate',
    'ten_and_ones accepts exactly ONE pair — a full ten and the rest — so a sum-correct split like 6 and 8 for fourteen is corrected rather than affirmed, which is the difference between this and decompose. Its whole is the teen number itself: the K maxNumber cap of 5 does not bind it, because the answer is a placement, not a spoken number. decompose_teen is the same decomposition on the frame.',
    'Probe ten_and_ones with the exact text; confirm the wholes stay inside the named half of the range and that both parts arrive null (the child places them).')
put('COUNT001-05-F', 'equation-builder:missing-operand number-bond:ten_and_ones', 'candidate',
    'equation-builder emits the form the objective itself names at K — a probe on this text returned 10 + ? = 11, ? + 5 = 15, 10 + ? = 17 and ? + 9 = 19, with the unknown on both sides — and ten_and_ones now supplies the ten-and-ones MODEL the equation refers to, which is what nothing paired before.',
    'Keep the pair on one lesson: the equation without the model is symbol practice, and the model without the equation is not this objective.')

# ---- OPS001 Operations and Algebraic Thinking ---------------------------------------------
put('OPS001-01-A OPS001-02-A', 'addition-subtraction-scene:act_out', 'candidate',
    'K act_out answers with the enacted scene itself (bring objects in, send objects away) within 5, which is representing the operation with concrete objects.',
    'Probe act_out and confirm join and separate stories both appear within 5 and no story states its answer.')
put('OPS001-01-B', 'number-line:jump ten-frame:operate', 'candidate',
    'jump shows addition as movement on a fully labeled small line; operate works the same sums on the frame and has the child say the total.',
    'Probe number-line jump at K with within-5 operations; confirm the range is 0-10 and fully labeled.')
put('OPS001-01-C', 'addition-subtraction-scene:build_equation addition-subtraction-scene:solve_story', 'candidate',
    'solve_story has the child SAY the answer (verbal), build_equation assembles the number sentence from tiles (written), both within 5 at K.',
    'Confirm the tile palette does not reveal the answer and that the story is read aloud, not printed.')
put('OPS001-01-D', 'number-bond:decompose ten-frame:decompose', 'candidate',
    'Decompose finds every pair for a whole of at most 5 at K, one judged turn per pair, on counters: the objective exactly.',
    'Confirm the session ends when all pairs are found and wholes stay within 5.')
put('OPS001-01-E', 'addition-subtraction-scene:solve_story', 'candidate',
    'Word problem, say the answer; since slice 3 (2026-09-08) an objective naming "within 10" raises the K maxNumber from its default of 5. Re-probed: results to 8, no story states its unknown.',
    'Drive one K session with the mic for a within-10 story.')
put('OPS001-01-F', 'strategy-picker:guided strategy-picker:compare', 'partial',
    'Ten frames, tally marks and doubles are strategy-picker strategies and compare is its reflection phase; K numbers are capped at 5 against an objective within 10. Slice 3 lifted the scene cap but strategy-picker was not probed or edited.',
    'Apply the objective number window to strategy-picker and probe guided at K.', STORY10)
put('OPS001-01-G', 'addition-subtraction-scene:create_story addition-subtraction-scene:solve_story', 'partial',
    'Creating a story is served as building the scene that matches a number sentence, and solving is spoken, now within 10 at K (slice 3). Money contexts are still not a scene theme.',
    'Probe create_story with a coins objective; add a coins theme or route money stories to coin-counter.')
put('OPS001-02-B', 'number-bond:decompose', 'candidate',
    'Each found pair is recorded on the bond diagram as the child makes it, within 5.',
    'Confirm every decomposition is retained on screen across the turn, not overwritten.')
put('OPS001-02-C', 'addition-subtraction-scene:solve_story addition-subtraction-scene:build_equation', 'candidate',
    'Subtraction stories within 5, answered aloud or as a built number sentence, are inside the K cap.',
    'Confirm separate stories dominate and no result is 0.')
put('OPS001-02-D', 'ten-frame:operate number-line:jump', 'candidate',
    'Subtraction on the frame with the difference said aloud, and jumps backward on the line, are the two representations named; results of 0 are discarded by the frame.',
    'Probe operate for subtraction within 10 and confirm differences are never 0.')
put('OPS001-02-E', 'addition-subtraction-scene:create_story addition-subtraction-scene:solve_story', 'candidate',
    'Real-world subtraction stories are built and solved on the scene; the K maxNumber follows the objective window since slice 3 (within 10 re-probed on OPS001-01-E).',
    'Probe with the exact subtraction text and confirm differences reach 6-10.')
put('OPS001-02-F', 'math-fact-fluency:missing_number math-fact-fluency:equation_solve equation-builder:missing-operand balance-scale:equality', 'candidate',
    'The objective names two forms. A missing MINUEND is missing_number (which by design hides operand1 or operand2, never the result); a missing DIFFERENCE is equation_solve (result unknown). equation-builder missing-operand and the balance mystery block cover the minuend form in two more surfaces.',
    'Probe missing_number (done: minuend only, tier preference for operand2 not honored) and equation_solve for the difference form.')
put('OPS001-02-G', 'number-bond:missing_part math-fact-fluency:match', 'partial',
    'The fact family is the inverse-relationship task and its floor HELD on the 2026-09-08 reader-fit '
    're-audit (qa/reader-fit/k-band-floor-2026-09-08.md): the answer is four equations TYPED into boxes, and symbolic written form is the '
    'declared skill, so no medium swap is hiding inside it. The spoken missing_part and math-fact-fluency '
    'match carry the K-reachable half of the relationship.',
    'Probe missing_part at K over a bond within 10 and judge whether two spoken related facts satisfy the '
    'objective; a spoken fact-family turn is a new eval mode (/add-eval-modes), not a floor move.', FLOOR)
put('OPS001-03-A', 'di-math-facts:counting_next number-sequencer:count_from', 'candidate',
    'Say the next number is the fluency step; response time is captured silently, which is how the 3-second criterion is measured without a visible timer.',
    'Confirm the window is 1-5 and backward counting is included; never surface the timer.')
put('OPS001-03-B', 'di-math-facts:answer_fact di-math-facts:subtraction_fact math-fact-fluency:equation_solve', 'candidate',
    'Addition and take-away facts within 3 with spoken answers, or equation solving with visual aids, are the two named routes.',
    'Confirm the pool is scoped to within 3 by the objective text.')
put('OPS001-03-C', 'math-fact-fluency:match addition-subtraction-scene:build_equation', 'candidate',
    'match connects visual representations to equations; build_equation is the same matching from the scene side.',
    'Confirm visuals show both addition and subtraction situations within 5.')
put('OPS001-03-D', 'di-math-facts:fact_review math-fact-fluency:speed_round', 'candidate',
    'Mixed review of taught facts and aid-free recall are fluency within 5; both measure response time silently.',
    'Confirm no countdown or speed framing appears anywhere in the generated copy.')
put('OPS001-03-E', 'number-bond:missing_part balance-scale:equality equation-builder:missing-operand', 'candidate',
    'Missing part within 5 said aloud, the mystery block on the balance, and the missing operand are all 3 + _ = 5.',
    'Probe missing_part and confirm the 5 - _ = 2 form is representable, not only addition.')
put('OPS001-03-F', 'number-bond:missing_part', 'partial',
    'Fact families are the mode and its floor HELD on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md) -- writing '
    'four equations is typing, which the pre-reader band excludes by rule.',
    'Route to missing_part at K within 5; a spoken fact-family variant is an /add-eval-modes item, not a '
    're-audit.', FLOOR)
put('OPS001-03-G', 'addition-subtraction-scene:solve_story addition-subtraction-scene:create_story', 'candidate',
    'Solve (say the answer) and create (build the scene for a sentence) within 5 are both inside the K cap.',
    'Confirm both operations appear across one session.')

# ---- GEOM001 Geometry -----------------------------------------------------------------------
put('GEOM001-01-A', 'di-shapes:name_shape shape-sorter:identify', 'candidate',
    'Both draw one code-owned shape at varied rotation and size and have the child say its name; nothing printed names it first.',
    'Probe name_shape with the four named shapes and confirm rotations vary across the session.')
put('GEOM001-01-B', 'shape-sorter:count shape-sorter:sort di-shapes:count_sides', 'partial',
    'Sides, corners and curved-versus-straight are asked aloud on drawn shapes; shapes found in real-world environments are not a stimulus in any 2D mode (only the 3D explorer shows familiar objects).',
    'Add real-object stimuli (a clock face, a door) to the 2D naming/attribute modes.', 'shapes-in-the-world')
put('GEOM001-01-C', 'shape-sorter:count shape-sorter:sort', 'candidate',
    'Count sides or corners aloud, then say which group a shape belongs with by side count: the two named actions.',
    'Confirm a sides sort holds polygons only and no circle is asked for a side count.')
put('GEOM001-01-D', '3d-shape-explorer:identify_3d 3d-shape-explorer:2d_vs_3d', 'candidate',
    'Name a drawn solid aloud, and say flat or solid for a drawn shape, with cube/cone/cylinder inside the supported set.',
    'Probe identify_3d with the exact text; confirm the three named solids appear and no name leaks in the title.')
put('GEOM001-01-E', 'shape-tracer:trace shape-tracer:draw_from_description', 'candidate',
    'Tracing a dotted outline and constructing a shape from spoken property cues are the two named actions.',
    'Confirm the description never names the shape when the child must build it from properties.')
put('GEOM001-01-F', 'shape-composer:compose-match shape-composer:decompose shape-builder:compose', 'candidate',
    'Filling a target silhouette from pieces and naming the basic components of a composite are composition and decomposition; pattern-block composition is the same act in shape-builder.',
    'Probe compose-match at K and confirm snap targets do not solve the puzzle for the child.')
put('GEOM001-02-A', 'di-shapes:count_sides di-shapes:count_corners shape-sorter:identify', 'candidate',
    'Counting sides and corners aloud, then naming the shape, is identification by attribute.',
    'Confirm corner counts and side counts are asked on the same shape so the attribute-to-name link is explicit.')
put('GEOM001-02-B', 'shape-sorter:sort sorting-station:odd_one_out', 'candidate',
    'Sorting by sides, curve or color into 2-3 groups is the single-attribute sort; odd_one_out at K is the does-not-belong half, spoken.',
    'Confirm size can be a sort axis when the objective names it, since the catalog lists sides, curve and color.')
put('GEOM001-02-C', 'shape-sorter:identify di-shapes:name_shape', 'partial',
    'Orientation and size invariance are built in; recognizing shapes IN real-world objects is not a 2D stimulus.',
    'Add real-object stimuli to the naming modes.', 'shapes-in-the-world')
put('GEOM001-02-D', 'shape-tracer:complete shape-tracer:connect_dots', 'candidate',
    'Finishing a half-drawn shape and connecting numbered dots are creating and completing figures.',
    'Confirm the missing sides are not hinted by ghost lines before the child acts.')
put('GEOM001-02-E', '3d-shape-explorer:faces_properties 3d-shape-explorer:identify_3d', 'partial',
    'Property questions (how many faces, is it round) are asked aloud; building and manipulating PHYSICAL models is a classroom observation no primitive can score.',
    'Keep the spoken property analysis as the screen half and record the physical build as an observation requirement.', PHYS)
put('GEOM001-02-F', 'shape-composer:compose-picture shape-composer:decompose', 'candidate',
    'Arranging palette shapes to recreate a picture of a familiar object and naming the parts of a composite are the two named actions.',
    'Confirm the target picture is a silhouette, not a pre-solved overlay.')
put('GEOM001-02-G', 'pattern-builder:extend pattern-builder:create pattern-builder:find_rule', 'candidate',
    'Extending, creating and describing a repeating shape pattern are three pattern-builder modes; K-1 supports shape and color tokens.',
    'Probe create at K: the catalog places creation at grades 2-3, so confirm an AB creation challenge is emitted for a K objective that names it.')

# ---- MEAS001 Measurement and Data ----------------------------------------------------------
put('MEAS001-01-A', 'compare-objects:identify_attribute', 'candidate',
    'Say what a pictured object lets us measure (how long, how tall, how heavy, how much it holds) is the K.MD.1 vocabulary production this row asks for.',
    'Probe with the exact text; confirm the attribute menu never offers both length and height on one item and that weight and size are represented.')
put('MEAS001-01-B', 'compare-objects:compare_two length-lab:compare', 'candidate',
    'Say the name of the longer, taller, heavier or fuller object; length-lab compare is the same direct visual comparison for length.',
    'Confirm the comparative word is in the tutor line, not printed as a button.')
put('MEAS001-01-C', 'sorting-station:sort_one', 'candidate',
    'Sorting picture cards by one measurable attribute, one card at a time and spoken, is sort_one at K; size is the taught concept here, which the catalog allows as the primary axis.',
    'Probe with the exact text and confirm bins are size/length/weight categories, not colors.')
put('MEAS001-01-D', 'length-lab:tile_and_count', 'candidate',
    'Tiling cubes or paper clips end to end and counting them is the mode; K supports compare and tile.',
    'Confirm unit tiles must be placed by the child rather than pre-laid.')
put('MEAS001-01-E', 'length-lab:order compare-objects:order_three', 'candidate',
    'Ordering three objects by an attribute is served twice, and both floors came down on the 2026-09-08 '
    'reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md): compare-objects order_three is drawings touched in order, and length-lab '
    'order draws every object as a length bar with a colour-matched picker chip.',
    'Probe order_three and order at K with the exact text; confirm 3-5 objects and that the ordered attribute '
    'is visible without reading a name.')
put('MEAS001-01-F', 'measure-lab:capacity_predict measure-lab:pour_count compare-objects:compare_two', 'candidate',
    'Comparing and measuring capacity is capacity_predict and pour_count on the measure-lab birth (slice 7); the spoken which-holds-more comparison remains a second home. Real pouring stays a classroom follow-up, not a requirement gap.',
    'Probe capacity_predict with water-or-sand framing.')
put('MEAS001-01-G', 'sorting-station:two_attributes', 'candidate',
    'Yes/no per object against two criteria is two_attributes, unfloored to K on the 2026-09-08 reader-fit '
    're-audit (qa/reader-fit/k-band-floor-2026-09-08.md) -- the port made the compound question a spoken yes/no asked one object at a time, which '
    "is the contract's own G2 finding that what exceeded a pre-reader was the medium, not the cognition.",
    'Probe two_attributes at K with two measurable attributes (height and width) and confirm both verdicts '
    'are reachable.')
put('MEAS001-02-A', 'sorting-station:sort_one', 'candidate',
    'Sort by one observable attribute, spoken one object at a time, is the K mode.',
    'Confirm the objective-named attribute is the sort axis across all challenges.')
put('MEAS001-02-B', 'comparison-builder:compare_groups counting-board:compare', 'candidate',
    'Counting two category groups and saying more/fewer/equal is comparison-builder at K; the catalog itself routes K count-and-compare there rather than to sorting-station.',
    'Probe compare_groups with the exact text; confirm groups stay at 5 or below and equal appears.')
put('MEAS001-02-C', 'sorting-station:sort_one sorting-station:tally_record', 'candidate',
    'Sorting into up to 3 categories is served at K, and saying the count of each group is tally_record, '
    'unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md) -- counts are spoken number words. The K '
    'caps of 4-6 objects and 3 bins still bind.',
    'Probe tally_record at K with counts to 10 and confirm no group would be empty.')
put('MEAS001-02-D', 'sorting-station:two_attributes', 'candidate',
    'Two-attribute classification is the mode, unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md).',
    'Probe two_attributes at K on colour AND shape; confirm the emoji matches its label on every card.')
put('MEAS001-02-E', 'bar-model:build_one_to_one', 'candidate',
    'Recording data one sticker per item is build_one_to_one, shipped 2026-09-08 (slice 7): the child taps one icon per object into a row and the chart is judged against the pile.',
    'Probe with the exact text (tally marks may also be named; the icon row is the K equivalent).')
put('MEAS001-02-F', 'sorting-station:sort_one sorting-station:sort_variety', 'partial',
    'Sorting by function (things for eating, things for playing) is a semantic category sort_one can run; self-designed, labeled categories are open production.',
    'Probe sort_one with function categories; leave self-designed labels as a teacher observation.')
put('MEAS001-02-G', 'sorting-station:odd_one_out sorting-station:sort_variety', 'candidate',
    'Which card does not belong is spoken at K, and reclassifying the same objects into NEW categories is '
    'sort_variety, unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md).',
    'Probe sort_variety at K and confirm the draw returns enough distinct rounds -- one draw returned only '
    '2 of the 5 asked for.')
put('MEAS001-03-A', 'sorting-station:sort_one', 'candidate',
    'Sorting picture cards into given categories is sort_one.',
    'Confirm categories are the data categories named by the objective.')
put('MEAS001-03-B', '', 'development',
    'Human graphs and physical object arrangements are classroom activities; no primitive observes them, and building an on-screen graph from given data is a different action.',
    'Record as an observation requirement; a screen equivalent is the K pictograph build.', PHYS)
put('MEAS001-03-C', 'bar-model:build_one_to_one', 'candidate',
    'Recording survey answers one sticker per response is build_one_to_one (slice 7).',
    'Probe with a class-survey framing and confirm the categories are the survey choices.')
put('MEAS001-03-D', 'bar-model:build_one_to_one', 'candidate',
    'A one-icon-per-item pictograph or bar build is build_one_to_one (slice 7); build_graph stays the scaled Grade 3 mode.',
    'Confirm the bar style variant appears alongside the icon style.')
put('MEAS001-03-E', 'bar-model:compare_bars bar-model:picture_graph', 'candidate',
    'Which bar is taller (K.MD.A.2) answers which has more/less; picture_graph reads how many when one icon is one item.',
    'Probe compare_bars with the exact text; confirm the values are not printed on the bars and that a how-many question is asked.')
put('MEAS001-03-F', '', 'development',
    'Predicting an outcome and then collecting class data to verify it is a classroom cycle; no primitive holds both the prediction and a real collection.',
    'Record as an observation requirement.', PHYS)
put('MEAS001-03-G', 'bar-model:most_least di-spoken-practice:explain_concept', 'partial',
    'Most and least are read aloud with most_least (slice 7); explaining a display in one own-words idea still needs a graph stimulus in the spoken pack, which does not draw one.',
    'Give explain_concept a bar/pictograph stimulus, or add a say-what-the-graph-shows turn to bar-model.', DATA)
put('MEAS001-04-A', 'compare-objects:compare_two di-spoken-practice:compare_choice', 'candidate',
    'Say which is longer/shorter or heavier/lighter from two drawings is compare_two; compare_choice is the same closed-set spoken comparison.',
    'Confirm heavier/lighter items exist, not only length.')
put('MEAS001-04-B', 'length-lab:estimate_then_tile', 'candidate',
    'Estimate first, then tile and count, is estimate_then_tile (slice 7); body-part and everyday units are allowed and the unit the objective names overrides the random pick.',
    'Probe with the exact text and confirm the estimate is captured before tiles appear.')
put('MEAS001-04-C', 'length-lab:tile_and_count', 'candidate',
    'Tile non-standard units and count them; the counted total is the recorded result.',
    'Confirm the count is entered by the child, not shown.')
put('MEAS001-04-D', 'measure-lab:balance_predict compare-objects:compare_two', 'candidate',
    'Predict, then place two objects on a pan balance and watch it tip: balance_predict on the measure-lab birth (slice 7). The legacy balance-scale label was a name collision with the equation balancer.',
    'Probe balance_predict with the exact text; confirm the prediction is captured before the test.')
put('MEAS001-04-E', 'measure-lab:pour_count measure-lab:capacity_predict', 'candidate',
    'Pouring cups into a container and counting them is pour_count; predicting which holds more is capacity_predict (measure-lab, slice 7).',
    'Probe pour_count and confirm the cup count is asked only once the container is full.')
put('MEAS001-04-F', '', 'development',
    'Tracking a measurement over days (plant growth, temperature) needs repeated real measurements; no primitive stores a longitudinal record.',
    'Record as an observation requirement.', PHYS)
put('MEAS001-04-G', 'analog-clock:elapsed time-sequencer:duration-compare', 'candidate',
    'A real-time stopwatch exists in analog-clock elapsed, and duration comparison is time-sequencer '
    'duration-compare, unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md): it is picture-primary '
    'and prints no clock time at any band. Timing a live activity and comparing with peers is still not judged.',
    'Probe duration-compare at K; keep peer comparison as observation.')
put('MEAS001-05-A', 'length-lab:compare compare-objects:compare_two', 'candidate',
    'Side-by-side longer/shorter is the direct comparison mode in both primitives.',
    'Confirm objects are aligned at one end so the comparison is visual, not a guess.')
put('MEAS001-05-B', 'length-lab:tile_and_count', 'candidate',
    'Tiling with hands, fingers or feet as the unit is tile_and_count with body-part units (slice 7); the unit the objective names is honored.',
    'Probe with the exact text and confirm hand tiles are used.')
put('MEAS001-05-C', 'length-lab:tile_and_count', 'candidate',
    'Uniform items laid along one object and counted is the mode.',
    'Confirm units are uniform and the object length is a whole number of units (1-12).')
put('MEAS001-05-D', 'length-lab:two_unit_compare', 'candidate',
    'Measuring one object with two units and saying which needed more is two_unit_compare (slice 7).',
    'Probe and confirm both unit counts are entered by the child.')
put('MEAS001-05-E', 'length-lab:tile_and_count', 'candidate',
    'The unit count the child enters is the recorded result in numbers.',
    'Confirm the recorded count is judged.')
put('MEAS001-05-F', 'length-lab:tile_and_count length-lab:order', 'candidate',
    'Measuring several objects with the same unit is tiling, and ordering them by the result is order, '
    'unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md).',
    'Probe order at K after tiling; confirm the bars stay comparable on a shared baseline.')
put('MEAS001-06-A', 'sorting-station:sort_one', 'partial',
    'Direct sensory experience is physical; sorting hot/cold pictures is the screen approximation.',
    'Keep the picture sort; the sensory half is an observation requirement.', PHYS)
put('MEAS001-06-B MEAS001-06-C', 'sorting-station:sort_one', 'candidate',
    'Sorting picture cards into hot/warm/cold or seasonal-weather categories is a semantic category sort, spoken one card at a time at K.',
    'Probe with the exact text; confirm the bins are temperature words and the cards are weather/object pictures with sayable names.')
put('MEAS001-06-D', 'fast-fact:recognize knowledge-check:recall', 'partial',
    'No thermometer primitive exists; a picture thermometer could be a recognize cue in fast-fact or a picture-primary knowledge-check item, but neither draws one today.',
    'Add a code-drawn zone thermometer stimulus.', 'picture-thermometer')
put('MEAS001-06-E', 'knowledge-check:apply', 'candidate',
    'Predicting which scenario warms or cools faster is a spoken-first application question with picture-primary K choices.',
    'Probe and confirm choices are pictures with the tutor reading the scenario aloud.')
put('MEAS001-06-F', 'di-spoken-practice:compare_choice', 'candidate',
    'Two things side by side, say hotter or colder from the closed set the objective names, is compare_choice.',
    'Confirm the two pictures are visibly different in temperature cue and the words are not printed as buttons.')
put('MEAS001-07-A', 'sorting-station:sort_one', 'candidate',
    'Activities as picture cards sorted into quick and long bins, spoken, is sort_one at K.',
    'Confirm the activity pictures are recognizable without labels.')
put('MEAS001-07-B', 'analog-clock:elapsed', 'partial',
    'A sand timer measuring a live activity is physical; the stopwatch in elapsed is the nearest screen tool but does not time an off-screen action.',
    'Keep as observation.', PHYS)
put('MEAS001-07-C', 'time-sequencer:duration-compare', 'candidate',
    'Ordering activities by duration is duration-compare, unfloored to K on the 2026-09-08 reader-fit '
    're-audit (qa/reader-fit/k-band-floor-2026-09-08.md).',
    'Probe duration-compare at K with three familiar activities and confirm the "about the same" option '
    'reads as a picture.')
put('MEAS001-07-D', 'time-sequencer:before-after', 'partial',
    'Predicting before/after a sand-timer marker is a live prediction; before-after (K since 2026-09-08) '
    'reasons about events, not timers.',
    'Keep as observation.', PHYS)
put('MEAS001-07-E', 'sorting-station:sort_one', 'candidate',
    'Match each activity to its time tool: sort_one with tool bins (sand timer, clock).',
    'Confirm bins are the tools and cards are the activities.')
put('MEAS001-07-F', 'time-sequencer:sequence-3 timeline-builder:sequence-daily', 'candidate',
    'Ordering daily routines on a timeline is sequence-3 at K or a daily timeline; duration vocabulary is spoken alongside, not judged.',
    'Probe sequence-3; confirm three routines in one day and that the initial order is shuffled.')
put('MEAS001-08-A', 'sorting-station:sort_one di-spoken-practice:say_answer', 'candidate',
    'Say empty or full for each pictured container is a closed-set spoken answer, as a sort or a say_answer item.',
    'Confirm containers are drawn with visible fill levels and no printed labels.')
put('MEAS001-08-B', 'di-spoken-practice:compare_choice', 'candidate',
    'Two identical containers with different amounts, say more or less, is compare_choice.',
    'Confirm the containers are identical and the fill difference is unambiguous.')
put('MEAS001-08-C', 'measure-lab:order_capacity', 'candidate',
    'Ordering three or more containers by amount is order_capacity (measure-lab, slice 7).',
    'Probe order_capacity with identical containers at different fill levels.')
put('MEAS001-08-D', 'compare-objects:compare_two', 'candidate',
    'Say which container holds more is the prediction half; the pour test is a classroom follow-up the objective allows.',
    'Confirm two different-shaped containers are drawn with a defensible answer.')
put('MEAS001-08-E', 'sorting-station:sort_one', 'candidate',
    'Grouping containers as small, medium or large is a size sort at K.',
    'Confirm the three size bins are visually distinct.')
put('MEAS001-08-F', 'measure-lab:pour_count', 'candidate',
    'Counting cups of rice or sand to fill a container is pour_count (measure-lab, slice 7).',
    'Probe with the exact text and confirm two containers are compared by cup count.')
put('MEAS001-09-A', 'bar-model:build_one_to_one', 'candidate',
    'Placing a sticker per choice is build_one_to_one (slice 7).',
    'Probe with a personal-choice framing.')
put('MEAS001-09-B', 'bar-model:match_to_bar bar-model:read_one_to_one', 'candidate',
    'Matching an object set to the bar or icon row that shows it is match_to_bar; reading how many from a one-to-one graph is read_one_to_one (both slice 7).',
    'Probe match_to_bar with the exact text.')
put('MEAS001-09-C', 'bar-model:most_least', 'candidate',
    'Most and least across three or four bars is most_least (slice 7); the reason is said aloud in the tutor loop.',
    'Probe most_least and confirm both most and least are asked in one session.')
put('MEAS001-09-D', 'bar-model:match_to_bar counting-board:compare', 'candidate',
    'Matching counters or objects to the chart that represents them is match_to_bar (slice 7); comparing the matched groups is the counting-board comparison.',
    'Probe match_to_bar with a manipulatives framing.')
put('MEAS001-09-E', 'bar-model:most_least bar-model:compare_bars', 'partial',
    'Within one data set, most/least and taller-bar reads are served (slice 7); comparing two RELATED sets still needs two graphs side by side.',
    'Add a two-graph comparison.', DATA)
put('MEAS001-09-F', 'knowledge-check:apply', 'partial',
    'Drawing one conclusion from a shown chart can be a spoken application question; suggesting actions is open reasoning.',
    'Probe knowledge-check apply with a chart in the stem; keep the action suggestion as discussion.')
put('MEAS001-09-G', 'knowledge-check:analyze', 'partial',
    'Predicting a future data pattern is an analysis question; at K the choices must be pictures and the reasoning stays spoken.',
    'Probe analyze at K for picture-primary choices.')

# ---- PTRN001 Patterns and Sorting -----------------------------------------------------------
put('PTRN001-01-A', 'pattern-builder:identify_core', 'candidate',
    'Finding the repeating unit in an object pattern is identify_core; sound patterns are not on screen.',
    'Confirm cores are AB/AAB/ABB at K.')
put('PTRN001-01-B', 'pattern-builder:extend', 'candidate',
    'The Copy phase precedes Extend inside pattern-builder; extend is the eval mode that judges the reproduced pattern.',
    'Confirm the copy phase is judged, not only displayed.')
put('PTRN001-01-C PTRN001-01-F', 'pattern-builder:extend', 'candidate',
    'Extending AB (and ABC) with color or shape tokens is the mode at K-1.',
    'Probe extend and confirm ABC cores appear when the objective names them (the constraint lists AB, AAB, ABB).')
put('PTRN001-01-D', 'pattern-builder:create', 'candidate',
    'Creating an AB pattern is the create mode. The catalog text places creation at grades 2-3, but the probe shows K creation challenges with a two-element core and distractor tokens, so the constraint text is stale rather than the generator.',
    'Refresh the catalog constraint wording; the K draw is sound.')
put('PTRN001-01-E', 'pattern-builder:extend', 'partial',
    'Filling a missing element inside a pattern is not a challenge type; extend only continues the end.',
    'Add a missing-element challenge.', PATTERN)
put('PTRN001-01-G', 'pattern-builder:create di-spoken-practice:explain_concept', 'candidate',
    'Creation with several elements is the create mode (K creation confirmed by the PTRN001-01-D probe); explaining the rule in own words is explain_concept, which the catalog names for patterns.',
    'Probe create with a multi-element core and explain_concept with a pattern stimulus.')
put('PTRN001-02-A', 'sorting-station:sort_one', 'candidate',
    'Sort by one obvious attribute, spoken, is sort_one at K.',
    'Confirm the attribute is the taught one.')
put('PTRN001-02-B', 'di-spoken-practice:explain_concept sorting-station:sort_attribute', 'candidate',
    'Saying the rule a sorted group follows is explain_concept over a shown instance; sort_attribute is the same act inside sorting-station but floored at Grade 1.',
    'Probe explain_concept with a sorted-group stimulus.')
put('PTRN001-02-C', 'sorting-station:sort_variety', 'candidate',
    'Re-sorting the same set by a different attribute is sort_variety, unfloored to K on the 2026-09-08 '
    'reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md).',
    'Probe sort_variety at K and confirm the rule actually rotates between rounds.')
put('PTRN001-02-D', 'sorting-station:two_attributes', 'candidate',
    'Two attributes at once is two_attributes, unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md).',
    'Probe two_attributes at K on colour AND shape; confirm the emoji matches its label on every card.')
put('PTRN001-02-E', 'sorting-station:sort_attribute sorting-station:sort_variety', 'candidate',
    'Choosing and labelling categories before sorting is open production. Both modes came down to K on the '
    '2026-09-08 reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md), and sort_attribute is the closer fit: the child SAYS how the set '
    'should be sorted before sorting it, which is the labelling act this objective names.',
    'Probe sort_attribute at K (not sort_variety); keep free category invention as discussion.')
put('PTRN001-02-F', 'di-spoken-practice:explain_concept', 'candidate',
    'A "because" statement about a shown sort is one short idea judged on meaning.',
    'Probe explain_concept with a sort stimulus and confirm the rule is not printed.')
put('PTRN001-02-G', 'sorting-station:odd_one_out', 'candidate',
    'Say which card does not belong, spoken at K.',
    'Confirm the explanation turn exists after the pick.')
put('PTRN001-03-A', 'ordinal-line:identify', 'partial',
    'First is an ordinal word the line asks for; last is not in the first-through-tenth vocabulary the tutor uses.',
    'Accept last (and end) as a place word at K in identify.')
put('PTRN001-03-B PTRN001-03-D', '', 'development',
    'Copying or inventing a movement sequence (clap-jump) is physical performance; no primitive observes movement.',
    'Record as an observation requirement.', PHYS)
put('PTRN001-03-C', 'time-sequencer:sequence-3 ordinal-line:build_sequence timeline-builder:sequence-daily', 'candidate',
    'Arranging three picture cards in logical order is sequence-3 at K, or a spoken-clue build on the ordinal '
    'line. The P1 that made this row unusable is FIXED (2026-09-08): the easy tier printed a clock time on '
    'every card and told the child to read it, because resolveSupportStructure took no grade. At K the anchor '
    'is now a sun-position picture derived from the same time (qa/reader-fit/time-sequencer-PRE-2026-09-08.md).',
    'Re-probed clean 2026-09-08: 26/26 content checks green on both draws, including "the child is not asked '
    'to READ clock times" (was failing 10/10 items). Owed: a live drive of the spoken half.')
put('PTRN001-03-E', 'time-sequencer:before-after', 'partial',
    'Identifying the missing middle step is not a challenge type; before-after (K since 2026-09-08) asks '
    'for a neighbour, not for a gap.',
    'Add a missing-step challenge to the sequencer.', PATTERN)
put('PTRN001-03-F', 'time-sequencer:sequence-5 ordinal-line:build_sequence', 'candidate',
    'Five-card story sequencing is sequence-5, unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/time-sequencer-PRE-2026-09-08.md); '
    'the ordinal line holds four spoken clues. The same slice fixed the card count -- the mode returned three '
    'cards because the schema required only three slots -- so a K draw now returns 4-5.',
    'Probe sequence-5 at K with story text; confirm 4-5 cards and that the sun-position cue agrees with the '
    'correct order.')

# ---- TIME001 Time and Calendar --------------------------------------------------------------
put('TIME001-01-A', 'time-sequencer:time-of-day', 'candidate',
    'Matching activities to morning/afternoon/night is time-of-day at K.',
    'Confirm sun-position cues are part of the stimulus.')
put('TIME001-01-B', 'time-sequencer:sequence-3', 'candidate',
    'Three daily routines in order is sequence-3 at K.',
    'Confirm the three are unambiguous in order.')
put('TIME001-01-C', 'time-sequencer:sequence-5 analog-clock:match', 'candidate',
    'Five timed activities route to sequence-5, unfloored to K on the 2026-09-08 reader-fit re-audit (qa/reader-fit/time-sequencer-PRE-2026-09-08.md); '
    'matching each to a clock face is analog-clock match. read-schedule is NOT the K home -- its floor HELD '
    '(qa/reader-fit/k-band-floor-2026-09-08.md), because reading printed clock times off a schedule IS its task.',
    'Probe sequence-5 at K; route the clock-time half to analog-clock match rather than read-schedule.')
put('TIME001-02-A', 'di-spoken-practice:say_answer', 'partial',
    'Reciting seven days in order is a sequence production; the spoken pack can ask one next-day question from the closed set of seven.',
    'Add a days-of-week sequence turn (say what comes after) to calendar-explorer or the spoken pack.', 'calendar-days-k')
put('TIME001-02-B TIME001-02-C TIME001-02-E', 'calendar-explorer:identify', 'candidate',
    'Finding today, yesterday, tomorrow or a marked event on the calendar is identify.',
    'Probe identify with the exact text; confirm today is marked and the target day is not pre-highlighted.')
put('TIME001-02-D TIME001-02-F', 'calendar-explorer:count', 'candidate',
    'Counting forward up to 7 days, or the days between two marked events, is count.',
    'Confirm counts stay within a week at K.')
put('TIME001-03-A', 'analog-clock:hand_name', 'candidate',
    'Naming the highlighted hand aloud is hand_name (slice 7).',
    'Probe hand_name and confirm both hands are asked across a session.')
put('TIME001-03-B', 'analog-clock:count_face', 'candidate',
    'Tapping 1 through 12 around the face in order is count_face (slice 7).',
    'Probe count_face and confirm the order is judged, not only the set.')
put('TIME001-03-C', 'analog-clock:read', 'candidate',
    'Read an o-clock face and pick the time; K is hour and half-hour only.',
    'Probe read with the exact text; confirm every face is :00 at K and the four options differ by hour.')
put('TIME001-03-D', 'analog-clock:hear_time analog-clock:match', 'candidate',
    'Hearing a spoken whole-hour time and picking the face is hear_time (slice 7); match remains the face-to-digital direction.',
    'Probe hear_time and confirm the spoken time is never printed.')
put('TIME001-03-E', 'analog-clock:set_time', 'candidate',
    'Drag the hour hand to a whole hour on the face is set_time.',
    'Confirm the minute hand is fixed at 12 for K.')
put('TIME001-03-F', 'analog-clock:match', 'candidate',
    'Match the analog face to its digital display for whole hours is match.',
    'Confirm distractor digital times differ by hour.')
put('TIME001-03-G', 'analog-clock:read time-sequencer:sequence-5', 'partial',
    'Linking times to activities in sequence is read-schedule, and its floor HELD on the 2026-09-08 '
    'reader-fit re-audit (qa/reader-fit/k-band-floor-2026-09-08.md): reading printed clock times off a schedule IS the task. Reading whole-hour '
    'times is served by analog-clock read, and the ordering half by sequence-5 (now K).',
    'Probe analog-clock read at K for the whole-hour half and sequence-5 for the ordering half; '
    'read-schedule stays Grade 1-2.', FLOOR)

assert len({r['id'] for r in rows}) == len(rows)
missing = [r['id'] for r in rows if r['id'] not in decisions]
extra = set(decisions) - {r['id'] for r in rows}
assert not missing and not extra, f'Missing {missing}; extra {extra}'
for r in rows:
    d = decisions[r['id']]
    d['requirementHash'] = hashlib.sha256(r['text'].encode()).hexdigest()
    d['reviewedAt'] = datetime.now(timezone.utc).isoformat()
    d['reviewer'] = 'Claude; explicit curriculum/action-to-catalog review'
    d['alternativesPolicy'] = 'Full catalog inventory inspected; absence of a candidate is a development recommendation, not a runtime proof of impossibility.'
audit = {'version': 1, 'subject': 'MATHEMATICS', 'grade': 'K', 'decisions': decisions,
         'catalogSources': basis['catalogSources'],
         'scope': 'All 166 live published K Mathematics requirements; catalog review for every row. Content evidence is separately scoped.'}
(OUT / 'review.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'reviewed': len(decisions), 'counts': {k: sum(d['fit'] == k for d in decisions.values()) for k in ['candidate', 'partial', 'development']},
                  'work': {w: sum(d['work'] == w for d in decisions.values()) for w in sorted({d['work'] for d in decisions.values() if d['work']})}}))
