"""Build the Science Kindergarten curriculum design review: manifests, bundle, briefs, HTML.

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
SUBJECT, GRADE, GRADE_LABEL, RUN = 'SCIENCE', 'K', 'Kindergarten', 'science-k-2026-10-17'

# ---------------------------------------------------------------------------
# Probe evidence: one draw per binding, judged by reading the payload.
# verdict: usable | partial | unfit (wrong content for this objective) | defect
# ---------------------------------------------------------------------------
PROBES = {
    ('SCI003-01-D', 'media-player', 'listen_and_look'): ('partial',
        'Three narrated segments (spring and summer merged into one, fall, winter), each with a picture question. The questions check details of the script, not weather evidence: "What keeps our hands warm during cold winter weather?" (mittens). The child never names a season from its weather.'),
    ('SCI003-01-D', 'knowledge-check', 'recall'): ('usable',
        '"Which weather shows that it is winter?" with snowy day (key), sunny beach, blooming flowers. The key is right. One item per draw, and the flowers distractor is not a kind of weather.'),
    ('SCI003-01-D', 'di-spoken-practice', 'say_answer'): ('defect',
        'Zero items after 96 s: "No matching practice is available for this task." The mode served nothing for a season-recall objective.'),
    ('SCI003-01-G', 'bar-model', 'make_graph'): ('partial',
        'Four weather graphs (sunny, rainy, cloudy, snowy days) from the code theme pool. The child makes counts that fit a rule ("rainy days have the fewest"). Nothing ties the counts to a place or season, so snowy and sunny days sit side by side. Graph practice, not weather evidence.'),
    ('SCI003-01-G', 'bar-model', 'say_what_it_shows'): ('partial',
        '2 of 4 graphs are weather (sunny, rainy, windy days); the other two are toys and playground equipment from the code-owned K settings. Every graph is labelled "Our survey", with no place or time.'),
    ('SCI003-01-G', 'bar-model', 'compare_two_graphs'): ('unfit',
        'No weather at all: toys, snacks, playground, vegetables. Every pair is labelled Morning vs Afternoon, which is hardcoded (gemini-bar-model.ts:1743-1750), so the mode cannot compare two places or two months.'),
    ('SCI001-03-G', 'how-it-works', 'guided'): ('partial',
        'Three picture steps: put a white and a black paper in the sun, wait, feel which got hotter. The questions ask which step a sentence describes. The result (the black paper gets warmer) is never shown or asked. The eval-test "fail" is the tester checking the item mode field; the items are identify items.'),
    ('SCI001-03-G', 'knowledge-check', 'recall'): ('usable',
        '"Which one gets warmer in the hot sun?" with black paper (key), white paper, ice cube. Correct, but it is recall of a result the child has not seen happen.'),
    ('SCI001-03-H', 'how-it-works', 'guided'): ('partial',
        'Pinwheel: cut the paper, pin the corners, blow to spin. "The wind makes it spin" is the only statement about energy. No battery or circuit.'),
    ('SCI001-03-H', 'how-it-works', 'sequence'): ('partial',
        'The same three pinwheel steps to put in order. This is ordering how to make it, not what the energy does.'),
    ('SCI004-01-G', 'ramp-lab', 'compare_conditions'): ('defect',
        'Code-owned pool. "Wheel or Box?" says only the load changes, but the box also gets medium friction against the wheel\'s low, so the test changes two things. The briefs are adult text ("Ask how much gravity points back down each ramp"), and labels such as "Gentle ramp" name the variable.'),
    ('SCI004-01-G', 'tower-stacker', 'build_tall'): ('partial',
        'Three towers to heights 4, 5 and 6. A real build-and-test loop, but each item is one design: nothing is predicted or compared.'),
    ('SCI004-01-F', 'gravity-drop-tower', 'predict'): ('partial',
        'Four pairs: hammer vs marble and rock vs marble with no air, bowling ball vs balloon and feather vs rock with air. An honest predict-then-watch, but of given objects, not of a design.'),
    ('SCI004-01-F', 'open-builder', 'build_to_goal'): ('partial',
        'Bridge, puppy house and cliff steps, judged from a picture of the build. A good K build loop. The third goal mixes up its animals ("Steps for Bunny" / "The kitten is stuck high on the cliff. Build steps so the bunny can hop all the way up to Kitten"). No prediction or comparison.'),
    ('SCI001-02-H', 'reaction-lab', 'predict'): ('partial',
        'Baking soda and vinegar, titled "Baking Soda Volcano", a title that gives away the fizzing and overflowing the questions ask about. A chemical reaction, not everyday materials combined into something with new properties. Four text options per item.'),
    ('SCI001-02-H', 'reaction-lab', 'observe'): ('defect',
        'Milk, dish soap and food colouring. The third item asks "Was mixing the soap into the milk a physical change or a chemical change?" with no options, so a kindergartner gets a typed-answer box and grade 5 vocabulary.'),
    ('SCI001-02-F', 'matter-explorer', 'sort'): ('usable',
        'Rock, water, air and sand, each answered aloud as solid, liquid or gas. The narration voices the clue ("takes the shape of whatever cup it goes into", "fills up space"), which helps without naming the state. Needs a microphone and the live tutor.'),
    ('SCI001-02-F', 'matter-explorer', 'property'): ('usable',
        'The same objects plus milk and steam: "What happens when you pour the water into a cup?" A good K observation question.'),
    ('SCI002-02-E', 'media-player', 'listen_and_look'): ('partial',
        'Bears sleep in dens all winter, birds build nests in spring, bunnies hide from rain. In the bear question the right answer is the only bear picture, so a child can match the picture to the word "bears" without listening. The third segment is about a rainy day, not a season.'),
    ('SCI002-02-E', 'di-spoken-practice', 'explain_concept'): ('usable',
        'Birds fly south, plants grow in spring, squirrels hide nuts. Each item has an accept rule ("Saying they are flying south is NOT an explanation"). Real why-questions judged on meaning. Needs a microphone.'),
    ('SCI002-02-E', 'knowledge-check', 'recall'): ('usable',
        '"What does a bear do when cold winter comes?" with sleeps in cave (key), swims, flies.'),
    ('SCI002-02-B', 'habitat-diorama', 'build_habitat'): ('usable',
        'Penguin, squirrel, deer and frog, each needing food, water and shelter, from mixed trays (fish, sea, ice and log for the penguin). Code-owned. Animals only.'),
    ('SCI002-02-B', 'sorting-station', 'sort_attribute'): ('partial',
        'Three rounds of six pictures into Food, Water and Shelter. Two leaks: "Fresh Water Drop" contains its bin\'s name, and "Sweet Apple" has the same apple picture as the Food bin. Items are sorted by what they are, with no animal or plant attached and no plant needs (sunlight, air).'),
}

def binding(cid, mode, title, intent, role):
    return {'componentId': cid, 'mode': mode, 'title': title, 'intent': intent, 'role': role}

# ---------------------------------------------------------------------------
# Lessons (authored). Each binding uses a current catalog id + eval mode
# (mode None only for a primitive with no eval modes).
# ---------------------------------------------------------------------------
LESSONS = [
  dict(id='SCI003-01-D', title='Weather Clues: Which Season Is It?', verb='identify',
    action='Hear or see what the weather is like (snow and cold, hot sun, falling leaves and cool wind, rain and new flowers) and name the season it points to.',
    sequence=[
      binding('media-player', 'listen_and_look', 'A Year of Weather',
              'Kindergarten. Four short narrated parts, one per season (winter, spring, summer, fall), each describing that season\'s WEATHER (temperature, snow, rain, sun, wind). Each check asks which season the described weather belongs to, with season pictures as options. Do not name the season in the same sentence as its weather clue.', 'introduction'),
      binding('knowledge-check', 'recall', 'Which Season Has This Weather?',
              'Kindergarten. Give a weather clue (cold with snow; hot and sunny; cool and windy with falling leaves; warm rain with new flowers) and ask which season it is. Options are seasons with pictures. Every distractor is a season.', 'independent check'),
      binding('knowledge-check', 'recall', 'New Weather Clues',
              'Kindergarten, fresh clues, same form; no clue from the previous activity.', 'fresh review'),
    ],
    minutes=14,
    evidence=['Names the season from a weather clue it has not heard before (knowledge-check).',
              'Using a record of weather over time (a month of sunny and snowy days) as evidence. NOT available in any primitive.'],
    limits=['No primitive has a child read a weather record and reach a season. The probes check recall of season facts.',
            'media-player asked about the script\'s details (mittens), not the season (probe).',
            'di-spoken-practice say_answer returned no items for this objective (probe).',
            'day-night-seasons is day and night only at K, and its K score counts actions, not answers.'],
    decision='new-mode', decisionText='Weather records in bar-model, shared with SCI003-01-G: real-looking weather counts for a named month or place, and a question that goes from the record to the season. See brief 1.'),
  dict(id='SCI003-01-G', title='Our Weather Graphs', verb='compare',
    action='Read a picture graph of sunny, rainy, cloudy and snowy days and say what it shows; then compare two graphs from different places or months.',
    sequence=[
      binding('bar-model', 'make_graph', 'Make a Weather Graph',
              'Kindergarten weather picture graph: sunny, rainy, cloudy and snowy days, one picture per day.', 'introduction + practice'),
      binding('bar-model', 'say_what_it_shows', 'What Does Our Weather Graph Show?',
              'Kindergarten. Every graph is a weather graph (sunny, rainy, cloudy, snowy or windy days). The child says one thing the graph shows.', 'main practice (spoken)'),
      binding('knowledge-check', 'recall', 'Read the Weather Graph',
              'Kindergarten. Describe a weather picture graph for one month (for example 6 snowy, 2 sunny, 1 rainy days) in the question and ask which weather happened the most. Picture options.', 'independent check'),
    ],
    minutes=15,
    evidence=['Says a true comparison of two kinds of weather on one graph (bar-model, tutor-judged).',
              'Comparing two places or two times. NOT available: compare_two_graphs is hardcoded to Morning vs Afternoon and returned no weather.'],
    limits=['compare_two_graphs is the mode that matches the objective and cannot carry it: labels are hardcoded and the probe gave toys and snacks.',
            'Counts are random in code, so a weather graph carries no real pattern (snowy days can win in July).',
            'say_what_it_shows gave weather in 2 of 4 graphs; the K setting list pulls the rest to toys and playgrounds.'],
    decision='new-mode', decisionText='The same bar-model extension as SCI003-01-D: weather data with a named place or month, and two-graph comparison between places or months. See brief 1.'),
  dict(id='SCI001-03-G', title='The Sun Warms Things Up', verb='investigate',
    action='Set up a fair sun test (a dark and a light surface, same sun, same time), say which will get warmer, check, and say what the sun did.',
    sequence=[
      binding('how-it-works', 'guided', 'How a Sun Test Works',
              'Kindergarten picture steps for a sun test: put a black and a white paper in the same sunny spot, wait, feel or check which is warmer. Do not state the result.', 'introduction (procedure)'),
      binding('knowledge-check', 'recall', 'Which Got Warmer?',
              'Kindergarten. Pairs of the same thing in different colours or materials left in the same sun (black vs white shirt, dark vs light pavement, sand in sun vs sand in shade). Ask which got warmer. Picture options.', 'independent check (recall)'),
      binding('take-home-activity', None, 'Try It at Home: Sun Papers',
              'Caregiver-led: black and white paper (or two cups of water under a black and a white cloth) in sunlight for 20 minutes; the child feels which is warmer and says why. Safety: no staring at the sun.', 'ungraded home experiment'),
    ],
    minutes=15,
    evidence=['Picks the darker surface as warmer in the sun (knowledge-check). This is recall, not an observed result.',
              'Running the test and reading the outcome. NOT available on screen; the home activity records nothing.'],
    limits=['No primitive models sunlight warming a surface. light-shadow-lab is shadows only; the only thermometer (energy-of-reactions) clamps to grade 5+.',
            'how-it-works sequences the procedure; the result is never part of the task (probe).',
            'take-home-activity is written for a caregiver and has no evaluation.'],
    decision='new-primitive', decisionText='Build a sun-warming test bench: the child chooses what to put in the sun or shade, predicts, waits, and reads a picture thermometer or touch scale. See brief 2.'),
  dict(id='SCI001-03-H', title='Wind and Battery Power', verb='create',
    action='Make something work using energy (blow on a pinwheel to make it spin; close a battery-wire-bulb loop to make light) and say what made it go.',
    sequence=[
      binding('how-it-works', 'sequence', 'Make a Pinwheel Spin',
              'Kindergarten picture steps: make a pinwheel, then blow or let the wind push it. Last step says the moving air makes it spin.', 'introduction'),
      binding('how-it-works', 'guided', 'How a Battery Lights a Bulb',
              'Kindergarten picture steps for a flashlight: battery, wires in a loop, bulb lights; if the loop is open the bulb stays dark.', 'introduction'),
      binding('knowledge-check', 'recall', 'What Makes It Go?',
              'Kindergarten. Show a device (pinwheel, flashlight, wind-up toy, sailboat) and ask what makes it move or light: wind, battery, a push. Picture options.', 'independent check'),
    ],
    minutes=13,
    evidence=['Names what makes a pictured device go (knowledge-check). Recall only.',
              'Building a device that works. NOT available: there is no circuit, battery or pinwheel primitive.'],
    limits=['circuit-builder and energy-converter exist only as idea comments (catalog physics.ts:396-398).',
            'how-it-works orders how to make the device; it never shows what happens if a step is missing (probe).',
            'NGSS puts circuits at grade 4. Battery loops in this K objective are a curriculum choice to confirm.'],
    decision='new-primitive', decisionText='A make-it-go device bench (close a loop to light a bulb, point wind at a pinwheel). Lower priority than brief 2 until the circuit scope question is answered. See brief 3.'),
  dict(id='SCI004-01-G', title='Which Design Works Better?', verb='evaluate',
    action='Look at two designs for the same job after a test (one tower fell, one stood; one ramp needed less push) and say which worked better and what showed it.',
    sequence=[
      binding('ramp-lab', 'compare_conditions', 'Which Ramp Needs Less Push?',
              'Kindergarten. Two ramp setups that differ in one thing; the child picks which needs less push, then sees the push measured.', 'introduction (given designs)'),
      binding('tower-stacker', 'build_tall', 'Build a Tower That Stands',
              'Kindergarten tower building: the child builds, tests, and rebuilds if it falls.', 'build-and-test practice'),
      binding('knowledge-check', 'recall', 'Which One Worked?',
              'Kindergarten. Describe two designs for the same job and what happened in the test (a wide tower stood, a thin tower fell; a boat with sides floated, a flat one sank). Ask which worked better. Picture options.', 'independent check'),
    ],
    minutes=15,
    evidence=['Chooses the design whose test result was better (knowledge-check). The result is told, not seen.',
              'Comparing two designs the child made and tested. NOT available in any primitive.'],
    limits=['ramp-lab compare_conditions: one pair changes two variables, the briefs are adult text, and labels name the variable (probe, rampChallenges.ts:200-212).',
            'tower-stacker, open-builder, bridge-builder each test one design; none asks which of two worked better.',
            'paper-airplane-designer has a flight log but never asks a K child to compare.'],
    decision='new-mode', decisionText='Add a two-design test to an existing build primitive (tower-stacker is the closest fit): build two, predict, test both, choose the better and say what showed it. Shared with SCI004-01-F. See brief 4.'),
  dict(id='SCI004-01-F', title='Guess, Build, Test', verb='apply',
    action='Before a test, say what will happen; run the test; record what happened by choosing a picture or word.',
    sequence=[
      binding('gravity-drop-tower', 'predict', 'Guess Then Drop',
              'Kindergarten. Predict which of two objects lands first, then watch the drop.', 'introduction (predict, then test)'),
      binding('open-builder', 'build_to_goal', 'Build It to Do the Job',
              'Kindergarten build projects (bridge, shelter, steps). Before pressing done, the child says whether they think it will work.', 'build-and-test practice'),
      binding('tower-stacker', 'build_tall', 'Tower Test',
              'Kindergarten towers; after each test the tutor asks the child to say what happened.', 'fresh review'),
    ],
    minutes=15,
    evidence=['Predicts and checks against the result for given objects (gravity-drop-tower).',
              'Predicting the outcome of their OWN design, and recording the observation as a picture or word. NOT scored anywhere.'],
    limits=['No primitive records an observation that is checked. reaction-lab\'s notebook is chemistry only.',
            'The spoken prediction in open-builder and tower-stacker above is an intent, not a scored step.',
            'push-pull-arena predict would fit but serves K the grade 1 configuration (tracker PPA-G1).'],
    decision='new-mode', decisionText='Same mode as SCI004-01-G: the prediction and the picture record are steps in the two-design test. See brief 4.'),
  dict(id='SCI001-02-H', title='Mix It and See', verb='investigate',
    action='Combine two everyday materials (sand and water, flour and water, two paint colours, salt in water) and say what the mix is like compared with what went in.',
    sequence=[
      binding('reaction-lab', 'observe', 'What Happened When We Mixed?',
              'Kindergarten. Everyday mixes only: sand + water makes mud that holds a shape, flour + water makes sticky dough, blue + yellow paint makes green, salt disappears in water. Picture options. No physical/chemical vocabulary. No typed answers.', 'main practice'),
      binding('knowledge-check', 'recall', 'Guess the Mix',
              'Kindergarten. Show two materials and ask what you get when you mix them (mud, dough, green paint). Picture options; distractors are other mixes.', 'independent check'),
    ],
    minutes=12,
    evidence=['Names what a familiar mix produces (knowledge-check).',
              'Describing a NEW property of the mix (sticky, holds a shape, new colour). Only partly: reaction-lab content is chosen by Gemini and leans to chemical reactions.'],
    limits=['Both probes drew classic reactions (baking soda volcano, magic milk), not combinations of materials. Nothing in code steers K to everyday mixes.',
            'The observe probe ended with an open "physical or chemical change?" item, which renders a typed box at K (tracker RXL-K1).',
            'The predict probe title "Baking Soda Volcano" gives away the answer.',
            'mixing-and-dissolving has the right materials but floors at grade 3.'],
    decision='new-mode', decisionText='A K mode in reaction-lab built on a code-owned list of everyday mixes and the properties of each result, with picture answers. See brief 5.'),
  dict(id='SCI001-02-F', title='Solid, Liquid or Gas?', verb='identify',
    action='Look at everyday things (rock, water, air, steam) and say whether each is a solid, liquid or gas, and what it does in a cup.',
    sequence=[
      binding('matter-explorer', 'property', 'What Does It Do in a Cup?',
              'Kindergarten everyday objects; does it keep its shape, take the cup\'s shape, or spread out to fill the space?', 'introduction'),
      binding('matter-explorer', 'sort', 'Solid, Liquid or Gas?',
              'Kindergarten everyday objects; the child says solid, liquid or gas for each.', 'main practice + mastery evidence'),
      binding('knowledge-check', 'recall', 'Which One Is a Liquid?',
              'Kindergarten. Picture options of everyday objects; ask which is a solid / a liquid / a gas.', 'fresh review (tap)'),
    ],
    minutes=13,
    evidence=['Says the state of each new object and what it does in a cup (matter-explorer, tutor-judged).',
              'Taps the right object for a named state (knowledge-check).'],
    limits=['matter-explorer and states-of-matter need a microphone and the live tutor; there is no tap path for credit.',
            'classification-sorter is not a tap fallback at K: two bins only and text cards.'],
    decision='reuse', decisionText='Reuse. matter-explorer fits this objective; knowledge-check is the tap fallback.'),
  dict(id='SCI002-02-E', title='Animals and Plants Through the Seasons', verb='explain',
    action='Say what an animal or plant does when the season changes (a bear sleeps through winter, birds fly south, leaves fall) and why.',
    sequence=[
      binding('media-player', 'listen_and_look', 'What Happens When It Gets Cold?',
              'Kindergarten. Narrated parts about seasonal change only (bears sleep in winter, birds fly to warm places, leaves fall in autumn, squirrels store nuts). Picture options that do not repeat the animal named in the question.', 'introduction'),
      binding('knowledge-check', 'recall', 'What Does It Do in Winter?',
              'Kindergarten. Name an animal or plant and a season; ask what it does. Picture options showing actions.', 'independent check'),
      binding('di-spoken-practice', 'explain_concept', 'Tell Me Why',
              'Kindergarten. Why-questions about seasonal behaviour: why do birds fly south, why do squirrels hide nuts, why does the bear sleep all winter. One idea per answer.', 'mastery evidence (spoken why)'),
    ],
    minutes=15,
    evidence=['Says why an animal changes what it does in a season (di-spoken-practice explain_concept, tutor-judged on meaning).',
              'Seeing a season change and the behaviour that follows. NOT available: no primitive has a season state.'],
    limits=['No primitive contains hibernation, migration or leaf-fall content in code; all of it is model-written.',
            'media-player\'s bear question showed the answer as the only bear picture (tracker MP-LL1).',
            'explain_concept needs a microphone.'],
    decision='new-mode', decisionText='Add a season-change mode to habitat-diorama: the same scene in summer and in winter, and the child matches each animal or plant to what it does and why. See brief 6.'),
  dict(id='SCI002-02-B', title='What Living Things Need', verb='classify',
    action='Give an animal the food, water and shelter it needs; sort pictures into food, water and shelter; say what a plant needs.',
    sequence=[
      binding('habitat-diorama', 'build_habitat', 'Build a Home That Has Everything',
              'Kindergarten: build a habitat with food, water and shelter for an animal.', 'main practice + mastery evidence'),
      binding('sorting-station', 'sort_attribute', 'Food, Water or Shelter?',
              'Kindergarten. Sort pictures into food, water and shelter for a named animal. Item labels must not contain the bin name; item pictures must not repeat the bin picture.', 'sorting practice (spoken)'),
      binding('knowledge-check', 'recall', 'What Does a Plant Need?',
              'Kindergarten. Plants need sunlight, water and air (and soil); ask which a plant needs. Picture options; distractors are animal needs like a den.', 'fresh review (plants)'),
    ],
    minutes=15,
    evidence=['Builds a habitat that meets food, water and shelter for a new animal without the needs being named (habitat-diorama, checked in code).',
              'Plant needs. Recall only (knowledge-check).'],
    limits=['build_habitat covers six animals and no plants.',
            'The sorting-station probe had two answer leaks (tracker SST-L1) and attached the items to no animal.',
            'classification-sorter cannot do a three-bin sort at K (two bins, text cards).'],
    decision='new-mode', decisionText='Add plants to build_habitat (sunlight, water, air, soil), in the same habitat-diorama work as the season mode. See brief 6.'),
]

ISSUES = [
  ('PPA-G1', 'push-pull-arena', 'all', 'MEDIUM', 'K served the grade 1 config',
   'The generator reads the grade from prose (`ctx.gradeContext.match(/grade\\s*(\\d|K)/i)`, gemini-push-pull-arena.ts:396, 410). The K prose ("kindergarten students (ages 5-6)...") has no "grade", so K falls to the "1" default. generationContext.ts:68 says never parse the grade from gradeContext; read ctx.grade. Source-confirmed, not probed.', 'GENERATOR'),
  ('RL-C1', 'ramp-lab', 'compare_conditions', 'MEDIUM', 'Confounded pair',
   'K probe 2026-10-17: "Wheel or Box?" says only the load changes, but the box has frictionLevel medium and the wheel low (rampChallenges.ts:200-212), so two things change in a lesson about fair tests. Also: briefs are adult text and setup labels ("Gentle ramp", "Smooth surface") name the variable.', 'CONTENT (code pool)'),
  ('RXL-K1', 'reaction-lab', 'observe', 'MEDIUM', 'Typed open item at K',
   'K probe 2026-10-17: the third item asks "physical change or chemical change?" with options null, which renders a typed answer for a kindergartner. The predict probe was titled "Baking Soda Volcano", giving away the fizzing it asks about. K content is unconstrained chemistry; see the design review brief 5.', 'GENERATOR'),
  ('DSP-K1', 'di-spoken-practice', 'say_answer', 'MEDIUM', 'Empty session',
   'K probe 2026-10-17 with SCI003-01-D ("Recognize and describe characteristics of the four seasons using evidence from weather patterns"): zero items after 96 s, "No matching practice is available for this task." explain_concept on a K science objective in the same run returned 3 good items. One draw; rate unmeasured.', 'GENERATOR'),
  ('MP-LL1', 'media-player', 'listen_and_look', 'LOW', 'Answer picture matches the question',
   'K probe 2026-10-17: "What do bears do in cold winter?" options "Sleep in dens" (bear picture), "Swim away" (fish), "Fly high" (eagle). The key is the only picture of the animal named in the question.', 'GENERATOR'),
  ('SST-L1', 'sorting-station', 'sort_attribute', 'LOW', 'Answer leak in labels and pictures',
   'K probe 2026-10-17 (food/water/shelter): "Fresh Water Drop" contains its bin name "Water", and "Sweet Apple" uses the same picture as the Food bin. Rule wanted: no item label contains a bin label, no item picture equals a bin picture.', 'GENERATOR'),
  ('OBD-1', 'open-builder', 'build_to_goal', 'LOW', 'Characters swapped in goal',
   'K probe 2026-10-17: title "Steps for Bunny", goal "The kitten is stuck high on the cliff. Build steps so the bunny can hop all the way up to Kitten!"', 'GENERATOR'),
]

from briefs_src import BRIEFS  # noqa: E402

def esc(s):
    return html.escape(str(s), quote=True)

def manifest_for(lesson):
    g, sub = published[lesson['id']]
    comps = []
    for i, b in enumerate(lesson['sequence'], 1):
        assert b['componentId'] in catalog, b['componentId']
        modes = {m['id'] for m in catalog[b['componentId']]['modes']}
        assert (b['mode'] in modes) if b['mode'] else not modes, (b['componentId'], b['mode'])
        config = {'subject': 'Science', 'unitTitle': g['unitTitle']}
        if b['mode']:
            config = {'targetEvalMode': b['mode'], **config}
        comps.append({'componentId': b['componentId'], 'instanceId': f"{lesson['id'].lower()}-{i}-{b['componentId']}",
                      'title': b['title'], 'intent': b['intent'], 'config': config})
    block = {'objectiveId': 'obj1', 'objectiveText': sub['description'], 'objectiveVerb': lesson['verb'], 'components': comps}
    layout = [{**c, 'objectiveIds': ['obj1']} for c in comps]
    return {'topic': lesson['title'], 'gradeLevel': GRADE_LABEL, 'themeColor': '#2f6f5e', 'subject': SUBJECT,
            'objectiveBlocks': [block], 'layout': layout}

def wrapper(lesson, n):
    g, sub = published[lesson['id']]
    return {'lessonId': f'lesson-{n:02d}',
            'curriculum': {'subject': SUBJECT, 'grade': GRADE, 'unitId': g['unitId'], 'skillId': g['skill']['id'],
                           'subskillId': sub['id'], 'description': sub['description'],
                           'targetPrimitive': sub.get('target_primitive'), 'targetEvalModes': sub.get('target_eval_modes')},
            'status': 'authored; catalog-checked; each binding generator-probed once; not hydrated as a lesson; not runtime-tested',
            'learnerAction': lesson['action'], 'estimatedMinutes': lesson['minutes'],
            'manifest': manifest_for(lesson),
            'sequence': [{'step': i, 'componentId': b['componentId'], 'evalMode': b['mode'], 'role': b['role']} for i, b in enumerate(lesson['sequence'], 1)],
            'evidenceCriteria': lesson['evidence'], 'coverageLimits': lesson['limits'],
            'recommendation': {'kind': lesson['decision'], 'rationale': lesson['decisionText']}}

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

# ---- write JSON + briefs -------------------------------------------------
(HERE / 'manifests').mkdir(exist_ok=True)
(HERE / 'briefs').mkdir(exist_ok=True)
wrappers = []
for n, lesson in enumerate(LESSONS, 1):
    w = wrapper(lesson, n)
    wrappers.append(w)
    (HERE / 'manifests' / f"{w['lessonId']}-{lesson['id']}.json").write_text(json.dumps(w, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(HERE / 'manifest-bundle.json').write_text(json.dumps(wrappers, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
for fname, (title, ids, body) in BRIEFS.items():
    (HERE / 'briefs' / fname).write_text(f'# {title}\n\nCurriculum IDs: {", ".join(ids)} ({SUBJECT}, grade {GRADE}). Source: design review {RUN}.\n' + body, encoding='utf-8')

# ---- validation ------------------------------------------------------------
ids = [l['id'] for l in LESSONS]
assert len(set(ids)) == 10 and set(ids) == set(published)
assert len({g['skill']['id'] for g in sample['selected']}) == 5
for l in LESSONS:
    g, sub = published[l['id']]
    assert sub['id'].startswith(g['skill']['id'])
inst = [c['instanceId'] for w in wrappers for c in w['manifest']['objectiveBlocks'][0]['components']]
assert len(inst) == len(set(inst))
for k in PROBES:
    assert k[0] in published and k[1] in catalog and k[2] in {m['id'] for m in catalog[k[1]]['modes']}
    assert (HERE / 'evidence' / f'{k[0]}-{k[1]}-{k[2]}.json').exists(), k

# ---- HTML --------------------------------------------------------------------
commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=HERE).stdout.strip()
DEC = {'reuse': ('Reuse', 'ok'), 'repair': ('Repair existing', 'warn'), 'new-mode': ('New mode', 'new'), 'new-primitive': ('New primitive', 'new')}
VER = {'usable': ('usable', 'ok'), 'partial': ('partial', 'warn'), 'unfit': ('wrong fit', 'bad'), 'defect': ('defect', 'bad')}

def lesson_html(n, l, w):
    g, sub = published[l['id']]
    label, cls = DEC[l['decision']]
    seq = ''.join(f"<li><span class='mono'>{esc(b['componentId'])}</span> · <span class='mono'>{esc(b['mode'] or 'no eval modes')}</span> <span class='role'>{esc(b['role'])}</span><div class='bt'>{esc(b['title'])}</div></li>" for b in l['sequence'])
    probes = ''.join(
        f"<tr><td class='mono'>{esc(p)}<br>{esc(m)}</td><td><span class='chip {VER[v][1]}'>{VER[v][0]}</span></td><td>{esc(t)}</td></tr>"
        for (i, p, m), (v, t) in PROBES.items() if i == l['id'])
    ev = ''.join(f'<li>{esc(x)}</li>' for x in l['evidence'])
    lim = ''.join(f'<li>{esc(x)}</li>' for x in l['limits'])
    fname = f"manifests/{w['lessonId']}-{l['id']}.json"
    return f"""
<section class="lesson" id="{esc(l['id'])}">
  <header class="lh">
    <div><div class="eyebrow">Lesson {n} · {esc(g['unitTitle'])} · {esc(g['skill']['description'])}</div>
    <h3>{esc(l['title'])}</h3></div>
    <span class="chip {cls}">{label}</span>
  </header>
  <p class="cur"><span class="mono">{esc(sub['id'])}</span> {esc(sub['description'])}</p>
  <p class="meta">Published target: <span class="mono">{esc(sub.get('target_primitive') or 'none')}</span> (provenance only) · Planned length {l['minutes']} min</p>
  <div class="grid2">
    <div><h4>Learner action</h4><p>{esc(l['action'])}</p>
      <h4>Sequence</h4><ol class="seq">{seq}</ol></div>
    <div><h4>Evidence of mastery</h4><ul>{ev}</ul>
      <h4>Limits found</h4><ul>{lim}</ul></div>
  </div>
  <div class="decision"><strong>{label}.</strong> {esc(l['decisionText'])}</div>
  <h4>Generator probes (one draw per binding, exact curriculum text, grade K)</h4>
  <div class="tw"><table class="probes"><tbody>{probes or '<tr><td colspan=3>Bindings in this lesson reuse probed modes from other lessons or were not probed (see table).</td></tr>'}</tbody></table></div>
  <details><summary>Manifest JSON · <a href="{esc(fname)}">{esc(fname)}</a></summary><pre>{esc(json.dumps(w['manifest'], indent=2, ensure_ascii=False))}</pre></details>
</section>"""

counts = {k: sum(1 for l in LESSONS if l['decision'] == k) for k in DEC}
vcounts = {k: sum(1 for v, _ in PROBES.values() if v == k) for k in VER}
rows = ''.join(f"<tr><td class='mono'><a href='#{esc(l['id'])}'>{esc(l['id'])}</a></td><td>{esc(published[l['id']][0]['skill']['description'])}</td><td>{esc(l['title'])}</td><td><span class='chip {DEC[l['decision']][1]}'>{DEC[l['decision']][0]}</span></td></tr>" for l in LESSONS)
issues = ''.join(f"<tr><td class='mono'>{esc(i)}</td><td class='mono'>{esc(p)}<br>{esc(m)}</td><td><span class='chip {'bad' if s=='HIGH' else 'warn'}'>{s}</span></td><td><strong>{esc(c)}.</strong> {esc(d)}</td></tr>" for i, p, m, s, c, d, _ in ISSUES)
briefs = ''.join(f"<details class='brief'><summary><strong>{esc(t)}</strong> · {esc(', '.join(ids))} · <a href='briefs/{esc(f)}'>briefs/{esc(f)}</a></summary><pre class='md'>{esc((HERE/'briefs'/f).read_text(encoding='utf-8'))}</pre></details>" for f, (t, ids, _) in BRIEFS.items())
sel = ''.join(f"<li><span class='mono'>{esc(g['skill']['id'])}</span> {esc(g['skill']['description'])}: {', '.join('<span class=mono>'+esc(s['id'])+'</span>' for s in g['selectedSubskills'])} <span class='muted'>(of {len(g['skill']['subskills'])})</span></li>" for g in sample['selected'])
lessons_html = ''.join(lesson_html(n, l, w) for n, (l, w) in enumerate(zip(LESSONS, wrappers), 1))

page = f"""<title>Science K Design Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,650&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column with a sticky section nav; lesson cards carry the detail. */
:root {{
  --bg:#f5f6f3; --surface:#ffffff; --fg:#1e2522; --muted:#5d6762; --line:#d9ddd8;
  --accent:#2f6f5e; --accent-soft:#e2eee9;
  --ok:#2c6e3f; --ok-bg:#e1f0e4; --warn:#8a5a00; --warn-bg:#f7ebcf; --bad:#a3322a; --bad-bg:#f6dfdc; --new:#2f4f9a; --new-bg:#e1e7f6;
  --display:"Source Serif 4", Georgia, serif; --body:"IBM Plex Sans", system-ui, sans-serif; --mono:"IBM Plex Mono", ui-monospace, Consolas, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#141917; --surface:#1c2320; --fg:#e4e9e6; --muted:#9aa5a0; --line:#2f3935;
  --accent:#7cc4ad; --accent-soft:#1f3a32;
  --ok:#8fd3a0; --ok-bg:#1d3324; --warn:#e9c071; --warn-bg:#3a2f14; --bad:#f0a199; --bad-bg:#3d2220; --new:#a9bdf0; --new-bg:#22294a; color-scheme:dark; }} }}
:root[data-theme="dark"] {{
  --bg:#141917; --surface:#1c2320; --fg:#e4e9e6; --muted:#9aa5a0; --line:#2f3935;
  --accent:#7cc4ad; --accent-soft:#1f3a32;
  --ok:#8fd3a0; --ok-bg:#1d3324; --warn:#e9c071; --warn-bg:#3a2f14; --bad:#f0a199; --bad-bg:#3d2220; --new:#a9bdf0; --new-bg:#22294a; color-scheme:dark; }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.6 var(--body); }}
.wrap {{ max-width:980px; margin:0 auto; padding-inline:16px; padding-block:28px 64px; }}
h1,h2,h3 {{ font-family:var(--display); text-wrap:balance; line-height:1.2; margin:0 }}
h1 {{ font-size:2.1rem; font-weight:650 }}
h2 {{ font-size:1.45rem; font-weight:650; margin-top:2.6rem; margin-bottom:.8rem }}
h3 {{ font-size:1.2rem; font-weight:650 }}
h4 {{ font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:1rem 0 .35rem }}
p, li {{ max-width:70ch }}
a {{ color:var(--accent) }}
a:focus-visible, summary:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px }}
.mono {{ font-family:var(--mono); font-size:.86em }}
.muted, .meta {{ color:var(--muted) }}
.meta {{ font-size:.85rem }}
.eyebrow {{ font-size:.74rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:.25rem }}
nav {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding-block:.5rem; display:flex; flex-wrap:wrap; gap:.4rem 1rem; font-size:.88rem }}
.lede {{ font-size:1.05rem; margin-top:.8rem }}
.stats {{ display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1rem }}
.chip {{ display:inline-block; padding:.08rem .55rem; border-radius:999px; font-size:.76rem; font-weight:600; white-space:nowrap }}
.chip.ok {{ background:var(--ok-bg); color:var(--ok) }} .chip.warn {{ background:var(--warn-bg); color:var(--warn) }}
.chip.bad {{ background:var(--bad-bg); color:var(--bad) }} .chip.new {{ background:var(--new-bg); color:var(--new) }}
.tw {{ overflow-x:auto }}
table {{ border-collapse:collapse; width:100%; font-size:.9rem }}
th, td {{ text-align:left; vertical-align:top; padding:.5rem .6rem; border-bottom:1px solid var(--line) }}
th {{ font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:600 }}
.lesson {{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:1.1rem 1.2rem; margin-top:1.2rem; scroll-margin-top:3.5rem }}
.lh {{ display:flex; justify-content:space-between; align-items:flex-start; gap:1rem }}
.cur {{ font-size:.9rem; background:var(--accent-soft); padding:.6rem .75rem; border-radius:6px; margin:.8rem 0 .4rem; max-width:none }}
.grid2 {{ display:grid; grid-template-columns:1fr 1fr; gap:0 1.6rem }}
.grid2 > div {{ min-width:0 }}
@media (max-width:720px) {{ .grid2 {{ grid-template-columns:1fr }} }}
ul, ol {{ padding-left:1.2rem; margin:.2rem 0 }}
.seq li {{ margin-bottom:.45rem }}
.role {{ color:var(--muted); font-size:.8rem }}
.bt {{ font-size:.86rem }}
.decision {{ border-left:3px solid var(--accent); padding:.4rem .8rem; margin:1rem 0 .2rem; background:var(--accent-soft); border-radius:0 6px 6px 0 }}
details {{ margin-top:.8rem }}
summary {{ cursor:pointer; color:var(--muted); font-size:.88rem }}
pre {{ background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:.7rem; overflow-x:auto; font:12.5px/1.5 var(--mono); max-height:420px }}
pre.md {{ white-space:pre-wrap; font-family:var(--body); font-size:.88rem; max-height:none }}
.brief {{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:.7rem 1rem }}
.brief summary {{ color:var(--fg) }}
dl {{ display:grid; grid-template-columns:max-content 1fr; gap:.3rem 1rem; font-size:.88rem }}
dt {{ color:var(--muted) }} dd {{ margin:0; min-width:0; overflow-wrap:anywhere }}
@media (max-width:520px) {{ dl {{ grid-template-columns:1fr }} .lh {{ flex-direction:column }} }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior:auto }} }}
</style>
<div class="wrap">
<div class="eyebrow">Curriculum design review · SCIENCE · Kindergarten · 2026-10-17</div>
<h1>Science K Design Review</h1>
<p class="lede">A seeded random draw of 5 published skills and 10 subskills, each planned as a 12-15 minute Lumina lesson from the live catalog. Every binding was drawn once through the production generator with the exact curriculum text at grade K. Only states of matter can be taught and measured with existing modes today. The other nine lessons run, but on recall questions: the child names a fact the screen or narrator tells them, where the objective asks for an investigation, a test or a reason from evidence. Closing that takes five interactions: weather records, a sun-warming test, a two-design test, everyday mixes, and seasons and plants in habitat-diorama; a sixth, an energy-device bench, waits on a ruling about circuits at K.</p>
<div class="stats"><span class="chip ok">{counts['reuse']} reuse</span><span class="chip new">{counts['new-mode']} new mode</span><span class="chip new">{counts['new-primitive']} new primitive</span><span class="chip ok">{vcounts['usable']} probes usable</span><span class="chip warn">{vcounts['partial']} partial</span><span class="chip bad">{vcounts['unfit'] + vcounts['defect']} wrong fit or defect</span></div>
<nav><a href="#findings">Findings</a><a href="#priorities">Build order</a><a href="#sample">Sample</a><a href="#lessons">Lessons</a><a href="#issues">Defects</a><a href="#briefs">Build briefs</a><a href="#provenance">Provenance</a></nav>

<h2 id="findings">What the sweep found</h2>
<ul>
<li><strong>K science in Lumina is mostly recall.</strong> knowledge-check, media-player and how-it-works carry any topic, so every lesson can be assembled. But the probes asked "which season has snow?" and "which paper gets warmer?" as facts to remember. The objectives ask the child to get those answers from weather records, a sun test or a design test.</li>
<li><strong>Weather data has the graph but not the weather.</strong> bar-model can draw a K weather picture graph, but its counts are random and its two-graph mode is hardcoded to Morning vs Afternoon class surveys. No primitive goes from recorded weather to a season. Brief 1.</li>
<li><strong>Energy has no primitive at all.</strong> Nothing models sunlight warming a surface, and there is no circuit or pinwheel primitive. Brief 2 (sun bench) is the priority; brief 3 (devices) waits on a ruling about circuits at K.</li>
<li><strong>Engineering builds test one design and record nothing.</strong> tower-stacker and open-builder are good K build loops. None predicts the result of the child's own design, records an observation, or compares two designs. Brief 4 adds that as one mode.</li>
<li><strong>Life science has a strong base in habitat-diorama.</strong> build_habitat checks food, water and shelter in code. It lacks plants and any season. Brief 6.</li>
<li><strong>Matter: states are covered, mixing is not.</strong> matter-explorer serves states of matter well (spoken). reaction-lab at K draws chemistry demonstrations, and once asked a typed physical-or-chemical question. Brief 5.</li>
<li><strong>Seven defects filed</strong> (two confirmed in source, five from single probes), including push-pull-arena serving K the grade 1 configuration and a ramp-lab "fair test" that changes two things.</li>
</ul>

<h2 id="priorities">Suggested build order</h2>
<ol>
<li><strong>Brief 4, two-design test</strong> (mode). It serves two objectives, reuses tower-stacker's code-checked test, and covers the K-2 engineering practice (K-2-ETS1-3) that no primitive covers now.</li>
<li><strong>Brief 6, habitat-diorama seasons and plants</strong> (two modes on a working K primitive). Serves two objectives.</li>
<li><strong>Brief 1, weather records</strong> (bar-model extension). Serves two objectives; the judge for spoken comparisons already exists.</li>
<li><strong>Brief 2, sun-warming bench</strong> (new primitive). One objective, but the only route to K-PS3-1 and K-PS3-2.</li>
<li><strong>Brief 5, everyday mixes</strong> (mode). Fix RXL-K1 first.</li>
<li><strong>Brief 3, energy devices</strong> (new primitive). After a ruling on circuits at K.</li>
</ol>

<h2 id="sample">Sample</h2>
<p>Seed <span class="mono">{sample['seed']}</span>, {sample['scopedSkillCount']} eligible skills, sampled without replacement at both levels.</p>
<ul>{sel}</ul>
<div class="tw"><table><thead><tr><th>Subskill</th><th>Skill</th><th>Lesson</th><th>Decision</th></tr></thead><tbody>{rows}</tbody></table></div>

<h2 id="lessons">Lessons</h2>
{lessons_html}

<h2 id="issues">Defects found (filed to qa/EVAL_TRACKER.md)</h2>
<div class="tw"><table><thead><tr><th>ID</th><th>Primitive · mode</th><th>Severity</th><th>Finding</th></tr></thead><tbody>{issues}</tbody></table></div>
<p class="meta">Each is from a single draw plus a source read. Rates are unmeasured except where the code makes the outcome certain (PPA-G1, RL-C1). Already tracked and not refiled: LCS-1 and LCS-2 (life-cycle-sequencer leaks), RXL-1 (reaction-lab explain).</p>

<h2 id="briefs">Build briefs</h2>
<p>Each brief stands alone for a new session and leaves schema, naming and build order to that session.</p>
{briefs}

<h2 id="provenance">Provenance and validation</h2>
<dl>
<dt>Curriculum</dt><dd>GET http://127.0.0.1:8000/api/curriculum/curriculum/SCIENCE?grade=K, saved as snapshot.json, sha256 <span class="mono">{sha(HERE/'snapshot.json')}</span>, 4 units, 11 skills</dd>
<dt>Sampler</dt><dd>.agents/skills/curriculum-design-review/scripts/sample_curriculum.py, {esc(sample['algorithm'])}, Python {esc(sample['pythonVersion'])}, sampled {esc(sample['sampledAt'])}. No skill was excluded for size.</dd>
<dt>Catalog</dt><dd>Live export through the Vite module runner (export-catalog.mjs) at commit <span class="mono">{commit}</span> plus the uncommitted working tree; {len(catalog)} primitives; catalog.json sha256 <span class="mono">{sha(HERE/'catalog.json')}</span></dd>
<dt>Probes</dt><dd>{len(PROBES)} draws via /api/lumina/eval-test (topic = intent = exact subskill text, grade=K, gradeLevel=Kindergarten, difficulty=medium), saved under evidence/. The endpoint's "fail" on media-player and how-it-works is its challenge-array shape check; the content was judged by reading each payload. The di-spoken-practice say_answer "fail" is a real empty session.</dd>
<dt>Source checks</dt><dd>Read-only code reads of bar-model, classification-sorter, day-night-seasons, timeline-builder, comparison-panel, knowledge-check, di-spoken-practice, light-shadow-lab, take-home-activity, how-it-works, engine-explorer, reaction-lab, mixing-and-dissolving, states-of-matter, matter-explorer, ramp-lab, tower-stacker, open-builder, paper-airplane-designer, vehicle-comparison-lab, push-pull-arena, gravity-drop-tower, bridge-builder, shape-strength-tester, habitat-diorama, sorting-station, media-player and life-cycle-sequencer. File:line citations are in the lesson limits, briefs and defects table.</dd>
<dt>Validated</dt><dd>10 distinct subskills under 5 distinct skills with parent membership; every binding's component and eval mode exists in the live catalog (take-home-activity has no eval modes and is bound without one); instance IDs unique; every probe file present; manifests are valid JSON.</dd>
<dt>Not done</dt><dd>No lesson was hydrated or run end to end, no Live or microphone session was driven, and each binding has one draw only. The authored intents (weather-only graphs, everyday mixes and so on) were not re-probed, so whether each generator follows them is unknown. Teaching effectiveness is not claimed.</dd>
</dl>
<p class="meta">Files: <a href="manifest-bundle.json">manifest-bundle.json</a> · <a href="sample.json">sample.json</a> · manifests/ · briefs/ · in the repo only: snapshot.json, catalog.json, evidence/ (qa/curriculum-design-review/science-k-2026-10-17/)</p>
</div>
"""
(HERE / 'index.html').write_text(page, encoding='utf-8')
print('ok', len(LESSONS), 'lessons,', len(PROBES), 'probes,', len(BRIEFS), 'briefs')
