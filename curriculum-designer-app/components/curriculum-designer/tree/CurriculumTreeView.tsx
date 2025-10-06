'use client';

import { useCurriculumTree } from '@/lib/curriculum-authoring/hooks';
import { UnitNode } from './UnitNode';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SelectedEntity } from '@/types/curriculum-authoring';

interface CurriculumTreeViewProps {
  subjectId: string;
  selectedEntity?: SelectedEntity;
  onSelectEntity: (entity: SelectedEntity) => void;
}

export function CurriculumTreeView({
  subjectId,
  selectedEntity,
  onSelectEntity,
}: CurriculumTreeViewProps) {
  const {
    data: tree,
    isLoading,
    error,
    refetch,
  } = useCurriculumTree(subjectId, true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load curriculum tree. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (!tree) {
    return (
      <Alert>
        <AlertDescription>No curriculum data found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {/* Subject Header */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900">{tree.subject_name}</h3>
          {tree.grade_level && (
            <p className="text-xs text-blue-600">{tree.grade_level}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="h-7 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Units List */}
      <div className="space-y-1">
        {tree.units.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center">
            <p className="text-sm text-gray-500">No units yet</p>
            <Button size="sm" variant="link" className="mt-2">
              <Plus className="mr-1 h-3 w-3" />
              Add your first unit
            </Button>
          </div>
        ) : (
          tree.units.map((unit) => (
            <UnitNode
              key={unit.id}
              unit={unit}
              subjectId={subjectId}
              selectedEntity={selectedEntity}
              onSelectEntity={onSelectEntity}
            />
          ))
        )}
      </div>
    </div>
  );
}
