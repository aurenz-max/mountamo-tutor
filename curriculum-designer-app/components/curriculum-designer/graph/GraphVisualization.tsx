'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Maximize2, Network } from 'lucide-react';
import { curriculumGraphAPI } from '@/lib/curriculum-authoring/graphApi';
import type { PrerequisiteGraph, PrerequisiteGraphNode } from '@/types/curriculum-authoring';

interface GraphVisualizationProps {
  subjectId: string;
  includeDrafts?: boolean;
}

// --- CONFIGURATION CONSTANTS ---
const SKILL_HEADER_HEIGHT = 80;
const SKILL_COLUMN_WIDTH = 300;
const SUBSKILL_NODE_HEIGHT = 120;
const SUBSKILL_NODE_WIDTH = 240;

// Custom node styles
const nodeStyles = {
  skill: {
    background: '#3b82f6', // blue-500
    color: 'white',
    width: SUBSKILL_NODE_WIDTH,
    textAlign: 'center' as const,
    fontSize: '16px',
    fontWeight: 'bold',
    border: '2px solid white',
    borderRadius: '8px',
    padding: '12px',
  },
  subskill: {
    background: '#8b5cf6', // violet-500
    color: 'white',
    width: SUBSKILL_NODE_WIDTH,
    fontSize: '12px',
    border: '2px solid white',
    borderRadius: '8px',
    padding: 0,
  },
};

// Convert curriculum graph to React Flow format with skill-based hierarchical layout
function convertToReactFlowGraph(graph: PrerequisiteGraph): {
  nodes: Node[];
  edges: Edge[];
} {
  const reactFlowNodes: Node[] = [];

  // 1. Group all nodes by their Skill ID
  const nodesBySkill = new Map<string, PrerequisiteGraphNode[]>();
  graph.nodes.forEach((node) => {
    // We only want to position subskills in the columns
    if (node.type === 'subskill' && node.skill_id) {
      if (!nodesBySkill.has(node.skill_id)) {
        nodesBySkill.set(node.skill_id, []);
      }
      nodesBySkill.get(node.skill_id)!.push(node);
    }
  });

  // Get skill nodes separately to use as headers
  const skillNodes = graph.nodes.filter(n => n.type === 'skill');

  // 2. Sort the skills based on their `unit_order` then `skill_order` to create columns
  const sortedSkillIds = Array.from(nodesBySkill.keys()).sort((skillIdA, skillIdB) => {
    const nodeA = nodesBySkill.get(skillIdA)![0];
    const nodeB = nodesBySkill.get(skillIdB)![0];
    const unitOrderDiff = (nodeA.unit_order ?? 0) - (nodeB.unit_order ?? 0);
    if (unitOrderDiff !== 0) return unitOrderDiff;
    return (nodeA.skill_order ?? 0) - (nodeB.skill_order ?? 0);
  });

  // 3. Iterate through sorted skills to position nodes in columns
  sortedSkillIds.forEach((skillId, skillIndex) => {
    const subskills = nodesBySkill.get(skillId)!;

    // Sort subskills vertically by their order
    subskills.sort((a, b) => (a.subskill_order ?? 0) - (b.subskill_order ?? 0));

    // Add the Skill Header node
    const skillHeader = skillNodes.find(s => s.id === skillId);
    if (skillHeader) {
      reactFlowNodes.push({
        id: skillHeader.id,
        data: {
          label: (
            <div className="text-center">
              <div className="text-xs uppercase font-semibold opacity-80 mb-1">Skill</div>
              <div className="font-bold text-sm">{skillHeader.label}</div>
              {skillHeader.unit_title && (
                <div className="text-xs opacity-70 mt-1">{skillHeader.unit_title}</div>
              )}
            </div>
          ),
        },
        position: {
          x: skillIndex * SKILL_COLUMN_WIDTH,
          y: 0,
        },
        style: nodeStyles.skill,
        selectable: false, // Headers are not interactive
      });
    }

    // Add the Subskill nodes for this column
    subskills.forEach((subskill, subskillIndex) => {
      reactFlowNodes.push({
        id: subskill.id,
        data: {
          label: (
            <div className="p-2 text-center">
              <div className="text-xs uppercase font-semibold opacity-80 mb-1">Subskill</div>
              <div className="font-medium text-sm">{subskill.label}</div>
            </div>
          ),
        },
        position: {
          x: skillIndex * SKILL_COLUMN_WIDTH,
          y: SKILL_HEADER_HEIGHT + subskillIndex * SUBSKILL_NODE_HEIGHT,
        },
        style: nodeStyles.subskill,
      });
    });
  });

  // 4. Create edges
  const reactFlowEdges: Edge[] = graph.edges.map((edge) => ({
    id: edge.id || `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.threshold ? `${Math.round(edge.threshold * 100)}%` : undefined,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 600 },
    labelBgPadding: [4, 2] as [number, number],
    labelBgStyle: { fill: 'rgba(241, 245, 249, 0.7)' },
  }));

  return { nodes: reactFlowNodes, edges: reactFlowEdges };
}

function GraphVisualizationInner({ subjectId, includeDrafts = false }: GraphVisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<PrerequisiteGraph | null>(null);

  // Load graph data
  useEffect(() => {
    let mounted = true;

    const loadGraph = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const graph = await curriculumGraphAPI.getCachedGraph(subjectId, includeDrafts);

        if (!mounted) return;

        setGraphData(graph);
        const { nodes: flowNodes, edges: flowEdges } = convertToReactFlowGraph(graph);
        setNodes(flowNodes);
        setEdges(flowEdges);
      } catch (err) {
        if (!mounted) return;

        setError(err instanceof Error ? err.message : 'Failed to load graph');
        console.error('Failed to load graph:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadGraph();

    return () => {
      mounted = false;
    };
  }, [subjectId, includeDrafts, setNodes, setEdges]);

  const stats = useMemo(() => {
    if (!graphData) return null;

    const skillCount = graphData.nodes.filter(n => n.type === 'skill').length;
    const subskillCount = graphData.nodes.filter(n => n.type === 'subskill').length;

    return {
      skills: skillCount,
      subskills: subskillCount,
      total: graphData.nodes.length,
      edges: graphData.edges.length,
    };
  }, [graphData]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading graph...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <p className="font-medium">Failed to load graph</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[700px] flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Prerequisite Graph</CardTitle>
          </div>
          {stats && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{stats.skills} Skills</Badge>
              <Badge variant="secondary">{stats.subskills} Subskills</Badge>
              <Badge variant="outline">{stats.edges} Prerequisites</Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <div className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            nodesDraggable={false}
            attributionPosition="bottom-left"
            minZoom={0.1}
            maxZoom={2}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const style = node.style as any;
                return style?.background || '#ccc';
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
            <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3 space-y-2">
              <div className="text-xs font-medium text-gray-700">Legend</div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded" style={nodeStyles.skill}></div>
                <span>Skill (Header)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded" style={nodeStyles.subskill}></div>
                <span>Subskill</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Arrows show prerequisites
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}

export function GraphVisualization(props: GraphVisualizationProps) {
  return (
    <ReactFlowProvider>
      <GraphVisualizationInner {...props} />
    </ReactFlowProvider>
  );
}
