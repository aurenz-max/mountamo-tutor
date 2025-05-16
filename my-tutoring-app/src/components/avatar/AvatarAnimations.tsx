// AvatarAnimations.js
'use client';

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

/**
 * Handles loading and applying animations to a Ready Player Me avatar
 */
export class AvatarAnimationManager {
  constructor() {
    this.animations = [];
    this.mixer = null;
    this.currentAction = null;
    this.animationMap = new Map();
    this.isReady = false;
  }

  /**
   * Load animations from a glTF/glb file
   * @param {string} url - URL to the animation file
   * @returns {Promise} - Resolves when animations are loaded
   */
  loadAnimations(url) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      
      loader.load(
        url,
        (gltf) => {
          console.log('Animation file loaded successfully');
          
          // Store all animations from the file
          if (gltf.animations && gltf.animations.length > 0) {
            this.animations = gltf.animations;
            console.log(`Loaded ${this.animations.length} animations`);
            
            // Map animations by name for easier access
            this.animations.forEach((animation, index) => {
              const name = animation.name || `animation_${index}`;
              this.animationMap.set(name, animation);
              console.log(`Animation available: ${name}`);
            });
            
            this.isReady = true;
            resolve(this.animations);
          } else {
            console.warn('No animations found in the file');
            reject('No animations found');
          }
        },
        (progress) => {
          console.log(`Loading animations: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
        },
        (error) => {
          console.error('Error loading animation file:', error);
          reject(error);
        }
      );
    });
  }

  /**
   * Initialize the animation system with an avatar model
   * @param {THREE.Object3D} avatar - The avatar model to animate
   * @returns {THREE.AnimationMixer} - The animation mixer
   */
  init(avatar) {
    if (!avatar) {
      console.error('No avatar provided to animation manager');
      return null;
    }
    
    // Create a new animation mixer for this avatar
    this.mixer = new THREE.AnimationMixer(avatar);
    console.log('Animation mixer created for avatar');
    
    return this.mixer;
  }

  /**
   * Play a specific animation by name
   * @param {string} name - The animation name
   * @param {object} options - Animation options
   * @returns {THREE.AnimationAction} - The animation action
   */
  play(name, options = {}) {
    if (!this.mixer) {
      console.error('Animation mixer not initialized');
      return null;
    }
    
    if (!this.isReady) {
      console.warn('Animations not loaded yet');
      return null;
    }
    
    // Get the animation clip
    const clip = this.animationMap.get(name);
    if (!clip) {
      console.warn(`Animation "${name}" not found`);
      return null;
    }
    
    // Stop current animation if it exists
    if (this.currentAction) {
      // Crossfade to the new animation
      const prevAction = this.currentAction;
      this.currentAction = this.mixer.clipAction(clip);
      
      // Set options
      if (options.loop !== undefined) {
        this.currentAction.loop = options.loop ? THREE.LoopRepeat : THREE.LoopOnce;
      }
      if (options.clampWhenFinished !== undefined) {
        this.currentAction.clampWhenFinished = options.clampWhenFinished;
      }
      if (options.timeScale !== undefined) {
        this.currentAction.timeScale = options.timeScale;
      }
      
      // Crossfade
      prevAction.fadeOut(options.fadeTime || 0.5);
      this.currentAction.reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(options.fadeTime || 0.5)
        .play();
    } else {
      // Just play the animation if no previous animation
      this.currentAction = this.mixer.clipAction(clip);
      
      // Set options
      if (options.loop !== undefined) {
        this.currentAction.loop = options.loop ? THREE.LoopRepeat : THREE.LoopOnce;
      }
      if (options.clampWhenFinished !== undefined) {
        this.currentAction.clampWhenFinished = options.clampWhenFinished;
      }
      if (options.timeScale !== undefined) {
        this.currentAction.timeScale = options.timeScale;
      }
      
      this.currentAction.play();
    }
    
    console.log(`Playing animation: ${name}`);
    return this.currentAction;
  }

  /**
   * Updates the animation mixer with the delta time
   * Should be called in the animation loop
   * @param {number} delta - Delta time in seconds
   */
  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
    }
  }

  /**
   * Get the list of all available animation names
   * @returns {string[]} - Array of animation names
   */
  getAnimationNames() {
    return Array.from(this.animationMap.keys());
  }
}

export default AvatarAnimationManager;