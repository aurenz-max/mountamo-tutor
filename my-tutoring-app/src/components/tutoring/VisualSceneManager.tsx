import React, { useEffect, useState } from 'react';
import { visualContentApi, ImageInfo } from '@/lib/visualContentApi';

interface WorkspaceImage {
  id: string;
  image: ImageInfo;
  position: { x: number; y: number };
}

interface VisualSceneManagerProps {
  scene: any; // The scene data received from the API
  workspaceRef: React.RefObject<HTMLDivElement>; // Reference to the workspace element
  onImagesCreated: (images: WorkspaceImage[]) => void; // Callback to notify parent of new images
}

/**
 * Component responsible for managing visual scenes
 * It processes scene data and translates it into workspace images
 */
const VisualSceneManager: React.FC<VisualSceneManagerProps> = ({ 
  scene, 
  workspaceRef, 
  onImagesCreated 
}) => {
  // Keep track of processed scene IDs
  const [processedSceneIds, setProcessedSceneIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Process the scene when it changes
  useEffect(() => {
    if (!scene) return;
    
    // Extract scene ID or create a unique identifier
    const sceneId = scene.scene_id || scene.id || `scene_${Date.now()}`;
    
    // Skip if we've already processed this scene
    if (processedSceneIds.has(sceneId) || isProcessing) return;
    
    console.log('Processing new visual scene:', sceneId, scene);
    setIsProcessing(true);
    
    // Process the scene data and create visual elements
    processScene(scene, sceneId).finally(() => {
      // Mark scene as processed
      setProcessedSceneIds(prev => new Set([...prev, sceneId]));
      setIsProcessing(false);
    });
  }, [scene, processedSceneIds]);

  /**
   * Process scene data and create visual elements
   */
  const processScene = async (sceneData: any, sceneId: string) => {
    try {
      console.log('Processing scene data:', sceneData);
      
      // Array to store created workspace images
      const workspaceImages: WorkspaceImage[] = [];
      
      // NEW STRUCTURE: Objects have count property
      if (sceneData.objects && Array.isArray(sceneData.objects)) {
        console.log('Processing objects with count properties:', sceneData.objects);
        
        let totalPositionIndex = 0; // Index for position calculation across all objects
        const totalCount = sceneData.total_count || 
                          sceneData.objects.reduce((sum: number, obj: any) => sum + (obj.count || 1), 0);
        
        // Process each object entry
        for (const obj of sceneData.objects) {
          // Determine how many instances of this object to create
          const count = obj.count || 1;
          
          // Fetch the image data if not included
          let imageData: ImageInfo | null = null;
          if (obj.image_data) {
            imageData = obj.image_data;
          } else if (obj.id) {
            const imageResponse = await visualContentApi.getVisualImage(obj.id);
            if (imageResponse.status === 'success' && imageResponse.image) {
              imageData = imageResponse.image;
            }
          }
          
          if (imageData) {
            // Create multiple instances of this image based on count
            for (let i = 0; i < count; i++) {
              // Calculate position based on the layout and total position index
              const position = calculatePosition(
                totalPositionIndex,
                totalCount,
                sceneData.layout || 'grid',
                workspaceRef.current
              );
              
              // Create workspace image
              workspaceImages.push({
                id: `${sceneId}_${obj.id}_${i}_${Date.now()}`,
                image: imageData,
                position: position
              });
              
              // Increment the total position index
              totalPositionIndex++;
            }
          }
        }
      }
      // LEGACY: Handle older API formats
      else if (sceneData.count || sceneData.image_count) {
        console.log('Using legacy format with count:', sceneData.count || sceneData.image_count);
        
        const count = sceneData.count || sceneData.image_count || 1;
        let objectId = sceneData.object_id;
        
        // If no object_id, try to parse from message
        if (!objectId && sceneData.message) {
          const match = sceneData.message.match(/with\s+\d+\s+([A-Za-z0-9-_]+)/i);
          if (match && match.length >= 2) {
            objectId = match[1];
          }
        }
        
        if (objectId) {
          // Fetch the image
          const imageResponse = await visualContentApi.getVisualImage(objectId);
          
          if (imageResponse.status === 'success' && imageResponse.image) {
            // Create multiple instances of this image
            for (let i = 0; i < count; i++) {
              const position = calculatePosition(
                i, 
                count, 
                sceneData.layout || 'grid', 
                workspaceRef.current
              );
              
              workspaceImages.push({
                id: `${sceneId}_${i}_${Date.now()}`,
                image: imageResponse.image,
                position: position
              });
            }
          }
        }
      }
      
      // Notify parent of the created images
      if (workspaceImages.length > 0) {
        console.log(`Created ${workspaceImages.length} workspace images for scene ${sceneId}`);
        onImagesCreated(workspaceImages);
      } else {
        console.warn('No workspace images created from scene data');
      }
    } catch (error) {
      console.error('Error processing scene:', error);
    }
  };

  /**
   * Calculate position for an object in the scene
   */
  const calculatePosition = (
    index: number, 
    total: number, 
    layout: string,
    container: HTMLDivElement | null
  ): { x: number; y: number } => {
    if (!container) {
      return { x: 50, y: 50 }; // Default position if no container
    }
    
    const rect = container.getBoundingClientRect();
    const padding = 40; // Padding from edges
    
    // For 'random' layout, use random positions
    if (layout === 'random') {
      return {
        x: Math.floor(Math.random() * (rect.width - 120) + 60),
        y: Math.floor(Math.random() * (rect.height - 120) + 60)
      };
    }
    
    // For 'circle' layout, arrange in a circle
    if (layout === 'circle') {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) / 3;
      const angle = (2 * Math.PI * index) / total;
      
      return {
        x: centerX + radius * Math.cos(angle) - 30,
        y: centerY + radius * Math.sin(angle) - 30
      };
    }
    
    // Default to 'grid' layout
    const availableWidth = rect.width - (padding * 2);
    const availableHeight = rect.height - (padding * 2);
    
    // Determine grid dimensions based on total count
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    
    // Calculate grid cell size
    const cellWidth = availableWidth / cols;
    const cellHeight = availableHeight / rows;
    
    // Calculate row and column for this index
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    // Calculate center of the cell
    return {
      x: padding + (col * cellWidth) + (cellWidth / 2) - 30, // Offset by half image width
      y: padding + (row * cellHeight) + (cellHeight / 2) - 30 // Offset by half image height
    };
  };

  // This component doesn't render anything
  return null;
};

export default VisualSceneManager;