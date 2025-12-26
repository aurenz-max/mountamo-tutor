'use client';

import React, { useState } from 'react';
import FractionBar, { FractionBarData } from '../primitives/visual-primitives/math/FractionBar';
import PlaceValueChart, { PlaceValueChartData } from '../primitives/visual-primitives/math/PlaceValueChart';
import AreaModel, { AreaModelData } from '../primitives/visual-primitives/math/AreaModel';
import ArrayGrid, { ArrayGridData } from '../primitives/visual-primitives/math/ArrayGrid';

interface MathPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'fraction-bar' | 'place-value-chart' | 'area-model' | 'array-grid';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

export const MathPrimitivesTester: React.FC<MathPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('fraction-bar');

  // AI Generation State
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fraction Bar State
  const [fractionBarData, setFractionBarData] = useState<FractionBarData>({
    title: 'Understanding Fractions',
    description: 'Click on partitions to shade or unshade parts of the fraction bar',
    partitions: 4,
    shaded: 1,
    barCount: 2,
    showLabels: true,
    allowPartitionEdit: true,
    showEquivalentLines: true,
  });

  // Place Value Chart State
  const [placeValueData, setPlaceValueData] = useState<PlaceValueChartData>({
    title: 'Place Value Chart',
    description: 'Enter digits to see their place values',
    minPlace: -2,
    maxPlace: 4,
    initialValue: 1234.56,
    showExpandedForm: true,
    showMultipliers: true,
    editableDigits: true,
  });

  // Area Model State
  const [areaModelData, setAreaModelData] = useState<AreaModelData>({
    title: 'Multiplying with Area Model',
    description: 'Visualize multiplication using the area model strategy',
    factor1Parts: [20, 3],
    factor2Parts: [10, 5],
    showPartialProducts: true,
    showDimensions: true,
    algebraicMode: false,
    highlightCell: null,
    showAnimation: false,
  });

  // Array Grid State
  const [arrayGridData, setArrayGridData] = useState<ArrayGridData>({
    title: 'Understanding Multiplication Arrays',
    description: 'Click on rows, columns, or cells to explore how arrays represent multiplication',
    rows: 3,
    columns: 4,
    iconType: 'dot',
    showRowLabels: true,
    showColumnLabels: true,
    partitionLines: [],
    highlightMode: 'cell',
    animateSkipCounting: true,
  });

  const primitiveOptions: Array<{ value: PrimitiveType; label: string; icon: string }> = [
    { value: 'fraction-bar', label: 'Fraction Bar', icon: '📊' },
    { value: 'place-value-chart', label: 'Place Value Chart', icon: '🔢' },
    { value: 'area-model', label: 'Area Model', icon: '📐' },
    { value: 'array-grid', label: 'Array / Grid', icon: '⊞' },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const action = selectedPrimitive === 'fraction-bar'
        ? 'generateFractionBar'
        : selectedPrimitive === 'place-value-chart'
        ? 'generatePlaceValueChart'
        : selectedPrimitive === 'area-model'
        ? 'generateAreaModel'
        : 'generateArrayGrid';

      // Let the service choose the topic and specification based on the primitive type
      const defaultTopic = selectedPrimitive === 'fraction-bar'
        ? 'Understanding fractions'
        : selectedPrimitive === 'place-value-chart'
        ? 'Place value and decimal numbers'
        : selectedPrimitive === 'area-model'
        ? 'Multi-digit multiplication'
        : 'Introduction to multiplication';

      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          params: {
            topic: defaultTopic,
            gradeLevel,
            config: {}, // Let Gemini choose all specifications
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const generatedData = await response.json();

      if (selectedPrimitive === 'fraction-bar') {
        setFractionBarData(generatedData);
      } else if (selectedPrimitive === 'place-value-chart') {
        setPlaceValueData(generatedData);
      } else if (selectedPrimitive === 'area-model') {
        setAreaModelData(generatedData);
      } else if (selectedPrimitive === 'array-grid') {
        setArrayGridData(generatedData);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetToDefaults = () => {
    if (selectedPrimitive === 'fraction-bar') {
      setFractionBarData({
        title: 'Understanding Fractions',
        description: 'Click on partitions to shade or unshade parts of the fraction bar',
        partitions: 4,
        shaded: 1,
        barCount: 2,
        showLabels: true,
        allowPartitionEdit: true,
        showEquivalentLines: true,
      });
    } else if (selectedPrimitive === 'place-value-chart') {
      setPlaceValueData({
        title: 'Place Value Chart',
        description: 'Enter digits to see their place values',
        minPlace: -2,
        maxPlace: 4,
        initialValue: 1234.56,
        showExpandedForm: true,
        showMultipliers: true,
        editableDigits: true,
      });
    } else if (selectedPrimitive === 'area-model') {
      setAreaModelData({
        title: 'Multiplying with Area Model',
        description: 'Visualize multiplication using the area model strategy',
        factor1Parts: [20, 3],
        factor2Parts: [10, 5],
        showPartialProducts: true,
        showDimensions: true,
        algebraicMode: false,
        highlightCell: null,
        showAnimation: false,
      });
    } else if (selectedPrimitive === 'array-grid') {
      setArrayGridData({
        title: 'Understanding Multiplication Arrays',
        description: 'Click on rows, columns, or cells to explore how arrays represent multiplication',
        rows: 3,
        columns: 4,
        iconType: 'dot',
        showRowLabels: true,
        showColumnLabels: true,
        partitionLines: [],
        highlightMode: 'cell',
        animateSkipCounting: true,
      });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Home
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Math Primitives Tester</h2>
        <p className="text-slate-400">Test and configure visual math components</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Configuration</h3>

          {/* AI Generator Section */}
          <div className="mb-6 p-4 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-xl border border-purple-500/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">✨</span>
              </div>
              <h4 className="text-lg font-bold text-white">AI Generator</h4>
            </div>

            <p className="text-sm text-slate-400 mb-3">
              Generate a {selectedPrimitive === 'fraction-bar' ? 'fraction bar' : selectedPrimitive === 'place-value-chart' ? 'place value chart' : 'area model'} with AI-chosen specifications appropriate for the selected grade level.
            </p>

            {/* Grade Level */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="toddler">Toddler</option>
                <option value="preschool">Preschool</option>
                <option value="kindergarten">Kindergarten</option>
                <option value="elementary">Elementary</option>
                <option value="middle-school">Middle School</option>
                <option value="high-school">High School</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate</option>
                <option value="phd">PhD</option>
              </select>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Generate with AI
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-slate-600"></div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Manual Controls</span>
            <div className="h-px flex-1 bg-slate-600"></div>
          </div>

          {/* Primitive Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Primitive</label>
            <div className="grid grid-cols-2 gap-3">
              {primitiveOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedPrimitive(option.value)}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    selectedPrimitive === option.value
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="text-2xl mb-2">{option.icon}</div>
                  <div className="text-sm font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fraction Bar Controls */}
          {selectedPrimitive === 'fraction-bar' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={fractionBarData.title}
                  onChange={(e) => setFractionBarData({ ...fractionBarData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={fractionBarData.description}
                  onChange={(e) => setFractionBarData({ ...fractionBarData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Partitions</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={fractionBarData.partitions}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, partitions: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Shaded</label>
                  <input
                    type="number"
                    min="0"
                    max={fractionBarData.partitions}
                    value={fractionBarData.shaded}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, shaded: Math.min(parseInt(e.target.value) || 0, fractionBarData.partitions) })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bar Count</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={fractionBarData.barCount}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, barCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fractionBarData.showLabels}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, showLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">Show Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fractionBarData.allowPartitionEdit}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, allowPartitionEdit: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">Allow Partition Edit</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fractionBarData.showEquivalentLines}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, showEquivalentLines: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">Show Equivalent Lines</span>
                </label>
              </div>
            </div>
          )}

          {/* Area Model Controls */}
          {selectedPrimitive === 'area-model' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={areaModelData.title}
                  onChange={(e) => setAreaModelData({ ...areaModelData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={areaModelData.description}
                  onChange={(e) => setAreaModelData({ ...areaModelData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Factor 1 Parts (comma-separated)</label>
                <input
                  type="text"
                  value={areaModelData.factor1Parts.join(', ')}
                  onChange={(e) => {
                    const parts = e.target.value.split(',').map(s => parseInt(s.trim()) || 0).filter(n => n > 0);
                    if (parts.length > 0) setAreaModelData({ ...areaModelData, factor1Parts: parts });
                  }}
                  placeholder="e.g., 20, 3"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Factor 2 Parts (comma-separated)</label>
                <input
                  type="text"
                  value={areaModelData.factor2Parts.join(', ')}
                  onChange={(e) => {
                    const parts = e.target.value.split(',').map(s => parseInt(s.trim()) || 0).filter(n => n > 0);
                    if (parts.length > 0) setAreaModelData({ ...areaModelData, factor2Parts: parts });
                  }}
                  placeholder="e.g., 10, 5"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.showPartialProducts}
                    onChange={(e) => setAreaModelData({ ...areaModelData, showPartialProducts: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Partial Products</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.showDimensions}
                    onChange={(e) => setAreaModelData({ ...areaModelData, showDimensions: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Dimensions</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.algebraicMode || false}
                    onChange={(e) => setAreaModelData({ ...areaModelData, algebraicMode: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Algebraic Mode</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.showAnimation || false}
                    onChange={(e) => setAreaModelData({ ...areaModelData, showAnimation: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Animation</span>
                </label>
              </div>

              {areaModelData.algebraicMode && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-300 mb-2">Algebraic Mode Enabled</p>
                  <p className="text-xs text-slate-400">
                    In algebraic mode, you can add custom labels through the AI generator or manually configure labels in the component data.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Array Grid Controls */}
          {selectedPrimitive === 'array-grid' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={arrayGridData.title}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={arrayGridData.description}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Rows</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={arrayGridData.rows}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, rows: parseInt(e.target.value) || 2 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Columns</label>
                  <input
                    type="number"
                    min="2"
                    max="12"
                    value={arrayGridData.columns}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, columns: parseInt(e.target.value) || 2 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Icon Type</label>
                <select
                  value={arrayGridData.iconType}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, iconType: e.target.value as 'dot' | 'square' | 'star' | 'custom' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                >
                  <option value="dot">Dot</option>
                  <option value="square">Square</option>
                  <option value="star">Star</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Highlight Mode</label>
                <select
                  value={arrayGridData.highlightMode}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, highlightMode: e.target.value as 'row' | 'column' | 'cell' | 'region' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                >
                  <option value="cell">Cell</option>
                  <option value="row">Row</option>
                  <option value="column">Column</option>
                  <option value="region">Region</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={arrayGridData.showRowLabels}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, showRowLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-300">Show Row Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={arrayGridData.showColumnLabels}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, showColumnLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-300">Show Column Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={arrayGridData.animateSkipCounting}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, animateSkipCounting: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-300">Animate Skip Counting</span>
                </label>
              </div>
            </div>
          )}

          {/* Place Value Chart Controls */}
          {selectedPrimitive === 'place-value-chart' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={placeValueData.title}
                  onChange={(e) => setPlaceValueData({ ...placeValueData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={placeValueData.description}
                  onChange={(e) => setPlaceValueData({ ...placeValueData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Min Place</label>
                  <input
                    type="number"
                    min="-3"
                    max="0"
                    value={placeValueData.minPlace}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, minPlace: parseInt(e.target.value) || -2 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Max Place</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={placeValueData.maxPlace}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, maxPlace: parseInt(e.target.value) || 3 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Initial Value</label>
                  <input
                    type="number"
                    value={placeValueData.initialValue}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, initialValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={placeValueData.showExpandedForm}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, showExpandedForm: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Show Expanded Form</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={placeValueData.showMultipliers}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, showMultipliers: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Show Multipliers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={placeValueData.editableDigits}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, editableDigits: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Editable Digits</span>
                </label>
              </div>
            </div>
          )}

          {/* Reset Button */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <button
              onClick={resetToDefaults}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Quick Presets */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Quick Presets</p>
            {selectedPrimitive === 'fraction-bar' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 2, shaded: 1 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  1/2
                </button>
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 4, shaded: 3 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3/4
                </button>
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 8, shaded: 5 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  5/8
                </button>
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 10, shaded: 7 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  7/10
                </button>
              </div>
            )}
            {selectedPrimitive === 'place-value-chart' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPlaceValueData({ ...placeValueData, initialValue: 123 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  123
                </button>
                <button
                  onClick={() => setPlaceValueData({ ...placeValueData, initialValue: 45.67 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  45.67
                </button>
                <button
                  onClick={() => setPlaceValueData({ ...placeValueData, initialValue: 9876.54 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  9876.54
                </button>
              </div>
            )}
            {selectedPrimitive === 'area-model' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [3], factor2Parts: [4] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3 × 4
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [10, 2], factor2Parts: [10, 3] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  12 × 13
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [20, 3], factor2Parts: [10, 5] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  23 × 15
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [30, 4], factor2Parts: [20, 7] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  34 × 27
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [100, 20, 5], factor2Parts: [10, 2] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  125 × 12
                </button>
              </div>
            )}
            {selectedPrimitive === 'array-grid' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 2, columns: 3 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  2 × 3
                </button>
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 3, columns: 4 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3 × 4
                </button>
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 4, columns: 5 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  4 × 5
                </button>
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 5, columns: 6 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  5 × 6
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">Live Preview</h3>
          <div className="overflow-y-auto">
            {selectedPrimitive === 'fraction-bar' && <FractionBar data={fractionBarData} />}
            {selectedPrimitive === 'place-value-chart' && <PlaceValueChart data={placeValueData} />}
            {selectedPrimitive === 'area-model' && <AreaModel data={areaModelData} />}
            {selectedPrimitive === 'array-grid' && <ArrayGrid data={arrayGridData} />}
          </div>
        </div>
      </div>

      {/* Info Panel with Instructions */}
      <div className="mt-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Usage Guide */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <h4 className="text-blue-300 font-semibold mb-3">How to Use This Tester</h4>
              <div className="text-slate-300 text-sm space-y-2">
                <div>
                  <p className="font-semibold text-white mb-1">AI Generation</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                    <li>Select a primitive type (Fraction Bar or Place Value Chart)</li>
                    <li>Choose a grade level to ensure age-appropriate content</li>
                    <li>Click "Generate with AI" to create a primitive with AI-chosen specifications</li>
                    <li>The AI will automatically set all properties based on educational best practices</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Manual Configuration</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                    <li>Use the controls below the AI generator to manually adjust properties</li>
                    <li>Changes are reflected in real-time in the live preview</li>
                    <li>Use quick presets for common configurations</li>
                    <li>Reset to defaults to start fresh</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Guide */}
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <div className="flex-1">
              <h4 className="text-green-300 font-semibold mb-3">How to Add New Math Primitives to This Tester</h4>
              <div className="text-slate-300 text-sm space-y-3">
                <div>
                  <p className="font-semibold text-white mb-1">Step 1: Create Your Primitive Component</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Create a new file in <code className="text-green-400 bg-slate-800 px-1 rounded">my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/</code></li>
                    <li>Export an interface for the data (e.g., <code className="text-green-400 bg-slate-800 px-1 rounded">YourPrimitiveData</code>)</li>
                    <li>Export the component as default with props: <code className="text-green-400 bg-slate-800 px-1 rounded">{'{ data, className? }'}</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 2: Import into This Tester</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Import your component at the top: <code className="text-green-400 bg-slate-800 px-1 rounded">import YourPrimitive, {'{ YourPrimitiveData }'} from '../primitives/visual-primitives/math/YourPrimitive';</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 3: Add to Primitive Type Union</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Update: <code className="text-green-400 bg-slate-800 px-1 rounded">type PrimitiveType = 'fraction-bar' | 'place-value-chart' | 'your-primitive';</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 4: Add State Management</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Create state: <code className="text-green-400 bg-slate-800 px-1 rounded">const [yourPrimitiveData, setYourPrimitiveData] = useState&lt;YourPrimitiveData&gt;({'{...}'})</code></li>
                    <li>Add to <code className="text-green-400 bg-slate-800 px-1 rounded">primitiveOptions</code> array with value, label, and icon</li>
                    <li>Add reset case to <code className="text-green-400 bg-slate-800 px-1 rounded">resetToDefaults()</code> function</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 5: Add Controls and Preview</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Add conditional controls section: <code className="text-green-400 bg-slate-800 px-1 rounded">{'{ selectedPrimitive === "your-primitive" && <div>...</div> }'}</code></li>
                    <li>Add preview case: <code className="text-green-400 bg-slate-800 px-1 rounded">{'{ selectedPrimitive === "your-primitive" && <YourPrimitive data={yourPrimitiveData} /> }'}</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 6: Add Quick Presets (Optional)</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Add preset buttons in the "Quick Presets" section with common configurations</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 7: Create Gemini Service (for AI)</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Create a service file in <code className="text-green-400 bg-slate-800 px-1 rounded">service/math/gemini-your-primitive.ts</code></li>
                    <li>Define the schema and generation function (see existing files for reference)</li>
                    <li>Import and call in <code className="text-green-400 bg-slate-800 px-1 rounded">handleGenerate()</code> function</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
