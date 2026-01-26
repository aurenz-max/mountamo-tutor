import React, { useState } from 'react';
import { Skull, Ruler, Weight, Utensils, MapPin, Clock, Users, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { SpotlightCard } from '../../components/SpotlightCard';

// Species characteristic data structure
export interface PhysicalStats {
  height?: string;           // "4-5 meters tall"
  length?: string;           // "12 meters long"
  weight?: string;           // "7-9 tons"
  heightComparison?: string; // "As tall as a giraffe"
  weightComparison?: string; // "Heavier than an elephant"
}

export interface DietInfo {
  type: 'carnivore' | 'herbivore' | 'omnivore' | 'insectivore' | 'piscivore';
  description: string;       // "Apex predator that hunted large herbivores"
  primaryFood?: string[];    // ["Triceratops", "Edmontosaurus"]
  huntingStrategy?: string;  // "Ambush predator with powerful bite"
}

export interface HabitatInfo {
  period?: string;           // "Late Cretaceous"
  timeRange?: string;        // "68-66 million years ago"
  location?: string;         // "North America"
  environment?: string;      // "Forested river valleys"
}

export interface TaxonomyInfo {
  kingdom?: string;
  phylum?: string;
  class?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  relatedSpecies?: string[]; // ["Albertosaurus", "Gorgosaurus"]
}

export interface InterestingFact {
  title: string;
  description: string;
  icon?: 'skull' | 'sparkles' | 'ruler' | 'users';
}

export interface SpeciesProfileData {
  // Basic Info
  commonName: string;         // "Tyrannosaurus Rex"
  scientificName: string;     // "Tyrannosaurus rex"
  nameMeaning?: string;       // "Tyrant Lizard King"

  // Visual
  imageUrl?: string | null;
  imagePrompt?: string;       // For AI generation

  // Core Characteristics
  physicalStats?: PhysicalStats;
  diet?: DietInfo;
  habitat?: HabitatInfo;
  taxonomy?: TaxonomyInfo;

  // Ecological Role
  biologicalNiche?: string;   // "Apex predator maintaining ecosystem balance"

  // Educational Content
  interestingFacts?: InterestingFact[];
  discoveryInfo?: string;     // "First discovered in Montana in 1902"

  // Styling
  themeColor?: string;        // Accent color based on category
  category?: 'dinosaur' | 'mammal' | 'reptile' | 'bird' | 'fish' | 'invertebrate' | 'plant';
}

interface SpeciesProfileProps {
  data: SpeciesProfileData;
  className?: string;
}

const CATEGORY_COLORS = {
  dinosaur: { text: 'text-orange-300', accent: '#f97316', rgb: '249, 115, 22' },
  mammal: { text: 'text-amber-300', accent: '#f59e0b', rgb: '245, 158, 11' },
  reptile: { text: 'text-green-300', accent: '#22c55e', rgb: '34, 197, 94' },
  bird: { text: 'text-sky-300', accent: '#0ea5e9', rgb: '14, 165, 233' },
  fish: { text: 'text-blue-300', accent: '#3b82f6', rgb: '59, 130, 246' },
  invertebrate: { text: 'text-purple-300', accent: '#a855f7', rgb: '168, 85, 247' },
  plant: { text: 'text-emerald-300', accent: '#10b981', rgb: '16, 185, 129' },
};

const DIET_ICONS = {
  carnivore: '🥩',
  herbivore: '🌿',
  omnivore: '🍽️',
  insectivore: '🦗',
  piscivore: '🐟',
};

const SpeciesProfile: React.FC<SpeciesProfileProps> = ({ data, className = '' }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('physical');
  const [imageError, setImageError] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const category = data.category || 'dinosaur';
  const colors = CATEGORY_COLORS[category];

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Handle on-demand image generation
  const handleGenerateImage = async () => {
    if (!data.imagePrompt || isLoadingImage || generatedImageUrl) return;

    setIsLoadingImage(true);
    setImageError(false);

    try {
      // Call the API to generate the species image
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: data.imagePrompt,
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
      console.error('Failed to generate species image:', error);
      setImageError(true);
    } finally {
      setIsLoadingImage(false);
    }
  };

  return (
    <div className={`w-full max-w-6xl mx-auto mb-16 ${className}`}>
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl border border-white/10">

        {/* Header Section */}
        <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-b border-white/10 p-6">
          {/* Ambient glow */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[120px] opacity-20"
            style={{ backgroundColor: colors.accent }}
          />

          <div className="relative flex items-start justify-between">
            <div className="flex-1">
              <h2 className={`text-4xl font-bold ${colors.text} mb-2 drop-shadow-lg`}>
                {data.commonName}
              </h2>
              <p className="text-slate-300 italic text-lg mb-1">
                {data.scientificName}
              </p>
              {data.nameMeaning && (
                <p className="text-slate-400 text-sm">
                  <span className="font-semibold">Name Meaning:</span> {data.nameMeaning}
                </p>
              )}
            </div>
            <div className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg">
              <p className={`text-xs font-bold ${colors.text} uppercase tracking-wider`}>
                {category}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-slate-900/40 backdrop-blur-xl">

          {/* Left Column: Image & Ecological Role */}
          <div className="space-y-4">
            {/* Image Section */}
            {isLoadingImage ? (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel rounded-xl flex flex-col items-center justify-center min-h-[300px] p-8">
                  <div
                    className="w-12 h-12 border-4 border-white/10 border-t-current rounded-full animate-spin mb-4"
                    style={{ color: colors.accent }}
                  />
                  <p className={`${colors.text} font-medium mb-2`}>Generating species visualization...</p>
                  {data.imagePrompt && (
                    <p className="text-xs text-slate-500 text-center italic max-w-md">
                      "{data.imagePrompt}"
                    </p>
                  )}
                </div>
              </SpotlightCard>
            ) : (data.imageUrl || generatedImageUrl) && !imageError ? (
              <SpotlightCard color={colors.rgb}>
                <div className="relative rounded-xl overflow-hidden bg-black/60 backdrop-blur-sm border border-white/10">
                  <img
                    src={data.imageUrl || generatedImageUrl || ''}
                    alt={data.commonName}
                    className="w-full h-auto object-cover"
                    onError={() => setImageError(true)}
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent p-4">
                    {data.imagePrompt && (
                      <p className="text-xs text-slate-400 italic">
                        {data.imagePrompt}
                      </p>
                    )}
                  </div>
                </div>
              </SpotlightCard>
            ) : data.imagePrompt ? (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel p-8 border border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center min-h-[300px]">
                  <Skull className={`w-16 h-16 ${colors.text} mb-4`} />
                  <p className="text-slate-300 text-center text-sm mb-4">
                    {data.imagePrompt}
                  </p>
                  {!imageError && (
                    <button
                      onClick={handleGenerateImage}
                      className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 bg-white/5 ${colors.text} border border-white/20 hover:bg-white/10 hover:scale-105 active:scale-95`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      Generate Visual
                    </button>
                  )}
                  <p className="text-xs text-slate-500 text-center mt-3 italic">
                    {imageError ? 'Image generation failed. Please try again.' : 'Click to generate an AI visualization'}
                  </p>
                </div>
              </SpotlightCard>
            ) : null}

            {/* Biological Niche */}
            {data.biologicalNiche && (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel p-4 rounded-lg border border-white/10">
                  <h4 className={`text-sm font-bold ${colors.text} mb-2 flex items-center gap-2`}>
                    <Sparkles className="w-4 h-4" />
                    Ecological Role
                  </h4>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {data.biologicalNiche}
                  </p>
                </div>
              </SpotlightCard>
            )}
          </div>

          {/* Right Column: Characteristics */}
          <div className="space-y-3">

            {/* Physical Stats Section */}
            {data.physicalStats && (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => toggleSection('physical')}
                    className="w-full px-4 py-3 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Ruler className={`w-5 h-5 ${colors.text} group-hover:scale-110 transition-transform`} />
                      <span className={`font-bold ${colors.text}`}>Physical Stats</span>
                    </div>
                    {expandedSection === 'physical' ? (
                      <ChevronUp className={`w-5 h-5 ${colors.text}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                    )}
                  </button>
                  {expandedSection === 'physical' && (
                    <div className="p-4 bg-black/20 space-y-3">
                      {data.physicalStats.height && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <Ruler className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <div>
                            <p className="text-slate-200 font-semibold text-sm">Height</p>
                            <p className="text-slate-300 text-sm">{data.physicalStats.height}</p>
                            {data.physicalStats.heightComparison && (
                              <p className="text-slate-400 text-xs italic">{data.physicalStats.heightComparison}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {data.physicalStats.length && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <Ruler className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <div>
                            <p className="text-slate-200 font-semibold text-sm">Length</p>
                            <p className="text-slate-300 text-sm">{data.physicalStats.length}</p>
                          </div>
                        </div>
                      )}
                      {data.physicalStats.weight && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-white/5 rounded border border-white/10">
                            <Weight className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <div>
                            <p className="text-slate-200 font-semibold text-sm">Weight</p>
                            <p className="text-slate-300 text-sm">{data.physicalStats.weight}</p>
                            {data.physicalStats.weightComparison && (
                              <p className="text-slate-400 text-xs italic">{data.physicalStats.weightComparison}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SpotlightCard>
            )}

            {/* Diet Section */}
            {data.diet && (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => toggleSection('diet')}
                    className="w-full px-4 py-3 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Utensils className={`w-5 h-5 ${colors.text} group-hover:scale-110 transition-transform`} />
                      <span className={`font-bold ${colors.text}`}>Diet & Behavior</span>
                      <span className="text-2xl ml-2">{DIET_ICONS[data.diet.type]}</span>
                    </div>
                    {expandedSection === 'diet' ? (
                      <ChevronUp className={`w-5 h-5 ${colors.text}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                    )}
                  </button>
                  {expandedSection === 'diet' && (
                    <div className="p-4 bg-black/20 space-y-3">
                      <div>
                        <p className={`text-xs font-bold ${colors.text} uppercase tracking-wider mb-1`}>
                          {data.diet.type}
                        </p>
                        <p className="text-slate-300 text-sm leading-relaxed">
                          {data.diet.description}
                        </p>
                      </div>
                      {data.diet.primaryFood && data.diet.primaryFood.length > 0 && (
                        <div>
                          <p className="text-slate-200 font-semibold text-sm mb-1">Primary Food Sources</p>
                          <div className="flex flex-wrap gap-2">
                            {data.diet.primaryFood.map((food, idx) => (
                              <span key={idx} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-slate-300">
                                {food}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {data.diet.huntingStrategy && (
                        <div>
                          <p className="text-slate-200 font-semibold text-sm mb-1">Hunting Strategy</p>
                          <p className="text-slate-300 text-sm">{data.diet.huntingStrategy}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SpotlightCard>
            )}

            {/* Habitat Section */}
            {data.habitat && (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => toggleSection('habitat')}
                    className="w-full px-4 py-3 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-5 h-5 ${colors.text} group-hover:scale-110 transition-transform`} />
                      <span className={`font-bold ${colors.text}`}>Habitat & Era</span>
                    </div>
                    {expandedSection === 'habitat' ? (
                      <ChevronUp className={`w-5 h-5 ${colors.text}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                    )}
                  </button>
                  {expandedSection === 'habitat' && (
                    <div className="p-4 bg-black/20 space-y-3">
                      {data.habitat.period && (
                        <div className="flex items-start gap-3">
                          <Clock className={`w-4 h-4 ${colors.text} mt-1`} />
                          <div>
                            <p className="text-slate-200 font-semibold text-sm">Period</p>
                            <p className="text-slate-300 text-sm">{data.habitat.period}</p>
                            {data.habitat.timeRange && (
                              <p className="text-slate-400 text-xs">{data.habitat.timeRange}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {data.habitat.location && (
                        <div className="flex items-start gap-3">
                          <MapPin className={`w-4 h-4 ${colors.text} mt-1`} />
                          <div>
                            <p className="text-slate-200 font-semibold text-sm">Location</p>
                            <p className="text-slate-300 text-sm">{data.habitat.location}</p>
                          </div>
                        </div>
                      )}
                      {data.habitat.environment && (
                        <div>
                          <p className="text-slate-200 font-semibold text-sm mb-1">Environment</p>
                          <p className="text-slate-300 text-sm">{data.habitat.environment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SpotlightCard>
            )}

            {/* Taxonomy Section */}
            {data.taxonomy && (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => toggleSection('taxonomy')}
                    className="w-full px-4 py-3 bg-white/5 flex items-center justify-between hover:bg-white/10 transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <Users className={`w-5 h-5 ${colors.text} group-hover:scale-110 transition-transform`} />
                      <span className={`font-bold ${colors.text}`}>Family Tree</span>
                    </div>
                    {expandedSection === 'taxonomy' ? (
                      <ChevronUp className={`w-5 h-5 ${colors.text}`} />
                    ) : (
                      <ChevronDown className={`w-5 h-5 ${colors.text}`} />
                    )}
                  </button>
                  {expandedSection === 'taxonomy' && (
                    <div className="p-4 bg-black/20">
                      <div className="space-y-2 mb-3">
                        {data.taxonomy.kingdom && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Kingdom:</span>
                            <span className="text-slate-200 font-mono">{data.taxonomy.kingdom}</span>
                          </div>
                        )}
                        {data.taxonomy.phylum && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Phylum:</span>
                            <span className="text-slate-200 font-mono">{data.taxonomy.phylum}</span>
                          </div>
                        )}
                        {data.taxonomy.class && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Class:</span>
                            <span className="text-slate-200 font-mono">{data.taxonomy.class}</span>
                          </div>
                        )}
                        {data.taxonomy.order && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Order:</span>
                            <span className="text-slate-200 font-mono">{data.taxonomy.order}</span>
                          </div>
                        )}
                        {data.taxonomy.family && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-400">Family:</span>
                            <span className="text-slate-200 font-mono">{data.taxonomy.family}</span>
                          </div>
                        )}
                      </div>
                      {data.taxonomy.relatedSpecies && data.taxonomy.relatedSpecies.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-slate-200 font-semibold text-sm mb-2">Related Species</p>
                          <div className="flex flex-wrap gap-2">
                            {data.taxonomy.relatedSpecies.map((species, idx) => (
                              <span key={idx} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-slate-300 italic">
                                {species}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SpotlightCard>
            )}

          </div>
        </div>

        {/* Interesting Facts Section */}
        {data.interestingFacts && data.interestingFacts.length > 0 && (
          <div className="border-t border-white/10 p-6 bg-slate-900/40 backdrop-blur-xl">
            <h3 className={`text-lg font-bold ${colors.text} mb-4 flex items-center gap-2`}>
              <Sparkles className="w-5 h-5" />
              Fascinating Facts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.interestingFacts.map((fact, idx) => (
                <SpotlightCard key={idx} color={colors.rgb}>
                  <div className="glass-panel border border-white/10 rounded-lg p-4">
                    <h4 className={`text-sm font-bold ${colors.text} mb-2`}>
                      {fact.title}
                    </h4>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {fact.description}
                    </p>
                  </div>
                </SpotlightCard>
              ))}
            </div>
          </div>
        )}

        {/* Discovery Info Footer */}
        {data.discoveryInfo && (
          <div className="border-t border-white/10 px-6 py-3 bg-black/20">
            <p className="text-slate-400 text-xs">
              <span className="font-semibold">Discovery:</span> {data.discoveryInfo}
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default SpeciesProfile;
