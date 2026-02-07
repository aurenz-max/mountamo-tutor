/**
 * Example: Compare & Contrast with AI-Generated Images
 *
 * This example demonstrates how to use the image-enabled compare & contrast generator.
 * Run this to see how AI-generated images enhance biological comparisons.
 */

import { generateCompareContrastWithImages, generateCompareContrastWithImagesFromTopic } from '../service/biology/gemini-compare-contrast-with-images';

/**
 * Example 1: Basic comparison with images
 */
export async function example1_FrogVsToad() {
  console.log('🐸 Example 1: Frog vs Toad with Images\n');

  const data = await generateCompareContrastWithImages(
    'Frog',
    'Toad',
    '3-5',
    'side-by-side'
  );

  console.log('Title:', data.title);
  console.log('Entity A:', data.entityA.name, '- Has image:', !!data.entityA.imageUrl);
  console.log('Entity B:', data.entityB.name, '- Has image:', !!data.entityB.imageUrl);
  console.log('Shared attributes:', data.sharedAttributes.length);
  console.log('\n');

  return data;
}

/**
 * Example 2: From topic string
 */
export async function example2_PlantVsAnimalCell() {
  console.log('🔬 Example 2: Plant Cell vs Animal Cell from Topic\n');

  const data = await generateCompareContrastWithImagesFromTopic(
    'Plant Cell vs Animal Cell',
    '6-8',
    'venn-interactive'
  );

  console.log('Title:', data.title);
  console.log('Mode:', data.mode);
  console.log('Entity A:', data.entityA.name, '- Has image:', !!data.entityA.imageUrl);
  console.log('Entity B:', data.entityB.name, '- Has image:', !!data.entityB.imageUrl);
  console.log('Total attributes:', data.entityA.attributes.length + data.entityB.attributes.length);
  console.log('\n');

  return data;
}

/**
 * Example 3: Process comparison (Mitosis vs Meiosis)
 */
export async function example3_MitosisVsMeiosis() {
  console.log('🧬 Example 3: Mitosis vs Meiosis\n');

  const data = await generateCompareContrastWithImagesFromTopic(
    'Mitosis vs Meiosis',
    '6-8',
    'side-by-side'
  );

  console.log('Title:', data.title);
  console.log('Entity A:', data.entityA.name);
  console.log('  - Image prompt:', data.entityA.imagePrompt.substring(0, 80) + '...');
  console.log('  - Has image:', !!data.entityA.imageUrl);
  console.log('Entity B:', data.entityB.name);
  console.log('  - Image prompt:', data.entityB.imagePrompt.substring(0, 80) + '...');
  console.log('  - Has image:', !!data.entityB.imageUrl);
  console.log('\nKey Insight:', data.keyInsight);
  console.log('\n');

  return data;
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('='.repeat(60));
  console.log('Compare & Contrast with Images - Examples');
  console.log('='.repeat(60));
  console.log('\n');

  try {
    await example1_FrogVsToad();
    await example2_PlantVsAnimalCell();
    await example3_MitosisVsMeiosis();

    console.log('✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Uncomment to run:
// runAllExamples();
