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
import { Loader2, RotateCcw, CheckCircle, Clock, Upload, Cloud, AlertTriangle, Database } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import type { Version } from '@/types/curriculum-authoring';

interface VersionHistoryProps {
  subjectId: string;
  grade: string;
}

export function VersionHistory({ subjectId, grade }: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  const {
    data: versions,
    isLoading,
    error,
  } = useVersionHistory(subjectId, grade);

  const { data: deployStatus } = useDeployStatus(subjectId);
  const { mutate: rollbackVersion, isPending: isRollingBack } = useRollbackVersion();
  const { mutate: deployCurriculum, isPending: isDeploying } = useDeployCurriculum();

  const handleRollback = () => {
    if (!selectedVersion) return;

    rollbackVersion(
      {
        subjectId,
        versionId: selectedVersion.version_id,
        grade,
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
  const isDeployStale = deployStatus?.deployed &&
    activeVersion &&
    deployStatus.version_id !== activeVersion.version_id;

  return (
    <div className="space-y-6">
      {deploySuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{deploySuccess}</AlertDescription>
        </Alert>
      )}

      {/* Firestore Deployment Status Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">Firestore Deployment</CardTitle>
          </div>
          <p className="text-sm text-gray-500">
            What the tutoring backend is currently serving
          </p>
        </CardHeader>
        <CardContent>
          {!deployStatus || !deployStatus.deployed ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
              <Database className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-600">Not deployed</p>
                <p className="text-xs text-gray-400">No curriculum has been deployed to Firestore for this subject</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {isDeployStale && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">Deployment out of sync</p>
                    <p className="text-xs text-amber-700">
                      Firestore has v{deployStatus.version_number} but v{activeVersion?.version_number} is active.
                      Deploy to push the latest version.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deployed Version</p>
                  <p className="text-lg font-semibold mt-0.5">v{deployStatus.version_number}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deployed At</p>
                  <p className="text-sm font-medium mt-1">
                    {deployStatus.deployed_at
                      ? format(new Date(deployStatus.deployed_at), 'MMM d, yyyy h:mm a')
                      : 'Unknown'}
                  </p>
                  {deployStatus.deployed_at && (
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(deployStatus.deployed_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
                {deployStatus.grade && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Grade</p>
                    <p className="text-sm font-medium mt-1">{deployStatus.grade}</p>
                  </div>
                )}
                {deployStatus.deployed_by && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Deployed By</p>
                    <p className="text-sm font-medium mt-1">{deployStatus.deployed_by}</p>
                  </div>
                )}
                {deployStatus.stats && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Content Stats</p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-700">
                        <span className="font-medium">{deployStatus.stats.total_units}</span> units
                      </span>
                      <span className="text-gray-700">
                        <span className="font-medium">{deployStatus.stats.total_skills}</span> skills
                      </span>
                      <span className="text-gray-700">
                        <span className="font-medium">{deployStatus.stats.total_subskills}</span> subskills
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <span className="font-mono truncate max-w-[250px]" title={deployStatus.version_id}>
                  ID: {deployStatus.version_id}
                </span>
                <span>
                  Collection: curriculum_published / {deployStatus.grade || '?'} / subjects / {subjectId}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
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
              {versions.map((version) => {
                const isDeployed = deployStatus?.deployed &&
                  deployStatus.version_id === version.version_id;

                return (
                  <div
                    key={version.version_id}
                    className={`flex items-start gap-3 rounded-lg border p-4 hover:bg-gray-50 ${
                      isDeployed ? 'border-blue-200 bg-blue-50/30' : ''
                    }`}
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
                        {isDeployed && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-300 bg-blue-50">
                            <Cloud className="mr-1 h-3 w-3" />
                            In Firestore
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
                        {isDeployed && deployStatus?.deployed_at && (
                          <span className="text-blue-600">
                            Deployed {formatDistanceToNow(new Date(deployStatus.deployed_at), { addSuffix: true })}
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deploy Confirmation Dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy to Firestore</DialogTitle>
            <DialogDescription>
              Push the active curriculum version to Firestore for the tutoring backend to use.
            </DialogDescription>
          </DialogHeader>

          {activeVersion && (
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border p-4">
                <h3 className="font-semibold">
                  Version {activeVersion.version_number}
                </h3>
                <p className="text-sm text-gray-700">{activeVersion.description}</p>
              </div>

              {deployStatus?.deployed && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                  <p className="font-medium text-gray-700 mb-1">Currently in Firestore:</p>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>Version {deployStatus.version_number} &middot; deployed {deployStatus.deployed_at ? formatDistanceToNow(new Date(deployStatus.deployed_at), { addSuffix: true }) : 'unknown'}</p>
                    {deployStatus.stats && (
                      <p>{deployStatus.stats.total_units} units, {deployStatus.stats.total_skills} skills, {deployStatus.stats.total_subskills} subskills</p>
                    )}
                  </div>
                </div>
              )}

              {isDeployStale && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    This will replace v{deployStatus?.version_number} with v{activeVersion.version_number} in Firestore.
                  </p>
                </div>
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
                  Deploy to Firestore
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
