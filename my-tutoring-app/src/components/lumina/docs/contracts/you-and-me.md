# Contract: you-and-me

- **Derived:** 2026-09-28 · evidence window: workspace rollout B3 + w1 payload + `YouAndMe.test.tsx` + git
- **Component:** `primitives/visual-primitives/literacy/YouAndMe.tsx` (workspace only) + `youAndMeWorkspace.ts` + `youAndMeSupport.ts` + `youAndMeLevers.ts` · **Generator:** `service/literacy/gemini-you-and-me.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`you-and-me`)
- **Status:** ACTIVE (no open conflicts)

Static derivation for the you-and-me slice of handoff 22 L4.

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| K-1 personal pronouns I/you (describe_action) and myself/yourself (describe_independent_action) | catalog evalModes | `literacy.ts` you-and-me entry | live |
| Shared teaching workspace + live journey | live + code | `youAndMeWorkspace.ts`; w1 payloads | 2026-09-28 |

## Requirements

### R1 — The answer is a spoken sentence whose subject points at the doer from the speaking role · OBSERVED
- **Property:** I when the speaker acted, you when the listener acted; on independent actions also myself/yourself for that person. Swapped I/you, the doer's name, he/she are named misses (`youAndMeSpokenMisses`).
- **Probe:** `npm test -- YouAndMe.test`.

### R2 — No pronoun or model sentence on screen or in the ask before a wrong attempt · OBSERVED
- **Property:** the scene, the ask and every aid name roles and people, never I/you/myself/yourself.
- **Probe:** `npm test -- YouAndMe.test youAndMeLevers`.

### R3 — The scene is fixed across a pair; only the speaker swaps · OBSERVED
- **Probe:** `npm test -- YouAndMe.test` ("trades the speaker").

### R4 — In-item levers · OBSERVED
- **Property:** `speaker_highlight` (lights the speaker's card; answers `said_name`, `said_he_she`) and `actor_marker` (the object and "Did the action" on the doer's card; answers `swapped_pronoun`), both help, shown. Offered only where the tier withdrew the aid (hard: both; medium: actor marker; easy and untiered: none). Leak rule `leverTextLeak`: no lever text or fact names a pronoun. No simplify.
- **Demanded by:** handoff 22 L4.
- **Probe:** `npm test -- youAndMeLevers YouAndMe.levers`.
