/**
 * Sample data for testing the interactive ImagePanel component
 * These can be used for development and testing before AI generation is implemented
 */

import type { ImagePanelData } from '../primitives/ImagePanel';

export const SAMPLE_DATASETS: Record<string, ImagePanelData> = {
  trex: {
    title: 'Tyrannosaurus Rex Anatomy',
    description: 'Learn about the physical features that made T-Rex a dominant predator',
    imageUrl: null, // Will use imagePrompt to generate
    imagePrompt: 'A detailed scientific illustration of a Tyrannosaurus Rex in profile view, showing clear anatomical features including the head with eyes and teeth, small forelimbs, powerful hind legs, and long tail. Educational diagram style with clear outlines, on a neutral background.',
    category: 'science',
    learningObjective: 'Identify and understand key anatomical features of Tyrannosaurus Rex',
    interactionMode: 'identify',
    annotations: [
      {
        id: '1',
        label: 'Binocular Vision',
        description: 'Forward-facing eyes positioned at the front of the head to allow for depth perception - crucial for hunting.',
        category: 'Sensory Features',
        isKey: true,
      },
      {
        id: '2',
        label: 'Massive Skull',
        description: 'Large skull with powerful jaw muscles and bone-crushing serrated teeth up to 12 inches long.',
        category: 'Body Structure',
        isKey: true,
      },
      {
        id: '3',
        label: 'Small Forelimbs',
        description: 'Vestigial-looking but strong forelimbs with two sharp claws. Purpose debated by scientists.',
        category: 'Body Structure',
        isKey: false,
      },
      {
        id: '4',
        label: 'Powerful Hind Legs',
        description: 'Muscular hind legs designed for movement and high-impact strides, supporting the massive body weight.',
        category: 'Locomotion',
        isKey: true,
      },
      {
        id: '5',
        label: 'Counterbalance Tail',
        description: 'A long, heavy tail that acted as a counterweight to the massive head, providing balance while moving.',
        category: 'Body Structure',
        isKey: true,
      },
    ],
  },

  heart: {
    title: 'Human Heart Anatomy',
    description: 'Explore the chambers and major blood vessels of the cardiovascular system',
    imageUrl: null,
    imagePrompt: 'A detailed anatomical diagram of a human heart showing the four chambers (right atrium, right ventricle, left atrium, left ventricle) and major blood vessels. Cross-section view with clear labels positions. Medical textbook illustration style with anatomical accuracy.',
    category: 'science',
    learningObjective: 'Identify the four chambers of the heart and understand blood flow',
    interactionMode: 'identify',
    annotations: [
      {
        id: '1',
        label: 'Right Atrium',
        description: 'Upper right chamber that receives deoxygenated blood from the body via the superior and inferior vena cava.',
        category: 'Chamber',
        isKey: true,
      },
      {
        id: '2',
        label: 'Right Ventricle',
        description: 'Lower right chamber that pumps deoxygenated blood to the lungs through the pulmonary artery.',
        category: 'Chamber',
        isKey: true,
      },
      {
        id: '3',
        label: 'Left Atrium',
        description: 'Upper left chamber that receives oxygenated blood from the lungs via the pulmonary veins.',
        category: 'Chamber',
        isKey: true,
      },
      {
        id: '4',
        label: 'Left Ventricle',
        description: 'Lower left chamber with thick muscular walls that pumps oxygenated blood to the body through the aorta.',
        category: 'Chamber',
        isKey: true,
      },
    ],
  },

  plant: {
    title: 'Plant Cell Structure',
    description: 'Identify the specialized organelles found in plant cells',
    imageUrl: null,
    imagePrompt: 'A detailed scientific illustration of a plant cell cross-section showing all major organelles including cell wall, cell membrane, chloroplasts, large central vacuole, nucleus, and mitochondria. Textbook diagram style with clear structures visible.',
    category: 'science',
    learningObjective: 'Recognize and locate key organelles unique to plant cells',
    interactionMode: 'identify',
    annotations: [
      {
        id: '1',
        label: 'Cell Wall',
        description: 'Rigid outer layer made of cellulose that provides structure and protection (not found in animal cells).',
        category: 'Structure',
        isKey: true,
      },
      {
        id: '2',
        label: 'Chloroplast',
        description: 'Green organelles containing chlorophyll where photosynthesis occurs, converting light energy to chemical energy.',
        category: 'Organelle',
        isKey: true,
      },
      {
        id: '3',
        label: 'Central Vacuole',
        description: 'Large fluid-filled sac that maintains cell pressure, stores nutrients, and contains waste products.',
        category: 'Organelle',
        isKey: true,
      },
      {
        id: '4',
        label: 'Nucleus',
        description: 'Control center of the cell containing DNA and directing all cell activities.',
        category: 'Organelle',
        isKey: true,
      },
      {
        id: '5',
        label: 'Mitochondria',
        description: 'Powerhouse of the cell that converts glucose into ATP energy through cellular respiration.',
        category: 'Organelle',
        isKey: true,
      },
    ],
  },

  volcano: {
    title: 'Volcano Anatomy',
    description: 'Learn about the internal structure and parts of a volcano',
    imageUrl: null,
    imagePrompt: 'A cross-section diagram of an active volcano showing internal structure including magma chamber, conduit, vent, crater, lava flow, and ash cloud. Educational geology diagram style with clear cutaway view.',
    category: 'geography',
    learningObjective: 'Understand the structure and eruption process of volcanoes',
    interactionMode: 'identify',
    annotations: [
      {
        id: '1',
        label: 'Magma Chamber',
        description: 'Large underground pool of molten rock beneath the volcano where magma accumulates before eruption.',
        category: 'Internal Structure',
        isKey: true,
      },
      {
        id: '2',
        label: 'Main Conduit',
        description: 'Central vertical pipe or channel through which magma travels from the chamber to the surface.',
        category: 'Internal Structure',
        isKey: true,
      },
      {
        id: '3',
        label: 'Crater',
        description: 'Bowl-shaped depression at the summit where erupted material exits the volcano.',
        category: 'Surface Feature',
        isKey: true,
      },
      {
        id: '4',
        label: 'Lava Flow',
        description: 'Molten rock (called lava once it reaches the surface) flowing down the sides of the volcano.',
        category: 'Eruption Product',
        isKey: true,
      },
      {
        id: '5',
        label: 'Ash Cloud',
        description: 'Plume of volcanic ash, gases, and rock fragments ejected high into the atmosphere during eruption.',
        category: 'Eruption Product',
        isKey: false,
      },
    ],
  },

  usmap: {
    title: 'Regions of the United States',
    description: 'Identify major geographic regions across the continental United States',
    imageUrl: null,
    imagePrompt: 'A clean, simplified map of the continental United States showing state boundaries in a educational style. Clear outlines, neutral colors, with enough detail to identify major geographic regions like the Northeast, Southeast, Midwest, Southwest, and West Coast.',
    category: 'geography',
    learningObjective: 'Locate and identify the major geographic regions of the United States',
    interactionMode: 'identify',
    annotations: [
      {
        id: '1',
        label: 'Northeast',
        description: 'Includes states like New York, Massachusetts, and Pennsylvania. Known for early colonial history and major cities.',
        category: 'Region',
        isKey: true,
      },
      {
        id: '2',
        label: 'Southeast',
        description: 'Includes states like Florida, Georgia, and the Carolinas. Warm climate and coastal areas.',
        category: 'Region',
        isKey: true,
      },
      {
        id: '3',
        label: 'Midwest',
        description: 'Includes states like Illinois, Ohio, and Michigan. Agricultural heartland and Great Lakes region.',
        category: 'Region',
        isKey: true,
      },
      {
        id: '4',
        label: 'Southwest',
        description: 'Includes states like Texas, Arizona, and New Mexico. Desert landscapes and Spanish colonial influence.',
        category: 'Region',
        isKey: true,
      },
      {
        id: '5',
        label: 'West Coast',
        description: 'Includes California, Oregon, and Washington. Pacific coastline with diverse geography from beaches to mountains.',
        category: 'Region',
        isKey: true,
      },
    ],
  },
};

/**
 * Get a sample dataset by key
 */
export function getSampleDataset(key: keyof typeof SAMPLE_DATASETS): ImagePanelData {
  return SAMPLE_DATASETS[key];
}

/**
 * Get all available sample dataset keys
 */
export function getAvailableDatasets(): string[] {
  return Object.keys(SAMPLE_DATASETS);
}

/**
 * Generate a random sample dataset for testing
 */
export function getRandomDataset(): ImagePanelData {
  const keys = getAvailableDatasets();
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return SAMPLE_DATASETS[randomKey as keyof typeof SAMPLE_DATASETS];
}
