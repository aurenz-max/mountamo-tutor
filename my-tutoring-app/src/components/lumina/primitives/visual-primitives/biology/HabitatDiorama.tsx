/**
 * Habitat Diorama - Interactive Ecosystem Explorer
 *
 * A scene-based primitive that presents an ecosystem with interactive organisms
 * and environmental features. Students explore relationships (who eats whom,
 * where things live, how they interact). Bridges observation (K-2) into
 * ecology concepts (3-8).
 *
 * Features:
 * - Interactive organisms with info cards
 * - Relationship visualization (food web, symbiosis, competition)
 * - Environmental features (water, shelter, sunlight)
 * - Disruption scenarios for systems thinking
 * - Grade-appropriate complexity (K-2: observation, 3-5: food chains, 6-8: ecosystem dynamics)
 */

import React, { useState } from 'react';
import { Info, Zap, Eye, Link2 } from 'lucide-react';
import { usePrimitiveEvaluation } from '../../../evaluation';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Organism {
  id: string;
  commonName: string;
  role: 'producer' | 'primary-consumer' | 'secondary-consumer' | 'tertiary-consumer' | 'decomposer';
  imagePrompt: string;
  position: { x: string; y: string }; // Percentage positions
  description: string;
  adaptations: string[];
}

export interface Relationship {
  fromId: string;
  toId: string;
  type: 'predation' | 'symbiosis-mutualism' | 'symbiosis-commensalism' | 'symbiosis-parasitism' | 'competition';
  description: string;
}

export interface EnvironmentalFeature {
  id: string;
  name: string;
  description: string;
  position: { x: string; y: string }; // Percentage positions
}

export interface DisruptionScenario {
  event: string;
  cascadeEffects: string[];
  question: string;
}

export interface HabitatDioramaData {
  primitiveType: 'habitat-diorama';
  habitat: {
    name: string;
    biome: string;
    climate: string;
    description: string;
  };
  organisms: Organism[];
  relationships: Relationship[];
  environmentalFeatures: EnvironmentalFeature[];
  disruptionScenario?: DisruptionScenario;
  gradeBand: 'K-2' | '3-5' | '6-8';
}

// ============================================================================
// Props Interface
// ============================================================================

export interface HabitatDioramaProps {
  data: HabitatDioramaData;
  instanceId?: string;
  skillId?: string;
  exhibitId?: string;
  onInteraction?: (interaction: {
    type: string;
    organismId?: string;
    featureId?: string;
    relationshipType?: string;
    timestamp: number;
  }) => void;
}

// ============================================================================
// Component
// ============================================================================

const HabitatDiorama: React.FC<HabitatDioramaProps> = ({
  data,
  instanceId,
  skillId,
  exhibitId,
  onInteraction
}) => {
  const [selectedOrganism, setSelectedOrganism] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [showRelationships, setShowRelationships] = useState(false);
  const [viewedOrganisms, setViewedOrganisms] = useState<Set<string>>(new Set());
  const [studentPredictions, setStudentPredictions] = useState<string[]>([]);
  const [showDisruption, setShowDisruption] = useState(false);

  // Evaluation hook for tracking progress
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation({
    primitiveType: 'habitat-diorama',
    instanceId: instanceId || `habitat-diorama-${Date.now()}`,
    skillId,
    exhibitId,
  });

  // Handle organism click
  const handleOrganismClick = (organismId: string) => {
    setSelectedOrganism(organismId === selectedOrganism ? null : organismId);
    setSelectedFeature(null);

    const newViewed = new Set(viewedOrganisms);
    newViewed.add(organismId);
    setViewedOrganisms(newViewed);

    const interaction = {
      type: 'organism_viewed',
      organismId,
      timestamp: Date.now()
    };

    onInteraction?.(interaction);
  };

  // Handle feature click
  const handleFeatureClick = (featureId: string) => {
    setSelectedFeature(featureId === selectedFeature ? null : featureId);
    setSelectedOrganism(null);

    const interaction = {
      type: 'feature_viewed',
      featureId,
      timestamp: Date.now()
    };

    onInteraction?.(interaction);
  };

  // Toggle relationship view
  const handleToggleRelationships = () => {
    const newState = !showRelationships;
    setShowRelationships(newState);

    const interaction = {
      type: 'relationships_toggled',
      timestamp: Date.now()
    };

    onInteraction?.(interaction);
  };

  // Get organism by ID
  const getOrganism = (id: string) => data.organisms.find(o => o.id === id);

  // Get role color
  const getRoleColor = (role: Organism['role']) => {
    const colors = {
      'producer': 'bg-green-500/20 border-green-500/50 text-green-300',
      'primary-consumer': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
      'secondary-consumer': 'bg-orange-500/20 border-orange-500/50 text-orange-300',
      'tertiary-consumer': 'bg-red-500/20 border-red-500/50 text-red-300',
      'decomposer': 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    };
    return colors[role];
  };

  // Get relationship type info
  const getRelationshipInfo = (type: Relationship['type']) => {
    const info = {
      'predation': { color: 'stroke-red-500', label: 'Eats', icon: '🍴' },
      'symbiosis-mutualism': { color: 'stroke-green-500', label: 'Helps (Both)', icon: '🤝' },
      'symbiosis-commensalism': { color: 'stroke-blue-500', label: 'Helps (One)', icon: '➡️' },
      'symbiosis-parasitism': { color: 'stroke-orange-500', label: 'Harms', icon: '🦠' },
      'competition': { color: 'stroke-yellow-500', label: 'Competes', icon: '⚔️' },
    };
    return info[type];
  };

  // Selected organism data
  const selectedOrganismData = selectedOrganism ? getOrganism(selectedOrganism) : null;
  const selectedFeatureData = selectedFeature
    ? data.environmentalFeatures.find(f => f.id === selectedFeature)
    : null;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">{data.habitat.name}</h3>
          <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
            <span className="px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700">
              {data.habitat.biome}
            </span>
            <span className="px-3 py-1 bg-slate-800/50 rounded-full border border-slate-700">
              {data.habitat.climate}
            </span>
          </div>
          <p className="text-slate-300 leading-relaxed max-w-3xl">
            {data.habitat.description}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggleRelationships}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            showRelationships
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
              : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
          } border`}
        >
          {showRelationships ? <Eye className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          {showRelationships ? 'Hide Connections' : 'Show Connections'}
        </button>

        {data.disruptionScenario && data.gradeBand !== 'K-2' && (
          <button
            onClick={() => setShowDisruption(!showDisruption)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              showDisruption
                ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
            } border`}
          >
            <Zap className="w-4 h-4" />
            {showDisruption ? 'Hide Disruption' : 'What If...?'}
          </button>
        )}

        <div className="ml-auto text-sm text-slate-400">
          Explored: {viewedOrganisms.size} / {data.organisms.length} organisms
        </div>
      </div>

      {/* Main Diorama Scene */}
      <div className="relative w-full h-[600px] bg-gradient-to-b from-slate-900 to-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {/* SVG for relationship arrows */}
        {showRelationships && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
              </marker>
            </defs>
            {data.relationships.map((rel, idx) => {
              const fromOrg = getOrganism(rel.fromId);
              const toOrg = getOrganism(rel.toId);
              if (!fromOrg || !toOrg) return null;

              const x1 = parseFloat(fromOrg.position.x);
              const y1 = parseFloat(fromOrg.position.y);
              const x2 = parseFloat(toOrg.position.x);
              const y2 = parseFloat(toOrg.position.y);

              const info = getRelationshipInfo(rel.type);

              return (
                <g key={idx}>
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    className={info.color}
                    strokeWidth="2"
                    strokeDasharray={rel.type.startsWith('symbiosis') ? '5,5' : undefined}
                    markerEnd="url(#arrowhead)"
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Organisms */}
        {data.organisms.map((organism) => (
          <button
            key={organism.id}
            onClick={() => handleOrganismClick(organism.id)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
              selectedOrganism === organism.id
                ? 'scale-110 z-20'
                : 'hover:scale-105 z-10'
            }`}
            style={{
              left: organism.position.x,
              top: organism.position.y,
            }}
          >
            <div className={`w-16 h-16 rounded-full border-2 ${getRoleColor(organism.role)} backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg`}>
              {organism.imagePrompt.includes('plant') || organism.role === 'producer' ? '🌿' :
               organism.role === 'decomposer' ? '🍄' :
               organism.imagePrompt.includes('bird') ? '🦅' :
               organism.imagePrompt.includes('fish') ? '🐟' :
               organism.imagePrompt.includes('insect') || organism.imagePrompt.includes('bee') ? '🐝' :
               organism.imagePrompt.includes('predator') || organism.role === 'tertiary-consumer' ? '🦁' :
               organism.role === 'secondary-consumer' ? '🦊' : '🐰'}
            </div>
            {viewedOrganisms.has(organism.id) && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-900" />
            )}
          </button>
        ))}

        {/* Environmental Features */}
        {data.environmentalFeatures.map((feature) => (
          <button
            key={feature.id}
            onClick={() => handleFeatureClick(feature.id)}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
              selectedFeature === feature.id
                ? 'scale-110 z-20'
                : 'hover:scale-105 z-10'
            }`}
            style={{
              left: feature.position.x,
              top: feature.position.y,
            }}
          >
            <div className="w-12 h-12 rounded-lg bg-slate-700/50 border border-slate-600 backdrop-blur-sm flex items-center justify-center text-xl shadow-lg">
              {feature.name.toLowerCase().includes('water') ? '💧' :
               feature.name.toLowerCase().includes('sun') ? '☀️' :
               feature.name.toLowerCase().includes('shelter') || feature.name.toLowerCase().includes('tree') ? '🏠' :
               feature.name.toLowerCase().includes('rock') ? '🪨' : '🌍'}
            </div>
          </button>
        ))}
      </div>

      {/* Info Panel */}
      {(selectedOrganismData || selectedFeatureData) && (
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          {selectedOrganismData && (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-xl font-bold text-white mb-1">
                    {selectedOrganismData.commonName}
                  </h4>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(selectedOrganismData.role)}`}>
                    {selectedOrganismData.role.replace('-', ' ')}
                  </span>
                </div>
              </div>

              <p className="text-slate-300 mb-4 leading-relaxed">
                {selectedOrganismData.description}
              </p>

              {selectedOrganismData.adaptations.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-slate-400 mb-2">Adaptations:</h5>
                  <ul className="space-y-2">
                    {selectedOrganismData.adaptations.map((adaptation, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <span>{adaptation}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Show relationships for this organism */}
              {data.gradeBand !== 'K-2' && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <h5 className="text-sm font-semibold text-slate-400 mb-2">Relationships:</h5>
                  <div className="space-y-2">
                    {data.relationships
                      .filter(rel => rel.fromId === selectedOrganismData.id || rel.toId === selectedOrganismData.id)
                      .map((rel, idx) => {
                        const info = getRelationshipInfo(rel.type);
                        const otherOrg = rel.fromId === selectedOrganismData.id
                          ? getOrganism(rel.toId)
                          : getOrganism(rel.fromId);

                        return (
                          <div key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                            <span>{info.icon}</span>
                            <span>
                              <span className="font-medium text-white">{info.label}</span> {otherOrg?.commonName}
                              {data.gradeBand === '6-8' && ` — ${rel.description}`}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          )}

          {selectedFeatureData && (
            <>
              <h4 className="text-xl font-bold text-white mb-2">
                {selectedFeatureData.name}
              </h4>
              <p className="text-slate-300 leading-relaxed">
                {selectedFeatureData.description}
              </p>
            </>
          )}
        </div>
      )}

      {/* Disruption Scenario (Grades 3-8) */}
      {showDisruption && data.disruptionScenario && (
        <div className="bg-orange-500/10 backdrop-blur-sm border border-orange-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <Zap className="w-6 h-6 text-orange-400 flex-shrink-0 mt-1" />
            <div>
              <h4 className="text-lg font-bold text-white mb-2">
                Ecosystem Disruption Scenario
              </h4>
              <p className="text-orange-200 mb-4 leading-relaxed">
                {data.disruptionScenario.event}
              </p>
              <p className="text-slate-300 font-medium mb-3">
                {data.disruptionScenario.question}
              </p>
            </div>
          </div>

          {data.gradeBand === '6-8' && (
            <div className="mt-4 pt-4 border-t border-orange-500/30">
              <h5 className="text-sm font-semibold text-orange-300 mb-3">
                Cascade Effects:
              </h5>
              <div className="space-y-2">
                {data.disruptionScenario.cascadeEffects.map((effect, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="text-orange-400 font-bold">{idx + 1}.</span>
                    <span>{effect}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-start gap-2 text-xs text-orange-300/80">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Think about how removing or changing one part of an ecosystem can affect many other organisms and processes.
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl p-4">
        <h5 className="text-sm font-semibold text-slate-400 mb-3">Organism Roles:</h5>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { role: 'producer', label: 'Producer', desc: 'Makes own food' },
            { role: 'primary-consumer', label: 'Primary Consumer', desc: 'Eats producers' },
            { role: 'secondary-consumer', label: 'Secondary Consumer', desc: 'Eats primary consumers' },
            { role: 'tertiary-consumer', label: 'Tertiary Consumer', desc: 'Top predator' },
            { role: 'decomposer', label: 'Decomposer', desc: 'Breaks down dead matter' },
          ].map((item) => (
            <div key={item.role} className="flex items-start gap-2">
              <div className={`w-3 h-3 rounded-full border flex-shrink-0 mt-1 ${getRoleColor(item.role as Organism['role'])}`} />
              <div>
                <div className="text-xs font-medium text-white">{item.label}</div>
                {data.gradeBand !== 'K-2' && (
                  <div className="text-xs text-slate-400">{item.desc}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HabitatDiorama;