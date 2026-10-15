# airplane-diorama `flight_plan` (L1, 2026-10-15)

**Task:** fly a trip between two made-up airports. The learner loads fuel tanks (the loader starts empty) and presses
Fly; the flight is the check. The plane flies the route on the map, one tank empties per stretch, and it lands or
comes down short.

- **K-2:** the map draws the route as coloured hops (not numbered); one tank flies one hop.
- **3-5:** the map shows only the distance; one tank flies 100-500 km, so the learner divides.
- **Key:** trip tanks + 1 spare (the rule is on screen). Code owns every number (`pickFlightNumbers`: different tank
  counts within a session). Gemini writes only the towns and the riders.
- **Misses:** `too_little_fuel`, `no_spare_fuel` (exactly the trip, the most likely mistake), `too_much_fuel`.
- **Try again** empties the loader, so the count is worked out again and not nudged by one.
- **β 0.5**, scaffolding 3 (catalog + backend registry). A mixed session is 3 finds then 2 trips.

## Verification

| Check | Result |
|---|---|
| Headless browser drive, 3-5, fuel topic (`g35/`) | 25/25 |
| Headless browser drive, K-2 (`k/`) | 25/25 |
| What both drives covered | a no-spare miss, Try again, every trip, the finale, phone width with no horizontal scroll, no console errors; the tank count never on screen before a flight |
| FitGate, pinned with a fuel topic | pass, 0.69 |
| FitGate, mixed | pass, 0.56 |
| FitGate, pinned under the tester's default "parts" topic | fails, correctly: the topic does not ask for fuel |
| Journey sweep `airplane-diorama.flight_plan` (real payload) | clean |
| Model and workspace tests | 18 |
| typecheck:lumina | 0 |
| Full tsc | 770, the baseline |

## Fixed during the slice

- Gemini copied the prompt's example trip into every session ("Pine Hill to Bay Town, the school band"). The examples
  are gone, and the fallback trips are shuffled.
- A flight-only session was titled "Parts of the Jet" (from the topic). The prompt now scopes the framing to fuel and
  trips.
- The Engineering tester had no mode picker for airplane or train-yard. It now has a shared Task picker for any
  multi-mode family.
- The K-2 ask "Find the wings ... tap it" now says "tap them".

The mixed path was not browser-driven: another session's edits kept reloading the shared dev server. It is covered by
a real API generation and by the workspace test "a mixed session runs a find, then a trip".
