'use client';

import { useEntityPrerequisites, useDeletePrerequisite, useCurriculumTree, useCreatePrerequisite } from '@/lib/curriculum-authoring/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Trash2, ArrowRight, ArrowLeft, Zap, Check, AlertCircle } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { AddPrerequisiteDialog } from './AddPrerequisiteDialog';
import { GraphCachePanel } from '../graph/GraphCachePanel';
import { GraphVisualization } from '../graph/GraphVisualization';
import type { EntityType, PrerequisiteCreate } from '@/types/curriculum-authoring';

interface PrerequisitePanelProps {
  entityId: string;
  entityType: EntityType;
  subjectId: string;
}

export function PrerequisitePanel({
  entityId,
  entityType,
  subjectId,
}: PrerequisitePanelProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [quickAddThreshold, setQuickAddThreshold] = useState(0.8);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Only fetch prerequisites for skills and subskills (units don't have prerequisites)
  const shouldFetchPrerequisites = entityType === 'skill' || entityType === 'subskill';

  const {
    data: prerequisites,
    isLoading,
    error,
  } = useEntityPrerequisites(entityId, entityType, true, {
    enabled: shouldFetchPrerequisites,
  });

  const { mutate: deletePrerequisite } = useDeletePrerequisite();
  const { mutate: createPrerequisite, isPending: isCreatingQuickAdd } = useCreatePrerequisite();

  // Fetch curriculum tree to find previous subskill
  const { data: curriculumTree } = useCurriculumTree(subjectId, true);

  // Find previous subskill if current entity is a subskill
  const previousSubskill = useMemo(() => {
    if (entityType !== 'subskill' || !curriculumTree) return null;

    // Find current subskill in the tree to get its skill_id and order
    for (const unit of curriculumTree.units) {
      for (const skill of unit.skills) {
        for (const subskill of skill.subskills) {
          if (subskill.id === entityId) {
            // Found current subskill, now find the previous one
            const currentOrder = subskill.order;
            if (currentOrder === 0) return null; // No previous subskill

            // Find subskill with order = currentOrder - 1 in the same skill
            const prevSubskill = skill.subskills.find(
              s => s.order === currentOrder - 1
            );
            return prevSubskill || null;
          }
        }
      }
    }
    return null;
  }, [entityType, entityId, curriculumTree]);

  // Handler for quick-add previous subskill
  const handleQuickAddPreviousSubskill = () => {
    if (!previousSubskill) return;

    // Clear previous messages
    setQuickAddSuccess(false);
    setQuickAddError(null);

    const prerequisiteData: PrerequisiteCreate = {
      prerequisite_entity_id: previousSubskill.id,
      prerequisite_entity_type: 'subskill',
      unlocks_entity_id: entityId,
      unlocks_entity_type: 'subskill',
      min_proficiency_threshold: quickAddThreshold,
    };

    createPrerequisite(prerequisiteData, {
      onSuccess: () => {
        setQuickAddSuccess(true);
        // Auto-hide success message after 3 seconds
        setTimeout(() => setQuickAddSuccess(false), 3000);
      },
      onError: (error: any) => {
        setQuickAddError(error.message || 'An error occurred while creating the prerequisite.');
      },
    });
  };

  // Show info message for units
  if (entityType === 'unit') {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Prerequisites are defined at the skill and subskill level. Units organize skills but don't have their own prerequisites.
            Select a skill or subskill to manage its prerequisites.
          </AlertDescription>
        </Alert>

        {/* Still show graph cache panel for units */}
        <GraphCachePanel subjectId={subjectId} />

        {/* Graph Visualization */}
        <GraphVisualization subjectId={subjectId} includeDrafts={true} />
      </div>
    );
  }

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
        <AlertDescription>Failed to load prerequisites</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Add Success/Error Messages */}
      {quickAddSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Successfully added prerequisite to previous subskill!
          </AlertDescription>
        </Alert>
      )}

      {quickAddError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{quickAddError}</AlertDescription>
        </Alert>
      )}

      {/* Prerequisites (what this needs) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-lg">Prerequisites</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {/* Quick Add Previous Subskill Button */}
              {previousSubskill && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleQuickAddPreviousSubskill}
                    disabled={isCreatingQuickAdd}
                  >
                    {isCreatingQuickAdd ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    Quick Add: Previous Subskill
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={quickAddThreshold}
                    onChange={(e) => setQuickAddThreshold(parseFloat(e.target.value) || 0.8)}
                    className="w-20"
                    disabled={isCreatingQuickAdd}
                  />
                </div>
              )}
              <Button size="sm" onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-500">
            Skills that must be mastered before this one
          </p>
        </CardHeader>
        <CardContent>
          {prerequisites?.prerequisites.length === 0 ? (
            <p className="text-sm text-gray-400">No prerequisites defined</p>
          ) : (
            <div className="space-y-2">
              {prerequisites?.prerequisites.map((prereq) => (
                <div
                  key={prereq.prerequisite_id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {prereq.prerequisite_entity_type}
                      </Badge>
                      <code className="text-sm">{prereq.prerequisite_entity_id}</code>
                      {prereq.is_draft && (
                        <Badge variant="secondary" className="text-xs">
                          Draft
                        </Badge>
                      )}
                    </div>
                    {prereq.min_proficiency_threshold !== undefined && (
                      <p className="mt-1 text-xs text-gray-500">
                        Min proficiency: {(prereq.min_proficiency_threshold * 100).toFixed(0)}%
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => deletePrerequisite(prereq.prerequisite_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unlocks (what this leads to) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
            <CardTitle className="text-lg">Unlocks</CardTitle>
          </div>
          <p className="text-sm text-gray-500">
            Skills that become available after mastering this one
          </p>
        </CardHeader>
        <CardContent>
          {prerequisites?.unlocks.length === 0 ? (
            <p className="text-sm text-gray-400">No unlocked skills defined</p>
          ) : (
            <div className="space-y-2">
              {prerequisites?.unlocks.map((unlock) => (
                <div
                  key={unlock.prerequisite_id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {unlock.unlocks_entity_type}
                      </Badge>
                      <code className="text-sm">{unlock.unlocks_entity_id}</code>
                      {unlock.is_draft && (
                        <Badge variant="secondary" className="text-xs">
                          Draft
                        </Badge>
                      )}
                    </div>
                    {unlock.min_proficiency_threshold !== undefined && (
                      <p className="mt-1 text-xs text-gray-500">
                        Requires: {(unlock.min_proficiency_threshold * 100).toFixed(0)}% proficiency
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graph Cache Management */}
      <GraphCachePanel subjectId={subjectId} />

      {/* Graph Visualization */}
      <GraphVisualization subjectId={subjectId} includeDrafts={true} />

      {/* Add Prerequisite Dialog */}
      <AddPrerequisiteDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        entityId={entityId}
        entityType={entityType}
        subjectId={subjectId}
      />
    </div>
  );
}
