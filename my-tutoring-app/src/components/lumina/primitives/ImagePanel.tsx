import React, { useState } from 'react';
import { ImageIcon, MapIcon, Beaker, BookIcon, GlobeIcon } from 'lucide-react';

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

  const category = data.category || 'general';
  const config = CATEGORY_CONFIG[category];
  const IconComponent = config.icon;

  if (!data.imageUrl && !isLoading) return null;

  return (
    <div className={`w-full max-w-4xl mx-auto mb-16 animate-fade-in ${className}`}>
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
            ) : imageError ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className={`p-4 ${config.bgColor} rounded-full mb-4`}>
                  <IconComponent className={`w-8 h-8 ${config.textColor}`} />
                </div>
                <p className="text-slate-400 font-medium">Unable to load image</p>
                <p className="text-xs text-slate-600 mt-2 max-w-md">
                  {data.imagePrompt || 'The image could not be displayed'}
                </p>
              </div>
            ) : data.imageUrl ? (
              <div className="relative w-full group">
                <img
                  src={data.imageUrl}
                  alt={data.title}
                  className="w-full h-auto object-cover max-h-[500px] transition-transform duration-700 group-hover:scale-[1.01]"
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
