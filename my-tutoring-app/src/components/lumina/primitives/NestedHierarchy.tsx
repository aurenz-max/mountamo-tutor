import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Activity, Brain, Zap, GitCommit, Layers, Home } from 'lucide-react';
import { NestedHierarchyData, HierarchyNode } from '../types';

interface NestedHierarchyProps {
  data: NestedHierarchyData;
  className?: string;
}

// Icon mapping
const IconMap: Record<string, React.ComponentType<any>> = {
  activity: Activity,
  brain: Brain,
  zap: Zap,
  'git-commit': GitCommit,
  layers: Layers,
  home: Home
};

const NodeIcon: React.FC<{ iconName: string; className?: string }> = ({ iconName, className }) => {
  const Icon = IconMap[iconName] || Activity;
  return <Icon className={className} />;
};

// Recursive Tree Item Component
interface TreeItemProps {
  node: HierarchyNode;
  depth?: number;
  selectedId: string;
  expandedIds: Set<string>;
  onSelect: (node: HierarchyNode) => void;
  onToggle: (id: string) => void;
}

const TreeItem: React.FC<TreeItemProps> = ({
  node,
  depth = 0,
  selectedId,
  expandedIds,
  onSelect,
  onToggle
}) => {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  };

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center py-2 px-2 cursor-pointer transition-colors duration-150 rounded-md my-0.5
          ${isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-slate-100 text-slate-700'}
        `}
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        onClick={handleSelect}
      >
        {/* Toggle Button (or spacer) */}
        <div
          onClick={hasChildren ? handleToggle : undefined}
          className={`
            w-6 h-6 flex items-center justify-center mr-1 rounded-sm
            ${hasChildren ? 'hover:bg-black/5 text-slate-400 cursor-pointer' : 'invisible'}
          `}
        >
          {hasChildren && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>

        {/* Node Icon */}
        <NodeIcon iconName={node.icon} className={`w-4 h-4 mr-2 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />

        {/* Label */}
        <span className={`text-sm font-medium ${isSelected ? 'font-semibold' : ''}`}>
          {node.label}
        </span>
      </div>

      {/* Recursive Children Rendering */}
      {hasChildren && isExpanded && (
        <div className="border-l border-slate-200 ml-4">
            {node.children!.map((child) => (
            <TreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
            />
            ))}
        </div>
      )}
    </div>
  );
};

// Breadcrumb Generator helper
const getPathToNode = (root: HierarchyNode, targetId: string, currentPath: HierarchyNode[] = []): HierarchyNode[] | null => {
    if (root.id === targetId) return [...currentPath, root];

    if (root.children) {
        for (let child of root.children) {
            const path = getPathToNode(child, targetId, [...currentPath, root]);
            if (path) return path;
        }
    }
    return null;
};

// Main Primitive Component
const NestedHierarchy: React.FC<NestedHierarchyProps> = ({ data, className }) => {
  const [selectedNode, setSelectedNode] = useState<HierarchyNode>(data.root_node);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(data.defaultExpanded || [data.root_node.id])
  );

  const handleToggle = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const handleSelect = (node: HierarchyNode) => {
    setSelectedNode(node);
    // Optional: Auto-expand the selected node if it has children
    if (node.children && node.children.length > 0) {
        setExpandedIds(prev => new Set(prev).add(node.id));
    }
  };

  const breadcrumbs = getPathToNode(data.root_node, selectedNode.id) || [selectedNode];

  return (
    <div className={`flex flex-col bg-slate-50 font-sans text-slate-900 max-w-6xl mx-auto ${className || ''}`}>

      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center space-x-2 text-blue-600 mb-2">
            <Layers size={20} />
            <span className="text-sm font-bold uppercase tracking-wider">Educational Primitive: Hierarchy</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{data.title}</h1>
        {data.description && (
          <p className="text-slate-500 mt-2">{data.description}</p>
        )}
      </header>

      {/* Main Content Area - Split Pane */}
      <div className="flex-1 flex flex-col md:flex-row bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-h-[500px]">

        {/* Left Panel: The Tree (Structure) */}
        <div className="w-full md:w-1/3 border-r border-slate-200 flex flex-col bg-slate-50/50">
            <div className="p-4 bg-slate-100 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Components</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                <TreeItem
                    node={data.root_node}
                    selectedId={selectedNode.id}
                    expandedIds={expandedIds}
                    onSelect={handleSelect}
                    onToggle={handleToggle}
                />
            </div>
        </div>

        {/* Right Panel: The Details (Context) */}
        <div className="w-full md:w-2/3 flex flex-col bg-white">

            {/* Breadcrumbs */}
            <div className="p-6 border-b border-slate-100 flex items-center space-x-2 text-sm text-slate-400 overflow-x-auto whitespace-nowrap">
                {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.id}>
                        <span
                          className={index === breadcrumbs.length - 1 ? "text-slate-900 font-medium" : "hover:text-slate-600 cursor-pointer"}
                          onClick={() => handleSelect(crumb)}
                        >
                            {crumb.label}
                        </span>
                        {index < breadcrumbs.length - 1 && <ChevronRight size={14} />}
                    </React.Fragment>
                ))}
            </div>

            {/* Detail Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                        <NodeIcon iconName={selectedNode.icon} className="w-8 h-8" />
                    </div>
                    <div>
                        {selectedNode.type && (
                          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-1 rounded-full border border-blue-100">
                              {selectedNode.type}
                          </span>
                        )}
                        <h2 className="text-3xl font-bold text-slate-900 mt-1">{selectedNode.label}</h2>
                    </div>
                </div>

                <div className="prose prose-slate max-w-none">
                    <p className="text-lg leading-relaxed text-slate-700">
                        {selectedNode.description}
                    </p>
                </div>

                {/* Contextual Child Links (if any exist) */}
                {selectedNode.children && selectedNode.children.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-100">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Contains {selectedNode.children.length} Components:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedNode.children.map(child => (
                                <button
                                    key={child.id}
                                    onClick={() => handleSelect(child)}
                                    className="flex items-center p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                                >
                                    <div className="p-2 bg-slate-100 rounded-md text-slate-500 mr-3 group-hover:bg-blue-100 group-hover:text-blue-600">
                                        <NodeIcon iconName={child.icon} className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-slate-900">{child.label}</div>
                                        {child.type && <div className="text-xs text-slate-500">{child.type}</div>}
                                    </div>
                                    <ChevronRight className="ml-auto text-slate-300 group-hover:text-blue-400" size={16} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default NestedHierarchy;
