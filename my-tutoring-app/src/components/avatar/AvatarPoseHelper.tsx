'use client'

/**
 * Apply a direct pose fix to immediately correct the T-pose
 * This is a fallback that focuses on just the arms
 */
const applyDirectPose = (avatar, poseType = 'natural') => {
    console.log('Applying direct pose fix...');
    
    let fixAttempted = false;
    
    // Direct fix for common Ready Player Me arm bones
    avatar.traverse((node) => {
      // Check for any bone that might be an arm
      if (node.isBone || node.type === 'Bone') {
        const name = node.name.toLowerCase();
        
        // Left arm
        if (name.includes('left') && (name.includes('arm') || name.includes('shoulder'))) {
          console.log(`Direct fix for left arm: ${node.name}`);
          node.rotation.z = -0.5; // More aggressive rotation
          fixAttempted = true;
        }
        
        // Right arm
        if (name.includes('right') && (name.includes('arm') || name.includes('shoulder'))) {
          console.log(`Direct fix for right arm: ${node.name}`);
          node.rotation.z = 0.5; // More aggressive rotation
          fixAttempted = true;
        }
      }
    });
    
    return fixAttempted;
  };// AvatarPoseHelper.js
  
  /**
   * Applies a natural pose to a Ready Player Me avatar
   * This helps fix the default T-pose with arms sticking out
   * 
   * @param {THREE.Object3D} avatar - The loaded avatar scene
   * @param {String} poseType - Type of pose ('natural', 'relaxed', 'attentive')
   */
  export const applyAvatarPose = (avatar, poseType = 'natural') => {
    if (!avatar) return false;
    
    // Try direct posing first (immediate fix)
    applyDirectPose(avatar, poseType);
    if (!avatar) return;
    
    // Log all bones to help with debugging
    console.log('Applying pose to avatar');
    let bonesFound = false;
    
    // First identify the armature/rig
    let armature = null;
    let skeleton = null;
    
    avatar.traverse((node) => {
      // Look for the skeleton/armature
      if (node.type === 'Bone' || node.isBone) {
        bonesFound = true;
        console.log('Found bone:', node.name);
      }
      
      if (node.isSkinnedMesh) {
        console.log('Found skinned mesh:', node.name);
        skeleton = node.skeleton;
      }
      
      // Ready Player Me armature is often called "Armature"
      if (node.name === 'Armature' || (node.children && node.children.some(child => child.isBone))) {
        armature = node;
        console.log('Found armature:', node.name);
      }
    });
    
    if (!bonesFound) {
      console.warn('No bones found in the avatar. Is it properly rigged?');
      return;
    }
    
    // Define poses - with stronger rotation values
    const poses = {
      natural: {
        'LeftArm': { x: 0, y: 0, z: -0.5 },
        'RightArm': { x: 0, y: 0, z: 0.5 },
        'LeftForeArm': { x: 0.2, y: 0, z: -0.2 },
        'RightForeArm': { x: 0.2, y: 0, z: 0.2 },
        'LeftHand': { x: 0, y: -0.1, z: 0 },
        'RightHand': { x: 0, y: 0.1, z: 0 },
        'Spine': { x: 0.05, y: 0, z: 0 }, // Slight forward tilt
      },
      relaxed: {
        'LeftArm': { x: 0, y: 0, z: -0.4 },
        'RightArm': { x: 0, y: 0, z: 0.4 },
        'LeftForeArm': { x: 0.3, y: 0, z: -0.2 },
        'RightForeArm': { x: 0.3, y: 0, z: 0.2 },
        'Spine': { x: -0.05, y: 0, z: 0 }, // Slight backward tilt
      },
      attentive: {
        'LeftArm': { x: 0, y: 0.2, z: -0.2 },
        'RightArm': { x: 0, y: -0.2, z: 0.2 },
        'LeftForeArm': { x: 0.5, y: 0, z: 0 },
        'RightForeArm': { x: 0.5, y: 0, z: 0 },
        'Spine': { x: 0.1, y: 0, z: 0 }, // More pronounced forward tilt
      }
    };
    
    const selectedPose = poses[poseType] || poses.natural;
    
    // Apply the pose - with more detailed bone detection
    const applyRotationToBone = (boneName, rotation) => {
      // Common Ready Player Me bone naming variations
      const boneAliases = {
        'LeftArm': ['LeftArm', 'mixamorig.leftArm', 'mixamorig:LeftArm', 'Left_Arm', 'LeftShoulder'],
        'RightArm': ['RightArm', 'mixamorig.rightArm', 'mixamorig:RightArm', 'Right_Arm', 'RightShoulder'],
        'LeftForeArm': ['LeftForeArm', 'mixamorig.leftForeArm', 'mixamorig:LeftForeArm', 'Left_ForeArm'],
        'RightForeArm': ['RightForeArm', 'mixamorig.rightForeArm', 'mixamorig:RightForeArm', 'Right_ForeArm'],
        'Spine': ['Spine', 'mixamorig.spine', 'mixamorig:Spine', 'Spine1', 'mixamorig:Spine1']
      };
      
      const targetBones = boneAliases[boneName] || [boneName];
      
      avatar.traverse((node) => {
        // Check against all possible names for this bone
        if (node.isBone || node.type === 'Bone') {
          for (const alias of targetBones) {
            if (node.name.includes(alias)) {
              console.log(`Adjusting pose for ${node.name} (matched ${alias})`);
              if (rotation.x !== undefined) node.rotation.x = rotation.x;
              if (rotation.y !== undefined) node.rotation.y = rotation.y;
              if (rotation.z !== undefined) node.rotation.z = rotation.z;
              break; // Stop once we've applied to this bone
            }
          }
        }
      });
    };
    
    // Apply rotations from the pose set
    for (const [boneName, rotation] of Object.entries(selectedPose)) {
      applyRotationToBone(boneName, rotation);
    }
    
    // If we have a skeleton, use that too (belt and suspenders approach)
    if (skeleton) {
      skeleton.bones.forEach(bone => {
        for (const [boneName, rotation] of Object.entries(selectedPose)) {
          if (bone.name.includes(boneName)) {
            console.log(`Adjusting skeleton pose for ${bone.name}`);
            if (rotation.x) bone.rotation.x = rotation.x;
            if (rotation.y) bone.rotation.y = rotation.y;
            if (rotation.z) bone.rotation.z = rotation.z;
          }
        }
      });
    }
    
    // Return true if we were able to find and manipulate bones
    return bonesFound;
  };
  
  /**
   * Analyzes a Ready Player Me avatar to find bone structure
   * Logs information about the skeleton to help with pose debugging
   * 
   * @param {THREE.Object3D} avatar - The loaded avatar scene
   * @return {Object} Information about the avatar rig
   */
  export const forceArmPose = (avatar) => {
    console.log('Applying forced arm pose...');
    
    // This is a last resort function to force arms down
    // Create bones if needed and force a neutral pose
    
    const rootBone = new THREE.Bone();
    rootBone.name = "ForcedRootBone";
    
    // Find mesh
    let meshFound = false;
    avatar.traverse((node) => {
      if (node.isMesh) {
        meshFound = true;
        // Apply rotations directly to mesh parts if we can identify them
        if (node.name.toLowerCase().includes('arm') || 
            node.name.toLowerCase().includes('shoulder') ||
            node.name.toLowerCase().includes('upper_arm')) {
          
          // Adjust based on left/right
          if (node.name.toLowerCase().includes('left')) {
            node.rotation.z = -0.6;
          } else if (node.name.toLowerCase().includes('right')) {
            node.rotation.z = 0.6;
          }
          
          console.log(`Applied force pose to mesh part: ${node.name}`);
        }
      }
    });
    
    return meshFound;
  };
  
  export const analyzeAvatarRig = (avatar) => {
    if (!avatar) return { success: false };
    
    const rigInfo = {
      success: false,
      boneCount: 0,
      boneNames: [],
      skinnedMeshes: [],
      hasArmature: false
    };
    
    avatar.traverse((node) => {
      if (node.isBone || node.type === 'Bone') {
        rigInfo.boneCount++;
        rigInfo.boneNames.push(node.name);
        rigInfo.success = true;
      }
      
      if (node.isSkinnedMesh) {
        rigInfo.skinnedMeshes.push(node.name);
      }
      
      if (node.name === 'Armature') {
        rigInfo.hasArmature = true;
      }
    });
    
    console.log('Avatar rig analysis:', rigInfo);
    return rigInfo;
  };