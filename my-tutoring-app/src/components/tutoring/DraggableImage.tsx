import React, { useState, useRef, useEffect } from 'react';
import { ImageInfo } from '@/lib/visualContentApi';

interface DraggableImageProps {
  image: ImageInfo;
  position: { x: number; y: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onRemove: () => void;
}

const DraggableImage: React.FC<DraggableImageProps> = ({ 
  image, 
  position, 
  onPositionChange, 
  onRemove 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLDivElement>(null);
  
  // Calculate optimal size for the image when it mounts
  useEffect(() => {
    if (image.data_uri) {
      // Check if we have a preview size hint
      if (image._previewSize) {
        setImageSize({
          width: image._previewSize.width,
          height: image._previewSize.height
        });
        return;
      }

      if (image.type === 'svg') {
        // For SVGs, set a default reasonable size
        setImageSize({ width: 60, height: 60 });
        return;
      }

      // For bitmap images, load and calculate proper size
      const img = new Image();
      img.onload = () => {
        const maxWidth = 80;
        const maxHeight = 80;
        
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (newWidth > maxWidth || newHeight > maxHeight) {
          const ratio = Math.min(maxWidth / newWidth, maxHeight / newHeight);
          newWidth = Math.floor(newWidth * ratio);
          newHeight = Math.floor(newHeight * ratio);
        }
        
        setImageSize({ width: newWidth, height: newHeight });
      };
      img.src = image.data_uri;
    }
  }, [image]);

  // Basic drag functionality
  const startDrag = (clientX: number, clientY: number) => {
    if (!imageRef.current) return;
    
    setIsDragging(true);
    
    const rect = imageRef.current.getBoundingClientRect();
    const workspaceRect = document.querySelector('.drawing-workspace')?.getBoundingClientRect();
    
    if (!workspaceRect) return;
    
    // Calculate offset from the image's top-left corner
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    
    const handleMove = (moveX: number, moveY: number) => {
      if (!workspaceRect) return;
      
      // Calculate new position
      const newX = moveX - workspaceRect.left - offsetX;
      const newY = moveY - workspaceRect.top - offsetY;
      
      // Apply bounds
      const boundedX = Math.max(0, Math.min(newX, workspaceRect.width - rect.width));
      const boundedY = Math.max(0, Math.min(newY, workspaceRect.height - rect.height));
      
      onPositionChange({ x: boundedX, y: boundedY });
    };
    
    const mouseMoveHandler = (e: MouseEvent) => {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };
    
    const touchMoveHandler = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    
    const endDrag = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('touchmove', touchMoveHandler);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchend', endDrag);
    };
    
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX, e.clientY);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  };

  return (
    <div 
      ref={imageRef}
      className={`draggable-workspace-image ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
        width: imageSize.width > 0 ? `${imageSize.width}px` : 'auto',
        height: imageSize.height > 0 ? `${imageSize.height}px` : 'auto',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: isDragging ? 1000 : 10
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      title={image.name || ''}
    >
      <div className="image-container" style={{ pointerEvents: 'none' }}>
        {image.type === 'svg' ? (
          <div 
            dangerouslySetInnerHTML={{ __html: image.data_uri || '' }}
            className="svg-container"
          />
        ) : (
          <img 
            src={image.data_uri || '/placeholder-image.png'} 
            alt={image.name || 'Draggable image'} 
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            draggable={false}
          />
        )}
      </div>
      <button 
        className="remove-button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove image"
        style={{ pointerEvents: 'auto' }}
      >
        ×
      </button>
    </div>
  );
};

export default DraggableImage;