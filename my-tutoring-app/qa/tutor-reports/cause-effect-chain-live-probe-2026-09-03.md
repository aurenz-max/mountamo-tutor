## identify_cause @G1 — "Towns Along the Iron Tracks" (the 1800s plains), fallback=no
challenges 5 → items 10, dropped challenges 2 [cec-4:identify_cause, cec-5:identify_cause]
kinds: identify_cause, identify_cause, identify_cause, identify_cause, identify_cause, identify_cause, identify_cause, identify_cause, identify_cause, identify_cause
gate issues: none
- cec-1:cec-1-d2 [identify_cause] correct="no" plainWrong="yes" sig="yes, that was true back then"
  ask: Listen. In the end: Letters arrive every morning at the village post office. Here is one event: Horses pull wooden wagons through deep mud puddles. Your turn. Did this event help cause the ending — yes or no?
- cec-1:cec-1-1 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. Same ending: Letters arrive every morning at the village post office. Here is another event: Workers lay heavy iron tracks across the prairie grass. Your turn. Did this event help cause the ending — yes or no?
- cec-1:cec-1-d1 [identify_cause] correct="no" plainWrong="yes" sig="yes, it is about the same thing"
  ask: Listen. Same ending: Letters arrive every morning at the village post office. Here is another event: Children run down to the platform to wave at the passengers. Your turn. Did this event help cause the ending — yes or no?
- cec-1:cec-1-2 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. Same ending: Letters arrive every morning at the village post office. Here is another event: Steam engines pull heavy mail sacks on iron wheels. Your turn. Did this event help cause the ending — yes or no?
- cec-2:cec-2-1 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. In the end: Children walk down main street to sit at wooden desks. Here is one event: Families build tall houses close together near the station. Your turn. Did this event help cause the ending — yes or no?
- cec-2:cec-2-d2 [identify_cause] correct="no" plainWrong="yes" sig="yes, that was true back then"
  ask: Listen. Same ending: Children walk down main street to sit at wooden desks. Here is another event: Farmers grow tall green corn in the warm summer sun. Your turn. Did this event help cause the ending — yes or no?
- cec-2:cec-2-d1 [identify_cause] correct="no" plainWrong="yes" sig="yes, it is about the same thing"
  ask: Listen. Same ending: Children walk down main street to sit at wooden desks. Here is another event: Dogs sleep softly under the wooden porch in the afternoon. Your turn. Did this event help cause the ending — yes or no?
- cec-2:cec-2-3 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. Same ending: Children walk down main street to sit at wooden desks. Here is another event: Carpenters nail timber planks to raise a schoolhouse. Your turn. Did this event help cause the ending — yes or no?
- cec-3:cec-3-d1 [identify_cause] correct="no" plainWrong="yes" sig="yes, it is about the same thing"
  ask: Listen. In the end: Markets sell sweet oranges brought from far away valleys. Here is one event: Babies taste sweet red berries picked from the garden. Your turn. Did this event help cause the ending — yes or no?
- cec-3:cec-3-2 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. Same ending: Markets sell sweet oranges brought from far away valleys. Here is another event: Cargo cars roll past the river banks loaded with crates. Your turn. Did this event help cause the ending — yes or no?

## build_chain @G3 hard — "Trail to the New West" (the 1800s West), fallback=no
challenges 5 → items 5, dropped challenges 0 []
kinds: build_chain, build_chain, build_chain, build_chain, build_chain
gate issues: none
- cec-1 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Families reach the western territories in just a few days instead of many months. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-2 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Farmers harvest huge fields of golden wheat on the flat grassy plains. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-3 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Town residents receive letters from distant relatives just days after sending them. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-4 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Busy brick storefronts and banks open along the main street of the mountain camp. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-5 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Children sit at wooden desks writing spelling lessons on slate chalkboards every morning. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.

## root_vs_proximate @G5 — "Printing Press Sparks European Change" (Fifteenth Century Europe), fallback=no
challenges 5 → items 5, dropped challenges 0 []
kinds: root_vs_proximate, root_vs_proximate, root_vs_proximate, root_vs_proximate, root_vs_proximate
gate issues: none
- cec-1 [root_vs_proximate] correct="metalworkers invent" plainWrong="workshops print" sig="royal academies"
  ask: Listen. In the end: Astronomers across Europe successfully pooled their planetary observations to disprove old theories. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.
- cec-2 [root_vs_proximate] correct="parishioners debate" plainWrong="village schoolmasters" sig="press operators"
  ask: Listen. In the end: Ordinary churchgoers challenge traditional religious authority by reading scripture themselves. The events are on the cards. Your turn. Say which event happened last — the one right before the ending.
- cec-3 [root_vs_proximate] correct="craftsmen affordable" plainWrong="apprentices practice" sig="guild masters"
  ask: Listen. In the end: Town merchants establish widespread neighborhood schools for working-class children. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.
- cec-4 [root_vs_proximate] correct="magistrates levy" plainWrong="anonymous pamphleteers" sig="publishers set"
  ask: Listen. In the end: Kings create royal inspection boards to confiscate unauthorized manuscripts. The events are on the cards. Your turn. Say which event happened last — the one right before the ending.
- cec-5 [root_vs_proximate] correct="engravers carve" plainWrong="conductors rehearse" sig="patrons purchase"
  ask: Listen. In the end: Orchestras across different countries perform complex symphonic pieces with identical phrasing. The events are on the cards. Your turn. Say which event is the root — the one that had to happen before any of the others could.

## mixed @G2 — "Why Our Town Has Rules" (our growing town), fallback=no
challenges 5 → items 9, dropped challenges 0 []
kinds: identify_cause, identify_cause, identify_cause, identify_cause, identify_cause, identify_cause, build_chain, build_chain, root_vs_proximate
gate issues: none
- cec-2:cec-2-d1 [identify_cause] correct="no" plainWrong="yes" sig="yes, it is about the same thing"
  ask: Listen. In the end: Town leaders set strict turns for drawing water from the stone well. Here is one event: Tired dogs sleep softly in the cool shade beside the damp stones. Your turn. Did this event help cause the ending — yes or no?
- cec-2:cec-2-d2 [identify_cause] correct="no" plainWrong="yes" sig="yes, that was true back then"
  ask: Listen. Same ending: Town leaders set strict turns for drawing water from the stone well. Here is another event: Carpenters use sharp iron saws to shape pine planks for new roofs. Your turn. Did this event help cause the ending — yes or no?
- cec-2:cec-2-1 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. Same ending: Town leaders set strict turns for drawing water from the stone well. Here is another event: A long dry summer dries up the shallow creeks near the forest. Your turn. Did this event help cause the ending — yes or no?
- cec-2:cec-2-2 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. Same ending: Town leaders set strict turns for drawing water from the stone well. Here is another event: Every farmer brings heavy wooden buckets to the single shared well. Your turn. Did this event help cause the ending — yes or no?
- cec-5:cec-5-2 [identify_cause] correct="yes" plainWrong="no" sig="no, that was not the last thing that happened"
  ask: Listen. In the end: Town leaders require every apple cart to have strong wheel brakes. Here is one event: Worn wooden wheels slip on the smooth stones and roll too fast. Your turn. Did this event help cause the ending — yes or no?
- cec-5:cec-5-d2 [identify_cause] correct="no" plainWrong="yes" sig="yes, that was true back then"
  ask: Listen. Same ending: Town leaders require every apple cart to have strong wheel brakes. Here is another event: Weavers sew coarse linen cloth using long steel needles and thread. Your turn. Did this event help cause the ending — yes or no?
- cec-1 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Town leaders put bright oil lamps along the main dirt road. Here are the events: Parents ask the council for light posts near every gate. Children stumble over loose rocks and lose their books in the dust. Families walk home in the dark after the sun sets. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-4 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Town leaders ban dumping kitchen scraps near the community well. Here are the events: Rain washes the dirty waste straight into the drinking water supply. Cooks toss old cabbage leaves and melon rinds out the back door. Swarms of buzzing flies gather over the rotting food piles every noon. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-3 [root_vs_proximate] correct="farmers bring" plainWrong="hungry animals" sig="children clean"
  ask: Listen. In the end: Town leaders pass a law that keeps cows out of the public park. Here are the events: Children have no clean space left to play tag after school. Farmers bring large brown cows to eat the grass on the town green. The hungry animals eat every green blade and leave deep mud holes. Your turn. Say which event is the root — the one that had to happen before any of the others could.

## build_chain @G5 easy — "Mastering the Roman Roads" (Ancient Rome), fallback=no
challenges 4 → items 4, dropped challenges 0 []
kinds: build_chain, build_chain, build_chain, build_chain
gate issues: none
- cec-1 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Roman legions quickly crush distant rebellions against the emperor. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-2 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Farmers in distant provinces sell their olive oil in crowded Rome. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-3 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: The imperial treasury receives silver coins from every province. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.
- cec-4 [build_chain] correct="the cards placed in causal order" plainWrong="the cards placed in reverse order" sig=""
  ask: Listen. In the end: Innocent travelers journey between distant cities without being robbed. The events are on the cards. Your turn. Put the cards in the order they happened, so each one leads to the next.

