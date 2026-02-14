import React, { useState } from 'react';
import { Wrench, Gauge, Zap, Clock, Globe, Ruler, Sparkles, Cog, History as HistoryIcon, Image as ImageIcon, ArrowRight } from 'lucide-react';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Data Interfaces (Single Source of Truth)
// ============================================================================

export interface QuickStats {
  topSpeed?: string | null;
  weight?: string | null;
  range?: string | null;
  capacity?: string | null;
  yearIntroduced?: string | null;
  powerSource?: string | null;
  size?: string | null;
  speedComparison?: string | null;
  weightComparison?: string | null;
  sizeComparison?: string | null;
}

export interface KeyComponent {
  name: string;
  description: string;
  funAnalogy?: string | null;
}

export interface MachineHistory {
  inventor?: string | null;
  yearInvented?: string | null;
  originStory?: string | null;
  milestones?: string[];
  famousExamples?: string[];
}

export interface FascinatingFact {
  title: string;
  description: string;
  icon?: 'sparkles' | 'zap' | 'gauge' | 'clock' | 'globe' | 'ruler';
}

export interface MachineProfileData {
  machineName: string;
  designation?: string | null;
  nameMeaning?: string | null;
  category?: 'airplane' | 'helicopter' | 'car' | 'train' | 'ship' | 'truck' | 'submarine' | 'bicycle' | 'construction' | 'spacecraft';
  era?: string;
  imageUrl?: string | null;
  imagePrompt?: string;
  quickStats?: QuickStats;
  howItWorks?: string;
  keyComponents?: KeyComponent[];
  history?: MachineHistory;
  fascinatingFacts?: FascinatingFact[];
  realWorldConnections?: string[];
  relatedMachines?: string[];
  gradeBand?: 'K-2' | '3-5';
}

// ============================================================================
// Category Theming
// ============================================================================

const CATEGORY_COLORS = {
  airplane: { text: 'text-sky-300', accent: '#0ea5e9', rgb: '14, 165, 233' },
  helicopter: { text: 'text-teal-300', accent: '#14b8a6', rgb: '20, 184, 166' },
  car: { text: 'text-red-300', accent: '#f87171', rgb: '248, 113, 113' },
  train: { text: 'text-orange-300', accent: '#fb923c', rgb: '251, 146, 60' },
  ship: { text: 'text-blue-300', accent: '#60a5fa', rgb: '96, 165, 250' },
  truck: { text: 'text-amber-300', accent: '#fbbf24', rgb: '251, 191, 36' },
  submarine: { text: 'text-cyan-300', accent: '#22d3ee', rgb: '34, 211, 238' },
  bicycle: { text: 'text-green-300', accent: '#86efac', rgb: '134, 239, 172' },
  construction: { text: 'text-yellow-300', accent: '#fde047', rgb: '253, 224, 71' },
  spacecraft: { text: 'text-violet-300', accent: '#c084fc', rgb: '192, 132, 252' },
};

const FACT_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  sparkles: Sparkles,
  zap: Zap,
  gauge: Gauge,
  clock: Clock,
  globe: Globe,
  ruler: Ruler,
};

// ============================================================================
// Component
// ============================================================================

interface MachineProfileProps {
  data: MachineProfileData;
  className?: string;
}

const MachineProfile: React.FC<MachineProfileProps> = ({ data, className = '' }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const category = data.category || 'airplane';
  const colors = CATEGORY_COLORS[category];

  // Handle on-demand image generation
  const handleGenerateImage = async () => {
    if (!data.imagePrompt || isLoadingImage || generatedImageUrl) return;

    setIsLoadingImage(true);
    setImageError(false);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateMachineImage',
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
      console.error('Failed to generate machine image:', error);
      setImageError(true);
    } finally {
      setIsLoadingImage(false);
    }
  };

  // Helper to render stat rows
  const renderStatRow = (label: string, value: string | null | undefined, icon: React.ReactNode) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white/5 rounded border border-white/10">
          {icon}
        </div>
        <div>
          <p className="text-slate-200 font-semibold text-sm">{label}</p>
          <p className="text-slate-300 text-sm">{value}</p>
        </div>
      </div>
    );
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
                {data.machineName}
              </CardTitle>
              {data.designation && (
                <CardDescription className="text-slate-300 italic text-lg mb-1">
                  {data.designation}
                </CardDescription>
              )}
              {data.nameMeaning && (
                <p className="text-slate-400 text-sm">
                  <span className="font-semibold">Name Origin:</span> {data.nameMeaning}
                </p>
              )}
              {data.era && (
                <p className="text-slate-400 text-sm mt-1">
                  <span className="font-semibold">Era:</span> {data.era}
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

          {/* Left Column: Image & How It Works */}
          <div className="space-y-4">
            {/* Image Section */}
            {isLoadingImage ? (
              <SpotlightCard color={colors.rgb}>
                <div className="glass-panel rounded-xl flex flex-col items-center justify-center min-h-[300px] p-8">
                  <div
                    className="w-12 h-12 border-4 border-white/10 border-t-current rounded-full animate-spin mb-4"
                    style={{ color: colors.accent }}
                  />
                  <p className={`${colors.text} font-medium mb-2`}>Generating machine visualization...</p>
                  {data.imagePrompt && (
                    <p className="text-xs text-slate-500 text-center italic max-w-md">
                      &quot;{data.imagePrompt}&quot;
                    </p>
                  )}
                </div>
              </SpotlightCard>
            ) : (data.imageUrl || generatedImageUrl) && !imageError ? (
              <SpotlightCard color={colors.rgb}>
                <div className="relative rounded-xl overflow-hidden bg-black/60 backdrop-blur-sm border border-white/10">
                  <img
                    src={data.imageUrl || generatedImageUrl || ''}
                    alt={data.machineName}
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
                  <Wrench className={`w-16 h-16 ${colors.text} mb-4`} />
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

            {/* How It Works */}
            {data.howItWorks && (
              <SpotlightCard color={colors.rgb}>
                <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className={`text-sm font-bold ${colors.text} flex items-center gap-2`}>
                      <Cog className="w-4 h-4" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {data.howItWorks}
                    </p>
                  </CardContent>
                </Card>
              </SpotlightCard>
            )}
          </div>

          {/* Right Column: Accordion Sections */}
          <div className="space-y-3">
            <Accordion type="single" collapsible defaultValue="quickStats">

              {/* Quick Stats Section */}
              {data.quickStats && (
                <AccordionItem value="quickStats" className="border-white/10">
                  <SpotlightCard color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Gauge className={`w-5 h-5 ${colors.text}`} />
                          <span className={`font-bold ${colors.text}`}>Quick Stats</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          {renderStatRow('Top Speed', data.quickStats.topSpeed, <Zap className={`w-4 h-4 ${colors.text}`} />)}
                          {renderStatRow('Weight', data.quickStats.weight, <Gauge className={`w-4 h-4 ${colors.text}`} />)}
                          {renderStatRow('Range', data.quickStats.range, <Globe className={`w-4 h-4 ${colors.text}`} />)}
                          {renderStatRow('Capacity', data.quickStats.capacity, <Ruler className={`w-4 h-4 ${colors.text}`} />)}
                          {renderStatRow('Year Introduced', data.quickStats.yearIntroduced, <Clock className={`w-4 h-4 ${colors.text}`} />)}
                          {renderStatRow('Power Source', data.quickStats.powerSource, <Cog className={`w-4 h-4 ${colors.text}`} />)}
                          {renderStatRow('Size', data.quickStats.size, <Ruler className={`w-4 h-4 ${colors.text}`} />)}

                          {/* Comparisons */}
                          {(data.quickStats.speedComparison || data.quickStats.weightComparison || data.quickStats.sizeComparison) && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <p className="text-slate-200 font-semibold text-sm mb-2">Kid-Friendly Comparisons</p>
                              <div className="flex flex-wrap gap-2">
                                {data.quickStats.speedComparison && (
                                  <Badge className="bg-white/5 border-white/10 text-slate-300 text-xs">
                                    {data.quickStats.speedComparison}
                                  </Badge>
                                )}
                                {data.quickStats.weightComparison && (
                                  <Badge className="bg-white/5 border-white/10 text-slate-300 text-xs">
                                    {data.quickStats.weightComparison}
                                  </Badge>
                                )}
                                {data.quickStats.sizeComparison && (
                                  <Badge className="bg-white/5 border-white/10 text-slate-300 text-xs">
                                    {data.quickStats.sizeComparison}
                                  </Badge>
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

              {/* Key Components Section */}
              {data.keyComponents && data.keyComponents.length > 0 && (
                <AccordionItem value="keyComponents" className="border-white/10">
                  <SpotlightCard color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Wrench className={`w-5 h-5 ${colors.text}`} />
                          <span className={`font-bold ${colors.text}`}>Key Components</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-4">
                          {data.keyComponents.map((component, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                              <div className="p-2 bg-white/5 rounded border border-white/10 shrink-0">
                                <Cog className={`w-4 h-4 ${colors.text}`} />
                              </div>
                              <div>
                                <p className="text-slate-200 font-semibold text-sm">{component.name}</p>
                                <p className="text-slate-300 text-sm">{component.description}</p>
                                {component.funAnalogy && (
                                  <p className="text-slate-400 text-xs italic mt-1">
                                    {component.funAnalogy}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </Card>
                  </SpotlightCard>
                </AccordionItem>
              )}

              {/* History Section */}
              {data.history && (
                <AccordionItem value="history" className="border-white/10">
                  <SpotlightCard color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
                        <div className="flex items-center gap-2">
                          <HistoryIcon className={`w-5 h-5 ${colors.text}`} />
                          <span className={`font-bold ${colors.text}`}>History</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          {data.history.inventor && (
                            <div>
                              <p className="text-slate-200 font-semibold text-sm">Inventor</p>
                              <p className="text-slate-300 text-sm">{data.history.inventor}</p>
                            </div>
                          )}
                          {data.history.yearInvented && (
                            <div>
                              <p className="text-slate-200 font-semibold text-sm">Year Invented</p>
                              <p className="text-slate-300 text-sm">{data.history.yearInvented}</p>
                            </div>
                          )}
                          {data.history.originStory && (
                            <div>
                              <p className="text-slate-200 font-semibold text-sm">Origin Story</p>
                              <p className="text-slate-300 text-sm leading-relaxed">{data.history.originStory}</p>
                            </div>
                          )}
                          {data.history.milestones && data.history.milestones.length > 0 && (
                            <div>
                              <p className="text-slate-200 font-semibold text-sm mb-2">Milestones</p>
                              <div className="space-y-1">
                                {data.history.milestones.map((milestone, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <ArrowRight className={`w-3 h-3 ${colors.text} mt-1 shrink-0`} />
                                    <p className="text-slate-300 text-sm">{milestone}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {data.history.famousExamples && data.history.famousExamples.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <p className="text-slate-200 font-semibold text-sm mb-2">Famous Examples</p>
                              <div className="flex flex-wrap gap-2">
                                {data.history.famousExamples.map((example, idx) => (
                                  <Badge key={idx} className="bg-white/5 border-white/10 text-slate-300">
                                    {example}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </Card>
                  </SpotlightCard>
                </AccordionItem>
              )}

            </Accordion>
          </div>
        </CardContent>

        {/* Fascinating Facts Section */}
        {data.fascinatingFacts && data.fascinatingFacts.length > 0 && (
          <div className="border-t border-white/10 p-6 bg-slate-900/40 backdrop-blur-xl">
            <h3 className={`text-lg font-bold ${colors.text} mb-4 flex items-center gap-2`}>
              <Sparkles className="w-5 h-5" />
              Fascinating Facts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.fascinatingFacts.map((fact, idx) => {
                const IconComponent = fact.icon ? FACT_ICON_MAP[fact.icon] || Sparkles : Sparkles;
                return (
                  <SpotlightCard key={idx} color={colors.rgb}>
                    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
                      <CardHeader className="pb-3">
                        <CardTitle className={`text-sm font-bold ${colors.text} flex items-center gap-2`}>
                          <IconComponent className="w-4 h-4" />
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
                );
              })}
            </div>
          </div>
        )}

        {/* Real World Connections */}
        {data.realWorldConnections && data.realWorldConnections.length > 0 && (
          <div className="border-t border-white/10 p-6 bg-slate-900/40 backdrop-blur-xl">
            <h3 className={`text-sm font-bold ${colors.text} mb-3 flex items-center gap-2`}>
              <Globe className="w-4 h-4" />
              Real World Connections
            </h3>
            <div className="space-y-2">
              {data.realWorldConnections.map((connection, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <ArrowRight className={`w-3 h-3 ${colors.text} mt-1 shrink-0`} />
                  <p className="text-slate-300 text-sm">{connection}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Machines Footer */}
        {data.relatedMachines && data.relatedMachines.length > 0 && (
          <div className="border-t border-white/10 px-6 py-3 bg-black/20">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-slate-400 text-xs font-semibold">Related Machines:</p>
              {data.relatedMachines.map((machine, idx) => (
                <Badge key={idx} className="bg-white/5 border-white/10 text-slate-300 italic text-xs">
                  {machine}
                </Badge>
              ))}
            </div>
          </div>
        )}

      </Card>
    </div>
  );
};

export default MachineProfile;
