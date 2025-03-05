"use client";

import { useState, useRef, useEffect } from 'react';
import AvatarCanvas from '@/components/avatar/AvatarCanvas';
import CameraPositionHelper from '@/components/avatar/CameraPositionHelper';
import AnimationControls from '@/components/avatar/AnimationControls';
import BackgroundOptions from '@/components/avatar/BackgroundOptions';

export default function Home() {
  // Avatar state
  const [avatarApi, setAvatarApi] = useState(null);
  const [availableAnimations, setAvailableAnimations] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [showCameraHelper, setShowCameraHelper] = useState(false);
  const [showAnimationControls, setShowAnimationControls] = useState(false);
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  
  // Camera/controls refs
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationManagerRef = useRef(null);
  
  // Handle avatar initialization
  const handleAvatarReady = (api) => {
    setAvatarApi(api);
    
    // Store references to camera, controls, and animation manager
    cameraRef.current = api.camera;
    controlsRef.current = api.controls;
    animationManagerRef.current = api.animationManager;
    
    // Get available animations
    if (api.getAvailableAnimations) {
      setAvailableAnimations(api.getAvailableAnimations());
    }
    
    // Get current animation
    if (api.getCurrentAnimation) {
      setCurrentAnimation(api.getCurrentAnimation());
    }
    
    console.log("Avatar initialized with animations:", api.getAvailableAnimations());
  };
  
  // Handle animation selection
  const handleAnimationChange = (animationName) => {
    setCurrentAnimation(animationName);
    if (avatarApi && avatarApi.playAnimation) {
      avatarApi.playAnimation(animationName);
    }
  };
  
  // Handle background color change
  const handleBackgroundChange = (color) => {
    setBackgroundColor(color);
    // Update background in scene if available
    if (avatarApi && avatarApi.scene && avatarApi.scene.background) {
      avatarApi.scene.background.set(color);
    }
  };

  return (
    <div>
      <h1 style={{ 
        fontFamily: 'Arial, sans-serif', 
        paddingLeft: '20px',
        marginTop: '20px'
      }}>
        My Tutoring App
      </h1>
      
      {/* Main content area */}
      <div style={{ padding: '20px' }}>
        <p>This is where your tutoring content would go.</p>
        <p>The avatar helper is positioned in the bottom right corner.</p>
      </div>
      
      {/* Avatar container with controls */}
      <div style={{ 
        position: 'fixed', 
        right: '20px', 
        bottom: '20px', 
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}>
        {/* Control bar */}
        <div style={{
          backgroundColor: '#f0f0f0',
          borderRadius: '8px 8px 0 0',
          padding: '5px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '240px',
          borderBottom: '1px solid #ddd'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>AI Tutor Avatar</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setShowCameraHelper(!showCameraHelper)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 5px'
              }}
              title="Camera Helper"
            >
              📷
            </button>
            <button 
              onClick={() => {
                setShowAnimationControls(!showAnimationControls);
                setShowBackgroundOptions(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 5px'
              }}
              title="Animation Controls"
            >
              🎭
            </button>
            <button 
              onClick={() => {
                setShowBackgroundOptions(!showBackgroundOptions);
                setShowAnimationControls(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 5px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Change Background"
            >
              <div style={{ 
                width: '14px', 
                height: '14px', 
                backgroundColor: backgroundColor,
                border: '1px solid #999',
                borderRadius: '2px',
                marginRight: '2px'
              }}></div>
              <span>🎨</span>
            </button>
          </div>
        </div>
        
        {/* Animation controls */}
        {showAnimationControls && (
          <AnimationControls 
            animations={availableAnimations}
            currentAnimation={currentAnimation}
            onAnimationSelect={handleAnimationChange}
            animationManager={animationManagerRef.current}
          />
        )}
        
        {/* Background options */}
        {showBackgroundOptions && (
          <BackgroundOptions onSelectBackground={handleBackgroundChange} />
        )}
        
        {/* Avatar canvas */}
        <AvatarCanvas 
          backgroundColor={backgroundColor}
          onSceneReady={handleAvatarReady}
        />
        
        {/* Camera position helper - conditionally rendered */}
        {showCameraHelper && cameraRef.current && controlsRef.current && (
          <CameraPositionHelper
            camera={cameraRef.current}
            controls={controlsRef.current}
          />
        )}
      </div>
    </div>
  );
}