# Interactive ImagePanel Test Page

This test page allows you to validate the drag-and-drop annotation functionality before integrating AI evaluation.

## Running the Test

1. Start the development server:
   ```bash
   cd my-tutoring-app
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/test-image-panel`

## What to Test

### Basic Interaction
- [ ] Drag annotation cards from the left panel onto the image
- [ ] Verify annotations snap to cursor position on drop
- [ ] Check that placed annotations show a marker on the image
- [ ] Hover over markers to see label popups
- [ ] Click X button on annotation cards to remove placements

### State Management
- [ ] Annotation cards turn green when placed
- [ ] Progress counter updates (e.g., "3/5" annotations placed)
- [ ] Completion message appears when all annotations are placed
- [ ] "Clear All Placements" button resets the state

### Multiple Datasets
- [ ] Switch between datasets using the dropdown
- [ ] Verify each dataset has different annotations
- [ ] Check that placements reset when switching datasets

### Debug Information
- [ ] Toggle debug panel on/off
- [ ] Verify placement positions are percentage-based (0-100)
- [ ] Check JSON output shows correct structure for AI evaluation
- [ ] Progress percentage calculates correctly

## Sample Datasets Available

1. **T-Rex Anatomy** - 5 annotations (binocular vision, skull, forelimbs, legs, tail)
2. **Human Heart** - 4 annotations (chambers: RA, RV, LA, LV)
3. **Plant Cell** - 5 annotations (cell wall, chloroplast, vacuole, nucleus, mitochondria)
4. **Volcano** - 5 annotations (magma chamber, conduit, crater, lava flow, ash cloud)
5. **US Regions** - 5 annotations (Northeast, Southeast, Midwest, Southwest, West Coast)

## Expected Output

When all annotations are placed, the debug panel shows the evaluation payload that will be sent to the AI service:

```typescript
{
  "imageUrl": "...",
  "expectedAnnotations": [
    { "label": "...", "description": "..." }
  ],
  "studentPlacements": [
    { "label": "...", "position": { "x": 25.5, "y": 43.2 } }
  ]
}
```

## Next Phase: AI Evaluation

After validating the interaction model, the next step is to:

1. Create an AI evaluation service that:
   - Receives the image + expected annotations + student placements
   - Uses vision AI (Gemini with vision) to analyze correctness
   - Returns accuracy scores and feedback per annotation
   - Provides overall assessment with improvement suggestions

2. Integrate the `usePrimitiveEvaluation` hook to:
   - Track student performance metrics
   - Submit results to the evaluation system
   - Enable retry/reset functionality
   - Provide immediate feedback

3. Add to the primitive registry with `supportsEvaluation: true`

## Known Issues / Future Enhancements

- [ ] Image generation is on-demand (click "Generate Visual" button)
- [ ] No drag preview (consider adding ghost image during drag)
- [ ] Markers could be more distinct (consider different colors per annotation)
- [ ] No undo/redo functionality (could be useful for complex diagrams)
- [ ] Mobile touch support needs testing
- [ ] Consider adding snap-to-grid or magnetic hotspots for more precise placement

## Files Modified/Created

1. `/primitives/ImagePanel.tsx` - Added interactive annotation support
2. `/app/test-image-panel/page.tsx` - Test page component
3. `/test-data/image-panel-samples.ts` - Sample datasets
4. `/tailwind.config.ts` - Added bounce-slow animation
