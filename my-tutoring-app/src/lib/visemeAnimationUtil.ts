// src/lib/visemeAnimationUtil.ts

import * as THREE from 'three';

// Azure viseme IDs to morph target mappings for Ready Player Me avatar
const VISEME_MAPPINGS = {
    0: 'viseme_sil',      // Silence/neutral position
    1: 'viseme_aa',       // "ae" as in "bat"
    2: 'viseme_aa',       // "ah" as in "father"
    3: 'viseme_O',        // "aw" as in "flaw"
    4: 'viseme_E',        // "ee" as in "meet"
    5: 'viseme_I',        // "er" as in "bird"
    6: 'viseme_I',        // "ih" as in "bit"
    7: 'viseme_O',        // "oh" as in "boat"
    8: 'viseme_U',        // "oo" as in "boot"
    9: 'viseme_U',        // "uh" as in "book"
    10: 'viseme_PP',      // Bilabial plosives (p, b, m)
    11: 'viseme_FF',      // Labiodental fricatives (f, v)
    12: 'viseme_TH',      // Dental fricatives (th)
    13: 'viseme_DD',      // Dental/alveolar plosives (t, d, n)
    14: 'viseme_kk',      // Velar plosives (k, g)
    15: 'viseme_CH',      // Postalveolar fricatives (sh, ch, j)
    16: 'viseme_SS',      // Alveolar fricatives (s, z)
    17: 'viseme_nn',      // Alveolar nasals (n)
    18: 'viseme_RR',      // Alveolar approximants (r)
    19: 'viseme_aa',      // Open front unrounded vowel
    20: 'viseme_E'        // Mid front unrounded vowel
  };

// Viseme intensity configurations
const VISEME_CONFIG = {
  transitionTime: 0.05,  // Time in seconds to transition between visemes
  holdTime: 0.10,        // Time in seconds to hold a viseme at full intensity
  maxIntensity: 1.0,     // Maximum intensity value for visemes
  silenceThreshold: 0.1  // Intensity for silence viseme when not speaking
};

// Alternative viseme mappings (for different avatar models)
const ALTERNATIVE_VISEME_MAPPINGS = {
  0: 'mouthClose',       // Alternative for silence
  1: 'mouthOpen',        // Alternative for "ah"
  4: 'mouthSmileLeft',   // Alternative for "ee"
  7: 'mouthFunnel',      // Alternative for "oh"
  8: 'mouthPucker',      // Alternative for "oo"
  10: 'mouthPressLeft',  // Alternative for bilabial plosives
  16: 'mouthSmileRight'  // Alternative for fricatives
};

// Define the Oculus LipSync viseme targets to look for
const OCULUS_VISEME_TARGETS = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U'
];

// Define fallback morph targets
const FALLBACK_MORPH_TARGETS = [
  'mouthOpen', 'mouthSmile', 'eyesClosed', 'eyesLookUp', 'eyesLookDown'
];

/**
 * Create a viseme animation handler
 */
export function createVisemeHandler(avatar: any, options: any = {}) {
  if (!avatar) {
    console.error('No avatar provided to createVisemeHandler');
    return null;
  }
  
  const config = {
    speakerId: '*',  // Default: accept any speaker
    enabled: true,
    onVisemeApplied: null,
    ...options
  };
  
  console.log('Creating viseme handler for avatar');
  
  // Viseme animation state
  const state = {
    currentViseme: 'viseme_sil',
    visemeIntensity: 0,
    visemeQueue: [],
    lastUpdateTime: 0,
    useAlternativeMappings: false,
    morphTargets: {} as Record<string, number>,
    stats: {
      totalVisemes: 0,
      acceptedVisemes: 0,
      rejectedVisemes: 0,
      lastVisemeTime: Date.now(),
      morphTargetsFound: 0,
      visemeApplyErrors: 0,
      visemeApplySuccess: 0
    },
    animationFrameId: null as number | null,
    
    // Animation state
    currentVisemeRef: 'viseme_sil',
    currentIntensityRef: 0,
    targetVisemeRef: 'viseme_sil',
    targetIntensityRef: 0,
    transitionStartTimeRef: 0,
    isTransitioningRef: false
  };

  // Find the head mesh in the avatar
  const findHeadMesh = (avatarModel: any) => {
    if (!avatarModel) {
      console.error('No avatar model provided to findHeadMesh');
      return null;
    }

    console.log('Finding head mesh in avatar with Oculus LipSync viseme targets...');
    
    let headMesh = null;
    let bestMeshScore = 0;
    let bestOculusMatchCount = 0;
    
    // Search for meshes with morph targets
    avatarModel.traverse((object: any) => {
      if (!(object instanceof THREE.Mesh)) return;
      
      const mesh = object;
      
      // Skip meshes without morph targets
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      
      const morphTargets = Object.keys(mesh.morphTargetDictionary);
      console.log(`Found mesh with morph targets: ${mesh.name || 'Unnamed'} (${morphTargets.length} morphs)`);
      
      // Check for Oculus LipSync viseme targets
      let oculusMatchCount = 0;
      OCULUS_VISEME_TARGETS.forEach(viseme => {
        if (morphTargets.includes(viseme)) {
          oculusMatchCount++;
          console.log(`  ✓ Found Oculus viseme: ${viseme}`);
        }
      });
      
      // Calculate a score for this mesh
      let meshScore = oculusMatchCount * 10; // Heavily weight Oculus visemes
      
      // Check for fallback morph targets if we don't have good Oculus coverage
      if (oculusMatchCount < 5) {
        FALLBACK_MORPH_TARGETS.forEach(morph => {
          if (morphTargets.includes(morph)) {
            meshScore += 2;
            console.log(`  ✓ Found fallback morph: ${morph}`);
          }
        });
      }
      
      // Additional checks for generic mouth morphs
      morphTargets.forEach(name => {
        if (name.toLowerCase().includes('mouth') || 
            name.toLowerCase().includes('lip') || 
            name.toLowerCase().includes('jaw')) {
          meshScore += 1;
          if (oculusMatchCount < 2) {  // Only log these for meshes without good Oculus targets
            console.log(`  ✓ Found generic mouth morph: ${name}`);
          }
        }
      });
      
      // Add score if the mesh name suggests it's a head
      if (mesh.name && (
        mesh.name.toLowerCase().includes('head') || 
        mesh.name.toLowerCase().includes('face') ||
        mesh.name.toLowerCase().includes('skull') ||
        mesh.name.toLowerCase().includes('facial')
      )) {
        meshScore += 5;
        console.log(`  ✓ Mesh name suggests head/face: ${mesh.name}`);
      }
      
      // Use this mesh if it has a better score
      if (meshScore > bestMeshScore || 
          (meshScore === bestMeshScore && oculusMatchCount > bestOculusMatchCount)) {
        headMesh = mesh;
        bestMeshScore = meshScore;
        bestOculusMatchCount = oculusMatchCount;
        console.log(`  → New best mesh: ${mesh.name || 'Unnamed'} with score ${meshScore} (${oculusMatchCount} Oculus visemes)`);
      }
    });
    
    if (headMesh) {
      const morphTargets = Object.keys(headMesh.morphTargetDictionary);
      console.log(`✅ Selected head mesh: ${headMesh.name || 'Unnamed'} with score ${bestMeshScore} (${bestOculusMatchCount} Oculus visemes)`);
      
      // Log which Oculus visemes we found and which are missing
      console.log('Oculus viseme availability:');
      OCULUS_VISEME_TARGETS.forEach(viseme => {
        if (morphTargets.includes(viseme)) {
          console.log(`  ✓ ${viseme}`);
        } else {
          console.log(`  ✗ ${viseme} (missing)`);
        }
      });
      
      // Log all available morphs
      console.log(`All morphs (${morphTargets.length}): ${morphTargets.join(', ')}`);
      
      return headMesh;
    } else {
      console.error('❌ No suitable head mesh found in the avatar model');
      return null;
    }
  };

  // Check how many of the mappings are available in the morph targets
  const checkMappingAvailability = (
    mappings: Record<string, string>, 
    availableMorphs: Record<string, number>
  ) => {
    let count = 0;
    
    Object.values(mappings).forEach(morphName => {
      if (availableMorphs[morphName] !== undefined) {
        count++;
      } else {
        console.log(`⚠️ Missing morph target: ${morphName}`);
      }
    });
    
    return count;
  };
  
  // Get alternative viseme name mapping
  const getAlternativeVisemeName = (standardName: string) => {
    // Reverse lookup: find the standard ID for this name
    let standardId: number | null = null;
    
    for (const [id, name] of Object.entries(VISEME_MAPPINGS)) {
      if (name === standardName) {
        standardId = parseInt(id);
        break;
      }
    }
    
    if (standardId === null) return null;
    
    // Now get the alternative name for this ID
    return ALTERNATIVE_VISEME_MAPPINGS[standardId] || null;
  };
  
  // Apply a viseme to the avatar's morph targets
  const applyViseme = (visemeName: string, intensity: number) => {
    if (!avatar) {
      // Reduce log spam by not logging this often
      if (Math.random() < 0.01) console.log('⚠️ Cannot apply viseme: No avatar available');
      return false;
    }



    const headMesh = findHeadMesh(avatar);
    if (!headMesh) {
      if (Math.random() < 0.01) console.log('⚠️ Cannot apply viseme: No head mesh found');
      return false;
    }
    

    if (visemeName.startsWith('viseme_') && state.morphTargets[visemeName] !== undefined) {
        const morphIndex = state.morphTargets[visemeName];
        if (headMesh.morphTargetInfluences && morphIndex < headMesh.morphTargetInfluences.length) {
          // Apply the morph target directly
          headMesh.morphTargetInfluences[morphIndex] = intensity;
          
          // Track success
          state.stats.visemeApplySuccess++;
          
          // Call the callback if provided
          if (config.onVisemeApplied) {
            config.onVisemeApplied(visemeName, intensity);
          }
          
          state.currentViseme = visemeName;
          state.visemeIntensity = intensity;
          
          return true;
        }
        
    try {
      // Reset all mouth-related morphs for clean state
      Object.keys(state.morphTargets).forEach(morphName => {
        if (morphName.toLowerCase().includes('mouth')) {
          const morphIndex = state.morphTargets[morphName];
          if (headMesh.morphTargetInfluences && morphIndex < headMesh.morphTargetInfluences.length) {
            headMesh.morphTargetInfluences[morphIndex] = 0;
          }
        }
      });
      
      // Special case handling for specific visemes that need multiple morphs
      if (visemeName === 'mouthOpen') {
        // For "open mouth" visemes, apply jaw morphs too if available
        if (state.morphTargets['jawOpen'] !== undefined) {
          const jawMorphIndex = state.morphTargets['jawOpen'];
          if (headMesh.morphTargetInfluences && jawMorphIndex < headMesh.morphTargetInfluences.length) {
            headMesh.morphTargetInfluences[jawMorphIndex] = intensity * 0.7; // Apply at 70% intensity
          }
        }
      }
      
      // Apply the primary morph target
      if (state.morphTargets[visemeName] !== undefined) {
        const morphIndex = state.morphTargets[visemeName];
        if (headMesh.morphTargetInfluences && morphIndex < headMesh.morphTargetInfluences.length) {
          // Apply the morph target
          headMesh.morphTargetInfluences[morphIndex] = intensity;
          
          // Track success
          state.stats.visemeApplySuccess++;
          
          // Call the callback if provided
          if (config.onVisemeApplied) {
            config.onVisemeApplied(visemeName, intensity);
          }
          
          state.currentViseme = visemeName;
          state.visemeIntensity = intensity;
          
          return true;
        } else {
          if (Math.random() < 0.01) console.log(`⚠️ Invalid morph index for ${visemeName}: ${morphIndex}`);
        }
      } else {
        // Try alternative mapping
        if (state.useAlternativeMappings) {
          const altVisemeName = getAlternativeVisemeName(visemeName);
          
          if (altVisemeName && state.morphTargets[altVisemeName] !== undefined) {
            const morphIndex = state.morphTargets[altVisemeName];
            if (headMesh.morphTargetInfluences && morphIndex < headMesh.morphTargetInfluences.length) {
              headMesh.morphTargetInfluences[morphIndex] = intensity;
              
              if (config.onVisemeApplied) {
                config.onVisemeApplied(altVisemeName, intensity);
              }
              
              state.stats.visemeApplySuccess++;
              state.currentViseme = altVisemeName;
              state.visemeIntensity = intensity;
              
              return true;
            }
          }
        }
        
        // Only log this occasionally
        if (Math.random() < 0.01) {
          console.log(`⚠️ Viseme not found: ${visemeName}. Available morphs: ${Object.keys(state.morphTargets).join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error applying viseme ${visemeName}:`, error);
      state.stats.visemeApplyErrors++;
    }
    
    return false;
  };
  
  // Animation loop for smooth viseme transitions
  const animateVisemes = (timestamp: number) => {
    if (!avatar || !config.enabled) {
      state.animationFrameId = requestAnimationFrame(animateVisemes);
      return;
    }
    
    const deltaTime = timestamp - state.lastUpdateTime;
    state.lastUpdateTime = timestamp;
    
    // Process viseme queue if we're not in a transition
    if (!state.isTransitioningRef && state.visemeQueue.length > 0) {
      const nextViseme = state.visemeQueue.shift();
      if (nextViseme) {
        // Get the viseme name from the ID
        const visemeName = VISEME_MAPPINGS[nextViseme.visemeId] || 'viseme_sil';
        
        // Set up the transition
        state.targetVisemeRef = visemeName;
        state.targetIntensityRef = VISEME_CONFIG.maxIntensity;
        state.transitionStartTimeRef = timestamp;
        state.isTransitioningRef = true;
      }
    }
    
    // Handle transitions between visemes
    if (state.isTransitioningRef) {
      const elapsed = (timestamp - state.transitionStartTimeRef) / 1000; // Convert to seconds
      
      if (elapsed <= VISEME_CONFIG.transitionTime) {
        // In transition phase - blend between visemes
        const t = elapsed / VISEME_CONFIG.transitionTime;
        state.currentIntensityRef = state.currentIntensityRef * (1 - t) + state.targetIntensityRef * t;
        
        // Start blending to the new viseme
        if (state.currentVisemeRef !== state.targetVisemeRef) {
          // Apply the current viseme with reducing intensity
          applyViseme(state.currentVisemeRef, state.currentIntensityRef * (1 - t));
          
          // Apply the target viseme with increasing intensity
          applyViseme(state.targetVisemeRef, state.targetIntensityRef * t);
          
          // If we've completed the transition, update the current viseme
          if (t >= 1.0) {
            state.currentVisemeRef = state.targetVisemeRef;
          }
        } else {
          // Same viseme, just update intensity
          applyViseme(state.currentVisemeRef, state.currentIntensityRef);
        }
      } 
      else if (elapsed <= VISEME_CONFIG.transitionTime + VISEME_CONFIG.holdTime) {
        // Hold phase - keep the viseme at full intensity
        state.currentVisemeRef = state.targetVisemeRef;
        state.currentIntensityRef = state.targetIntensityRef;
        applyViseme(state.currentVisemeRef, state.currentIntensityRef);
      } 
      else {
        // End transition - return to silence if no more visemes
        if (state.visemeQueue.length === 0) {
          state.targetVisemeRef = 'viseme_sil';
          state.targetIntensityRef = VISEME_CONFIG.silenceThreshold;
          state.transitionStartTimeRef = timestamp;
          
          // Start transition to silence
          const elapsed = (timestamp - state.transitionStartTimeRef) / 1000;
          const t = Math.min(elapsed / VISEME_CONFIG.transitionTime, 1.0);
          
          // Blend from current viseme to silence
          applyViseme(state.currentVisemeRef, state.currentIntensityRef * (1 - t));
          applyViseme('viseme_sil', VISEME_CONFIG.silenceThreshold * t);
          
          // If transition complete, update current state
          if (t >= 1.0) {
            state.currentVisemeRef = 'viseme_sil';
            state.currentIntensityRef = VISEME_CONFIG.silenceThreshold;
            state.isTransitioningRef = false;
          }
        } else {
          // There are more visemes to process, end this transition
          state.isTransitioningRef = false;
        }
      }
    } else {
      // No active transitions, apply the current viseme
      applyViseme(state.currentVisemeRef, state.currentIntensityRef);
    }
    
    // Continue animation loop
    state.animationFrameId = requestAnimationFrame(animateVisemes);
  };
  
  // Process incoming viseme events
  const processVisemeEvent = (event: any) => {
    if (!config.enabled) {
      if (Math.random() < 0.01) console.log('⚠️ Viseme skipped: Not enabled');
      return;
    }
    
    if (!avatar) {
      if (Math.random() < 0.01) console.log('⚠️ Viseme skipped: No avatar');
      return;
    }
    
    state.stats.totalVisemes++;
    
    try {
      // Extract viseme data from different possible structures
      let visemeData;
      let speakerName;
      
      if (event.content?.data) {
        visemeData = event.content.data;
        speakerName = event.content.speaker;
      } else if (event.data) {
        visemeData = event.data;
        speakerName = event.speaker;
      } else {
        if (Math.random() < 0.01) console.log('⚠️ Viseme skipped: Invalid data format', event);
        state.stats.rejectedVisemes++;
        return;
      }
      
      // Check if this is a valid viseme event
      if (typeof visemeData.viseme_id !== 'number') {
        if (Math.random() < 0.01) console.log('⚠️ Viseme skipped: No viseme_id', visemeData);
        state.stats.rejectedVisemes++;
        return;
      }
      
      // Check if this viseme is for our speaker - accept any speaker if speakerId is '*'
      const isSpeakerMatch = config.speakerId === '*' || speakerName === config.speakerId;
      
      if (!isSpeakerMatch) {
        // Track rejected visemes but don't spam logs
        state.stats.rejectedVisemes++;
        if (state.stats.rejectedVisemes % 100 === 0) {
          console.log(`ℹ️ Skipped ${state.stats.rejectedVisemes} visemes due to speaker mismatch`);
        }
        return;
      }
      
      // Extract viseme info
      const { viseme_id } = visemeData;
      const audio_offset = visemeData.audio_offset || 0;
      const id = visemeData.id || `auto-${Date.now()}`;
      
      // Only log occasionally to reduce console noise
      if (state.stats.totalVisemes % 100 === 0) {
        console.log(`📢 Processed ${state.stats.totalVisemes} visemes, success rate: ${(state.stats.visemeApplySuccess / state.stats.totalVisemes * 100).toFixed(1)}%`);
      }
      
      // Update last viseme time
      state.stats.lastVisemeTime = Date.now();
      
      // Add to viseme queue
      state.visemeQueue.push({
        visemeId: viseme_id,
        timestamp: Date.now() + audio_offset,
        utteranceId: id
      });
      
      // Sort queue by timestamp
      state.visemeQueue.sort((a, b) => a.timestamp - b.timestamp);
      
      state.stats.acceptedVisemes++;
      
    } catch (error) {
      console.error('❌ Error processing viseme event:', error);
    }
  };
  
  // Set up viseme handling
  const setupVisemeHandling = () => {
    console.log('🔍 Searching for avatar head mesh with morph targets...');
    
    // Find avatar's head or face mesh
    const headMesh = findHeadMesh(avatar);
    if (!headMesh) {
      console.log('⚠️ Could not find head mesh with morph targets. Available meshes:');
      
      // Log available meshes for debugging
      avatar.traverse((object: any) => {
        if (object instanceof THREE.Mesh) {
          const hasMorphs = !!object.morphTargetDictionary;
          console.log(`- Mesh: ${object.name || 'unnamed'} ${hasMorphs ? `(has ${Object.keys(object.morphTargetDictionary || {}).length} morph targets)` : '(no morph targets)'}`);
          
          // Log the actual morph targets if any
          if (hasMorphs) {
            console.log('  Available morph targets:', Object.keys(object.morphTargetDictionary).join(', '));
          }
        }
      });
      return false;
    }
    
    console.log('✅ Found head mesh with morph targets!');
    
    // Store available morph targets
    if (headMesh.morphTargetDictionary && headMesh.morphTargetInfluences) {
      const morphTargets: Record<string, number> = {};
      
      Object.entries(headMesh.morphTargetDictionary).forEach(([name, index]) => {
        if (typeof index === 'number') {
          morphTargets[name] = index;
        }
      });
      
      state.morphTargets = morphTargets;
      state.stats.morphTargetsFound = Object.keys(morphTargets).length;
      
      console.log('📊 All available morph targets:', Object.keys(morphTargets).join(', '));
      
      // Check if we need to use alternative mappings
      const standardMappingCount = checkMappingAvailability(VISEME_MAPPINGS, morphTargets);
      const alternativeMappingCount = checkMappingAvailability(ALTERNATIVE_VISEME_MAPPINGS, morphTargets);
      
      console.log(`📊 Mapping availability: Standard=${standardMappingCount}, Alternative=${alternativeMappingCount}`);
      
      // Use alternative mappings if they have better coverage
      if (alternativeMappingCount > standardMappingCount) {
        state.useAlternativeMappings = true;
        console.log('🔄 Using alternative viseme mappings for better compatibility');
      }
      
      return true;
    } else {
      console.log('⚠️ Head mesh does not have morph targets dictionary or influences');
      return false;
    }
  };
  
  // Function to test a specific viseme directly
  const testViseme = (visemeId: number) => {
    const visemeName = VISEME_MAPPINGS[visemeId] || 'viseme_sil';
    applyViseme(visemeName, VISEME_CONFIG.maxIntensity);
    console.log(`🧪 Testing viseme ${visemeId} (${visemeName})`);
    
    // Return to silence after a short delay
    setTimeout(() => {
      applyViseme('viseme_sil', VISEME_CONFIG.silenceThreshold);
    }, 500);
  };
  
  // Function to test all visemes in sequence
  const testAllVisemes = (delay = 500) => {
    console.log('Testing all visemes in sequence...');
    
    // Get all viseme IDs
    const visemeIds = Object.keys(VISEME_MAPPINGS).map(id => parseInt(id));
    
    // Test each viseme with a delay between them
    let index = 0;
    
    function testNext() {
      if (index < visemeIds.length) {
        const visemeId = visemeIds[index];
        const visemeName = VISEME_MAPPINGS[visemeId] || 'viseme_sil';
        console.log(`Testing viseme ${visemeId} (${visemeName})`);
        
        applyViseme(visemeName, VISEME_CONFIG.maxIntensity);
        
        // Reset after a delay
        setTimeout(() => {
          applyViseme('viseme_sil', VISEME_CONFIG.silenceThreshold);
        }, delay * 0.8);
        
        index++;
        setTimeout(testNext, delay);
      } else {
        console.log('Finished testing all visemes');
        // Reset to silent viseme
        applyViseme('viseme_sil', VISEME_CONFIG.silenceThreshold);
      }
    }
    
    // Start the sequence
    testNext();
  };
  
  // Direct morph testing function - useful for debugging when viseme mapping isn't working
  const testDirectMorph = (morphName: string, intensity = 1.0, holdTime = 500) => {
    if (!avatar) {
      console.error('No avatar available for direct morph testing');
      return;
    }
    
    const headMesh = findHeadMesh(avatar);
    if (!headMesh || !headMesh.morphTargetDictionary || !headMesh.morphTargetInfluences) {
      console.error('No valid head mesh found for direct morph testing');
      return;
    }
    
    if (!(morphName in headMesh.morphTargetDictionary)) {
      console.error(`Morph target "${morphName}" not found in dictionary`);
      console.log('Available morphs:', Object.keys(headMesh.morphTargetDictionary).join(', '));
      return;
    }
    
    const morphIndex = headMesh.morphTargetDictionary[morphName];
    
    // Apply the morph
    console.log(`Applying morph "${morphName}" (index: ${morphIndex}) at intensity ${intensity}`);
    headMesh.morphTargetInfluences[morphIndex] = intensity;
    
    // Reset after the hold time
    setTimeout(() => {
      headMesh.morphTargetInfluences[morphIndex] = 0;
      console.log(`Reset morph "${morphName}"`);
    }, holdTime);
  };
  
  // Initialize the viseme handler
  const init = () => {
    const success = setupVisemeHandling();
    
    if (success) {
      console.log('Viseme handler initialized successfully');
      
      // Start the animation loop
      state.lastUpdateTime = performance.now();
      state.animationFrameId = requestAnimationFrame(animateVisemes);
      
      return true;
    } else {
      console.error('Failed to initialize viseme handler');
      return false;
    }
  };
  
  // Clean up resources
  const destroy = () => {
    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = null;
    }
  };
  
  // Initialize on creation
  const initialized = init();
  
  // Return the public API
  return {
    handleVisemeEvent: processVisemeEvent,
    getCurrentViseme: () => state.currentViseme,
    getVisemeIntensity: () => state.visemeIntensity,
    getStats: () => state.stats,
    
    clearVisemeQueue: () => {
      state.visemeQueue = [];
      console.log('🧹 Cleared viseme queue');
    },
    
    setSilence: () => {
      state.currentVisemeRef = 'viseme_sil';
      state.currentIntensityRef = VISEME_CONFIG.silenceThreshold;
      applyViseme('viseme_sil', VISEME_CONFIG.silenceThreshold);
      console.log('🤐 Reset to silence viseme');
    },
    
    testViseme,
    testAllVisemes,
    testDirectMorph,
    
    updateConfig: (newConfig: Partial<typeof VISEME_CONFIG>) => {
      Object.assign(VISEME_CONFIG, newConfig);
      console.log('⚙️ Updated viseme configuration:', VISEME_CONFIG);
    },
    
    destroy
  };
}