'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { InheritanceLabMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Interface (Single source of truth)
// ============================================================================

export interface AlleleInfo {
  symbol: string;
  phenotype: string;
}

export interface TraitInfo {
  name: string;
  gene: string;
  dominantAllele: AlleleInfo;
  recessiveAllele: AlleleInfo;
  inheritancePattern: 'complete-dominance' | 'incomplete-dominance' | 'codominance' | 'x-linked';
}

export interface ParentInfo {
  genotype: string;
  phenotype: string;
  label: string;
}

export interface PunnettCell {
  row: number;
  col: number;
  genotype: string;
  phenotype: string;
}

export interface ExpectedRatios {
  genotypic: Record<string, string>;
  phenotypic: Record<string, string>;
}

export interface InheritanceLabData {
  title?: string;
  description?: string;
  trait: TraitInfo;
  parentA: ParentInfo;
  parentB: ParentInfo;
  punnettSquare: {
    rows: number;
    columns: number;
    cells: PunnettCell[];
  };
  expectedRatios: ExpectedRatios;
  simulationPopulation: number;
  realWorldExample: string;
  crossType: 'monohybrid' | 'dihybrid' | 'x-linked';
  gradeBand: '6-7' | '8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getGametes(genotype: string): string[] {
  // For monohybrid: "Bb" -> ["B", "b"]
  // For dihybrid: "BbRr" -> ["BR", "Br", "bR", "br"]
  if (genotype.length === 2) {
    return [genotype[0], genotype[1]];
  }
  if (genotype.length === 4) {
    const a1 = genotype[0], a2 = genotype[1];
    const b1 = genotype[2], b2 = genotype[3];
    return [`${a1}${b1}`, `${a1}${b2}`, `${a2}${b1}`, `${a2}${b2}`];
  }
  return [genotype];
}

function getPhenotypeColor(phenotype: string): string {
  const colors: Record<string, string> = {
    'purple': 'bg-purple-500/30 text-purple-300 border-purple-500/40',
    'white': 'bg-white/10 text-slate-200 border-white/30',
    'red': 'bg-red-500/30 text-red-300 border-red-500/40',
    'pink': 'bg-pink-500/30 text-pink-300 border-pink-500/40',
    'yellow': 'bg-yellow-500/30 text-yellow-300 border-yellow-500/40',
    'green': 'bg-green-500/30 text-green-300 border-green-500/40',
    'tall': 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40',
    'short': 'bg-amber-500/30 text-amber-300 border-amber-500/40',
    'round': 'bg-blue-500/30 text-blue-300 border-blue-500/40',
    'wrinkled': 'bg-orange-500/30 text-orange-300 border-orange-500/40',
  };
  const lower = phenotype.toLowerCase();
  for (const [key, value] of Object.entries(colors)) {
    if (lower.includes(key)) return value;
  }
  return 'bg-slate-500/30 text-slate-300 border-slate-500/40';
}

// ============================================================================
// Sub-Components
// ============================================================================

interface PunnettGridProps {
  data: InheritanceLabData;
  studentAnswers: Record<string, string>;
  onCellChange: (key: string, value: string) => void;
  showResults: boolean;
  cellResults: Record<string, boolean>;
}

const PunnettGrid: React.FC<PunnettGridProps> = ({
  data,
  studentAnswers,
  onCellChange,
  showResults,
  cellResults,
}) => {
  const parentAGametes = getGametes(data.parentA.genotype);
  const parentBGametes = getGametes(data.parentB.genotype);

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse mx-auto">
        <thead>
          <tr>
            <th className="p-2 border border-white/10 bg-slate-800/50 text-slate-400 text-xs font-medium">
              Gametes
            </th>
            {parentBGametes.map((gamete, col) => (
              <th
                key={`header-${col}`}
                className="p-3 border border-white/10 bg-blue-500/10 text-blue-300 font-bold text-lg min-w-[80px]"
              >
                {gamete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {parentAGametes.map((gamete, row) => (
            <tr key={`row-${row}`}>
              <td className="p-3 border border-white/10 bg-pink-500/10 text-pink-300 font-bold text-lg min-w-[60px]">
                {gamete}
              </td>
              {parentBGametes.map((_, col) => {
                const key = `${row}-${col}`;
                const isCorrect = cellResults[key];
                const correctCell = data.punnettSquare.cells.find(
                  (c) => c.row === row && c.col === col
                );

                let cellBg = 'bg-slate-800/30';
                if (showResults) {
                  cellBg = isCorrect
                    ? 'bg-green-500/15 border-green-500/40'
                    : 'bg-red-500/15 border-red-500/40';
                }

                return (
                  <td
                    key={key}
                    className={`p-2 border border-white/10 ${cellBg} transition-colors`}
                  >
                    <input
                      type="text"
                      value={studentAnswers[key] || ''}
                      onChange={(e) => onCellChange(key, e.target.value)}
                      disabled={showResults}
                      placeholder="?"
                      className="w-full bg-transparent text-center text-white font-mono text-lg
                        placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500/50
                        rounded px-1 py-1 disabled:cursor-default"
                      maxLength={data.crossType === 'dihybrid' ? 4 : 2}
                    />
                    {showResults && correctCell && !isCorrect && (
                      <div className="text-xs text-green-400/80 mt-1 text-center">
                        {correctCell.genotype}
                      </div>
                    )}
                    {showResults && correctCell && (
                      <div className={`text-xs mt-1 text-center ${getPhenotypeColor(correctCell.phenotype)} rounded px-1`}>
                        {correctCell.phenotype}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface SimulationResultsProps {
  data: InheritanceLabData;
  simulationResults: Record<string, number>;
}

const SimulationResults: React.FC<SimulationResultsProps> = ({ data, simulationResults }) => {
  const total = Object.values(simulationResults).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400 mb-2">
        Population: {total} offspring simulated
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(data.expectedRatios.phenotypic).map(([phenotype, expectedRatio]) => {
          const count = simulationResults[phenotype] || 0;
          const observed = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
          const phenoColor = getPhenotypeColor(phenotype);

          return (
            <div
              key={phenotype}
              className={`p-3 rounded-lg border ${phenoColor}`}
            >
              <div className="font-semibold text-sm">{phenotype}</div>
              <div className="flex justify-between items-end mt-2">
                <div>
                  <div className="text-xs text-slate-400">Expected</div>
                  <div className="text-lg font-bold">{expectedRatio}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Observed</div>
                  <div className="text-lg font-bold">{count} ({observed}%)</div>
                </div>
              </div>
              {/* Bar visualization */}
              <div className="mt-2 h-2 bg-black/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current rounded-full opacity-50 transition-all duration-500"
                  style={{ width: `${observed}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface InheritanceLabProps {
  data: InheritanceLabData;
  className?: string;
}

const InheritanceLab: React.FC<InheritanceLabProps> = ({ data, className }) => {
  // State
  const [studentAnswers, setStudentAnswers] = useState<Record<string, string>>({});
  const [showPunnettResults, setShowPunnettResults] = useState(false);
  const [simulationResults, setSimulationResults] = useState<Record<string, number> | null>(null);
  const [activeTab, setActiveTab] = useState('punnett');

  // Evaluation
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<InheritanceLabMetrics>({
    primitiveType: 'inheritance-lab',
    instanceId: instanceId || `inheritance-lab-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Normalize genotype for comparison (sort alleles: "bB" -> "Bb")
  const normalizeGenotype = useCallback((genotype: string): string => {
    if (!genotype) return '';
    const g = genotype.trim();
    if (g.length === 2) {
      // Single gene: uppercase first
      const chars = g.split('');
      chars.sort((a, b) => {
        if (a.toUpperCase() === b.toUpperCase()) {
          return a === a.toUpperCase() ? -1 : 1;
        }
        return a.localeCompare(b);
      });
      return chars.join('');
    }
    if (g.length === 4) {
      // Dihybrid: normalize each pair
      const pair1 = [g[0], g[1]].sort((a, b) => {
        if (a.toUpperCase() === b.toUpperCase()) return a === a.toUpperCase() ? -1 : 1;
        return a.localeCompare(b);
      }).join('');
      const pair2 = [g[2], g[3]].sort((a, b) => {
        if (a.toUpperCase() === b.toUpperCase()) return a === a.toUpperCase() ? -1 : 1;
        return a.localeCompare(b);
      }).join('');
      return pair1 + pair2;
    }
    return g;
  }, []);

  // Check Punnett square answers
  const cellResults = useMemo(() => {
    const results: Record<string, boolean> = {};
    for (const cell of data.punnettSquare.cells) {
      const key = `${cell.row}-${cell.col}`;
      const studentAnswer = studentAnswers[key] || '';
      results[key] =
        normalizeGenotype(studentAnswer) === normalizeGenotype(cell.genotype);
    }
    return results;
  }, [studentAnswers, data.punnettSquare.cells, normalizeGenotype]);

  const totalCells = data.punnettSquare.cells.length;
  const correctCells = Object.values(cellResults).filter(Boolean).length;
  const allCorrect = correctCells === totalCells;

  // Handle cell input
  const handleCellChange = (key: string, value: string) => {
    setStudentAnswers((prev) => ({ ...prev, [key]: value }));
  };

  // Check answers
  const handleCheckAnswers = () => {
    setShowPunnettResults(true);

    if (!hasSubmitted) {
      const score = Math.round((correctCells / totalCells) * 100);

      const punnettSquareFilled = data.punnettSquare.cells.map((cell) => {
        const key = `${cell.row}-${cell.col}`;
        return {
          row: cell.row,
          col: cell.col,
          studentGenotype: studentAnswers[key] || '',
          correctGenotype: cell.genotype,
          isCorrect: cellResults[key],
        };
      });

      const metrics: InheritanceLabMetrics = {
        type: 'inheritance-lab',
        crossType: data.crossType,
        inheritancePattern: data.trait.inheritancePattern,
        gradeBand: data.gradeBand,
        totalCells,
        correctCells,
        allCellsCorrect: allCorrect,
        punnettSquareAccuracy: score,
        punnettSquareFilled,
        simulationRun: simulationResults !== null,
        simulationPopulation: data.simulationPopulation,
      };

      submitResult(allCorrect, score, metrics, {
        studentWork: { studentAnswers },
      });
    }
  };

  // Run simulation
  const handleRunSimulation = () => {
    const results: Record<string, number> = {};
    const phenotypes = Object.keys(data.expectedRatios.phenotypic);
    phenotypes.forEach((p) => (results[p] = 0));

    // Simulate by randomly combining gametes
    const parentAGametes = getGametes(data.parentA.genotype);
    const parentBGametes = getGametes(data.parentB.genotype);

    for (let i = 0; i < data.simulationPopulation; i++) {
      const gA = parentAGametes[Math.floor(Math.random() * parentAGametes.length)];
      const gB = parentBGametes[Math.floor(Math.random() * parentBGametes.length)];
      const offspring = gA + gB;

      // Find matching cell to determine phenotype
      const matchingCell = data.punnettSquare.cells.find(
        (c) => normalizeGenotype(c.genotype) === normalizeGenotype(offspring)
      );

      if (matchingCell) {
        if (results[matchingCell.phenotype] !== undefined) {
          results[matchingCell.phenotype]++;
        }
      }
    }

    setSimulationResults(results);
    setActiveTab('simulation');
  };

  // Reset
  const handleReset = () => {
    setStudentAnswers({});
    setShowPunnettResults(false);
    setSimulationResults(null);
    setActiveTab('punnett');
    resetAttempt();
  };

  const title = data.title || `Genetics Inheritance Lab: ${data.trait.name}`;
  const description =
    data.description ||
    `Predict offspring genotypes and phenotypes for ${data.trait.name} using a Punnett square.`;

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">🧬</span>
              {title}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {description}
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-emerald-800/50 border-emerald-700/50 text-emerald-300">
              {data.crossType === 'monohybrid'
                ? 'Monohybrid Cross'
                : data.crossType === 'dihybrid'
                  ? 'Dihybrid Cross'
                  : 'X-linked Cross'}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
              Grade {data.gradeBand}
            </Badge>
            <Badge className="bg-purple-800/50 border-purple-700/50 text-purple-300">
              {data.trait.inheritancePattern.replace('-', ' ')}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Trait Information */}
        <div className="p-4 rounded-lg bg-black/20 border border-white/5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Trait: {data.trait.name}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase">Dominant Allele</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-green-400">
                  {data.trait.dominantAllele.symbol}
                </span>
                <Badge className={getPhenotypeColor(data.trait.dominantAllele.phenotype)}>
                  {data.trait.dominantAllele.phenotype}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase">Recessive Allele</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-amber-400">
                  {data.trait.recessiveAllele.symbol}
                </span>
                <Badge className={getPhenotypeColor(data.trait.recessiveAllele.phenotype)}>
                  {data.trait.recessiveAllele.phenotype}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Parents */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-pink-500/5 border border-pink-500/20">
            <div className="text-xs text-pink-400 uppercase mb-1">{data.parentA.label}</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-white">
                {data.parentA.genotype}
              </span>
              <Badge className={getPhenotypeColor(data.parentA.phenotype)}>
                {data.parentA.phenotype}
              </Badge>
            </div>
          </div>
          <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <div className="text-xs text-blue-400 uppercase mb-1">{data.parentB.label}</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-white">
                {data.parentB.genotype}
              </span>
              <Badge className={getPhenotypeColor(data.parentB.phenotype)}>
                {data.parentB.phenotype}
              </Badge>
            </div>
          </div>
        </div>

        {/* Tabs: Punnett Square | Simulation */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-white/10">
            <TabsTrigger
              value="punnett"
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-400"
            >
              Punnett Square
            </TabsTrigger>
            <TabsTrigger
              value="simulation"
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-400"
              disabled={!showPunnettResults}
            >
              Simulation
            </TabsTrigger>
            <TabsTrigger
              value="ratios"
              className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-400"
              disabled={!showPunnettResults}
            >
              Expected Ratios
            </TabsTrigger>
          </TabsList>

          {/* Punnett Square Tab */}
          <TabsContent value="punnett" className="space-y-4 mt-4">
            <div className="text-sm text-slate-400 mb-2">
              Fill in each cell with the offspring genotype by combining the parent gametes.
            </div>
            <PunnettGrid
              data={data}
              studentAnswers={studentAnswers}
              onCellChange={handleCellChange}
              showResults={showPunnettResults}
              cellResults={cellResults}
            />

            {showPunnettResults && (
              <div className={`p-3 rounded-lg border text-sm ${
                allCorrect
                  ? 'bg-green-500/10 border-green-500/30 text-green-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                {allCorrect
                  ? `Perfect! All ${totalCells} cells correct. You've mastered this Punnett square!`
                  : `${correctCells} of ${totalCells} cells correct. Review the corrections shown below each cell.`}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {!showPunnettResults && (
                <Button
                  onClick={handleCheckAnswers}
                  variant="ghost"
                  className="bg-green-600/20 border border-green-500/30 hover:bg-green-600/30 text-green-300"
                  disabled={Object.keys(studentAnswers).length === 0}
                >
                  Check Answers
                </Button>
              )}
              {showPunnettResults && (
                <>
                  <Button
                    onClick={handleRunSimulation}
                    variant="ghost"
                    className="bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300"
                  >
                    Run Simulation ({data.simulationPopulation} offspring)
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                  >
                    Try Again
                  </Button>
                </>
              )}
            </div>
          </TabsContent>

          {/* Simulation Tab */}
          <TabsContent value="simulation" className="mt-4">
            {simulationResults ? (
              <SimulationResults data={data} simulationResults={simulationResults} />
            ) : (
              <div className="text-center py-8 text-slate-500">
                Complete the Punnett square first, then run the simulation to see how predicted
                ratios compare to actual offspring.
              </div>
            )}
            {simulationResults && (
              <div className="mt-4">
                <Button
                  onClick={handleRunSimulation}
                  variant="ghost"
                  className="bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300"
                >
                  Re-run Simulation
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Expected Ratios Tab */}
          <TabsContent value="ratios" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-black/20 border border-white/5">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
                  Genotypic Ratios
                </h4>
                <div className="space-y-2">
                  {Object.entries(data.expectedRatios.genotypic).map(([genotype, ratio]) => (
                    <div
                      key={genotype}
                      className="flex justify-between items-center p-2 rounded bg-slate-800/30"
                    >
                      <span className="font-mono text-white font-bold">{genotype}</span>
                      <span className="text-slate-400">{ratio}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-lg bg-black/20 border border-white/5">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
                  Phenotypic Ratios
                </h4>
                <div className="space-y-2">
                  {Object.entries(data.expectedRatios.phenotypic).map(([phenotype, ratio]) => (
                    <div
                      key={phenotype}
                      className="flex justify-between items-center p-2 rounded"
                    >
                      <Badge className={getPhenotypeColor(phenotype)}>{phenotype}</Badge>
                      <span className="text-slate-400">{ratio}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Real World Example */}
        {data.realWorldExample && (
          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <div className="text-xs text-emerald-400 uppercase mb-1 font-semibold">
              Real-World Connection
            </div>
            <p className="text-sm text-slate-300">{data.realWorldExample}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InheritanceLab;
