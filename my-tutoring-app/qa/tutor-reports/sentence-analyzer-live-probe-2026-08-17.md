# sentence-analyzer — live generator probe (DI port 20)

**Date:** 2026-08-17 · **Model:** `gemini-flash-lite-latest` · **Topic:** "animals in the forest"
**Gate:** `/add-di-loop` step 7.3 — real generator, real key, judged items built from live
content, `validateJudgedScriptPack` + `checkPackGates` over every resulting pack.

Probe file was temporary and is deleted. This is the record.

## Result: 6/6 modes × bands PASS, after two defects the probe itself found

| Mode | Grade | Challenges | Items | Dropped | Truncated | Gates |
|---|---|---|---|---|---|---|
| `identify_pos` | 2 (band floor) | 5 | 6 | 0 | 5 | ✅ |
| `identify_pos` | 5 | 5 | 6 | 0 | 11 | ✅ |
| `identify_role` | 5 | 4 | 6 | 0 | 13 | ✅ |
| `label_all` | 2 (band floor) | 4 | 9 | 0 | 1 | ✅ |
| `label_all` | 5 | 4 | 9 | 0 | 7 | ✅ |
| `parse_structure` | 5 | 4 | 9 | 2 | 6 | ✅ |

`truncated` is the session cap holding a sitting to nine rounds, not a content failure —
it is reported separately from `dropped` for exactly this reason.

## ⭐ Defect 1 — the generator could not make a single successful call

**`maxItems` on TWO NESTED ARRAYS is a hard `400 INVALID_ARGUMENT`.** Every request failed
before generation started. `tsc` was clean and 59 unit tests were green over a generator
that could not reach the API.

**This contradicts the family's standing rule.** The flash-lite truncation template says to
bound EVERY schema array. Bounding both of this schema's arrays is what broke it.

Bisected twice, because the first diagnosis was wrong:

| Variant | Result |
|---|---|
| flat schema, untouched | ❌ 400 |
| flat, no `maxItems` | ✅ |
| flat, no word enums | ✅ |
| flat, no POS enums only / no ROLE enums only / no `subjectEndIndex` / 5 word slots | ❌ 400 |
| **nested** schema, both arrays bounded | ❌ 400 |
| nested, no `maxItems` on `challenges` | ✅ |
| nested, no `maxItems` on `words` | ✅ |
| nested, neither bounded | ✅ |

The first read — "a whole-schema complexity budget, and enum density blew it" — survived the
flat evidence and died on the nested rewrite, which still failed with only three enum
properties. The actual rule is the STACKING: a `maxItems` costs something that compounds
down the nesting, and either bound alone is affordable.

**Shipped:** the outer bound on `challenges` is kept (it governs output size); `words` is
bounded by the sentence and sliced to 8 in `validateChallenge`.

**Carry to the next generator:** bound the array that can run away, leave the inner one to
code — and note that a 400 is not a truncation. There is no partial output, no fallback
fires, and nothing but a live call can see it.

## ⭐ Defect 2 — the answer key was silently HALF EMPTY, and it gutted a whole eval mode

With the click era's flat `word0Text..word7Role` fields, every probe returned word 0 labelled
and **every later word carrying neither label**:

```
[identify_pos] "The brown bear runs."
    The:Determiner/Modifier  brown:-/-  bear:-/-  runs.:-/-
```

Twenty-four flat fields cannot all be `required` — a three-word sentence would have to invent
`word7Pos` — so twenty-two were optional, and an optional enum-constrained field is one the
model is free to skip.

**What it cost:** `label_all` is the mode whose entire identity is walking every word. It was
building **one ask about the first word of each sentence** and reporting success. `dropped`
was 8–13 per run and every drop was a word the model never labelled.

**Fixed** by replacing the flat fields with a nested `words` array whose items
`required: ['text', 'pos', 'role']` — the labels are now non-optional PER WORD. After the
rewrite `dropped: 0` in five of six probes, and `label_all` builds 9 items instead of 3.

The old header called flat fields the fix for malformed array JSON. On this model they are
the cause of an incomplete answer key, and the comment saying otherwise had outlived its
evidence.

## ⭐ The port's own content fix, confirmed on live content

`parse_structure` @ grade 5, all four sentences, `subjectEndIndex` correct every time:

```
"Wise owls hoot softly."   subjectEndIndex=1  Declarative
    Wise:Adjective/Modifier  owls:Noun/Subject  hoot:Verb/Predicate  softly.:Adverb/Modifier
  -> name-side "Wise"  -> Subject
  -> name-side "owls"  -> Subject
  -> name-side "hoot"  -> Predicate
```

**"Wise" answers Subject.** Under the click era's derivation
(`role.includes('subject') ? 'subject' : 'predicate'`) its role is `Modifier`, so it was keyed
**Predicate** — a child who correctly grouped it with the subject was marked wrong. Every
`parse_structure` sentence the probe drew had an adjective or determiner in that position, so
this was not a rare shape: it was **4 of 4**.

## Other behaviour confirmed live

- **Band floor read-aloud** fires at grade 2 and not at grade 5 (`readsAloud: true` / `false`),
  off the generator-stamped grade rather than a model-authored one.
- **The grade wall is scoped, not session-scoped:** grade 2 printed
  `Noun, Verb, Adjective, Determiner` while the sentences used only three of them; grade 5
  printed all nine.
- **Defect class 2 held:** `parse_structure` drew four Declarative sentences and built exactly
  **one** `name-type` ask.
- **The label spread worked:** no session let one label answer everything — `label_all` @ grade
  2 ran Adjective/Noun/Verb, Determiner/Noun/Verb, Adjective/Noun/Verb.
- **Sentinel + grammar-term gates:** no sentence drawn contained a grammar term or opened with
  a verdict sentinel; `checkPackGates` returned `[]` on all six live packs.

## Words drawn (for reproducibility)

Grade 2: *Big bears run · The fox sleeps · Small birds sing · A owl hoots · Brown deer jump ·
Big bears sleep · The owls hoot · Small foxes run · A brave wolf jumps*
Grade 5: *The brown bear sleeps quietly · Clever wolves hunt at night · Tiny birds sing sweet
songs · Green frogs leap very far · Smart owls watch from trees · Wise owls hooted during the
night · Red foxes ran across the trail · Brown bears sleep inside cozy caves · Brown owls
hooted very loudly · The tiny mouse ran away · Green frogs leaped into water · Hungry bears ate
sweet berries · Wise owls hoot softly · Brown bears sleep underground · Green frogs leap near
ponds · Hungry wolves hunt through trees*

## Not proven here

This probe exercises the GENERATOR and the BUILD. It says nothing about the judge's semantics
(that is `/tutor-test --di`) and nothing about acoustics, the mic, or VAD (that is the mic row).
