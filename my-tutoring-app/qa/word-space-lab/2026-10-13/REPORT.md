# Word-space lab: K/G1 literacy subskills vs a code-only word library

Run 2026-10-13T21:37:24.157Z · grades Kindergarten, 1 · 99 subskills · 3 seeds × 3 tiers × 5 picks · no LLM.

Library: 30844 words (CMU ∩ subtitle top-40k, deny-listed removed); 6505 rated (1960 known by K and kid-safe); 1820 usable at K with a letter-sound alignment; 693 with a picture (Unicode names + 301 repo table entries).

## Summary

| | count |
|---|---|
| subskills scanned | 99 |
| served by the library | 58 |
| not a word-level task (LLM band / needs a curated table) | 41 |
| served, all picks pass the independent re-check | 58 |
| served, easy < medium < hard by predicted β | 56 |

| G | subskill | task | hopper (words / pictured) | examples in hopper | E<M<H | variety E/M/H over 3 seeds | violations |
|---|---|---|---|---|---|---|---|
| 1 | Decode short vowel CVC words by mapping sounds to letters to form the complete word. Focus | decode | 141 items · 141 / 63 | 10/10 | yes | 13/12/14 | 0 |
| 1 | Decode words featuring the silent e pattern to produce long vowel sounds. Focus: Silent e  | decode | 76 items · 76 / 7 | 9/10 | yes | 8/12/12 | 0 |
| 1 | Compare and contrast words that form minimal pairs between short and long vowel sounds to  | long-short-pairs | 13 items · 26 / 6 | 6/8 | only 13 items: fewer than 15, tiers not separable | 0/0/0 | 0 |
| 1 | Blend onset consonant pairs to read the start of a word before completing the rime. Focus: | decode | 95 items · 95 / 11 | 7/10 | yes | 11/11/11 | 0 |
| 1 | Decode words containing common final consonant blends by focusing on the consonant cluster | decode | 39 items · 39 / 5 | 8/10 | yes | 7/8/11 | 0 |
| 1 | Identify and read Grade 1 high-frequency words that frequently appear in text but may not  | sight | 271 items · 271 / 22 | 10/10 | yes | 15/15/15 | 0 |
| 1 | Students sort various vocabulary words into their correct semantic categories. Focus: Cate | concept-sort | 650 items · 154 / 154 | 5/12 | yes | 14/14/14 | 0 |
| 1 | Students identify the odd word out that does not belong in a provided category list. Focus | concept-odd-one-out | 650 items · 154 / 154 | 7/10 | yes | 14/14/14 | 0 |
| 1 | Students demonstrate automaticity by reading high-frequency sight words under timed condit | sight | 271 items · 271 / 22 | 8/9 | yes | 15/15/15 | 0 |
| K | Recognize if two spoken words rhyme (e.g., "Do 'cat' and 'hat' rhyme?") | rhyme-recognize | 477 items · 165 / 165 | 2/4 | yes | 15/15/15 | 0 |
| K | Identify the rhyming word from a spoken set of three (e.g., "Which word rhymes with 'cat': | rhyme-identify | 355 items · 174 / 174 | 3/7 | yes | 15/11/13 | 0 |
| K | Produce a word that rhymes with a given spoken word (e.g., "Tell me a word that rhymes wit | rhyme-produce | 120 items · 120 / 120 | 1/7 | yes | 10/12/11 | 0 |
| K | Blend two or three spoken syllables to form a word (e.g., "What word is 'cow'...'boy'?") | syllable-blend | 15 items · 15 / 15 | 0/5 | NO | 5/5/5 | 0 |
| K | Segment a spoken two or three-syllable word into its parts (e.g., "How many parts in 'butt | syllable-segment | 181 items · 181 / 181 | 1/9 | yes | 12/15/13 | 0 |
| K | Blend onset and rime (/c/ + /at/ -> cat) | onset-rime-blend | 171 items · 171 / 171 | - | yes | 15/15/13 | 0 |
| K | Isolate onset and rime (cat -> /c/ + /at/) | onset-rime-split | 171 items · 171 / 171 | - | yes | 15/15/13 | 0 |
| K | Identify the beginning sound in a word (/c/ in cat) | sound-initial | 289 items · 179 / 179 | - | yes | 13/15/14 | 0 |
| K | Identify the ending sound in a word (/t/ in cat) | sound-final | 311 items · 180 / 180 | - | yes | 14/15/13 | 0 |
| K | Identify the medial sound in a word (/a/ in cat) | sound-medial | 148 items · 74 / 74 | - | yes | 12/14/12 | 0 |
| K | Blend three phonemes into a CVC word (/d/ /o/ /g/ -> dog). | phoneme-blend | 101 items · 101 / 101 | - | yes | 13/15/12 | 0 |
| K | Segment a CVC word into three phonemes (dog -> /d/ /o/ /g/). | phoneme-segment | 101 items · 101 / 101 | - | yes | 13/15/12 | 0 |
| K | Add a phoneme to a word or word part. | swap-add | 248 items · 333 / 82 | - | yes | 12/12/15 | 0 |
| K | Delete a phoneme from a word. | swap-delete | 248 items · 333 / 82 | - | yes | 12/14/12 | 0 |
| K | Substitute one phoneme for another. | swap-substitute | 1197 items · 397 / 116 | - | yes | 15/15/15 | 0 |
| K | Letter Group 1: s, a, t, i, p, n | letter-id | 15 items · 15 / 2 | - | yes | 5/5/5 | 0 |
| K | Letter Group 2: c, k, e, h, r, m, d | letter-id | 79 items · 79 / 20 | - | yes | 9/12/11 | 0 |
| K | Letter Group 3: g, o, u, l, f, b | letter-id | 206 items · 206 / 69 | - | yes | 14/13/14 | 0 |
| K | Letter Group 4 (Final): j, z, w, v, y, x, q | letter-id | 231 items · 231 / 79 | - | yes | 9/9/10 | 0 |
| K | Letter-Sound Group 1: s, a, t, i, p, n | letter-sound | 15 items · 15 / 2 | - | yes | 5/5/5 | 0 |
| K | Letter-Sound Group 2: c, k, e, h, r, m, d | letter-sound | 79 items · 79 / 20 | - | yes | 9/12/11 | 0 |
| K | Letter-Sound Group 3: g, o, u, l, f, b | letter-sound | 206 items · 206 / 69 | - | yes | 14/13/14 | 0 |
| K | Letter-Sound Group 4 (Final): j, z, w, v, y, x, q | letter-sound | 231 items · 231 / 79 | - | yes | 9/9/10 | 0 |
| K | Letter Formation Group 1: s, a, t, i, p, n | letter-form | 15 items · 15 / 2 | - | yes | 5/5/5 | 0 |
| K | Letter Formation Group 2: c, k, e, h, r, m, d | letter-form | 79 items · 79 / 20 | - | yes | 9/12/11 | 0 |
| K | Letter Formation Group 3: g, o, u, l, f, b | letter-form | 206 items · 206 / 69 | - | yes | 14/13/14 | 0 |
| K | Letter Formation Group 4 (Final): j, z, w, v, y, x, q | letter-form | 231 items · 231 / 79 | - | yes | 9/9/10 | 0 |
| K | Decode CVC words with Short 'a' (e.g., cat, map, van) | decode | 29 items · 29 / 15 | 8/8 | yes | 9/8/9 | 0 |
| K | Decode CVC words with Short 'e' (e.g., hen, wet, leg) | decode | 18 items · 18 / 11 | 8/8 | yes | 6/6/6 | 0 |
| K | Decode CVC words with Short 'i' (e.g., pig, sit, fin) | decode | 50 items · 50 / 23 | 8/11 | yes | 13/12/9 | 0 |
| K | Decode CVC words with Short 'o' | decode | 48 items · 48 / 27 | 8/8 | yes | 13/8/10 | 0 |
| K | Decode CVC words with Short 'u' | decode | 21 items · 21 / 12 | 8/8 | yes | 7/6/7 | 0 |
| K | Decode CVC words with Mixed Short Vowels (e.g., cat, hen, pig) | decode | 108 items · 108 / 58 | 11/15 | yes | 13/12/13 | 0 |
| K | Encode CVC words with Short 'a' | encode | 29 items · 29 / 15 | 6/6 | yes | 9/8/9 | 0 |
| K | Encode CVC words with Short 'e' | encode | 18 items · 18 / 11 | 6/6 | yes | 6/6/6 | 0 |
| K | Encode CVC words with Short 'i' | encode | 21 items · 21 / 8 | 6/10 | yes | 7/6/7 | 0 |
| K | Encode CVC words with Short 'o' | encode | 19 items · 19 / 12 | 5/5 | yes | 6/6/7 | 0 |
| K | Encode CVC words with Short 'u' | encode | 21 items · 21 / 12 | 5/5 | yes | 7/6/7 | 0 |
| K | Discriminate between Real & Nonsense CVC Words | real-vs-nonsense | 254 items · 108 / 58 | 2/12 | yes | 13/15/14 | 0 |
| K | Build Fluency with CVC Word Lists & Chains | decode | 108 items · 108 / 58 | 9/19 | yes | 13/12/13 | 0 |
| K | Match CVC Words to Pictures | decode-picture | 58 items · 58 / 58 | 1/3 | yes | 8/10/10 | 0 |
| K | Distinguish between long and short vowel sounds in single-syllable words | vowel-length | 136 items · 136 / 136 | - | yes | 11/14/12 | 0 |
| K | Blend and segment individual sounds (phonemes) in simple CVC words using manipulatives | phoneme-blend | 101 items · 101 / 101 | - | yes | 13/15/12 | 0 |
| K | Read common high-frequency sight words in isolation and simple text | sight | 271 items · 271 / 22 | - | yes | 15/15/15 | 0 |
| K | Identify and read common consonant digraphs (sh, ch, th, wh) and blends (st, pl, br) | decode | 40 items · 40 / 6 | - | yes | 7/9/10 | 0 |
| K | Match basic vocabulary words to corresponding pictures in common categories (e.g., animals | concept-sort | 598 items · 143 / 143 | - | yes | 14/15/13 | 0 |
| K | Sort vocabulary words into basic categories (e.g., animals, foods, colors) with 85% accura | concept-sort | 598 items · 143 / 143 | - | yes | 14/15/13 | 0 |
| K | Group words by function and use (e.g., "things we eat," "things we wear," "places we go") | concept-sort | 598 items · 143 / 143 | - | yes | 14/15/13 | 0 |
| K | Sort common objects into basic categories (e.g., food, animals, clothes) | concept-sort | 598 items · 143 / 143 | - | yes | 14/15/13 | 0 |

## Detail

### 1 · Decode short vowel CVC words by mapping sounds to letters to form the complete word. Focus

task `decode` · curriculum primitive `phonics-blender` · hopper 141 items over 141 words (63 pictured)

- curriculum examples: cat, map, tin, dot, bus, bed, pig, hot, sun, leg
- **Easy** (β̄ 0.12): run 🏃 · log 🪵 · fit · hop 🐰 · van 🚐
- **Medium** (β̄ 0.44): hen 🐔 · pot 🍲 · fin 🐟 · ram 🐏 · dog 🐶
- **Hard** (β̄ 0.76): hum · six · job · sob · tip

### 1 · Decode words featuring the silent e pattern to produce long vowel sounds. Focus: Silent e 

task `decode` · curriculum primitive `phonics-blender` · hopper 76 items over 76 words (7 pictured)

- curriculum examples: make, ride, hope, ~~cute~~ (shape CCCe), cake, kite, bone, tune, safe, gate
- **Easy** (β̄ 0.30): like · name · rule · home · hole 🕳️
- **Medium** (β̄ 0.54): life · woke · maze · cake 🎂 · bone 🦴
- **Hard** (β̄ 0.94): rude · robe · fade · tune · tame

### 1 · Compare and contrast words that form minimal pairs between short and long vowel sounds to 

task `long-short-pairs` · curriculum primitive `phonics-blender` · hopper 13 items over 26 words (6 pictured)

- curriculum examples: cap/cape, kit/kite, hop/hope, ~~mat/mate~~ (picture does not fit (🧘)), tub/tube, pin/pine, not/note, ~~rat/rate~~ (filtered by task rule)
- only 13 items: fewer than 15, tiers not separable

### 1 · Blend onset consonant pairs to read the start of a word before completing the rime. Focus:

task `decode` · curriculum primitive `phonics-blender` · hopper 95 items over 95 words (11 pictured)

- curriculum examples: ~~blue~~ (not decodable: ue/UW), clap, flag, glad, plant, ~~sled~~ (unrated (rank 15395)), ~~bread~~ (not decodable: ea/EH), crab, drum, frog
- **Easy** (β̄ 0.92): step · snack · black · drum 🥁 · snaps
- **Medium** (β̄ 1.14): spun · stomp · stem · snacks · plant
- **Hard** (β̄ 1.64): blend · stack · trucks · clocks · sticks

### 1 · Decode words containing common final consonant blends by focusing on the consonant cluster

task `decode` · curriculum primitive `phonics-blender` · hopper 39 items over 39 words (5 pictured)

- curriculum examples: sand, ~~bank~~ (known by G2), ~~ant~~ (shape VCC), lamp, belt, milk, soft, mask, hand, pond
- **Easy** (β̄ 0.60): hand ✋ · soft 🧸 · milk 🥛 · camp · went
- **Medium** (β̄ 0.96): melt · jump 🤾 · gift 🎁 · hunt · ramp
- **Hard** (β̄ 1.32): tilt · pond · pump · lump · limp

### 1 · Identify and read Grade 1 high-frequency words that frequently appear in text but may not 

task `sight` · curriculum primitive `fast-fact` · hopper 271 items over 271 words (22 pictured)

- curriculum examples: said, was, are, were, have, come, some, what, they, there
- **Easy** (β̄ 0.77): could · her · want · been · come
- **Medium** (β̄ 1.31): ago · does · used · better · idea
- **Hard** (β̄ 1.58): everybody · each · soon · believe · since

### 1 · Students sort various vocabulary words into their correct semantic categories. Focus: Cate

task `concept-sort` · curriculum primitive `categorization-activity` · hopper 650 items over 154 words (154 pictured)

- categories: vehicle(21), animal(89), tool(31), food(58), school(14), clothing(25), toy(11), sport(8), home(41), nature(24), body(15), place(13), weather(11), music(8)
- curriculum examples: dog/cat, bird, ~~apple/pear~~ (filtered by task rule), ~~banana~~ (filtered by task rule), ~~shirt/pants~~ (no picture), ~~socks~~ (filtered by task rule), ~~red/blue~~ (filtered by task rule), ~~green~~ (no picture), car/truck, bus, ~~table/chair~~ (unrated (rank 816)), bed
- **Easy** (β̄ -0.06): chicken 🐔, bird 🐦, pig 🐷, castle 🏰 (sort: animal vs place) → castle · glasses 👓, crown 👑, shoe 👟, bus 🚌 (sort: clothing vs vehicle) → bus · candy 🍬, egg 🥚, pie 🥧, cap 🧢 (sort: food vs clothing) → cap · car 🚗, ship 🚢, train 🚆, dog 🐶 (sort: vehicle vs animal) → dog · ball ⚽, gift 🎁, robot 🤖, hand ✋ (sort: toy vs body) → hand
- **Medium** (β̄ 0.31): bus 🚌, van 🚐, taxi 🚕, flute 🪈 (sort: vehicle vs music) → flute · hotel 🏨, station 🚉, church ⛪, boat ⛵ (sort: place vs vehicle) → boat · fly 🪰, cat 🐱, bear 🐻, violin 🎻 (sort: animal vs music) → violin · camera 📷, fan 🪭, paint 🎨, ice 🧊 (sort: tool vs food) → ice · glass 🥛, lock 🔒, cup 🥤, jog 🏃 (sort: home vs sport) → jog
- **Hard** (β̄ 1.03): city 🏙️, hospital 🏥, wedding 💒, hand ✋ (sort: place vs body) → hand · trophy 🏆, bubbles 🫧, joker 🃏, jog 🏃 (sort: toy vs sport) → jog · lake 🏞️, wood 🪵, flower 🌸, sunrise 🌅 (sort: nature vs weather) → sunrise · fire 🔥, rock 🪨, sun ☀️, radio 📻 (sort: nature vs music) → radio · basketball 🏀, tennis 🎾, bowling 🎳, violin 🎻 (sort: sport vs music) → violin

### 1 · Students identify the odd word out that does not belong in a provided category list. Focus

task `concept-odd-one-out` · curriculum primitive `categorization-activity` · hopper 650 items over 154 words (154 pictured)

- categories: vehicle(21), animal(89), tool(31), food(58), school(14), clothing(25), toy(11), sport(8), home(41), nature(24), body(15), place(13), weather(11), music(8)
- curriculum examples: ~~apple/pear~~ (filtered by task rule), car/grape, dog/cat, fish/table, ~~red/blue~~ (filtered by task rule), dog/yellow, ~~shirt/pants~~ (no picture), hat/apple, sun/moon, star/chair
- **Easy** (β̄ 0.14): chicken 🐔, bird 🐦, pig 🐷, castle 🏰 → castle · glasses 👓, crown 👑, shoe 👟, bus 🚌 → bus · candy 🍬, egg 🥚, pie 🥧, cap 🧢 → cap · car 🚗, ship 🚢, train 🚆, dog 🐶 → dog · ball ⚽, gift 🎁, robot 🤖, hand ✋ → hand
- **Medium** (β̄ 0.51): bus 🚌, van 🚐, taxi 🚕, flute 🪈 → flute · hotel 🏨, station 🚉, church ⛪, boat ⛵ → boat · fly 🪰, cat 🐱, bear 🐻, violin 🎻 → violin · camera 📷, fan 🪭, paint 🎨, ice 🧊 → ice · glass 🥛, lock 🔒, cup 🥤, jog 🏃 → jog
- **Hard** (β̄ 1.23): city 🏙️, hospital 🏥, wedding 💒, hand ✋ → hand · trophy 🏆, bubbles 🫧, joker 🃏, jog 🏃 → jog · lake 🏞️, wood 🪵, flower 🌸, sunrise 🌅 → sunrise · star ⭐, tree 🌳, moon 🌙, violin 🎻 → violin · basketball 🏀, tennis 🎾, bowling 🎳, camera 📷 → camera

### 1 · Students demonstrate automaticity by reading high-frequency sight words under timed condit

task `sight` · curriculum primitive `fast-fact` · hopper 271 items over 271 words (22 pictured)

- curriculum examples: said, look, was, they, from, have, ~~help~~ (picture does not fit (🤝)), where, there
- **Easy** (β̄ 0.77): could · her · want · been · come
- **Medium** (β̄ 1.31): ago · does · used · better · idea
- **Hard** (β̄ 1.58): everybody · each · soon · believe · since

### K · Recognize if two spoken words rhyme (e.g., "Do 'cat' and 'hat' rhyme?")

task `rhyme-recognize` · curriculum primitive `rhyme-studio` · hopper 477 items over 165 words (165 pictured)

- curriculum examples: ~~do~~ (no alignment (D UW)), cat, hat, ~~rhyme~~ (unrated (rank 9133))
- **Easy** (β̄ -0.52): flag 🚩 / bag 👜 → yes · egg 🥚 / cow 🐮 → no · go 🚶 / child 🧒 → no · eat 🍽️ / feet 🦶 → yes · clown 🤡 / crown 👑 → yes
- **Medium** (β̄ -0.08): plus ➕ / dot ⚫ → no · pear 🍐 / bear 🐻 → yes · cat 🐱 / tag 🏷️ → no · day ☀️ / lake 🏞️ → no · fin 🐟 / bin 🗑️ → yes
- **Hard** (β̄ 0.70): bee 🐝 / bear 🐻 → no · sweet 🍭 / tree 🌳 → no · pig 🐷 / ship 🚢 → no · chick 🐥 / church ⛪ → no · big 🐘 / beans 🫘 → no

### K · Identify the rhyming word from a spoken set of three (e.g., "Which word rhymes with 'cat':

task `rhyme-identify` · curriculum primitive `rhyme-studio` · hopper 355 items over 174 words (174 pictured)

- curriculum examples: ~~which~~ (known by G1), ~~word~~ (unrated (rank 436)), ~~rhymes~~ (unrated (rank 11295)), ~~with~~ (no picture), cat, dog, hat
- **Easy** (β̄ -0.50): flag 🚩 -> bag 👜 | down ⬇️ | fog 🌫️ → bag · eat 🍽️ -> feet 🦶 | cold 🥶 | duck 🦆 → feet · bug 🐛 -> hug 🤗 | fire 🔥 | goat 🐐 → hug · mail 📬 -> snail 🐌 | dog 🐶 | fin 🐟 → snail · bone 🦴 -> phone 📱 | fox 🦊 | ice 🧊 → phone
- **Medium** (β̄ -0.10): vet 🩺 -> jet ✈️ | cow 🐮 | eat 🍽️ → jet · cap 🧢 -> map 🗺️ | hat 🎩 | fly 🪰 → map · log 🪵 -> dog 🐶 | fork 🍴 | drip 💧 → dog · spoon 🥄 -> moon 🌙 | drum 🥁 | fog 🌫️ → moon · sock 🧦 -> clock 🕐 | dress 👗 | flag 🚩 → clock
- **Hard** (β̄ 0.70): feet 🦶 -> eat 🍽️ | fog 🌫️ | clean 🧹 → eat · snail 🐌 -> mail 📬 | plane ✈️ | foot 🦶 → mail · sock 🧦 -> clock 🕐 | hop 🐰 | flag 🚩 → clock · big 🐘 -> dig ⛏️ | bug 🐛 | wing 🪽 → dig · man 👨 -> can 🥫 | milk 🥛 | sad 😢 → can

### K · Produce a word that rhymes with a given spoken word (e.g., "Tell me a word that rhymes wit

task `rhyme-produce` · curriculum primitive `rhyme-studio` · hopper 120 items over 120 words (120 pictured)

- curriculum examples: ~~tell~~ (no picture), ~~me~~ (no picture), ~~word~~ (unrated (rank 436)), ~~that~~ (no picture), ~~rhymes~~ (unrated (rank 11295)), ~~with~~ (no picture), sun
- **Easy** (β̄ 0.36): king 🤴 -> say a rhyme → 8 accepted rhymes · bee 🐝 -> say a rhyme → 13 accepted rhymes · night 🌙 -> say a rhyme → 9 accepted rhymes · fox 🦊 -> say a rhyme → 7 accepted rhymes · true ✅ -> say a rhyme → 13 accepted rhymes
- **Medium** (β̄ 0.65): fin 🐟 -> say a rhyme → 9 accepted rhymes · sleep 😴 -> say a rhyme → 7 accepted rhymes · down ⬇️ -> say a rhyme → 5 accepted rhymes · kite 🪁 -> say a rhyme → 9 accepted rhymes · pop 🍿 -> say a rhyme → 7 accepted rhymes
- **Hard** (β̄ 1.13): shark 🦈 -> say a rhyme → 3 accepted rhymes · book 📖 -> say a rhyme → 3 accepted rhymes · train 🚆 -> say a rhyme → 3 accepted rhymes · run 🏃 -> say a rhyme → 4 accepted rhymes · hen 🐔 -> say a rhyme → 5 accepted rhymes

### K · Blend two or three spoken syllables to form a word (e.g., "What word is 'cow'...'boy'?")

task `syllable-blend` · curriculum primitive `syllable-clapper` · hopper 15 items over 15 words (15 pictured)

- curriculum examples: ~~what~~ (no picture), ~~word~~ (unrated (rank 436)), ~~is~~ (no picture), ~~cow~~ (filtered by task rule), ~~boy~~ (filtered by task rule)
- **Easy** (β̄ 0.16): foot ... ball 🏈 → football · back ... pack 🎒 → backpack · bath ... tub 🛁 → bathtub · cup ... cake 🧁 → cupcake · hand ... bag 👜 → handbag
- **Medium** (β̄ 0.20): pea ... nuts 🥜 → peanuts · mail ... box 📫 → mailbox · lip ... stick 💄 → lipstick · lap ... top 💻 → laptop · hand ... shake 🤝 → handshake
- **Hard** (β̄ 0.20): rest ... room 🚻 → restroom · tooth ... brush 🪥 → toothbrush · sun ... set 🌇 → sunset · rain ... bow 🌈 → rainbow · pop ... corn 🍿 → popcorn

### K · Segment a spoken two or three-syllable word into its parts (e.g., "How many parts in 'butt

task `syllable-segment` · curriculum primitive `syllable-clapper` · hopper 181 items over 181 words (181 pictured)

- curriculum examples: ~~how~~ (no picture), ~~many~~ (unrated (rank 257)), ~~parts~~ (known by G1), ~~in~~ (no picture), butterfly, ~~let~~ (no picture), ~~s~~ (rank 583), ~~clap~~ (no picture), ~~it~~ (no picture)
- **Easy** (β̄ 0.38): mirror 🪞 → 2 · rainbow 🌈 → 2 · handshake 🤝 → 2 · robot 🤖 → 2 · fairy 🧚 → 2
- **Medium** (β̄ 0.70): candle 🕯️ → 2 · donkey 🫏 → 2 · hamster 🐹 → 2 · airplane ✈️ → 2 · camping 🏕️ → 2
- **Hard** (β̄ 1.22): sparkle ❇️ → 2 · unicorn 🦄 → 3 · watermelon 🍉 → 4 · basketball 🏀 → 3 · motorcycle 🏍️ → 4

### K · Blend onset and rime (/c/ + /at/ -> cat)

task `onset-rime-blend` · curriculum primitive `phoneme-explorer` · hopper 171 items over 171 words (171 pictured)

- **Easy** (β̄ -0.30): /SH/ + /IH P/ 🚢 → ship · /S/ + /AE D/ 😢 → sad · /N/ + /EH T/ 🥅 → net · /L/ + /IH P/ 👄 → lip · /HH/ + /AH G/ 🤗 → hug
- **Medium** (β̄ 0.00): /B/ + /AH G/ 🐛 → bug · /K/ + /AA R/ 🚗 → car · /K/ + /AH P/ 🥤 → cup · /B/ + /EH N CH/ 🪑 → bench · /B/ + /OY/ 👦 → boy
- **Hard** (β̄ 0.36): /B R/ + /AH SH/ 🖌️ → brush · /T/ + /AE G/ 🏷️ → tag · /P/ + /AA P/ 🍿 → pop · /P L/ + /AH S/ ➕ → plus · /K R/ + /AW N/ 👑 → crown

### K · Isolate onset and rime (cat -> /c/ + /at/)

task `onset-rime-split` · curriculum primitive `phoneme-explorer` · hopper 171 items over 171 words (171 pictured)

- **Easy** (β̄ -0.30): ship 🚢 → SH + IH P · sad 😢 → S + AE D · net 🥅 → N + EH T · lip 👄 → L + IH P · hug 🤗 → HH + AH G
- **Medium** (β̄ 0.00): bug 🐛 → B + AH G · car 🚗 → K + AA R · cup 🥤 → K + AH P · bench 🪑 → B + EH N CH · boy 👦 → B + OY
- **Hard** (β̄ 0.36): brush 🖌️ → B R + AH SH · tag 🏷️ → T + AE G · pop 🍿 → P + AA P · plus ➕ → P L + AH S · crown 👑 → K R + AW N

### K · Identify the beginning sound in a word (/c/ in cat)

task `sound-initial` · curriculum primitive `phoneme-explorer` · hopper 289 items over 179 words (179 pictured)

- **Easy** (β̄ 0.18): /B/ ? bag 👜 | school 🏫 | sweet 🍭 | whale 🐋 → bag · /R/ ? red 🟥 | coat 🧥 | eat 🍽️ | girl 👧 → red · /S/ ? slow 🐢 | peach 🍑 | run 🏃 | wash 🧼 → slow · /B/ ? beans 🫘 | clean 🧹 | drip 💧 | fox 🦊 → beans · /B/ ? bee 🐝 | dog 🐶 | fly 🪰 | hop 🐰 → bee
- **Medium** (β̄ 0.54): /F/ ? fish 🐟 | vet 🩺 | red 🟥 | soap 🧼 → fish · /P/ ? plane ✈️ | mop 🧹 | run 🏃 | spoon 🥄 → plane · /G/ ? girl 👧 | box 📦 | down ⬇️ | foot 🦶 → girl · /N/ ? nest 🪺 | mug ☕ | crown 👑 | feet 🦶 → nest · /F/ ? fly 🪰 | van 🚐 | seat 💺 | tag 🏷️ → fly
- **Hard** (β̄ 0.94): /V/ ? vet 🩺 | fan 🪭 | lock 🔒 | owl 🦉 → vet · /K/ ? coin 🪙 | glass 🥛 | down ⬇️ | foot 🦶 → coin · /T/ ? tag 🏷️ | dog 🐶 | bench 🪑 | cake 🎂 → tag · /F/ ? fin 🐟 | van 🚐 | broom 🧹 | coat 🧥 → fin · /M/ ? mug ☕ | net 🥅 | dish 🍽️ | flag 🚩 → mug

### K · Identify the ending sound in a word (/t/ in cat)

task `sound-final` · curriculum primitive `phoneme-explorer` · hopper 311 items over 180 words (180 pictured)

- **Easy** (β̄ 0.76): /N/ ? bun 🍞 | church ⛪ | egg 🥚 | hand ✋ → bun · /CH/ ? bench 🪑 | shell 🐚 | tent ⛺ | wing 🪽 → bench · /K/ ? chick 🐥 | left ⬅️ | paint 🎨 | run 🏃 → chick · /L/ ? girl 👧 | win 🏆 | book 📖 | child 🧒 → girl · /R/ ? car 🚗 | owl 🦉 | ring 💍 | sock 🧦 → car
- **Medium** (β̄ 1.06): /B/ ? web 🕸️ | sock 🧦 | watch ⌚ | bench 🪑 → web · /N/ ? ten 🔟 | jam 🍓 | pup 🐶 | snake 🐍 → ten · /M/ ? drum 🥁 | run 🏃 | girl 👧 | king 🤴 → drum · /K/ ? rock 🪨 | ball ⚽ | brush 🖌️ | cup 🥤 → rock · /D/ ? red 🟥 | fun 🎉 | kiss 💏 | owl 🦉 → red
- **Hard** (β̄ 1.54): /N/ ? spoon 🥄 | jam 🍓 | feet 🦶 | hog 🐗 → spoon · /P/ ? hop 🐰 | tub 🛁 | night 🌙 | rain 🌧️ → hop · /K/ ? chick 🐥 | egg 🥚 | paint 🎨 | run 🏃 → chick · /M/ ? lime 🍋‍🟩 | van 🚐 | snail 🐌 | watch ⌚ → lime · /Z/ ? jeans 👖 | ice 🧊 | go 🚶 | lake 🏞️ → jeans

### K · Identify the medial sound in a word (/a/ in cat)

task `sound-medial` · curriculum primitive `phoneme-explorer` · hopper 148 items over 74 words (74 pictured)

- **Easy** (β̄ 1.20): /AE/ ? rat 🐀 | pig 🐷 | cup 🥤 | pup 🐶 → rat · /IH/ ? kick 🦵 | tag 🏷️ | duck 🦆 | pan 🍳 → kick · /AE/ ? cat 🐱 | log 🪵 | bun 🍞 | mug ☕ → cat · /AO/ ? ball ⚽ | lip 👄 | vet 🩺 | fan 🪭 → ball · /AE/ ? map 🗺️ | dig ⛏️ | ring 💍 | dish 🍽️ → map
- **Medium** (β̄ 1.56): /AH/ ? mug ☕ | bat 🦇 | jet ✈️ | ship 🚢 → mug · /IH/ ? chick 🐥 | bed 🛏️ | tub 🛁 | fan 🪭 → chick · /AE/ ? cap 🧢 | watch ⌚ | fin 🐟 | sun ☀️ → cap · /EH/ ? ten 🔟 | cup 🥤 | pup 🐶 | fun 🎉 → ten · /AA/ ? sock 🧦 | wing 🪽 | hen 🐔 | sad 😢 → sock
- **Hard** (β̄ 1.90): /EH/ ? wet 💧 | bat 🦇 | hog 🐗 | wash 🧼 → wet · /AE/ ? map 🗺️ | vet 🩺 | ring 💍 | dish 🍽️ → map · /AO/ ? log 🪵 | nut 🥜 | net 🥅 | win 🏆 → log · /AA/ ? pot 🍲 | sun ☀️ | fin 🐟 | rat 🐀 → pot · /AA/ ? lock 🔒 | hug 🤗 | man 👨 | web 🕸️ → lock

### K · Blend three phonemes into a CVC word (/d/ /o/ /g/ -> dog).

task `phoneme-blend` · curriculum primitive `phoneme-explorer` · hopper 101 items over 101 words (101 pictured)

- **Easy** (β̄ -0.14): /B/ /OW/ /T/ ⛵ → boat · /S/ /OW/ /P/ 🧼 → soap · /L/ /AW/ /D/ 📢 → loud · /B/ /UH/ /K/ 📖 → book · /R/ /AH/ /N/ 🏃 → run
- **Medium** (β̄ 0.21): /SH/ /IH/ /P/ 🚢 → ship · /B/ /IH/ /N/ 🗑️ → bin · /M/ /AH/ /G/ ☕ → mug · /B/ /AH/ /N/ 🍞 → bun · /HH/ /AH/ /G/ 🤗 → hug
- **Hard** (β̄ 0.31): /P/ /AA/ /P/ 🍿 → pop · /D/ /AH/ /K/ 🦆 → duck · /N/ /EH/ /T/ 🥅 → net · /T/ /AE/ /G/ 🏷️ → tag · /P/ /AA/ /T/ 🍲 → pot

### K · Segment a CVC word into three phonemes (dog -> /d/ /o/ /g/).

task `phoneme-segment` · curriculum primitive `phoneme-explorer` · hopper 101 items over 101 words (101 pictured)

- **Easy** (β̄ -0.14): boat ⛵ → 3: B OW T · soap 🧼 → 3: S OW P · loud 📢 → 3: L AW D · book 📖 → 3: B UH K · run 🏃 → 3: R AH N
- **Medium** (β̄ 0.21): ship 🚢 → 3: SH IH P · bin 🗑️ → 3: B IH N · mug ☕ → 3: M AH G · bun 🍞 → 3: B AH N · hug 🤗 → 3: HH AH G
- **Hard** (β̄ 0.31): pop 🍿 → 3: P AA P · duck 🦆 → 3: D AH K · net 🥅 → 3: N EH T · tag 🏷️ → 3: T AE G · pot 🍲 → 3: P AA T

### K · Add a phoneme to a word or word part.

task `swap-add` · curriculum primitive `sound-swap` · hopper 248 items over 333 words (82 pictured)

- **Easy** (β̄ 0.00): at + /CH/ (initial) → chat · eat + /M/ (initial) → meat · an + /P/ (initial) → pan · all + /K/ (initial) → call · add + /HH/ (initial) → had
- **Medium** (β̄ 0.32): car + /S/ (initial) → scar · play + /N/ (final) → plane · adds + /D/ (initial) → dads · up + /K/ (initial) → cup · me + /T/ (final) → meet
- **Hard** (β̄ 0.76): wins + /T/ (initial) → twins · car + /T/ (final) → cart · my + /S/ (final) → mice · pea + /P/ (final) → peep · hole + /D/ (final) → hold

### K · Delete a phoneme from a word.

task `swap-delete` · curriculum primitive `sound-swap` · hopper 248 items over 333 words (82 pictured)

- **Easy** (β̄ 0.30): chat - /CH/ (initial) → at · meat - /M/ (initial) → eat · pan - /P/ (initial) → an · call - /K/ (initial) → all · had - /HH/ (initial) → add
- **Medium** (β̄ 0.58): plane - /N/ (final) → play · dads - /D/ (initial) → adds · cup - /K/ (initial) → up · meet - /T/ (final) · same - /M/ (final) → say
- **Hard** (β̄ 1.10): twin - /T/ (initial) → win · whine - /N/ (final) → why · think - /K/ (final) → thing · ant - /T/ (final) · grape - /P/ (final) → gray

### K · Substitute one phoneme for another.

task `swap-substitute` · curriculum primitive `sound-swap` · hopper 1197 items over 397 words (116 pictured)

- **Easy** (β̄ 0.00): mall: change /M/ to /T/ → tall · dot: change /D/ to /N/ → not · fed: change /F/ to /HH/ → head · bite: change /B/ to /R/ → right · fake: change /F/ to /M/ → make
- **Medium** (β̄ 0.28): meal: change /L/ to /N/ → mean · poke: change /P/ to /W/ → woke · bug: change /B/ to /T/ → tug · back: change /K/ to /T/ → bat · king: change /NG/ to /S/ → kiss
- **Hard** (β̄ 0.64): win: change /N/ to /NG/ → wing · bees: change /IY/ to /AW/ → bows · mad: change /AE/ to /EY/ → made · beach: change /CH/ to /N/ → bean · wear: change /R/ to /L/ → well

### K · Letter Group 1: s, a, t, i, p, n

task `letter-id` · curriculum primitive `letter-spotter` · hopper 15 items over 15 words (2 pictured)

- letters known: s a t i p n · focus: s a t i p n
- letters-only filter admits 29 familiar words; GPC filter rejects 9 of them, e.g. is (s/Z), pain (ai/EY), pass (ss/S), paint (ai/EY), pasta (a/AA,a/AH), pains (ai/EY,s/Z), paints (ai/EY), pans (s/Z), spins (s/Z)
- **Easy** (β̄ -0.02): an · nap · in · sat · at
- **Medium** (β̄ 0.24): tap 🚰 · sit 🪑 · it · pat · pan 🍳
- **Hard** (β̄ 0.50): tan · spin · sits · snap · sip

### K · Letter Group 2: c, k, e, h, r, m, d

task `letter-id` · curriculum primitive `letter-spotter` · hopper 79 items over 79 words (20 pictured)

- letters known: s a t i p n c k e h r m d · focus: c k e h r m d
- letters-only filter admits 387 familiar words; GPC filter rejects 287 of them, e.g. the (th/DH,e/AH), and (a/AH), that (th/DH), is (s/Z), me (e/IY), this (th/DH), he (e/IY), here (e_e/IY), she (sh/SH,e/IY), think (th/TH,n/NG), see (ee/IY), his (s/Z), time (i_e/AY), them (th/DH)
- **Easy** (β̄ 0.14): am · map 🗺️ · mask · cat 🐱 · in
- **Medium** (β̄ 0.52): hen 🐔 · skin · maps · did · pan 🍳
- **Hard** (β̄ 0.76): snack · caps · send · pick ⛏️ · snap

### K · Letter Group 3: g, o, u, l, f, b

task `letter-id` · curriculum primitive `letter-spotter` · hopper 206 items over 206 words (69 pictured)

- letters known: s a t i p n c k e h r m d g o u l f b · focus: g o u l f b
- letters-only filter admits 1400 familiar words; GPC filter rejects 1137 of them, e.g. the (th/DH,e/AH), to (o/AH), and (a/AH), that (th/DH), is (s/Z), me (e/IY), this (th/DH), he (e/IY), for (or/AO R), do (irregular), no (o/OW), be (e/IY), all (a/AO,ll/L), so (o/OW)
- **Easy** (β̄ 0.30): mud · dog 🐶 · cop · lamp · it
- **Medium** (β̄ 0.58): nuts · fist · back · lots · sits
- **Hard** (β̄ 1.02): drum 🥁 · bats · melt · grin · trick

### K · Letter Group 4 (Final): j, z, w, v, y, x, q

task `letter-id` · curriculum primitive `letter-spotter` · hopper 231 items over 231 words (79 pictured)

- letters known: s a t i p n c k e h r m d g o u l f b j z w v y x qu · focus: j z w v y x qu
- letters-only filter admits 1902 familiar words; GPC filter rejects 1613 of them, e.g. the (th/DH,e/AH), to (o/AH), and (a/AH), that (th/DH), is (s/Z), what (wh/W,a/AH), we (e/IY), me (e/IY), this (th/DH), he (e/IY), for (or/AO R), my (y/AY), have (irregular), do (irregular)
- **Easy** (β̄ 0.26): jam 🍓 · web 🕸️ · van 🚐 · win 🏆 · fed
- **Medium** (β̄ 0.62): jet ✈️ · swam · jog 🏃 · six · fits
- **Hard** (β̄ 1.14): twin · jets · quack · quick 🐇 · belt

### K · Letter-Sound Group 1: s, a, t, i, p, n

task `letter-sound` · curriculum primitive `letter-sound-link` · hopper 15 items over 15 words (2 pictured)

- letters known: s a t i p n · focus: s a t i p n
- keyword pictures per focus letter: **s** 29 (sit 🪑, sun ☀️, sad 😢, seat 💺) · **a** 3 (ant 🐜, angry 😠, apple 🍎) · **t** 20 (ten 🔟, tent ⛺, tooth 🦷, tag 🏷️) · **i** 0 () · **p** 23 (pop 🍿, pig 🐷, paint 🎨, pot 🍲) · **n** 7 (night 🌙, nose 👃, net 🥅, nest 🪺)
- letters-only filter admits 29 familiar words; GPC filter rejects 9 of them, e.g. is (s/Z), pain (ai/EY), pass (ss/S), paint (ai/EY), pasta (a/AA,a/AH), pains (ai/EY,s/Z), paints (ai/EY), pans (s/Z), spins (s/Z)
- **Easy** (β̄ -0.02): an · nap · in · sat · at
- **Medium** (β̄ 0.24): tap 🚰 · sit 🪑 · it · pat · pan 🍳
- **Hard** (β̄ 0.50): tan · spin · sits · snap · sip

### K · Letter-Sound Group 2: c, k, e, h, r, m, d

task `letter-sound` · curriculum primitive `letter-sound-link` · hopper 79 items over 79 words (20 pictured)

- letters known: s a t i p n c k e h r m d · focus: c k e h r m d
- keyword pictures per focus letter: **c** 27 (can 🥫, car 🚗, cold 🥶, cat 🐱) · **k** 5 (king 🤴, kiss 💏, kick 🦵, kite 🪁) · **e** 3 (egg 🥚, elf 🧝, elephant 🐘) · **h** 18 (hand ✋, hole 🕳️, hat 🎩, hug 🤗) · **r** 13 (run 🏃, red 🟥, rock 🪨, ring 💍) · **m** 14 (man 👨, mouth 👄, moon 🌙, milk 🥛) · **d** 14 (down ⬇️, day ☀️, dog 🐶, dig ⛏️)
- letters-only filter admits 387 familiar words; GPC filter rejects 287 of them, e.g. the (th/DH,e/AH), and (a/AH), that (th/DH), is (s/Z), me (e/IY), this (th/DH), he (e/IY), here (e_e/IY), she (sh/SH,e/IY), think (th/TH,n/NG), see (ee/IY), his (s/Z), time (i_e/AY), them (th/DH)
- **Easy** (β̄ 0.14): am · map 🗺️ · mask · cat 🐱 · in
- **Medium** (β̄ 0.52): hen 🐔 · skin · maps · did · pan 🍳
- **Hard** (β̄ 0.76): snack · caps · send · pick ⛏️ · snap

### K · Letter-Sound Group 3: g, o, u, l, f, b

task `letter-sound` · curriculum primitive `letter-sound-link` · hopper 206 items over 206 words (69 pictured)

- letters known: s a t i p n c k e h r m d g o u l f b · focus: g o u l f b
- keyword pictures per focus letter: **g** 7 (go 🚶, girl 👧, gift 🎁, goat 🐐) · **o** 1 (octopus 🐙) · **u** 2 (up ⬆️, umbrella ☂️) · **l** 17 (left ⬅️, lock 🔒, leg 🦵, loud 📢) · **f** 20 (fun 🎉, fire 🔥, feet 🦶, fish 🐟) · **b** 46 (big 🐘, boy 👦, bed 🛏️, book 📖)
- letters-only filter admits 1400 familiar words; GPC filter rejects 1137 of them, e.g. the (th/DH,e/AH), to (o/AH), and (a/AH), that (th/DH), is (s/Z), me (e/IY), this (th/DH), he (e/IY), for (or/AO R), do (irregular), no (o/OW), be (e/IY), all (a/AO,ll/L), so (o/OW)
- **Easy** (β̄ 0.30): mud · dog 🐶 · cop · lamp · it
- **Medium** (β̄ 0.58): nuts · fist · back · lots · sits
- **Hard** (β̄ 1.02): drum 🥁 · bats · melt · grin · trick

### K · Letter-Sound Group 4 (Final): j, z, w, v, y, x, q

task `letter-sound` · curriculum primitive `letter-sound-link` · hopper 231 items over 231 words (79 pictured)

- letters known: s a t i p n c k e h r m d g o u l f b j z w v y x qu · focus: j z w v y x qu
- keyword pictures per focus letter: **j** 6 (jet ✈️, jam 🍓, jeans 👖, jar 🫙) · **z** 1 (zebra 🦓) · **w** 10 (watch ⌚, win 🏆, wind 🌬️, wash 🧼) · **v** 2 (van 🚐, vet 🩺) · **y** 0 () · **x** 0 () · **qu** 2 (queen 👑, quiet 🤫)
- letters-only filter admits 1902 familiar words; GPC filter rejects 1613 of them, e.g. the (th/DH,e/AH), to (o/AH), and (a/AH), that (th/DH), is (s/Z), what (wh/W,a/AH), we (e/IY), me (e/IY), this (th/DH), he (e/IY), for (or/AO R), my (y/AY), have (irregular), do (irregular)
- **Easy** (β̄ 0.26): jam 🍓 · web 🕸️ · van 🚐 · win 🏆 · fed
- **Medium** (β̄ 0.62): jet ✈️ · swam · jog 🏃 · six · fits
- **Hard** (β̄ 1.14): twin · jets · quack · quick 🐇 · belt

### K · Letter Formation Group 1: s, a, t, i, p, n

task `letter-form` · curriculum primitive `undefined` · hopper 15 items over 15 words (2 pictured)

- letters known: s a t i p n · focus: s a t i p n
- letters-only filter admits 29 familiar words; GPC filter rejects 9 of them, e.g. is (s/Z), pain (ai/EY), pass (ss/S), paint (ai/EY), pasta (a/AA,a/AH), pains (ai/EY,s/Z), paints (ai/EY), pans (s/Z), spins (s/Z)
- **Easy** (β̄ -0.02): an · nap · in · sat · at
- **Medium** (β̄ 0.24): tap 🚰 · sit 🪑 · it · pat · pan 🍳
- **Hard** (β̄ 0.50): tan · spin · sits · snap · sip

### K · Letter Formation Group 2: c, k, e, h, r, m, d

task `letter-form` · curriculum primitive `undefined` · hopper 79 items over 79 words (20 pictured)

- letters known: s a t i p n c k e h r m d · focus: c k e h r m d
- letters-only filter admits 387 familiar words; GPC filter rejects 287 of them, e.g. the (th/DH,e/AH), and (a/AH), that (th/DH), is (s/Z), me (e/IY), this (th/DH), he (e/IY), here (e_e/IY), she (sh/SH,e/IY), think (th/TH,n/NG), see (ee/IY), his (s/Z), time (i_e/AY), them (th/DH)
- **Easy** (β̄ 0.14): am · map 🗺️ · mask · cat 🐱 · in
- **Medium** (β̄ 0.52): hen 🐔 · skin · maps · did · pan 🍳
- **Hard** (β̄ 0.76): snack · caps · send · pick ⛏️ · snap

### K · Letter Formation Group 3: g, o, u, l, f, b

task `letter-form` · curriculum primitive `undefined` · hopper 206 items over 206 words (69 pictured)

- letters known: s a t i p n c k e h r m d g o u l f b · focus: g o u l f b
- letters-only filter admits 1400 familiar words; GPC filter rejects 1137 of them, e.g. the (th/DH,e/AH), to (o/AH), and (a/AH), that (th/DH), is (s/Z), me (e/IY), this (th/DH), he (e/IY), for (or/AO R), do (irregular), no (o/OW), be (e/IY), all (a/AO,ll/L), so (o/OW)
- **Easy** (β̄ 0.30): mud · dog 🐶 · cop · lamp · it
- **Medium** (β̄ 0.58): nuts · fist · back · lots · sits
- **Hard** (β̄ 1.02): drum 🥁 · bats · melt · grin · trick

### K · Letter Formation Group 4 (Final): j, z, w, v, y, x, q

task `letter-form` · curriculum primitive `undefined` · hopper 231 items over 231 words (79 pictured)

- letters known: s a t i p n c k e h r m d g o u l f b j z w v y x qu · focus: j z w v y x qu
- letters-only filter admits 1902 familiar words; GPC filter rejects 1613 of them, e.g. the (th/DH,e/AH), to (o/AH), and (a/AH), that (th/DH), is (s/Z), what (wh/W,a/AH), we (e/IY), me (e/IY), this (th/DH), he (e/IY), for (or/AO R), my (y/AY), have (irregular), do (irregular)
- **Easy** (β̄ 0.26): jam 🍓 · web 🕸️ · van 🚐 · win 🏆 · fed
- **Medium** (β̄ 0.62): jet ✈️ · swam · jog 🏃 · six · fits
- **Hard** (β̄ 1.14): twin · jets · quack · quick 🐇 · belt

### K · Decode CVC words with Short 'a' (e.g., cat, map, van)

task `decode` · curriculum primitive `phonics-blender` · hopper 29 items over 29 words (15 pictured)

- curriculum examples: cat, map, van, sad, tap, bag, ham, pan
- **Easy** (β̄ 0.00): lap · fan 🪭 · fat · had · ham
- **Medium** (β̄ 0.12): bag 👜 · sad 😢 · rat 🐀 · bad · rap
- **Hard** (β̄ 0.34): tan · tag 🏷️ · pat · cap 🧢 · pan 🍳

### K · Decode CVC words with Short 'e' (e.g., hen, wet, leg)

task `decode` · curriculum primitive `phonics-blender` · hopper 18 items over 18 words (11 pictured)

- curriculum examples: hen, wet, leg, bed, pen, men, jet, red
- **Easy** (β̄ 0.40): red 🟥 · fed · leg 🦵 · let · men
- **Medium** (β̄ 0.44): hen 🐔 · yes · wet 💧 · web 🕸️ · set
- **Hard** (β̄ 0.70): jet ✈️ · pet · ten 🔟 · pen 🖊️ · get 🎁

### K · Decode CVC words with Short 'i' (e.g., pig, sit, fin)

task `decode` · curriculum primitive `phonics-blender` · hopper 50 items over 50 words (23 pictured)

- curriculum examples: pig, sit, fin, big, win, lip, ~~tin~~ (known by G1), dig, pat, ~~pet~~ (no picture), ~~pit~~ (known by G1)
- **Easy** (β̄ 0.00): van 🚐 · rap · lap · fan 🪭 · nap
- **Medium** (β̄ 0.24): win 🏆 · bad · bag 👜 · hit 🏏 · hip
- **Hard** (β̄ 0.48): mix · dig ⛏️ · tag 🏷️ · tan · pig 🐷

### K · Decode CVC words with Short 'o'

task `decode` · curriculum primitive `phonics-blender` · hopper 48 items over 48 words (27 pictured)

- curriculum examples: dog, hot, mop, log, top, pot, hop, fox
- **Easy** (β̄ 0.00): van 🚐 · rap · lap · fan 🪭 · nap
- **Medium** (β̄ 0.18): not · log 🪵 · bag 👜 · cat 🐱 · lot
- **Hard** (β̄ 0.42): dog 🐶 · dot ⚫ · mop 🧹 · tan · tap 🚰

### K · Decode CVC words with Short 'u'

task `decode` · curriculum primitive `phonics-blender` · hopper 21 items over 21 words (12 pictured)

- curriculum examples: sun, bug, cup, mud, run, tub, gum, hug
- **Easy** (β̄ 0.20): run 🏃 · fun 🎉 · hug 🤗 · mud · nut 🥜
- **Medium** (β̄ 0.46): rug 🧶 · cup 🥤 · but · mug ☕ · bus 🚌
- **Hard** (β̄ 0.66): tub 🛁 · tug · cub · pup 🐶 · bun 🍞

### K · Decode CVC words with Mixed Short Vowels (e.g., cat, hen, pig)

task `decode` · curriculum primitive `phonics-blender` · hopper 108 items over 108 words (58 pictured)

- curriculum examples: cat, hen, pig, hat, pet, sip, top, mud, ~~which~~ (known by G1), ~~word~~ (unrated (rank 436)), ~~is~~ (not decodable: s/Z), bag, ~~beg~~ (known by G1), big, bug
- **Easy** (β̄ 0.12): fit · hop 🐰 · log 🪵 · van 🚐 · run 🏃
- **Medium** (β̄ 0.40): rug 🧶 · sip · let · dog 🐶 · cop
- **Hard** (β̄ 0.54): kid · cut · vet 🩺 · fox 🦊 · jog 🏃

### K · Encode CVC words with Short 'a'

task `encode` · curriculum primitive `cvc-speller` · hopper 29 items over 29 words (15 pictured)

- curriculum examples: cat, map, van, sad, tap, bag
- **Easy** (β̄ 0.00): lap · fan 🪭 · fat · had · ham
- **Medium** (β̄ 0.12): bag 👜 · sad 😢 · rat 🐀 · bad · rap
- **Hard** (β̄ 0.34): tan · tag 🏷️ · pat · cap 🧢 · pan 🍳

### K · Encode CVC words with Short 'e'

task `encode` · curriculum primitive `cvc-speller` · hopper 18 items over 18 words (11 pictured)

- curriculum examples: hen, wet, leg, bed, men, red
- **Easy** (β̄ 0.40): red 🟥 · fed · leg 🦵 · let · men
- **Medium** (β̄ 0.44): hen 🐔 · yes · wet 💧 · web 🕸️ · set
- **Hard** (β̄ 0.70): jet ✈️ · pet · ten 🔟 · pen 🖊️ · get 🎁

### K · Encode CVC words with Short 'i'

task `encode` · curriculum primitive `cvc-speller` · hopper 21 items over 21 words (8 pictured)

- curriculum examples: sit, pig, fin, big, lip, win, ~~spelling~~ (not decodable: ll/L,ng/NG), ~~set~~ (no picture), ~~instead~~ (known by G2), ~~of~~ (unrated (rank 11))
- **Easy** (β̄ 0.20): lip 👄 · fit · hid · him · hip
- **Medium** (β̄ 0.44): zip 🤐 · big 🐘 · bin 🗑️ · sip · lid 🫙
- **Hard** (β̄ 0.54): kid · six · mix · pig 🐷 · dig ⛏️

### K · Encode CVC words with Short 'o'

task `encode` · curriculum primitive `cvc-speller` · hopper 19 items over 19 words (12 pictured)

- curriculum examples: dog, hot, mop, log, top
- **Easy** (β̄ 0.10): log 🪵 · hop 🐰 · hot 🥵 · lot · not
- **Medium** (β̄ 0.36): got · nod · dog 🐶 · mop 🧹 · cop
- **Hard** (β̄ 0.58): fox 🦊 · top 🔝 · jog 🏃 · box 📦 · dot ⚫

### K · Encode CVC words with Short 'u'

task `encode` · curriculum primitive `cvc-speller` · hopper 21 items over 21 words (12 pictured)

- curriculum examples: sun, bug, cup, mud, run
- **Easy** (β̄ 0.20): run 🏃 · fun 🎉 · hug 🤗 · mud · nut 🥜
- **Medium** (β̄ 0.46): rug 🧶 · cup 🥤 · but · mug ☕ · bus 🚌
- **Hard** (β̄ 0.66): tub 🛁 · tug · cub · pup 🐶 · bun 🍞

### K · Discriminate between Real & Nonsense CVC Words

task `real-vs-nonsense` · curriculum primitive `word-workout` · hopper 254 items over 108 words (58 pictured)

- curriculum examples: ~~which~~ (known by G1), ~~is~~ (not decodable: s/Z), ~~real~~ (known by G1), ~~word~~ (unrated (rank 436)), map, ~~mep~~ (not in library), ~~zot~~ (not in library), ~~keg~~ (not kid-safe), ~~sib~~ (rank >50k), ~~qbc~~ (not in library), cat, ~~cot~~ (known by G1)
- **Easy** (β̄ -0.32): tag vs sog · dig vs yuz · nut vs puz · mop vs tus · log vs tez
- **Medium** (β̄ 0.12): log vs lof · vet vs tus · box vs tus · rat vs yat · tub vs pof
- **Hard** (β̄ 0.84): pop vs zop · lot vs lut · fix vs fex · tan vs taz · net vs nen

### K · Build Fluency with CVC Word Lists & Chains

task `decode` · curriculum primitive `word-workout` · hopper 108 items over 108 words (58 pictured)

- curriculum examples: ~~word~~ (unrated (rank 436)), ~~list~~ (known by G1), cat, sun, pig, hot, bed, man, leg, cup, ~~how~~ (not decodable: ow/AW), ~~many~~ (unrated (rank 257)), ~~words~~ (unrated (rank 628)), can, ~~you~~ (unrated (rank 1)), ~~read~~ (not decodable: ea/EH), ~~in~~ (shape VC), ~~one~~ (unrated (rank 57)), ~~minute~~ (not decodable: i/AY,u_e/UW)
- **Easy** (β̄ 0.12): fit · hop 🐰 · log 🪵 · van 🚐 · run 🏃
- **Medium** (β̄ 0.40): rug 🧶 · sip · let · dog 🐶 · cop
- **Hard** (β̄ 0.54): kid · cut · vet 🩺 · fox 🦊 · jog 🏃

### K · Match CVC Words to Pictures

task `decode-picture` · curriculum primitive `word-workout` · hopper 58 items over 58 words (58 pictured)

- curriculum examples: ~~target~~ (known by G1), ~~word~~ (unrated (rank 436)), sun
- **Easy** (β̄ 0.14): sun ☀️ · log 🪵 · hop 🐰 · sad 😢 · bat 🦇
- **Medium** (β̄ 0.36): pan 🍳 · pop 🍿 · fog 🌫️ · dog 🐶 · web 🕸️
- **Hard** (β̄ 0.66): jet ✈️ · vet 🩺 · box 📦 · fox 🦊 · pup 🐶

### K · Distinguish between long and short vowel sounds in single-syllable words

task `vowel-length` · curriculum primitive `phoneme-explorer` · hopper 136 items over 136 words (136 pictured)

- **Easy** (β̄ 0.12): feet 🦶 → long (IY) · watch ⌚ → short (AA) · boat ⛵ → long (OW) · fly 🪰 → long (AY) · cup 🥤 → short (AH)
- **Medium** (β̄ 0.20): moon 🌙 → long (UW) · lake 🏞️ → long (EY) · ice 🧊 → long (AY) · wheel 🛞 → long (IY) · go 🚶 → long (OW)
- **Hard** (β̄ 0.40): win 🏆 → short (IH) · huge 🐋 → long (UW) · socks 🧦 → short (AA) · cold 🥶 → long (OW) · web 🕸️ → short (EH)

### K · Blend and segment individual sounds (phonemes) in simple CVC words using manipulatives

task `phoneme-blend` · curriculum primitive `phoneme-explorer` · hopper 101 items over 101 words (101 pictured)

- **Easy** (β̄ -0.14): /B/ /OW/ /T/ ⛵ → boat · /S/ /OW/ /P/ 🧼 → soap · /L/ /AW/ /D/ 📢 → loud · /B/ /UH/ /K/ 📖 → book · /R/ /AH/ /N/ 🏃 → run
- **Medium** (β̄ 0.21): /SH/ /IH/ /P/ 🚢 → ship · /B/ /IH/ /N/ 🗑️ → bin · /M/ /AH/ /G/ ☕ → mug · /B/ /AH/ /N/ 🍞 → bun · /HH/ /AH/ /G/ 🤗 → hug
- **Hard** (β̄ 0.31): /P/ /AA/ /P/ 🍿 → pop · /D/ /AH/ /K/ 🦆 → duck · /N/ /EH/ /T/ 🥅 → net · /T/ /AE/ /G/ 🏷️ → tag · /P/ /AA/ /T/ 🍲 → pot

### K · Read common high-frequency sight words in isolation and simple text

task `sight` · curriculum primitive `fast-fact` · hopper 271 items over 271 words (22 pictured)

- **Easy** (β̄ 0.77): could · her · want · been · come
- **Medium** (β̄ 1.31): ago · does · used · better · idea
- **Hard** (β̄ 1.58): everybody · each · soon · believe · since

### K · Identify and read common consonant digraphs (sh, ch, th, wh) and blends (st, pl, br)

task `decode` · curriculum primitive `phonics-blender` · hopper 40 items over 40 words (6 pictured)

- **Easy** (β̄ 0.46): that · chat · shop · wish · much
- **Medium** (β̄ 0.76): chip · hush · smash · when · lunch
- **Hard** (β̄ 1.24): shelf · pinch · shuts · flush · sixth

### K · Match basic vocabulary words to corresponding pictures in common categories (e.g., animals

task `concept-sort` · curriculum primitive `ai-tutor-session` · hopper 598 items over 143 words (143 pictured)

- categories: vehicle(19), animal(73), food(52), school(11), clothing(24), toy(8), sport(7), home(38), tool(18), body(13), place(9), weather(11), music(4), nature(18)
- **Easy** (β̄ -0.04): car 🚗, ship 🚢, train 🚆, hand ✋ (sort: vehicle vs body) → hand · ball ⚽, gift 🎁, robot 🤖, dog 🐶 (sort: toy vs animal) → dog · can 🥫, honey 🍯, sweet 🍭, bag 👜 (sort: food vs clothing) → bag · eye 👁️, mouth 👄, foot 🦶, box 📦 (sort: body vs home) → box · cap 🧢, purse 👛, gloves 🧤, drum 🥁 (sort: clothing vs music) → drum
- **Medium** (β̄ 0.28): wheel 🛞, ambulance 🚑, helicopter 🚁, city 🏙️ (sort: vehicle vs place) → city · books 📚, bell 🔔, plus ➕, boat ⛵ (sort: school vs vehicle) → boat · box 📦, window 🪟, seat 💺, blocks 🧱 (sort: home vs toy) → blocks · glasses 👓, crown 👑, shoe 👟, camping 🏕️ (sort: clothing vs place) → camping · ball ⚽, gift 🎁, robot 🤖, phone 📱 (sort: toy vs tool) → phone
- **Hard** (β̄ 1.26): basketball 🏀, bowling 🎳, jog 🏃, blocks 🧱 (sort: sport vs toy) → blocks · star ⭐, tree 🌳, moon 🌙, wind 🌬️ (sort: nature vs weather) → wind · day ☀️, night 🌙, cold 🥶, fire 🔥 (sort: weather vs nature) → fire · school 🏫, book 📖, letter ✉️, house 🏠 (sort: school vs home) → house · hole 🕳️, mountain ⛰️, lake 🏞️, glass 🥛 (sort: nature vs home) → glass

### K · Sort vocabulary words into basic categories (e.g., animals, foods, colors) with 85% accura

task `concept-sort` · curriculum primitive `ai-tutor-session` · hopper 598 items over 143 words (143 pictured)

- categories: vehicle(19), animal(73), food(52), school(11), clothing(24), toy(8), sport(7), home(38), tool(18), body(13), place(9), weather(11), music(4), nature(18)
- **Easy** (β̄ -0.04): car 🚗, ship 🚢, train 🚆, hand ✋ (sort: vehicle vs body) → hand · ball ⚽, gift 🎁, robot 🤖, dog 🐶 (sort: toy vs animal) → dog · can 🥫, honey 🍯, sweet 🍭, bag 👜 (sort: food vs clothing) → bag · eye 👁️, mouth 👄, foot 🦶, box 📦 (sort: body vs home) → box · cap 🧢, purse 👛, gloves 🧤, drum 🥁 (sort: clothing vs music) → drum
- **Medium** (β̄ 0.28): wheel 🛞, ambulance 🚑, helicopter 🚁, city 🏙️ (sort: vehicle vs place) → city · books 📚, bell 🔔, plus ➕, boat ⛵ (sort: school vs vehicle) → boat · box 📦, window 🪟, seat 💺, blocks 🧱 (sort: home vs toy) → blocks · glasses 👓, crown 👑, shoe 👟, camping 🏕️ (sort: clothing vs place) → camping · ball ⚽, gift 🎁, robot 🤖, phone 📱 (sort: toy vs tool) → phone
- **Hard** (β̄ 1.26): basketball 🏀, bowling 🎳, jog 🏃, blocks 🧱 (sort: sport vs toy) → blocks · star ⭐, tree 🌳, moon 🌙, wind 🌬️ (sort: nature vs weather) → wind · day ☀️, night 🌙, cold 🥶, fire 🔥 (sort: weather vs nature) → fire · school 🏫, book 📖, letter ✉️, house 🏠 (sort: school vs home) → house · hole 🕳️, mountain ⛰️, lake 🏞️, glass 🥛 (sort: nature vs home) → glass

### K · Group words by function and use (e.g., "things we eat," "things we wear," "places we go")

task `concept-sort` · curriculum primitive `ai-tutor-session` · hopper 598 items over 143 words (143 pictured)

- categories: vehicle(19), animal(73), food(52), school(11), clothing(24), toy(8), sport(7), home(38), tool(18), body(13), place(9), weather(11), music(4), nature(18)
- **Easy** (β̄ -0.04): car 🚗, ship 🚢, train 🚆, hand ✋ (sort: vehicle vs body) → hand · ball ⚽, gift 🎁, robot 🤖, dog 🐶 (sort: toy vs animal) → dog · can 🥫, honey 🍯, sweet 🍭, bag 👜 (sort: food vs clothing) → bag · eye 👁️, mouth 👄, foot 🦶, box 📦 (sort: body vs home) → box · cap 🧢, purse 👛, gloves 🧤, drum 🥁 (sort: clothing vs music) → drum
- **Medium** (β̄ 0.28): wheel 🛞, ambulance 🚑, helicopter 🚁, city 🏙️ (sort: vehicle vs place) → city · books 📚, bell 🔔, plus ➕, boat ⛵ (sort: school vs vehicle) → boat · box 📦, window 🪟, seat 💺, blocks 🧱 (sort: home vs toy) → blocks · glasses 👓, crown 👑, shoe 👟, camping 🏕️ (sort: clothing vs place) → camping · ball ⚽, gift 🎁, robot 🤖, phone 📱 (sort: toy vs tool) → phone
- **Hard** (β̄ 1.26): basketball 🏀, bowling 🎳, jog 🏃, blocks 🧱 (sort: sport vs toy) → blocks · star ⭐, tree 🌳, moon 🌙, wind 🌬️ (sort: nature vs weather) → wind · day ☀️, night 🌙, cold 🥶, fire 🔥 (sort: weather vs nature) → fire · school 🏫, book 📖, letter ✉️, house 🏠 (sort: school vs home) → house · hole 🕳️, mountain ⛰️, lake 🏞️, glass 🥛 (sort: nature vs home) → glass

### K · Sort common objects into basic categories (e.g., food, animals, clothes)

task `concept-sort` · curriculum primitive `ai-tutor-session` · hopper 598 items over 143 words (143 pictured)

- categories: vehicle(19), animal(73), food(52), school(11), clothing(24), toy(8), sport(7), home(38), tool(18), body(13), place(9), weather(11), music(4), nature(18)
- **Easy** (β̄ -0.04): car 🚗, ship 🚢, train 🚆, hand ✋ (sort: vehicle vs body) → hand · ball ⚽, gift 🎁, robot 🤖, dog 🐶 (sort: toy vs animal) → dog · can 🥫, honey 🍯, sweet 🍭, bag 👜 (sort: food vs clothing) → bag · eye 👁️, mouth 👄, foot 🦶, box 📦 (sort: body vs home) → box · cap 🧢, purse 👛, gloves 🧤, drum 🥁 (sort: clothing vs music) → drum
- **Medium** (β̄ 0.28): wheel 🛞, ambulance 🚑, helicopter 🚁, city 🏙️ (sort: vehicle vs place) → city · books 📚, bell 🔔, plus ➕, boat ⛵ (sort: school vs vehicle) → boat · box 📦, window 🪟, seat 💺, blocks 🧱 (sort: home vs toy) → blocks · glasses 👓, crown 👑, shoe 👟, camping 🏕️ (sort: clothing vs place) → camping · ball ⚽, gift 🎁, robot 🤖, phone 📱 (sort: toy vs tool) → phone
- **Hard** (β̄ 1.26): basketball 🏀, bowling 🎳, jog 🏃, blocks 🧱 (sort: sport vs toy) → blocks · star ⭐, tree 🌳, moon 🌙, wind 🌬️ (sort: nature vs weather) → wind · day ☀️, night 🌙, cold 🥶, fire 🔥 (sort: weather vs nature) → fire · school 🏫, book 📖, letter ✉️, house 🏠 (sort: school vs home) → house · hole 🕳️, mountain ⛰️, lake 🏞️, glass 🥛 (sort: nature vs home) → glass

## Not served by the library

| G | subskill | why |
|---|---|---|
| 1 | Attach -s and -es to base words to change them from singular to plural or adjust for verb  | morphology (base + ending): library can supply bases; ending rules are a next step |
| 1 | Modify base words with -ed and -ing suffixes while applying simple spelling rules like dou | morphology (base + ending): library can supply bases; ending rules are a next step |
| 1 | Read high-frequency words fluently within connected text to improve overall reading speed  | connected text: LLM band (words drawn from the decode hopper) |
| 1 | Students match words that share similar meanings to build a stronger vocabulary. Focus: Re | relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table |
| 1 | Students identify pairs of words that represent opposites in meaning. Focus: Recognizing p | relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table |
| 1 | Students match vocabulary terms to their corresponding categories and defining characteris | category needs knowledge the ratings do not hold (season, attributes) |
| 1 | Students bridge vocabulary words with real-world scenarios by matching terms to images ill | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| 1 | Students select the best descriptive word to match a given situational prompt. Focus: Appl | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Read CVC Words in Decodable Phrases & Sentences | connected text: LLM band (words drawn from the decode hopper) |
| K | Follow text directionality (left-to-right, top-to-bottom, page-by-page) | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Distinguish between letters, words, and spaces in printed text | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Recognize and count words within printed sentences | connected text: LLM band (words drawn from the decode hopper) |
| K | Match and identify uppercase and lowercase letters in text | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Demonstrate one-to-one letter-sound correspondences for consonants and vowels | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Read and comprehend words with common endings (-s, -ing, -ed) and compound words | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Apply phonics skills to distinguish between similarly spelled words in context | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Use new vocabulary words in complete oral sentences during guided activities | connected text: LLM band (words drawn from the decode hopper) |
| K | Identify and match basic opposite pairs using picture cards (e.g., big/small, hot/cold) | relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table |
| K | Use descriptive words for physical properties (e.g., texture, size, shape) during hands-on | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Match emotion vocabulary to situations and facial expressions using various media | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Identify and use gradable concept words (e.g., tiny/small/big/huge, freezing/cold/cool/war | relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table |
| K | Use picture clues in storybooks to predict meanings of unfamiliar words | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Match vocabulary words to corresponding story scene illustrations | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Create simple sentences using newly learned vocabulary words from stories | connected text: LLM band (words drawn from the decode hopper) |
| K | Identify and demonstrate multiple meanings of common words (e.g., "bat," "run") | relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table |
| K | Use sentence context and picture clues to determine appropriate word meanings | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Solve simple word riddles using context clues and prior vocabulary knowledge | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Match basic pairs of related objects from visual cards (e.g., sock/shoe, spoon/fork) | relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table |
| K | Create simple rhyming pairs using picture support (e.g., cat/hat, dog/log) | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Match objects to their typical locations (e.g., bed/bedroom, book/library) | relation between words (opposite, synonym, scale, goes-with): no public source; needs a curated relation table |
| K | Build three-word rhyming families with common endings (e.g., cat/hat/mat) | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Create simple thematic word webs with 3-4 related items (e.g., farm: cow, pig, barn) | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Sort words and pictures by seasonal categories with reasoning (e.g., "mittens go in winter | category needs knowledge the ratings do not hold (season, attributes) |
| K | Build sequential word chains with logical connections (e.g., seed → plant → flower → bee) | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Match vocabulary words to physical objects or pictures in classroom scavenger hunts | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Use basic action words in following and giving classroom commands | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Apply vocabulary in structured activities (weather reports, counting exercises, simple exp | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Create simple sentences using new vocabulary with magnetic words or writing tools | connected text: LLM band (words drawn from the decode hopper) |
| K | Describe images or scenarios using multiple vocabulary words from a word bank | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Generate rhyming words and simple poems using target vocabulary | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |
| K | Participate in guided writing activities using new vocabulary (class stories, recipes) | not a word-level task (prose, grammar, print concepts, comprehension): LLM band |