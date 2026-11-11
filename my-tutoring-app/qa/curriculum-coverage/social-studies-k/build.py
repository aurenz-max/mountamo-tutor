# Builds audit.json from snapshot.json + families_src.py + the routes below. No model call.
import json, hashlib, collections
from families_src import FAMILIES

L = 'my-tutoring-app/src/components/lumina/'
snap = json.load(open('snapshot.json', encoding='utf-8'))
sha = hashlib.sha256(open('snapshot.json', 'rb').read()).hexdigest()
SUB = {}
for u in snap['curriculum']:
    for s in u['skills']:
        for ss in s['subskills']:
            SUB[ss['id']] = dict(unit=u['title'], skill=s['id'] + ' ' + s['description'], text=ss['description'],
                                 difficulty=ss.get('difficulty_range'), hint=ss.get('target_primitive'))

# route, target, executor, level, why; per-member level overrides in `lv`.
R = {
 'F01': dict(route='specialist', target='sorting-station/sort_one', executor=None, level=2,
   why=L + 'service/math/gemini-sorting-station.ts: resolveNamedCategories (L675-700) takes the bins the objective names (needs/wants is its own example); buildSortingObjectiveSection (L615-626) routes meaning-based groups to sortingAttribute "category"; K bin cap 3 (gradeBinCap L184), 4-6 cards; every answer spoken, reader none. Key is the Gemini-written card category, filtered by binLeak/sortChallengeFault.',
   lv={'SS003-02-G': (1, 'Four seasons need 4 bins; K cap is 3 (gradeBinCap L184).')}),
 'F02': dict(route='specialist', target='fast-fact/recognize', executor='/eval-fix (K options not voiced) then CV1', level=1,
   why=L + 'service/core/gemini-fast-fact.ts: one cue, pick its partner; K options must be a single emoji (L853-856); Gemini writes correctAnswer; nobody reads the options aloud (L847-851). Helper-tool and tree-paper fit as emoji; figure-achievement and symbol-meaning do not.'),
 'F03': dict(route='specialist', target='time-sequencer/sequence-3, before-after, time-of-day', executor=None, level=2,
   why=L + 'service/math/gemini-time-sequencer.ts: before-after floored to K (L41-45), match-time-of-day (L35-39), sequence-events; intent injected as THIS ACTIVITY\'S SPECIFIC FOCUS (L1433-1439). Order key is Gemini correctOrderCsv (L912-928); a random SCENARIO_THEMES value (L540-547) can pull classroom-routine events off topic.',
   lv={'SS004-03-B': (1, 'Story events, not a routine: nearest is the wonder-walk story-order stop (RL.K.2), not read for this objective.')}),
 'F04': dict(route='add-mode', target='timeline-builder', executor='/add-eval-modes timeline-builder (three_days); /eval-fix (K picture labels, four-season layout)', level=1,
   why=L + 'service/calendar/gemini-timeline-builder.ts: K lands in the K-1 band (L50) but labels are text only; sequence-yearly asks for exactly 5 events (L312, L318), four seasons only in the fallback (L445-452); no yesterday/today/tomorrow layout; correctPosition is Gemini-written (L108-113).'),
 'F05': dict(route='specialist', target='era-explorer/era_sort', executor=None, level=2,
   why=L + 'service/history/gemini-era-explorer.ts: K mapped (L110), K steer to lens_id and era_sort (L144); era_sort judges a present-tense life detail as era/today/both with code-built bins (SORT_SLOTS L89); easy tier asks for concrete objects (L410). Spoken, reader none.',
   lv={'SS004-01-G': (1, 'Family traditions: era_sort is tied to one named historical era, not the learner\'s family.'),
       'SS004-01-H': (1, 'Parents\' childhood is not a named era; era-explorer has no such era.'),
       'SS004-01-J': (1, 'The learner\'s own surroundings changing: no era fits.')}),
 'F06': dict(route='add-mode', target='map-explorer', executor='/add-eval-modes map-explorer (find_place: tap the named building; home continent)', level=1,
   why=L + 'primitives/visual-primitives/history/map/mapModel.ts: PLACE_KINDS (L30-32) has school, park, library, fire station, post office, police station, hospital (no city hall); tasks are find_by_direction, name_direction, build_route, find_on_globe, world_direction (L21); find_on_globe picks a random continent (L228-235). The world has the hands; no find-the-named-place task.'),
 'F07': dict(route='canvas-new', target='map-maker (not built)', executor='/canvas-primitive', level=0,
   why='map-explorer has no make-a-map task and no legend (mapModel.ts L21); the agent-kit map display has a legend (displays.ts) but is a display, not a placing task. Nothing has the action.'),
 'F08': dict(route='specialist', target='spatial-scene/place', executor=None, level=2,
   why=L + 'service/math/gemini-spatial-scene.ts VALID_POSITIONS (L213-216) has above, below, left_of, right_of; place/follow_directions are tap, reader none. Up/down are said as above/below.'),
 'F09': dict(route='specialist', target='knowledge-check/recall; foundation-explorer', executor='CV1 for depth', level=2,
   why='Knowledge family. ' + L + 'service/knowledge-check/gemini-knowledge-check.ts: K allows MC/TF only (L222), question read aloud, one emoji per option (L229-245); MultipleChoiceProblem.tsx L142-144 sends QUIZ_READ_ALOUD with the choices. foundation-explorer adds optionEmojis (L69-73) and preReadAloudFor reads every option (FoundationExplorer.tsx L386-397). Key is Gemini\'s.'),
 'F10': dict(route='specialist', target='knowledge-check/apply', executor=None, level=2,
   why='Knowledge family: the screen form is choosing the reason. Same knowledge-check K read as F09. A spoken reason (oral-sentence-studio say_why) refuses factual claims, so it does not serve these.'),
 'F11': dict(route='canvas-new', target='care-for-it (built 11-11)', executor='/canvas-primitive', level=2,
   why='qa/canvas/specs/care-for-it: canvas-check 5/5 both ways (classroom caps and put-away, classroom water, park recycling vs trash, empty house, Grandma reading); rest, proof and miss screenshots read.'),
 'F12': dict(route='canvas-new', target='coin-basket (built 11-11)', executor='/canvas-primitive', level=2,
   why='qa/canvas/specs/coin-basket: canvas-check 4/4 (lunch, cold day, storm kit, beach trip); screenshots read. coin-counter has no budget or choose-what-to-buy mode (catalog math.ts L3174-3237).',
   lv={'SS002-03-F': (1, 'Paying a helper for a task is a service bought, not a good: needs a coin-basket problem with a helper on the shelf.'),
       'SS002-02-H': (1, 'Goods and services in one marketplace: needs a coin-basket problem mixing a haircut or a bus ride with goods.')}),
 'F13': dict(route='canvas-new', target='market-stall (not built)', executor='/canvas-primitive', level=0,
   why='No primitive simulates demand changing with weather or scarcity; coin-counter "things to buy" are flavour (gemini-coin-counter.ts L804-813).'),
 'F14': dict(route='canvas-new', target='trade-day (not built)', executor='/canvas-primitive', level=0, why='Nothing has a trade between holders.'),
 'F15': dict(route='specialist', target='sorting-station/sort_one with only-A / both / only-B bins', executor='/eval-test sorting-station on SS005-01-G', level=1,
   why='sorting-station takes objective-named bins (3 at K), so a same/different sort is reachable, but no generation has shown a Venn-style "both" bin; content is cultural facts (open value space), so not a canvas.'),
 'F16': dict(route='native', target='CV2 oral-sentence-studio i_message', executor='/add-eval-modes oral-sentence-studio', level=0,
   why='oral-sentence-studio (catalog literacy.ts) has a scene and one judged spoken sentence; no social-conflict task. story-talk "How did they feel?" names a feeling but does not produce an I-message.'),
 'F17': dict(route='canvas-new', target='class-vote (not built)', executor='/canvas-primitive', level=0, why='sorting-station tally_record counts groups but no vote or turn schedule.'),
 'F18': dict(route='specialist', target='open-builder/build_to_goal', executor='/add-eval-modes open-builder (park, library, old and new home scenes)', level=2,
   why=L + 'primitives/visual-primitives/creation/openBuilderModel.ts L60-62: menu scenes include bridge (stream practice); goal judged by Gemini vision (gemini-open-builder-judge.ts L16-17).',
   lv={'SS001-04-F': (0, 'No park or library scene; kitten-shade is practice-only and cannot be picked (gemini-open-builder.ts L211).'),
       'SS004-04-H': (0, 'No old-and-new home scene.')}),
 'F19': dict(route='canvas-new', target='family-tree (not built)', executor='/canvas-primitive', level=0, why='Nothing places people into generations.'),
 'F20': dict(route='canvas-new', target='sign-walk (not built)', executor='/canvas-primitive', level=0, why='Nothing walks a character past signs.'),
 'F21': dict(route='add-mode', target='di-spoken-practice (repeat a greeting)', executor='/add-eval-modes di-spoken-practice', level=0,
   why='One voice task in the strand: route to a spoken specialist, not a converge. di-spoken-practice judges spoken frames; a non-English phrase is not in the word library, unverified.'),
 'F22': dict(route='ambiguous', target=None, executor='/curriculum-author (user decision)', level=0,
   why='The text names a product about the learner\'s own family or class (drawing, collage, poster, collection) and not what makes it correct.'),
 'F23': dict(route='ambiguous', target=None, executor='/curriculum-author (user decision)', level=0,
   why='Participation with peers in a classroom (pledge, discussion, town meeting, crafts, role-play): not observable on a screen.'),
}

subskills, fams = [], []
for f in FAMILIES:
    r = R[f['id']]
    fams.append(dict(key=f['id'], name=f['name'], subskillIds=f['members'], kind='knowledge' if f['id'] in ('F09', 'F10') else 'action',
                     action=f['action'], evidence=f['evidence'], access=f['access'], route=r['route'], target=r['target'],
                     routeWhy=r['why'], executor=r['executor']))
    for m in f['members']:
        lvl, why = r.get('lv', {}).get(m, (r['level'], r['why'][:220]))
        s = SUB[m]
        subskills.append(dict(id=m, unit=s['unit'], skill=s['skill'], text=s['text'], family=f['id'], route=r['route'], level=lvl, levelWhy=why))
subskills.sort(key=lambda x: x['id'])

RECORDS = {
 'F11': dict(objective='Find what is not cared for in a shared place and fix each thing with its own fix, leaving cared-for things alone.',
   notCredit='Tapping every thing; tidying only what is on the floor; switching off a light where someone is.',
   misconceptions=['only loose things count as mess (cap left off, tap left running)', 'everything goes in the trash', 'save energy means everything off, even where someone is reading'],
   progression='classroom put-away and caps -> water left running -> park bins (recycle vs trash) -> empty house -> Grandma reading (one light must stay on)'),
 'F12': dict(objective='With a fixed number of coins, buy what the situation needs before what is only wanted.',
   notCredit='Buying everything affordable in shelf order; a want first so a need no longer fits.',
   misconceptions=['the thing I like most is a need', 'there will be coins left for everything', 'a need is the same in every situation (a coat on a beach day)'],
   progression='lunch with spare coin -> cold day (sled tempts) -> storm kit, budget exact -> beach trip, a want fits after all needs'),
 'F13': dict(objective='Predict what people will want on a given day and stock a stall with it; when something runs out, the price or the queue shows scarcity.',
   notCredit='Stocking the same things every day; choosing by what the child likes.',
   misconceptions=['people want the same things whatever the weather', 'running out means nobody wanted it', 'a cheaper price means a thing is worse'],
   progression='rainy vs sunny (umbrellas, sunglasses) -> hot day (lemonade sells out) -> only 3 lemons, 6 buyers: who gets one -> sale day: lower the price of what is not selling'),
 'F07': dict(objective='Turn a picture of a room or block into a bird\'s-eye map: each symbol where its thing is, read through the legend.',
   notCredit='Symbols anywhere on the plan; a symbol whose meaning is not the legend\'s.',
   misconceptions=['a map is a side-view picture', 'left and right swap when looking down', 'symbols can be any size or place as long as they are all there'],
   progression='3 things in a room with the legend shown -> 5 things, two of one kind -> a block with park, library, school -> read a finished map: which picture does it show'),
 'F14': dict(objective='Trade surpluses between neighbours so every one ends with what they need.',
   notCredit='Giving everything to one neighbour; a trade that leaves someone without.',
   misconceptions=['trading means losing', 'every trade must be the same thing for the same thing', 'one trade fixes everyone'],
   progression='2 neighbours, one swap -> 3 neighbours in a ring (A has B\'s need, B has C\'s, C has A\'s) -> farmer and baker: wheat for bread -> a neighbour with nothing to trade: share'),
 'F17': dict(objective='Count a class vote to find the winner, and plan turns so everyone gets one on a shared thing.',
   notCredit='Choosing the winner by the child\'s favourite; a schedule where one child goes twice.',
   misconceptions=['the first choice called wins', 'the biggest pile of pictures wins even when pictures are different sizes', 'fair means the first in line goes again'],
   progression='2 choices, 7 votes -> 3 choices -> a tie: vote again -> 4 children, 1 swing, 3 turns each'),
}
for f in fams:
    if f['key'] in RECORDS: f['record'] = RECORDS[f['key']]

canvases = [
 dict(rank=1, canvas='market-stall (new)', families=['F13'], cost='new program', subskillIds=FAMILIES[12]['members']),
 dict(rank=2, canvas='map-maker (new)', families=['F07'], cost='new program', subskillIds=FAMILIES[6]['members']),
 dict(rank=3, canvas='trade-day (new)', families=['F14'], cost='new program', subskillIds=FAMILIES[13]['members']),
 dict(rank=4, canvas='class-vote (new)', families=['F17'], cost='new program', subskillIds=FAMILIES[16]['members']),
 dict(rank=5, canvas='coin-basket (new params)', families=['F12'], cost='new params', subskillIds=['SS002-03-F', 'SS002-02-H']),
 dict(rank=6, canvas='family-tree (new)', families=['F19'], cost='new program', subskillIds=FAMILIES[18]['members']),
 dict(rank=7, canvas='sign-walk (new)', families=['F20'], cost='new program', subskillIds=FAMILIES[19]['members']),
]
built = [dict(canvas='care-for-it', families=['F11'], subskillIds=FAMILIES[10]['members'], check='5/5'),
         dict(canvas='coin-basket', families=['F12'], subskillIds=['SS002-01-D', 'SS002-01-F', 'SS002-01-H', 'SS002-03-G'], check='4/4')]

convergence = [
 dict(id='CV1', strand='K social-studies knowledge with pictures: helpers, tools, places, symbols, goods, features, partners (F02 + F09)',
   families=['F02', 'F09'], subskillIds=FAMILIES[1]['members'] + FAMILIES[8]['members'],
   signals=['open value space: helpers, tools, workplaces, buildings, symbols, resources and products are a large set, each item a picture with a fact',
            'frequency: 29 of 159 subskills (18%) across all five units',
            'same world, two families: a picture, a narrated idea, tap which picture fits or which is its partner',
            'non-reader: fast-fact K options are never read aloud (gemini-fast-fact.ts L847-851); a pre-reader needs the narration wonder-walk already has'],
   target='wonder-walk gains a social-studies walk (helpers and their tools, places in town, symbols, goods and services, natural and human-made) through /agent-primitive, the way LA C1/C3 added worlds',
   executor='/agent-primitive', absorbs='none built; knowledge-check and fast-fact keep serving until it is at level 2',
   acceptance=['helper to tool: the tutor names a firefighter, the child taps the hose among 3 pictures; the shown example is never an option',
               'place purpose: "where do we borrow books?" taps the library among library, park, post office',
               'resource to product: tree -> paper, sheep -> sweater, with a new pair each stop',
               'no printed words on any card (wonder-walk constraint)']),
 dict(id='CV2', strand='Conflict resolution and respectful talk (F16)', families=['F16'], subskillIds=FAMILIES[15]['members'],
   signals=['voice: the answer is a sentence the child says ("I feel sad when you take my blocks")',
            'levers and named misses: a "you" blame sentence, a feeling with no cause, a cause with no feeling',
            'frequency: 8 subskills across two skills of Unit 1',
            'open value space: scenarios (taking turns, being left out, a broken toy) vary every run'],
   target='oral-sentence-studio gains an i_message mode: a pictured conflict, the child says what they would say; the tutor judges feeling + cause + no blame; a turn-taking/apology/listening variant',
   executor='/add-eval-modes oral-sentence-studio', absorbs='none',
   acceptance=['credit "I feel sad when you take my truck"; refuse "You are mean"', 'credit "Can I have a turn after you?" on a turn-taking scene',
               'a listening reply repeats what the friend said ("You are sad because...")']),
]

audit = dict(scope='social-studies-k', subject='SOCIAL_STUDIES', grade='K', auditedAt='2026-11-11', snapshotSha256=sha,
  method='Main session wrote action, evidence and access for all 159 subskills into 23 families and routed them from the live catalog, the canvas specs and the agent kit; one read-only agent read the generators of 11 candidate specialists (paths and lines in routeWhy). Level 2 rests on a generator read or a passing canvas-check with screenshots read. No generation, no play. No SS-K panel existed to carry over.',
  modelSpendUsd=0, subskills=subskills, families=fams, canvases=canvases, built=built, convergence=convergence)
json.dump(audit, open('audit.json', 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

# score
c = collections.Counter(s['level'] for s in subskills)
print('levels', dict(c), 'L2+', sum(v for k, v in c.items() if k >= 2), 'of', len(subskills))
byu = collections.defaultdict(lambda: [0, 0])
for s in subskills: byu[s['unit']][1] += 1; byu[s['unit']][0] += s['level'] >= 2
print('by unit', dict(byu))
byr = collections.defaultdict(lambda: [0, 0])
for s in subskills: byr[s['route']][1] += 1; byr[s['route']][0] += s['level'] >= 2
print('by route', dict(byr))
