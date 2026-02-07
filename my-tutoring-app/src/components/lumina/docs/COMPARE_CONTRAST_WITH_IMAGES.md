# Compare & Contrast with Images

The Biology Compare & Contrast primitive now supports AI-generated images for visual comparison alongside attribute comparison.

## Usage

### Basic Usage (Text Only)

```typescript
import { generateCompareContrast } from '../service/biology/gemini-compare-contrast';

const data = await generateCompareContrast(
  'Frog',
  'Toad',
  '3-5',
  'side-by-side'
);
```

### With AI-Generated Images

```typescript
import { generateCompareContrastWithImages } from '../service/biology/gemini-compare-contrast-with-images';

const data = await generateCompareContrastWithImages(
  'Frog',
  'Toad',
  '3-5',
  'side-by-side'
);
// data.entityA.imageUrl and data.entityB.imageUrl will contain generated images
```

### From Topic String

```typescript
import { generateCompareContrastWithImagesFromTopic } from '../service/biology/gemini-compare-contrast-with-images';

const data = await generateCompareContrastWithImagesFromTopic(
  'Plant Cell vs Animal Cell',
  '6-8',
  'side-by-side'
);
```

### Via Generator Registry (with config flag)

In your manifest or generator call:

```typescript
{
  type: 'bio-compare-contrast',
  config: {
    generateImages: true,  // Enable AI image generation
    entityA: 'Mitochondria',
    entityB: 'Chloroplast',
    gradeBand: '6-8',
    mode: 'side-by-side'
  }
}
```

Or with topic string:

```typescript
{
  type: 'bio-compare-contrast',
  topic: 'Frog vs Toad',
  config: {
    generateImages: true,  // Enable AI image generation
    gradeBand: '3-5',
    mode: 'side-by-side'
  }
}
```

## Component Behavior

The CompareContrast component automatically handles both cases:

- **With images** (`imageUrl` provided): Displays the AI-generated image in a rounded card
- **Without images** (`imageUrl` not provided): Displays the text `imagePrompt` as a description

## Example Output

```typescript
{
  title: "Frog vs. Toad: Amphibian Surface Secrets",
  mode: "side-by-side",
  entityA: {
    name: "Frog",
    imagePrompt: "A bright green frog with long, smooth, wet skin...",
    imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANS...", // AI-generated image
    attributes: [
      { category: "Skin Texture", value: "Smooth, slimy, and moist", isShared: false },
      // ... more attributes
    ]
  },
  entityB: {
    name: "Toad",
    imagePrompt: "A brownish, warty toad sitting on dry, dark soil...",
    imageUrl: "data:image/png;base64,iVBORw0KGgoAAAANS...", // AI-generated image
    attributes: [
      { category: "Skin Texture", value: "Dry, rough, and bumpy", isShared: false },
      // ... more attributes
    ]
  },
  sharedAttributes: [
    { category: "Classification", value: "Both are amphibians" },
    // ... more shared attributes
  ],
  keyInsight: "Understanding the differences helps us identify these amphibians...",
  gradeBand: "3-5"
}
```

## Performance Considerations

- Image generation adds ~3-5 seconds to the generation time
- Images are generated in parallel for both entities
- If image generation fails, the component gracefully falls back to text descriptions
- Consider using `generateImages: false` (default) for faster content generation when images aren't needed

## Design Pattern

This follows the same pattern as the general ImageComparison primitive:

1. **Generator service** ([gemini-compare-contrast-with-images.ts](../service/biology/gemini-compare-contrast-with-images.ts))
   - Wraps the base comparison generator
   - Adds parallel image generation
   - Handles errors gracefully

2. **Component** ([CompareContrast.tsx](../primitives/visual-primitives/biology/CompareContrast.tsx))
   - Conditionally renders images or text
   - Works with or without images
   - Maintains consistent UI regardless of image availability

3. **Registry integration** ([biologyGenerators.ts](../service/registry/generators/biologyGenerators.ts))
   - Checks `config.generateImages` flag
   - Routes to appropriate generator
   - Backwards compatible (defaults to text-only)
