import React, { useState } from 'react';
import { ImageIcon, MapIcon, Beaker, BookIcon, GlobeIcon } from 'lucide-react';
import { generateConceptImage } from '../service/geminiService';

interface ImagePanelData {
  title: string;
  description?: string;
  imageUrl: string | null;
  imagePrompt?: string;
  category?: 'geography' | 'history' | 'science' | 'literature' | 'art' | 'general';
  attribution?: string;
}

interface ImagePanelProps {
  data: ImagePanelData;
  className?: string;
}

const CATEGORY_CONFIG = {
  geography: {
    icon: MapIcon,
    bgColor: 'bg-emerald-900/30',
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-700',
    label: 'Geographic Visualization'
  },
  history: {
    icon: BookIcon,
    bgColor: 'bg-amber-900/30',
    textColor: 'text-amber-300',
    borderColor: 'border-amber-700',
    label: 'Historical Context'
  },
  science: {
    icon: Beaker,
    bgColor: 'bg-blue-900/30',
    textColor: 'text-blue-300',
    borderColor: 'border-blue-700',
    label: 'Scientific Illustration'
  },
  literature: {
    icon: BookIcon,
    bgColor: 'bg-purple-900/30',
    textColor: 'text-purple-300',
    borderColor: 'border-purple-700',
    label: 'Literary Visualization'
  },
  art: {
    icon: ImageIcon,
    bgColor: 'bg-pink-900/30',
    textColor: 'text-pink-300',
    borderColor: 'border-pink-700',
    label: 'Artistic Representation'
  },
  general: {
    icon: GlobeIcon,
    bgColor: 'bg-indigo-900/30',
    textColor: 'text-indigo-300',
    borderColor: 'border-indigo-700',
    label: 'Visual Context'
  }
};

const ImagePanel: React.FC<ImagePanelProps> = ({ data, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isWallpaperMode, setIsWallpaperMode] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const category = data.category || 'general';
  const config = CATEGORY_CONFIG[category];
  const IconComponent = config.icon;

  const toggleWallpaperMode = () => {
    setIsWallpaperMode(!isWallpaperMode);
  };

  // Handle on-demand image generation
  const handleGenerateImage = async () => {
    if (!data.imagePrompt || isLoading || generatedImageUrl) return;

    setIsLoading(true);
    setImageError(false);

    try {
      const url = await generateConceptImage(data.imagePrompt);
      if (url) {
        setGeneratedImageUrl(url);
      } else {
        setImageError(true);
      }
    } catch (error) {
      console.error('Failed to generate image:', error);
      setImageError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Use either the provided imageUrl or the generated one
  const displayImageUrl = data.imageUrl || generatedImageUrl;

  // Show component even without imageUrl if we have imagePrompt
  if (!displayImageUrl && !data.imagePrompt && !isLoading) return null;

  return (
    <div className={`w-full mx-auto animate-fade-in ${isWallpaperMode ? 'fixed inset-0 z-50 bg-slate-950/95 p-8 m-0 overflow-y-auto' : 'max-w-4xl mb-16'} ${className}`}>
      <div className={`bg-slate-800/50 border ${config.borderColor} rounded-xl overflow-hidden shadow-2xl`}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 bg-slate-800/80 cursor-pointer border-b border-slate-700 hover:bg-slate-800 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 ${config.bgColor} rounded-lg ${config.textColor}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-slate-100">{data.title}</h3>
              {data.description && (
                <p className="text-xs text-slate-400 mt-0.5">{data.description}</p>
              )}
            </div>
          </div>
          <button className="text-xs font-medium text-slate-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="relative w-full bg-slate-900/50 min-h-[200px] flex items-center justify-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                 <div className={`w-12 h-12 border-4 ${config.borderColor} border-opacity-30 border-t-current ${config.textColor} rounded-full animate-spin mb-4`}></div>
                 <p className="text-slate-400 font-medium">Generating visualization...</p>
                 {data.imagePrompt && (
                   <p className="text-xs text-slate-600 mt-2 max-w-md">"{data.imagePrompt}"</p>
                 )}
              </div>
            ) : imageError || !displayImageUrl ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className={`p-4 ${config.bgColor} rounded-full mb-4`}>
                  <IconComponent className={`w-8 h-8 ${config.textColor}`} />
                </div>
                <p className="text-slate-400 font-medium">
                  {imageError ? 'Unable to load image' : 'Visual Concept'}
                </p>
                {data.imagePrompt && (
                  <div className="mt-4 max-w-2xl">
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">
                      {data.imagePrompt}
                    </p>
                    {!imageError && (
                      <button
                        onClick={handleGenerateImage}
                        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 mx-auto ${config.bgColor} ${config.textColor} border ${config.borderColor} hover:scale-105 active:scale-95`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        Generate Visual
                      </button>
                    )}
                    <p className="text-xs text-slate-500 italic mt-3">
                      {imageError ? 'Image generation failed. Please try again.' : 'Click to generate an AI image for this concept'}
                    </p>
                  </div>
                )}
              </div>
            ) : displayImageUrl ? (
              <div className="relative w-full group">
                {/* Wallpaper Mode Toggle Button */}
                <button
                  onClick={toggleWallpaperMode}
                  className="absolute top-4 right-4 px-4 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 transition-all flex items-center gap-2 z-20"
                  title={isWallpaperMode ? 'Exit Wallpaper Mode' : 'Enter Wallpaper Mode'}
                >
                  {isWallpaperMode ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                      <span className="hidden sm:inline">Exit Wallpaper</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                      </svg>
                      <span className="hidden sm:inline">Wallpaper Mode</span>
                    </>
                  )}
                </button>

                <img
                  src={displayImageUrl || ''}
                  alt={data.title}
                  className={`w-full h-auto object-contain transition-transform duration-700 group-hover:scale-[1.01] ${isWallpaperMode ? 'max-h-[90vh]' : 'max-h-[500px]'}`}
                  onError={() => setImageError(true)}
                  loading="lazy"
                />
                {/* Hover overlay with details */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="space-y-2">
                    {data.imagePrompt && (
                      <p className="text-xs text-slate-300 font-mono">
                        <span className={`${config.textColor} font-bold`}>VISUALIZATION:</span> {data.imagePrompt}
                      </p>
                    )}
                    {data.attribution && (
                      <p className="text-xs text-slate-400 italic">
                        {data.attribution}
                      </p>
                    )}
                  </div>
                </div>

                {/* Category badge */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className={`px-3 py-1 ${config.bgColor} ${config.textColor} rounded-full text-xs font-medium backdrop-blur-sm`}>
                    {config.label}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagePanel;
