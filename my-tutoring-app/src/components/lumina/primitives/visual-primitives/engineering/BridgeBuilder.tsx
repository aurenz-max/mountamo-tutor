'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Bridge Builder - Interactive 2D bridge construction for teaching structural engineering
 *
 * K-5 Engineering Primitive for understanding:
 * - Connecting two sides (K-1)
 * - Supports at edges vs middle (1-2)
 * - Triangles are strong (2-3)
 * - Load distribution concepts (3-4)
 * - Truss design optimization (4-5)
 *
 * Real-world connections: bridges, trusses, construction, architecture
 */

export interface BridgeMember {
  id: string;
  type: 'beam' | 'cable' | 'support';
  startJointId: string;
  endJointId: string;
  strength?: number;        // Breaking threshold (0-100)
  color?: string;
}

export interface BridgeJoint {
  id: string;
  x: number;               // X position (0-100 normalized)
  y: number;               // Y position (0-100 normalized)
  isAnchor: boolean;       // Fixed support point
  isDraggable?: boolean;   // Can user move this joint
}

export interface BridgePiece {
  type: 'beam' | 'cable' | 'support';
  count: number;           // How many available
  strength: number;        // Breaking threshold
  icon?: string;
}

export interface BridgeBuilderData {
  title: string;
  description: string;
  spanWidth: number;                    // Gap to bridge (visual units)
  availablePieces: BridgePiece[];       // Types and quantities of members
  anchorPoints: { x: number; y: number }[];  // Valid support positions
  loadType: 'car' | 'truck' | 'train' | 'point_load';
  loadWeight: number;                   // Force to apply (1-100)
  loadPosition: number;                 // Where load crosses (0-100, left to right)
  showStress: boolean;                  // Color members by load
  budget?: number;                      // Optional piece limit
  materialStrength: {                   // Breaking threshold per type
    beam: number;
    cable: number;
    support: number;
  };
  initialJoints?: BridgeJoint[];        // Pre-placed joints
  initialMembers?: BridgeMember[];      // Pre-placed members
  allowFreeBuilding?: boolean;          // Can add joints anywhere
  theme: 'construction' | 'medieval' | 'modern' | 'generic';
}

interface BridgeBuilderProps {
  data: BridgeBuilderData;
  className?: string;
}

interface StressResult {
  memberId: string;
  stress: number;         // 0-100
  failed: boolean;
}

const BridgeBuilder: React.FC<BridgeBuilderProps> = ({ data, className }) => {
  const {
    title,
    description,
    spanWidth = 80,
    availablePieces = [],
    anchorPoints = [],
    loadType = 'car',
    loadWeight = 50,
    loadPosition = 50,
    showStress = true,
    budget,
    materialStrength = { beam: 70, cable: 50, support: 90 },
    initialJoints = [],
    initialMembers = [],
    allowFreeBuilding = true,
    theme = 'generic',
  } = data;

  // State
  const [joints, setJoints] = useState<BridgeJoint[]>(() => {
    // Initialize with anchor points and any initial joints
    const anchors: BridgeJoint[] = anchorPoints.map((p, i) => ({
      id: `anchor-${i}`,
      x: p.x,
      y: p.y,
      isAnchor: true,
      isDraggable: false,
    }));
    return [...anchors, ...initialJoints];
  });

  const [members, setMembers] = useState<BridgeMember[]>(initialMembers);
  const [selectedJoint, setSelectedJoint] = useState<string | null>(null);
  const [selectedPieceType, setSelectedPieceType] = useState<'beam' | 'cable' | 'support'>('beam');
  const [isSimulating, setIsSimulating] = useState(false);
  const [stressResults, setStressResults] = useState<StressResult[]>([]);
  const [bridgeFailed, setBridgeFailed] = useState(false);
  const [bridgeSuccess, setBridgeSuccess] = useState(false);
  const [loadAnimationProgress, setLoadAnimationProgress] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [draggedJoint, setDraggedJoint] = useState<string | null>(null);
  const [hoveredJoint, setHoveredJoint] = useState<string | null>(null);
  const [carPosition, setCarPosition] = useState<{ x: number; y: number } | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 500;
  const groundY = 400;
  const bridgeStartX = 100;
  const bridgeEndX = 700;
  const bridgeSpan = bridgeEndX - bridgeStartX;

  // Convert normalized coordinates to SVG
  const toSvgX = (x: number) => bridgeStartX + (x / 100) * bridgeSpan;
  const toSvgY = (y: number) => groundY - (y / 100) * 200;

  // Convert SVG coordinates to normalized
  const toNormX = (svgX: number) => ((svgX - bridgeStartX) / bridgeSpan) * 100;
  const toNormY = (svgY: number) => ((groundY - svgY) / 200) * 100;

  // Find if there's a connected path from left to right anchor
  const findBridgePath = useCallback(() => {
    // Find left and right anchors
    const leftAnchor = joints.find(j => j.isAnchor && j.x <= 10);
    const rightAnchor = joints.find(j => j.isAnchor && j.x >= 90);

    if (!leftAnchor || !rightAnchor) return null;

    // BFS to find path
    const visited = new Set<string>();
    const queue: { jointId: string; path: string[] }[] = [{ jointId: leftAnchor.id, path: [leftAnchor.id] }];

    while (queue.length > 0) {
      const { jointId, path } = queue.shift()!;

      if (jointId === rightAnchor.id) {
        return path;
      }

      if (visited.has(jointId)) continue;
      visited.add(jointId);

      // Find all connected joints through members
      const connectedMembers = members.filter(
        m => m.startJointId === jointId || m.endJointId === jointId
      );

      for (const member of connectedMembers) {
        const nextJointId = member.startJointId === jointId ? member.endJointId : member.startJointId;
        if (!visited.has(nextJointId)) {
          queue.push({ jointId: nextJointId, path: [...path, nextJointId] });
        }
      }
    }

    return null; // No path found
  }, [joints, members]);

  // Get Y position on the bridge at a given X position (0-100)
  const getBridgeYAtX = useCallback((xPos: number): number | null => {
    // Find all members that span this X position
    const crossingMembers = members.filter(member => {
      const startJoint = joints.find(j => j.id === member.startJointId);
      const endJoint = joints.find(j => j.id === member.endJointId);
      if (!startJoint || !endJoint) return false;

      const minX = Math.min(startJoint.x, endJoint.x);
      const maxX = Math.max(startJoint.x, endJoint.x);
      return xPos >= minX && xPos <= maxX;
    });

    if (crossingMembers.length === 0) return null;

    // Find the topmost member at this X position (the one the car would drive on)
    let highestY = -Infinity;

    for (const member of crossingMembers) {
      const startJoint = joints.find(j => j.id === member.startJointId)!;
      const endJoint = joints.find(j => j.id === member.endJointId)!;

      // Linear interpolation to find Y at this X
      const t = (xPos - startJoint.x) / (endJoint.x - startJoint.x || 1);
      const yAtX = startJoint.y + t * (endJoint.y - startJoint.y);

      // We want the lowest Y value (highest on screen since Y is inverted in our coord system)
      // Actually, we want members near deck level - around y=0-30 in normalized coords
      if (yAtX >= -10 && yAtX <= 50 && yAtX > highestY) {
        highestY = yAtX;
      }
    }

    // If no deck-level member found, check for any member
    if (highestY === -Infinity) {
      for (const member of crossingMembers) {
        const startJoint = joints.find(j => j.id === member.startJointId)!;
        const endJoint = joints.find(j => j.id === member.endJointId)!;

        const t = (xPos - startJoint.x) / (endJoint.x - startJoint.x || 1);
        const yAtX = startJoint.y + t * (endJoint.y - startJoint.y);

        if (yAtX > highestY) {
          highestY = yAtX;
        }
      }
    }

    return highestY === -Infinity ? null : highestY;
  }, [joints, members]);

  // Get available piece count
  const getAvailableCount = (type: 'beam' | 'cable' | 'support') => {
    const piece = availablePieces.find(p => p.type === type);
    if (!piece) return Infinity;
    const usedCount = members.filter(m => m.type === type).length;
    return piece.count - usedCount;
  };

  // Calculate member stress (simplified but more realistic physics)
  const calculateStress = useCallback(() => {
    const results: StressResult[] = [];

    // Count how many members are actually supporting the load path
    const supportingMembers = members.filter(member => {
      const startJoint = joints.find(j => j.id === member.startJointId);
      const endJoint = joints.find(j => j.id === member.endJointId);
      if (!startJoint || !endJoint) return false;

      // Member spans the current load position
      const minX = Math.min(startJoint.x, endJoint.x);
      const maxX = Math.max(startJoint.x, endJoint.x);
      return loadAnimationProgress >= minX && loadAnimationProgress <= maxX;
    });

    const loadDistribution = Math.max(1, supportingMembers.length);

    members.forEach(member => {
      const startJoint = joints.find(j => j.id === member.startJointId);
      const endJoint = joints.find(j => j.id === member.endJointId);

      if (!startJoint || !endJoint) return;

      // Calculate member length
      const dx = toSvgX(endJoint.x) - toSvgX(startJoint.x);
      const dy = toSvgY(endJoint.y) - toSvgY(startJoint.y);
      const length = Math.sqrt(dx * dx + dy * dy);

      // Calculate stress based on multiple factors
      const memberCenterX = (startJoint.x + endJoint.x) / 2;
      const distanceFromLoad = Math.abs(memberCenterX - loadAnimationProgress);
      const loadProximityFactor = Math.max(0.1, 1 - (distanceFromLoad / 50));

      const memberCenterY = (startJoint.y + endJoint.y) / 2;
      const isNearTop = memberCenterY > 30;

      const angle = Math.abs(Math.atan2(dy, dx));
      const horizontalFactor = 1 - Math.abs(Math.sin(angle)) * 0.3;

      // Base stress - higher base makes failure more likely
      let stress = (loadWeight * 1.5) * loadProximityFactor * horizontalFactor;

      // Long horizontal spans are weak without triangulation
      if (length > 150 && Math.abs(angle) < 0.3) {
        stress *= 1.5; // Penalize long horizontal spans
      }

      // Cables handle tension (top chords), beams handle compression (bottom)
      if (member.type === 'cable') {
        if (isNearTop) {
          stress *= 0.6; // Cables are good at tension
        } else {
          stress *= 1.3; // Cables are bad at compression
        }
      } else if (member.type === 'beam') {
        if (!isNearTop) {
          stress *= 0.7; // Beams handle compression well
        }
      }

      // Supports are strongest but only at edges
      if (member.type === 'support') {
        const isAtEdge = (startJoint.isAnchor || endJoint.isAnchor);
        stress *= isAtEdge ? 0.4 : 0.8;
      }

      // Length factor - longer unsupported members are more stressed
      stress *= Math.max(0.5, length / 150);

      // Distribute load across supporting members (triangulation helps!)
      if (supportingMembers.some(m => m.id === member.id)) {
        stress /= Math.sqrt(loadDistribution); // Better distribution with more members
      }

      // Get strength threshold
      const strength = member.strength || materialStrength[member.type];

      results.push({
        memberId: member.id,
        stress: Math.min(100, stress),
        failed: stress > strength,
      });
    });

    return results;
  }, [members, joints, loadAnimationProgress, loadWeight, materialStrength]);

  // Run stress test
  const runStressTest = useCallback(() => {
    setIsSimulating(true);
    setBridgeFailed(false);
    setBridgeSuccess(false);
    setLoadAnimationProgress(0);
    setCarPosition(null);

    // First check if there's a valid path across
    const bridgePath = findBridgePath();
    if (!bridgePath) {
      // No connected path - immediate failure
      setHint("The bridge isn't connected from one side to the other!");
      setTimeout(() => {
        setBridgeFailed(true);
        setIsSimulating(false);
        setHint(null);
      }, 1500);
      return;
    }

    // Animate load crossing
    let progress = 0;
    let hasFailed = false;

    const animationInterval = setInterval(() => {
      progress += 1.5;
      setLoadAnimationProgress(progress);

      // Get Y position on bridge at current progress
      const bridgeY = getBridgeYAtX(progress);

      if (bridgeY !== null) {
        setCarPosition({ x: progress, y: bridgeY });
      } else if (progress > 5 && progress < 95) {
        // No bridge surface at this point - car falls!
        if (!hasFailed) {
          hasFailed = true;
          clearInterval(animationInterval);

          // Animate car falling
          let fallY = carPosition?.y || 0;
          const fallInterval = setInterval(() => {
            fallY -= 15;
            setCarPosition(prev => prev ? { ...prev, y: fallY } : { x: progress, y: fallY });

            if (fallY < -50) {
              clearInterval(fallInterval);
              setBridgeFailed(true);
              setHint("The car fell through a gap in the bridge!");
              setTimeout(() => {
                setIsSimulating(false);
                setHint(null);
              }, 2000);
            }
          }, 50);
        }
        return;
      }

      // Calculate stress at current position
      const results = calculateStress();
      setStressResults(results);

      // Check for member failures
      const failedMembers = results.filter(r => r.failed);
      if (failedMembers.length > 0 && !hasFailed) {
        hasFailed = true;
        clearInterval(animationInterval);
        setBridgeFailed(true);
        setHint("A bridge member broke under the weight!");

        setTimeout(() => {
          setIsSimulating(false);
          setHint(null);
        }, 2000);
        return;
      }

      if (progress >= 100) {
        clearInterval(animationInterval);
        setBridgeSuccess(true);
        setCarPosition(null);

        setTimeout(() => {
          setIsSimulating(false);
        }, 1000);
      }
    }, 50);
  }, [calculateStress, findBridgePath, getBridgeYAtX, carPosition]);

  // Handle canvas click to add joint
  const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!allowFreeBuilding || isSimulating) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;

    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    // Check if click is in valid building area
    if (svgX < bridgeStartX - 20 || svgX > bridgeEndX + 20) return;
    if (svgY < 100 || svgY > groundY + 20) return;

    const normX = toNormX(svgX);
    const normY = toNormY(svgY);

    // If a joint is selected, create a member to this position
    if (selectedJoint) {
      // Check if clicking on existing joint - use larger hit area for easier connection
      const clickedJoint = joints.find(j => {
        const jx = toSvgX(j.x);
        const jy = toSvgY(j.y);
        return Math.abs(jx - svgX) < 35 && Math.abs(jy - svgY) < 35;
      });

      if (clickedJoint && clickedJoint.id !== selectedJoint) {
        // Create member between joints
        if (getAvailableCount(selectedPieceType) > 0) {
          const newMember: BridgeMember = {
            id: `member-${Date.now()}`,
            type: selectedPieceType,
            startJointId: selectedJoint,
            endJointId: clickedJoint.id,
            strength: materialStrength[selectedPieceType],
          };
          setMembers([...members, newMember]);
        } else {
          setHint(`No more ${selectedPieceType}s available!`);
          setTimeout(() => setHint(null), 2000);
        }
      } else if (!clickedJoint) {
        // Create new joint and member
        const newJoint: BridgeJoint = {
          id: `joint-${Date.now()}`,
          x: Math.max(0, Math.min(100, normX)),
          y: Math.max(0, Math.min(100, normY)),
          isAnchor: false,
          isDraggable: true,
        };

        if (getAvailableCount(selectedPieceType) > 0) {
          const newMember: BridgeMember = {
            id: `member-${Date.now()}`,
            type: selectedPieceType,
            startJointId: selectedJoint,
            endJointId: newJoint.id,
            strength: materialStrength[selectedPieceType],
          };
          setJoints([...joints, newJoint]);
          setMembers([...members, newMember]);
        }
      }

      setSelectedJoint(null);
    } else {
      // Check if clicking on existing joint - use larger hit area
      const clickedJoint = joints.find(j => {
        const jx = toSvgX(j.x);
        const jy = toSvgY(j.y);
        return Math.abs(jx - svgX) < 35 && Math.abs(jy - svgY) < 35;
      });

      if (clickedJoint) {
        setSelectedJoint(clickedJoint.id);
      }
    }
  }, [allowFreeBuilding, isSimulating, selectedJoint, joints, members, selectedPieceType, materialStrength]);

  // Handle mouse move for hover detection and preview line
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isSimulating) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = svgWidth / rect.width;
    const scaleY = svgHeight / rect.height;

    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    // Track mouse position for preview line
    setMousePosition({ x: svgX, y: svgY });

    // Check if hovering over a joint
    const hovered = joints.find(j => {
      const jx = toSvgX(j.x);
      const jy = toSvgY(j.y);
      return Math.abs(jx - svgX) < 35 && Math.abs(jy - svgY) < 35;
    });

    setHoveredJoint(hovered?.id || null);
  }, [isSimulating, joints]);

  // Handle joint drag
  const handleJointMouseDown = (e: React.MouseEvent, jointId: string) => {
    const joint = joints.find(j => j.id === jointId);
    if (!joint?.isDraggable || isSimulating) return;
    e.stopPropagation();
    setDraggedJoint(jointId);
  };

  useEffect(() => {
    if (!draggedJoint) return;

    const handleMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const scaleX = svgWidth / rect.width;
      const scaleY = svgHeight / rect.height;

      const svgX = (e.clientX - rect.left) * scaleX;
      const svgY = (e.clientY - rect.top) * scaleY;

      const normX = Math.max(0, Math.min(100, toNormX(svgX)));
      const normY = Math.max(0, Math.min(100, toNormY(svgY)));

      setJoints(prev => prev.map(j =>
        j.id === draggedJoint ? { ...j, x: normX, y: normY } : j
      ));
    };

    const handleMouseUp = () => {
      setDraggedJoint(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggedJoint]);

  // Delete member
  const deleteMember = (memberId: string) => {
    setMembers(members.filter(m => m.id !== memberId));
    setStressResults([]);
  };

  // Delete joint (and connected members)
  const deleteJoint = (jointId: string) => {
    const joint = joints.find(j => j.id === jointId);
    if (!joint || joint.isAnchor) return;

    setJoints(joints.filter(j => j.id !== jointId));
    setMembers(members.filter(m => m.startJointId !== jointId && m.endJointId !== jointId));
    setSelectedJoint(null);
    setStressResults([]);
  };

  // Reset
  const handleReset = () => {
    const anchors: BridgeJoint[] = anchorPoints.map((p, i) => ({
      id: `anchor-${i}`,
      x: p.x,
      y: p.y,
      isAnchor: true,
      isDraggable: false,
    }));
    setJoints([...anchors, ...initialJoints]);
    setMembers(initialMembers);
    setSelectedJoint(null);
    setStressResults([]);
    setBridgeFailed(false);
    setBridgeSuccess(false);
    setLoadAnimationProgress(0);
    setIsSimulating(false);
  };

  // Get stress color
  const getStressColor = (memberId: string) => {
    if (!showStress || stressResults.length === 0) return null;

    const result = stressResults.find(r => r.memberId === memberId);
    if (!result) return null;

    if (result.failed) return '#EF4444'; // Red
    if (result.stress > 70) return '#F59E0B'; // Amber
    if (result.stress > 40) return '#EAB308'; // Yellow
    return '#22C55E'; // Green
  };

  // Get load icon
  const getLoadIcon = () => {
    switch (loadType) {
      case 'car': return '🚗';
      case 'truck': return '🚛';
      case 'train': return '🚂';
      default: return '⬇️';
    }
  };

  // Get theme colors
  const getThemeColors = () => {
    switch (theme) {
      case 'construction':
        return { beam: '#F59E0B', cable: '#6B7280', support: '#78716C', ground: '#92400E' };
      case 'medieval':
        return { beam: '#8B5A2B', cable: '#4A4A4A', support: '#6B7280', ground: '#4B5320' };
      case 'modern':
        return { beam: '#3B82F6', cable: '#8B5CF6', support: '#6366F1', ground: '#374151' };
      default:
        return { beam: '#6366F1', cable: '#10B981', support: '#64748B', ground: '#475569' };
    }
  };

  const themeColors = getThemeColors();

  // Get piece color
  const getMemberColor = (member: BridgeMember) => {
    const stressColor = getStressColor(member.id);
    if (stressColor) return stressColor;
    return member.color || themeColors[member.type];
  };

  // Calculate pieces used
  const piecesUsed = members.length;
  const withinBudget = !budget || piecesUsed <= budget;

  return (
    <div className={`w-full max-w-5xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">{title}</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <p className="text-xs text-blue-400 font-mono uppercase tracking-wider">
              Bridge Engineering Lab
            </p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-blue-500/20 relative overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10">
          {/* Description */}
          <div className="mb-6 text-center max-w-2xl mx-auto">
            <p className="text-slate-300 font-light">{description}</p>
          </div>

          {/* Status Bar */}
          <div className="mb-4 flex justify-center gap-4 flex-wrap">
            {budget && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                withinBudget ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'
              }`}>
                <span className="text-sm font-mono">
                  Pieces: <span className={withinBudget ? 'text-green-300' : 'text-red-300'}>{piecesUsed}/{budget}</span>
                </span>
              </div>
            )}

            {bridgeSuccess && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/50 animate-pulse">
                <span className="text-green-300 font-bold">Bridge Holds!</span>
              </div>
            )}

            {bridgeFailed && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/20 border border-red-500/50 animate-pulse">
                <span className="text-red-300 font-bold">Bridge Failed!</span>
              </div>
            )}
          </div>

          {/* SVG Canvas */}
          <div className="relative bg-slate-800/40 backdrop-blur-sm rounded-2xl overflow-hidden mb-6 border border-slate-700/50">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto select-none cursor-crosshair"
              style={{ maxHeight: '450px' }}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={() => { setHoveredJoint(null); setMousePosition(null); }}
            >
              {/* Defs */}
              <defs>
                <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#0F172A" />
                  <stop offset="100%" stopColor="#1E293B" />
                </linearGradient>
                <linearGradient id="groundGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={themeColors.ground} />
                  <stop offset="100%" stopColor="#1F2937" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* Sky */}
              <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#skyGradient)" />

              {/* Grid */}
              <g opacity="0.1">
                {Array.from({ length: 17 }).map((_, i) => (
                  <line key={`v${i}`} x1={bridgeStartX + i * 37.5} y1={100} x2={bridgeStartX + i * 37.5} y2={groundY} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <line key={`h${i}`} x1={bridgeStartX} y1={100 + i * 43} x2={bridgeEndX} y2={100 + i * 43} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
              </g>

              {/* Ground/Cliffs */}
              <rect x={0} y={groundY} width={bridgeStartX} height={100} fill="url(#groundGradient)" />
              <rect x={bridgeEndX} y={groundY} width={svgWidth - bridgeEndX} height={100} fill="url(#groundGradient)" />

              {/* Gap indication */}
              <rect x={bridgeStartX} y={groundY} width={bridgeSpan} height={100} fill="#0F172A" opacity="0.5" />
              <text x={svgWidth / 2} y={groundY + 50} textAnchor="middle" fill="#64748B" fontSize="14" fontFamily="monospace">
                ~ water ~
              </text>

              {/* Members */}
              {members.map(member => {
                const startJoint = joints.find(j => j.id === member.startJointId);
                const endJoint = joints.find(j => j.id === member.endJointId);
                if (!startJoint || !endJoint) return null;

                const x1 = toSvgX(startJoint.x);
                const y1 = toSvgY(startJoint.y);
                const x2 = toSvgX(endJoint.x);
                const y2 = toSvgY(endJoint.y);

                const color = getMemberColor(member);
                const strokeWidth = member.type === 'cable' ? 3 : member.type === 'support' ? 8 : 6;
                const strokeDash = member.type === 'cable' ? '5,5' : undefined;

                const result = stressResults.find(r => r.memberId === member.id);
                const failed = result?.failed;

                return (
                  <g key={member.id}>
                    {/* Member shadow */}
                    <line
                      x1={x1 + 2}
                      y1={y1 + 2}
                      x2={x2 + 2}
                      y2={y2 + 2}
                      stroke="black"
                      strokeWidth={strokeWidth}
                      opacity={0.3}
                      strokeLinecap="round"
                    />

                    {/* Member */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeDasharray={strokeDash}
                      className={`transition-all duration-300 ${failed ? 'animate-pulse' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSimulating) deleteMember(member.id);
                      }}
                    />

                    {/* Stress indicator */}
                    {showStress && result && (
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 10}
                        textAnchor="middle"
                        fill={color}
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {Math.round(result.stress)}%
                      </text>
                    )}

                    {/* Failure crack */}
                    {failed && (
                      <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                        <text fontSize="20" textAnchor="middle" dominantBaseline="middle">💥</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Preview line when connecting */}
              {selectedJoint && mousePosition && !isSimulating && (() => {
                const startJoint = joints.find(j => j.id === selectedJoint);
                if (!startJoint) return null;

                const startX = toSvgX(startJoint.x);
                const startY = toSvgY(startJoint.y);

                // Snap to hovered joint if any
                let endX = mousePosition.x;
                let endY = mousePosition.y;

                if (hoveredJoint && hoveredJoint !== selectedJoint) {
                  const targetJoint = joints.find(j => j.id === hoveredJoint);
                  if (targetJoint) {
                    endX = toSvgX(targetJoint.x);
                    endY = toSvgY(targetJoint.y);
                  }
                }

                const previewColor = hoveredJoint && hoveredJoint !== selectedJoint ? '#22C55E' : '#A855F7';

                return (
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={previewColor}
                    strokeWidth={4}
                    strokeDasharray="8,4"
                    opacity={0.7}
                    pointerEvents="none"
                  />
                );
              })()}

              {/* Joints */}
              {joints.map(joint => {
                const x = toSvgX(joint.x);
                const y = toSvgY(joint.y);
                const isSelected = selectedJoint === joint.id;
                const isHovered = hoveredJoint === joint.id;
                const canConnect = selectedJoint && selectedJoint !== joint.id;

                return (
                  <g
                    key={joint.id}
                    transform={`translate(${x}, ${y})`}
                    style={{ cursor: joint.isDraggable ? 'grab' : joint.isAnchor ? 'default' : 'pointer' }}
                    onMouseDown={(e) => handleJointMouseDown(e, joint.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isSimulating) {
                        if (selectedJoint === joint.id) {
                          setSelectedJoint(null);
                        } else if (selectedJoint) {
                          // Connect to this joint
                          if (getAvailableCount(selectedPieceType) > 0) {
                            const newMember: BridgeMember = {
                              id: `member-${Date.now()}`,
                              type: selectedPieceType,
                              startJointId: selectedJoint,
                              endJointId: joint.id,
                              strength: materialStrength[selectedPieceType],
                            };
                            setMembers([...members, newMember]);
                          }
                          setSelectedJoint(null);
                        } else {
                          setSelectedJoint(joint.id);
                        }
                      }
                    }}
                  >
                    {/* Hover/connect indicator - larger hit area visualization */}
                    {(isHovered || (canConnect && isHovered)) && !isSimulating && (
                      <circle
                        r={25}
                        fill={canConnect ? '#22C55E' : '#3B82F6'}
                        opacity={0.15}
                        className="animate-pulse"
                      />
                    )}

                    {/* Connection target indicator when another joint is selected */}
                    {canConnect && !isHovered && (
                      <circle
                        r={18}
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth={2}
                        strokeDasharray="4,4"
                        opacity={0.5}
                      />
                    )}

                    {/* Anchor indicator */}
                    {joint.isAnchor && (
                      <>
                        <rect x={-15} y={-5} width={30} height={20} fill={themeColors.ground} rx={2} />
                        <line x1={-12} y1={5} x2={-12} y2={15} stroke="#64748B" strokeWidth={2} />
                        <line x1={0} y1={5} x2={0} y2={15} stroke="#64748B" strokeWidth={2} />
                        <line x1={12} y1={5} x2={12} y2={15} stroke="#64748B" strokeWidth={2} />
                      </>
                    )}

                    {/* Joint circle */}
                    <circle
                      r={joint.isAnchor ? 10 : 8}
                      fill={isSelected ? '#A855F7' : (canConnect && isHovered) ? '#22C55E' : isHovered ? '#60A5FA' : joint.isAnchor ? '#64748B' : '#3B82F6'}
                      stroke={isSelected ? '#E879F9' : (canConnect && isHovered) ? '#4ADE80' : 'white'}
                      strokeWidth={isHovered ? 3 : 2}
                      filter={isSelected || isHovered ? 'url(#glow)' : undefined}
                      className="transition-all duration-150"
                    />

                    {/* Delete button for non-anchor joints */}
                    {!joint.isAnchor && !isSimulating && !selectedJoint && (
                      <g
                        transform="translate(12, -12)"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteJoint(joint.id);
                        }}
                      >
                        <circle r={8} fill="#EF4444" opacity={0.8} />
                        <text fontSize="10" fill="white" textAnchor="middle" dominantBaseline="middle">×</text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Load animation */}
              {isSimulating && (
                <g transform={`translate(${
                  carPosition ? toSvgX(carPosition.x) : bridgeStartX + (loadAnimationProgress / 100) * bridgeSpan
                }, ${
                  carPosition ? toSvgY(carPosition.y) - 20 : groundY - 50
                })`}>
                  <text fontSize="32" textAnchor="middle" dominantBaseline="middle">
                    {getLoadIcon()}
                  </text>
                  {!carPosition && (
                    <text y={30} fontSize="12" fill="#F59E0B" textAnchor="middle" fontFamily="monospace">
                      {loadWeight} units
                    </text>
                  )}
                </g>
              )}

              {/* Instructions */}
              {!isSimulating && selectedJoint && (
                <text x={svgWidth / 2} y={50} textAnchor="middle" fill="#94A3B8" fontSize="14" fontFamily="monospace">
                  Click another joint or empty space to connect with a {selectedPieceType}
                </text>
              )}

              {!isSimulating && !selectedJoint && members.length === 0 && (
                <text x={svgWidth / 2} y={50} textAnchor="middle" fill="#94A3B8" fontSize="14" fontFamily="monospace">
                  Click a joint to start building your bridge!
                </text>
              )}
            </svg>
          </div>

          {/* Piece Selector */}
          <div className="mb-6 flex flex-wrap justify-center gap-3">
            {(['beam', 'cable', 'support'] as const).map(type => {
              const available = getAvailableCount(type);
              const isSelected = selectedPieceType === type;
              const pieceConfig = availablePieces.find(p => p.type === type);

              return (
                <button
                  key={type}
                  onClick={() => setSelectedPieceType(type)}
                  disabled={available <= 0}
                  className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'bg-blue-500/30 border-blue-500 text-blue-300'
                      : available > 0
                        ? 'bg-slate-800/40 border-slate-600 text-slate-300 hover:bg-slate-700/40'
                        : 'bg-slate-800/20 border-slate-700 text-slate-500 opacity-50'
                  }`}
                >
                  <span className="text-lg">{pieceConfig?.icon || (type === 'beam' ? '📏' : type === 'cable' ? '🔗' : '🔩')}</span>
                  <div className="text-left">
                    <div className="font-semibold capitalize">{type}</div>
                    <div className="text-xs opacity-75">
                      {available === Infinity ? '∞' : available} left
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={runStressTest}
              disabled={isSimulating || members.length === 0}
              className="px-6 py-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-slate-700/50 disabled:opacity-50 border border-green-500/50 text-green-300 rounded-xl font-semibold transition-all hover:shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center gap-2"
            >
              {isSimulating ? (
                <>
                  <div className="w-5 h-5 border-2 border-green-300/30 border-t-green-300 rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <span>{getLoadIcon()}</span>
                  Test Bridge
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              disabled={isSimulating}
              className="px-5 py-2.5 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 text-slate-300 rounded-xl font-semibold transition-all flex items-center gap-2"
            >
              <span>↺</span> Reset
            </button>
          </div>

          {/* Hint */}
          {hint && (
            <div className="mt-6 p-4 bg-amber-500/10 backdrop-blur-sm border border-amber-500/30 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <span className="text-amber-400 text-lg">💡</span>
                <p className="text-amber-200 text-sm">{hint}</p>
              </div>
            </div>
          )}

          {/* Educational Info */}
          <div className="mt-6 p-5 bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Bridge Engineering Tips
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                <span className="text-blue-400 font-semibold">Triangles are strong!</span> They distribute weight evenly and don't change shape under pressure.
              </p>
              <p className="text-slate-300">
                <span className="text-green-400 font-semibold">Beams</span> are good for compression (pushing together).
                <span className="text-purple-400 font-semibold ml-2">Cables</span> are good for tension (pulling apart).
              </p>
              {showStress && (
                <p className="text-slate-300">
                  <span className="text-amber-400 font-semibold">Stress colors:</span>{' '}
                  <span className="text-green-400">Green = Safe</span> |{' '}
                  <span className="text-yellow-400">Yellow = Warning</span> |{' '}
                  <span className="text-red-400">Red = Failing!</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BridgeBuilder;
