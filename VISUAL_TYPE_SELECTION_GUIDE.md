# Visual Type Selection Guide for Live Interaction Problems

Quick reference for choosing the correct `visual_type` when generating live_interaction problems.

## Decision Tree

```
Is the interaction mode "click"?
│
├─ YES → Are students clicking to SELECT an answer/option?
│   │
│   ├─ YES → Use "card-grid"
│   │   Examples:
│   │   • Yes/No questions
│   │   • Multiple choice (A, B, C, D)
│   │   • Letter selection (click the letter A)
│   │   • Word selection (click the word that rhymes)
│   │
│   └─ NO → Are students clicking on items IN a scene?
│       └─ Use "object-collection" or "comparison-panel"
│           Examples:
│           • Click on all the red apples
│           • Click the taller tower
│
└─ NO → What is the interaction mode?
    │
    ├─ "speech" → Choose based on what student describes
    │   • "letter-picture": Describing letter sounds
    │   • "rhyming-pairs": Describing rhyming words
    │   • "object-collection": Counting or describing objects
    │
    ├─ "drag" → Use visuals with draggable elements
    │   • "object-collection": Drag items to group them
    │   • Future: Custom drag-and-drop schemas
    │
    └─ "trace" → Use tracing-specific visuals
        • "letter-tracing": Trace letter shapes
        • Future: Number tracing, shape tracing
```

## Common Patterns

### Pattern 1: Binary Choice (Yes/No)
**Scenario**: Student clicks to choose between two options
**Visual Type**: `card-grid`
**Example**:
```json
{
  "visual_intent": {
    "visual_type": "card-grid",
    "visual_purpose": "Display two cards: 'Yes' and 'No'"
  },
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_yes", "is_correct": true},
      {"id": "card_no", "is_correct": false}
    ]
  }
}
```

### Pattern 2: Multiple Choice Selection
**Scenario**: Student clicks to choose from 3-4 options
**Visual Type**: `card-grid`
**Example**:
```json
{
  "visual_intent": {
    "visual_type": "card-grid",
    "visual_purpose": "Display four letter cards: A, B, C, D"
  },
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_A", "is_correct": true},
      {"id": "card_B", "is_correct": false},
      {"id": "card_C", "is_correct": false},
      {"id": "card_D", "is_correct": false}
    ]
  }
}
```

### Pattern 3: Rhyming Assessment (Display + Speech)
**Scenario**: Student sees rhyming pairs and speaks their answer
**Visual Type**: `rhyming-pairs`
**Example**:
```json
{
  "visual_intent": {
    "visual_type": "rhyming-pairs",
    "visual_purpose": "Display fan and pan with connecting lines showing they rhyme"
  },
  "interaction_config": {
    "mode": "speech",
    "targets": []  // Speech interaction doesn't need clickable targets
  }
}
```

### Pattern 4: Letter Recognition (Click on Letter)
**Scenario**: Student clicks on a specific letter from choices
**Visual Type**: `card-grid` (NOT letter-picture)
**Example**:
```json
{
  "visual_intent": {
    "visual_type": "card-grid",
    "visual_purpose": "Display letter cards: A, B, C for student to select letter A"
  },
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_A", "is_correct": true},
      {"id": "card_B", "is_correct": false},
      {"id": "card_C", "is_correct": false}
    ]
  }
}
```

### Pattern 5: Initial Sound Matching (Click on Picture)
**Scenario**: Student clicks on picture that starts with a sound
**Visual Type**: `card-grid` with images
**Example**:
```json
{
  "visual_intent": {
    "visual_type": "card-grid",
    "visual_purpose": "Display image cards: Apple, Ball, Cat - student clicks Apple for 'A' sound"
  },
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_apple", "is_correct": true},
      {"id": "card_ball", "is_correct": false},
      {"id": "card_cat", "is_correct": false}
    ]
  }
}
```

## Visual Type Reference

### card-grid
- **Use for**: Clickable choices/options (any selectable card)
- **Interaction modes**: `click`
- **Schema fields**: `cards` array with `id`, `content_type`, `primary_value`
- **Target IDs**: Must match card IDs exactly

### letter-picture
- **Use for**: Displaying letter-sound associations (NOT for clicking cards)
- **Interaction modes**: `speech`, display-only
- **Schema fields**: `letter`, `items` array with letter-related images
- **Target IDs**: Item names or indices (not card IDs)

### rhyming-pairs
- **Use for**: Showing rhyming relationships visually
- **Interaction modes**: `speech`, display-only
- **Schema fields**: `pairs` array with `word1`, `word2`, connecting lines
- **Target IDs**: N/A (typically not clickable)

### object-collection
- **Use for**: Showing countable objects or items to identify
- **Interaction modes**: `click` (on items), `speech` (describe/count)
- **Schema fields**: `items` array with `name`, `count`, `icon`
- **Target IDs**: Item names or indices

### comparison-panel
- **Use for**: Side-by-side comparison of two groups
- **Interaction modes**: `click` (on panel), `speech` (describe)
- **Schema fields**: `panels` array (2 items) with labels and collections
- **Target IDs**: Panel identifiers or item references

## Anti-Patterns to Avoid

### ❌ WRONG: Using rhyming-pairs for clickable Yes/No
```json
{
  "visual_type": "rhyming-pairs",  // ❌ This doesn't have clickable cards
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_yes", "is_correct": true}  // ❌ rhyming-pairs has no card_yes
    ]
  }
}
```

### ✅ CORRECT: Using card-grid for clickable Yes/No
```json
{
  "visual_type": "card-grid",  // ✅ Has clickable cards
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_yes", "is_correct": true}  // ✅ card-grid will have this ID
    ]
  }
}
```

### ❌ WRONG: Using letter-picture for clicking letter cards
```json
{
  "visual_type": "letter-picture",  // ❌ This shows letter-sound images, not selectable cards
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_A", "is_correct": true}  // ❌ letter-picture doesn't have card_A
    ]
  }
}
```

### ✅ CORRECT: Using card-grid for clicking letter cards
```json
{
  "visual_type": "card-grid",  // ✅ Can create letter cards
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_A", "is_correct": true}  // ✅ card-grid will create this
    ]
  }
}
```

## Key Principle

**If the student needs to CLICK on separate CHOICES/OPTIONS → Use `card-grid`**

All other visual types are for:
- Displaying information (no clicking)
- Clicking on items within a scene (not separate choice cards)
- Speech-based interactions (describing what's shown)
