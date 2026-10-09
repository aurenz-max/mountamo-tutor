# solar-system-explorer levers (2026-10-08 class sweep)

`/add-support-tiers` on all five modes: identify, order_from_sun, classify, compare_attribute, orbital_reasoning. The user waived the "confirm the table first" stop for this sweep.

## Failure inventory

There is no real-learner evidence (observed-real is empty). No demonstrations, misconception reports or remediation module exist for this primitive, and there is no contract doc (`docs/contracts/solar-system-explorer.md`). The checked misses come from `solarSpokenMisses`, which the spoken_miss observer names on every item:

| Mode | Miss (class) | Pattern |
|---|---|---|
| all | `said_sun` (documented: catalog commonStruggles, DI script) | names the Sun, which is a star |
| identify | `neighbour_planet` (documented: DI signature) | names the planet next to the glowing one |
| order closest/farthest | `signature_planet` (documented) | names the other end (direction reversal) |
| order position | `signature_planet` (documented) | lands one planet short (counts the Sun as one) |
| classify | `signature_planet` (documented) | names the biggest rocky planet as a giant, the smallest giant as rocky, or the smallest true planet as a dwarf |
| compare | `signature_planet` (documented) | the smaller of a pair; the closest planet for hottest; the runner-up |
| orbital | `signature_planet` (documented) | turns the relationship around (names the quick planet for the slow one) |
| all | `other_planet` (inferred) | any other planet |

## Lever table (built)

| Mode / facet | Lever | Kind | Answers | Leak rule |
|---|---|---|---|---|
| all (Sun on screen) | `star_mark`: star outline on the Sun, Sun dimmed | help | said_sun | marks only the Sun |
| identify | `close_up`: the glowing planet drawn big in its colours | help | neighbour, other | no name; labels stay withheld |
| order closest/farthest | `near_far_model`: model sun with near and far rings, the asked end's dot glowing | help | signature, other | fixed per facet, none of the sky's planets; the `does` text says not to match it to a planet |
| order position | `first_ring`: first ring out from the Sun drawn bright | help | signature, other | first planet only; position is n >= 2, so this ring is never the answer |
| order position (n >= 3) | `fewer_rings`: an ungraded nearer position | simplify | signature, other | its planet is not the answer to any item in the session |
| classify | `kind_model`: cratered rock plus striped gas world (dwarf: tiny world beside a full planet) | help | signature, other | a model outside the sky; the `does` text says not to match it to a planet |
| compare biggest/smallest/pair | `size_row`: planets (or the pair) at true size in order from the Sun, no names | help | signature, other | no names, none marked |
| compare hottest/most_moons | `fact_strip`: every planet's value side by side, in order from the Sun | help | signature, other | the research cards laid flat; none marked |
| compare biggest/smallest | `two_planets`: an ungraded named pair far apart in size (ratio >= 2) | simplify | signature, other | no member is the answer to any item in the session; the session does not already ask the pair |
| orbital (all) | `trip_model`: model sun; in the same time the near dot goes far round and the far dot a little way | help | signature, other | a model outside the sky; the `does` text says not to match it to a planet |
| orbital longest/shortest | `two_planets`: an ungraded pair race far apart in period (ratio >= 3) | simplify | signature, other | same as the compare pair |

`config.difficulty` start positions are not set. The generator has no tier harness and the primitive never reads `supportTier` on the judged face. Adding them is a separate generator change.

## Built

- `astronomy/solarSystemLevers.ts`: the declarations, the simplify builder `simplerSolar` (built through `itemFromChallenge`), the scene facts, `solarLeverLeaks`, and `solarPracticeItem` for the journey.
- `astronomy/SolarLeverViews.tsx`: the panels. The star mark and the first ring are drawn on the canvas, in `SolarSystemExplorer.tsx`.
- `SolarSystemExplorer.tsx` JudgedFace: lever state keyed by item, a practice item, a synchronous `pullLever`, `endPractice` and `onPracticeClosed`.
- Catalog: `levers: true`. The misses lists are unchanged; they were already declared.
- Journey row: `solarJourneyItem` (adapter) rebuilds `<id>~simpler` from its parent.
- New saved payloads: `solar-system-explorer.{order_from_sun,classify,orbital_reasoning}.json` (one generation each).

## Tests

- `solarSystemLevers.test.ts` (73 tests) runs on all five saved payloads. It checks that every checked miss has a lever on each item (J12), that no lever text or fact names an answer, the exact set of items where simplify is offered, that every easier item is the same mode and never anyone's answer, that the journey rebuilds it, the first-ring and size-row rules, and the miss → `nextLever` table.
- `SolarSystemExplorer.levers.workspace.test.tsx` (5 tests) checks that a pull changes the sky and the scene fact in one commit and names no planet, that the next attempt records `levers`, and that a refused pull leaves the HTML, levers, demand and attempts unchanged. It also checks that `two_planets` opens an ungraded pair (practice attempt), comes back to the full sky blank, and credits only the full item, and that `fewer_rings` opens a nearer position.
- All astronomy tests pass (16 files, 328 tests), and so do the generator, catalog and W1 contract suites for solar. `typecheck:lumina` = 0.
- Not run: the journey sweep, tutor replay and Live (the batch verify step does these), and a browser check of the panels and the star outline on the moving canvas.

## Items with no simplify lever (each still has a help lever for every miss)

- identify: one planet and one name is already the plainest item. An easier planet (Earth, Mars) is another item's answer on the saved payload (all six planets are asked), so the lever would never fire.
- closest, farthest, pair_bigger, pair_faster: already the plainest shape.
- hottest, most_moons: no pair facet exists for temperature or moons.
- classify: the saved payload asks every kind (rocky, giant, dwarf). Every easier kind is another item in the session, so an easier-kind lever would never fire, and I did not build one.
- `said_sun` has no lever when no Sun is drawn. Every saved payload draws one.
