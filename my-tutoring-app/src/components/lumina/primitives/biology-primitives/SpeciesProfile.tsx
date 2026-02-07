import React, { useState } from 'react';
import { Skull, Ruler, Weight, Utensils, MapPin, Clock, Users, Sparkles, Image as ImageIcon } from 'lucide-react';
import { SpotlightCard } from '../../components/SpotlightCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  const [imageError, setImageError] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const category = data.category || 'dinosaur';
  const colors = CATEGORY_COLORS[category];

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
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl overflow-hidden">

        {/* Header Section */}
        <CardHeader className="relative bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-b border-white/10">
          {/* Ambient glow */}
          <div
            className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[120px] opacity-20"
            style={{ backgroundColor: colors.accent }}
          />

          <div className="relative flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className={`text-4xl font-bold ${colors.text} mb-2 drop-shadow-lg`}>
                {data.commonName}
              </CardTitle>
              <CardDescription className="text-slate-300 italic text-lg mb-1">
                {data.scientificName}
              </CardDescription>
              {data.nameMeaning && (
                <p className="text-slate-400 text-sm">
                  <span className="font-semibold">Name Meaning:</span> {data.nameMeaning}
                </p>
              )}
            </div>
            <Badge className="bg-white/5 backdrop-blur-sm border-white/20">
              <span className={`text-xs font-bold ${colors.text} uppercase tracking-wider`}>
                {category}
              </span>
            </Badge>
          </div>
        </CardHeader>

        {/* Main Content Grid */}
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-slate-900/40 backdrop-blur-xl">

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
                    <Button
                      onClick={handleGenerateImage}
                      variant="ghost"
                      className={`bg-white/5 ${colors.text} border border-white/20 hover:bg-white/10`}
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Generate Visual
                    </Button>
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
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className={`text-sm font-bold ${colors.text} flex items-center gap-2`}>
                      <Sparkles className="w-4 h-4" />
                      Ecological Role
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {data.biologicalNiche}
                    </p>
                  </CardContent>
                </Card>
              </SpotlightCard>
            )}
          </div>

          {/* Right Column: Characteristics */}
          <div className="space-y-3">
            <Accordion type="single" collapsible defaultValue="physical">

              {/* Physical Stats Section */}
              {data.physicalStats && (
                <AccordionItem value="physical" className="border-white/10">
                  <SpotlightCard color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Ruler className={`w-5 h-5 ${colors.text}`} />
                          <span className={`font-bold ${colors.text}`}>Physical Stats</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
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
                      </AccordionContent>
                    </Card>
                  </SpotlightCard>
                </AccordionItem>
              )}

              {/* Diet Section */}
              {data.diet && (
                <AccordionItem value="diet" className="border-white/10">
                  <SpotlightCard color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Utensils className={`w-5 h-5 ${colors.text}`} />
                          <span className={`font-bold ${colors.text}`}>Diet & Behavior</span>
                          <span className="text-2xl ml-2">{DIET_ICONS[data.diet.type]}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
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
                                  <Badge key={idx} className="bg-white/5 border-white/10 text-slate-300">
                                    {food}
                                  </Badge>
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
                      </AccordionContent>
                    </Card>
                  </SpotlightCard>
                </AccordionItem>
              )}

              {/* Habitat Section */}
              {data.habitat && (
                <AccordionItem value="habitat" className="border-white/10">
                  <SpotlightCard color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <MapPin className={`w-5 h-5 ${colors.text}`} />
                          <span className={`font-bold ${colors.text}`}>Habitat & Era</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
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
                      </AccordionContent>
                    </Card>
                  </SpotlightCard>
                </AccordionItem>
              )}

              {/* Taxonomy Section */}
              {data.taxonomy && (
                <AccordionItem value="taxonomy" className="border-white/10">
                  <SpotlightCard color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Users className={`w-5 h-5 ${colors.text}`} />
                          <span className={`font-bold ${colors.text}`}>Family Tree</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
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
                                <Badge key={idx} className="bg-white/5 border-white/10 text-slate-300 italic">
                                  {species}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </Card>
                  </SpotlightCard>
                </AccordionItem>
              )}

            </Accordion>
          </div>
        </CardContent>

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
                  <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                    <CardHeader className="pb-3">
                      <CardTitle className={`text-sm font-bold ${colors.text}`}>
                        {fact.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-slate-300 text-sm leading-relaxed">
                        {fact.description}
                      </p>
                    </CardContent>
                  </Card>
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

      </Card>
    </div>
  );
};

export default SpeciesProfile;
