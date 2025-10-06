'use client';

import { useState } from 'react';
import { useDraftChanges, usePublishSubject } from '@/lib/curriculum-authoring/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Save, FileText, Plus, Edit, Trash } from 'lucide-react';

interface DraftSummaryProps {
  subjectId: string;
}

export function DraftSummary({ subjectId }: DraftSummaryProps) {
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [versionDescription, setVersionDescription] = useState('');
  const [changeSummary, setChangeSummary] = useState('');

  const {
    data: drafts,
    isLoading,
    error,
  } = useDraftChanges(subjectId);

  const { mutate: publishSubject, isPending: isPublishing } = usePublishSubject();

  const handlePublish = () => {
    if (!versionDescription || !changeSummary) return;

    publishSubject(
      {
        subjectId,
        request: {
          subject_id: subjectId,
          version_description: versionDescription,
          change_summary: changeSummary,
        },
      },
      {
        onSuccess: () => {
          setShowPublishDialog(false);
          setVersionDescription('');
          setChangeSummary('');
        },
      }
    );
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'create':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'update':
        return <Edit className="h-4 w-4 text-blue-600" />;
      case 'delete':
        return <Trash className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

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
        <AlertDescription>Failed to load draft changes</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Draft Changes</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                Review pending changes before publishing
              </p>
            </div>
            <Button
              onClick={() => setShowPublishDialog(true)}
              disabled={!drafts || drafts.total_changes === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              Publish
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {!drafts || drafts.total_changes === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No draft changes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="flex gap-4 rounded-lg bg-gray-50 p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {drafts.created_count}
                  </p>
                  <p className="text-xs text-gray-600">Created</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {drafts.updated_count}
                  </p>
                  <p className="text-xs text-gray-600">Updated</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {drafts.deleted_count}
                  </p>
                  <p className="text-xs text-gray-600">Deleted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {drafts.prerequisite_changes}
                  </p>
                  <p className="text-xs text-gray-600">Prerequisites</p>
                </div>
              </div>

              {/* Changes List */}
              <div className="space-y-2">
                {drafts.changes.map((change, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    {getChangeIcon(change.change_type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {change.entity_type}
                        </Badge>
                        <Badge
                          variant={
                            change.change_type === 'create'
                              ? 'default'
                              : change.change_type === 'update'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="text-xs"
                        >
                          {change.change_type}
                        </Badge>
                        {change.is_prerequisite && (
                          <Badge variant="outline" className="text-xs">
                            Prerequisite
                          </Badge>
                        )}
                      </div>
                      <code className="text-sm">{change.entity_id}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Changes</DialogTitle>
            <DialogDescription>
              Create a new version with all draft changes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version_description">Version Description</Label>
              <Input
                id="version_description"
                placeholder="e.g., Added new counting units"
                value={versionDescription}
                onChange={(e) => setVersionDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="change_summary">Change Summary</Label>
              <Textarea
                id="change_summary"
                rows={3}
                placeholder="e.g., 5 new units, 20 new skills"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
              />
            </div>

            {drafts && (
              <Alert>
                <AlertDescription>
                  Publishing {drafts.total_changes} changes:{' '}
                  {drafts.created_count} created, {drafts.updated_count} updated,{' '}
                  {drafts.deleted_count} deleted
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!versionDescription || !changeSummary || isPublishing}
            >
              {isPublishing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Publish
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
