import { useRef, useState, useCallback } from 'react';

// Define all possible animations
export type AnimationType = 
  | 'idle1' 
  | 'idle2' 
  | 'talking1' 
  | 'talking2' 
  | 'wave' 
  | 'happy' 
  | 'question';

// Animation metadata with durations and priorities
export interface AnimationInfo {
  name: string;          // Exact name in Rive file
  duration: number;      // Duration in milliseconds
  priority: number;      // Higher number = higher priority
  interruptible: boolean; // Can be interrupted by higher priority animations
  loop: boolean;         // Whether animation should loop
}

// Animation mappings with metadata
const ANIMATIONS: Record<AnimationType, AnimationInfo> = {
  idle1: { 
    name: 'Idle 1', 
    duration: 2000, 
    priority: 1, 
    interruptible: true, 
    loop: true 
  },
  idle2: { 
    name: 'Idle 2', 
    duration: 2000, 
    priority: 1, 
    interruptible: true, 
    loop: true 
  },
  talking1: { 
    name: 'Talking 1', 
    duration: 1000, 
    priority: 10, 
    interruptible: false, 
    loop: true 
  },
  talking2: { 
    name: 'Talking 2', 
    duration: 1200, 
    priority: 10, 
    interruptible: false, 
    loop: true 
  },
  wave: { 
    name: 'Wave', 
    duration: 1500, 
    priority: 5, 
    interruptible: true, 
    loop: false 
  },
  happy: { 
    name: 'Happy Smile', 
    duration: 1500, // Reduced duration for more reliable transitions
    priority: 5, 
    interruptible: true, 
    loop: false 
  },
  question: { 
    name: 'Question', 
    duration: 1500, 
    priority: 5, 
    interruptible: true, 
    loop: false 
  }
};

// Animation queue and state management
export function useAnimationManager() {
  // Current active animation
  const [currentAnimation, setCurrentAnimation] = useState<AnimationType>('idle1');
  
  // Animation queue
  const queueRef = useRef<{
    type: AnimationType;
    timestamp: number;
    onComplete?: () => void;
  }[]>([]);
  
  // Timeout reference for animation completion
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track the last time we showed a special idle animation
  const lastSpecialIdleRef = useRef<number>(0);
  
  // Flag to track if speaking is active
  const isSpeakingRef = useRef(false);
  
  // Map state names to animation types
  const mapMoodToAnimation = useCallback((
    mood: 'idle' | 'talking' | 'waving' | 'happy' | 'questioning',
    variation?: number
  ): AnimationType => {
    switch (mood) {
      case 'idle':
        return variation === 2 ? 'idle2' : 'idle1';
      case 'talking':
        return variation === 2 ? 'talking2' : 'talking1';
      case 'waving':
        return 'wave';
      case 'happy':
        return 'happy';
      case 'questioning':
        return 'question';
      default:
        return 'idle1';
    }
  }, []);
  
  // Clear any pending animation timeouts
  const clearAnimationTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  // Select a randomized idle animation with weighted probabilities
  const selectRandomIdleAnimation = useCallback((): AnimationType => {
    const now = Date.now();
    const timeSinceLastSpecial = now - lastSpecialIdleRef.current;
    
    // Don't show special idles too frequently - minimum 15 second gap
    // This prevents wave/happy from appearing too close together
    if (timeSinceLastSpecial < 15000) {
      return Math.random() > 0.5 ? 'idle1' : 'idle2';
    }
    
    const random = Math.random() * 100; // 0-100
    
    if (random < 45) {
      return 'idle1';
    } else if (random < 90) { // 45-90
      return 'idle2';
    } else if (random < 95) { // 90-95
      // Mark time when we show wave
      lastSpecialIdleRef.current = now;
      return 'wave';
    } else { // 95-100
      // Mark time when we show happy
      lastSpecialIdleRef.current = now;
      return 'happy';
    }
  }, []);
  
  // Process the next animation in queue
  const processQueue = useCallback(() => {
    // If queue is empty, return to idle
    if (queueRef.current.length === 0) {
      // If we were speaking but no longer are, go back to idle
      if (!isSpeakingRef.current) {
        const randomAnimation = selectRandomIdleAnimation();
        console.log(`Queue empty, selecting random idle: ${randomAnimation}`);
        
        // For potentially problematic animations like Happy Smile, always go straight to idle
        if (randomAnimation === 'happy') {
          console.log(`Avoiding potentially problematic animation, using idle1 instead`);
          setCurrentAnimation('idle1');
          return;
        }
        
        setCurrentAnimation(randomAnimation);
        
        // If we selected a non-looping animation (wave or question), 
        // schedule return to idle after it completes
        if ((randomAnimation === 'wave' || randomAnimation === 'question') && 
            !ANIMATIONS[randomAnimation].loop) {
          clearAnimationTimeout();
          console.log(`Setting timeout for non-looping animation: ${randomAnimation}`);
          timeoutRef.current = setTimeout(() => {
            console.log(`Non-looping animation ${randomAnimation} completed, returning to idle`);
            // After wave or question, go back to one of the regular idles
            const idleVariation = Math.random() > 0.5 ? 'idle1' : 'idle2';
            setCurrentAnimation(idleVariation);
            timeoutRef.current = null;
            
            // Recursively call processQueue to handle any pending animations
            processQueue();
          }, ANIMATIONS[randomAnimation].duration + 50); // Small buffer
        }
      }
      return;
    }
    
    // Get next animation
    const nextAnimation = queueRef.current.shift();
    if (!nextAnimation) return;
    
    // Set as current animation
    console.log(`Playing animation from queue: ${nextAnimation.type} (${ANIMATIONS[nextAnimation.type].name})`);
    setCurrentAnimation(nextAnimation.type);
    
    // Special handling for Happy Smile animation
    if (nextAnimation.type === 'happy') {
      clearAnimationTimeout();
      console.log(`Setting special short timeout for Happy Smile animation`);
      timeoutRef.current = setTimeout(() => {
        console.log(`Happy Smile animation forced completion, returning to idle`);
        const idleVariation = Math.random() > 0.5 ? 'idle1' : 'idle2';
        setCurrentAnimation(idleVariation);
        timeoutRef.current = null;
        
        // Call completion callback if provided
        if (nextAnimation.onComplete) {
          nextAnimation.onComplete();
        }
        
        // Process next animation
        processQueue();
      }, 1000); // Shorter timeout for Happy Smile
      return;
    }
    
    // If not looping, set timeout for completion
    if (!ANIMATIONS[nextAnimation.type].loop) {
      clearAnimationTimeout();
      console.log(`Setting timeout for non-looping queued animation: ${nextAnimation.type}`);
      timeoutRef.current = setTimeout(() => {
        console.log(`Animation ${nextAnimation.type} completed via timeout`);
        // Call completion callback if provided
        if (nextAnimation.onComplete) {
          nextAnimation.onComplete();
        }
        timeoutRef.current = null;
        // Process next animation
        processQueue();
      }, ANIMATIONS[nextAnimation.type].duration + 50); // Small buffer
    }
  }, [clearAnimationTimeout, selectRandomIdleAnimation]);
  
  // Queue a new animation
  const queueAnimation = useCallback((
    animationType: AnimationType, 
    options?: { force?: boolean; onComplete?: () => void }
  ) => {
    const animation = ANIMATIONS[animationType];
    
    console.log(`Queueing animation: ${animationType}, force: ${options?.force}`);
    
    // If this is a speaking animation, update speaking ref
    if (animationType === 'talking1' || animationType === 'talking2') {
      isSpeakingRef.current = true;
    }
    
    // Check if we should force this animation
    if (options?.force) {
      // Clear queue and immediately play this animation
      queueRef.current = [];
      clearAnimationTimeout();
      console.log(`Force playing animation: ${animationType}`);
      
      // Add to empty queue and process
      queueRef.current.push({
        type: animationType,
        timestamp: Date.now(),
        onComplete: options.onComplete
      });
      
      processQueue();
      return;
    }
    
    // Regular priority-based queueing
    const currentAnim = ANIMATIONS[currentAnimation];
    
    // Check if we should interrupt current animation
    if (currentAnim.interruptible && animation.priority > currentAnim.priority) {
      // Clear current animation and queue
      clearAnimationTimeout();
      console.log(`Interrupting current animation for higher priority: ${animationType}`);
      queueRef.current = [{
        type: animationType,
        timestamp: Date.now(),
        onComplete: options?.onComplete
      }];
      processQueue();
    } else {
      // Add to queue based on priority
      const newQueueItem = {
        type: animationType,
        timestamp: Date.now(),
        onComplete: options?.onComplete
      };
      
      // Insert based on priority
      let inserted = false;
      for (let i = 0; i < queueRef.current.length; i++) {
        if (animation.priority > ANIMATIONS[queueRef.current[i].type].priority) {
          queueRef.current.splice(i, 0, newQueueItem);
          inserted = true;
          console.log(`Inserted ${animationType} into queue at position ${i} (priority-based)`);
          break;
        }
      }
      
      // If not inserted, add to end
      if (!inserted) {
        queueRef.current.push(newQueueItem);
        console.log(`Added ${animationType} to end of queue`);
      }
      
      // If nothing is currently playing, process queue
      if (queueRef.current.length === 1 && !timeoutRef.current) {
        processQueue();
      }
    }
  }, [clearAnimationTimeout, currentAnimation, processQueue]);
  
  // Set speaking state (starts or stops talking animations)
  const setSpeaking = useCallback((isSpeaking: boolean) => {
    // Update speaking ref
    isSpeakingRef.current = isSpeaking;
    
    if (isSpeaking) {
      // Randomly choose between talking1 and talking2
      const talkingAnimation: AnimationType = Math.random() > 0.5 ? 'talking1' : 'talking2';
      queueAnimation(talkingAnimation, { force: true });
    } else {
      // If no longer speaking and current animation is talking, end it
      if (currentAnimation === 'talking1' || currentAnimation === 'talking2') {
        // Choose random idle animation
        const idleAnimation: AnimationType = Math.random() > 0.5 ? 'idle1' : 'idle2';
        queueAnimation(idleAnimation);
      }
    }
  }, [queueAnimation, currentAnimation]);
  
  // Special event handlers
  const onConnect = useCallback(() => {
    // Play wave animation when connecting
    queueAnimation('wave', { 
      force: true,
      onComplete: () => {
        queueAnimation('happy');
      }
    });
  }, [queueAnimation]);
  
  const onDisconnect = useCallback(() => {
    // Clear queue and go to idle
    queueRef.current = [];
    clearAnimationTimeout();
    setCurrentAnimation('idle1');
    isSpeakingRef.current = false;
  }, [clearAnimationTimeout]);
  
  const onNewProblem = useCallback(() => {
    // Show questioning animation for new problems
    queueAnimation('question');
  }, [queueAnimation]);
  
  return {
    currentAnimation: ANIMATIONS[currentAnimation].name,
    queueAnimation,
    mapMoodToAnimation,
    setSpeaking,
    onConnect,
    onDisconnect,
    onNewProblem,
    selectRandomIdleAnimation
  };
}

export default useAnimationManager;