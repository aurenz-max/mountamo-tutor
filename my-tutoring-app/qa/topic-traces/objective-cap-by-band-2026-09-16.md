# Objective cap by band + one-objective theming — topic-trace, 2026-09-16

Occasion: a Preschool lesson on "orange excavators and red dump trucks" built 3 objectives and 10
components for a four-year-old. The cap (1 PreK / 2 K / 3 above) now lives in
`service/curator-brief/objectiveBudget.ts`, applied in code after the curator brief returns and used as
the recommended-fill size. The manifest voice block reads the objective count: at one objective it
themes every component; otherwise at most two.

Four parallel `/api/lumina/topic-trace` runs (manifestOnly), persona = Alex with interests
excavators / dump trucks / trash trucks.

## Objectives and components per band

```
out-req-elementary-Adding.json  gradeLevel=Grade 1  objectives=3  briefObjectives=3  components=8
out-req-kindergarten-Counting.json  gradeLevel=kindergarten  objectives=2  briefObjectives=2  components=7
out-req-preschool-Counting.json  gradeLevel=preschool  objectives=1  briefObjectives=1  components=4
out-req-preschool-orange.json  gradeLevel=preschool  objectives=1  briefObjectives=1  components=4
```

Before: the screenshot run (preschool, same topic) had 3 objectives / 10 components.

## Themed component intents (regex: truck|excavat|digger|construction|machine|work site)

```
== out-req-elementary-Adding.json
  obj1 [THEMED] ten-frame :: Guide Alex to combine two distinct groups of physical counters on a double ten frame up to 20. Frame one sce
  obj1 [      ] addition-subtraction-scene :: Provide interactive joining story scenes where students act out combining two groups of objects and state the 
  obj2 [      ] annotated-example :: Present a step-by-step worked comparison showing the difference between counting all from one versus starting 
  obj2 [      ] number-line :: Have students practice jumping forward from a starting number on an interactive number line (0-20), visualizin
  obj2 [      ] di-spoken-practice :: Prompt the student to explain aloud in their own words why starting at the bigger number and counting on helps
  obj3 [      ] foundation-explorer :: Introduce the anatomy of an addition equation, highlighting the addends, the plus symbol (+ meaning put togeth
  obj3 [THEMED] equation-builder :: Guide Alex to assemble addition equations within 20 by dragging number tiles and symbol tiles (+ and =) into
== out-req-kindergarten-Counting.json
  obj1 [      ] ten-frame :: Guide Alex to build and touch quantities up to 5 on a single five/ten-frame workspace, practicing touching e
  obj1 [THEMED] counting-board :: Set up counting scenes featuring sets of 1 to 5 dump trucks and excavators lined up on a work site. The studen
  obj1 [      ] di-dice-roll :: Present single standard dice rolls showing 1 to 5 dots. The child touches each pip in order and states the tot
  obj2 [      ] concept-card-grid :: Present clear, picture-rich cards introducing numerals 1, 2, 3, 4, 5 paired side-by-side with their written nu
  obj2 [      ] number-tracer :: Provide guided tracing practice for numerals 1 through 5, reinforcing correct numeral formation and recognitio
  obj2 [      ] di-math-facts :: Drill numeral recognition by flashing single numerals from 1 to 5 on screen, prompting the student to say the 
== out-req-preschool-Counting.json
  obj1 [THEMED] counting-board :: Guide Alex to practice one-to-one correspondence by tapping each vehicle in small groups of excavators, dump
  obj1 [THEMED] di-dice-roll :: Engage Alex in touching and counting dots on a single die showing up to 5 pips, framed as counting loads of 
  obj1 [THEMED] counting-board :: Challenge Alex to carefully touch and count scattered groups of up to 5 work vehicles (excavators, dump truc
== out-req-preschool-orange.json
  obj1 [THEMED] machine-profile :: Introduce Alex to the big orange excavator! Highlight its special job of scooping dirt, digging deep holes, 
  obj1 [THEMED] excavator-arm-simulator :: Let Alex take the controls of the bright orange excavator in a colorful, cartoon preschool sandbox. Guide hi
  obj1 [THEMED] dump-truck-loader :: Invite Alex to work with the mighty red dump truck! Guide him to watch the orange excavator fill the truck b
```

PreK counting: 3/3 themed (one-objective line). K: 1 of 6. Grade 1: 2 of 7 (at-most-2 line intact).
