'use client';

import { useEntityPrerequisites, useDeletePrerequisite } from '@/lib/curriculum-authoring/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { AddPrerequisiteDialog } from './AddPrerequisiteDialog';
import { GraphCachePanel } from '../graph/GraphCachePanel';
import { GraphVisualization } from '../graph/GraphVisualization';
import type { EntityType } from '@/types/curriculum-authoring';

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
      {/* Prerequisites (what this needs) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-gray-500" />
              <CardTitle className="text-lg">Prerequisites</CardTitle>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
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
