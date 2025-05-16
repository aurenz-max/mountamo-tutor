import { useEffect } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';

/**
 * Custom hook for working with Rive animations in the tutoring app
 */
export const useRiveAnimation = (options) => {
  const {
    src = '/animations/water-character.riv',
    stateMachine = 'State Machine 1',
    autoplay = true,
    tutorState = 'idle', // idle, talking, waving, happy, questioning
  } = options;

  const { rive, RiveComponent } = useRive({
    src,
    stateMachines: stateMachine,
    autoplay,
  });

  // Map tutoring app states to animation states
  useEffect(() => {
    if (!rive) return;

    // Clear any currently playing animations
    rive.stop();

    // Play the appropriate animation based on tutor state
    switch (tutorState) {
      case 'talking':
        rive.play('Talking 1');
        break;
      case 'waving':
        rive.play('Wave');
        break;
      case 'happy':
        rive.play('Happy Smile');
        break;
      case 'questioning':
        rive.play('Question');
        break;
      case 'idle':
      default:
        // Choose between multiple idle animations randomly for more natural behavior
        const idleAnimations = ['Idle 1', 'Idle 2'];
        const randomIdle = idleAnimations[Math.floor(Math.random() * idleAnimations.length)];
        rive.play(randomIdle);
    }
  }, [rive, tutorState]);

  // Function to manually trigger animations
  const triggerAnimation = (animationName) => {
    if (rive) {
      rive.play(animationName);
    }
  };

  return {
    rive,
    RiveComponent,
    triggerAnimation,
  };
};