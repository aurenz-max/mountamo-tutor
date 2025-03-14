import React, { useEffect, useState, useRef } from 'react';
import { useRive } from '@rive-app/react-canvas';
import useAnimationManager from './AnimationManager';
import './TutorCharacter.css';

interface TutorCharacterProps {
  isSpeaking?: boolean;
  mood?: 'idle' | 'talking' | 'waving' | 'happy' | 'questioning';
  animationSrc?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
//  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  position?: 'top-left' | 'bottom-left';
  isTheaterMode?: boolean;
  onConnect?: boolean; // Trigger connection animation
  onNewProblem?: boolean; // Trigger new problem animation
}

const TutorCharacter: React.FC<TutorCharacterProps> = ({
  isSpeaking = false,
  mood = 'idle',
  animationSrc = '/animations/elemental.riv',
  className = '',
  size = 'large',
  position = 'bottom-left',
  isTheaterMode = false,
  onConnect = false,
  onNewProblem = false,
}) => {
  const [loadError, setLoadError] = useState<string | null>(null);
  const prevSpeakingRef = useRef(isSpeaking);
  const prevMoodRef = useRef(mood);
  const onConnectRef = useRef(onConnect);
  const onNewProblemRef = useRef(onNewProblem);
  const animationStartTimeRef = useRef(Date.now());
  
  // Add a reference to track if we're in a special animation state
  const inSpecialAnimationRef = useRef(false);
  const specialAnimationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use our animation manager
  const {
    currentAnimation,
    setSpeaking,
    mapMoodToAnimation,
    queueAnimation,
    onConnect: triggerConnectAnimation,
    onNewProblem: triggerNewProblemAnimation
  } = useAnimationManager();

  // Keep track of current animation for safety timeout
  const prevAnimationRef = useRef(currentAnimation);

  // Use direct Rive integration
  const { rive, RiveComponent } = useRive({
    src: animationSrc,
    autoplay: true,
    onLoad: () => {
      console.log('Rive animation loaded successfully');
      
      // Get available animations for debugging
      if (rive) {
        console.log('Available animations:', rive.animationNames);
      }
    },
    onLoadError: (err) => {
      console.error('Rive animation load error:', err);
      setLoadError(`Failed to load animation: ${err.message}`);
    }
  });

  // Direct override for the "Happy Smile" animation specifically
  useEffect(() => {
    if (mood === 'happy' && !inSpecialAnimationRef.current) {
      console.log('Happy mood detected, setting up forceful return to idle');
      inSpecialAnimationRef.current = true;
      
      // Clear any existing timers
      if (specialAnimationTimerRef.current) {
        clearTimeout(specialAnimationTimerRef.current);
      }
      
      // Set a timer to force return to idle state
      specialAnimationTimerRef.current = setTimeout(() => {
        console.log('Forcing idle animation after happy state');
        if (rive) {
          // First stop all animations
          rive.stop();
          
          // Force play idle animation directly on Rive instance
          setTimeout(() => {
            rive.play('Idle 1');
            // Reset the special animation flag
            inSpecialAnimationRef.current = false;
          }, 20);
        }
      }, 1800); // Slightly longer than animation duration to ensure it completes
      
      return () => {
        if (specialAnimationTimerRef.current) {
          clearTimeout(specialAnimationTimerRef.current);
        }
      };
    } else if (mood !== 'happy' && inSpecialAnimationRef.current) {
      // Reset the flag if mood changed from happy to something else
      inSpecialAnimationRef.current = false;
    }
  }, [mood, rive]);

  // Handle speaking state changes
  useEffect(() => {
    if (isSpeaking !== prevSpeakingRef.current) {
      console.log(`Speaking state changed to: ${isSpeaking}`);
      setSpeaking(isSpeaking);
      prevSpeakingRef.current = isSpeaking;
    }
  }, [isSpeaking, setSpeaking]);

  // Handle mood changes when not speaking
  useEffect(() => {
    if (!isSpeaking && mood !== prevMoodRef.current) {
      console.log(`Mood changed to: ${mood}`);
      const animationType = mapMoodToAnimation(mood);
      queueAnimation(animationType);
      prevMoodRef.current = mood;
    }
  }, [mood, isSpeaking, mapMoodToAnimation, queueAnimation]);

  // Handle connection event
  useEffect(() => {
    if (onConnect && !onConnectRef.current) {
      console.log('Connection detected, playing welcome animation');
      triggerConnectAnimation();
    }
    onConnectRef.current = onConnect;
  }, [onConnect, triggerConnectAnimation]);

  // Handle new problem event
  useEffect(() => {
    if (onNewProblem && !onNewProblemRef.current) {
      console.log('New problem detected, playing question animation');
      triggerNewProblemAnimation();
    }
    onNewProblemRef.current = onNewProblem;
  }, [onNewProblem, triggerNewProblemAnimation]);

  // Play current animation with proper stop/start sequence
  useEffect(() => {
    if (!rive) return;
    
    try {
      // First stop any current animations to ensure clean state
      rive.stop();
      
      // Add a tiny delay to ensure animation state is reset
      setTimeout(() => {
        try {
          // Check if the animation exists in the Rive file
          if (rive.animationNames.includes(currentAnimation)) {
            rive.play(currentAnimation);
            console.log(`Playing Rive animation: ${currentAnimation}`);
            
            // Special handling for the problematic "Happy Smile" animation
            if (currentAnimation === 'Happy Smile') {
              setTimeout(() => {
                console.log("Forcefully stopping Happy Smile animation after its expected duration");
                rive.stop();
                setTimeout(() => {
                  rive.play('Idle 1');
                }, 20);
              }, 1500); // Match the expected duration of Happy Smile
            }
          } else {
            console.warn(`Animation "${currentAnimation}" not found, defaulting to Idle 1`);
            rive.play('Idle 1');
          }
        } catch (innerError) {
          console.error('Error playing animation in timeout:', innerError);
        }
      }, 10);
    } catch (error) {
      console.error('Error stopping animation:', error);
      
      // Recovery attempt
      try {
        rive.stop();
        rive.play('Idle 1');
      } catch (e) {
        console.error('Failed to recover with Idle 1:', e);
      }
    }
  }, [currentAnimation, rive]);

  // Get state class based on speaking/mood
  const getStateClass = () => {
    if (isSpeaking) return 'character-state-talking';
    switch (mood) {
      case 'happy': return 'character-state-happy';
      case 'talking': return 'character-state-talking';
      default: return '';
    }
  };

  // Determine size class based on theater mode
  const getSizeClass = () => {
    return `tutor-character-${size}`;
  };

  return (
    <div 
      className={`tutor-character-container ${getSizeClass()} ${getStateClass()} ${className}`}
      data-theater-mode={isTheaterMode ? 'true' : 'false'}
      data-speaking={isSpeaking ? 'true' : 'false'}
      data-mood={mood}
      data-animation={currentAnimation}
    >
      {loadError ? (
        <div className="error-message text-red-500 text-sm p-2">
          {loadError}
        </div>
      ) : (
        <RiveComponent />
      )}
    </div>
  );
};

export default TutorCharacter;