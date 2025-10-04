'use client';

import React from 'react';

interface TreeNode {
  label: string;
  icon?: string;
  children?: TreeNode[];
}

interface TreeDiagramData {
  root: TreeNode;
}

interface TreeDiagramProps {
  data: TreeDiagramData;
  className?: string;
}

/**
 * TreeDiagram - Renders hierarchical tree structures
 * Used for taxonomy, classification, food chains, organizational charts
 * Matches backend TREE_DIAGRAM_SCHEMA
 */
export const TreeDiagram: React.FC<TreeDiagramProps> = ({ data, className = '' }) => {
  const { root } = data;

  if (!root) {
    return null;
  }

  const renderNode = (node: TreeNode, level: number = 0): JSX.Element => {
    const hasChildren = node.children && node.children.length > 0;
    const colors = [
      'bg-purple-100 border-purple-400 text-purple-900',
      'bg-blue-100 border-blue-400 text-blue-900',
      'bg-green-100 border-green-400 text-green-900',
      'bg-yellow-100 border-yellow-400 text-yellow-900',
    ];
    const colorClass = colors[level % colors.length];

    return (
      <div className="flex flex-col items-center" key={`${node.label}-${level}`}>
        {/* Node box */}
        <div
          className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm min-w-[120px] text-center ${colorClass}`}
        >
          {node.icon && (
            <span className="text-2xl block mb-1" role="img" aria-label={node.label}>
              {node.icon}
            </span>
          )}
          {node.label}
        </div>

        {/* Children */}
        {hasChildren && (
          <>
            {/* Vertical line down */}
            <div className="w-0.5 h-6 bg-gray-400" />

            {/* Horizontal connector line */}
            <div className="relative w-full">
              {node.children!.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-gray-400"
                  style={{
                    left: `calc(${100 / node.children!.length / 2}%)`,
                    right: `calc(${100 / node.children!.length / 2}%)`,
                  }}
                />
              )}

              {/* Child nodes in a row */}
              <div className="flex justify-center gap-8 mt-0">
                {node.children!.map((child, index) => (
                  <div key={index} className="flex flex-col items-center">
                    {/* Vertical line to child */}
                    <div className="w-0.5 h-6 bg-gray-400" />
                    {renderNode(child, level + 1)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`tree-diagram p-6 overflow-x-auto ${className}`}>
      <div className="inline-block min-w-full">
        {renderNode(root)}
      </div>
    </div>
  );
};

export default TreeDiagram;
