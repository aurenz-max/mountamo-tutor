import React, { useState } from 'react';
import { ImageInfo } from '@/lib/visualContentApi';
import { Button } from '@/components/ui/button';
import { Image, ImagePlus } from 'lucide-react';
import ImageBrowser from './ImageBrowser';

interface ImageBrowserDrawerProps {
  onImageSelected: (imageData: ImageInfo) => void;
}

const ImageBrowserDrawer: React.FC<ImageBrowserDrawerProps> = ({ onImageSelected }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  const handleImageSelected = (imageData: ImageInfo) => {
    onImageSelected(imageData);
    // Optionally close the drawer after selection
    // setIsOpen(false);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button 
        className="toggle-image-browser"
        onClick={toggleDrawer}
        aria-label="Toggle image browser"
      >
        <ImagePlus size={20} />
      </button>

      {/* Image Browser Drawer */}
      <div className={`image-browser-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-handle" onClick={toggleDrawer}></div>
        
        <div className="pb-2 flex justify-between items-center">
          <h3 className="text-sm font-medium">Image Library</h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={toggleDrawer}
            className="text-xs"
          >
            Close
          </Button>
        </div>
        
        <ImageBrowser onImageSelected={handleImageSelected} />
      </div>
    </>
  );
};

export default ImageBrowserDrawer;