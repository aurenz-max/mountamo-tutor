# Live Interaction Visual Generation Fix

## Problem Identified

The live_interaction problem type was generating problems with incorrect visual type selection. Specifically:
- Problems requesting clickable Yes/No cards were using `visual_type: "rhyming-pairs"`
- The `interaction_config.targets` referenced card IDs like `"card_A"` and `"card_B"`
- But the `rhyming-pairs` schema doesn't have a card structure with those IDs
- This caused a mismatch between what the interaction expected and what the visual provided

## Root Cause

1. **Unclear Visual Selection Guidance**: The prompt guidance for live_interaction didn't clearly specify when to use `card-grid` vs other visual types
2. **Missing Visual Context**: The visual generation phase wasn't receiving enough context about the interaction configuration (targets, mode) to generate matching visuals
3. **Insufficient Schema Documentation**: The `CARD_GRID_SCHEMA` didn't have detailed descriptions explaining how IDs must match targets

## Changes Made

### 1. Enhanced Visual Selection Guidance ([problems.py:645-672](backend/app/services/problems.py#L645-L672))

Updated `_get_visual_guidance_for_type()` for live_interaction to clearly specify:

**FOR CLICK INTERACTIONS** (mode: "click"):
- Use `"card-grid"` for clickable choices (Yes/No, multiple choice, letter selection)
- Set clear visual_purpose describing the cards needed
- Targets in interaction_config MUST reference card IDs

**FOR VISUAL DISPLAY WITH INTERACTION**:
- Use `"letter-picture"` for letter-sound matching with images
- Use `"rhyming-pairs"` for showing rhyming word pairs with connecting lines (NOT clickable cards)
- Use `"object-collection"` for showing items to count/identify
- Use `"comparison-panel"` for side-by-side comparisons

### 2. Enhanced Visual Generation Prompt ([problems.py:145-166](backend/app/services/problems.py#L145-L166))

Added live_interaction-specific context to the visual generation prompt:

```python
if problem.get('problem_type') == 'live_interaction':
    interaction_config = problem.get('interaction_config', {})
    targets = interaction_config.get('targets', [])
    mode = interaction_config.get('mode', 'unknown')

    # Include in prompt:
    # - Interaction mode (click, speech, drag, trace)
    # - Number of targets
    # - Exact target IDs that MUST exist in visual
    # - For card-grid: explicit card creation requirements
    # - The instruction from the problem prompt
```

This ensures the visual generator has ALL the data it needs to create matching visuals.

### 3. Improved CARD_GRID_SCHEMA Documentation ([content_schemas.py:532-598](backend/app/generators/content_schemas.py#L532-L598))

Enhanced the schema with detailed descriptions:

**`id` field**: Explains it MUST match interaction_config.targets IDs
**`content_type` field**: Clarifies text vs image vs image_with_label usage
**`primary_value` field**: Specifies what to put for each content_type
**`label` field**: Explains when it's required vs optional
**`cards` array**: Includes example JSON and critical matching requirements

## Expected Behavior After Fix

### Phase 1: Problem Generation (with visual intent)

LLM generates live_interaction problem:
```json
{
  "problem_type": "live_interaction",
  "prompt": {
    "instruction": "Do 'fan' and 'pan' rhyme? Click Yes or No."
  },
  "visual_intent": {
    "needs_visual": true,
    "visual_type": "card-grid",  // ✅ Correct type for click interaction
    "visual_purpose": "Display two cards: 'Yes' and 'No' for student to click",
    "visual_id": "q_1"
  },
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_A", "is_correct": true},
      {"id": "card_B", "is_correct": false}
    ]
  }
}
```

### Phase 2: Visual Generation

Visual generator receives enhanced prompt with:
- Mode: click
- Number of targets: 2
- Required IDs: ["card_A", "card_B"]
- Instruction: "Do 'fan' and 'pan' rhyme? Click Yes or No."

Generates matching visual:
```json
{
  "q_1": {
    "cards": [
      {
        "id": "card_A",  // ✅ Matches first target
        "content_type": "text",
        "primary_value": "Yes"
      },
      {
        "id": "card_B",  // ✅ Matches second target
        "content_type": "text",
        "primary_value": "No"
      }
    ],
    "layout": "row"
  }
}
```

### Final Output

Problem with correctly injected visual:
```json
{
  "problem_type": "live_interaction",
  "interaction_config": {
    "mode": "click",
    "targets": [
      {"id": "card_A", "is_correct": true},
      {"id": "card_B", "is_correct": false}
    ]
  },
  "visual_content": {
    "visual_type": "card-grid",
    "visual_data": {
      "cards": [
        {"id": "card_A", "content_type": "text", "primary_value": "Yes"},
        {"id": "card_B", "content_type": "text", "primary_value": "No"}
      ]
    }
  }
}
```

## Testing Recommendations

1. **Generate new live_interaction problems** and verify:
   - Click-based interactions use `visual_type: "card-grid"`
   - Target IDs match card IDs exactly
   - Card content_type and primary_value are appropriate

2. **Test different interaction modes**:
   - Click mode → should use card-grid for choices
   - Speech mode → may not need visual or use display-only visuals
   - Drag mode → should use appropriate draggable visuals

3. **Verify visual variety**:
   - Yes/No questions → 2 text cards
   - Multiple choice → 3-4 text cards
   - Letter selection → cards with letters (text or image_with_label)
   - Image selection → cards with images

## Files Modified

1. `backend/app/services/problems.py`
   - Enhanced `_get_visual_guidance_for_type()` for live_interaction
   - Enhanced `_generate_batch_visuals()` to include interaction context

2. `backend/app/generators/content_schemas.py`
   - Improved CARD_GRID_SCHEMA documentation with detailed descriptions
