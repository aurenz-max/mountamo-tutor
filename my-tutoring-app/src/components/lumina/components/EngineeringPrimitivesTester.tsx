'use client';

import React, { useState } from 'react';
import LeverLab, { LeverLabData } from '../primitives/visual-primitives/engineering/LeverLab';
import PulleySystemBuilder, { PulleySystemBuilderData } from '../primitives/visual-primitives/engineering/PulleySystemBuilder';
import RampLab, { RampLabData } from '../primitives/visual-primitives/engineering/RampLab';
import WheelAxleExplorer, { WheelAxleExplorerData } from '../primitives/visual-primitives/engineering/WheelAxleExplorer';

interface EngineeringPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'lever-lab' | 'pulley-system-builder' | 'ramp-lab' | 'wheel-axle-explorer';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

export const EngineeringPrimitivesTester: React.FC<EngineeringPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('lever-lab');

  // AI Generation State
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lever Lab State
  const [leverLabData, setLeverLabData] = useState<LeverLabData>({
    title: 'Seesaw Balance Challenge',
    description: 'Help balance the seesaw by moving loads and the fulcrum. When both sides have equal torque, the lever will balance!',
    beamLength: 10,
    fulcrumPosition: 5,
    fixedFulcrum: false,
    loads: [
      { position: 2, weight: 3, icon: '🧸', label: 'Teddy Bear', isDraggable: true, color: '#3B82F6' },
      { position: 8, weight: 3, icon: '🎁', label: 'Gift Box', isDraggable: true, color: '#10B981' },
    ],
    showDistances: true,
    showMA: false,
    effortInput: 'slider',
    theme: 'seesaw',
    effortPosition: 0,
    effortForce: 0,
    showTorque: false,
    allowAddLoads: true,
    maxLoads: 6,
  });

  // Pulley System Builder State
  const [pulleySystemData, setPulleySystemData] = useState<PulleySystemBuilderData>({
    title: 'Pulley Lift Challenge',
    description: 'Build a pulley system to lift the heavy load! Add pulleys and apply force to see how pulleys make lifting easier.',
    fixedPulleys: [{ id: 'fixed-1', x: 50, y: 15, type: 'fixed', radius: 25 }],
    movablePulleys: [],
    loadWeight: 10,
    ropeConfiguration: [],
    showForceLabels: true,
    showRopeSegments: true,
    maxPulleys: 4,
    theme: 'crane',
    allowAddPulleys: true,
    showMechanicalAdvantage: false,
    liftHeight: 0,
  });

  // Ramp Lab State
  const [rampLabData, setRampLabData] = useState<RampLabData>({
    title: 'Ramp Challenge',
    description: 'Explore how ramps make it easier to move heavy objects! Adjust the angle and push force to see how inclined planes work.',
    rampLength: 10,
    rampAngle: 30,
    adjustableAngle: true,
    loadWeight: 5,
    loadType: 'box',
    showMeasurements: true,
    frictionLevel: 'medium',
    theme: 'generic',
    showForceArrows: false,
    showMA: false,
    allowPush: true,
    pushForce: 0,
  });

  // Wheel & Axle Explorer State
  const [wheelAxleData, setWheelAxleData] = useState<WheelAxleExplorerData>({
    title: 'Wheel & Axle Discovery',
    description: 'Explore how wheels and axles multiply force! Turn the wheel and see how it moves the axle.',
    wheelDiameter: 8,
    axleDiameter: 2,
    adjustable: true,
    attachedLoad: 0,
    showRatio: true,
    showForce: false,
    rotationInput: 'drag',
    theme: 'winch',
    showMechanicalAdvantage: false,
    showRotationCount: true,
    targetRotations: 0,
  });

  const primitiveOptions: Array<{ value: PrimitiveType; label: string; icon: string; description: string }> = [
    {
      value: 'lever-lab',
      label: 'Lever Lab',
      icon: '⚖️',
      description: 'Interactive lever/fulcrum system for simple machines'
    },
    {
      value: 'pulley-system-builder',
      label: 'Pulley System Builder',
      icon: '🏗️',
      description: 'Interactive pulley system for mechanical advantage'
    },
    {
      value: 'ramp-lab',
      label: 'Ramp Lab',
      icon: '📐',
      description: 'Interactive inclined plane for force trade-offs'
    },
    {
      value: 'wheel-axle-explorer',
      label: 'Wheel & Axle Explorer',
      icon: '⚙️',
      description: 'Interactive wheel and axle for force multiplication'
    },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Map UI primitive names to componentIds for the registry
      const componentIdMap: Record<PrimitiveType, string> = {
        'lever-lab': 'lever-lab',
        'pulley-system-builder': 'pulley-system-builder',
        'ramp-lab': 'ramp-lab',
        'wheel-axle-explorer': 'wheel-axle-explorer',
      };

      const topicMap: Record<PrimitiveType, string> = {
        'lever-lab': 'Understanding levers and balance',
        'pulley-system-builder': 'Understanding pulleys and mechanical advantage',
        'ramp-lab': 'Understanding inclined planes and ramps',
        'wheel-axle-explorer': 'Understanding wheel and axle machines',
      };

      const componentId = componentIdMap[selectedPrimitive];
      const defaultTopic = topicMap[selectedPrimitive];

      // Use universal generateComponentContent endpoint (registry pattern)
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId,
            topic: defaultTopic,
            gradeLevel,
            config: {},
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      // The registry returns { type, instanceId, data } - extract the data
      const generatedData = result.data || result;

      if (selectedPrimitive === 'lever-lab') {
        setLeverLabData(generatedData);
      } else if (selectedPrimitive === 'pulley-system-builder') {
        setPulleySystemData(generatedData);
      } else if (selectedPrimitive === 'ramp-lab') {
        setRampLabData(generatedData);
      } else if (selectedPrimitive === 'wheel-axle-explorer') {
        setWheelAxleData(generatedData);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetToDefaults = () => {
    if (selectedPrimitive === 'lever-lab') {
      setLeverLabData({
        title: 'Seesaw Balance Challenge',
        description: 'Help balance the seesaw by moving loads and the fulcrum. When both sides have equal torque, the lever will balance!',
        beamLength: 10,
        fulcrumPosition: 5,
        fixedFulcrum: false,
        loads: [
          { position: 2, weight: 3, icon: '🧸', label: 'Teddy Bear', isDraggable: true, color: '#3B82F6' },
          { position: 8, weight: 3, icon: '🎁', label: 'Gift Box', isDraggable: true, color: '#10B981' },
        ],
        showDistances: true,
        showMA: false,
        effortInput: 'slider',
        theme: 'seesaw',
        effortPosition: 0,
        effortForce: 0,
        showTorque: false,
        allowAddLoads: true,
        maxLoads: 6,
      });
    } else if (selectedPrimitive === 'pulley-system-builder') {
      setPulleySystemData({
        title: 'Pulley Lift Challenge',
        description: 'Build a pulley system to lift the heavy load! Add pulleys and apply force to see how pulleys make lifting easier.',
        fixedPulleys: [{ id: 'fixed-1', x: 50, y: 15, type: 'fixed', radius: 25 }],
        movablePulleys: [],
        loadWeight: 10,
        ropeConfiguration: [],
        showForceLabels: true,
        showRopeSegments: true,
        maxPulleys: 4,
        theme: 'crane',
        allowAddPulleys: true,
        showMechanicalAdvantage: false,
        liftHeight: 0,
      });
    } else if (selectedPrimitive === 'ramp-lab') {
      setRampLabData({
        title: 'Ramp Challenge',
        description: 'Explore how ramps make it easier to move heavy objects! Adjust the angle and push force to see how inclined planes work.',
        rampLength: 10,
        rampAngle: 30,
        adjustableAngle: true,
        loadWeight: 5,
        loadType: 'box',
        showMeasurements: true,
        frictionLevel: 'medium',
        theme: 'generic',
        showForceArrows: false,
        showMA: false,
        allowPush: true,
        pushForce: 0,
      });
    } else if (selectedPrimitive === 'wheel-axle-explorer') {
      setWheelAxleData({
        title: 'Wheel & Axle Discovery',
        description: 'Explore how wheels and axles multiply force! Turn the wheel and see how it moves the axle.',
        wheelDiameter: 8,
        axleDiameter: 2,
        adjustable: true,
        attachedLoad: 0,
        showRatio: true,
        showForce: false,
        rotationInput: 'drag',
        theme: 'winch',
        showMechanicalAdvantage: false,
        showRotationCount: true,
        targetRotations: 0,
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
        <h2 className="text-4xl font-bold text-white mb-2">Engineering Primitives Tester</h2>
        <p className="text-slate-400">Test and configure K-5 engineering visual components</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Configuration</h3>

          {/* AI Generator Section */}
          <div className="mb-6 p-4 bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-xl border border-orange-500/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">✨</span>
              </div>
              <h4 className="text-lg font-bold text-white">AI Generator</h4>
            </div>

            <p className="text-sm text-slate-400 mb-3">
              Generate a lever lab with AI-chosen specifications appropriate for the selected grade level.
            </p>

            {/* Grade Level */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
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
              className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
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
            <div className="grid grid-cols-1 gap-3">
              {primitiveOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedPrimitive(option.value)}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    selectedPrimitive === option.value
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{option.icon}</div>
                    <div>
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs text-slate-500">{option.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Lever Lab Controls */}
          {selectedPrimitive === 'lever-lab' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={leverLabData.title}
                  onChange={(e) => setLeverLabData({ ...leverLabData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={leverLabData.description}
                  onChange={(e) => setLeverLabData({ ...leverLabData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Beam Length</label>
                  <input
                    type="number"
                    min="5"
                    max="20"
                    value={leverLabData.beamLength}
                    onChange={(e) => setLeverLabData({ ...leverLabData, beamLength: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Fulcrum Position</label>
                  <input
                    type="number"
                    min="1"
                    max={leverLabData.beamLength - 1}
                    step="0.5"
                    value={leverLabData.fulcrumPosition}
                    onChange={(e) => setLeverLabData({ ...leverLabData, fulcrumPosition: parseFloat(e.target.value) || 5 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                <select
                  value={leverLabData.theme}
                  onChange={(e) => setLeverLabData({ ...leverLabData, theme: e.target.value as 'seesaw' | 'excavator' | 'crowbar' | 'generic' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                >
                  <option value="seesaw">Seesaw (K-2)</option>
                  <option value="excavator">Excavator (3-5)</option>
                  <option value="crowbar">Crowbar (3-5)</option>
                  <option value="generic">Generic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Effort Input Method</label>
                <select
                  value={leverLabData.effortInput}
                  onChange={(e) => setLeverLabData({ ...leverLabData, effortInput: e.target.value as 'drag' | 'slider' | 'numeric' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-orange-500 focus:outline-none"
                >
                  <option value="slider">Slider</option>
                  <option value="numeric">Numeric Input</option>
                  <option value="drag">Drag</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leverLabData.fixedFulcrum}
                    onChange={(e) => setLeverLabData({ ...leverLabData, fixedFulcrum: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">Fixed Fulcrum</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leverLabData.showDistances}
                    onChange={(e) => setLeverLabData({ ...leverLabData, showDistances: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">Show Distances</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leverLabData.showMA}
                    onChange={(e) => setLeverLabData({ ...leverLabData, showMA: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">Show Mechanical Advantage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leverLabData.showTorque}
                    onChange={(e) => setLeverLabData({ ...leverLabData, showTorque: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">Show Torque Calculations</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={leverLabData.allowAddLoads}
                    onChange={(e) => setLeverLabData({ ...leverLabData, allowAddLoads: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-300">Allow Adding Loads</span>
                </label>
              </div>

              {/* Preset Scenarios */}
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-3">Quick Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLeverLabData({
                      ...leverLabData,
                      title: 'Balanced Seesaw',
                      beamLength: 10,
                      fulcrumPosition: 5,
                      fixedFulcrum: false,
                      loads: [
                        { position: 2, weight: 2, icon: '🧒', label: 'Child 1', isDraggable: true },
                        { position: 8, weight: 2, icon: '👧', label: 'Child 2', isDraggable: true },
                      ],
                      theme: 'seesaw',
                      showMA: false,
                      showTorque: false,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    K-1: Basic Balance
                  </button>
                  <button
                    onClick={() => setLeverLabData({
                      ...leverLabData,
                      title: 'Unbalanced Challenge',
                      beamLength: 10,
                      fulcrumPosition: 5,
                      fixedFulcrum: false,
                      loads: [
                        { position: 2, weight: 4, icon: '📦', label: 'Heavy Box', isDraggable: true },
                        { position: 8, weight: 2, icon: '🪨', label: 'Rock', isDraggable: true },
                      ],
                      theme: 'seesaw',
                      showDistances: true,
                      showMA: false,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 1-2: Find Balance
                  </button>
                  <button
                    onClick={() => setLeverLabData({
                      ...leverLabData,
                      title: 'Excavator Arm',
                      beamLength: 12,
                      fulcrumPosition: 3,
                      fixedFulcrum: true,
                      loads: [
                        { position: 1, weight: 8, icon: '🪨', label: 'Boulder', isDraggable: false },
                      ],
                      effortPosition: 10,
                      effortForce: 0,
                      theme: 'excavator',
                      showDistances: true,
                      showMA: true,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 3-4: Excavator
                  </button>
                  <button
                    onClick={() => setLeverLabData({
                      ...leverLabData,
                      title: 'Mechanical Advantage Lab',
                      beamLength: 15,
                      fulcrumPosition: 3,
                      fixedFulcrum: true,
                      loads: [
                        { position: 1, weight: 10, icon: '🪨', label: 'Heavy Load', isDraggable: false },
                      ],
                      effortPosition: 12,
                      effortForce: 0,
                      theme: 'crowbar',
                      showDistances: true,
                      showMA: true,
                      showTorque: true,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 4-5: MA Calculation
                  </button>
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={resetToDefaults}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
              >
                Reset to Defaults
              </button>
            </div>
          )}

          {/* Pulley System Builder Controls */}
          {selectedPrimitive === 'pulley-system-builder' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={pulleySystemData.title}
                  onChange={(e) => setPulleySystemData({ ...pulleySystemData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={pulleySystemData.description}
                  onChange={(e) => setPulleySystemData({ ...pulleySystemData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-yellow-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Load Weight</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={pulleySystemData.loadWeight}
                    onChange={(e) => setPulleySystemData({ ...pulleySystemData, loadWeight: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-yellow-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Max Pulleys</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={pulleySystemData.maxPulleys}
                    onChange={(e) => setPulleySystemData({ ...pulleySystemData, maxPulleys: parseInt(e.target.value) || 4 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                <select
                  value={pulleySystemData.theme}
                  onChange={(e) => setPulleySystemData({ ...pulleySystemData, theme: e.target.value as 'crane' | 'flagpole' | 'well' | 'construction' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-yellow-500 focus:outline-none"
                >
                  <option value="flagpole">Flagpole (K-1)</option>
                  <option value="well">Well (1-2)</option>
                  <option value="crane">Crane (3-5)</option>
                  <option value="construction">Construction (3-5)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pulleySystemData.showForceLabels}
                    onChange={(e) => setPulleySystemData({ ...pulleySystemData, showForceLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-slate-300">Show Force Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pulleySystemData.showRopeSegments}
                    onChange={(e) => setPulleySystemData({ ...pulleySystemData, showRopeSegments: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-slate-300">Show Rope Segments</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pulleySystemData.showMechanicalAdvantage}
                    onChange={(e) => setPulleySystemData({ ...pulleySystemData, showMechanicalAdvantage: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-slate-300">Show Mechanical Advantage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pulleySystemData.allowAddPulleys}
                    onChange={(e) => setPulleySystemData({ ...pulleySystemData, allowAddPulleys: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-slate-300">Allow Adding Pulleys</span>
                </label>
              </div>

              {/* Preset Scenarios */}
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-3">Quick Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPulleySystemData({
                      ...pulleySystemData,
                      title: 'Raise the Flag!',
                      fixedPulleys: [{ id: 'fixed-1', x: 50, y: 10, type: 'fixed', radius: 25 }],
                      movablePulleys: [],
                      loadWeight: 5,
                      theme: 'flagpole',
                      showForceLabels: false,
                      showRopeSegments: false,
                      showMechanicalAdvantage: false,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    K-1: Flagpole
                  </button>
                  <button
                    onClick={() => setPulleySystemData({
                      ...pulleySystemData,
                      title: 'Draw Water from the Well',
                      fixedPulleys: [{ id: 'fixed-1', x: 50, y: 10, type: 'fixed', radius: 25 }],
                      movablePulleys: [{ id: 'movable-1', x: 50, y: 50, type: 'movable', radius: 25 }],
                      loadWeight: 8,
                      theme: 'well',
                      showForceLabels: true,
                      showRopeSegments: false,
                      showMechanicalAdvantage: false,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 1-2: Well Bucket
                  </button>
                  <button
                    onClick={() => setPulleySystemData({
                      ...pulleySystemData,
                      title: 'Crane Lift Challenge',
                      fixedPulleys: [{ id: 'fixed-1', x: 40, y: 10, type: 'fixed', radius: 25 }, { id: 'fixed-2', x: 60, y: 10, type: 'fixed', radius: 25 }],
                      movablePulleys: [{ id: 'movable-1', x: 50, y: 45, type: 'movable', radius: 25 }],
                      loadWeight: 12,
                      theme: 'crane',
                      showForceLabels: true,
                      showRopeSegments: true,
                      showMechanicalAdvantage: true,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 2-3: Block & Tackle
                  </button>
                  <button
                    onClick={() => setPulleySystemData({
                      ...pulleySystemData,
                      title: 'Construction Hoist Design',
                      fixedPulleys: [{ id: 'fixed-1', x: 30, y: 10, type: 'fixed', radius: 25 }, { id: 'fixed-2', x: 70, y: 10, type: 'fixed', radius: 25 }],
                      movablePulleys: [{ id: 'movable-1', x: 40, y: 40, type: 'movable', radius: 25 }, { id: 'movable-2', x: 60, y: 55, type: 'movable', radius: 25 }],
                      loadWeight: 20,
                      theme: 'construction',
                      showForceLabels: true,
                      showRopeSegments: true,
                      showMechanicalAdvantage: true,
                      allowAddPulleys: true,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 4-5: MA Challenge
                  </button>
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={resetToDefaults}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
              >
                Reset to Defaults
              </button>
            </div>
          )}

          {/* Ramp Lab Controls */}
          {selectedPrimitive === 'ramp-lab' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={rampLabData.title}
                  onChange={(e) => setRampLabData({ ...rampLabData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={rampLabData.description}
                  onChange={(e) => setRampLabData({ ...rampLabData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Ramp Angle (°)</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={rampLabData.rampAngle}
                    onChange={(e) => setRampLabData({ ...rampLabData, rampAngle: parseInt(e.target.value) || 30 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Load Weight</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rampLabData.loadWeight}
                    onChange={(e) => setRampLabData({ ...rampLabData, loadWeight: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Load Type</label>
                <select
                  value={rampLabData.loadType}
                  onChange={(e) => setRampLabData({ ...rampLabData, loadType: e.target.value as 'box' | 'barrel' | 'wheel' | 'custom' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="box">Box (slides)</option>
                  <option value="barrel">Barrel (rolls)</option>
                  <option value="wheel">Wheel (rolls easily)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Friction Level</label>
                <select
                  value={rampLabData.frictionLevel}
                  onChange={(e) => setRampLabData({ ...rampLabData, frictionLevel: e.target.value as 'none' | 'low' | 'medium' | 'high' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="none">None (ideal)</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                <select
                  value={rampLabData.theme}
                  onChange={(e) => setRampLabData({ ...rampLabData, theme: e.target.value as 'loading_dock' | 'dump_truck' | 'skateboard' | 'generic' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="skateboard">Skateboard (K-2)</option>
                  <option value="loading_dock">Loading Dock (2-4)</option>
                  <option value="dump_truck">Dump Truck (2-4)</option>
                  <option value="generic">Generic</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rampLabData.adjustableAngle}
                    onChange={(e) => setRampLabData({ ...rampLabData, adjustableAngle: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Adjustable Angle</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rampLabData.showMeasurements}
                    onChange={(e) => setRampLabData({ ...rampLabData, showMeasurements: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Measurements</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rampLabData.showForceArrows}
                    onChange={(e) => setRampLabData({ ...rampLabData, showForceArrows: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Force Arrows</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rampLabData.showMA}
                    onChange={(e) => setRampLabData({ ...rampLabData, showMA: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Mechanical Advantage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rampLabData.allowPush}
                    onChange={(e) => setRampLabData({ ...rampLabData, allowPush: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Allow Push Force</span>
                </label>
              </div>

              {/* Preset Scenarios */}
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-3">Quick Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setRampLabData({
                      ...rampLabData,
                      title: 'Rolling Fun!',
                      rampAngle: 20,
                      loadType: 'wheel',
                      frictionLevel: 'none',
                      theme: 'skateboard',
                      showMeasurements: false,
                      showForceArrows: false,
                      showMA: false,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    K-1: Rolling Play
                  </button>
                  <button
                    onClick={() => setRampLabData({
                      ...rampLabData,
                      title: 'Steep vs Gentle',
                      rampAngle: 35,
                      loadType: 'box',
                      frictionLevel: 'medium',
                      theme: 'skateboard',
                      showMeasurements: true,
                      showForceArrows: false,
                      showMA: false,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 1-2: Angle Comparison
                  </button>
                  <button
                    onClick={() => setRampLabData({
                      ...rampLabData,
                      title: 'Loading Dock Design',
                      rampAngle: 25,
                      loadType: 'box',
                      frictionLevel: 'medium',
                      theme: 'loading_dock',
                      showMeasurements: true,
                      showForceArrows: false,
                      showMA: true,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 2-3: Loading Dock
                  </button>
                  <button
                    onClick={() => setRampLabData({
                      ...rampLabData,
                      title: 'Force Analysis Lab',
                      rampAngle: 30,
                      loadType: 'box',
                      frictionLevel: 'medium',
                      theme: 'generic',
                      showMeasurements: true,
                      showForceArrows: true,
                      showMA: true,
                      loadWeight: 8,
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 4-5: Force Analysis
                  </button>
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={resetToDefaults}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
              >
                Reset to Defaults
              </button>
            </div>
          )}

          {/* Wheel & Axle Explorer Controls */}
          {selectedPrimitive === 'wheel-axle-explorer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={wheelAxleData.title}
                  onChange={(e) => setWheelAxleData({ ...wheelAxleData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={wheelAxleData.description}
                  onChange={(e) => setWheelAxleData({ ...wheelAxleData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Wheel Diameter</label>
                  <input
                    type="number"
                    min="4"
                    max="12"
                    value={wheelAxleData.wheelDiameter}
                    onChange={(e) => setWheelAxleData({ ...wheelAxleData, wheelDiameter: parseInt(e.target.value) || 8 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Axle Diameter</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    step="0.5"
                    value={wheelAxleData.axleDiameter}
                    onChange={(e) => setWheelAxleData({ ...wheelAxleData, axleDiameter: parseFloat(e.target.value) || 2 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Attached Load (0 = no load)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={wheelAxleData.attachedLoad}
                  onChange={(e) => setWheelAxleData({ ...wheelAxleData, attachedLoad: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Rotation Input</label>
                <select
                  value={wheelAxleData.rotationInput}
                  onChange={(e) => setWheelAxleData({ ...wheelAxleData, rotationInput: e.target.value as 'drag' | 'buttons' | 'slider' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="drag">Drag (hands-on)</option>
                  <option value="buttons">Buttons (step control)</option>
                  <option value="slider">Slider (precise)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Theme</label>
                <select
                  value={wheelAxleData.theme}
                  onChange={(e) => setWheelAxleData({ ...wheelAxleData, theme: e.target.value as 'steering_wheel' | 'winch' | 'doorknob' | 'well_crank' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="doorknob">Doorknob (K-1)</option>
                  <option value="well_crank">Well Crank (1-2)</option>
                  <option value="winch">Winch (2-4)</option>
                  <option value="steering_wheel">Steering Wheel (3-5)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wheelAxleData.adjustable}
                    onChange={(e) => setWheelAxleData({ ...wheelAxleData, adjustable: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Adjustable Sizes</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wheelAxleData.showRatio}
                    onChange={(e) => setWheelAxleData({ ...wheelAxleData, showRatio: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Ratio</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wheelAxleData.showForce}
                    onChange={(e) => setWheelAxleData({ ...wheelAxleData, showForce: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Force Values</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wheelAxleData.showMechanicalAdvantage}
                    onChange={(e) => setWheelAxleData({ ...wheelAxleData, showMechanicalAdvantage: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Mechanical Advantage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wheelAxleData.showRotationCount}
                    onChange={(e) => setWheelAxleData({ ...wheelAxleData, showRotationCount: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Rotation Count</span>
                </label>
              </div>

              {/* Preset Scenarios */}
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-3">Quick Presets</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setWheelAxleData({
                      ...wheelAxleData,
                      title: 'Doorknob Discovery',
                      wheelDiameter: 6,
                      axleDiameter: 1.5,
                      attachedLoad: 0,
                      theme: 'doorknob',
                      showRatio: false,
                      showForce: false,
                      showMechanicalAdvantage: false,
                      rotationInput: 'drag',
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    K-1: Doorknob Play
                  </button>
                  <button
                    onClick={() => setWheelAxleData({
                      ...wheelAxleData,
                      title: 'Well Crank Challenge',
                      wheelDiameter: 8,
                      axleDiameter: 2,
                      attachedLoad: 3,
                      theme: 'well_crank',
                      showRatio: true,
                      showForce: false,
                      showMechanicalAdvantage: false,
                      rotationInput: 'drag',
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 1-2: Well Crank
                  </button>
                  <button
                    onClick={() => setWheelAxleData({
                      ...wheelAxleData,
                      title: 'Winch Lifting',
                      wheelDiameter: 10,
                      axleDiameter: 2,
                      attachedLoad: 6,
                      theme: 'winch',
                      showRatio: true,
                      showForce: false,
                      showMechanicalAdvantage: false,
                      rotationInput: 'buttons',
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 2-3: Winch Lifting
                  </button>
                  <button
                    onClick={() => setWheelAxleData({
                      ...wheelAxleData,
                      title: 'Gear Ratio Lab',
                      wheelDiameter: 12,
                      axleDiameter: 3,
                      attachedLoad: 8,
                      theme: 'steering_wheel',
                      showRatio: true,
                      showForce: true,
                      showMechanicalAdvantage: true,
                      rotationInput: 'slider',
                    })}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg transition-all"
                  >
                    Gr 4-5: Gear Ratio
                  </button>
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={resetToDefaults}
                className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
              >
                Reset to Defaults
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">Preview</h3>

          {/* Render Selected Primitive */}
          {selectedPrimitive === 'lever-lab' && (
            <LeverLab data={leverLabData} />
          )}
          {selectedPrimitive === 'pulley-system-builder' && (
            <PulleySystemBuilder data={pulleySystemData} />
          )}
          {selectedPrimitive === 'ramp-lab' && (
            <RampLab data={rampLabData} />
          )}
        </div>
      </div>

      {/* Educational Info Panel */}
      <div className="max-w-7xl mx-auto mt-8 p-6 bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-2xl border border-orange-500/30">
        <h3 className="text-xl font-bold text-white mb-4">Engineering Primitives - K-5 STEM Education</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm text-slate-300">
          <div>
            <h4 className="font-semibold text-orange-400 mb-2">Lever Lab</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• <strong>K-1:</strong> Basic balance concepts</li>
              <li>• <strong>Gr 1-2:</strong> Fulcrum position effects</li>
              <li>• <strong>Gr 2-3:</strong> Distance vs weight</li>
              <li>• <strong>Gr 4-5:</strong> MA calculations</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-yellow-400 mb-2">Pulley System Builder</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• <strong>K-1:</strong> Ropes and lifting</li>
              <li>• <strong>Gr 1-2:</strong> Direction change</li>
              <li>• <strong>Gr 2-3:</strong> Effort reduction</li>
              <li>• <strong>Gr 4-5:</strong> Rope segment counting</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-blue-400 mb-2">Ramp Lab</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• <strong>K-1:</strong> Rolling vs sliding</li>
              <li>• <strong>Gr 1-2:</strong> Steeper = harder</li>
              <li>• <strong>Gr 2-3:</strong> Height vs length</li>
              <li>• <strong>Gr 4-5:</strong> Force calculations</li>
            </ul>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-slate-300 mt-4">
          <div>
            <h4 className="font-semibold text-orange-400 mb-2">Lever Real-World</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• Seesaw / Teeter-totter</li>
              <li>• Excavator boom</li>
              <li>• Crowbar, wheelbarrow</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-yellow-400 mb-2">Pulley Real-World</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• Flagpole, well bucket</li>
              <li>• Construction crane</li>
              <li>• Elevator systems</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-blue-400 mb-2">Ramp Real-World</h4>
            <ul className="space-y-1 text-slate-400">
              <li>• Loading docks, ADA ramps</li>
              <li>• Dump trucks, slides</li>
              <li>• Skateboard ramps</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-500">
            <strong>NGSS Alignment:</strong> K-2-ETS1-2 (Design solutions), 3-PS2-1 (Balanced/unbalanced forces),
            3-5-ETS1-1 (Define problems), 3-5-ETS1-3 (Iterative testing)
          </p>
        </div>
      </div>
    </div>
  );
};

export default EngineeringPrimitivesTester;
