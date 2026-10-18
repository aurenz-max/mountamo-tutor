# Same and different: two children, two celebrations

Curriculum IDs: SS005-03-c, SS005-04-d, sibling SS005-03-a, sibling SS005-03-b (SOCIAL_STUDIES, grade 1). Source: design review ss-g1-2026-10-17.

## Curriculum

- **SS005-03-c** (Similarities and Differences): "Read a short story about a child from another country and identify two traits that are the same as your life and two that are different. ... Constraints: Passage under 150 words; utilize a simple checklist for identifying similarities and differences."
- **SS005-04-d** (Celebrations Around the World): "Compare two celebrations that serve similar purposes, such as New Year festivals or harvest holidays, by analyzing their similarities and differences. Focus: Understanding that different cultures often share similar functional holidays. Examples: Thanksgiving vs. Chuseok (harvest), January 1st vs. Chinese New Year (new start)."
- Siblings with the same learner action: SS005-03-a (sort traits into same/different) and SS005-03-b (things all people share / things that make people unique).

## Learning goal and gap

A first grader should see that people in another place share many things with them (eating with family, going to school, playing) and differ in others (language, clothes, festivals). They should also see that two cultures' holidays can serve the same purpose (giving thanks for the harvest, starting a new year) even when they look different.

Current tools do not ask the child to make that sort:
- knowledge-check gives one multiple-choice item per draw with no multi-select, so "pick two same and two different" cannot be asked. Its key must be fixed, so "same as your life" can only be keyed by assuming the child's life. The probe keyed "Eating with family" as the trait the reader shares with Kenji.
- story-bridge has a Venn tap mode (venn_place) checked in code. But it is locked to two five-sentence stories with three paired characters, and it compares what characters did, not what the celebrations are for. The say_alike probe ignored the topic and compared "Morning at Home" with "Park Playtime".
- comparison-panel shows two cards side by side with two true/false gates. It has no grade 1 rules: gates must be "answerable only by reading the content".

Recommendation: a new interaction, or a mode on an existing comparison primitive if the implementing session finds one that already holds two subjects and a three-region sort. The implementing session decides which.

## Essential behaviour

- The child meets two subjects through pictures and short narrated text, readable or heard at a grade 1 level: two children's days in two places, or two celebrations with the same purpose.
- The child places 4-6 features into "both", "only A" and "only B". Each feature is a picture with a short label and a voiced caption.
- For celebrations, the child also names the shared purpose ("both say thank you for food") from choices that are all plausible purposes.
- A "your life" step is welcome as reflection: "Do you do this too?" It earns no credit, because the key cannot know the child's life.
- No feature label repeats its region's name, and no picture appears in both a feature and a region header.

## Worked example

Mei in Korea at Chuseok, and Sam in the United States at Thanksgiving. Features: family meal (both), rice cakes called songpyeon (Mei), turkey (Sam), visiting grandparents (both), autumn (both), bowing to ancestors (Mei). Shared purpose: giving thanks for the harvest.

A plausible misconception: putting "family meal" under only one subject because the foods differ, which is the confusion the objective targets. The tutor can point at both tables.

## Evidence of success

- Independent: places fresh features for a new pair correctly, and picks the shared purpose for a pair not seen before.
- Supported practice: the same task with a narrated hint or a feature already placed.
- No credit: the "your life" reflection, tapping through, or placements made after the answer is shown.
- Uncertainty: some features truly sit in "both" for some families and not others (food, clothing). Prefer features that are defining facts of each celebration or place over lifestyle generalisations, and avoid stereotypes ("children in Japan wear kimonos" is a festival practice, not daily life).

## Constraints and open questions

- Grade 1 reading: short labels, every label voiced, pictures carry the content.
- Cultural accuracy matters more here than in most primitives. The implementing session should decide whether pairs come from a reviewed code list (as the literacy word library does) or are model-written with a check.
- Open: whether one primitive should serve both "two children" and "two celebrations", or the first only with celebrations as a mode.

## Handoff

Inspect current repository guidance (`/primitive`, the catalog, story-bridge and comparison-panel) and related capabilities, then follow your own design and build process and deliver a working capability with verification. Schema, architecture, naming and build order are yours to choose.
