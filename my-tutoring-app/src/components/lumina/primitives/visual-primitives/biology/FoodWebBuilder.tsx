/**
 * Food Web Builder - Interactive Energy Flow System
 *
 * Students construct a food web by drawing energy-flow connections between organisms.
 * Tests understanding of producer/consumer relationships, trophic levels, and energy transfer.
 * Can also model disruptions (remove a species, see cascading effects).
 *
 * Features:
 * - Node-graph interface with positioned organisms
 * - Drag to create directional arrows showing energy flow
 * - Color coding by trophic level
 * - Disruption mode to explore ecosystem effects
 * - Grade-appropriate complexity (3-5: simple chains, 6-8: complex webs)
 */

import React, { useState } from 'react';
import { Link2, Trash2, AlertTriangle, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { FoodWebBuilderMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Organism {
  id: string;
  name: string;
  imagePrompt: string;
  trophicLevel: 'producer' | 'primary-consumer' | 'secondary-consumer' | 'tertiary-consumer' | 'decomposer';
  position: { x: string; y: string }; // Percentage positions
}

export interface Connection {
  fromId: string; // prey/energy source
  toId: string;   // predator/consumer
  relationship: string; // e.g., "Rabbits eat grass"
}

export interface DisruptionChallenge {
  removeOrganismId: string;
  question: string;
  expectedEffects: string[];
  explanation: string;
}

export interface FoodWebBuilderData {
  primitiveType: 'food-web-builder';
  ecosystem: string;
  organisms: Organism[];
  correctConnections: Connection[];
  disruptionChallenges?: DisruptionChallenge[];
  gradeBand: '3-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FoodWebBuilderMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

export interface FoodWebBuilderProps {
  data: FoodWebBuilderData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const FoodWebBuilder: React.FC<FoodWebBuilderProps> = ({ data, className }) => {
  // State
  const [studentConnections, setStudentConnections] = useState<Connection[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawFrom, setDrawFrom] = useState<string | null>(null);
  const [showDisruption, setShowDisruption] = useState(false);
  const [currentDisruption, setCurrentDisruption] = useState<number>(0);
  const [disruptionPredictions, setDisruptionPredictions] = useState<string[][]>([]);

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<FoodWebBuilderMetrics>({
    primitiveType: 'food-web-builder',
    instanceId: instanceId || `food-web-builder-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Get trophic level color
  const getTrophicColor = (level: Organism['trophicLevel']) => {
    const colors = {
      'producer': 'bg-green-500/20 border-green-500/50 text-green-300',
      'primary-consumer': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
      'secondary-consumer': 'bg-orange-500/20 border-orange-500/50 text-orange-300',
      'tertiary-consumer': 'bg-red-500/20 border-red-500/50 text-red-300',
      'decomposer': 'bg-purple-500/20 border-purple-500/50 text-purple-300',
    };
    return colors[level];
  };

  // Get trophic level label
  const getTrophicLabel = (level: Organism['trophicLevel']) => {
    const labels = {
      'producer': 'Producer',
      'primary-consumer': '1° Consumer',
      'secondary-consumer': '2° Consumer',
      'tertiary-consumer': '3° Consumer',
      'decomposer': 'Decomposer',
    };
    return labels[level];
  };

  // Start drawing a connection
  const handleOrganismClick = (orgId: string) => {
    if (hasSubmitted) return;

    if (!isDrawing) {
      // Start drawing from this organism
      setIsDrawing(true);
      setDrawFrom(orgId);
    } else {
      // Complete the connection
      if (drawFrom && drawFrom !== orgId) {
        const newConnection: Connection = {
          fromId: drawFrom,
          toId: orgId,
          relationship: `${getOrganism(drawFrom)?.name} → ${getOrganism(orgId)?.name}`
        };

        // Check if connection already exists
        const exists = studentConnections.some(
          c => c.fromId === drawFrom && c.toId === orgId
        );

        if (!exists) {
          setStudentConnections([...studentConnections, newConnection]);
        }
      }

      // Reset drawing state
      setIsDrawing(false);
      setDrawFrom(null);
    }
  };

  // Remove a connection
  const handleRemoveConnection = (fromId: string, toId: string) => {
    if (hasSubmitted) return;
    setStudentConnections(studentConnections.filter(
      c => !(c.fromId === fromId && c.toId === toId)
    ));
  };

  // Get organism by ID
  const getOrganism = (id: string) => data.organisms.find(o => o.id === id);

  // Check if connection is correct
  const isCorrectConnection = (fromId: string, toId: string) => {
    return data.correctConnections.some(
      c => c.fromId === fromId && c.toId === toId
    );
  };

  // Evaluate student web
  const evaluateWeb = () => {
    const correctAttempts = studentConnections.filter(c =>
      isCorrectConnection(c.fromId, c.toId)
    );

    const missingConnections = data.correctConnections.filter(correct =>
      !studentConnections.some(student =>
        student.fromId === correct.fromId && student.toId === correct.toId
      )
    );

    const extraConnections = studentConnections.filter(student =>
      !data.correctConnections.some(correct =>
        correct.fromId === student.fromId && correct.toId === student.toId
      )
    );

    const totalCorrect = data.correctConnections.length;
    const accuracy = totalCorrect > 0 ? (correctAttempts.length / totalCorrect) * 100 : 0;
    const isComplete = missingConnections.length === 0 && extraConnections.length === 0;

    return {
      correctAttempts,
      missingConnections,
      extraConnections,
      accuracy,
      isComplete
    };
  };

  // Handle submit
  const handleSubmit = () => {
    if (hasSubmitted) return;

    const evaluation = evaluateWeb();
    const success = evaluation.isComplete;
    const score = evaluation.accuracy;

    const metrics: FoodWebBuilderMetrics = {
      type: 'food-web-builder',
      totalConnections: data.correctConnections.length,
      correctConnections: evaluation.correctAttempts.length,
      missingConnections: evaluation.missingConnections.length,
      extraConnections: evaluation.extraConnections.length,
      webComplete: evaluation.isComplete,
      accuracy: evaluation.accuracy,
      connectionAttempts: studentConnections.map(c => ({
        fromId: c.fromId,
        toId: c.toId,
        isCorrect: isCorrectConnection(c.fromId, c.toId)
      })),
      disruptionPredictions: disruptionPredictions.map((predictions, idx) => {
        const challenge = data.disruptionChallenges?.[idx];
        if (!challenge) return {
          removedOrganismId: '',
          studentPredictions: [],
          matchedExpected: 0,
          totalExpected: 0
        };

        const matchedExpected = predictions.filter(p =>
          challenge.expectedEffects.some(e =>
            e.toLowerCase().includes(p.toLowerCase()) ||
            p.toLowerCase().includes(e.toLowerCase())
          )
        ).length;

        return {
          removedOrganismId: challenge.removeOrganismId,
          studentPredictions: predictions,
          matchedExpected,
          totalExpected: challenge.expectedEffects.length
        };
      }),
    };

    submitResult(success, score, metrics, {
      studentWork: {
        connections: studentConnections,
        disruptionPredictions
      },
    });
  };

  // Handle reset
  const handleReset = () => {
    setStudentConnections([]);
    setIsDrawing(false);
    setDrawFrom(null);
    setShowDisruption(false);
    setCurrentDisruption(0);
    setDisruptionPredictions([]);
    resetAttempt();
  };

  const evaluation = evaluateWeb();

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className}`}>
      <CardHeader>
        <CardTitle className="text-slate-100">Food Web Builder</CardTitle>
        <CardDescription className="text-slate-400">
          {data.ecosystem} - Draw arrows to show who eats whom (energy flows from prey → predator)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-400 font-medium">Trophic Levels:</span>
          {(['producer', 'primary-consumer', 'secondary-consumer', 'tertiary-consumer', 'decomposer'] as const).map(level => (
            <Badge key={level} className={`${getTrophicColor(level)} border`}>
              {getTrophicLabel(level)}
            </Badge>
          ))}
        </div>

        {/* Instructions */}
        <div className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/50 flex items-center justify-center">
                <span className="text-blue-300 text-xs font-bold">i</span>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-slate-300 font-medium">How to build your food web:</p>
              <ol className="text-sm text-slate-400 space-y-1 ml-4 list-decimal">
                <li>Click an organism to start drawing</li>
                <li>Click another organism to create a connection (arrow shows energy flow)</li>
                <li>Remove wrong connections by clicking the × button</li>
                <li>Build the complete food web showing all feeding relationships</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Web Canvas */}
        <div className="relative w-full h-[500px] bg-gradient-to-b from-slate-900/50 to-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          {/* SVG for connection arrows */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
            <defs>
              <marker
                id="arrowhead-correct"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#10b981" />
              </marker>
              <marker
                id="arrowhead-incorrect"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
              </marker>
              <marker
                id="arrowhead-pending"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Draw student connections */}
            {studentConnections.map((conn, idx) => {
              const fromOrg = getOrganism(conn.fromId);
              const toOrg = getOrganism(conn.toId);
              if (!fromOrg || !toOrg) return null;

              const x1 = parseFloat(fromOrg.position.x);
              const y1 = parseFloat(fromOrg.position.y);
              const x2 = parseFloat(toOrg.position.x);
              const y2 = parseFloat(toOrg.position.y);

              const isCorrect = isCorrectConnection(conn.fromId, conn.toId);
              const strokeColor = hasSubmitted
                ? (isCorrect ? '#10b981' : '#ef4444')
                : '#94a3b8';
              const markerEnd = hasSubmitted
                ? (isCorrect ? 'url(#arrowhead-correct)' : 'url(#arrowhead-incorrect)')
                : 'url(#arrowhead-pending)';

              return (
                <g key={idx}>
                  <line
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={strokeColor}
                    strokeWidth="2"
                    markerEnd={markerEnd}
                  />
                </g>
              );
            })}
          </svg>

          {/* Organisms */}
          {data.organisms.map((organism) => {
            const isDisrupted = showDisruption &&
              data.disruptionChallenges?.[currentDisruption]?.removeOrganismId === organism.id;

            return (
              <button
                key={organism.id}
                onClick={() => handleOrganismClick(organism.id)}
                disabled={hasSubmitted || isDisrupted}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                  drawFrom === organism.id
                    ? 'scale-110 z-20 ring-2 ring-blue-500'
                    : 'hover:scale-105 z-10'
                } ${isDisrupted ? 'opacity-30 grayscale' : ''}`}
                style={{
                  left: organism.position.x,
                  top: organism.position.y,
                }}
              >
                <div className={`px-4 py-2 rounded-lg border-2 ${getTrophicColor(organism.trophicLevel)} backdrop-blur-sm`}>
                  <div className="text-center">
                    <div className="text-lg font-bold">{organism.name}</div>
                    <div className="text-xs opacity-75">{getTrophicLabel(organism.trophicLevel)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Connection List */}
        {studentConnections.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-300">Your Connections ({studentConnections.length})</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {studentConnections.map((conn, idx) => {
                const isCorrect = isCorrectConnection(conn.fromId, conn.toId);
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      hasSubmitted
                        ? isCorrect
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                        : 'bg-slate-800/30 border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {hasSubmitted && (
                        isCorrect ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )
                      )}
                      <span className="text-slate-300">
                        {getOrganism(conn.fromId)?.name} → {getOrganism(conn.toId)?.name}
                      </span>
                    </div>
                    {!hasSubmitted && (
                      <Button
                        onClick={() => handleRemoveConnection(conn.fromId, conn.toId)}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Evaluation Feedback */}
        {hasSubmitted && (
          <div className={`p-4 rounded-lg border ${
            evaluation.isComplete
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-orange-500/10 border-orange-500/30'
          }`}>
            <div className="flex items-start gap-3">
              {evaluation.isComplete ? (
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <p className={`font-medium ${
                  evaluation.isComplete ? 'text-green-300' : 'text-orange-300'
                }`}>
                  {evaluation.isComplete
                    ? '🎉 Perfect! You\'ve built a complete food web!'
                    : 'Almost there! Check your food web.'}
                </p>
                <div className="text-sm text-slate-300 space-y-1">
                  <p>Correct connections: {evaluation.correctAttempts.length} / {data.correctConnections.length}</p>
                  {evaluation.missingConnections.length > 0 && (
                    <p className="text-orange-300">Missing {evaluation.missingConnections.length} connection(s)</p>
                  )}
                  {evaluation.extraConnections.length > 0 && (
                    <p className="text-red-300">{evaluation.extraConnections.length} incorrect connection(s)</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Disruption Section */}
        {data.disruptionChallenges && data.disruptionChallenges.length > 0 && evaluation.isComplete && (
          <div className="space-y-4 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-slate-200">Ecosystem Disruption</h4>
              <Button
                onClick={() => setShowDisruption(!showDisruption)}
                variant="ghost"
                className="bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 text-orange-300"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                {showDisruption ? 'Hide Disruption' : 'Test Disruption'}
              </Button>
            </div>

            {showDisruption && data.disruptionChallenges[currentDisruption] && (
              <div className="space-y-4 p-4 bg-orange-500/5 border border-orange-500/30 rounded-lg">
                <div className="space-y-2">
                  <p className="text-orange-300 font-medium">
                    What if we remove: {getOrganism(data.disruptionChallenges[currentDisruption].removeOrganismId)?.name}?
                  </p>
                  <p className="text-slate-300 text-sm">
                    {data.disruptionChallenges[currentDisruption].question}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-300">Expected Effects:</p>
                  <ul className="space-y-1 text-sm text-slate-400 ml-4 list-disc">
                    {data.disruptionChallenges[currentDisruption].expectedEffects.map((effect, idx) => (
                      <li key={idx}>{effect}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                  <p className="text-xs text-slate-400 italic">
                    💡 {data.disruptionChallenges[currentDisruption].explanation}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={hasSubmitted || studentConnections.length === 0}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
          >
            <Link2 className="w-4 h-4 mr-2" />
            {hasSubmitted ? 'Submitted' : 'Check Food Web'}
          </Button>
          {hasSubmitted && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          <div className="ml-auto text-sm text-slate-400 self-center">
            {studentConnections.length} / {data.correctConnections.length} connections
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FoodWebBuilder;
