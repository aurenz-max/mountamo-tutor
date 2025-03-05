// CameraPositionHelper.js
'use client';

import React, { useState, useEffect } from 'react';

/**
 * Helper component that displays current camera position and allows saving/loading positions
 * @param {Object} props
 * @param {THREE.Camera} props.camera - The Three.js camera instance
 * @param {THREE.OrbitControls} props.controls - The OrbitControls instance
 */
const CameraPositionHelper = ({ camera, controls }) => {
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0, z: 0 });
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0, z: 0 });
  const [savedPositions, setSavedPositions] = useState([]);
  const [positionName, setPositionName] = useState('');

  // Update displayed position when camera moves
  useEffect(() => {
    if (!camera || !controls) return;

    const updatePositionDisplay = () => {
      setCameraPosition({
        x: parseFloat(camera.position.x.toFixed(2)),
        y: parseFloat(camera.position.y.toFixed(2)),
        z: parseFloat(camera.position.z.toFixed(2))
      });
      setTargetPosition({
        x: parseFloat(controls.target.x.toFixed(2)),
        y: parseFloat(controls.target.y.toFixed(2)),
        z: parseFloat(controls.target.z.toFixed(2))
      });
    };

    // Add event listener to orbit controls change event
    controls.addEventListener('change', updatePositionDisplay);
    
    // Initial update
    updatePositionDisplay();

    // Try to load any saved positions from localStorage
    try {
      const storedPositions = localStorage.getItem('avatarCameraPositions');
      if (storedPositions) {
        setSavedPositions(JSON.parse(storedPositions));
      }
    } catch (error) {
      console.error('Failed to load saved positions:', error);
    }

    return () => {
      controls.removeEventListener('change', updatePositionDisplay);
    };
  }, [camera, controls]);

  // Save current position
  const saveCurrentPosition = () => {
    if (!positionName.trim()) return;

    const newPosition = {
      name: positionName,
      camera: { ...cameraPosition },
      target: { ...targetPosition }
    };

    const updatedPositions = [...savedPositions, newPosition];
    setSavedPositions(updatedPositions);
    setPositionName('');

    // Save to localStorage
    try {
      localStorage.setItem('avatarCameraPositions', JSON.stringify(updatedPositions));
    } catch (error) {
      console.error('Failed to save positions:', error);
    }
  };

  // Load a saved position
  const loadPosition = (position) => {
    if (!camera || !controls) return;

    camera.position.set(
      position.camera.x,
      position.camera.y,
      position.camera.z
    );

    controls.target.set(
      position.target.x,
      position.target.y,
      position.target.z
    );

    controls.update();
  };

  // Delete a saved position
  const deletePosition = (index) => {
    const updatedPositions = savedPositions.filter((_, i) => i !== index);
    setSavedPositions(updatedPositions);

    // Update localStorage
    try {
      localStorage.setItem('avatarCameraPositions', JSON.stringify(updatedPositions));
    } catch (error) {
      console.error('Failed to update positions:', error);
    }
  };

  // Copy position as setup code
  const copyAsCode = (position) => {
    const code = `
// Camera setup code
camera.position.set(${position.camera.x}, ${position.camera.y}, ${position.camera.z});
controls.target.set(${position.target.x}, ${position.target.y}, ${position.target.z});
controls.update();
    `.trim();
    
    navigator.clipboard.writeText(code)
      .then(() => alert('Code copied to clipboard!'))
      .catch(err => console.error('Failed to copy code:', err));
  };

  return (
    <div className="camera-position-helper" style={{
      position: 'absolute',
      right: '10px',
      top: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      width: '220px',
      fontSize: '12px',
      zIndex: 1000
    }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>Camera Position Helper</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <div>Camera: X: {cameraPosition.x} Y: {cameraPosition.y} Z: {cameraPosition.z}</div>
        <div>Target: X: {targetPosition.x} Y: {targetPosition.y} Z: {targetPosition.z}</div>
      </div>
      
      <div style={{ display: 'flex', marginBottom: '10px' }}>
        <input
          type="text"
          value={positionName}
          onChange={(e) => setPositionName(e.target.value)}
          placeholder="Position name"
          style={{ 
            flex: '1', 
            marginRight: '5px',
            padding: '4px',
            fontSize: '12px'
          }}
        />
        <button
          onClick={saveCurrentPosition}
          style={{ 
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Save
        </button>
      </div>
      
      {savedPositions.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 5px 0', fontSize: '13px' }}>Saved Positions</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {savedPositions.map((position, index) => (
              <div key={index} style={{ 
                marginBottom: '5px',
                padding: '5px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{position.name}</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => loadPosition(position)}
                    style={{ flex: '1', fontSize: '11px', padding: '2px 0' }}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => copyAsCode(position)}
                    style={{ flex: '1', fontSize: '11px', padding: '2px 0' }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => deletePosition(index)}
                    style={{ fontSize: '11px', padding: '2px 4px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraPositionHelper;