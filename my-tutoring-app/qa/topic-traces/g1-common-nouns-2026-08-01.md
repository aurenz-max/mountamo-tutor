# Topic Trace: "Identify common nouns in simple decodable sentences as a person, place, or thing" (Grade 1) — 2026-08-01

Published subskill: `LA004-01-a` (target primitive: `categorization-activity`).
Scope intended by the subskill: identify common nouns in simple decodable sentences and classify them as person, place, or thing.
Part of the 2026-08-01 EMERGING demand census.

## Components

| Component | In scope? | Generated evidence | Broken link | Fix target |
|---|---:|---|---|---|
| foundation-explorer | yes | person/place/thing definitions and sentence checks | — | — |
| di-sentence-reading (`decodable_sentence`) | yes | four short decodable sentences | — | — |
| sentence-analyzer (`identify_pos`) | partial | noun-identification content is correct, payload says `gradeLevel: 4` | GENERATOR / grade context | EMERGING grade-contract item |
| concept-card-grid | yes | three category cards | — | — |
| sorting-station (`sort_attribute`) | yes | four three-bin challenges, `gradeBand: 1` | — | — |
| word-sorter (`ternary_sort`) | partial | correct noun sort, payload says `gradeLevel: K` | GENERATOR / grade context | EMERGING grade-contract item |
| knowledge-check (`mixed`) | yes (scope) | six aligned text problems | — | EMERGING knowledge-check audit |

## Scope drops

None. Every component stayed on common nouns and the three requested categories.

## Reader-fit signal

Two of seven payloads disagree with the Grade-1 lesson band (`sentence-analyzer` -> 4; `word-sorter` -> K). The content happened to remain usable in this draw, but those stamps select the wrong component presentation/support contract and belong to the systemic numeric-grade fix, not two isolated prompt tweaks.
