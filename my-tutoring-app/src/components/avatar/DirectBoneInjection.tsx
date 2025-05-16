// DirectBoneInjection.js
// This is a more aggressive approach to fix the T-pose issue with Ready Player Me avatars

/**
 * Directly manipulates the avatar's bone structure to fix T-pose
 * This is a last resort approach for avatars where normal bone manipulation fails
 * 
 * @param {THREE.Object3D} avatar - The loaded avatar scene
 */
export const fixTposeDirectly = (avatar) => {
    console.log('Attempting direct bone manipulation for T-pose fix');
    
    // Known Ready Player Me skeleton structures and their arm bones
    const knownStructures = [
      // Standard RPM structure
      {
        shoulderLeft: 'LeftShoulder',
        shoulderRight: 'RightShoulder',
        armLeft: 'LeftArm',
        armRight: 'RightArm',
      },
      // Mixamo structure
      {
        shoulderLeft: 'mixamorig:LeftShoulder',
        shoulderRight: 'mixamorig:RightShoulder',
        armLeft: 'mixamorig:LeftArm',
        armRight: 'mixamorig:RightArm',
      },
      // Dot notation variant
      {
        shoulderLeft: 'mixamorig.LeftShoulder',
        shoulderRight: 'mixamorig.RightShoulder',
        armLeft: 'mixamorig.LeftArm',
        armRight: 'mixamorig.RightArm',
      },
      // Underscore variant
      {
        shoulderLeft: 'Left_Shoulder',
        shoulderRight: 'Right_Shoulder',
        armLeft: 'Left_Arm',
        armRight: 'Right_Arm',
      }
    ];
    
    // Results tracking
    let foundBones = [];
    let success = false;
    
    // Search all bones and collect names for debugging
    let allBoneNames = [];
    avatar.traverse((node) => {
      if (node.isBone || node.type === 'Bone') {
        allBoneNames.push(node.name);
      }
    });
    console.log('All bones found:', allBoneNames);
    
    // Try each known structure
    knownStructures.forEach(structure => {
      // Try to find and pose shoulder and arm bones
      for (const [position, boneName] of Object.entries(structure)) {
        avatar.traverse((node) => {
          if ((node.isBone || node.type === 'Bone') && node.name.includes(boneName)) {
            // Apply rotation based on left/right
            if (position.includes('Left')) {
              node.rotation.z = -0.7; // More aggressive for left
              foundBones.push(`Left: ${node.name}`);
              success = true;
            } else if (position.includes('Right')) {
              node.rotation.z = 0.7; // More aggressive for right
              foundBones.push(`Right: ${node.name}`);
              success = true;
            }
          }
        });
      }
    });
    
    // If we didn't find specific bones, look for anything with arm/shoulder in the name
    if (!success) {
      console.log('Standard bone names not found, trying generic arm/shoulder detection');
      
      avatar.traverse((node) => {
        if (node.isBone || node.type === 'Bone') {
          const name = node.name.toLowerCase();
          
          // Check for left arm/shoulder
          if ((name.includes('left') || name.includes('l_')) && 
              (name.includes('arm') || name.includes('shoulder'))) {
            node.rotation.z = -0.8; // Very aggressive for left
            foundBones.push(`Generic Left: ${node.name}`);
            success = true;
          }
          
          // Check for right arm/shoulder
          if ((name.includes('right') || name.includes('r_')) && 
              (name.includes('arm') || name.includes('shoulder'))) {
            node.rotation.z = 0.8; // Very aggressive for right
            foundBones.push(`Generic Right: ${node.name}`);
            success = true;
          }
        }
      });
    }
    
    // Last resort - try to find and manipulate the meshes directly
    if (!success) {
      console.log('Bone manipulation failed, attempting mesh manipulation');
      
      avatar.traverse((node) => {
        if (node.isMesh) {
          const name = node.name.toLowerCase();
          
          // Check for arm meshes
          if (name.includes('arm') || name.includes('shoulder') || name.includes('upperarm')) {
            if (name.includes('left') || name.includes('l_')) {
              // Create a pivot and parent the mesh to it
              const pivot = new THREE.Object3D();
              node.parent.add(pivot);
              pivot.add(node);
              pivot.rotation.z = -0.8;
              foundBones.push(`Mesh Left: ${node.name}`);
              success = true;
            } else if (name.includes('right') || name.includes('r_')) {
              // Create a pivot and parent the mesh to it
              const pivot = new THREE.Object3D();
              node.parent.add(pivot);
              pivot.add(node);
              pivot.rotation.z = 0.8;
              foundBones.push(`Mesh Right: ${node.name}`);
              success = true;
            }
          }
        }
      });
    }
    
    // Log results
    if (success) {
      console.log('Successfully manipulated bones/meshes:', foundBones);
    } else {
      console.error('All T-pose fix attempts failed');
    }
    
    return success;
  };