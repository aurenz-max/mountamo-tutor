# Setting the clock with a.m. and p.m.

*Kind: new-mode · Curriculum design review math-g2-2026-10-27 · written 2026-10-27*

## Curriculum (published, verbatim)
- **MEAS002-04-b** (MEAS002-04 Tell Time to Five Minutes): Students distinguish between a.m. and p.m. while setting the analog clock to specific requested times. Focus: Connecting daily activities with a.m./p.m. and setting times. Examples: set clock to 8:00 a.m., set clock to 7:30 p.m., set clock to 12:15 p.m., set clock to 6:45 a.m. Constraints: Use real-world event context (waking up, bedtime, lunch) to determine a.m./p.m.; ensure user can manipulate hands on the analog clock.

## Learning goal and gap
Grade 2 students set an analog clock to a time and say whether it is a.m. or p.m. from what is happening (waking up, lunch, bedtime). No Lumina primitive represents a.m./p.m.: `analog-clock` stores hour 1-12 and minute and scores hour mod 12. `time-sequencer` `time-of-day` asks morning/afternoon/evening/night with no clock, and its probe told the child to "set your clock to 7:00 a.m." in a mode with no clock. `clock-sequence` deliberately drops sets that mix morning and afternoon.

Recommendation: a mode on `analog-clock`, because the objective requires moving the hands.

## Essential behavior
- An event and a time are given in words ("Bedtime is at 7:30"); the child sets the hands and chooses a.m. or p.m.
- The event decides a.m./p.m.; the printed time does not include it.
- Include the times children confuse: just after noon (12:15 p.m., lunch), early morning (6:45 a.m.) and evening (7:30 p.m.).
- Five-minute times, as in the Grade 2 item space.

## Worked example
"School lunch is at 12:15." The child moves the minute hand to the 3 and the hour hand just past 12, and picks p.m.
Misconceptions: choosing a.m. because 12 looks like the start of the day; setting the hour hand to 3 and the minute hand to 12.

## Evidence of success
- Independent: correct hands and correct a.m./p.m. on a fresh event.
- Record the two parts separately: correct time with wrong a.m./p.m. is a different gap from the reverse.
- No credit for a time reached by the timeline slider (see below).

## Constraints and open questions
- Observation to recheck: the timeline scrubber stays active in `set_time`, so the hands can be bypassed (AnalogClock.tsx:1170-1181).
- Observation to recheck: the day/night strip spaces 24-hour sun/moon icons over a 12-hour slider, so its "12 PM" sun sits at 6:00 (AnalogClock.tsx:123-132, :478-480). Fix it or remove it before a.m./p.m. reasoning relies on it.
- Observation: only the minute hand is draggable; the hour hand follows. Whether Grade 2 should place the hour hand is open.
- Open: whether 12:00 noon and midnight belong at Grade 2.

**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive's contract in `docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, architecture, mode naming, generator approach and build order are yours to choose. Deliver the working capability with the verification those skills require, and recheck the observations below against the code first: they describe the code on 2026-10-27 (commit bebc891f56).
