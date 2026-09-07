"""Reproducible, explicitly authored K Language Arts capability review.

These are agent-reviewed decisions, not inferred from legacy assignments. A catalog
candidate is not content-verified. Exact source scope and evidence travel with the rows.
"""
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa/curriculum-coverage'
rows = json.loads((OUT / 'requirements.json').read_text(encoding='utf-8'))
catalog = json.loads((OUT / 'catalog-export.json').read_text(encoding='utf-8'))
lookup = {p['id']: p for p in catalog}
basis = json.loads((OUT / 'review-basis.json').read_text(encoding='utf-8'))
assert {r['id']: hashlib.sha256(r['text'].encode()).hexdigest() for r in rows} == basis['requirements'], 'Curriculum changed; re-review affected decisions before updating review-basis.json'
assert all(hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == h for p, h in basis['catalogSources'].items()), 'Catalog changed; re-review capabilities before updating review-basis.json'
decisions = {}

def put(ids, candidates, fit, reason, action, work=''):
    if isinstance(ids, str): ids = ids.split()
    for rid in ids:
        assert rid not in decisions, f'Duplicate review {rid}'
        edges = []
        for spec in candidates.split():
            pid, mode = spec.split(':')
            assert pid in lookup, pid
            assert any(m['id'] == mode for m in lookup[pid]['modes']), spec
            edges.append({'primitive': pid, 'mode': mode,
                          'source': 'src/components/lumina/service/manifest/catalog/' + lookup[pid]['domain'] + '.ts'})
        decisions[rid] = {'fit': fit, 'candidates': edges, 'reason': reason,
                          'nextAction': action, 'work': work, 'reviewLevel': 'catalog',
                          'content': 'not_tested', 'interaction': 'not_tested', 'evidence': []}

def select(skill): return [r['id'] for r in rows if r['skill'] == skill]
def textselect(skill, needle): return [r['id'] for r in rows if r['skill'] == skill and needle.lower() in r['text'].lower()]

# Sound awareness: distinguish sounds produced from words/menus/counts produced.
for needle, mode in [('Recognize if','recognition'),('Identify the rhyming','identification'),('Produce a word','production')]:
    put(textselect('Rhyme Recognition & Production',needle),f'rhyme-studio:{mode}','candidate',
        'The exact mode supports the requested oral rhyme action at K, with spoken cues and no independent reading requirement.',
        'Generate the published objective and check rhyme validity and the spoken correction loop.')
put(textselect('Syllable Blending & Segmentation','Blend'),'phoneme-explorer:blend','partial',
    'Phoneme blending produces the whole word, but syllable-clapper counts beats rather than blending syllable chunks. Phonemes and syllables are different task units.',
    'Add syllable-chunk blending to the oral blending family; test cow + boy and three-chunk words.','syllable-blending')
put(textselect('Syllable Blending & Segmentation','Segment'),'syllable-clapper:medium','partial',
    'Clapping and saying a count supports segmentation awareness; the implementation does not judge production of each syllable.',
    'Verify clapping/counting support and decide whether separately spoken syllables are required by the assessment.','sound-production')
put(textselect('Onset-Rime Blending & Segmentation','Blend'),'phoneme-explorer:blend','partial',
    'The mode blends individual phonemes. The requirement specifies onset plus rime, so chunk boundaries need explicit generator support.',
    'Add an onset-rime chunk configuration and test c + at without decomposing the rime.','syllable-blending')
put(textselect('Onset-Rime Blending & Segmentation','Isolate'),'phoneme-explorer:segment','partial',
    'Segment mode asks how many sounds, not production of onset and rime.',
    'Add a two-part onset/rime response contract; do not count phoneme totals as equivalent evidence.','sound-production')
put(textselect('Phoneme Isolation','beginning'),'di-letter-sounds:first_sound_in_word phoneme-explorer:isolate','partial',
    'The DI mode elicits the sound for continuant onsets only. Phoneme-explorer elicits a word with that onset, not the isolated sound.',
    'Separate continuant production from stop-sound recognition; keep coverage limitations visible.','sound-production')
put(textselect('Phoneme Isolation','ending'),'phoneme-explorer:segment','partial',
    'Neither initial-only isolate nor medial vowel matching provides an ending-sound response. Counting phonemes is not ending-sound identification.',
    'Extend phoneme-explorer with an explicit ending-sound matching/production contract. Rhyme judgment is not a replacement.','ending-sounds')
put(textselect('Phoneme Isolation','medial'),'phoneme-explorer:medial cvc-speller:fill_vowel','candidate',
    'Medial mode compares the middle short vowel; fill_vowel elicits that vowel sound from a CVC frame. These are distinct, relevant ways to identify it.',
    'Test actual short-vowel objectives; record recognition and production evidence separately.')
put(textselect('Phoneme Blending & Segmentation','Blend'),'phoneme-explorer:blend','candidate',
    'The oral blend mode combines three heard phonemes into a spoken CVC word.', 'Generate CVC trials and verify sound sequence and final word.')
put(textselect('Phoneme Blending & Segmentation','Segment'),'phoneme-explorer:segment cvc-speller:spell_word','partial',
    'One counts sounds; the other builds three graphemes. Neither alone proves the child can orally segment the word into three phonemes.',
    'Add a scored phoneme-by-phoneme segmentation response.','sound-production')
for needle,mode in [('Add','addition'),('Delete','deletion'),('Substitute','substitution')]:
    put(textselect('Phoneme Manipulation',needle),f'sound-swap:{mode}','candidate',
        'The dedicated manipulation mode asks for the changed real word after the exact sound operation.', 'Check real-word results, phoneme boundaries and correction feedback.')
put(select('Letter Recognition'),'letter-spotter:find_it letter-spotter:match_it','candidate',
    'Visual letter search and uppercase/lowercase matching serve the recognition skill. These do not certify every letter sound also mentioned in the broad group description.',
    'Bind the cumulative letter group from the objective; check new and review letter coverage.')
put(select('Letter-Sound Correspondence'),'letter-sound-link:see_hear letter-sound-link:hear_see','partial',
    'Production is restricted to held sounds; the reverse tap direction covers other correspondences but cannot establish their spoken production.',
    'Report each cumulative letter separately and preserve the stop/cluster production limitation.','sound-production')
put(select('Letter Formation'),'','development',
    'Two existing LetterTracing components display letters and stroke guides but capture no drawing input and score no strokes. Number and shape tracing assess different forms. No reviewed interactive letter-formation contract covers trace, copy and independent writing.',
    'Reuse the existing letter displays and inspect tracing input infrastructure; implement letter-specific stroke capture and scoring with cumulative groups, uppercase/lowercase and separate trace/copy/write modes.','letter-writing')
put(select('Decoding CVC Words (Reading)'),'di-word-reading:cvc_reading phonics-blender:cvc','candidate',
    'Both modes support short-vowel CVC decoding. Each published vowel focus and cumulative contrast must constrain generated words.',
    'Probe each vowel and the mixed set; check the printed word is not spoken before the cold attempt.')
put(select('Encoding CVC Words (Spelling)'),'cvc-speller:spell_word','candidate',
    'The student hears the word and places three letters in boxes, directly matching the encoding action.',
    'Probe each named vowel and inspect audible prompt, letter-bank solvability and submitted spelling.')
for needle,spec,fit,reason in [
    ('Real & Nonsense','word-workout:real_vs_nonsense','candidate','The child decodes real/nonsense alternatives; enforce distinct starting consonants needed by the spoken judge.'),
    ('Decodable Phrases','di-sentence-reading:decodable_sentence','partial','Short isolated CVC sentences can be read aloud, but the requested comprehension needs separate evidence; word-workout sentence_reading has a Grade 1 floor.'),
    ('Fluency','word-workout:word_chains di-word-reading:word_reading_review','candidate','Chains and mixed review elicit repeated cold word reading. Speed/automaticity still needs timing evidence, not just correct words.'),
    ('Match CVC','word-workout:picture_match','candidate','The child decodes a printed word and taps its referent; the tutor must not read the target first.')]:
    put([r['id'] for r in rows if r['unit']=='Phonics & Word Recognition' and needle.lower() in r['text'].lower()],spec,fit,reason,'Generate scope-constrained trials and verify the action and scoring.')

# Print foundations.
put('LA001-01-C LA001-01-D LA001-01-G','interactive-book:find-feature','partial',
    'Book-feature pointing provides a print surface, but it does not score text directionality, letter/word/space discrimination or word counting.',
    'Extend interactive-book with print-navigation, print-unit and word-count tasks.','print-concepts')
put('LA001-03-A','letter-spotter:match_it letter-spotter:find_it','candidate','Case matching and visual letter recognition are exact declared tasks.','Verify recognition in context as well as isolated grids.')
put('LA001-03-B','letter-sound-link:see_hear letter-sound-link:hear_see','partial','Reverse recognition covers the alphabet; isolated production excludes stops and clusters.','Track the distinct correspondence directions.','sound-production')
put('LA001-03-C','phonics-blender:cvc phonics-blender:cvce_blend','partial','Short and silent-e decoding are available, but contrastive long/short auditory discrimination is not a dedicated mode.','Add or probe a contrastive vowel task rather than claiming two separate decoding sessions establish discrimination.','vowel-contrast')
put('LA001-03-D','phoneme-explorer:blend cvc-speller:spell_word','partial','Oral blending and a three-box spelling manipulative provide parts of the task; oral segmentation is not judged.','Add separate segmentation evidence.','sound-production')
put('LA001-03-E','di-word-reading:sight_word di-sentence-reading:sight_phrase_sentence','candidate','Dedicated sight-word and sight-phrase reading cover isolation and short text.','Use the published sight-word scope and check cold reading.')
put('LA001-03-F','phonics-blender:digraph phonics-blender:cvce_blend','candidate','Digraph and consonant-blend tasks are declared at K-2.','Verify named digraphs/blends in actual word sets.')
put('LA001-03-G','word-flip:plural_s word-flip:past_ed','partial','Morphology practice supports endings but does not assess reading them or compound-word comprehension; word-builder requires reading a Grade 3+ morpheme board.','Extend early decoding to inflected and compound words.','extended-decoding')
put('LA001-03-H','word-workout:word_chains','partial','One-letter-change chains exercise spelling contrasts but not choosing meaning from sentence context.','Add context-disambiguation trials for near-spelled words.','extended-decoding')

# Oral participation and expression: avoid assigning a short-answer pack to arbitrary speech.
put('LA003-01-A','spatial-scene:follow_directions','partial','Two-step spatial placement can be observed, but classroom actions and 90% accuracy across them are outside this grid.','Define which instructions can be digitally enacted and add observable non-spatial actions.','oral-interaction')
put('LA003-01-E','story-talk:who_what_where','partial','Short read-aloud detail recall is supported, but retaining three details from an oral presentation needs an explicit multi-detail task.','Probe one presentation with three distinct recall targets.','listening-presentation')
put('LA003-02-E','story-planner:story_structure','partial','Picture choices and arc ordering scaffold sequencing, but the child does not deliver a scored personal narrative.','Add recorded retelling with transition-word and event-order evidence.','oral-storytelling')
put('LA003-01-D LA003-01-F LA003-01-J LA003-02-B LA003-02-C LA003-02-G LA003-02-H','','development',
    'These require student-generated questions, multi-sentence descriptions, dialogue, presentation or audible delivery. DI spoken practice is limited to short answers/ideas; reading aloud is not spontaneous speaking.',
    'Create an oral-language conversation/presentation task with an explicit rubric and retained audio evidence; do not substitute closed-word recall.','oral-interaction')

# Grammar, reviewed against learner action, not the old ai-tutor-session assignment.
put('LA004-01-A','word-sorter:binary_sort','partial','Spoken categorization with picture cues supports noun/verb discrimination, but it does not let the child manipulate cards and does not guarantee people/places/things all appear.','Test noun/verb content and report the spoken action and noun-category coverage explicitly.','picture-sorting')
put('LA004-01-D','word-sorter:binary_sort','candidate','Two spoken categories can contrast common/proper nouns with familiar concrete examples.','Generate paired common/proper examples and ensure category names are sayable.')
put('LA004-01-C LA004-01-E LA004-01-G LA004-01-I LA004-02-F LA004-02-G LA004-02-H LA004-04-I','sentence-builder:simple sentence-builder:compound','partial',
    'Word-tile construction is a relevant scaffold, but it requires following printed tiles and is cataloged for Grades 1-6; it does not score spontaneous K oral sentences or guarantee picture support.',
    'Extend sentence-builder with audible pictured tiles and a K sentence-production contract; choose simple or compound by the exact objective.','k-sentence-builder')
put('LA004-01-K LA004-02-C','sentence-builder:simple','partial','Arranging tiles directly matches the action. K access still needs audible/picture-supported tiles; the current tiles are printed and color-coded.','Verify or implement a K accessible tile path and grammatical answer checking.','k-sentence-builder')
put('LA004-01-F','spatial-scene:place spatial-scene:place_in spatial-scene:place_between','partial','The grid enacts position, containment and between; describing self-created locations aloud is a different response.','Test all named relations and add spoken descriptions if required.','spatial-expression')
put('LA004-01-H','','development','The task requires a child to modify their own movements with adverbs. No catalog mode observes or scores that action.','Build an action-and-language activity with an explicit observable or teacher-rated response.','oral-interaction')
put('LA004-01-L','word-sorter:binary_sort sentence-builder:simple','partial','Classification and tile construction provide grammar activities, but the requirement does not specify which concepts or mastery evidence count.','Clarify a measurable grammar action before certifying fit; keep the source requirement unchanged.','curriculum-clarity')
put('LA004-02-A','di-spoken-practice:say_answer','partial','A short spoken subject/action answer could fit, but sentence-analyzer expects Grade 2+ printed grammar; the general DI pack must prove it preserves the sentence context.','Probe sentence-role questions and inspect generated items and no-answer-leak behavior.','k-sentence-builder')
put('LA004-02-B','sentence-builder:simple','partial','The sentence order is supported, but tiles are words rather than matching subject/verb pictures.','Add pictured noun/action tiles with read-aloud support.','k-sentence-builder')
put('LA004-02-D LA004-02-E','sentence-builder:simple','partial','The builder constructs complete sentences; it does not explicitly classify fragments or independently choose punctuation on a given sentence.','Add fragment repair and punctuation-choice modes with non-reader prompts.','k-sentence-builder')
put('LA004-03-A LA004-03-B','word-sorter:binary_sort','partial','Singular/plural spoken categories are available with emoji cues, but single emojis do not necessarily encode one versus many and no physical objects are manipulated.','Test quantity-correct picture groups and retain the physical/spoken distinction.','picture-sorting')
put('LA004-03-C','word-flip:plural_s','partial','The exact -s transformation is supported orally. It does not match two picture cards.','Use oral plural practice as partial support; add picture-pair matching for the literal task.','picture-matching')
put('LA004-03-F','word-flip:plural_s word-flip:plural_es','candidate','Dedicated modes derive regular -s/-es plural answers and elicit the changed word with picture support.','Generate both ending families and drive the spoken response loop.')
put('LA004-03-G','word-flip:irregulars','partial','Irregular plural production is supported, but visual matching is not.','Add visual singular/plural matching if required.','picture-matching')
put('LA004-03-I','word-flip:plural_s word-flip:plural_es word-flip:irregulars','candidate','Spoken word transformations provide the requested guided plural production.','Test familiar regular/irregular forms with correct and incorrect spoken answers.')
put('LA004-03-K','word-flip:irregulars','partial','The mode elicits isolated irregular forms, not their use in a student-generated story.','Add sentence-level or story-level plural usage evidence.','oral-storytelling')
put('LA004-03-D LA004-03-E LA004-03-H LA004-03-J','di-spoken-practice:say_answer','partial','Short article answers are plausible, but correct use depends on phonetic and discourse context; picture-vocabulary sentence_frame only generates concrete noun targets.','Add a targeted article-completion contract and probe a/an plus definite/indefinite context.','k-grammar-completion')
put('LA004-04-A LA004-04-C LA004-04-F LA004-04-G LA004-04-H','di-spoken-practice:say_answer','partial','Short pronoun answers may be representable, but pictures/context must make referent, perspective and grammatical role unambiguous. No dedicated pronoun mode establishes that today.','Develop pronoun/reference trials; reject ambiguous pronoun pictures and test subject/object distinctions.','k-grammar-completion')
put('LA004-04-B LA004-04-J','','development','Use of pronouns in spontaneous conversation is not a short-answer identification task.','Add conversational sentence production with perspective/reflexive-pronoun evidence.','oral-interaction')
put('LA004-05-B','spatial-scene:place_in spatial-scene:place','candidate','The grid supports observable placement for a spoken spatial instruction, including putting an object inside a container.','Generate named prepositions and verify correct and incorrect placement.')
put('LA004-05-C','spatial-scene:identify','partial','Above/below identification is supported; front/behind is explicitly excluded by the top-down grid and sorting scene cards is not implemented.','Extend to front/behind scenes and relationship categorization.','spatial-expression')
put('LA004-05-D','spatial-scene:describe','candidate','Selecting a position word for a shown arrangement matches word-to-spatial-picture association for supported relations.','Verify the exact prepositions and non-reader audio.')
put('LA004-05-E LA004-05-F','spatial-scene:place spatial-scene:place_between spatial-scene:follow_directions','partial','Constrained placements and directions are supported, but a child-created scene/map and its spoken description are not.','Add authorable scenes/maps and student-generated directions.','spatial-expression')
put('LA004-05-H','spatial-scene:follow_directions','partial','The static grid explicitly excludes through/around/across paths; multi-step placement is not path following.','Implement animated path relations and scoring.','spatial-paths')
put('LA004-05-I','word-sorter:binary_sort','partial','Location/direction word categories can be spoken; isolated words do not demonstrate their function in written/spoken contexts.','Generate contextualized examples and check label ambiguity.','spatial-expression')
put('LA004-06-A','word-sorter:binary_sort','partial','Noun/verb sorting practices action-word recognition but does not identify actions within a song or rhyme.','Add supplied audio/line context and action-word selection.','k-grammar-completion')
put('LA004-06-C','word-sorter:binary_sort','partial','Action/linking categories are plausible; linking verbs require sentence context and cannot be honestly pictured in isolation.','Generate full context for is/are/am and test the distinction.','k-grammar-completion')
put('LA004-06-D LA004-06-E LA004-06-H LA004-06-I','di-spoken-practice:say_answer','partial','Closed verb completion is a candidate, but the current pack has no dedicated grammatical sentence-completion contract. Full sentence use is broader than a short target word.','Probe generated subject/verb context; add a sentence-completion mode if empty or off-task.','k-grammar-completion')
put('LA004-06-F','word-flip:past_ed','partial','Regular past formation is supported; the mode is a Grade 1-2 extension and does not directly assess present/past discrimination at K.','Review K access and add contrastive tense trials.','k-grammar-completion')
put('LA004-06-G','word-flip:past_irregular','partial','Oral irregular past production is supported at Grade 1-2, but picture matching and K access remain unverified.','Add K picture-pair tense matching or a reviewed oral equivalent.','picture-matching')
put('LA004-06-J','','development','Applying tenses while generating a story requires open sentence production; word-flip only judges one transformed word.','Add tense-aware narrative production and sentence-level evidence.','oral-storytelling')

# Vocabulary: all 29 source requirements receive an explicit action-based decision.
put('LA005-01-A','picture-vocabulary:receptive_match','candidate','Hear a vocabulary word and tap its picture: direct receptive matching at K.','Probe everyday noun categories and picture distinguishability.')
put('LA005-01-B LA005-01-D LA005-03-B','word-sorter:binary_sort word-sorter:ternary_sort sorting-station:sort_one','candidate','Spoken categorization into meaningful groups serves category membership; sorting-station adds object pictures.','Select one stable taught criterion and test age-appropriate group names.')
put('LA005-01-C LA005-02-F','sentence-builder:simple','partial','Tile construction can scaffold vocabulary use, but does not judge student-generated complete oral sentences at K.','Build an oral sentence-production mode rather than counting a missing noun as a complete sentence.','oral-sentence-production')
put('LA005-01-E','picture-vocabulary:opposite','partial','The child produces an opposite from a shown/heard base; visual card matching is a separate action.','Retain opposite production as partial support and add picture-pair matching.','picture-matching')
put('LA005-01-F','di-spoken-practice:compare_choice','partial','Shown comparisons can elicit named property words, but texture/shape manipulation and open descriptions are broader than a fixed comparison menu.','Use bounded comparisons only; retain hands-on description as unmet.','oral-interaction')
put('LA005-01-G','story-talk:feeling_check picture-vocabulary:naming','partial','Feeling inference from a story and picture naming supply parts of emotion vocabulary; naming faces and matching situations need reviewed stimuli.','Probe clear emotion faces/scenes rather than assuming any noun-picture pool covers emotions.','emotion-scenes')
put('LA005-01-H','picture-vocabulary:gradable_scale','candidate','The mode explicitly asks for a missing rung in a spoken low-to-high scale, including the size and temperature examples in the requirement.','Check scale ordering, plausible accepted synonyms and target concealment; contextual use remains a separate assessment claim.')
put('LA005-02-A LA005-02-D','interactive-book:read-focus-word','partial','The book supplies words and illustrations, but the scored task is reading a focus word, not inferring meaning or matching a word to a scene.','Extend interactive-book with vocabulary-in-scene and meaning-from-picture tasks.','picture-context')
put('LA005-02-G','picture-vocabulary:sentence_frame','partial','A missing noun in a sentence is available; the task does not contrast two meanings of the same word or ask the child to demonstrate them.','Add paired contexts for bat/run and identify which meaning applies.','multiple-meanings')
put('LA005-02-H','picture-vocabulary:sentence_frame','partial','Sentence context completion is supported, but the component deliberately hides its noun emoji before the answer, so simultaneous picture-clue reasoning is not assessed.','Add contextual scene clues that do not simply reveal the answer.','picture-context')
put('LA005-02-I','di-spoken-practice:say_answer','candidate','One short spoken answer can solve a simple riddle if clues uniquely constrain the word and no visual reveals it.','Generate riddles and inspect the actual pre-answer stimulus before accepting this fit.')
put('LA005-03-A','picture-vocabulary:association','partial','The relation sock/shoe is directly supported as open spoken association. There are no partner cards to match, so the visual matching action is unmet.','Extend picture-vocabulary with a distinct visual association task, preserving its existing open spoken mode.','picture-matching')
put('LA005-03-C','rhyme-studio:production','candidate','Open rhyme production directly elicits a rhyming partner; verify picturable targets for the requested support.','Generate familiar rhyme families and test a valid unlisted answer.')
put('LA005-03-D','picture-vocabulary:association','partial','General related-word production may accept a location, but does not specifically require one or match location cards.','Add object-to-location relation constraints and visual matching.','picture-matching')
put('LA005-03-E','rhyme-studio:production','partial','One open rhyme is judged per target. The session does not ask for and retain three distinct members of a built family.','Extend production with a three-word family collection and duplicate handling.','rhyme-family')
put('LA005-03-F LA005-03-H','','development','Word webs and semantic chains require a child to build and justify relationships. word-workout chains change letters; story arcs order events. Neither is a semantic-link construction tool.','Build a picture-based semantic web/chain primitive with edge labels or spoken relationship evidence.','semantic-web')
put('LA005-03-G','word-sorter:binary_sort sorting-station:sort_one','partial','Seasonal categorization is supported but naming a bucket does not supply the requested because-reason.','Add a post-sort short explanation tied to the selected item.','sort-explanation')
put('LA005-04-B','picture-vocabulary:receptive_match','partial','Digital word-picture matching is supported; classroom scavenger-hunt actions need separate observation.','Use as digital preparation and retain physical finding as teacher-observed evidence.','oral-interaction')
put('LA005-04-C','','development','Following and giving classroom action commands requires observable actions and student-generated instructions.','Add an action-command interaction with a clear response rubric.','oral-interaction')
put('LA005-04-F','di-spoken-practice:say_answer','partial','Short responses in weather/counting contexts can be prompted; conducting an experiment or using vocabulary freely is not established.','Specify the concrete activity and response before claiming coverage.','curriculum-clarity')
put('LA005-04-G','sentence-builder:simple','partial','Word tiles match the requested manipulative writing action but require a K accessible vocabulary/picture configuration.','Add and verify pictured/audible vocabulary tiles at K.','k-sentence-builder')
put('LA005-04-I','','development','A multiword scene description from a bank is open phrase/sentence production. Picture-vocabulary accepts one word and DI practice does not judge open descriptions.','Extend oral vocabulary to scored scene descriptions with multiple target words.','oral-sentence-production')
put('LA005-04-J','rhyme-studio:production poetry-lab:rhyme_hunt','partial','Rhyme generation and identification are available; composing a poem is a distinct open-language task and poetry-lab composition is typed Grade 3+.','Add a K oral poem composition mode with preserved child utterances.','oral-storytelling')
put('LA005-04-K','story-planner:story_structure','partial','Picture-supported story planning can organize ideas but does not capture guided writing with vocabulary in recipes or class stories.','Add a K dictated/written composition surface with target-vocabulary evidence.','oral-sentence-production')

# Reading comprehension: short spoken recall is not a substitute for every discourse task.
put('LA006-01-A LA006-01-B LA006-01-F LA006-02-A LA006-02-B LA006-04-A','story-talk:who_what_where story-talk:feeling_check','partial','Read-aloud detail recall and feeling inference are supported, but story-talk has no answer-picture matching or scored illustration-reading task.','Add illustrated-story evidence where the curriculum explicitly requires visual clues.','picture-context')
put('LA006-01-C LA006-03-I','story-map:bme','partial','The BME mode places events on a narrative arc; source events are text cards, so K picture-card access and the exact 3-4-event requirement need an extension/probe.','Add picture event cards with audio and test order separately from reading.','picture-story-sequence')
put('LA006-01-D','story-talk:why_because story-planner:conflict_resolution','partial','Causal explanation and story planning support problem/solution reasoning, but matching solutions to a supplied story is not the same task.','Add story-grounded problem/solution trials.','picture-context')
put('LA006-01-E','decodable-reader:read_along','partial','Shared reading can model repeated phrases; recognition/use of a repeated pattern is not its dedicated scored task.','Add repeated-phrase prediction/production in a shared story.','picture-context')
put('LA006-01-H LA006-02-C LA006-02-J','story-talk:why_because story-planner:conflict_resolution','partial','Explaining an existing cause or planning a story does not establish prediction, morals, or counterfactual alternatives.','Add before-reveal prediction and alternative-outcome tasks with a reasoning rubric.','story-reasoning')
put('LA006-02-D LA006-02-F','story-talk:why_because','candidate','A story is read aloud and the child explains its cause; the mode accepts a short because-reason.','Verify the answer is grounded in the story and a bare unrelated word is rejected.')
put('LA006-02-E','','development','Connecting a story to a personal experience requires open autobiographical conversation, outside short-answer modes.','Add recorded personal connections with a relevance rubric.','oral-storytelling')
put('LA006-02-H','story-talk:who_what_where story-talk:feeling_check','partial','Literal and inference questions are available separately, but the child is not asked to distinguish stated from inferred information.','Add a source-of-evidence comparison task.','story-reasoning')
put('LA006-02-I','story-talk:feeling_check','partial','One-word feeling inference is supported; thoughts and inferences from dialogue beyond a feeling word are not fully represented.','Extend short-story inference with distinct thought and feeling evidence.','story-reasoning')
put('LA006-03-A LA006-03-B','decodable-reader:read_along','candidate','K shared reading asks comprehension questions after the tutor reads; main-topic prompts are a plausible scoped use, requiring generated-content confirmation.','Generate a main-idea objective and verify questions distinguish overall topic from a local detail.')
put('LA006-03-D LA006-03-E LA006-03-H','','development','Picture sorting and a main-idea/detail web require story-grounded organization. Generic word sorting lacks the shared passage; text-structure-analyzer requires Grade 2+ independent reading.','Build or extend a K illustrated main-idea/detail organizer tied to a read-aloud.','main-idea-organizer')
put('LA006-03-F','','development','Movement or puppetry is not observed by the current short-answer interfaces.','Add a teacher-observed enactment task or an explicit digital retelling equivalent.','oral-storytelling')
put('LA006-03-J LA006-04-B LA006-04-C LA006-04-D LA006-04-E LA006-04-F LA006-04-H','','development','Two-story comparison needs both texts and their characters/events in one scored context. Single-story story-talk, biological Venn comparisons and Grade 1+ genre differences do not meet that contract.','Extend a story primitive with two illustrated read-alouds and shared/different character, setting and event tasks.','two-story-compare')
put('LA006-04-G LA006-04-I','','development','A student preference with one or several reasons is open opinion production; factual recall and one-word feeling labels do not establish it.','Add spoken opinion-and-reasons evidence grounded in the chosen story.','oral-storytelling')
put('LA006-06-A LA006-06-D','interactive-book:find-feature','candidate','The child taps real titles/headings in a generated illustrated nonfiction book.','Generate each feature objective and confirm it exists on the visible page.')
put('LA006-06-B LA006-06-C','interactive-book:find-feature','partial','Pointing to features/page numbers is supported; naming them or explaining their purpose requires an additional spoken response.','Add a feature-name/purpose response after locating it.','print-concepts')
put('LA006-06-E LA006-06-F','interactive-book:find-feature','partial','The mode locates captions/features but does not necessarily interpret a caption or match labels to diagram parts.','Add label-to-part and caption-meaning checks.','print-concepts')
put('LA006-06-G','interactive-book:find-feature','partial','The declared feature set has title/author/heading/caption/page number, but not table-of-contents navigation.','Extend the book contract with contents entries, destination pages and information-finding tasks.','print-concepts')
put('LA007-01-A LA007-01-B LA007-01-H','story-planner:story_structure','partial','K picture choices and event ordering can plan a story, but do not assess the child retelling or performing it in their own words.','Add recorded narrative production/retelling over the plan.','oral-storytelling')
put('LA007-01-D','story-planner:character_setting','partial','Character choices support planning, but drawing an original character and describing two traits are not both scored.','Add a drawing surface plus an oral description rubric.','oral-storytelling')
put('LA007-02-B LA007-02-E','','development','Imitating a voice or creating two-character dialogue is not judged by reading-word accuracy. read-aloud-studio models voices but does not grade prosody and is Grade 1+.',
    'Add K dramatic-play recording and explicit dialogue/expressive criteria.','oral-storytelling')

assert len({r['id'] for r in rows}) == len(rows)
missing = [r['id'] for r in rows if r['id'] not in decisions]
extra = set(decisions)-{r['id'] for r in rows}
assert not missing and not extra, f'Missing {missing}; extra {extra}'
for r in rows:
    d = decisions[r['id']]
    d['requirementHash'] = hashlib.sha256(r['text'].encode()).hexdigest()
    d['reviewedAt'] = datetime.now(timezone.utc).isoformat()
    d['reviewer'] = 'Codex; explicit curriculum/action-to-catalog review'
    d['alternativesPolicy'] = 'Full catalog inventory inspected; absence of a candidate is a development recommendation, not a runtime proof of impossibility.'
audit = {'version':1,'subject':'LANGUAGE_ARTS','grade':'K','decisions':decisions,
         'catalogSources':basis['catalogSources'],
         'scope':'All 191 live published K Language Arts requirements; catalog review for every row. Content evidence is separately scoped.'}
(OUT/'review.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'reviewed':len(decisions),'counts':{k:sum(d['fit']==k for d in decisions.values()) for k in ['candidate','partial','development']}}))
