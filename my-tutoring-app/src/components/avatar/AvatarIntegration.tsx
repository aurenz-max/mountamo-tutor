// @/components/avatar/AvatarIntegration.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Minimize2, Maximize2, Move } from 'lucide-react';
import AvatarCanvas from './AvatarCanvas';
import BackgroundOptions from './BackgroundOptions';
import { cn } from '@/lib/utils'; // Assuming you have this utility for class merging

const AvatarIntegration = () => {
  // State for controlling the avatar UI
  const [isMinimized, setIsMinimized] = useState(false);
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [availableAnimations, setAvailableAnimations] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Use refs for position to avoid re-renders during drag
  const positionRef = useRef({ right: 20, bottom: 20 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const avatarApiRef = useRef(null);

  if (typeof window !== 'undefined') {
    if (!window.avatarAPI) {
      window.avatarAPI = {
        avatar: null,
        setAvatar: (avatar) => {
          window.avatarAPI.avatar = avatar;
          console.log('GLOBAL AVATAR API: Avatar set', !!avatar);
          
          // Notify any listeners
          if (window.avatarAPI.onAvatarReady) {
            window.avatarAPI.onAvatarReady(avatar);
          }
        },
        onAvatarReady: null
      };
    }
  }

// Then update the handleAvatarReady function:
const handleAvatarReady = (api) => {
  console.log('AVATAR INTEGRATION: Avatar ready event received', api);
  avatarApiRef.current = api;
  
  // Get available animations
  if (api.getAvailableAnimations) {
    setAvailableAnimations(api.getAvailableAnimations());
  }
  
  // Get current animation
  if (api.getCurrentAnimation) {
    setCurrentAnimation(api.getCurrentAnimation());
  }
  
  // Try to find and play an idle animation
  if (api.playAnimation) {
    const animations = api.getAvailableAnimations();
    const idleAnimation = animations.find(name => 
      name.toLowerCase().includes('idle') || 
      name.toLowerCase().includes('static')
    );
    
    if (idleAnimation) {
      api.playAnimation(idleAnimation);
      setCurrentAnimation(idleAnimation);
    }
  }
  
  // Expose the avatar globally
  if (api.avatar && typeof window !== 'undefined') {
    console.log('AVATAR INTEGRATION: Exposing avatar to global API');
    window.avatarAPI.setAvatar(api.avatar);
  } else {
    console.warn('AVATAR INTEGRATION: No avatar object in API');
  }
};
    
  // Handle background color change
  const handleBackgroundChange = (color) => {
    setBackgroundColor(color);
    // Update background in scene if available
    if (avatarApiRef.current && avatarApiRef.current.scene && avatarApiRef.current.scene.background) {
      avatarApiRef.current.scene.background.set(color);
    }
    setShowBackgroundOptions(false);
  };

  // Handle drag start
  const handleDragStart = (e) => {
    if (!containerRef.current) return;
    
    setIsDragging(true);
    
    // Save the initial mouse position
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    
    // Get current positioned values for the container
    const computedStyle = window.getComputedStyle(containerRef.current);
    const right = parseInt(computedStyle.right) || 20;
    const bottom = parseInt(computedStyle.bottom) || 20;
    
    // Store the initial position
    positionRef.current = { right, bottom };
    
    // Prevent text selection during drag
    e.preventDefault();
    document.body.style.userSelect = 'none';
  };

  // Handle drag move
  const handleDragMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    
    // Calculate how much the mouse has moved
    const deltaX = dragStartRef.current.x - e.clientX;
    const deltaY = dragStartRef.current.y - e.clientY;
    
    // Update the container position (right/bottom values)
    containerRef.current.style.right = `${positionRef.current.right + deltaX}px`;
    containerRef.current.style.bottom = `${positionRef.current.bottom + deltaY}px`;
  };

  // Handle drag end
  const handleDragEnd = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    document.body.style.userSelect = '';
    
    // Update the position reference with final position
    if (containerRef.current) {
      const computedStyle = window.getComputedStyle(containerRef.current);
      const right = parseInt(computedStyle.right) || 20;
      const bottom = parseInt(computedStyle.bottom) || 20;
      positionRef.current = { right, bottom };
    }
  };

  // Add and remove event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed shadow-lg rounded-lg overflow-hidden z-50 bg-background",
        isDragging && "opacity-90"
      )}
      style={{
        right: '20px',
        bottom: '20px',
        width: 'auto',
      }}
    >
      {/* Control bar */}
      <div 
        className="bg-background border-b flex items-center justify-between px-3 py-2"
        onMouseDown={handleDragStart}
        style={{ cursor: 'grab' }}
      >
        <div className="flex items-center gap-2">
          <Move size={14} className="text-muted-foreground" />
          <span className="text-xs font-medium">AI Tutor Avatar</span>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={() => setShowBackgroundOptions(!showBackgroundOptions)}
            className="p-1 rounded-sm hover:bg-accent hover:text-accent-foreground focus:outline-none"
            title="Change Background"
          >
            <div 
              className="w-3 h-3 rounded-sm border border-input"
              style={{ backgroundColor: backgroundColor }}
            />
          </button>
          
          <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-sm hover:bg-accent hover:text-accent-foreground focus:outline-none ml-2"
            aria-label={isMinimized ? "Maximize" : "Minimize"}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
        </div>
      </div>
      
      {/* Background options */}
      {showBackgroundOptions && !isMinimized && (
        <div className="border-b">
          <BackgroundOptions onSelectBackground={handleBackgroundChange} />
        </div>
      )}
      
      {/* Avatar canvas */}
      <div className="w-64 h-64" style={{ display: isMinimized ? 'none' : 'block' }}>
        <AvatarCanvas 
          backgroundColor={backgroundColor}
          onSceneReady={handleAvatarReady}
          isVisible={!isMinimized}
        />
      </div>
      
    </div>
  );
};

export default AvatarIntegration;