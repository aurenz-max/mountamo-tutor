# Map and compass: places and directions on a simple map

Curriculum IDs: SS003-06-c, unit SS003 Geography (SOCIAL_STUDIES, grade 1). Source: design review ss-g1-2026-10-17.

## Curriculum

**SS003-06-c** (Location and Spatial Thinking): "Students engage in a conversation with the AI tutor to describe a scene using spatial and cardinal direction terms. Focus: Oral practice of spatial reasoning. Examples: Describe the school, Where is the park?, What is near the store?, What is north of the house?, Is the cat above the bed?. Constraints: AI-led conversation, student must use at least two positional or cardinal words in responses, 3-5 minute session."

## Learning goal and gap

A first grader should locate places on a simple map and describe where one place is relative to another, using positional words (near, next to, between) and the four cardinal directions.

No primitive teaches this (source check of the full catalog, 2026-10-17):
- **No map:** spatial-scene is a 3x3 grid of ten fixed emoji objects with a random theme (classroom, farm, park and so on). There is no town, school or map option.
- **No cardinal words:** spatial-scene's spoken mode, describe_scene, judges only left of, right of, in front of and behind, one relation per turn, in four scenes fixed in code.
- **Cardinal words only as sun and shadows:** light-shadow-lab is the only primitive that answers with cardinal words.
- **No direction map:** airplane-diorama's flight plan shows a map but asks for hop counts.

## Essential behaviour

- A simple picture map (a neighbourhood or a school) with a compass rose and 5-8 labelled places.
- The child finds a place from a direction clue ("the park is north of the school"), and says or taps which place is in a given direction from another.
- The child describes the location of a place in their own words. Credit requires the right place, a correct direction or positional word, and the reference place. This is the "at least two words" requirement, judged against relations computed from the map.
- Directions are read from the compass rose, not assumed to be "up". Some maps could be rotated, which the implementing session may decide to leave for a harder level.

## Worked example

A map with School in the centre, Park to the north, Store to the east, and Library next to the Store.

- "What is east of the school?" Answer: the Store.
- "Tell me where the library is." Credited: "The library is next to the store" or "The library is east of the school." Not credited: "It's over there" (no reference place) or "The library is north of the school" (wrong relation).

A plausible misconception: calling north "up" on a map rotated so north points sideways.

## Evidence of success

- Independent: correct relations on a new map, spoken or tapped, without the compass rose highlighted.
- Supported practice: the compass rose highlighted, or a sentence frame ("The ___ is ___ of the ___").
- No credit: direction words with no reference place, or a correct word about the wrong place.
- Uncertainty: places that are diagonal (north-east) should not be asked about with a four-direction word.

## Constraints and open questions

- Speech needs a microphone and the live tutor; every task should also have a tap path.
- Spoken credit must come from relations computed from the map's layout, not from the model's own reading of the picture.
- Open: whether this extends spatial-scene (a map theme, a compass and larger grids) or is a new primitive. spatial-scene's 3x3 grid and fixed object list suggest a new primitive, but the implementing session should judge after reading it.

## Handoff

Inspect current repository guidance (`/primitive`, spatial-scene, light-shadow-lab) and related capabilities, then follow your own design and build process and deliver a working capability with verification. Schema, architecture, naming and build order are yours.
