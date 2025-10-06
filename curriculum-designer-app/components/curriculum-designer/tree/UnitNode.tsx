'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SkillNode } from './SkillNode';
import { cn } from '@/lib/utils';
import type { UnitNode as UnitNodeType, SelectedEntity } from '@/types/curriculum-authoring';

interface UnitNodeProps {
  unit: UnitNodeType;
  subjectId: string;
  selectedEntity?: SelectedEntity;
  onSelectEntity: (entity: SelectedEntity) => void;
}

export function UnitNode({
  unit,
  subjectId,
  selectedEntity,
  onSelectEntity,
}: UnitNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isSelected = selectedEntity?.type === 'unit' && selectedEntity?.id === unit.id;

  const handleSelect = () => {
    onSelectEntity({
      type: 'unit',
      id: unit.id,
      data: {
        unit_id: unit.id,
        subject_id: subjectId,
        unit_title: unit.title,
        unit_order: unit.order,
        description: unit.description,
        is_draft: unit.is_draft,
        version_id: '',
        created_at: '',
        updated_at: '',
      },
    });
  };

  return (
    <div className="space-y-1">
      {/* Unit Header */}
      <div
        className={cn(
          'group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100 cursor-pointer',
          isSelected && 'bg-blue-50 hover:bg-blue-100'
        )}
        onClick={handleSelect}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="flex-shrink-0 p-0.5 hover:bg-gray-200 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-600" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {unit.title}
            </span>
            {unit.is_draft && (
              <Badge variant="secondary" className="text-xs">
                Draft
              </Badge>
            )}
          </div>
          {unit.description && (
            <p className="text-xs text-gray-500 truncate">{unit.description}</p>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            // Handle add skill
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Skills */}
      {isExpanded && (
        <div className="ml-6 space-y-1 border-l-2 border-gray-200 pl-2">
          {unit.skills.length === 0 ? (
            <div className="py-2 text-xs text-gray-400">No skills</div>
          ) : (
            unit.skills.map((skill) => (
              <SkillNode
                key={skill.id}
                skill={skill}
                unitId={unit.id}
                selectedEntity={selectedEntity}
                onSelectEntity={onSelectEntity}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
