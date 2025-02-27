import React, { useState, useEffect, useRef } from 'react';
import { visualContentApi, ImageInfo } from '@/lib/visualContentApi';

interface ImageBrowserProps {
  onImageSelected: (imageData: ImageInfo) => void;
}

const ImageBrowser: React.FC<ImageBrowserProps> = ({ onImageSelected }) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [allImages, setAllImages] = useState<{[key: string]: ImageInfo[]}>({});
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch all category images when categories are loaded
  useEffect(() => {
    if (categories.length > 0) {
      fetchAllCategoryImages();
    }
  }, [categories]);

  // Fetch thumbnails when images change
  useEffect(() => {
    const imagesToFetch: ImageInfo[] = [];
    
    // Collect all images that need thumbnails
    Object.values(allImages).forEach(categoryImages => {
      categoryImages.forEach(img => {
        if (!thumbnails[img.id]) {
          imagesToFetch.push(img);
        }
      });
    });
    
    if (imagesToFetch.length > 0) {
      fetchThumbnails(imagesToFetch);
    }
  }, [allImages]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await visualContentApi.getVisualCategories();
      
      if (data.status === 'success' && data.categories) {
        setCategories(data.categories);
      } else {
        setError('Failed to load categories');
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCategoryImages = async () => {
    setLoading(true);
    
    try {
      const imagesByCategory: {[key: string]: ImageInfo[]} = {};
      
      // Fetch images for each category in parallel
      const categoryPromises = categories.map(async (category) => {
        try {
          const data = await visualContentApi.getVisualImages(category);
          if (data.status === 'success' && data.images) {
            imagesByCategory[category] = data.images;
          }
        } catch (err) {
          console.error(`Error fetching images for ${category}:`, err);
        }
      });
      
      await Promise.all(categoryPromises);
      setAllImages(imagesByCategory);
    } catch (err) {
      console.error('Error fetching all category images:', err);
      setError('Error loading images');
    } finally {
      setLoading(false);
    }
  };

  const fetchThumbnails = async (imagesToFetch: ImageInfo[]) => {
    const newThumbnails: Record<string, string> = {};
    
    // Process in smaller batches to avoid too many simultaneous requests
    const batchSize = 5;
    for (let i = 0; i < imagesToFetch.length; i += batchSize) {
      const batch = imagesToFetch.slice(i, i + batchSize);
      
      // Fetch thumbnails in parallel
      const promises = batch.map(async (image) => {
        try {
          const response = await visualContentApi.getVisualImage(image.id);
          if (response.status === 'success' && response.image?.data_uri) {
            return { id: image.id, thumbnail: response.image.data_uri };
          }
          return null;
        } catch (err) {
          console.error(`Error fetching thumbnail for ${image.id}:`, err);
          return null;
        }
      });
      
      // Wait for all promises in the batch to resolve
      const results = await Promise.all(promises);
      
      // Add successful results to thumbnails
      results.forEach(result => {
        if (result) {
          newThumbnails[result.id] = result.thumbnail;
        }
      });
    }
    
    // Update thumbnails state with new ones
    setThumbnails(prev => ({ ...prev, ...newThumbnails }));
  };

  // Set up drag functionality
  const handleDragStart = (e: React.DragEvent, image: ImageInfo) => {
    // Create a small preview image
    if (thumbnails[image.id]) {
      // Create a properly sized version for drag preview
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Size for drag preview
        canvas.width = 40;
        canvas.height = 40;
        
        if (ctx) {
          // Draw circular thumbnail
          ctx.beginPath();
          ctx.arc(20, 20, 20, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          // Draw the image centered and cropped into the circle
          const size = Math.min(img.width, img.height);
          const aspectRatio = img.width / img.height;
          
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = img.width;
          let sourceHeight = img.height;
          
          // Crop to square from center
          if (aspectRatio > 1) {
            // Image is wider than tall
            sourceWidth = sourceHeight;
            sourceX = (img.width - sourceWidth) / 2;
          } else {
            // Image is taller than wide
            sourceHeight = sourceWidth;
            sourceY = (img.height - sourceHeight) / 2;
          }
          
          ctx.drawImage(
            img, 
            sourceX, sourceY, sourceWidth, sourceHeight, // Source rect
            0, 0, 40, 40 // Destination rect
          );
          
          // Use the canvas as drag image
          const dataUrl = canvas.toDataURL();
          const dragImg = new Image();
          dragImg.src = dataUrl;
          e.dataTransfer.setDragImage(dragImg, 20, 20);
        }
      };
      
      // Set source image
      img.src = thumbnails[image.id];
      
      // Include data_uri for the main app to use
      image.data_uri = thumbnails[image.id];
    }
    
    // Set the actual data being transferred
    e.dataTransfer.setData('application/json', JSON.stringify({
      ...image,
      // Add a flag to indicate this is a small preview
      _previewSize: { width: 80, height: 80 }
    }));
  };

  return (
    <div className="circle-image-browser" ref={containerRef}>
      {error && (
        <div className="browser-error">
          {error}
        </div>
      )}
      
      {/* Infinite scroll of categories */}
      <div className="infinite-scroll-container">
        {loading && Object.keys(allImages).length === 0 ? (
          <div className="loading-state">Loading...</div>
        ) : (
          categories.map((category) => (
            <div key={category} className="category-section">
              <div className="category-divider">
                <div className="category-label">{category}</div>
                <div className="divider-line"></div>
              </div>
              
              <div className="category-images">
                {allImages[category]?.map((image) => (
                  <div 
                    key={image.id}
                    className="circle-thumbnail"
                    draggable
                    onDragStart={(e) => handleDragStart(e, image)}
                    onClick={() => onImageSelected(image)}
                    title={image.name}
                  >
                    {thumbnails[image.id] ? (
                      image.type === 'svg' ? (
                        <div 
                          dangerouslySetInnerHTML={{ __html: thumbnails[image.id] }}
                          className="circle-content"
                        />
                      ) : (
                        <img 
                          src={thumbnails[image.id]}
                          alt={image.name}
                          className="circle-image"
                        />
                      )
                    ) : (
                      <div className="loading-circle">
                        ...
                      </div>
                    )}
                  </div>
                ))}
                
                {!allImages[category] && (
                  <div className="loading-section">
                    Loading...
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ImageBrowser;