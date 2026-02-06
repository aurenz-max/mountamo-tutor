import React, { useState } from 'react';
import { Leaf, MapPin, Utensils, HeartPulse, Scale, Ruler, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Organism Card - Foundational biology primitive for presenting living things
 *
 * Purpose: Present a living thing with key biological attributes in a structured,
 * visually rich format. The foundational "unit" of biology content—used for
 * comparison, classification, and reference.
 *
 * Grade Band: K-8 (complexity scales with grade)
 * Cognitive Operation: Identify, describe, classify
 *
 * Design: Card layout with image region, attribute grid, and expandable detail sections.
 * K-2 uses icons and simple labels. Grades 3-5 add habitat/diet/reproduction.
 * Grades 6-8 add taxonomy, evolutionary context, and cellular characteristics.
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export interface OrganismClassification {
  domain?: string | null;
  phylum?: string | null;
  class?: string | null;
  order?: string | null;
  family?: string | null;
}

export interface OrganismAttributes {
  habitat: string;
  diet: string;
  locomotion: string;
  lifespan: string;
  size: string;
  bodyTemperature?: 'warm-blooded' | 'cold-blooded' | 'N/A';
  reproduction?: string;
  specialAdaptations?: string[];
}

export interface OrganismInfo {
  commonName: string;
  scientificName?: string | null;
  imagePrompt: string; // Description for image generation or stock lookup
  kingdom: string;
  classification?: OrganismClassification;
}

export interface OrganismCardData {
  organism: OrganismInfo;
  attributes: OrganismAttributes;
  funFact: string;
  gradeBand: 'K-2' | '3-5' | '6-8';
  visibleFields: string[]; // Controls which attributes render at this grade band
  themeColor?: string; // Optional accent color
}

// ============================================================================
// Component Props
// ============================================================================

interface OrganismCardProps {
  data: OrganismCardData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const KINGDOM_COLORS: Record<string, { text: string; accent: string; rgb: string }> = {
  Animalia: { text: 'text-orange-300', accent: '#f97316', rgb: '249, 115, 22' },
  Plantae: { text: 'text-emerald-300', accent: '#10b981', rgb: '16, 185, 129' },
  Fungi: { text: 'text-purple-300', accent: '#a855f7', rgb: '168, 85, 247' },
  Protista: { text: 'text-cyan-300', accent: '#06b6d4', rgb: '6, 182, 212' },
  Bacteria: { text: 'text-yellow-300', accent: '#eab308', rgb: '234, 179, 8' },
  Archaea: { text: 'text-rose-300', accent: '#fb7185', rgb: '251, 113, 133' },
};

const BODY_TEMP_LABELS: Record<string, string> = {
  'warm-blooded': 'Warm-blooded',
  'cold-blooded': 'Cold-blooded',
  'N/A': 'N/A',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color scheme based on kingdom or custom theme
 */
const getColorScheme = (kingdom: string, themeColor?: string) => {
  if (themeColor) {
    return {
      text: 'text-slate-300',
      accent: themeColor,
      rgb: themeColor.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ') || '100, 100, 100',
    };
  }
  return KINGDOM_COLORS[kingdom] || KINGDOM_COLORS.Animalia;
};

/**
 * Check if field should be visible based on grade band configuration
 */
const isFieldVisible = (field: string, visibleFields: string[]): boolean => {
  return visibleFields.includes(field);
};

// ============================================================================
// Main Component
// ============================================================================

const OrganismCard: React.FC<OrganismCardProps> = ({ data, className = '' }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Validate data structure
  if (!data || !data.organism) {
    console.error('Invalid OrganismCard data:', data);
    return (
      <div className="w-full glass-panel rounded-2xl p-8 border border-red-500/50">
        <p className="text-red-400">Error: Invalid organism data structure</p>
        <pre className="text-xs text-slate-400 mt-2">{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  }

  const colors = getColorScheme(data.organism.kingdom, data.themeColor);
  const { organism, attributes, funFact, gradeBand, visibleFields } = data;

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Handle on-demand image generation
  const handleGenerateImage = async () => {
    if (!organism.imagePrompt || isLoadingImage || generatedImageUrl) return;

    setIsLoadingImage(true);
    setImageError(false);

    try {
      // Call the API to generate the organism image
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: organism.imagePrompt,
          }
        })
      });

      if (!response.ok) {
        throw new Error('Image generation request failed');
      }

      const result = await response.json();
      if (result.imageUrl) {
        setGeneratedImageUrl(result.imageUrl);
      } else {
        setImageError(true);
      }
    } catch (error) {
      console.error('Failed to generate organism image:', error);
      setImageError(true);
    } finally {
      setIsLoadingImage(false);
    }
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderAttributeItem = (
    icon: React.ReactNode,
    label: string,
    value: string | undefined,
    field: string
  ) => {
    if (!isFieldVisible(field, visibleFields) || !value) return null;

    return (
      <div
        className="group flex items-start gap-3 p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-slate-600/70 hover:bg-slate-800/50 transition-all duration-300 hover:shadow-lg cursor-default"
        style={{
          ['--item-hover-shadow' as string]: `rgba(${colors.rgb}, 0.15)`,
        } as React.CSSProperties}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 4px 20px rgba(${colors.rgb}, 0.15)`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '';
        }}
      >
        <div className={`mt-0.5 ${colors.text} group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-1 group-hover:text-slate-400 transition-colors">
            {label}
          </div>
          <div className="text-sm text-slate-200 group-hover:text-slate-100 transition-colors">{value}</div>
        </div>
      </div>
    );
  };

  const renderClassification = () => {
    if (!organism.classification) return null;
    if (!isFieldVisible('classification', visibleFields)) return null;

    const { domain, phylum, class: className, order, family } = organism.classification;
    const hasAnyClassification = domain || phylum || className || order || family;

    if (!hasAnyClassification) return null;

    const isExpanded = expandedSection === 'classification';

    return (
      <div className="mt-6">
        <button
          onClick={() => toggleSection('classification')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/70 transition-all duration-300 group hover:shadow-lg"
          style={{
            ['--section-hover-shadow' as string]: `rgba(${colors.rgb}, 0.15)`,
          } as React.CSSProperties}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 4px 20px rgba(${colors.rgb}, 0.15)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="flex items-center gap-2">
            <Leaf className={`w-4 h-4 ${colors.text} group-hover:scale-110 transition-transform duration-300`} />
            <span className="text-sm font-mono text-slate-300 uppercase tracking-wider group-hover:text-slate-100 transition-colors">
              Taxonomic Classification
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-3 grid grid-cols-2 gap-3 p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
            {domain && (
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-900/60 transition-all duration-200 group">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">Domain</div>
                <div className="text-sm text-slate-200 mt-1.5 group-hover:text-slate-100 transition-colors font-medium">{domain}</div>
              </div>
            )}
            {phylum && (
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-900/60 transition-all duration-200 group">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">Phylum</div>
                <div className="text-sm text-slate-200 mt-1.5 group-hover:text-slate-100 transition-colors font-medium">{phylum}</div>
              </div>
            )}
            {className && (
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-900/60 transition-all duration-200 group">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">Class</div>
                <div className="text-sm text-slate-200 mt-1.5 group-hover:text-slate-100 transition-colors font-medium">{className}</div>
              </div>
            )}
            {order && (
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-900/60 transition-all duration-200 group">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">Order</div>
                <div className="text-sm text-slate-200 mt-1.5 group-hover:text-slate-100 transition-colors font-medium">{order}</div>
              </div>
            )}
            {family && (
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-900/60 transition-all duration-200 group">
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider group-hover:text-slate-400 transition-colors">Family</div>
                <div className="text-sm text-slate-200 mt-1.5 group-hover:text-slate-100 transition-colors font-medium">{family}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAdaptations = () => {
    if (!attributes.specialAdaptations || attributes.specialAdaptations.length === 0) return null;
    if (!isFieldVisible('specialAdaptations', visibleFields)) return null;

    const isExpanded = expandedSection === 'adaptations';

    return (
      <div className="mt-4">
        <button
          onClick={() => toggleSection('adaptations')}
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/70 transition-all duration-300 group hover:shadow-lg"
          style={{
            ['--section-hover-shadow' as string]: `rgba(${colors.rgb}, 0.15)`,
          } as React.CSSProperties}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 4px 20px rgba(${colors.rgb}, 0.15)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${colors.text} group-hover:scale-110 transition-transform duration-300`} />
            <span className="text-sm font-mono text-slate-300 uppercase tracking-wider group-hover:text-slate-100 transition-colors">
              Special Adaptations
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-200 transition-colors" />
          )}
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2 p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
            {attributes.specialAdaptations.map((adaptation, index) => (
              <div key={index} className="group flex items-start gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/50 hover:bg-slate-900/60 transition-all duration-200">
                <div className={`mt-1 w-2 h-2 rounded-full group-hover:scale-125 transition-transform duration-200`} style={{ backgroundColor: colors.accent }}></div>
                <div className="text-sm text-slate-200 group-hover:text-slate-100 transition-colors">{adaptation}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div
      className={`w-full glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-500 hover:border-white/30 hover:scale-[1.02] ${className}`}
      style={{
        ['--hover-shadow-color' as string]: `rgba(${colors.rgb}, 0.25)`,
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 20px 60px -10px rgba(${colors.rgb}, 0.4), 0 0 40px rgba(${colors.rgb}, 0.2)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
    >
      <div className="p-6 sm:p-8">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-100 mb-1">
                {organism.commonName}
              </h3>
              {organism.scientificName && (
                <p className="text-sm font-serif italic text-slate-400">
                  {organism.scientificName}
                </p>
              )}
            </div>
            <div className="ml-4">
              <div
                className={`px-4 py-2 rounded-full text-xs font-mono uppercase tracking-wider ${colors.text} bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800/70 hover:border-slate-600/70 transition-all duration-300 cursor-default hover:shadow-lg`}
                style={{
                  ['--kingdom-hover-shadow' as string]: `rgba(${colors.rgb}, 0.3)`,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 4px 16px rgba(${colors.rgb}, 0.3)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {organism.kingdom}
              </div>
            </div>
          </div>

          {/* Grade Band Indicator (for debugging/testing) */}
          <div className="text-xs font-mono text-slate-600 uppercase tracking-wider">
            Grade Band: {gradeBand}
          </div>
        </div>

        {/* Image Section */}
        {isLoadingImage ? (
          <div className="mb-6 rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800/30 h-48 flex flex-col items-center justify-center p-6">
            <div
              className="w-12 h-12 border-4 border-white/10 border-t-current rounded-full animate-spin mb-4"
              style={{ color: colors.accent }}
            />
            <p className={`${colors.text} font-medium mb-2`}>Generating organism visualization...</p>
            {organism.imagePrompt && (
              <p className="text-xs text-slate-500 text-center italic max-w-md">
                "{organism.imagePrompt}"
              </p>
            )}
          </div>
        ) : generatedImageUrl && !imageError ? (
          <div className="group mb-6 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/30 hover:border-slate-600/70 transition-all duration-300 hover:shadow-lg">
            <div className="overflow-hidden">
              <img
                src={generatedImageUrl}
                alt={organism.commonName}
                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                onError={() => setImageError(true)}
                loading="lazy"
              />
            </div>
            <div className="p-4 bg-slate-900/50 group-hover:bg-slate-900/70 transition-colors duration-300">
              {organism.imagePrompt && (
                <p className="text-xs text-slate-400 italic group-hover:text-slate-300 transition-colors">
                  {organism.imagePrompt}
                </p>
              )}
            </div>
          </div>
        ) : organism.imagePrompt ? (
          <div className="mb-6 rounded-lg overflow-hidden border border-dashed border-slate-700/50 bg-slate-800/30 h-48 flex flex-col items-center justify-center p-6">
            <Leaf className={`w-12 h-12 mx-auto mb-3 ${colors.text} opacity-40`} />
            <p className="text-sm text-slate-300 text-center mb-4">
              {organism.imagePrompt}
            </p>
            {!imageError && (
              <button
                onClick={handleGenerateImage}
                className={`group px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 bg-white/5 ${colors.text} border border-white/20 hover:bg-white/10 hover:scale-105 hover:shadow-lg active:scale-95`}
                style={{
                  ['--button-hover-shadow' as string]: `rgba(${colors.rgb}, 0.3)`,
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 8px 24px rgba(${colors.rgb}, 0.3)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <svg className="w-5 h-5 group-hover:rotate-6 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                Generate Visual
              </button>
            )}
            <p className="text-xs text-slate-500 text-center mt-3 italic">
              {imageError ? 'Image generation failed. Please try again.' : 'Click to generate an AI visualization'}
            </p>
          </div>
        ) : null}

        {/* Attributes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {renderAttributeItem(
            <MapPin className="w-4 h-4" />,
            'Habitat',
            attributes.habitat,
            'habitat'
          )}
          {renderAttributeItem(
            <Utensils className="w-4 h-4" />,
            'Diet',
            attributes.diet,
            'diet'
          )}
          {renderAttributeItem(
            <Ruler className="w-4 h-4" />,
            'Size',
            attributes.size,
            'size'
          )}
          {renderAttributeItem(
            <Scale className="w-4 h-4" />,
            'Locomotion',
            attributes.locomotion,
            'locomotion'
          )}
          {renderAttributeItem(
            <HeartPulse className="w-4 h-4" />,
            'Lifespan',
            attributes.lifespan,
            'lifespan'
          )}
          {attributes.bodyTemperature && isFieldVisible('bodyTemperature', visibleFields) && (
            renderAttributeItem(
              <HeartPulse className="w-4 h-4" />,
              'Body Temperature',
              BODY_TEMP_LABELS[attributes.bodyTemperature],
              'bodyTemperature'
            )
          )}
          {attributes.reproduction && renderAttributeItem(
            <Leaf className="w-4 h-4" />,
            'Reproduction',
            attributes.reproduction,
            'reproduction'
          )}
        </div>

        {/* Expandable Sections */}
        {renderClassification()}
        {renderAdaptations()}

        {/* Fun Fact */}
        {isFieldVisible('funFact', visibleFields) && (
          <div
            className="group mt-6 p-5 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-800/30 border border-slate-700/50 hover:border-slate-600/70 hover:from-slate-800/70 hover:to-slate-800/50 transition-all duration-300 cursor-default hover:shadow-lg"
            style={{
              ['--funfact-hover-shadow' as string]: `rgba(${colors.rgb}, 0.15)`,
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 4px 20px rgba(${colors.rgb}, 0.15)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <div className="flex items-start gap-3">
              <Sparkles className={`w-5 h-5 mt-0.5 ${colors.text} flex-shrink-0 group-hover:scale-110 transition-transform duration-300`} />
              <div>
                <div className="text-xs font-mono text-slate-500 uppercase tracking-wider mb-2 group-hover:text-slate-400 transition-colors">
                  Fun Fact
                </div>
                <p className="text-sm text-slate-200 leading-relaxed group-hover:text-slate-100 transition-colors">
                  {funFact}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganismCard;
