// app/components/rive/RiveAnimation.tsx
import { useRive } from '@rive-app/react-canvas';
import { useEffect } from 'react';

interface RiveAnimationProps {
  animationName?: string;
  src?: string;
}

export default function RiveAnimation({ 
  animationName = 'Idle 1',
  src = '/animations/elemental.riv' 
}: RiveAnimationProps) {
  const { rive, RiveComponent } = useRive({
    src: src,
    autoplay: true,
    animations: animationName,
  });

  // Update animation when prop changes
  useEffect(() => {
    if (rive && animationName) {
      rive.play(animationName);
    }
  }, [animationName, rive]);

  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}