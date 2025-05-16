import React, { useState, useEffect } from 'react';

/**
 * SceneDisplay component for rendering visual scenes in the workspace
 * This component handles displaying the objects from a scene and 
 * allows basic interaction with them
 */
const SceneDisplay = ({ scene, onSceneUpdate }) => {
  const [objects, setObjects] = useState([]);

  useEffect(() => {
    if (scene) {
      // Process the scene data to extract objects
      extractSceneObjects(scene);
    }
  }, [scene]);

  const extractSceneObjects = (sceneData) => {
    let extractedObjects = [];

    if (sceneData.content_type === 'counting_scene') {
      // For counting scenes, create multiple instances of the same object
      const imageData = sceneData.data.image_data;
      const count = sceneData.data.count || 1;
      
      // Create the specified number of objects
      for (let i = 0; i < count; i++) {
        extractedObjects.push({
          id: `${sceneData.scene_id}_obj_${i}`,
          imageData: imageData,
          position: generateRandomPosition(i, count),
        });
      }
    } else if (sceneData.content_type === 'multi_object_scene') {
      // For multi-object scenes, handle each object type
      if (sceneData.objects) {
        extractedObjects = sceneData.objects.map((obj, index) => ({
          id: obj.id || `${sceneData.scene_id}_obj_${index}`,
          imageData: obj,
          position: generateRandomPosition(index, sceneData.objects.length),
        }));
      }
    }

    setObjects(extractedObjects);
  };

  // Generate semi-random positions for initial object placement
  const generateRandomPosition = (index, totalCount) => {
    // Create a grid-like arrangement
    const COLUMNS = Math.ceil(Math.sqrt(totalCount));
    const col = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    
    // Add some randomness to make it look more natural
    const randomOffset = () => (Math.random() - 0.5) * 10;
    
    return {
      left: `${(col * (100 / COLUMNS)) + 5 + randomOffset()}%`,
      top: `${(row * (80 / Math.ceil(totalCount / COLUMNS))) + 10 + randomOffset()}%`,
    };
  };

  // Handle object click/selection
  const handleObjectClick = (objectId) => {
    // Could implement selection, highlighting, etc.
    console.log(`Object clicked: ${objectId}`);
  };

  // Render the scene objects
  return (
    <div className="scene-display">
      {objects.map((object) => (
        <div
          key={object.id}
          className="scene-object"
          style={{
            left: object.position.left,
            top: object.position.top,
          }}
          onClick={() => handleObjectClick(object.id)}
        >
          {object.imageData.type === 'svg' ? (
            <div dangerouslySetInnerHTML={{ __html: object.imageData.data_uri }} />
          ) : (
            <img
              src={object.imageData.data_uri}
              alt={object.imageData.name || 'Scene object'}
            />
          )}
        </div>
      ))}
      
      {objects.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-400">
          No objects in this scene
        </div>
      )}
    </div>
  );
};

export default SceneDisplay;