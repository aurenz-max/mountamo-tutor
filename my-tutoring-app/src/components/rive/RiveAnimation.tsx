// app/components/rive/RiveAnimation.tsx
import { useRive } from '@rive-app/react-canvas';
import { useState } from 'react';

export default function RiveAnimation() {
  // Replace these with the actual animation names from your console.log output
  const availableAnimations = [
    'Wave',
    'Happy Smile',
    'Question',
    'Talking 1',
    'Talking 2',
    'Idle 1',
    'Idle 2'
  ];

  const [currentAnimation, setCurrentAnimation] = useState(availableAnimations[0]);

  const { rive, RiveComponent } = useRive({
    src: '/animations/elemental.riv',
    autoplay: true,
    animations: currentAnimation,
  });

  const playAnimation = (animationName) => {
    if (rive) {
      rive.play(animationName);
      setCurrentAnimation(animationName);
    }
  };

  return (
    <div>
      <div style={{ 
        width: '300px', 
        height: '300px', 
        border: '1px solid #eee',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <RiveComponent />
      </div>
      
      <div style={{ 
        marginTop: '15px', 
        display: 'flex', 
        flexWrap: 'wrap',
        gap: '8px' 
      }}>
        {availableAnimations.map(animation => (
          <button
            key={animation}
            onClick={() => playAnimation(animation)}
            style={{
              padding: '8px 12px',
              background: currentAnimation === animation ? '#4a90e2' : '#f0f0f0',
              color: currentAnimation === animation ? 'white' : 'black',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {animation}
          </button>
        ))}
      </div>
    </div>
  );
}