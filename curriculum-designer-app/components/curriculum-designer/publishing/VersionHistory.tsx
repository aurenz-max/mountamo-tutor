'use client';

import { useState } from 'react';
import { useVersionHistory, useRollbackVersion, useDeployCurriculum, useDeployStatus } from '@/lib/curriculum-authoring/hooks';
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
import { Loader2, RotateCcw, CheckCircle, Clock, Upload } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Version } from '@/types/curriculum-authoring';

interface VersionHistoryProps {
  subjectId: string;
}

export function VersionHistory({ subjectId }: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  const {
    data: versions,
    isLoading,
    error,
  } = useVersionHistory(subjectId);

  const { data: deployStatus } = useDeployStatus(subjectId);
  const { mutate: rollbackVersion, isPending: isRollingBack } = useRollbackVersion();
  const { mutate: deployCurriculum, isPending: isDeploying } = useDeployCurriculum();

  const handleRollback = () => {
    if (!selectedVersion) return;

    rollbackVersion(
      {
        subjectId,
        versionId: selectedVersion.version_id,
      },
      {
        onSuccess: () => {
          setShowRollbackDialog(false);
          setSelectedVersion(null);
        },
      }
    );
  };

  const handleDeploy = () => {
    deployCurriculum(
      { subjectId },
      {
        onSuccess: (data) => {
          setShowDeployDialog(false);
          setDeploySuccess(
            `Deployed v${data.version_number} — ${data.stats.total_units} units, ${data.stats.total_skills} skills, ${data.stats.total_subskills} subskills`
          );
          setTimeout(() => setDeploySuccess(null), 6000);
        },
      }
    );
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
        <AlertDescription>Failed to load version history</AlertDescription>
      </Alert>
    );
  }

  const activeVersion = versions?.find((v) => v.is_active);

  return (
    <div className="space-y-6">
      {deploySuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{deploySuccess}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <p className="text-sm text-gray-500">
            Track and manage curriculum versions
          </p>
        </CardHeader>

        <CardContent>
          {!versions || versions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No version history</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.version_id}
                  className="flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50"
                >
                  <div className="flex-shrink-0 mt-1">
                    {version.is_active ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">
                        Version {version.version_number}
                      </h3>
                      {version.is_active && (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      )}
                      {version.is_active && deployStatus?.deployed && deployStatus.version_id === version.version_id && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          Deployed
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 mb-2">
                      {version.description}
                    </p>

                    {version.change_summary && (
                      <p className="text-xs text-gray-500 mb-2">
                        {version.change_summary}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>
                        Created {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                      </span>
                      <span>by {version.created_by}</span>
                      {version.activated_at && (
                        <span>
                          Activated {formatDistanceToNow(new Date(version.activated_at), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {version.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeployDialog(true)}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Deploy
                      </Button>
                    )}
                    {!version.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedVersion(version);
                          setShowRollbackDialog(true);
                        }}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deploy Confirmation Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy to Backend</DialogTitle>
            <DialogDescription>
              Push the active curriculum version to Firestore for the tutoring backend to use.
            </DialogDescription>
          </DialogHeader>

          {activeVersion && (
            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="font-semibold">
                Version {activeVersion.version_number}
              </h3>
              <p className="text-sm text-gray-700">{activeVersion.description}</p>
              {deployStatus?.deployed && (
                <p className="text-xs text-gray-500">
                  Currently deployed: v{deployStatus.version_number} ({deployStatus.deployed_at ? formatDistanceToNow(new Date(deployStatus.deployed_at), { addSuffix: true }) : 'unknown'})
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeployDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback to Previous Version</DialogTitle>
            <DialogDescription>
              This will revert the curriculum to the selected version
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="space-y-2 rounded-lg border p-4">
              <h3 className="font-semibold">
                Version {selectedVersion.version_number}
              </h3>
              <p className="text-sm text-gray-700">{selectedVersion.description}</p>
              <p className="text-xs text-gray-500">
                Created {formatDistanceToNow(new Date(selectedVersion.created_at), { addSuffix: true })}
              </p>
            </div>
          )}

          <Alert variant="destructive">
            <AlertDescription>
              Warning: This action cannot be undone. The current active version will be
              deactivated.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRollbackDialog(false);
                setSelectedVersion(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRollback}
              disabled={isRollingBack}
            >
              {isRollingBack ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rolling back...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Confirm Rollback
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
