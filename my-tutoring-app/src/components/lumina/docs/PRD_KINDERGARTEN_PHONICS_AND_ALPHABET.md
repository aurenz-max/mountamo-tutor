# PRD: Kindergarten Phonological Awareness, Alphabet & CVC Primitives

## Executive Summary

Lumina's current literacy coverage has strong infrastructure for grades 2-6 (18 implemented primitives from the Language Arts Suite PRD) but **critical gaps at the kindergarten level** — the very foundation that all later literacy depends on. The existing early-literacy primitives (`rhyming-pairs`, `sound-sort`, `alphabet-sequence`, `sight-word-card`, `letter-tracing`) are **display-only** with no generators, no interactivity, and no evaluation metrics. Meanwhile, the two interactive K-2 primitives (`phonics-blender`, `decodable-reader`) cover only CVC blending and passage reading — missing syllable awareness, phoneme isolation, phoneme manipulation, letter recognition, letter-sound correspondence, CVC encoding, and CVC application activities.

This PRD proposes **8 new primitives** and **3 enhancements to existing primitives** to deliver complete coverage of the kindergarten phonological awareness, alphabet knowledge, and CVC word skills progression.

### Audio Architecture: AI Tutor Voice (Not TTS)

These primitives do **not** use direct TTS audio playback. Instead, all audio — word pronunciation, phoneme sounds, instructions, celebrations, hints — is delivered through the **Gemini Live AI tutor** via the native scaffolding system (see [ADDING_TUTORING_SCAFFOLD.md](ADDING_TUTORING_SCAFFOLD.md)):

- **`updateContext()`** — silent background state sync (phase changes, score updates). AI absorbs but does not speak.
- **`sendText('[TAG] instruction', { silent: true })`** — triggers the AI to speak at pedagogical moments. The bracketed tag tells the AI what kind of response is needed.
- **Catalog `tutoring` scaffold** — configures what the AI knows: task description, context keys, scaffolding levels, common struggles, and `aiDirectives` for special behaviors like pronunciation commands.

This means every primitive needs:
1. A `tutoring` entry in `catalog/literacy.ts` defining the scaffold
2. `sendText` calls in the component at each pedagogical moment (correct/incorrect, phase transitions, pronunciation requests, etc.)
3. `aiDirectives` for any special behaviors (e.g., `[PRONOUNCE]` requiring no commentary)

---

## Gap Analysis

### Skills Requiring Coverage

| Skill Area | Subskills | Existing Coverage | Gap Severity |
|---|---|---|---|
| **Rhyme Recognition & Production** | 3 | `rhyming-pairs` (display-only, matching only) | HIGH — no interactive recognition, identification, or production |
| **Syllable Blending & Segmentation** | 1 | None | HIGH — completely missing |
| **Onset-Rime Blending & Segmentation** | 2 | `phonics-blender` (blending only, no onset-rime mode) | MEDIUM — blending partially covered, isolation missing |
| **Phoneme Isolation** | 3 | `sound-sort` (display-only, sorting only) | HIGH — no interactive isolation of beginning/middle/end sounds |
| **Phoneme Blending & Segmentation** | 2 | `phonics-blender` (blending only) | MEDIUM — blending covered, segmentation missing |
| **Phoneme Manipulation** | 3 | None | HIGH — completely missing |
| **Letter Recognition** (Groups 1-4) | 4 | `alphabet-sequence` (display-only, sequence only) | HIGH — no letter identification assessment |
| **Letter-Sound Correspondence** (Groups 1-4) | 4 | None | HIGH — completely missing |
| **Letter Formation** (Groups 1-4) | 4 | `letter-tracing` (display-only, no generator) | MEDIUM — exists but no generator or group progression |
| **Decoding CVC Words** (by vowel) | 6 | `phonics-blender` (general CVC, no vowel filtering) | MEDIUM — CVC blending works but no vowel-specific progression |
| **Encoding CVC Words** (by vowel) | 5 | None | HIGH — completely missing |
| **Application of CVC Knowledge** | 4 | `decodable-reader` (partial — sentence reading only) | HIGH — no real/nonsense discrimination, picture matching, word chains |

**Total subskills: 41 | Fully covered: 2 | Partially covered: 7 | Not covered: 32**

### What Already Works

| Primitive | What It Covers | Limitation |
|---|---|---|
| `phonics-blender` | CVC phoneme blending (sounds → word) | No onset-rime mode, no segmentation, no vowel-specific filtering |
| `decodable-reader` | Reading CVC passages with AI tutor support | No vowel-specific decodable texts, no word-level isolation |
| `letter-tracing` | Letter formation display with stroke order | Display-only, no generator, no group-based progression |
| `rhyming-pairs` | Rhyming word pair display | Display-only, no interactive assessment |
| `sound-sort` | Sound category display | Display-only, no interactive sorting |
| `alphabet-sequence` | Alphabet sequence with missing letters | Display-only, no letter recognition assessment |

---

## Proposed Solution: 8 New Primitives + 3 Enhancements

### Pedagogical Progression

The primitives follow the research-validated phonological awareness hierarchy:

```
LARGER UNITS ──────────────────────────────────────► SMALLER UNITS

1. Rhyme          2. Syllable       3. Onset-Rime      4. Phoneme         5. Phoneme         6. Phoneme
   Recognition       Segmentation      Blending &          Isolation          Blending &         Manipulation
   & Production                        Segmentation                           Segmentation

   rhyme-studio     syllable-         phoneme-explorer    phoneme-explorer   phonics-blender    sound-swap
                    clapper           (onset-rime mode)   (isolation mode)   (existing)
                                                                            phoneme-explorer
                                                                            (segmentation mode)
```

Parallel alphabet knowledge track:

```
7. Letter Recognition ──► 8. Letter-Sound Correspondence ──► 9. Letter Formation
   letter-spotter            letter-sound-link                  letter-tracing (enhanced)
```

Converging at word-level skills:

```
10. CVC Decoding ──► 11. CVC Encoding ──► 12. CVC Application
    phonics-blender      cvc-speller          word-workout
    (enhanced)
```

---

## NEW PRIMITIVE 1: `rhyme-studio`

### Interactive Rhyme Recognition, Identification & Production

**What it does:** A multi-mode rhyme practice primitive that covers the full rhyme awareness progression. Students move through three challenge types: (1) **Recognition** — hear two words and decide if they rhyme (yes/no), (2) **Identification** — hear a target word and pick the rhyming word from 2-3 options, (3) **Production** — hear a word and type/select a word that rhymes with it.

**Why it's needed:** The existing `rhyming-pairs` is display-only — it shows pre-made pairs but never asks the student to *recognize*, *identify*, or *produce* rhymes. All three subskills are essential phonological awareness milestones for kindergarten.

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor speaks all words aloud. On challenge start, it says the target word(s). For recognition mode, it says both words and asks "Do these rhyme?" For identification, it says "Which word rhymes with [target]?" For production, it says "Tell me a word that rhymes with [target]." Celebration/feedback spoken after each response.
- **Visual:** Word cards with illustrations. Color-coded rhyme highlighting on the shared ending (-at, -un, -ig). Celebratory animation on correct answers.
- **Interactive:** Tap yes/no buttons (recognition), tap a word card (identification), select from a word bank or type (production).

**Challenge modes:**

| Mode | Task | Difficulty | Example |
|---|---|---|---|
| **Recognition** | "Do these words rhyme?" | 0-3 | Hear "cat" and "hat" → tap Yes. Hear "cat" and "dog" → tap No. |
| **Identification** | "Which word rhymes with ___?" | 2-4 | Hear "cat" → choose from "dog" or "hat" → tap "hat". |
| **Production** | "Tell me a word that rhymes with ___." | 3-5 | Hear "sun" → type or select "bun", "fun", "run". |

**Interaction model:**
- Phase 1 (Explore): AI tutor introduces 3-4 rhyming pairs with illustrations, saying each pair and emphasizing the matching endings.
- Phase 2 (Practice): 4-6 challenges mixing recognition and identification modes at current difficulty.
- Phase 3 (Apply): 2-3 production challenges where the student generates a rhyming word.

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | Warmly introduce the rhyming activity, say the first pair of words |
| `[PRONOUNCE_WORDS]` | Challenge presented | Say the word(s) for this challenge clearly |
| `[ANSWER_CORRECT]` | Student answers correctly | Brief celebration, emphasize the rhyme pattern ("Yes! Cat and hat both end in -at!") |
| `[ANSWER_INCORRECT]` | Student answers wrong | Gentle hint without answer ("Listen to the ending sounds...") |
| `[NEXT_CHALLENGE]` | Moving to next challenge | Say the new words, introduce the task |
| `[PHASE_TRANSITION]` | Moving between phases | Explain what's coming next |
| `[SESSION_COMPLETE]` | All challenges done | Celebrate the full session, summarize patterns practiced |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'Rhyme awareness activity. Mode: {{challengeMode}}. '
    + 'Challenge {{currentChallenge}}/{{totalChallenges}}: '
    + 'Target word: "{{targetWord}}" (rhyme family: {{rhymeFamily}}). '
    + 'Phase: {{currentPhase}}. Attempts: {{attempts}}.',
  contextKeys: [
    'challengeMode', 'targetWord', 'rhymeFamily',
    'currentChallenge', 'totalChallenges', 'currentPhase', 'attempts',
  ],
  scaffoldingLevels: {
    level1:
      'RECOGNITION: "Listen to how the words end. Do they sound the same?" '
      + 'IDENTIFICATION: "Say each word slowly. Which one ends like {{targetWord}}?" '
      + 'PRODUCTION: "What sounds like {{targetWord}}? Think of the -{{rhymeFamily}} family."',
    level2:
      'RECOGNITION: "{{targetWord}} ends with {{rhymeFamily}}. Does the other word end the same way?" '
      + 'IDENTIFICATION: "{{targetWord}} ends in {{rhymeFamily}}. Which choice has that same ending?" '
      + 'PRODUCTION: "Words that rhyme with {{targetWord}} end in {{rhymeFamily}}. Can you think of one?"',
    level3:
      'RECOGNITION: "Listen: {{targetWord}}... hear the {{rhymeFamily}}? Now listen to the other word." '
      + 'IDENTIFICATION: "The answer rhymes with {{targetWord}} — it ends in {{rhymeFamily}}. Try saying each choice." '
      + 'PRODUCTION: "Here are some {{rhymeFamily}} words: [examples]. Can you think of another?"',
  },
  commonStruggles: [
    { pattern: 'Confusing rhyme with alliteration (same beginning)', response: 'Rhyming is about the ENDING sound. Cat and hat end the same: -at.' },
    { pattern: 'Cannot produce rhymes', response: 'Start with the rhyme family. If the word is "cat", the family is -at. Now put a new sound at the beginning: b-at, m-at, s-at.' },
    { pattern: 'Random guessing in identification', response: 'Say each word out loud slowly. Listen to the ending of each one.' },
  ],
  aiDirectives: [
    {
      title: 'PRONUNCIATION COMMANDS',
      instruction:
        'When you receive [PRONOUNCE_WORDS], clearly say the word(s) for this challenge. '
        + 'Say each word distinctly with a brief pause between them. '
        + 'Slightly emphasize the ending sounds to draw attention to the rhyme pattern. '
        + 'Do NOT add extra commentary — just say the words.',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  challenges: Array<{
    id: string,
    mode: 'recognition' | 'identification' | 'production',
    targetWord: string,
    targetWordImage: string,        // description for illustration
    rhymeFamily: string,            // e.g., "-at", "-un", "-ig"
    // Recognition mode:
    comparisonWord?: string,
    comparisonWordImage?: string,
    doesRhyme?: boolean,
    // Identification mode:
    options?: Array<{ word: string, image: string, isCorrect: boolean }>,
    // Production mode:
    acceptableAnswers?: string[],
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'rhyme-studio'`
- `challengeMode` ('recognition' | 'identification' | 'production')
- `challengesCorrect` / `challengesTotal`
- `recognitionAccuracy` (0-100)
- `identificationAccuracy` (0-100)
- `productionAccuracy` (0-100)
- `rhymeFamiliesPracticed` (array of rime patterns)
- `attemptsCount`

**Subskills served:**
- ✅ Recognize if two spoken words rhyme (Difficulty 0-3)
- ✅ Identify the rhyming word from a spoken set of three (Difficulty 2-4)
- ✅ Produce a word that rhymes with a given spoken word (Difficulty 3-5)

---

## NEW PRIMITIVE 2: `syllable-clapper`

### Syllable Counting & Segmentation

**What it does:** Students hear a word spoken by the AI tutor and segment it into syllables by "clapping" (tapping). The primitive shows the word as a visual bar that splits into colored segments as the student taps the correct number of times. After clapping, the AI tutor speaks each syllable separately (e.g., "but...ter...fly") and the student sees the segments highlighted. Supports 1-4 syllable words appropriate for kindergarten.

**Why it's needed:** Syllable awareness is a critical step between rhyme awareness and phoneme awareness in the phonological awareness hierarchy. No existing primitive addresses it. Children need to understand that words are made of parts before they can isolate individual sounds.

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor says the word naturally at first via `[PRONOUNCE_WORD]`. After the student claps, it re-speaks the word with exaggerated syllable breaks via `[PRONOUNCE_SYLLABLES]` (e.g., "but...ter...fly"). It introduces each challenge ("Let's clap this word!") and celebrates correct counts.
- **Visual:** Word displayed as a single bar that splits into color-coded syllable chunks. Animated "clap" hands icon. Syllable count indicator (1-4 circles). Illustration of the word.
- **Interactive:** Tap/click a "clap" button to count syllables. Drag dividers to show where syllable breaks fall. Tap individual syllable segments to request AI pronunciation.

**Challenge flow:**
1. AI tutor says the word naturally (e.g., "butterfly")
2. Student taps the clap button for each syllable heard (3 taps for "but-ter-fly")
3. Visual bar splits into syllable segments with color coding
4. AI tutor speaks each syllable in isolation
5. Optional: drag syllable dividers to mark where the word splits

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | Introduce syllable clapping ("We're going to clap the parts of words!") |
| `[PRONOUNCE_WORD]` | New challenge | Say the word clearly and naturally, nothing else |
| `[PRONOUNCE_SYLLABLES]` | After correct clap count | Say the word broken into syllables with pauses ("but...ter...fly") |
| `[PRONOUNCE_SYLLABLE]` | Student taps a syllable segment | Say just that syllable, nothing else |
| `[CLAP_CORRECT]` | Student claps the right number | "Yes! [word] has [n] parts! Let's hear them..." |
| `[CLAP_INCORRECT]` | Student claps wrong number | "Hmm, let me say it again slowly. Listen for the parts..." then re-say with breaks |
| `[NEXT_CHALLENGE]` | Moving to next word | Say the new word |
| `[SESSION_COMPLETE]` | All challenges done | Celebrate |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'Syllable clapping activity. Word {{currentChallenge}}/{{totalChallenges}}: '
    + '"{{currentWord}}" ({{syllableCount}} syllables: {{syllables}}). '
    + 'Student clapped: {{studentClaps}}. Attempts: {{attempts}}.',
  contextKeys: [
    'currentWord', 'syllableCount', 'syllables',
    'studentClaps', 'currentChallenge', 'totalChallenges', 'attempts',
  ],
  scaffoldingLevels: {
    level1: '"Let\'s clap the word! Say it with me and clap each part."',
    level2: '"Listen: {{currentWord}}. I\'ll say it slowly — clap when you hear a new part."',
    level3: '"{{currentWord}} has {{syllableCount}} parts: {{syllables}}. Clap with me: [clap each syllable]."',
  },
  commonStruggles: [
    { pattern: 'Clapping too many times (adding extra syllables)', response: 'Say the word slowly and naturally. Only clap when your mouth makes a new sound.' },
    { pattern: 'Clapping once for all multi-syllable words', response: 'Put your hand under your chin. Each time your chin drops, that\'s a new syllable.' },
    { pattern: 'Confusing syllables with phonemes', response: 'We\'re listening for big parts, not little sounds. "Cat" is one clap. "Kitten" is two claps.' },
  ],
  aiDirectives: [
    {
      title: 'PRONUNCIATION COMMANDS',
      instruction:
        'When you receive [PRONOUNCE_WORD], say the word naturally and clearly. Just the word. '
        + 'When you receive [PRONOUNCE_SYLLABLES], say the word with clear pauses between syllables '
        + '(e.g., "but...ter...fly"). Exaggerate the breaks slightly. '
        + 'When you receive [PRONOUNCE_SYLLABLE], say just the single syllable requested.',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  challenges: Array<{
    id: string,
    word: string,
    syllableCount: number,          // 1-4
    syllables: string[],            // ["but", "ter", "fly"]
    imageDescription: string,
    difficulty: number,             // 3-5
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'syllable-clapper'`
- `wordsCorrect` / `wordsTotal`
- `clapCountAccuracy` (0-100, did they tap the right number of times)
- `segmentPlacementAccuracy` (0-100, did they mark syllable breaks correctly, if applicable)
- `syllableCountsEncountered` (e.g., {1: 2, 2: 3, 3: 2} — distribution of word lengths)
- `attemptsCount`

**Subskills served:**
- ✅ Segment a spoken two or three-syllable word into its parts (Difficulty 3-5)

---

## NEW PRIMITIVE 3: `phoneme-explorer`

### Phoneme Isolation, Onset-Rime Work & Segmentation

**What it does:** A multi-mode primitive covering the three "breaking apart" phonological awareness skills: (1) **Onset-Rime** — split a word into its onset (initial consonant/cluster) and rime (vowel + rest), (2) **Phoneme Isolation** — identify the beginning, ending, or medial sound in a word, (3) **Phoneme Segmentation** — break a CVC word into all its individual phonemes. Each mode uses audio-first presentation (AI tutor speaks words before showing text) with visual sound boxes (Elkonin boxes) for phoneme representation.

**Why it's needed:** `phonics-blender` handles the *building* direction (sounds → word) but not the *breaking apart* direction (word → sounds). `sound-sort` is display-only and only categorizes — it doesn't ask students to isolate or segment. These three "analysis" skills are prerequisites for decoding and spelling.

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor speaks the target word, individual phonemes in isolation, slow-stretch pronunciations, and onset/rime segments. Uses `[PRONOUNCE]` for clean sound production and `[STRETCH_WORD]` for slow-blending. Provides hints at each scaffolding level ("What's the FIRST sound you hear?").
- **Visual:** Elkonin boxes (sound boxes) — one box per phoneme that fills with a letter/sound as the student identifies it. Color-coded: onset = blue, rime = green. Position highlighting (beginning = left box glows, end = right box glows, middle = center box glows).
- **Interactive:** Tap sound boxes to assign sounds. Select phonemes from an option bank (AI speaks each option when tapped). Drag divider between onset and rime.

**Challenge modes:**

| Mode | Task | Difficulty | Example |
|---|---|---|---|
| **Onset-Rime Blend** | "Put these parts together" | 0-5 | Hear /c/ + /at/ → type or select "cat" |
| **Onset-Rime Isolate** | "Break this word into its first sound and the rest" | 2-6 | Hear "cat" → drag divider: /c/ \| /at/ |
| **Beginning Sound** | "What is the FIRST sound in this word?" | 2-5 | Hear "cat" → select /k/ |
| **Ending Sound** | "What is the LAST sound?" | 3-6 | Hear "cat" → select /t/ |
| **Medial Sound** | "What is the MIDDLE sound?" | 3-6 | Hear "cat" → select /æ/ |
| **Full Segmentation** | "Break this word into all its sounds" | 4-8 | Hear "dog" → fill boxes: /d/ /ŏ/ /g/ |

**Interaction model:**
- Phase 1 (Explore): AI tutor demonstrates with audio. "Listen: 'cat'. The first sound is /k/. The rest is /at/."
- Phase 2 (Practice): 4-6 challenges at the student's target mode and difficulty.
- Phase 3 (Apply): Mixed-mode challenges that combine isolation and segmentation.

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | Introduce the activity ("Let's listen for sounds inside words!") |
| `[PRONOUNCE]` | Word/phoneme needs speaking | Say just the word, sound, onset, or rime — nothing else |
| `[STRETCH_WORD]` | Student needs slow pronunciation | Say the word stretched: "/k/... /æ/... /t/" with pauses |
| `[TAP_OPTION]` | Student taps a phoneme option | Say just that phoneme sound, nothing else |
| `[ANSWER_CORRECT]` | Student identifies correctly | Brief celebration + reinforce ("Yes! /k/ is the first sound in cat!") |
| `[ANSWER_INCORRECT]` | Student identifies wrong | Hint based on mode ("Listen again — what's the FIRST sound?") |
| `[NEXT_CHALLENGE]` | New word | Say the new word, set up the task |
| `[PHASE_TRANSITION]` | Phase change | Explain the new task type |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'Phoneme awareness activity. Mode: {{mode}}. '
    + 'Challenge {{currentChallenge}}/{{totalChallenges}}: "{{targetWord}}". '
    + 'Target: {{targetDescription}}. Phase: {{currentPhase}}. Attempts: {{attempts}}.',
  contextKeys: [
    'mode', 'targetWord', 'targetDescription', 'currentChallenge',
    'totalChallenges', 'currentPhase', 'attempts', 'studentAnswer',
  ],
  scaffoldingLevels: {
    level1:
      'ONSET-RIME: "What\'s the first sound? And what\'s the rest?" '
      + 'ISOLATION: "Say {{targetWord}} slowly. What {{targetPosition}} sound do you hear?" '
      + 'SEGMENTATION: "How many sounds do you hear in {{targetWord}}?"',
    level2:
      'ONSET-RIME: "{{targetWord}} starts with one sound, then the rest. What comes first?" '
      + 'ISOLATION: "In {{targetWord}}, the {{targetPosition}} sound is... listen carefully." '
      + 'SEGMENTATION: "Let me stretch it: [stretch]. How many sounds was that?"',
    level3:
      'ONSET-RIME: "{{targetWord}} → the first sound is {{onset}}. The rest is {{rime}}." '
      + 'ISOLATION: "The {{targetPosition}} sound in {{targetWord}} is {{targetPhoneme}}. Can you hear it?" '
      + 'SEGMENTATION: "{{targetWord}} has {{phonemeCount}} sounds: {{phonemes}}."',
  },
  commonStruggles: [
    { pattern: 'Confusing letter names with sounds', response: 'We want the SOUND, not the letter name. The letter "c" makes the sound /k/.' },
    { pattern: 'Saying the whole word instead of isolating', response: 'Just the first/last/middle sound. Say it really short: /k/ not "cat".' },
    { pattern: 'Cannot segment beyond onset-rime', response: 'Start with just two parts: the first sound and the rest. Then we\'ll break the rest into smaller pieces.' },
    { pattern: 'Medial sound is hardest', response: 'Say the word slowly. The middle sound is the vowel — the loud part in the middle.' },
  ],
  aiDirectives: [
    {
      title: 'PRONUNCIATION COMMANDS',
      instruction:
        'When you receive [PRONOUNCE], say ONLY the requested word, phoneme, onset, or rime. '
        + 'No extra commentary. Produce clean sounds — /t/ not "tuh", /s/ not "suh". '
        + 'When you receive [STRETCH_WORD], say the word with each phoneme separated by a pause: '
        + '"/k/... /æ/... /t/" stretching each sound slightly. '
        + 'When you receive [TAP_OPTION], say just that phoneme sound.',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  mode: 'onset-rime-blend' | 'onset-rime-isolate' | 'beginning-sound' | 'ending-sound' | 'medial-sound' | 'full-segmentation',
  challenges: Array<{
    id: string,
    targetWord: string,
    imageDescription: string,
    onset?: string,                // "/k/"
    rime?: string,                 // "/at/"
    targetPosition?: 'beginning' | 'middle' | 'end',
    targetPhoneme?: string,        // "/k/"
    distractorPhonemes?: string[], // ["/d/", "/m/"]
    phonemes?: string[],           // ["/d/", "/ŏ/", "/g/"]
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'phoneme-explorer'`
- `mode` ('onset-rime-blend' | 'onset-rime-isolate' | 'beginning-sound' | 'ending-sound' | 'medial-sound' | 'full-segmentation')
- `challengesCorrect` / `challengesTotal`
- `phonemeAccuracy` (0-100)
- `positionAccuracy` (per-position: beginning/middle/end)
- `attemptsCount`

**Subskills served:**
- ✅ Blend onset and rime (/c/ + /at/ → cat) (Difficulty 0-5)
- ✅ Isolate onset and rime (cat → /c/ + /at/) (Difficulty 2-6)
- ✅ Identify the beginning sound in a word (Difficulty 2-5)
- ✅ Identify the ending sound in a word (Difficulty 3-6)
- ✅ Identify the medial sound in a word (Difficulty 3-6)
- ✅ Segment a CVC word into three phonemes (Difficulty 4-8)

---

## NEW PRIMITIVE 4: `sound-swap`

### Phoneme Manipulation (Add, Delete, Substitute)

**What it does:** Students manipulate individual phonemes in words to create new words. Three operation types: (1) **Addition** — add a sound to a word or word part to make a new word, (2) **Deletion** — remove a sound from a word to reveal a new word, (3) **Substitution** — swap one sound for another to transform one word into another. Uses visual letter/sound tiles that students can add, remove, or replace. The AI tutor speaks the original word, the instruction, and the resulting word.

**Why it's needed:** Phoneme manipulation is the most advanced phonological awareness skill and a direct predictor of reading success. No existing primitive addresses it. It builds on the isolation and segmentation skills from `phoneme-explorer` and blending from `phonics-blender`.

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor says the original word, gives the manipulation instruction ("Say 'cat'. Now change the /k/ to /b/. What word?"), and confirms the result. Uses `[PRONOUNCE]` for clean sound/word production and `[PRESENT_CHALLENGE]` for the full instruction delivery.
- **Visual:** Sound tiles representing the original word. Animated addition (tile slides in), deletion (tile fades out), or substitution (tile flips to reveal new sound). Before/after comparison display. Illustrations for both words.
- **Interactive:** Tap to select which sound to change. Drag a new sound tile onto an existing one to substitute. Tap a tile to remove it. Tap a "+" slot to add a sound.

**Challenge modes:**

| Mode | Task | Difficulty | Example |
|---|---|---|---|
| **Addition** | "Add a sound to make a new word" | 3-7 | "Say 'at'. Add /k/ to the beginning. What word?" → "cat" |
| **Deletion** | "Remove a sound to find a new word" | 3-7 | "Say 'cat'. Take away the /k/. What's left?" → "at" |
| **Substitution** | "Change one sound to make a new word" | 3-7 | "Say 'cat'. Change /k/ to /b/. What word?" → "bat" |

**Interaction model:**
- Phase 1 (Explore): AI tutor demonstrates with animated tiles. "Watch: 'cat' → take away /k/ → 'at'. Now add /b/ → 'bat'!"
- Phase 2 (Practice): 4-6 challenges at the target operation type.
- Phase 3 (Apply): Mixed operations — addition, deletion, and substitution combined.

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | Introduce sound swapping ("We're going to change sounds in words to make new words!") |
| `[PRESENT_CHALLENGE]` | New challenge | Give the full instruction: "Say [word]. Now [operation] the [sound]. What word do you get?" |
| `[PRONOUNCE]` | Word/sound needs saying | Say just the word or sound, nothing else |
| `[ANSWER_CORRECT]` | Student gets it right | Celebrate + reinforce both words ("Yes! When we change /k/ to /b/ in 'cat', we get 'bat'!") |
| `[ANSWER_INCORRECT]` | Student gets it wrong | Hint: say the original word, emphasize the target sound, re-state the operation |
| `[NEXT_CHALLENGE]` | Next challenge | Present the new challenge instruction |
| `[SESSION_COMPLETE]` | All done | Celebrate the transformations they made |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'Phoneme manipulation activity. Operation: {{operation}}. '
    + 'Challenge {{currentChallenge}}/{{totalChallenges}}: '
    + '"{{originalWord}}" → {{operationDescription}} → "{{resultWord}}". '
    + 'Phase: {{currentPhase}}. Attempts: {{attempts}}.',
  contextKeys: [
    'operation', 'originalWord', 'resultWord', 'operationDescription',
    'currentChallenge', 'totalChallenges', 'currentPhase', 'attempts',
    'targetPhoneme', 'newPhoneme', 'position',
  ],
  scaffoldingLevels: {
    level1: '"Say {{originalWord}}. Now {{operationDescription}}. What word do you get?"',
    level2: '"Listen to {{originalWord}}: {{originalPhonemes}}. If we {{operationDescription}}, what changes?"',
    level3: '"{{originalWord}} is made of {{originalPhonemes}}. When we {{operationDescription}}, it becomes {{resultWord}}."',
  },
  commonStruggles: [
    { pattern: 'Cannot hold the original word in memory', response: 'Say the original word one more time. Now say it again, but this time...' },
    { pattern: 'Changes the wrong sound', response: 'Point to the sound we are changing. Which tile are we working with?' },
    { pattern: 'Produces a nonsense word', response: 'Let\'s try again. Say the sounds one at a time after the change.' },
  ],
  aiDirectives: [
    {
      title: 'CHALLENGE PRESENTATION',
      instruction:
        'When you receive [PRESENT_CHALLENGE], deliver the full manipulation instruction clearly. '
        + 'Say the original word, then the operation, then ask for the result. '
        + 'Example: "Say cat. Now change the /k/ to /b/. What word do you get?"',
    },
    {
      title: 'PRONUNCIATION COMMANDS',
      instruction:
        'When you receive [PRONOUNCE], say ONLY the requested word or sound. No extra commentary. '
        + 'Produce clean phonemes — /t/ not "tuh", /s/ not "suh".',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  challenges: Array<{
    id: string,
    operation: 'addition' | 'deletion' | 'substitution',
    originalWord: string,
    originalPhonemes: string[],
    originalImage: string,
    addPhoneme?: string,
    addPosition?: 'beginning' | 'end',
    deletePhoneme?: string,
    deletePosition?: 'beginning' | 'middle' | 'end',
    oldPhoneme?: string,
    newPhoneme?: string,
    substitutePosition?: 'beginning' | 'middle' | 'end',
    resultWord: string,
    resultPhonemes: string[],
    resultImage: string,
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'sound-swap'`
- `operation` ('addition' | 'deletion' | 'substitution')
- `challengesCorrect` / `challengesTotal`
- `additionAccuracy` (0-100)
- `deletionAccuracy` (0-100)
- `substitutionAccuracy` (0-100)
- `attemptsCount`

**Subskills served:**
- ✅ Add a phoneme to a word or word part (Difficulty 3-7)
- ✅ Delete a phoneme from a word (Difficulty 3-7)
- ✅ Substitute one phoneme for another (Difficulty 3-7)

---

## NEW PRIMITIVE 5: `letter-spotter`

### Interactive Letter Recognition Assessment

**What it does:** Students identify letters by name when shown them visually. The primitive presents letters (uppercase and/or lowercase) and students must select the correct letter name from options. Follows the cumulative group-based progression: Group 1 (s, a, t, i, p, n) → Group 2 (adds c, k, e, h, r, m, d) → Group 3 (adds g, o, u, l, f, b) → Group 4 (adds j, z, w, v, y, x, q). Each group reviews all previously learned letters while introducing new ones.

**Why it's needed:** `alphabet-sequence` only shows alphabet order with missing letters — it never asks students to *name* individual letters. Letter recognition (naming the letter when you see it) is a foundational skill distinct from alphabetical ordering and is assessed in every kindergarten screening.

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor says the letter name as confirmation after correct identification. In "Find It" mode, the AI says "Find the letter [name]" to initiate the search. The AI introduces each challenge and provides encouragement/correction.
- **Visual:** Large, clear letter display (both uppercase and lowercase shown together). Multiple font styles to prevent students from recognizing only one visual form. Visual association images (A = apple, B = ball) shown as scaffold in explore phase, removed in practice.
- **Interactive:** Tap the correct letter name from 3-4 options. "Find all the [letter]s" — scan a grid of letters and tap all instances of the target letter. Match uppercase to lowercase.

**Challenge modes:**

| Mode | Task | Example |
|---|---|---|
| **Name It** | See a letter, select its name | See "S s" → select "S" from options [S, T, A, P] |
| **Find It** | Hear a letter name, find it in a grid | AI says "Find the letter T" → tap all T/t in a letter grid |
| **Match It** | Match uppercase to lowercase | See "A" → select "a" from [a, e, o, i] |

**Cumulative group progression:**
- **Group 1:** Letters s, a, t, i, p, n only. All challenges draw from this 6-letter set.
- **Group 2:** Letters c, k, e, h, r, m, d introduced. Challenges draw from all 13 letters (higher concentration of new letters, systematic review of Group 1).
- **Group 3:** Letters g, o, u, l, f, b introduced. Full 19-letter set. Note: b and d are deliberately separated across groups to minimize reversal confusion.
- **Group 4:** Letters j, z, w, v, y, x, q introduced. Full 26-letter set. Q taught alongside "qu" digraph.

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | Introduce letter spotting for this group |
| `[FIND_LETTER]` | Find-It mode challenge | Say "Find the letter [name]!" clearly |
| `[SAY_LETTER_NAME]` | Confirmation / introduction | Say the letter name clearly |
| `[ANSWER_CORRECT]` | Correct identification | "Yes, that's the letter [name]!" with brief celebration |
| `[ANSWER_INCORRECT]` | Wrong identification | "That's the letter [wrong]. We're looking for [correct]. Look at the shape..." |
| `[NEXT_CHALLENGE]` | Next challenge | Introduce the next letter task |
| `[NEW_LETTER_INTRO]` | First time seeing a new letter | "This is a new letter! This is [name]. It looks like..." |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'Letter recognition activity. Group {{letterGroup}} (letters: {{cumulativeLetters}}). '
    + 'Mode: {{challengeMode}}. Target letter: {{targetLetter}} ({{targetCase}}). '
    + 'Challenge {{currentChallenge}}/{{totalChallenges}}. Attempts: {{attempts}}.',
  contextKeys: [
    'letterGroup', 'cumulativeLetters', 'newLetters', 'challengeMode',
    'targetLetter', 'targetCase', 'currentChallenge', 'totalChallenges', 'attempts',
  ],
  scaffoldingLevels: {
    level1: '"Look at this letter carefully. What is its name?"',
    level2: '"This letter looks like [shape hint]. Does it remind you of any letter you know?"',
    level3: '"This is the letter {{targetLetter}}. Say it with me: {{targetLetter}}!"',
  },
  commonStruggles: [
    { pattern: 'Confusing b and d', response: 'Make a "bed" with your fists — left thumb up is b, right thumb up is d.' },
    { pattern: 'Confusing p and q', response: 'The letter p has its stick going DOWN. The letter q has its stick going DOWN too, but the circle is on the other side.' },
    { pattern: 'Confusing uppercase and lowercase forms', response: 'Big [letter] and little [letter] are the same letter, just different sizes. They make the same sound!' },
    { pattern: 'Cannot name new letters', response: 'This is a new letter! Let me introduce you: this is [name]. Can you say [name]?' },
  ],
  aiDirectives: [
    {
      title: 'LETTER NAMING',
      instruction:
        'When you receive [SAY_LETTER_NAME] or [FIND_LETTER], say the letter name clearly. '
        + 'Use the standard letter name (e.g., "A" as "ay", "S" as "ess"). '
        + 'For [FIND_LETTER], say "Find the letter [name]!" with enthusiasm. '
        + 'For [NEW_LETTER_INTRO], warmly introduce the letter with a brief description of its shape.',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  letterGroup: 1 | 2 | 3 | 4,
  cumulativeLetters: string[],
  newLetters: string[],
  challenges: Array<{
    id: string,
    mode: 'name-it' | 'find-it' | 'match-it',
    targetLetter: string,
    targetCase: 'uppercase' | 'lowercase' | 'both',
    options?: string[],
    letterGrid?: string[],
    targetCount?: number,
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'letter-spotter'`
- `letterGroup` (1 | 2 | 3 | 4)
- `challengesCorrect` / `challengesTotal`
- `newLetterAccuracy` (0-100, accuracy on newly introduced letters)
- `reviewLetterAccuracy` (0-100, accuracy on previously learned letters)
- `uppercaseAccuracy` (0-100)
- `lowercaseAccuracy` (0-100)
- `confusedLetterPairs` (array of letter pairs the student confused, e.g., ["b-d", "p-q"])
- `attemptsCount`

**Subskills served:**
- ✅ Letter Group 1: s, a, t, i, p, n (Difficulty 2-4)
- ✅ Letter Group 2: c, k, e, h, r, m, d — cumulative 13 letters (Difficulty 4-7)
- ✅ Letter Group 3: g, o, u, l, f, b — cumulative 19 letters (Difficulty 4-6)
- ✅ Letter Group 4: j, z, w, v, y, x, q — full 26 letters (Difficulty 5-7)

---

## NEW PRIMITIVE 6: `letter-sound-link`

### Letter-Sound Correspondence

**What it does:** Students see a letter (grapheme) and must identify its primary sound (phoneme). The inverse is also supported: hear a sound, identify which letter makes it. Follows the same cumulative group progression as `letter-spotter`. Emphasizes clean sound production (crisp /t/, not "tuh") and teaches that some letters share sounds (c and k both make /k/).

**Why it's needed:** No existing primitive teaches the mapping between letters and their sounds. `phonics-blender` *uses* letter-sound knowledge but doesn't *teach* it. This is the bridge between letter recognition and decoding — students must know that "s" makes /s/ before they can blend /s/ + /a/ + /t/ into "sat".

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor pronounces each phoneme cleanly when demonstrating or confirming. Critical: clean sounds, not letter names + "uh" (e.g., /s/ not "suh", /t/ not "tuh"). Uses `[PRONOUNCE_SOUND]` for the phoneme and `[SAY_KEYWORD]` for keyword association (e.g., "/s/ as in sun"). The `aiDirective` for clean sound production is essential for this primitive.
- **Visual:** Large letter display. Sound written in slash notation (/s/). Keyword image (s = sun, a = apple). Color-coded: consonant sounds = blue, short vowel sounds = red.
- **Interactive:** See letter → select its sound from options (AI speaks each option when tapped). Hear sound → select the letter. Match letter to keyword image.

**Challenge modes:**

| Mode | Task | Example |
|---|---|---|
| **See → Hear** | See a letter, select its sound | See "s" → tap option, AI says each sound, tap /s/ |
| **Hear → See** | Hear a sound, find the letter | AI says /k/ → select from [c, s, t, k] (both c and k correct) |
| **Keyword Match** | Match letter to keyword image | See "a" → tap the apple (not the egg or igloo) |

**Cumulative group progression:**
- **Group 1:** /s/, /ă/, /t/, /ĭ/, /p/, /n/ — High-utility sounds that immediately enable word building (sat, pat, tap, sip, tip, pin, tin, sit).
- **Group 2:** /k/ (c and k), /ĕ/, /h/, /r/, /m/, /d/ — c and k introduced together as they share the /k/ sound. Cumulative 13-letter set.
- **Group 3:** /g/, /ŏ/, /ŭ/, /l/, /f/, /b/ — Cumulative 19-letter set.
- **Group 4:** /j/, /z/, /w/, /v/, /y/, /ks/ (x), /kw/ (qu) — Note x = /ks/ and q taught as "qu" = /kw/. Full alphabet.

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | Introduce letter sounds for this group |
| `[PRONOUNCE_SOUND]` | Phoneme needs pronunciation | Say ONLY the clean phoneme sound — no letter name, no "uh" |
| `[SAY_KEYWORD]` | Keyword association | Say "[sound] as in [keyword]" (e.g., "/s/ as in sun") |
| `[TAP_OPTION]` | Student taps an option to hear it | Say just that sound, nothing else |
| `[ANSWER_CORRECT]` | Correct | "Yes! The letter [letter] makes the sound [sound]!" |
| `[ANSWER_INCORRECT]` | Incorrect | "That sound is [wrong sound]. The letter [letter] makes [correct sound], like in [keyword]." |
| `[NEXT_CHALLENGE]` | Next challenge | Present the new letter or sound |
| `[NEW_SOUND_INTRO]` | First encounter with a new letter-sound | "This letter is [name], and it makes the sound [sound], like in [keyword]!" |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'Letter-sound correspondence activity. Group {{letterGroup}}. '
    + 'Mode: {{challengeMode}}. Target: letter "{{targetLetter}}" → sound {{targetSound}}. '
    + 'Keyword: "{{keywordWord}}". Challenge {{currentChallenge}}/{{totalChallenges}}. Attempts: {{attempts}}.',
  contextKeys: [
    'letterGroup', 'challengeMode', 'targetLetter', 'targetSound',
    'keywordWord', 'currentChallenge', 'totalChallenges', 'attempts',
    'sharedSoundLetters',
  ],
  scaffoldingLevels: {
    level1: '"What sound does this letter make? Think of a word that starts with it."',
    level2: '"This letter makes the sound... think of {{keywordWord}}. What sound does {{keywordWord}} start with?"',
    level3: '"The letter {{targetLetter}} makes the sound {{targetSound}}, like in {{keywordWord}}. Say it with me: {{targetSound}}!"',
  },
  commonStruggles: [
    { pattern: 'Saying the letter name instead of the sound', response: 'That\'s the letter NAME. We want the SOUND it makes. The letter S is named "ess" but it SOUNDS like /s/.' },
    { pattern: 'Adding "uh" to consonant sounds', response: 'Make the sound really short and crisp. Just /t/, not "tuh". Clip it off quickly!' },
    { pattern: 'Confusing short vowel sounds (e vs i)', response: 'For /ĕ/, think of "egg". For /ĭ/, think of "itch". They\'re different mouth shapes.' },
    { pattern: 'Confused by c and k making the same sound', response: 'C and K are best friends — they make the same sound! /k/ like in "cat" and "kite".' },
  ],
  aiDirectives: [
    {
      title: 'CLEAN SOUND PRODUCTION',
      instruction:
        'CRITICAL: When you receive [PRONOUNCE_SOUND] or [TAP_OPTION], produce ONLY the clean phoneme. '
        + 'Consonants must NOT have an "uh" added: say /t/ not "tuh", /s/ not "suh", /p/ not "puh". '
        + 'Vowels should be the short sound: /ă/ as in apple, /ĕ/ as in egg, /ĭ/ as in itch, /ŏ/ as in octopus, /ŭ/ as in up. '
        + 'No letter names, no extra words. Just the sound.',
    },
    {
      title: 'KEYWORD ASSOCIATIONS',
      instruction:
        'When you receive [SAY_KEYWORD], say the sound followed by "as in [keyword]". '
        + 'Example: "/s/ as in sun". Keep it brief.',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  letterGroup: 1 | 2 | 3 | 4,
  cumulativeLetters: string[],
  challenges: Array<{
    id: string,
    mode: 'see-hear' | 'hear-see' | 'keyword-match',
    targetLetter: string,
    targetSound: string,
    keywordWord: string,
    keywordImage: string,
    options?: Array<{ letter?: string, sound?: string, isCorrect: boolean }>,
    sharedSoundLetters?: string[],
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'letter-sound-link'`
- `letterGroup` (1 | 2 | 3 | 4)
- `challengesCorrect` / `challengesTotal`
- `graphemeToPhonemeAccuracy` (0-100)
- `phonemeToGraphemeAccuracy` (0-100)
- `vowelSoundAccuracy` (0-100)
- `consonantSoundAccuracy` (0-100)
- `confusedSoundPairs` (array of sounds confused)
- `attemptsCount`

**Subskills served:**
- ✅ Letter-Sound Group 1: s, a, t, i, p, n (Difficulty 2-4)
- ✅ Letter-Sound Group 2: c, k, e, h, r, m, d (Difficulty 3-5)
- ✅ Letter-Sound Group 3: g, o, u, l, f, b (Difficulty 4-6)
- ✅ Letter-Sound Group 4: j, z, w, v, y, x, q (Difficulty 4-6)

---

## NEW PRIMITIVE 7: `cvc-speller`

### CVC Word Encoding (Spelling from Audio)

**What it does:** Students hear a CVC word spoken by the AI tutor and must spell it by selecting the correct letters from a bank and placing them in three slots. Progression follows the five short vowels: short 'a' → short 'e' → short 'i' → short 'o' → short 'u'. The primitive presents a letter bank (limited to the student's cumulative letter set) and three empty slots. Students drag letters into slots or tap to select. The AI tutor provides corrective feedback for common errors, especially vowel confusion.

**Why it's needed:** Encoding (spelling) is the inverse of decoding (reading) and is a distinct skill. No existing primitive addresses spelling CVC words from audio. `spelling-pattern-explorer` teaches spelling *rules* for grades 1-6 but not the fundamental skill of hearing a word and producing its spelling. This is the writing-side counterpart to `phonics-blender`.

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor says the target word clearly via `[PRONOUNCE_WORD]`. Student can request "hear it again" which triggers `[REPEAT_WORD]`. A "stretch it" button triggers `[STRETCH_WORD]` for slow phoneme-by-phoneme pronunciation. After each letter placement, the AI can confirm the sound via `[CONFIRM_SOUND]`. Incorrect attempts get targeted feedback ("Listen again — the middle sound is /æ/ as in apple").
- **Visual:** Three empty letter slots (Elkonin box style). Letter bank with available letters. Color coding: consonants = blue tiles, vowels = red tiles. Correct letters snap into place with a glow. Wrong letters get a gentle shake.
- **Interactive:** Drag letters from bank to slots. Tap slot then tap letter to place. "Hear it again" button. "Stretch it" button for slow pronunciation.

**Vowel-specific progression:**

| Subskill | Focus Vowel | Example Words | Letter Bank |
|---|---|---|---|
| Short 'a' | /ă/ | cat, map, van, sad, tap, bag | Cumulative letters available at student's level |
| Short 'e' | /ĕ/ | hen, wet, leg, bed, pen, red | Same bank, increasing distractors |
| Short 'i' | /ĭ/ | pig, sit, fin, big, win, lip | Bank includes all short vowels for discrimination |
| Short 'o' | /ŏ/ | dog, hot, mop, log, top, pot | Mixed vowel challenges increase |
| Short 'u' | /ŭ/ | sun, bug, cup, mud, run, tub | Full short vowel discrimination required |

**Generator constraints:**
- Only use letters from the student's cumulative letter group
- Distractor letters in the bank should include visually or phonetically similar alternatives
- At short 'i' and beyond, include words from previously learned vowels to test discrimination
- Provide specific corrective feedback templates for common vowel confusion errors

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | "Let's spell some words! I'll say a word, and you pick the letters." |
| `[PRONOUNCE_WORD]` | New word to spell | Say the word clearly, nothing else |
| `[REPEAT_WORD]` | Student requests replay | Say the word again, clearly |
| `[STRETCH_WORD]` | Student requests slow pronunciation | Say the word stretched: "/k/... /æ/... /t/" |
| `[CONFIRM_SOUND]` | Student places a letter | Say the sound that letter makes (clean phoneme) |
| `[SPELLING_CORRECT]` | All 3 letters correct | "You spelled [word]! Great job!" + say the word |
| `[SPELLING_INCORRECT]` | Wrong letter placed | Targeted feedback based on which position is wrong (beginning/middle/end) |
| `[VOWEL_CONFUSION]` | Common vowel error detected | "Listen again — the middle sound is /[correct]/ as in [keyword], not /[wrong]/ as in [keyword]." |
| `[NEXT_WORD]` | Next word | Say the new word |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'CVC spelling activity. Vowel focus: {{vowelFocus}}. Letter group: {{letterGroup}}. '
    + 'Word {{currentChallenge}}/{{totalChallenges}}: "{{targetWord}}" ({{targetPhonemes}}). '
    + 'Student placed: {{placedLetters}}. Attempts: {{attempts}}.',
  contextKeys: [
    'vowelFocus', 'letterGroup', 'targetWord', 'targetPhonemes', 'targetLetters',
    'placedLetters', 'currentChallenge', 'totalChallenges', 'attempts',
  ],
  scaffoldingLevels: {
    level1: '"Say the word slowly. What sounds do you hear? Find those letters."',
    level2: '"{{targetWord}} starts with the sound {{firstPhoneme}}. Which letter makes that sound?"',
    level3: '"{{targetWord}} is spelled {{targetLetters}}. The sounds are {{targetPhonemes}}. Find each letter."',
  },
  commonStruggles: [
    { pattern: 'Vowel confusion (e.g., placing "e" instead of "a")', response: 'Listen to the middle sound. Is it /ă/ like apple or /ĕ/ like egg? They sound different.' },
    { pattern: 'Reversing letter order', response: 'What\'s the FIRST sound? That goes in the first box. Then the middle, then the last.' },
    { pattern: 'Cannot identify the medial vowel', response: 'Use the stretch button. Listen to the middle sound carefully. It\'s the loud sound in the middle.' },
  ],
  aiDirectives: [
    {
      title: 'PRONUNCIATION COMMANDS',
      instruction:
        'When you receive [PRONOUNCE_WORD] or [REPEAT_WORD], say the word clearly and naturally. '
        + 'When you receive [STRETCH_WORD], say each phoneme with a pause: "/k/... /æ/... /t/". '
        + 'When you receive [CONFIRM_SOUND], say just the clean phoneme for that letter. '
        + 'No extra commentary for any pronunciation command.',
    },
    {
      title: 'VOWEL CONFUSION FEEDBACK',
      instruction:
        'When you receive [VOWEL_CONFUSION], give specific corrective feedback comparing the two vowel sounds. '
        + 'Use keyword associations: /ă/ = apple, /ĕ/ = egg, /ĭ/ = itch, /ŏ/ = octopus, /ŭ/ = up. '
        + 'Say both sounds so the student can hear the difference.',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  vowelFocus: 'short-a' | 'short-e' | 'short-i' | 'short-o' | 'short-u',
  letterGroup: 1 | 2 | 3 | 4,
  availableLetters: string[],
  challenges: Array<{
    id: string,
    targetWord: string,
    targetLetters: string[],
    targetPhonemes: string[],
    imageDescription: string,
    distractorLetters: string[],
    commonErrors?: Array<{
      errorSpelling: string,
      feedback: string,
    }>,
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'cvc-speller'`
- `vowelFocus` ('short-a' | 'short-e' | 'short-i' | 'short-o' | 'short-u')
- `wordsSpelledCorrectly` / `wordsTotal`
- `vowelAccuracy` (0-100)
- `consonantAccuracy` (0-100)
- `commonErrors` (array of error patterns)
- `stretchUsed` (count of times slow pronunciation was requested)
- `attemptsCount`

**Subskills served:**
- ✅ Encode CVC words with Short 'a' (Difficulty 4-6)
- ✅ Encode CVC words with Short 'e' (Difficulty 4-6)
- ✅ Encode CVC words with Short 'i' (Difficulty 4-6)
- ✅ Encode CVC words with Short 'o' (Difficulty 4-6)
- ✅ Encode CVC words with Short 'u' (Difficulty 4-6)

---

## NEW PRIMITIVE 8: `word-workout`

### CVC Word Application Activities

**What it does:** A multi-mode primitive for applying CVC word knowledge in context. Four activity types: (1) **Real vs. Nonsense** — discriminate between real CVC words and phonetically plausible nonsense words, (2) **Picture Match** — match a CVC word to its illustration, (3) **Word Chains** — read a sequence of words where only one letter changes each step, (4) **Sentence Reading** — read short decodable phrases/sentences using mastered CVC words and sight words. Serves as the capstone assessment for CVC mastery.

**Why it's needed:** `phonics-blender` teaches decoding isolated words and `decodable-reader` provides passage-level reading, but there's a gap between them. Students need structured practice discriminating real from nonsense words (tests pure decoding vs. memorization), connecting decoded words to meaning (picture matching), building automaticity (word chains/fluency), and applying decoding in connected text (sentences).

**Multimodal features:**
- **AI Tutor Voice:** The AI tutor reads words and sentences aloud on request (student taps a word and the component sends `[PRONOUNCE]`). For word chains, the AI reads each word as the student progresses. For sentence reading, the AI can read the full sentence as a model via `[READ_SENTENCE]`. Timer/WPM tracking is handled by the component UI (no AI involvement needed for timing).
- **Visual:** Word cards with clear typography. Illustrations for picture matching. Word chain visualization with the changed letter highlighted. Sentence display with tappable words. Timer/WPM display for fluency mode.
- **Interactive:** Tap to select real/nonsense, tap matching picture, read word chains in sequence, tap words in sentences for AI pronunciation.

**Activity modes:**

| Mode | Task | Difficulty | Example |
|---|---|---|---|
| **Real vs. Nonsense** | "Which is a real word?" | 5-7 | "map" vs "mep" → tap "map". Minimal pairs: "cat" vs "cot" for vowel discrimination. |
| **Picture Match** | "Which picture matches this word?" | 5-7 | Word "sun" → choose from images of sun, bug, cat. Distractors are phonetically similar (pin, pen, pan). |
| **Word Chains** | "Read each word as it changes" | 6-8 | cat → mat → man → pan → pin → fin. One letter changes each step. |
| **Sentence Reading** | "Read this sentence" | 5-7 | "The cat sat on the mat." Uses only mastered CVC words + sight words. |

**Generator constraints:**
- **Real vs. Nonsense:** Nonsense words must be phonetically plausible CVC patterns (e.g., "zot", "keg", "sib"). Never use unpronounceable combinations. Start with very different pairs; increase difficulty with minimal pairs.
- **Picture Match:** Distractor images must be other *mastered* CVC words. Increase difficulty by making distractors phonetically similar.
- **Word Chains:** Must follow the one-letter-change rule. Chain length: 4-8 words.
- **Sentence Reading:** ONLY use mastered CVC words + approved sight words: a, the, is, on, in, it, did, see, I, and, can, we, my, to, go, no, do, he, she.

**Pedagogical moments (sendText tags):**

| Tag | When | AI Should... |
|---|---|---|
| `[ACTIVITY_START]` | Activity loads | Introduce the activity mode |
| `[PRONOUNCE]` | Student taps a word | Say just the word, nothing else |
| `[READ_SENTENCE]` | Model sentence reading | Read the sentence fluently, nothing else |
| `[ANSWER_CORRECT]` | Correct answer | Brief celebration + reinforce |
| `[ANSWER_INCORRECT]` | Wrong answer | Mode-specific hint (real/nonsense: "Try sounding both out"; picture match: "Read the word again carefully") |
| `[CHAIN_WORD]` | Student reaches next word in chain | Say the word; optionally point out what changed |
| `[NEXT_CHALLENGE]` | Next challenge | Introduce it |
| `[SESSION_COMPLETE]` | All done | Celebrate, summarize performance |

**Tutoring scaffold (catalog entry):**

```typescript
tutoring: {
  taskDescription:
    'CVC word application activity. Mode: {{mode}}. '
    + 'Challenge {{currentChallenge}}/{{totalChallenges}}. '
    + 'Mastered vowels: {{masteredVowels}}. Phase: {{currentPhase}}. Attempts: {{attempts}}.',
  contextKeys: [
    'mode', 'currentChallenge', 'totalChallenges', 'masteredVowels',
    'currentPhase', 'attempts',
  ],
  scaffoldingLevels: {
    level1:
      'REAL/NONSENSE: "Sound out both words. Which one is a word you know?" '
      + 'PICTURE MATCH: "Read the word, then look at each picture." '
      + 'WORD CHAINS: "Read each word. What letter changed?" '
      + 'SENTENCES: "Try reading the sentence. Tap any word you need help with."',
    level2:
      'REAL/NONSENSE: "One of these makes sense and one is a silly made-up word. Sound them out." '
      + 'PICTURE MATCH: "What sounds do you hear in the word? Which picture matches those sounds?" '
      + 'WORD CHAINS: "The word changed from [old] to [new]. What\'s different?" '
      + 'SENTENCES: "Start with the first word. Sound it out. Then the next one."',
    level3:
      'REAL/NONSENSE: "The real word is one you\'ve seen before or that means something. The nonsense word is just sounds." '
      + 'PICTURE MATCH: "The word says [word]. Can you find the picture of a [word]?" '
      + 'WORD CHAINS: "In [old word], we changed the [position] letter from [old] to [new] to make [new word]." '
      + 'SENTENCES: "Let me read it first, then you try."',
  },
  commonStruggles: [
    { pattern: 'Cannot distinguish real from nonsense', response: 'Sound out each word slowly. Does it mean something? Is it a thing you know?' },
    { pattern: 'Picking picture by phonetic similarity, not meaning', response: 'Read the word one more time. What does it mean? Now find that picture.' },
    { pattern: 'Getting stuck in word chains', response: 'Just one letter changed! Look at the word above — what\'s different?' },
    { pattern: 'Cannot read sentences fluently', response: 'Read one word at a time. Don\'t rush. Tap any word you need help with.' },
  ],
  aiDirectives: [
    {
      title: 'PRONUNCIATION COMMANDS',
      instruction:
        'When you receive [PRONOUNCE], say ONLY the requested word. No extra commentary. '
        + 'When you receive [READ_SENTENCE], read the sentence fluently and naturally. No extra commentary. '
        + 'When you receive [CHAIN_WORD], say the word and optionally add a brief note about what changed '
        + '(e.g., "mat — we changed the first letter!").',
    },
  ],
},
```

**Generator schema (simplified):**
```
{
  title: string,
  mode: 'real-vs-nonsense' | 'picture-match' | 'word-chains' | 'sentence-reading',
  masteredVowels: string[],
  challenges: Array<{
    id: string,
    realWord?: string,
    nonsenseWord?: string,
    targetWord?: string,
    targetImage?: string,
    distractorImages?: Array<{ word: string, image: string }>,
    chain?: string[],
    changedPositions?: number[],
    sentence?: string,
    cvcWords?: string[],
    sightWords?: string[],
    comprehensionQuestion?: string,
    comprehensionAnswer?: string,
  }>
}
```

**Evaluable:** Yes.

**Evaluation metrics:**
- `type: 'word-workout'`
- `mode` ('real-vs-nonsense' | 'picture-match' | 'word-chains' | 'sentence-reading')
- `challengesCorrect` / `challengesTotal`
- `realVsNonsenseAccuracy` (0-100)
- `pictureMatchAccuracy` (0-100)
- `wordChainFluency` (words per minute in chain reading)
- `sentenceComprehensionCorrect` (boolean)
- `wordsReadIndependently` / `wordsTotal`
- `attemptsCount`

**Subskills served:**
- ✅ Discriminate between Real & Nonsense CVC Words (Difficulty 5-7)
- ✅ Match CVC Words to Pictures (Difficulty 5-7)
- ✅ Build Fluency with CVC Word Lists & Chains (Difficulty 6-8)
- ✅ Read CVC Words in Decodable Phrases & Sentences (Difficulty 5-7)

---

## ENHANCEMENTS TO EXISTING PRIMITIVES

### Enhancement 1: `phonics-blender` — Add Vowel-Specific CVC Mode

**Current state:** Generates CVC words with mixed short vowels. No way to filter by specific vowel.

**Enhancement:** Add a `vowelFocus` parameter to the generator schema and prompt.

```
// New schema properties:
vowelFocus?: 'short-a' | 'short-e' | 'short-i' | 'short-o' | 'short-u' | 'mixed',
```

When `vowelFocus` is set, the generator produces CVC words using only that short vowel. When set to 'mixed', it generates words across all five short vowels (current behavior).

**Subskills served (with enhancement):**
- ✅ Decode CVC words with Short 'a' (Difficulty 3-5)
- ✅ Decode CVC words with Short 'e' (Difficulty 3-5)
- ✅ Decode CVC words with Short 'i' (Difficulty 3-5)
- ✅ Decode CVC words with Short 'o' (Difficulty 3-5)
- ✅ Decode CVC words with Short 'u' (Difficulty 3-5)
- ✅ Decode CVC words with Mixed Short Vowels (Difficulty 3-5)
- ✅ Blend three phonemes into a CVC word (Difficulty 3-7) — already supported

### Enhancement 2: `letter-tracing` — Add Generator + Group Progression

**Current state:** Display-only component with stroke order visualization. No Gemini generator. No group-based progression.

**Enhancement:** Create a generator (`gemini-letter-tracing.ts`) that produces challenges following the cumulative group progression. Add a `tutoring` scaffold so the AI tutor can guide stroke formation ("Start at the top and go down!"). Generator selects letters from the cumulative set with higher weight on newly introduced letters.

**Tutoring scaffold:**

```typescript
tutoring: {
  taskDescription:
    'Letter formation activity. Group {{letterGroup}}. '
    + 'Letter: {{currentLetter}} ({{letterCase}}). '
    + 'Challenge {{currentChallenge}}/{{totalChallenges}}.',
  contextKeys: ['letterGroup', 'currentLetter', 'letterCase', 'currentChallenge', 'totalChallenges'],
  scaffoldingLevels: {
    level1: '"Look at the arrows. They show you where to start and which way to go."',
    level2: '"Start at the dot. Follow the arrows with your finger first, then try writing it."',
    level3: '"To write {{currentLetter}}, start here [describe starting position] and go [describe stroke direction]."',
  },
  commonStruggles: [
    { pattern: 'Starting at wrong point', response: 'Always start at the dot! That\'s where every letter begins.' },
    { pattern: 'Wrong stroke direction', response: 'Follow the arrows. They show you which way to move your pencil.' },
    { pattern: 'Reversing the letter', response: 'Remember: [specific letter reversal tip]' },
  ],
},
```

**Subskills served (with enhancement):**
- ✅ Letter Formation Group 1: s, a, t, i, p, n (Difficulty 3-5)
- ✅ Letter Formation Group 2: c, k, e, h, r, m, d (Difficulty 4-6)
- ✅ Letter Formation Group 3: g, o, u, l, f, b (Difficulty 4-6)
- ✅ Letter Formation Group 4: j, z, w, v, y, x, q (Difficulty 4-6)

### Enhancement 3: `decodable-reader` — Add Vowel-Specific Passage Control

**Current state:** Generates controlled-vocabulary passages but doesn't filter by specific vowel pattern.

**Enhancement:** Add `vowelFocus` parameter. When set, the passage primarily uses CVC words with the specified vowel plus previously mastered vowels and sight words. This supports the "Read CVC Words in Decodable Phrases & Sentences" subskill alongside `word-workout`'s sentence reading mode.

---

## Complete Coverage Matrix

| Skill Area | Subskill | Primitive | Mode |
|---|---|---|---|
| **Rhyme Recognition & Production** | Recognize if two words rhyme | `rhyme-studio` | recognition |
| | Identify rhyming word from a set | `rhyme-studio` | identification |
| | Produce a rhyming word | `rhyme-studio` | production |
| **Syllable Segmentation** | Segment 2-3 syllable words | `syllable-clapper` | — |
| **Onset-Rime** | Blend onset and rime | `phoneme-explorer` | onset-rime-blend |
| | Isolate onset and rime | `phoneme-explorer` | onset-rime-isolate |
| **Phoneme Isolation** | Beginning sound | `phoneme-explorer` | beginning-sound |
| | Ending sound | `phoneme-explorer` | ending-sound |
| | Medial sound | `phoneme-explorer` | medial-sound |
| **Phoneme Blending** | Blend 3 phonemes into CVC | `phonics-blender` *(existing)* | cvc |
| **Phoneme Segmentation** | Segment CVC into 3 phonemes | `phoneme-explorer` | full-segmentation |
| **Phoneme Manipulation** | Add a phoneme | `sound-swap` | addition |
| | Delete a phoneme | `sound-swap` | deletion |
| | Substitute a phoneme | `sound-swap` | substitution |
| **Letter Recognition** | Group 1: s, a, t, i, p, n | `letter-spotter` | Group 1 |
| | Group 2: + c, k, e, h, r, m, d | `letter-spotter` | Group 2 |
| | Group 3: + g, o, u, l, f, b | `letter-spotter` | Group 3 |
| | Group 4: + j, z, w, v, y, x, q | `letter-spotter` | Group 4 |
| **Letter-Sound Correspondence** | Group 1: /s/, /ă/, /t/, /ĭ/, /p/, /n/ | `letter-sound-link` | Group 1 |
| | Group 2: /k/, /ĕ/, /h/, /r/, /m/, /d/ | `letter-sound-link` | Group 2 |
| | Group 3: /g/, /ŏ/, /ŭ/, /l/, /f/, /b/ | `letter-sound-link` | Group 3 |
| | Group 4: /j/, /z/, /w/, /v/, /y/, /ks/, /kw/ | `letter-sound-link` | Group 4 |
| **Letter Formation** | Groups 1-4 | `letter-tracing` *(enhanced)* | Group 1-4 |
| **Decoding CVC** | Short 'a' through Mixed | `phonics-blender` *(enhanced)* | vowelFocus |
| **Encoding CVC** | Short 'a' through Short 'u' | `cvc-speller` | vowel-specific |
| **CVC Application** | Real vs. Nonsense | `word-workout` | real-vs-nonsense |
| | Picture Match | `word-workout` | picture-match |
| | Word Chains / Fluency | `word-workout` | word-chains |
| | Sentence Reading | `word-workout` | sentence-reading |

**Total subskills: 41 | Covered: 41 (100%)**

---

## File Inventory

### New Files (per primitive: component + generator = 2 files)

| # | Primitive | Component File | Generator File |
|---|---|---|---|
| 1 | `rhyme-studio` | `primitives/visual-primitives/literacy/RhymeStudio.tsx` | `service/literacy/gemini-rhyme-studio.ts` |
| 2 | `syllable-clapper` | `primitives/visual-primitives/literacy/SyllableClapper.tsx` | `service/literacy/gemini-syllable-clapper.ts` |
| 3 | `phoneme-explorer` | `primitives/visual-primitives/literacy/PhonemeExplorer.tsx` | `service/literacy/gemini-phoneme-explorer.ts` |
| 4 | `sound-swap` | `primitives/visual-primitives/literacy/SoundSwap.tsx` | `service/literacy/gemini-sound-swap.ts` |
| 5 | `letter-spotter` | `primitives/visual-primitives/literacy/LetterSpotter.tsx` | `service/literacy/gemini-letter-spotter.ts` |
| 6 | `letter-sound-link` | `primitives/visual-primitives/literacy/LetterSoundLink.tsx` | `service/literacy/gemini-letter-sound-link.ts` |
| 7 | `cvc-speller` | `primitives/visual-primitives/literacy/CVCSpeller.tsx` | `service/literacy/gemini-cvc-speller.ts` |
| 8 | `word-workout` | `primitives/visual-primitives/literacy/WordWorkout.tsx` | `service/literacy/gemini-word-workout.ts` |

### New Generator Files

| # | File |
|---|---|
| 9 | `service/literacy/gemini-letter-tracing.ts` (new generator for existing primitive) |

### Existing Files Modified

| File | Changes |
|---|---|
| `types.ts` | Add 8 new ComponentIds to union |
| `config/primitiveRegistry.tsx` | Add 8 registry entries |
| `evaluation/types.ts` | Add 8 metrics interfaces + union members |
| `evaluation/index.ts` | Export new metrics types |
| `service/manifest/catalog/literacy.ts` | Add 8 catalog entries **with tutoring scaffolds** |
| `service/registry/generators/literacyGenerators.ts` | Register 9 generators (8 new + letter-tracing) |
| `service/literacy/gemini-phonics-blender.ts` | Add `vowelFocus` parameter |
| `service/literacy/gemini-decodable-reader.ts` | Add `vowelFocus` parameter |

**Total: 17 new files + 8 existing file modifications.**

---

## AI Tutor Integration Pattern

### How Audio Works in These Primitives

All of these primitives are **audio-heavy** — kindergarteners can't read instructions and need to hear words/sounds to practice phonological awareness. Here's how the AI tutor voice replaces direct TTS:

```
┌──────────────────────────────────────────────────────┐
│  Component (e.g., PhonemeExplorer.tsx)                │
│                                                      │
│  1. Challenge loads: new word "cat"                   │
│     → sendText('[PRONOUNCE] Say "cat"', {silent:true})│
│                                                      │
│  2. Student taps option "/k/"                        │
│     → sendText('[TAP_OPTION] Say /k/', {silent:true})│
│                                                      │
│  3. Student answers correctly                        │
│     → sendText('[ANSWER_CORRECT] Student found /k/   │
│       as the beginning sound of "cat" on attempt 1.  │
│       Celebrate briefly.', {silent:true})             │
│                                                      │
│  4. State changes (phase, score, etc.)               │
│     → updateContext() [silent — AI absorbs, no speech]│
└─────────────┬────────────────────────────────────────┘
              │ WebSocket
              ▼
┌──────────────────────────────────────────────────────┐
│  Gemini Live AI Tutor (lumina_tutor.py)              │
│                                                      │
│  System prompt includes:                             │
│  - Tutoring scaffold from catalog                    │
│  - Runtime state from contextKeys                    │
│  - aiDirectives (e.g., clean sound production)       │
│                                                      │
│  Responds with speech:                               │
│  1. "cat" (clean pronunciation)                      │
│  2. "/k/" (clean phoneme)                            │
│  3. "Yes! /k/ is the first sound in cat! Great ears!"│
└──────────────────────────────────────────────────────┘
```

### Key Principles

1. **The component decides WHEN the AI speaks** — via `sendText` at pedagogical moments.
2. **The catalog decides HOW the AI speaks** — via `tutoring.scaffoldingLevels`, `commonStruggles`, and `aiDirectives`.
3. **The AI decides WHAT exactly to say** — using the scaffold as guidelines, not scripts. This gives natural, varied responses.
4. **`updateContext()` is for silent sync** — phase changes, score updates, etc. The AI absorbs the info but doesn't respond.
5. **`[PRONOUNCE]` tags demand brevity** — the `aiDirective` must instruct the AI to say ONLY the sound/word with no commentary. This is critical for sound tiles, letter sounds, and word pronunciation.

### Common `aiDirective` Patterns Across Primitives

**Clean Phoneme Production** (used by `phoneme-explorer`, `letter-sound-link`, `cvc-speller`, `sound-swap`, `phonics-blender`):
```typescript
{
  title: 'CLEAN SOUND PRODUCTION',
  instruction:
    'When you receive [PRONOUNCE] for a phoneme, produce ONLY the clean sound. '
    + 'Consonants: /t/ not "tuh", /s/ not "suh", /p/ not "puh". '
    + 'Vowels: /ă/ as in apple, /ĕ/ as in egg, /ĭ/ as in itch, /ŏ/ as in octopus, /ŭ/ as in up.',
}
```

**Stretched Word Pronunciation** (used by `phoneme-explorer`, `cvc-speller`):
```typescript
{
  title: 'STRETCHED PRONUNCIATION',
  instruction:
    'When you receive [STRETCH_WORD], say the word with each phoneme separated by a pause: '
    + '"/k/... /æ/... /t/" stretching each sound slightly.',
}
```

---

## Implementation Priority

### Wave 1 — Alphabet Foundation (enables everything else)

| Primitive | Rationale |
|---|---|
| `letter-spotter` | Letter recognition is the #1 predictor of kindergarten reading success. Gate for all other skills. |
| `letter-sound-link` | Bridge from letter recognition to phonics. Must come before decoding/encoding. |
| `letter-tracing` (enhanced) | Generator + group progression + tutoring scaffold. Low complexity enhancement. |

### Wave 2 — Phonological Awareness Core

| Primitive | Rationale |
|---|---|
| `rhyme-studio` | Earliest phonological awareness skill. High engagement, concrete task. |
| `syllable-clapper` | Second step in PA hierarchy. Simple interaction model. |
| `phoneme-explorer` | Covers 6 subskills. Critical bridge to blending/decoding. |

### Wave 3 — Decoding & Encoding

| Primitive | Rationale |
|---|---|
| `phonics-blender` (enhanced) | Vowel-specific mode enables structured CVC decoding progression. Low-effort enhancement. |
| `cvc-speller` | Encoding counterpart to decoding. Uses same letter tiles interaction pattern. |

### Wave 4 — Advanced PA & Application

| Primitive | Rationale |
|---|---|
| `sound-swap` | Most advanced PA skill. Requires solid phoneme isolation/segmentation foundation. |
| `word-workout` | Capstone application primitive. Best after students have basic decoding/encoding. |
| `decodable-reader` (enhanced) | Vowel-specific passages. Low-effort enhancement. |

---

## Cross-Primitive Learning Paths

### The Phonological Awareness Path
```
rhyme-studio → syllable-clapper → phoneme-explorer (onset-rime) → phoneme-explorer (isolation)
                                                                          ↓
                              sound-swap (manipulation) ← phoneme-explorer (segmentation) ← phonics-blender (blending)
```

### The Alphabet Path
```
letter-spotter (Group 1) → letter-sound-link (Group 1) → letter-tracing (Group 1)
         ↓                          ↓                             ↓
letter-spotter (Group 2) → letter-sound-link (Group 2) → letter-tracing (Group 2)
         ↓                          ↓                             ↓
      ... Group 3 → ... Group 3 → ... Group 3
         ↓                          ↓                             ↓
      ... Group 4 → ... Group 4 → ... Group 4
```

### The Word-Building Path (Alphabet + PA converge)
```
letter-sound-link + phonics-blender → CVC Decoding (phonics-blender + vowelFocus)
                                            ↓
                                      cvc-speller (encoding)
                                            ↓
                                      word-workout (application)
                                            ↓
                                      decodable-reader (connected text)
```

### The Complete K Sequence
```
1. letter-spotter (G1)           ← Know the letters
2. letter-sound-link (G1)        ← Know their sounds
3. letter-tracing (G1)           ← Write them
4. rhyme-studio                  ← Hear word patterns
5. syllable-clapper              ← Break words into parts
6. phoneme-explorer (onset-rime) ← Hear onset + rime
7. phoneme-explorer (isolation)  ← Isolate individual sounds
8. phonics-blender (short a)     ← Blend sounds into words
9. cvc-speller (short a)         ← Spell words from sounds
10. [Repeat 1-3 for Groups 2-4, 8-9 for remaining vowels]
11. phoneme-explorer (segmentation) ← Break words into all sounds
12. sound-swap                      ← Manipulate sounds
13. word-workout                    ← Apply all CVC knowledge
14. decodable-reader                ← Read connected text
```

---

## Shared Infrastructure & Patterns

### Elkonin Boxes (Sound Boxes) Shared Component

Used by `phoneme-explorer`, `cvc-speller`, and potentially `phonics-blender`:

```typescript
// Shared visual component for phoneme boxes
interface ElkoninBoxesProps {
  boxCount: number;
  filledPhonemes: string[];
  highlightPosition?: 'beginning' | 'middle' | 'end';
  interactive: boolean;
  onPhonemePlaced?: (position: number, phoneme: string) => void;
  onBoxTapped?: (position: number) => void; // Triggers sendText('[PRONOUNCE]...')
}
```

### Cumulative Letter Group Constants

Used by `letter-spotter`, `letter-sound-link`, `letter-tracing`, `cvc-speller`:

```typescript
export const LETTER_GROUPS = {
  1: { new: ['s', 'a', 't', 'i', 'p', 'n'], cumulative: ['s', 'a', 't', 'i', 'p', 'n'] },
  2: { new: ['c', 'k', 'e', 'h', 'r', 'm', 'd'], cumulative: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd'] },
  3: { new: ['g', 'o', 'u', 'l', 'f', 'b'], cumulative: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b'] },
  4: { new: ['j', 'z', 'w', 'v', 'y', 'x', 'q'], cumulative: ['s', 'a', 't', 'i', 'p', 'n', 'c', 'k', 'e', 'h', 'r', 'm', 'd', 'g', 'o', 'u', 'l', 'f', 'b', 'j', 'z', 'w', 'v', 'y', 'x', 'q'] },
};

export const APPROVED_SIGHT_WORDS = ['a', 'the', 'is', 'on', 'in', 'it', 'did', 'see', 'I', 'and', 'can', 'we', 'my', 'to', 'go', 'no', 'do', 'he', 'she'];
```

### Multi-Phase Hook Compatibility

All 8 new primitives should use the shared multi-phase hooks (`useChallengeProgress`, `usePhaseResults`, `useMultiPhaseEvaluation`) from `my-tutoring-app/src/components/lumina/hooks/`. Each primitive follows the standard Explore → Practice → Apply phase pattern.

### `useLuminaAI` Integration

Every primitive must integrate with the AI tutor via the `useLuminaAI` hook:

```typescript
const { sendText, updateContext } = useLuminaAI({
  primitiveType: 'letter-sound-link',
  instanceId: resolvedInstanceId,
  primitiveData: aiPrimitiveData,  // Updates trigger silent updateContext()
  gradeLevel,
});

// Pedagogical moments → sendText (AI speaks)
sendText('[PRONOUNCE_SOUND] Say the sound /s/ clearly.', { silent: true });

// Background state sync → updateContext (AI silent)
// Happens automatically when primitiveData changes
```

---

## Open Questions

1. **Phoneme notation:** Should we use IPA (/æ/, /ɪ/, /ɛ/) or simplified teacher notation (/ă/, /ĭ/, /ĕ/) in the UI? IPA is more precise but unfamiliar to most parents/teachers. Recommend teacher notation for display, IPA internally.

2. **Letter-tracing interactivity:** The current `letter-tracing` component shows stroke order but doesn't capture actual drawing input. Should Wave 1 add canvas-based tracing (high effort) or stay with the guided display + generator enhancement (low effort)?

3. **Adaptive vowel progression:** When `cvc-speller` and `phonics-blender` use vowel-specific modes, should the system auto-advance through vowels based on mastery, or should the curriculum engine control this? Recommend curriculum engine control via the existing competency system.

4. **Nonsense word generation for `word-workout`:** Should we maintain a curated list of phonetically plausible nonsense words, or let Gemini generate them? Curated lists are safer (no accidentally inappropriate combinations) but less flexible. Recommend a curated base list that Gemini can extend with constraints.

5. **AI tutor response latency:** These primitives are audio-heavy — kindergarteners need to hear every word/sound. With `sendText` going through WebSocket → Gemini → speech, there will be latency on every pronunciation request. If latency is too high for rapid sound tile tapping, we may need a hybrid approach: pre-generated audio for common phonemes + AI tutor for conversational responses. This needs testing.

6. **`[PRONOUNCE]` reliability:** The AI must produce clean, isolated sounds without commentary for `[PRONOUNCE]` tags. If Gemini inconsistently adds commentary despite the `aiDirective`, we may need stricter prompt engineering or a fallback pronunciation system. Test with `phonics-blender`'s existing `[PRONOUNCE]` directive as baseline.
