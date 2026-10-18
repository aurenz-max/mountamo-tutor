"""Authored prose for the Social Studies grade 1 review page (header, findings, build order, provenance)."""


def intro(counts, vcounts, sample):
    return f"""<div class="eyebrow">Curriculum design review · SOCIAL STUDIES · Grade 1 · 2026-10-17</div>
<h1>Social Studies G1 Design Review</h1>
<p class="lede">A seeded random draw of 5 published skills and 10 subskills, each planned as a 10-15 minute Lumina lesson from the live catalog. Every candidate binding was drawn once through the production generator, using the exact curriculum text at grade 1. Lumina has no social-studies primitives. These lessons run on general-purpose tools: knowledge-check, timeline-builder, spatial-scene, story-bridge and how-it-works. Three objectives are served well today: matching celebrations, school-year order and the scarcity introduction. The other seven need a mode, a repair or a new interaction. Three new interactions would cover the gaps: a two-subject same-and-different sort, a simple map with a compass, and a coins-and-choices task. Two existing primitives would each need a mode: near and far in spatial-scene, and a life timeline in timeline-builder.</p>
<div class="stats"><span class="chip ok">{counts['reuse']} reuse</span><span class="chip warn">{counts['repair']} repair</span><span class="chip new">{counts['new-mode']} new mode</span><span class="chip new">{counts['new-primitive']} new primitive</span><span class="chip ok">{vcounts['usable']} probes usable</span><span class="chip warn">{vcounts['partial']} partial</span><span class="chip bad">{vcounts['unfit'] + vcounts['defect']} wrong fit or defect</span></div>
<nav><a href="#findings">Findings</a><a href="#priorities">Build order</a><a href="#sample">Sample</a><a href="#lessons">Lessons</a><a href="#issues">Defects</a><a href="#briefs">Build briefs</a><a href="#provenance">Provenance</a></nav>

<h2 id="findings">What the sweep found</h2>
<ul>
<li><strong>Three published targets do not exist.</strong> matching-activity, sequencing-activity and ai-tutor-session are not catalog primitives. The first two survive only as knowledge-check problem types. Nothing breaks, because the manifest resolves primitives live, but the curriculum's target fields are stale for this subject.</li>
<li><strong>Comparing cultures has no honest surface.</strong> Two objectives here, and two siblings, ask the child to sort what is the same and what is different between two lives or two celebrations. knowledge-check has no multi-select and keys "the same as your life". story-bridge has a code-checked Venn, but only between two stories' characters, and its say_alike probe ignored the topic. Brief 1.</li>
<li><strong>Geography has no map.</strong> No primitive has a map with a compass rose or asks for north, south, east or west, apart from light-shadow-lab's sun and shadows. spatial-scene covers four of the six position words; near and far are dropped by code. Briefs 2 and 3.</li>
<li><strong>Economics has no budget at grade 1.</strong> knowledge-check can ask "what do you give up?" well (probe usable). But the "choose and give a reason" objective came out as a health quiz with the reason in the options. The only budget tasks are rocket and space-route tasks from grade 2-3. Brief 5.</li>
<li><strong>Time order is the strongest area.</strong> timeline-builder sequence-yearly gave four good rounds of school-year events. A life timeline by age is missing: how-it-works and timeline-explorer both turned "how to make a timeline" into ordering the instructions. Brief 4.</li>
<li><strong>The spoken why-question mode served nothing.</strong> di-spoken-practice explain_concept returned zero items for both social-studies objectives it was tried on, after this morning's DSP-K1 fix.</li>
<li><strong>Six defects filed.</strong> Among them, word-sorter matched Kwanzaa to Africa and labelled celebration pairs "synonym", and spatial-scene showed the child "left_of".</li>
</ul>

<h2 id="priorities">Suggested build order</h2>
<ol>
<li><strong>Repair DSP-SS1</strong> (di-spoken-practice explain_concept on social studies). It blocks the spoken evidence in two lessons, and the fix is in an existing generator.</li>
<li><strong>Brief 1, same and different</strong> (new primitive). It serves four published subskills across two skills, and culture comparison recurs through K-2 social studies.</li>
<li><strong>Brief 5, coins and choices</strong> (new primitive). It serves all three Making Choices subskills; nothing in the catalog comes close at grade 1.</li>
<li><strong>Brief 3, map and compass</strong> (new primitive). It is the only route to cardinal directions; check the rest of the Geography unit for further demand before scoping.</li>
<li><strong>Brief 4, life timeline</strong> (timeline-builder mode). Small, on a primitive that already works; serves two subskills.</li>
<li><strong>Brief 2, near and far</strong> (spatial-scene scope). Small; finishes the position-word set.</li>
</ol>
"""


def prov(sample, catalog, commit, sha, here, probes, esc):
    return f"""<dt>Curriculum</dt><dd>GET http://127.0.0.1:8000/api/curriculum/curriculum/SOCIAL_STUDIES?grade=1, saved as snapshot.json, sha256 <span class="mono">{sha(here/'snapshot.json')}</span>, {sample['scopedSkillCount']} skills in scope</dd>
<dt>Sampler</dt><dd>.agents/skills/curriculum-design-review/scripts/sample_curriculum.py, {esc(sample['algorithm'])}, Python {esc(sample['pythonVersion'])}, sampled {esc(sample['sampledAt'])}. No skill was excluded for size.</dd>
<dt>Catalog</dt><dd>Live export through the Vite module runner (export-catalog.mjs) at commit <span class="mono">{commit}</span> plus the uncommitted working tree; {len(catalog)} primitives; catalog.json sha256 <span class="mono">{sha(here/'catalog.json')}</span></dd>
<dt>Probes</dt><dd>{len(probes)} draws via /api/lumina/eval-test (topic = intent = exact subskill text, grade=1, gradeLevel=1st Grade, difficulty=medium), saved under evidence/. Each was judged by reading the payload. The how-it-works guided "fail" is the endpoint's mode-field check; the two di-spoken-practice "fail"s are real empty sessions. comparison-panel and foundation-explorer have no eval modes and could not be drawn through this endpoint.</dd>
<dt>Source checks</dt><dd>Read-only code reads of knowledge-check, comparison-panel, story-bridge, fact-file, passage-studio, fast-fact, drawer-then-and-now, drawer-perspective-lens, spatial-scene, spatial-path, vocabulary-explorer, picture-vocabulary, di-spoken-practice, oral-sentence-studio, light-shadow-lab, timeline-builder, timeline-explorer, how-it-works, calendar-explorer, life-cycle-sequencer, foundation-explorer, word-sorter, classification-sorter, rocket-builder, mission-planner, coin-counter, cause-effect-chain and era-explorer, plus a catalog grep for map, compass, cardinal, budget and trade-off. File:line citations are in the lesson limits, briefs and defects table.</dd>
<dt>Validated</dt><dd>10 distinct subskills under 5 distinct skills with parent membership; every binding's component and eval mode exists in the live catalog (comparison-panel and foundation-explorer have no eval modes and are bound without one); instance IDs unique; every probe file present; manifests are valid JSON.</dd>
<dt>Not done</dt><dd>No lesson was hydrated or run end to end, no Live or microphone session was driven, and each binding has one draw only. The authored intents (six pairs, named celebrations, school-year scale) were not re-probed, so whether each generator follows them is unknown. Teaching effectiveness is not claimed.</dd>"""
