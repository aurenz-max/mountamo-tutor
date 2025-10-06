'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubskillNode as SubskillNodeType, SelectedEntity } from '@/types/curriculum-authoring';

interface SubskillNodeProps {
  subskill: SubskillNodeType;
  skillId: string;
  selectedEntity?: SelectedEntity;
  onSelectEntity: (entity: SelectedEntity) => void;
}

export function SubskillNode({
  subskill,
  skillId,
  selectedEntity,
  onSelectEntity,
}: SubskillNodeProps) {
  const isSelected = selectedEntity?.type === 'subskill' && selectedEntity?.id === subskill.id;

  const handleSelect = () => {
    onSelectEntity({
      type: 'subskill',
      id: subskill.id,
      data: {
        subskill_id: subskill.id,
        skill_id: skillId,
        subskill_description: subskill.description,
        subskill_order: subskill.order,
        difficulty_start: subskill.difficulty_range?.start,
        difficulty_end: subskill.difficulty_range?.end,
        target_difficulty: subskill.difficulty_range?.target,
        is_draft: subskill.is_draft,
        version_id: '',
        created_at: '',
        updated_at: '',
      },
    });
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100 cursor-pointer text-sm',
        isSelected && 'bg-blue-50 hover:bg-blue-100'
      )}
      onClick={handleSelect}
    >
      <div className="h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-700 truncate">
            {subskill.description}
          </span>
          {subskill.is_draft && (
            <Badge variant="secondary" className="text-xs py-0 px-1">
              Draft
            </Badge>
          )}
        </div>

        {subskill.difficulty_range && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-gray-400">
              Difficulty: {subskill.difficulty_range.start ?? 0} - {subskill.difficulty_range.end ?? 10}
            </span>
            {subskill.difficulty_range.target && (
              <span className="text-xs text-gray-400">
                (target: {subskill.difficulty_range.target})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
