'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubskillNode } from './SubskillNode';
import { cn } from '@/lib/utils';
import type { SkillNode as SkillNodeType, SelectedEntity } from '@/types/curriculum-authoring';

interface SkillNodeProps {
  skill: SkillNodeType;
  unitId: string;
  selectedEntity?: SelectedEntity;
  onSelectEntity: (entity: SelectedEntity) => void;
  onAddSubskill?: (skillId: string) => void;
}

export function SkillNode({
  skill,
  unitId,
  selectedEntity,
  onSelectEntity,
  onAddSubskill,
}: SkillNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isSelected = selectedEntity?.type === 'skill' && selectedEntity?.id === skill.id;

  const handleSelect = () => {
    onSelectEntity({
      type: 'skill',
      id: skill.id,
      data: {
        skill_id: skill.id,
        unit_id: unitId,
        skill_description: skill.description,
        skill_order: skill.order,
        is_draft: skill.is_draft,
        version_id: '',
        created_at: '',
        updated_at: '',
      },
    });
  };

  return (
    <div className="space-y-1">
      {/* Skill Header */}
      <div
        className={cn(
          'group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100 cursor-pointer text-sm',
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
          {skill.subskills.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-gray-600" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-600" />
            )
          ) : (
            <div className="h-3 w-3" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-800 truncate">
              {skill.description}
            </span>
            {skill.is_draft && (
              <Badge variant="secondary" className="text-xs py-0">
                Draft
              </Badge>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onAddSubskill?.(skill.id);
          }}
          title="Add Subskill"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Subskills */}
      {isExpanded && skill.subskills.length > 0 && (
        <div className="ml-5 space-y-0.5 border-l-2 border-gray-200 pl-2">
          {skill.subskills.map((subskill) => (
            <SubskillNode
              key={subskill.id}
              subskill={subskill}
              skillId={skill.id}
              selectedEntity={selectedEntity}
              onSelectEntity={onSelectEntity}
            />
          ))}
        </div>
      )}
    </div>
  );
}
