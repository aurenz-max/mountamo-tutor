// components/avatar/BackgroundOptions.tsx
'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming you have this utility

const BackgroundOptions = ({ onSelectBackground }) => {
  const backgrounds = [
    { name: 'White', color: '#FFFFFF', textColor: '#000000' },
    { name: 'Light Gray', color: '#F5F5F5', textColor: '#000000' },
    { name: 'Soft Blue', color: '#E6F7FF', textColor: '#000000' },
    { name: 'Pale Green', color: '#F0FFF0', textColor: '#000000' },
    { name: 'Light Purple', color: '#F8F0FF', textColor: '#000000' },
    { name: 'Black', color: '#000000', textColor: '#FFFFFF' },
    { name: 'Dark Blue', color: '#1A365D', textColor: '#FFFFFF' },
  ];

  // Track the currently selected background
  const [selectedColor, setSelectedColor] = React.useState(backgrounds[0].color);

  const handleSelectBackground = (color) => {
    setSelectedColor(color);
    onSelectBackground(color);
  };

  return (
    <div className="p-2 flex flex-wrap gap-1.5 bg-background">
      {backgrounds.map((bg) => (
        <button
          key={bg.name}
          onClick={() => handleSelectBackground(bg.color)}
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center relative border",
            selectedColor === bg.color ? "border-primary" : "border-input hover:border-ring"
          )}
          style={{
            backgroundColor: bg.color,
            color: bg.textColor,
          }}
          title={bg.name}
          aria-label={`Set background to ${bg.name}`}
        >
          {selectedColor === bg.color && (
            <Check
              size={14}
              className="absolute"
              style={{ color: bg.textColor }} 
            />
          )}
        </button>
      ))}
    </div>
  );
};

export default BackgroundOptions;