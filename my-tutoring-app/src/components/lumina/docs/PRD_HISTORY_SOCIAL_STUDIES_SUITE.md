# PRD: K-6 History & Social Studies Primitives Suite

## Executive Summary

History and social studies occupy ~30-45 minutes/day in K-6 classrooms, yet Lumina has zero dedicated coverage. The only history-adjacent primitive is `timeline-explorer` in the core catalog — a general chronological tool that lacks the disciplinary thinking skills that define social studies education: source analysis, geographic reasoning, perspective-taking, civic understanding, and economic reasoning.

This PRD proposes **20 new primitives** organized across the 4 dimensions of the C3 Framework (College, Career, and Civic Life), the national standard for K-6 social studies. These primitives leverage Lumina's existing multimodal infrastructure — Gemini content generation, AI image generation, drag-and-drop, TTS, and rich evaluation — to deliver interactive history education that goes far beyond "read the chapter and answer questions."

---

## Current State Audit

### What Exists

| Primitive | Domain | Status | Gaps |
|-----------|--------|--------|------|
| `timeline-explorer` | Core | Implemented | Generic chronological tool; no source analysis, no perspective-taking, no geographic context |
| `evolution-timeline` | Biology | Implemented | Biological deep-time only |
| `propulsion-timeline` | Engineering | Implemented | Technology history only |
| `fact-file` | Core | Implemented | Display-only reference card; no historical thinking skills |
| `interactive-passage` | Core | Implemented | Generic reading; no source attribution or historical context |

### Available Multimodal Infrastructure

| Capability | Service | Current History Usage |
|-----------|---------|----------------------|
| **AI Image Generation** | Gemini image generation | None for history |
| **Drag-and-Drop** | React DnD patterns (engineering, word-builder, etc.) | None for history |
| **Rich Evaluation** | `usePrimitiveEvaluation` + metrics system | None for history |
| **Node-and-Edge Graphs** | Pattern exists in `nested-hierarchy` | Could map cause-effect chains |
| **Comparison Panels** | `comparison-panel`, side-by-side patterns | Could compare sources/perspectives |
| **Canvas Physics** | Living simulation pattern (engineering primitives) | Could drive geography/map interactions |

### Reusable Assessment Primitives

These existing problem types work for social studies without new code:

| Problem Type | Social Studies Applications |
|---|---|
| `sequencing-activity` | Chronological ordering of events |
| `categorization-activity` | Sort by era, region, government type, economic system |
| `matching-activity` | Terms <-> definitions, cause <-> effect pairs |
| `scenario-question` | "What would you do?" civic reasoning |
| `fill-in-blanks` | Key terms, dates, vocabulary |
| `short-answer` | Historical explanations, source analysis responses |

---

## C3 Framework Alignment (National Standards)

The C3 Framework organizes K-6 social studies into 4 dimensions:

| Dimension | Code | Current Coverage | This PRD |
|-----------|------|-----------------|----------|
| D1: Developing Questions & Planning Inquiries | INQ | None | 2 new primitives |
| D2: History — Chronological Reasoning & Causation | HIST | Partial (`timeline-explorer`) | 4 new primitives |
| D2: Geography — Spatial Thinking & Human-Environment | GEO | None | 3 new primitives |
| D2: Civics — Civic Virtues & Democratic Principles | CIV | None | 4 new primitives |
| D2: Economics — Exchange, Markets & Government Role | ECON | None | 3 new primitives |
| D3: Evaluating Sources & Using Evidence | SRC | None | 2 new primitives |
| D4: Communicating Conclusions & Taking Action | ACT | None | 2 new primitives |

---

## Proposed Primitives (20)

---

## DIMENSION 1: Developing Questions & Planning Inquiries (INQ)

### 1. `inquiry-builder` — Construct and Refine Historical Questions

**What it does:** Students learn the difference between questions that can be answered with a quick fact ("What year did the Declaration of Independence get signed?") and compelling questions that drive investigation ("Why did the colonists decide they needed to break away from Britain?"). The primitive presents a historical topic and a set of sample questions. Students classify each as "answerable" (factual) or "compelling" (investigable), then craft their own compelling question using structured scaffolds. Advanced levels introduce supporting questions that break a compelling question into researchable sub-questions.

**Multimodal features:**
- **Visual:** Question classification board (two columns: factual vs compelling). Question quality meter that shows depth/complexity. Question scaffold templates with sentence starters. Topic card with AI-generated historical illustration.
- **Audio (TTS):** Questions and topic introduction read aloud for accessibility.
- **Interactive:** Drag questions to classify, fill-in-scaffold to build compelling questions, link supporting questions to a central compelling question.

**Learning goals by grade:**
- K-1: Ask "Who?", "What?", "When?", "Where?" about a historical topic. Distinguish questions from statements.
- Grade 2: Ask "Why?" and "How?" questions. Recognize that some questions need investigation.
- Grade 3: Classify factual vs investigable questions. Formulate a "Why did...?" question with scaffolding.
- Grade 4: Write compelling questions independently. Generate 2-3 supporting questions.
- Grade 5: Evaluate question quality (too broad, too narrow, just right). Revise weak questions.
- Grade 6: Design a full inquiry arc: compelling question → 3 supporting questions → identify source types needed to answer each.

**Interaction model:** Phase 1 (Classify) — sort 4-6 sample questions as factual or compelling. Phase 2 (Build) — use the scaffold to write a compelling question about the topic. Phase 3 (Support) — generate 2-3 supporting questions that would help answer the compelling question.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'inquiry-builder'`
- `questionsClassifiedCorrectly` / `questionsTotal`
- `compellingQuestionWritten` (boolean)
- `questionDepth` ('factual' | 'why-how' | 'multi-perspective' | 'full-inquiry')
- `supportingQuestionsCount`
- `scaffoldUsed` (boolean — did they use sentence starters)
- `attemptsCount`

---

### 2. `investigation-planner` — Plan a Historical Inquiry

**What it does:** Given a compelling question, students plan how they would investigate it. They identify what they already know, what they need to find out, and what types of sources would help. The primitive provides a source-type bank (primary sources, secondary sources, artifacts, maps, interviews, databases) and students drag relevant source types onto their investigation plan. Advanced levels include evaluating which sources would be most useful and identifying potential bias in source selection.

**Multimodal features:**
- **Visual:** Investigation planning board with three zones: "What I Know," "What I Need to Find Out," "Where I'll Look." Source-type cards with icons (scroll = primary source, book = secondary, map = geographic, person = oral history). AI-generated illustration of the historical topic.
- **Interactive:** Drag source-type cards to the "Where I'll Look" zone. Text entry for what they know and need to find out. Priority ranking of sources.

**Learning goals by grade:**
- Grade 2: Identify "What I know" and "What I want to know" (K-W-L).
- Grade 3: Name 2-3 types of sources (books, maps, people who were there).
- Grade 4: Distinguish primary from secondary sources. Match source types to question types.
- Grade 5: Evaluate which sources are most useful for a specific question. Identify gaps in available sources.
- Grade 6: Identify potential bias in source selection. Plan a multi-source investigation. Justify source choices.

**Interaction model:** Phase 1 (Know) — list 2-3 things already known about the topic. Phase 2 (Need) — list 2-3 things that need to be discovered. Phase 3 (Sources) — select and rank source types that would help answer the question.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'investigation-planner'`
- `priorKnowledgeListed` (count)
- `questionsToInvestigateListed` (count)
- `sourceTypesSelected` / `sourceTypesRelevant`
- `primarySecondaryDistinguished` (boolean, grades 4+)
- `sourceRankingReasonable` (boolean — did they prioritize appropriate sources)
- `attemptsCount`

---

## DIMENSION 2a: History — Chronological Reasoning & Causation (HIST)

### 3. `era-explorer` — Deep Dive into Historical Periods

**What it does:** An immersive exploration of a historical era that goes beyond timeline events. The primitive presents an era through multiple lenses: daily life, technology, government, culture, key figures, and geography. Students explore an interactive "era card" with expandable sections for each lens, then complete challenges that test understanding of what defined the era and how it differed from before and after. Unlike `timeline-explorer` (which sequences events across time), `era-explorer` goes deep into a single period.

**Multimodal features:**
- **Visual:** Era card with AI-generated period illustrations for each lens (daily life scene, technology artifacts, cultural elements). Expandable accordion sections. "Before vs During vs After" comparison strips showing change over time.
- **Audio (TTS):** Era introduction narration. Key figure quotes read aloud in context.
- **Interactive:** Expand/collapse lens sections, swipe between "before/during/after" comparisons, answer challenges about era characteristics.

**Learning goals by grade:**
- K-1: "Long ago" vs "today" — identify old vs modern versions of everyday things (transportation, clothing, communication).
- Grade 2: Explore one era through 2-3 lenses (daily life, tools/technology). Identify key differences from today.
- Grade 3: Compare two eras across the same lenses. Identify cause of major changes (e.g., invention of railroad changed travel).
- Grade 4: Analyze an era through 4+ lenses. Understand that people in different social roles experienced the same era differently.
- Grade 5: Connect changes between eras to specific causes (economic, technological, political). Evaluate significance of changes.
- Grade 6: Analyze continuity and change — what stayed the same across eras and why? Challenge presentism (judging the past by today's standards).

**Interaction model:** Phase 1 (Explore) — examine at least 3 lenses of the era. Phase 2 (Compare) — identify 2-3 key differences from the preceding era or from today. Phase 3 (Explain) — answer a cause-and-effect challenge about why the era was the way it was.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'era-explorer'`
- `lensesExplored` / `lensesTotal`
- `differencesIdentified` / `differencesRequired`
- `causeEffectCorrect` (boolean)
- `comparisonType` ('past-present' | 'era-to-era' | 'within-era')
- `eraCharacteristicsCorrect` / `eraCharacteristicsTotal`
- `attemptsCount`

---

### 4. `cause-effect-chain` — Map Historical Causation

**What it does:** An interactive node-and-edge graph where students build chains of cause and effect for historical events. Each node is an event card (with date, description, and category: political/economic/social/technological). Students connect events with directional arrows and label the connection type (caused, influenced, enabled, prevented, accelerated). Supports multiple causes leading to one effect (convergence) and one cause leading to multiple effects (divergence). The primitive makes visible that historical events rarely have a single cause.

**Multimodal features:**
- **Visual:** Node-and-edge canvas with directional arrows. Color-coded nodes by category (political = blue, economic = green, social = orange, technological = purple). Connection labels on arrows. Zoom in/out for complex chains. AI-generated event illustrations on hover.
- **Audio (TTS):** Event descriptions read aloud on node tap.
- **Interactive:** Drag to create nodes, draw arrows between nodes, label connections, rearrange graph layout.

**Learning goals by grade:**
- Grade 2: Simple cause-and-effect pairs: "This happened BECAUSE..." (2-node chains).
- Grade 3: 3-node chains with one intermediate cause. "A led to B, which led to C."
- Grade 4: Multiple causes for one event (convergence). Categorize causes as political, economic, social.
- Grade 5: One event with multiple consequences (divergence). Short-term vs long-term effects.
- Grade 6: Complex webs with 6+ nodes. Proximate vs root causes. Unintended consequences. Counterfactual reasoning ("What if X hadn't happened?").

**Interaction model:** Phase 1 (Identify) — read about a historical event and identify 2-3 causes from provided cards. Phase 2 (Connect) — build the cause-effect chain by placing nodes and drawing arrows. Phase 3 (Analyze) — label connection types and identify which cause was most significant.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'cause-effect-chain'`
- `nodesPlaced` / `nodesRequired`
- `connectionsCorrect` / `connectionsTotal`
- `connectionLabelsAccurate` / `connectionLabelsTotal`
- `chainDepth` (longest path in the graph)
- `convergenceDivergenceUsed` (boolean — did they model multi-cause or multi-effect)
- `mostSignificantCauseIdentified` (boolean)
- `attemptsCount`

---

### 5. `perspective-lens` — See Events Through Different Eyes

**What it does:** The same historical event is presented through 2-4 different perspectives (e.g., the colonist, the British soldier, the Indigenous person, the enslaved person). Each perspective has its own narrative account describing what happened, how they felt, and what they wanted. Students read/listen to each perspective and then complete challenges: identifying what each perspective has in common, what's different, why perspectives differ, and which details each account emphasizes or omits. Teaches that history looks different depending on who's telling it.

**Multimodal features:**
- **Visual:** Split-screen or tab view with perspective cards, each with an AI-generated character portrait and first-person narrative. Venn diagram for comparing perspectives. Emphasis/omission highlighter showing what each account includes or leaves out.
- **Audio (TTS):** Each perspective narrated in first person via TTS. Different voices/tones for different perspectives (where TTS allows).
- **Interactive:** Switch between perspectives via tabs, highlight shared vs unique details, drag details to Venn diagram regions, answer comprehension and analysis questions.

**Learning goals by grade:**
- K-1: Recognize that two people can see the same event differently. "How did [person A] feel? How did [person B] feel?"
- Grade 2: Compare two perspectives on a family or community event. Identify feelings and reasons.
- Grade 3: Compare two perspectives on a historical event. Identify what's the same and different.
- Grade 4: Analyze WHY perspectives differ (different experiences, different interests, different information).
- Grade 5: Identify what each perspective emphasizes and omits. Recognize that omission shapes understanding.
- Grade 6: Evaluate reliability of accounts given the perspective holder's position. Synthesize multiple perspectives into a more complete picture. Recognize how power and position shape narrative.

**Interaction model:** Phase 1 (Read) — explore at least 2 perspective accounts. Phase 2 (Compare) — identify similarities and differences using the Venn diagram. Phase 3 (Analyze) — explain why the perspectives differ and which details each emphasizes or omits.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'perspective-lens'`
- `perspectivesExplored` / `perspectivesTotal`
- `similaritiesIdentified` / `similaritiesTotal`
- `differencesIdentified` / `differencesTotal`
- `reasonForDifferenceCorrect` (boolean)
- `emphasisOmissionIdentified` (boolean, grades 5+)
- `perspectiveCount` (2 | 3 | 4)
- `attemptsCount`

---

### 6. `change-over-time` — Track How Things Evolved

**What it does:** A visual comparison primitive that shows how a specific aspect of life (transportation, communication, housing, education, food, clothing, rights, governance) changed across 3-5 time periods. Unlike `timeline-explorer` (which shows events), this primitive shows the STATE of something at different points in time. Students examine image-and-text cards for each period, identify what changed and what stayed the same (continuity vs change), and explain the forces that drove the changes. Supports "then and now" (2 periods) through multi-era tracking (5 periods).

**Multimodal features:**
- **Visual:** Horizontal comparison strip with period cards, each showing an AI-generated illustration of the topic in that era (e.g., communication: messenger on horseback → telegraph → telephone → email → smartphone). Continuity highlights (things that stayed the same across periods are connected with dotted lines).
- **Audio (TTS):** Period descriptions read aloud.
- **Interactive:** Swipe/scroll between periods, toggle continuity connections, answer "what changed" and "why" questions, drag forces-of-change labels (technology, economics, politics, culture) onto the relevant transitions.

**Learning goals by grade:**
- K-1: "Then and now" — two-period comparison. Identify one thing that changed and one that stayed the same.
- Grade 2: Three-period tracking. Name what changed. Recognize that change happens gradually.
- Grade 3: Identify the CAUSE of a change (new invention, new law, new idea).
- Grade 4: Distinguish continuity from change. Understand that some things change while others persist.
- Grade 5: Categorize forces of change (technological, economic, political, cultural). Multiple forces behind one change.
- Grade 6: Evaluate rate of change (gradual vs rapid). Turning points. Unintended consequences of change.

**Interaction model:** Phase 1 (Observe) — examine each period card and note key features. Phase 2 (Track) — identify what changed and what stayed the same between periods. Phase 3 (Explain) — label the forces that drove each major change.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'change-over-time'`
- `periodsExamined` / `periodsTotal`
- `changesIdentified` / `changesTotal`
- `continuitiesIdentified` / `continuitiesTotal`
- `forcesOfChangeLabeledCorrectly` / `forcesTotal`
- `topicTracked` (string — what aspect of life was tracked)
- `periodCount` (2-5)
- `attemptsCount`

---

## DIMENSION 2b: Geography — Spatial Thinking & Human-Environment (GEO)

### 7. `map-lab` — Interactive Map Reading & Analysis

**What it does:** An interactive map canvas where students learn geographic literacy: reading map elements (title, legend, compass rose, scale), locating features using cardinal/intermediate directions and grid coordinates, identifying physical features (mountains, rivers, lakes, oceans, plains) and human features (cities, roads, borders, landmarks). Supports multiple map types: physical, political, thematic (population, climate, resources, trade routes). Students complete map-reading challenges that test real geographic reasoning, not just label memorization.

**Multimodal features:**
- **Visual:** Zoomable map canvas with toggleable layers (physical features, political boundaries, thematic overlays). Interactive legend. Compass rose with direction indicators. Grid overlay for coordinate practice. AI-generated maps appropriate to topic and era.
- **Interactive:** Tap features for info cards, toggle map layers, use compass directions to navigate, drop pins at locations using coordinates, measure distances using scale bar.

**Learning goals by grade:**
- K: Identify land and water on a map/globe. Locate familiar places (school, home, park).
- Grade 1: Use cardinal directions (N, S, E, W). Read a simple map legend with 3-4 symbols.
- Grade 2: Identify continents and oceans. Use a map to answer "Where is...?" questions.
- Grade 3: Use intermediate directions (NE, SW). Read grid coordinates (A3, B5). Physical vs political maps.
- Grade 4: Identify physical features that influenced settlement patterns. Read thematic maps (population, resources).
- Grade 5: Analyze multiple map types for the same region. Understand how physical geography shapes human activity. Map scale and distance estimation.
- Grade 6: Compare historical and modern maps of the same region. Analyze thematic maps for patterns (trade routes, migration, resource distribution). Critical map literacy — who made this map and why?

**Interaction model:** Phase 1 (Orient) — identify map elements (title, legend, compass, scale). Phase 2 (Locate) — answer location-based questions using map tools. Phase 3 (Analyze) — answer reasoning questions about patterns or relationships shown on the map.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'map-lab'`
- `mapElementsIdentified` / `mapElementsTotal`
- `locationsFoundCorrectly` / `locationsTotal`
- `directionsUsedCorrectly` / `directionsTotal`
- `analysisQuestionsCorrect` / `analysisQuestionsTotal`
- `mapType` ('physical' | 'political' | 'thematic' | 'historical')
- `toolsUsed` (array: 'compass' | 'grid' | 'scale' | 'legend' | 'layers')
- `attemptsCount`

---

### 8. `region-builder` — Understand What Defines a Region

**What it does:** Students learn that regions are areas defined by shared characteristics — and that the same place can belong to multiple regions depending on the criteria. The primitive presents a map with unlabeled zones and a set of characteristic cards (climate, language, religion, economy, landform, political system). Students draw region boundaries based on a given criterion, then overlay multiple criteria to see how regions shift. Teaches that "region" is a human construct, not a fixed geographic fact.

**Multimodal features:**
- **Visual:** Base map with drawable overlay. Characteristic cards with data (e.g., "Speaks Spanish," "Desert climate," "Agricultural economy"). Color-coded region overlays that can be toggled independently. AI-generated landscape illustrations for each region type.
- **Interactive:** Draw region boundaries on the map, assign characteristics to regions, toggle overlay layers, compare how region definitions change with different criteria.

**Learning goals by grade:**
- Grade 2: Identify that neighborhoods/communities have characteristics (urban, suburban, rural).
- Grade 3: Group places by one characteristic (landform regions, climate regions). Draw simple region boundaries.
- Grade 4: Understand that one place can be in multiple regions (Texas is in the South, the Great Plains, and the Sun Belt).
- Grade 5: Create regions using human criteria (language, religion, economy). Compare with physical regions.
- Grade 6: Analyze how region definitions are constructed and contested. Evaluate why different organizations draw regional boundaries differently.

**Interaction model:** Phase 1 (Explore) — examine characteristic data for a set of places. Phase 2 (Draw) — group places into regions based on a given criterion. Phase 3 (Overlay) — apply a second criterion and analyze how regions overlap or diverge.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'region-builder'`
- `regionsDrawnCorrectly` / `regionsRequired`
- `characteristicsAssignedCorrectly` / `characteristicsTotal`
- `overlayAnalysisComplete` (boolean)
- `criteriaUsed` (array of criteria applied)
- `multiRegionRecognized` (boolean — did they identify places belonging to multiple regions)
- `attemptsCount`

---

### 9. `human-environment-sim` — Explore How People and Places Shape Each Other

**What it does:** A living simulation where students explore the two-way relationship between humans and their environment. The simulation presents a geographic setting (river valley, coastal area, mountain region, desert, grassland, forest) with natural resources and constraints. Students make decisions about settlement, resource use, and adaptation, and see the consequences play out: over-farming leads to soil depletion, building near rivers provides water but risks flooding, cutting forests provides lumber but causes erosion. The simulation runs forward in compressed time, showing how decisions compound.

**Multimodal features:**
- **Visual:** Canvas-based landscape with animated elements (flowing rivers, growing/shrinking forests, expanding settlements). Resource meters (water, soil fertility, timber, food). Decision consequence animations. Living simulation pattern — the environment responds visually to student choices.
- **Audio (TTS):** Narrator describes consequences of decisions. Environmental sound effects (water, wind, construction).
- **Interactive:** Place settlements, allocate resources, choose adaptation strategies (irrigation, terrace farming, sea walls), advance time periods, observe consequences.

**Learning goals by grade:**
- K-1: Identify natural resources (water, trees, soil, rocks). Recognize that people need resources to live.
- Grade 2: Match resources to human needs (water → drinking/farming, trees → building/fuel). Identify how weather affects daily life.
- Grade 3: Explain why settlements form near rivers, coasts, and fertile land. Identify 1-2 ways humans modify environment (farming, building roads).
- Grade 4: Analyze adaptation strategies for different environments. Understand trade-offs (dam provides water control but changes the river ecosystem).
- Grade 5: Model resource depletion and sustainability. Connect environmental decisions to economic consequences. Historical case studies (Dust Bowl, deforestation).
- Grade 6: Complex multi-variable simulation: balance population growth, resource use, environmental impact, and economic development. Evaluate historical and modern sustainability decisions.

**Interaction model:** Phase 1 (Observe) — explore the landscape and identify resources and constraints. Phase 2 (Decide) — make 3-5 resource/settlement decisions. Phase 3 (Consequence) — advance the simulation and observe outcomes. Phase 4 (Reflect) — answer questions about what happened and what they would change.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'human-environment-sim'`
- `decisionsCount`
- `resourcesIdentified` / `resourcesTotal`
- `consequencesPredictedCorrectly` / `consequencesTotal`
- `sustainabilityScore` (0-100 — how well did their decisions sustain resources over time)
- `environmentType` ('river-valley' | 'coastal' | 'mountain' | 'desert' | 'grassland' | 'forest')
- `reflectionQuestionsCorrect` / `reflectionQuestionsTotal`
- `attemptsCount`

---

## DIMENSION 2c: Civics — Civic Virtues & Democratic Principles (CIV)

### 10. `rules-and-laws-lab` — Understand Why Communities Need Rules

**What it does:** Students explore the purpose and structure of rules, from classroom rules to community laws to constitutional principles. The primitive presents scenarios where rules exist (or don't) and students analyze the consequences. They classify rules by purpose (safety, fairness, order, rights protection), evaluate whether rules are fair using criteria (applies equally, has a clear reason, can be changed through a process), and propose modifications. Advanced levels introduce the distinction between rules, laws, and constitutional principles.

**Multimodal features:**
- **Visual:** Scenario cards with AI-generated illustrations showing rule-in-action and rule-absent situations. Rule classification board (safety, fairness, order, rights). Fairness evaluation checklist. Rule-revision workspace.
- **Audio (TTS):** Scenarios read aloud.
- **Interactive:** Classify rules by purpose, evaluate fairness using checklist, propose rule modifications with justification, vote on proposed changes.

**Learning goals by grade:**
- K: Identify classroom rules and their purpose. "Why do we have this rule?"
- Grade 1: Compare home rules, school rules, and community rules. Recognize rules keep people safe and treat people fairly.
- Grade 2: Evaluate if a rule is fair (applies to everyone, has a reason). Suggest how to improve an unfair rule.
- Grade 3: Distinguish rules from laws. Understand who makes rules in different settings (teacher, principal, city council, state legislature).
- Grade 4: Constitutional principles in kid-friendly terms: equality, justice, common good, individual rights. Analyze historical rules/laws against these principles.
- Grade 5: Due process — how rules get made, enforced, and changed. Citizen participation in rule-making.
- Grade 6: Constitutional amendments as a rule-changing process. Landmark cases where rules were challenged. Balancing individual rights vs common good.

**Interaction model:** Phase 1 (Analyze) — read a scenario and identify the rule and its purpose. Phase 2 (Evaluate) — assess the rule against fairness criteria. Phase 3 (Propose) — suggest a modification and justify it.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'rules-and-laws-lab'`
- `rulesPurposeClassifiedCorrectly` / `rulesTotal`
- `fairnessEvaluationComplete` (boolean)
- `fairnessCriteriaApplied` (count)
- `modificationProposed` (boolean)
- `justificationProvided` (boolean)
- `ruleLevel` ('classroom' | 'community' | 'law' | 'constitutional')
- `attemptsCount`

---

### 11. `government-explorer` — How Government Works

**What it does:** Students explore the structure and function of government at local, state, and national levels. The primitive presents government as a system with inputs (problems, needs), processes (branches, officials, voting), and outputs (laws, services, decisions). Interactive organizational charts show the three branches and their roles. Students trace how a community need becomes a law/policy by following the process through the government system. Includes role cards for key government positions (mayor, governor, president, judge, legislator, council member).

**Multimodal features:**
- **Visual:** Interactive organizational chart with expandable branches (legislative, executive, judicial). "How a bill becomes a law" flow diagram. Government level selector (local → state → federal). Role cards with AI-generated portrait illustrations and responsibility lists.
- **Audio (TTS):** Role descriptions and process explanations read aloud.
- **Interactive:** Expand/collapse org chart branches, trace a bill's path through government, match roles to responsibilities, compare government levels.

**Learning goals by grade:**
- K-1: Identify community helpers who work in government (mayor, police chief, firefighters). Recognize that government provides services.
- Grade 2: Name the president and governor. Understand that government makes rules for the community.
- Grade 3: Three branches of government at the national level. Basic function of each (makes laws, enforces laws, interprets laws).
- Grade 4: Compare local, state, and federal government. Identify elected vs appointed officials. Checks and balances (basic).
- Grade 5: Trace how a bill becomes a law. Understand voting and representation. Role of the Constitution.
- Grade 6: Checks and balances in depth. Federalism — how different government levels share and divide power. Historical examples of branches checking each other.

**Interaction model:** Phase 1 (Explore) — examine the government structure chart and identify branch roles. Phase 2 (Trace) — follow a community need through the government process. Phase 3 (Apply) — answer questions about which branch/level handles specific situations.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'government-explorer'`
- `branchRolesCorrect` / `branchRolesTotal`
- `processStepsOrderedCorrectly` (boolean)
- `levelComparisonComplete` (boolean)
- `rolesMatchedToResponsibilities` / `rolesTotal`
- `governmentLevel` ('local' | 'state' | 'federal' | 'comparison')
- `attemptsCount`

---

### 12. `citizen-action-sim` — Practice Democratic Participation

**What it does:** A scenario-based simulation where students encounter a community problem (playground needs repair, traffic is dangerous near school, local park is polluted, library hours are being cut) and must decide how to take civic action. Students evaluate multiple action options (write a letter, attend a meeting, start a petition, organize volunteers, contact an elected official, vote), considering effectiveness, audience, and feasibility. They build an action plan and see a simulated outcome based on their choices. Teaches that citizens have both rights AND responsibilities.

**Multimodal features:**
- **Visual:** Community scenario with AI-generated illustration. Action option cards with effectiveness and effort ratings. Action plan builder (steps in sequence). Simulated outcome panel showing the consequence of their chosen actions. Community impact meter.
- **Audio (TTS):** Scenario narration. Action descriptions.
- **Interactive:** Evaluate action options, build multi-step action plan, see simulated outcome, reflect on effectiveness.

**Learning goals by grade:**
- K-1: Identify a problem in the classroom or school. Suggest one way to help fix it.
- Grade 2: Recognize that citizens can make changes. "I can help by..." (volunteer, tell an adult, be kind).
- Grade 3: Identify 2-3 ways citizens participate (voting, volunteering, attending meetings). Choose the best action for a given scenario.
- Grade 4: Build a multi-step action plan. Understand audience (who can actually fix this problem?). Write a letter to an official.
- Grade 5: Evaluate trade-offs between action options (fast vs lasting, individual vs collective). Understand how civic organizations amplify individual action.
- Grade 6: Design a civic campaign: identify problem, research causes, choose strategies, build coalition, present to decision-makers. Evaluate historical civic action movements.

**Interaction model:** Phase 1 (Problem) — analyze the community problem and identify stakeholders. Phase 2 (Options) — evaluate 3-4 possible actions and rank by effectiveness. Phase 3 (Plan) — build an action plan with 2-4 sequenced steps. Phase 4 (Outcome) — see the simulated result and reflect.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'citizen-action-sim'`
- `problemIdentifiedCorrectly` (boolean)
- `stakeholdersIdentified` / `stakeholdersTotal`
- `actionsEvaluated` / `actionsAvailable`
- `actionPlanSteps` (count)
- `planLogicallySequenced` (boolean)
- `audienceMatchedToProblem` (boolean — did they direct action at the right decision-maker)
- `reflectionComplete` (boolean)
- `attemptsCount`

---

### 13. `rights-and-responsibilities` — Explore Core Democratic Values

**What it does:** Students explore fundamental rights (speech, religion, assembly, petition, due process, equal protection) and their corresponding responsibilities through historical and modern scenarios. Each right is presented with a real or realistic scenario where it applies, and students must identify the right, explain why it matters, and recognize the responsibility that comes with it. Advanced levels explore when rights conflict with each other and how courts balance competing rights.

**Multimodal features:**
- **Visual:** Bill of Rights cards with kid-friendly language and AI-generated illustrations. Scenario cards with rights-in-action situations. Rights vs responsibilities T-chart. "Rights in Conflict" balance scale for advanced levels.
- **Audio (TTS):** Scenarios and rights descriptions read aloud.
- **Interactive:** Match rights to scenarios, pair rights with responsibilities, evaluate rights-in-conflict scenarios using the balance metaphor.

**Learning goals by grade:**
- Grade 2: Everyone has rights (to be safe, to learn, to be treated fairly). Rights come with responsibilities (to be safe, to help others learn, to treat others fairly).
- Grade 3: Identify basic rights from the Bill of Rights in kid-friendly language. Match rights to everyday situations.
- Grade 4: Explain WHY each right matters using historical examples of what happens without it.
- Grade 5: Pair each right with its corresponding responsibility. Understand that rights apply to everyone equally.
- Grade 6: Analyze scenarios where rights conflict (free speech vs safety, privacy vs security). Evaluate how courts have balanced competing rights. Historical cases.

**Interaction model:** Phase 1 (Identify) — read a scenario and identify which right applies. Phase 2 (Explain) — explain why this right matters (what would happen without it). Phase 3 (Responsibility) — identify the corresponding responsibility.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'rights-and-responsibilities'`
- `rightsIdentifiedCorrectly` / `rightsTotal`
- `explanationProvided` (boolean)
- `responsibilityPaired` (boolean)
- `conflictAnalyzed` (boolean, grades 6+)
- `scenariosCompleted` / `scenariosTotal`
- `attemptsCount`

---

## DIMENSION 2d: Economics — Exchange, Markets & Government Role (ECON)

### 14. `trade-and-exchange` — Understand Why People Trade

**What it does:** A simulation where students experience the progression from barter to currency to modern exchange. Students start with a set of goods and must trade with AI "villagers" to get what they need. Barter phase reveals the problem of "double coincidence of wants" (you have fish but want cloth — the cloth-maker wants grain, not fish). Currency phase introduces money as a solution. Students discover why money exists rather than being told. Advanced levels introduce supply and demand (scarce goods cost more), specialization (regions produce what they're best at), and international trade.

**Multimodal features:**
- **Visual:** Trading marketplace with AI-generated merchant characters and goods illustrations. Inventory panel showing student's goods. Trade proposal interface. Supply/demand price indicators for advanced levels. Trade route map for international trade. Animated transactions.
- **Audio (TTS):** Merchant dialogue. Trade narrator.
- **Interactive:** Propose trades, accept/reject counter-offers, discover the need for currency, set prices based on supply/demand, establish trade routes.

**Learning goals by grade:**
- K-1: Identify wants vs needs. Understand that people trade things they have for things they want.
- Grade 2: Experience barter. Discover the problem of barter (hard to find a match). Recognize money as a solution.
- Grade 3: Understand producers and consumers. Goods vs services. Why people specialize.
- Grade 4: Supply and demand basics — scarce goods cost more, abundant goods cost less. How prices change.
- Grade 5: Specialization and trade between regions/countries. Why countries trade. Imports and exports.
- Grade 6: Trade-offs in trade policy (tariffs help local producers but raise prices for consumers). Historical trade routes and their impact on cultures.

**Interaction model:** Phase 1 (Barter) — try to trade directly with villagers to get needed goods. Experience the difficulty. Phase 2 (Currency) — introduce money and see how trade becomes easier. Phase 3 (Market) — buy and sell in a market where prices respond to supply and demand.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'trade-and-exchange'`
- `tradesCompleted` / `tradesRequired`
- `barterDifficultyExperienced` (boolean — did they encounter failed barter attempts)
- `currencyAdvantageUnderstood` (boolean)
- `supplyDemandResponseCorrect` / `supplyDemandTotal` (grade 4+)
- `specializationIdentified` (boolean, grade 5+)
- `tradePhase` ('barter' | 'currency' | 'market' | 'international')
- `attemptsCount`

---

### 15. `budget-challenge` — Make Economic Decisions with Limited Resources

**What it does:** Students receive a budget (representing an individual, family, community, or government) and a set of needs and wants they must choose between. The primitive teaches scarcity (unlimited wants, limited resources), opportunity cost (choosing one thing means giving up another), and budgeting. Students allocate their budget, see consequences of their choices, and compare their budget with classmates' (anonymous) to see different prioritization. Government budgets introduce public goods and services.

**Multimodal features:**
- **Visual:** Budget allocation interface with draggable spending categories. "Needs vs Wants" sorting area. Opportunity cost comparison cards (if you choose A, you can't have B). Consequence panels showing what happens with each choice. Pie chart showing budget allocation. AI-generated illustrations for each spending item.
- **Interactive:** Sort needs vs wants, allocate budget by dragging sliders or coins, see consequences, compare allocations.

**Learning goals by grade:**
- K-1: Distinguish needs (food, water, shelter) from wants (toys, candy, games). "We can't have everything."
- Grade 2: Make choices between wants when you can only pick 2 of 4. Recognize that choosing means giving something up.
- Grade 3: Allocate a family budget across needs and wants. Understand saving as choosing future over present.
- Grade 4: Opportunity cost — explicitly name what you gave up. Evaluate trade-offs.
- Grade 5: Government budgets — taxes fund public goods (roads, schools, parks, safety). Citizens disagree on priorities.
- Grade 6: Community budget simulation — stakeholders advocate for competing priorities. Limited resources force trade-offs. Make a group budget with justification.

**Interaction model:** Phase 1 (Sort) — classify items as needs or wants. Phase 2 (Allocate) — distribute the budget across categories. Phase 3 (Consequence) — see what happens with your choices and identify opportunity costs.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'budget-challenge'`
- `needsWantsSortedCorrectly` / `itemsTotal`
- `budgetAllocated` (boolean — did they use the full budget without going over)
- `opportunityCostIdentified` (boolean)
- `consequencesReviewed` / `consequencesTotal`
- `budgetType` ('personal' | 'family' | 'community' | 'government')
- `savingsIncluded` (boolean, grade 3+)
- `attemptsCount`

---

### 16. `economic-system-explorer` — How Economies Organize

**What it does:** Students explore how different economic systems answer the three fundamental economic questions: What to produce? How to produce it? Who gets what's produced? The primitive presents the same community scenario under different economic approaches (traditional, command, market, mixed) and students compare the outcomes. Uses relatable scenarios — a community deciding how to use a shared piece of land — rather than abstract system descriptions.

**Multimodal features:**
- **Visual:** Community scenario with AI-generated illustration. Four system panels showing the same scenario with different outcomes. Comparison matrix for the three economic questions. Pros/cons evaluation cards. Historical/modern example cards for each system type.
- **Interactive:** Toggle between economic system views of the same scenario, complete the comparison matrix, evaluate pros and cons, match real-world examples to system types.

**Learning goals by grade:**
- Grade 3: Understand that communities must decide what to make and who gets it. Different communities decide differently.
- Grade 4: Three economic questions framework. Traditional economies — customs and traditions decide.
- Grade 5: Market economies — supply, demand, and prices decide. Command economies — government decides. Compare advantages and disadvantages.
- Grade 6: Mixed economies — most modern economies combine market and government elements. Evaluate real-world examples. Historical case studies of economic system impacts on daily life.

**Interaction model:** Phase 1 (Scenario) — understand the community's economic challenge. Phase 2 (Compare) — examine how 2-3 economic systems would handle it differently. Phase 3 (Evaluate) — identify advantages and disadvantages of each system for this scenario.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'economic-system-explorer'`
- `systemsExplored` / `systemsTotal`
- `economicQuestionsAnswered` / `questionsTotal`
- `prosConsIdentified` / `prosConsTotal`
- `examplesMatchedCorrectly` / `examplesTotal`
- `comparisonComplete` (boolean)
- `attemptsCount`

---

## DIMENSION 3: Evaluating Sources & Using Evidence (SRC)

### 17. `source-detective` — Analyze Primary and Secondary Sources

**What it does:** Students examine a historical source (document excerpt, photograph, artifact description, map, political cartoon, advertisement, diary entry, newspaper article) and analyze it using a structured source analysis framework. The primitive teaches sourcing (Who made this? When? Why?), contextualization (What was happening at the time?), corroboration (Does this match other sources?), and close reading (What does it actually say vs what does it imply?). Each source type has its own analysis template optimized for that format.

**Multimodal features:**
- **Visual:** Source display area (text excerpt, AI-generated historical image/artifact representation, or map). Source analysis framework panel with structured fields. Source context timeline showing when the source was created. Corroboration view showing 2-3 sources on the same topic for comparison.
- **Audio (TTS):** Source text read aloud. Analysis framework prompts.
- **Interactive:** Fill in structured analysis fields, highlight key phrases in text sources, examine details in image sources, compare multiple sources in corroboration mode.

**Learning goals by grade:**
- Grade 2: Observe a source carefully. "What do I see/read?" Distinguish between a photograph and a painting.
- Grade 3: Ask "Who made this?" and "Why?" Recognize that sources are made by people with purposes.
- Grade 4: Full sourcing: author, date, audience, purpose. Primary vs secondary source identification with evidence.
- Grade 5: Contextualization — connect the source to what was happening at the time. Identify bias and perspective in sources.
- Grade 6: Corroboration — compare 2-3 sources on the same event. Close reading — distinguish what the source says from what it implies. Evaluate source reliability.

**Interaction model:** Phase 1 (Observe) — examine the source and record initial observations. Phase 2 (Analyze) — complete the source analysis framework (author, date, purpose, audience, main idea). Phase 3 (Evaluate) — assess source reliability and/or corroborate with a second source.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'source-detective'`
- `observationsRecorded` / `observationsExpected`
- `analysisFieldsComplete` / `analysisFieldsTotal`
- `sourceTypeIdentified` (boolean)
- `primarySecondaryCorrect` (boolean)
- `biasIdentified` (boolean, grade 5+)
- `corroborationComplete` (boolean, grade 6+)
- `sourceType` ('document' | 'photograph' | 'artifact' | 'map' | 'political-cartoon' | 'diary' | 'newspaper' | 'advertisement')
- `attemptsCount`

---

### 18. `evidence-weigher` — Evaluate and Use Historical Evidence

**What it does:** Students are given a historical claim (e.g., "The transcontinental railroad helped the economy but hurt Native American communities") and a set of 4-6 evidence cards. They must evaluate each piece of evidence: Does it support the claim, challenge the claim, or is it irrelevant? How strong is the evidence? They then select the best 2-3 pieces of evidence and write a short evidence-based explanation. Builds on `source-detective` by teaching students to USE evidence, not just analyze it.

**Multimodal features:**
- **Visual:** Claim card prominently displayed. Evidence cards with source attribution, each categorizable as support/challenge/irrelevant. Evidence strength meter (strong/moderate/weak). Evidence selection area for building an argument. Writing scaffold for evidence-based explanation.
- **Interactive:** Drag evidence cards to support/challenge/irrelevant zones, rate evidence strength, select best evidence, write explanation using evidence.

**Learning goals by grade:**
- Grade 3: Identify which pieces of evidence are "about" the topic (relevant vs irrelevant).
- Grade 4: Sort evidence as "supports the claim" or "doesn't support the claim." Select the best piece of evidence.
- Grade 5: Three-way sort: supports, challenges, irrelevant. Explain WHY evidence supports or challenges. Rate evidence strength.
- Grade 6: Weigh competing evidence. Write an evidence-based paragraph using 2-3 pieces of evidence. Acknowledge counter-evidence.

**Interaction model:** Phase 1 (Sort) — classify each evidence card as supports, challenges, or irrelevant. Phase 2 (Evaluate) — rate the strength of relevant evidence. Phase 3 (Use) — select the best 2-3 pieces and write a short evidence-based explanation.

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'evidence-weigher'`
- `evidenceSortedCorrectly` / `evidenceTotal`
- `strengthRatingsAccurate` / `ratingsTotal`
- `bestEvidenceSelected` (boolean — did they pick the strongest pieces)
- `explanationWritten` (boolean)
- `explanationUsesEvidence` (boolean — did they reference specific evidence)
- `counterEvidenceAcknowledged` (boolean, grade 6+)
- `attemptsCount`

---

## DIMENSION 4: Communicating Conclusions & Taking Action (ACT)

### 19. `argument-builder` — Construct Historical Arguments

**What it does:** Students build structured historical arguments using the claim-evidence-reasoning (CER) framework adapted for social studies. Given a historical question, students state a claim, support it with evidence from provided sources, explain their reasoning (how the evidence supports the claim), and acknowledge a counter-argument. The primitive provides structural scaffolding that fades as students advance: full sentence frames at grade 3, partial frames at grade 4, open fields with checklists at grade 5-6.

**Multimodal features:**
- **Visual:** CER framework visualization with color-coded sections (claim = blue, evidence = green, reasoning = orange, counter = red). Scaffold that visually fades from heavy (full sentence frames) to light (checklists). Source cards available for evidence selection. Argument strength meter based on completeness and evidence quality.
- **Audio (TTS):** Read-back of completed argument so students hear the rhetorical flow.
- **Interactive:** Fill in CER sections with scaffolding support, select evidence from source cards, drag to reorder argument components, hear TTS read-back.

**Learning goals by grade:**
- Grade 3: Answer a question with "I think ___ because ___" using one piece of evidence.
- Grade 4: Full CER with scaffolding. Claim + 2 pieces of evidence + 1 reasoning sentence.
- Grade 5: CER with reduced scaffolding. Stronger reasoning that connects evidence to claim. Acknowledge one counter-point.
- Grade 6: Full argument: claim, 2-3 pieces of evidence with source attribution, reasoning explaining the connection, counter-argument with rebuttal. Evaluate argument strength.

**Interaction model:** Phase 1 (Claim) — state a position on the historical question. Phase 2 (Evidence) — select and incorporate 2-3 pieces of evidence. Phase 3 (Reasoning) — explain how each piece of evidence supports the claim. Phase 4 (Counter) — acknowledge and address a counter-argument (grades 5-6).

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'argument-builder'`
- `claimStated` (boolean)
- `evidenceCount`
- `evidenceFromSources` (boolean — did they reference provided sources)
- `reasoningConnectsEvidenceToClaim` (boolean)
- `counterArgumentPresent` (boolean, grades 5-6)
- `scaffoldLevel` ('full-frames' | 'partial-frames' | 'checklists' | 'open')
- `argumentStrength` (0-100, based on completeness and logical connection)
- `attemptsCount`

---

### 20. `presentation-builder` — Communicate Historical Understanding

**What it does:** Students organize their historical knowledge into a structured presentation format: introduction (hook + thesis), body sections (each with a main idea + supporting details + source citations), and conclusion (summary + significance). The primitive provides structural templates (3-slide, 5-slide, research poster) and teaches presentation organization, not slide design. Each section has guiding prompts and a completeness checklist. Students can hear their full presentation read back via TTS to evaluate flow and persuasiveness.

**Multimodal features:**
- **Visual:** Presentation outline builder with expandable sections. Section cards with guiding prompts and checklists. Flow diagram showing presentation structure. AI-generated topic illustration for the title/introduction. Progress tracker showing completeness.
- **Audio (TTS):** Full presentation read-back. Section-by-section read-back for revision.
- **Interactive:** Add/remove/reorder sections, fill in content with scaffolded prompts, check off completeness criteria, hear read-back, revise.

**Learning goals by grade:**
- Grade 2: Share learning in 3 parts: "I learned about ___, the most important thing is ___, and this matters because ___."
- Grade 3: 3-section presentation: introduction (topic + why it's interesting), 2 body facts with details, conclusion.
- Grade 4: 5-section presentation with main ideas and supporting details. Include at least one source citation.
- Grade 5: Research poster format: question, sources used, findings, conclusion, significance. Proper citation.
- Grade 6: Full structured presentation: hook, thesis, 3+ body sections with evidence and source attribution, counter-perspective, conclusion with significance and connection to today.

**Interaction model:** Phase 1 (Outline) — select a template and fill in section topics. Phase 2 (Develop) — add content to each section using guiding prompts. Phase 3 (Review) — hear TTS read-back and revise for clarity and flow.

**Evaluable:** Yes (structural completeness and organization, not content quality).

**Evaluation metrics:**
- `type: 'presentation-builder'`
- `sectionsComplete` / `sectionsRequired`
- `introductionHasHookAndThesis` (boolean)
- `bodySectionsHaveEvidence` / `bodySectionsTotal`
- `sourceCitationsIncluded` (count)
- `conclusionPresent` (boolean)
- `templateType` ('3-slide' | '5-slide' | 'research-poster' | 'full-presentation')
- `readBackUsed` (boolean)
- `revisionsAfterReadBack` (count)
- `attemptsCount`

---

## Catalog & Domain Structure

### New History Catalog

All 20 new primitives form a new `HISTORY_CATALOG` in `catalog/history.ts`, added to the `UNIVERSAL_CATALOG` aggregation in `catalog/index.ts`.

**Subcategories within the catalog:**

| Subcategory | Primitives |
|---|---|
| Inquiry (INQ) | `inquiry-builder`, `investigation-planner` |
| History (HIST) | `era-explorer`, `cause-effect-chain`, `perspective-lens`, `change-over-time`, `timeline-explorer`* |
| Geography (GEO) | `map-lab`, `region-builder`, `human-environment-sim` |
| Civics (CIV) | `rules-and-laws-lab`, `government-explorer`, `citizen-action-sim`, `rights-and-responsibilities` |
| Economics (ECON) | `trade-and-exchange`, `budget-challenge`, `economic-system-explorer` |
| Sources (SRC) | `source-detective`, `evidence-weigher` |
| Communication (ACT) | `argument-builder`, `presentation-builder` |

*\* = already exists in core catalog*

### Generator Domain

New directory: `service/history/` with individual generator files. New `historyGenerators.ts` in the generators registry.

---

## Multimodal Integration Summary

| Modality | Primitives Using It | Infrastructure |
|---|---|---|
| **TTS Read-Aloud** | `inquiry-builder`, `era-explorer`, `perspective-lens`, `source-detective`, `evidence-weigher`, `argument-builder`, `presentation-builder`, `rules-and-laws-lab`, `government-explorer`, `citizen-action-sim`, `rights-and-responsibilities`, `trade-and-exchange`, `budget-challenge`, `economic-system-explorer` | Gemini TTS -> base64 PCM -> Web Audio API (exists) |
| **AI Image Generation** | `era-explorer`, `perspective-lens`, `change-over-time`, `map-lab`, `human-environment-sim`, `citizen-action-sim`, `trade-and-exchange`, `source-detective`, `presentation-builder` | Gemini image generation (exists) |
| **Drag-and-Drop** | `cause-effect-chain`, `evidence-weigher`, `argument-builder`, `inquiry-builder`, `investigation-planner`, `budget-challenge`, `region-builder` | React DnD patterns (exists) |
| **Node-and-Edge Graph** | `cause-effect-chain` | Pattern exists in `nested-hierarchy` |
| **Canvas Simulation** | `human-environment-sim`, `trade-and-exchange` | Living simulation pattern (exists in engineering) |
| **Comparison/Split View** | `perspective-lens`, `change-over-time`, `economic-system-explorer` | Comparison panel pattern (exists) |
| **Text Highlighting** | `source-detective` | Highlighting system (exists in `interactive-passage`) |
| **Interactive Map** | `map-lab`, `region-builder`, `human-environment-sim` | **New** — zoomable/pannable map canvas with layer toggles |

### New Infrastructure Required

| Capability | Used By | Complexity |
|---|---|---|
| **Map canvas with layers** | `map-lab`, `region-builder`, `human-environment-sim` | Medium — zoomable SVG/canvas with toggleable overlays. Could adapt existing canvas patterns from engineering sims. |
| **Drawable overlay** | `region-builder` | Medium — freeform or lasso drawing on map canvas for region boundaries. |
| **Living sim: environment** | `human-environment-sim` | Medium — extends living simulation pattern with resource meters and consequence animations. |
| **Trade simulation engine** | `trade-and-exchange` | Medium — AI "villager" trading partners with inventory and preference logic. |
| **AI scenario evaluation** | `citizen-action-sim`, `budget-challenge` | Low-Medium — Gemini evaluates student decisions against rubric for consequence generation. |

---

## File Inventory

### New Files (per primitive: component + generator = 2 files)

| # | Primitive | Component File | Generator File |
|---|-----------|---------------|---------------|
| 1 | `inquiry-builder` | `primitives/visual-primitives/history/InquiryBuilder.tsx` | `service/history/gemini-inquiry-builder.ts` |
| 2 | `investigation-planner` | `primitives/visual-primitives/history/InvestigationPlanner.tsx` | `service/history/gemini-investigation-planner.ts` |
| 3 | `era-explorer` | `primitives/visual-primitives/history/EraExplorer.tsx` | `service/history/gemini-era-explorer.ts` |
| 4 | `cause-effect-chain` | `primitives/visual-primitives/history/CauseEffectChain.tsx` | `service/history/gemini-cause-effect-chain.ts` |
| 5 | `perspective-lens` | `primitives/visual-primitives/history/PerspectiveLens.tsx` | `service/history/gemini-perspective-lens.ts` |
| 6 | `change-over-time` | `primitives/visual-primitives/history/ChangeOverTime.tsx` | `service/history/gemini-change-over-time.ts` |
| 7 | `map-lab` | `primitives/visual-primitives/history/MapLab.tsx` | `service/history/gemini-map-lab.ts` |
| 8 | `region-builder` | `primitives/visual-primitives/history/RegionBuilder.tsx` | `service/history/gemini-region-builder.ts` |
| 9 | `human-environment-sim` | `primitives/visual-primitives/history/HumanEnvironmentSim.tsx` | `service/history/gemini-human-environment-sim.ts` |
| 10 | `rules-and-laws-lab` | `primitives/visual-primitives/history/RulesAndLawsLab.tsx` | `service/history/gemini-rules-and-laws-lab.ts` |
| 11 | `government-explorer` | `primitives/visual-primitives/history/GovernmentExplorer.tsx` | `service/history/gemini-government-explorer.ts` |
| 12 | `citizen-action-sim` | `primitives/visual-primitives/history/CitizenActionSim.tsx` | `service/history/gemini-citizen-action-sim.ts` |
| 13 | `rights-and-responsibilities` | `primitives/visual-primitives/history/RightsAndResponsibilities.tsx` | `service/history/gemini-rights-and-responsibilities.ts` |
| 14 | `trade-and-exchange` | `primitives/visual-primitives/history/TradeAndExchange.tsx` | `service/history/gemini-trade-and-exchange.ts` |
| 15 | `budget-challenge` | `primitives/visual-primitives/history/BudgetChallenge.tsx` | `service/history/gemini-budget-challenge.ts` |
| 16 | `economic-system-explorer` | `primitives/visual-primitives/history/EconomicSystemExplorer.tsx` | `service/history/gemini-economic-system-explorer.ts` |
| 17 | `source-detective` | `primitives/visual-primitives/history/SourceDetective.tsx` | `service/history/gemini-source-detective.ts` |
| 18 | `evidence-weigher` | `primitives/visual-primitives/history/EvidenceWeigher.tsx` | `service/history/gemini-evidence-weigher.ts` |
| 19 | `argument-builder` | `primitives/visual-primitives/history/ArgumentBuilder.tsx` | `service/history/gemini-argument-builder.ts` |
| 20 | `presentation-builder` | `primitives/visual-primitives/history/PresentationBuilder.tsx` | `service/history/gemini-presentation-builder.ts` |

### Shared Files (created once)

| File | Purpose |
|---|---|
| `service/registry/generators/historyGenerators.ts` | Register all 20 generators |

### Existing Files Modified

| File | Changes |
|---|---|
| `types.ts` | Add 20 new ComponentIds to union |
| `config/primitiveRegistry.tsx` | Add 20 registry entries |
| `evaluation/types.ts` | Add 20 metrics interfaces + union members |
| `evaluation/index.ts` | Export new metrics types |
| `service/manifest/catalog/history.ts` | **New file** — 20 catalog entries with descriptions |
| `service/manifest/catalog/index.ts` | Import `HISTORY_CATALOG` into `UNIVERSAL_CATALOG` |
| `service/registry/generators/index.ts` | Import `historyGenerators.ts` |

**Total: 41 new files + 7 existing file modifications.**

---

## Implementation Priority

### Wave 1 — Foundation (highest impact, most reusable)

| Primitive | Rationale |
|-----------|-----------|
| `era-explorer` | Most broadly useful — every history unit centers on an era. Establishes the domain. |
| `cause-effect-chain` | Core historical thinking skill. Reusable across every topic. Leverages existing graph patterns. |
| `source-detective` | Source analysis is THE distinguishing skill of history education. Builds on `interactive-passage` highlighting. |
| `map-lab` | Geography underlies all history. Establishes the map canvas infrastructure other primitives need. |

### Wave 2 — Core Disciplinary Skills

| Primitive | Rationale |
|-----------|-----------|
| `perspective-lens` | Perspective-taking is the second most important historical thinking skill. Comparison UI exists. |
| `change-over-time` | Directly teaches continuity vs change — a C3 anchor concept. |
| `evidence-weigher` | Natural companion to `source-detective`. Teaches evidence USE not just analysis. |
| `rules-and-laws-lab` | Entry point for civics. Relatable (classroom rules → laws → Constitution). |

### Wave 3 — Depth & Engagement

| Primitive | Rationale |
|-----------|-----------|
| `trade-and-exchange` | Economics through simulation. Highly engaging discovery-based learning. |
| `government-explorer` | Required civics content every state mandates. |
| `argument-builder` | Assessment capstone — students demonstrate understanding through argument. |
| `citizen-action-sim` | Civics in action. High engagement simulation format. |

### Wave 4 — Complete Coverage

| Primitive | Rationale |
|-----------|-----------|
| `inquiry-builder` | Drives student-led investigation. Meta-skill. |
| `investigation-planner` | Companion to inquiry-builder. |
| `budget-challenge` | Economics simulation, lower priority than trade. |
| `economic-system-explorer` | Advanced economics, grades 5-6 focused. |
| `region-builder` | Geography depth, builds on map-lab. |
| `human-environment-sim` | Most complex simulation — needs map canvas + living sim. |
| `rights-and-responsibilities` | Civics depth, pairs with rules-and-laws-lab. |
| `presentation-builder` | Communication capstone, lower unique value (writing primitives overlap). |

---

## Cross-Primitive Learning Paths

### The Historical Thinking Path
```
era-explorer -> cause-effect-chain -> perspective-lens -> change-over-time
  (context)       (causation)          (perspective)       (continuity & change)
```

### The Source Analysis Path
```
source-detective -> evidence-weigher -> argument-builder -> presentation-builder
  (analyze)           (evaluate)          (argue)              (communicate)
```

### The Inquiry Path
```
inquiry-builder -> investigation-planner -> source-detective -> argument-builder
  (question)          (plan)                   (investigate)       (conclude)
```

### The Civics Path
```
rules-and-laws-lab -> rights-and-responsibilities -> government-explorer -> citizen-action-sim
     (rules)               (rights)                    (structure)             (action)
```

### The Economics Path
```
trade-and-exchange -> budget-challenge -> economic-system-explorer
     (exchange)          (scarcity)           (systems)
```

### The Geography Path
```
map-lab -> region-builder -> human-environment-sim
 (read)      (define)           (interact)
```

---

## Cross-Domain Connections

| History Primitive | Connects To | How |
|---|---|---|
| `cause-effect-chain` | `nested-hierarchy` (core) | Same node-and-edge graph interaction pattern |
| `source-detective` | `interactive-passage` (core) | Extends existing text highlighting system |
| `evidence-weigher` | `evidence-finder` (literacy) | Same claim + evidence + reasoning framework |
| `argument-builder` | `opinion-builder` (literacy) | Same CER scaffold, different domain content |
| `perspective-lens` | `comparison-panel` (core) | Same side-by-side comparison layout |
| `change-over-time` | `evolution-timeline` (biology) | Same multi-period comparison pattern, different domain |
| `human-environment-sim` | Engineering living sims | Same canvas simulation pattern with consequence modeling |
| `trade-and-exchange` | Assessment `scenario-question` | Same decision-with-consequences pattern |
| `map-lab` | `region-builder`, `human-environment-sim` | Shared map canvas infrastructure |
| `presentation-builder` | `paragraph-architect` (literacy) | Same structured writing scaffold pattern |
| `budget-challenge` | Math primitives | Real-world application of addition, subtraction, percentages |
| `era-explorer` | `timeline-explorer` (core) | Era-explorer goes deep where timeline-explorer goes wide |

---

## Open Questions

1. **Map canvas technology** — `map-lab`, `region-builder`, and `human-environment-sim` all need a map canvas. Options: (a) SVG-based custom maps generated by Gemini, (b) Leaflet.js or similar mapping library with custom tiles, (c) simple image-based maps with interactive overlay zones. SVG gives most control; Leaflet gives real geographic accuracy; image-based is simplest. Needs spike.

2. **Historical accuracy in AI generation** — Gemini generates the content for these primitives. History content requires factual accuracy more than creative domains. Should we add a historical accuracy validation layer? Or trust Gemini with careful prompt engineering and source attribution in generators?

3. **Sensitive topics** — History includes slavery, genocide, colonialism, and other sensitive topics. How should the generators handle age-appropriate presentation? Should there be topic-level content filters? The C3 Framework says students should engage with difficult history, but the presentation must be grade-appropriate.

4. **State-specific content** — Social studies standards vary significantly by state (e.g., Texas vs California vs New York). The C3 Framework provides a national foundation, but many states have specific content requirements (state history in grade 4, US history in grade 5, world history in grade 6). Should primitives be content-agnostic (just the thinking skills) or include state-specific content packs?

5. **Assessment integration** — Many of these primitives teach process skills (source analysis, argument construction) that are harder to auto-evaluate than factual recall. How much should we rely on Gemini for evaluating argument quality vs sticking to structural metrics (completeness, evidence count, etc.)?

6. **Simulation complexity** — `human-environment-sim` and `trade-and-exchange` are the most simulation-heavy primitives. How complex should the simulation model be? Simple (3-4 variables, clear cause-effect) vs rich (8+ variables, emergent behavior)? K-6 students need clarity, not complexity.

7. **Connection to timeline-explorer** — The existing `timeline-explorer` in core naturally fits the history domain. Should it be cross-listed in both catalogs, or should `era-explorer` and `change-over-time` fully replace it for history? Current recommendation: cross-list it — `timeline-explorer` handles broad chronological sequences while the new primitives handle deep analysis.

8. **Overlap with LA argument writing** — `argument-builder` (history) and `opinion-builder` (literacy) teach the same CER framework but for different content domains. Should they share a base component with domain-specific configuration? Or stay as separate primitives that the manifest resolves based on subject context?
