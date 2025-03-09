"use client";

import { useState, useRef, useEffect } from 'react';
import AvatarCanvas from '@/components/avatar/AvatarCanvas';
import CameraPositionHelper from '@/components/avatar/CameraPositionHelper';
import AnimationControls from '@/components/avatar/AnimationControls';
import BackgroundOptions from '@/components/avatar/BackgroundOptions';
import SimpleVisemeTester from '@/components/avatar/SimpleVisemeTester';

export default function Home() {
  // Avatar state
  const [avatarApi, setAvatarApi] = useState(null);
  const [availableAnimations, setAvailableAnimations] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');
  const [showCameraHelper, setShowCameraHelper] = useState(false);
  const [showAnimationControls, setShowAnimationControls] = useState(false);
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  const [showVisemeTester, setShowVisemeTester] = useState(true);
  
  // Camera/controls refs
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationManagerRef = useRef(null);
  const visemeHandlerRef = useRef(null);
  
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
    
    // Create viseme handler with our simplified implementation
    if (api.avatar) {
      try {
        // Import the createSimpleVisemeHandler function
        import('@/lib/VisemeHandler').then(({ createSimpleVisemeHandler }) => {
          console.log('Creating simple viseme handler for testing');
          const handler = createSimpleVisemeHandler(api.avatar);
          
          visemeHandlerRef.current = handler;
          console.log('Simple viseme handler created:', !!handler);
          
          // Test that it works
          setTimeout(() => {
            if (handler) {
              console.log('Testing simple viseme handler with test function');
              handler.testViseme(10); // Test 'PP' viseme
            }
          }, 1000);
        }).catch(error => {
          console.error('Error importing SimpleVisemeHandler:', error);
        });
      } catch (error) {
        console.error('Failed to create simple viseme handler:', error);
      }
    }
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
        Avatar Viseme Tester
      </h1>
      
      {/* Main content area */}
      <div style={{ padding: '20px' }}>
        <p>This page lets you test your avatar's visemes and animations.</p>
        <p>Use the viseme tester below to trigger different viseme shapes on your avatar.</p>
        
        {/* Simple Viseme Tester - Always visible for easier testing */}
        <div style={{ marginTop: '20px' }}>
          <SimpleVisemeTester visemeHandler={visemeHandlerRef.current} />
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={() => setShowAnimationControls(!showAnimationControls)}
            style={{
              padding: '8px 16px',
              backgroundColor: showAnimationControls ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              marginRight: '10px'
            }}
          >
            {showAnimationControls ? 'Hide Animations' : 'Show Animations'}
          </button>
          
          <button
            onClick={() => setShowCameraHelper(!showCameraHelper)}
            style={{
              padding: '8px 16px',
              backgroundColor: showCameraHelper ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {showCameraHelper ? 'Hide Camera Controls' : 'Show Camera Controls'}
          </button>
        </div>
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
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Avatar</span>
          <div style={{ display: 'flex', gap: '8px' }}>
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
                borderRadius: '2px'
              }}></div>
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