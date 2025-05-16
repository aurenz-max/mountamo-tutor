// AnimationControls.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAudioState } from '@/components/audio/AudioStateContext';

/**
 * Enhanced animation controls with additional functionality
 * @param {Object} props
 * @param {string[]} props.animations - Array of available animation names
 * @param {string} props.currentAnimation - Name of currently playing animation
 * @param {Function} props.onAnimationSelect - Function to call when an animation is selected
 * @param {Object} props.animationManager - Reference to the animation manager
 */
const AnimationControls = ({ 
  animations = [], 
  currentAnimation = '', 
  onAnimationSelect = () => {},
  animationManager = null
}) => {
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [loopAnimation, setLoopAnimation] = useState(true);
  const [playbackMode, setPlaybackMode] = useState('single'); // 'single', 'sequence', 'random'
  const [autoPlayDuration, setAutoPlayDuration] = useState(5); // seconds
  
  // Get the audio state from context
  const { audioState } = useAudioState();

  // Change animation with playback settings
  const playAnimation = (animationName) => {
    // Don't allow manual animation changes when Gemini is speaking
    if (audioState.isGeminiSpeaking) {
      return;
    }
    
    if (!animationManager) {
      onAnimationSelect(animationName);
      return;
    }

    const options = {
      loop: loopAnimation,
      timeScale: playbackSpeed,
      fadeTime: 0.5, // Cross-fade duration
      clampWhenFinished: !loopAnimation
    };

    // Play the animation with custom settings
    if (animationManager.play) {
      animationManager.play(animationName, options);
    } else {
      // Fallback to basic selection if manager not available
      onAnimationSelect(animationName);
    }
  };

  // Helper to categorize animations
  const categorizeAnimations = () => {
    const categories = {
      idle: [],
      talking: [],
      gestures: [],
      other: []
    };

    animations.forEach(anim => {
      const lowerName = anim.toLowerCase();
      if (lowerName.includes('idle') || lowerName.includes('stand')) {
        categories.idle.push(anim);
      } else if (lowerName.includes('talk') || lowerName.includes('speak')) {
        categories.talking.push(anim);
      } else if (lowerName.includes('gesture') || lowerName.includes('hand') || 
                lowerName.includes('point') || lowerName.includes('wave')) {
        categories.gestures.push(anim);
      } else {
        categories.other.push(anim);
      }
    });

    return categories;
  };

  const categories = categorizeAnimations();

  // Render a category of animations
  const renderCategory = (title, animationList) => {
    if (animationList.length === 0) return null;
    
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', 
                     display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{title}</span>
          {title === 'Talking' && audioState.isGeminiSpeaking && (
            <span style={{ 
              fontSize: '9px', 
              backgroundColor: '#d1fae5', 
              color: '#065f46', 
              padding: '1px 4px',
              borderRadius: '9999px',
              animation: 'pulse 2s infinite'
            }}>
              Auto
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {animationList.map((animation) => (
            <button
              key={animation}
              onClick={() => playAnimation(animation)}
              disabled={audioState.isGeminiSpeaking && title === 'Talking'}
              style={{
                backgroundColor: currentAnimation === animation ? '#007bff' : '#ffffff',
                color: currentAnimation === animation ? '#ffffff' : '#333333',
                border: '1px solid #dddddd',
                borderRadius: '4px',
                padding: '5px 8px',
                fontSize: '11px',
                cursor: audioState.isGeminiSpeaking && title === 'Talking' ? 'not-allowed' : 'pointer',
                flex: '1 0 auto',
                minWidth: '75px',
                maxWidth: '120px',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                opacity: audioState.isGeminiSpeaking && title === 'Talking' ? 0.5 : 1
              }}
              title={animation}
            >
              {animation}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // No animations available message
  if (animations.length === 0) {
    return (
      <div style={{
        padding: '8px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#666'
      }}>
        No animations available
      </div>
    );
  }

  return (
    <div className="animation-controls" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '8px',
      backgroundColor: '#f0f0f0',
      borderRadius: '4px',
      maxHeight: '300px',
      overflowY: 'auto'
    }}>
      {/* Animation settings */}
      <div style={{ 
        padding: '6px', 
        backgroundColor: '#e0e0e0', 
        borderRadius: '4px',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '11px', marginRight: '8px', width: '70px' }}>
            Speed:
          </label>
          <input
            type="range"
            min="0.25"
            max="2"
            step="0.25"
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            style={{ flex: 1 }}
            disabled={audioState.isGeminiSpeaking}
          />
          <span style={{ fontSize: '11px', marginLeft: '8px', width: '30px' }}>
            {playbackSpeed}x
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ fontSize: '11px', marginRight: '8px', width: '70px' }}>
            Loop:
          </label>
          <input
            type="checkbox"
            checked={loopAnimation}
            onChange={(e) => setLoopAnimation(e.target.checked)}
            disabled={audioState.isGeminiSpeaking}
          />
        </div>
        
        {audioState.isGeminiSpeaking && (
          <div style={{ 
            marginTop: '6px',
            padding: '4px', 
            fontSize: '10px',
            backgroundColor: '#fff8e1',
            color: '#856404',
            borderRadius: '4px',
            textAlign: 'center'
          }}>
            Manual controls disabled while Gemini is speaking
          </div>
        )}
      </div>
      
      {/* Categorized animations */}
      <div style={{ 
        backgroundColor: '#fff', 
        borderRadius: '4px', 
        padding: '8px'
      }}>
        {renderCategory('Idle', categories.idle)}
        {renderCategory('Talking', categories.talking)}
        {renderCategory('Gestures', categories.gestures)}
        {renderCategory('Other', categories.other)}
      </div>
      
      {/* Additional info */}
      <div style={{ fontSize: '10px', color: '#666', textAlign: 'center', padding: '4px' }}>
        Currently playing: <strong>{currentAnimation || 'None'}</strong>
      </div>
    </div>
  );
};

export default AnimationControls;