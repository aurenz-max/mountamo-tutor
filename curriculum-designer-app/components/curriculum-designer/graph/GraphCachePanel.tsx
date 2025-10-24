'use client';

import { useGraphStatus, useRegenerateGraph, useRegenerateAllGraphs, useInvalidateGraphCache } from '@/lib/curriculum-authoring/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, Trash2, Database, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';

interface GraphCachePanelProps {
  subjectId: string;
}

export function GraphCachePanel({ subjectId }: GraphCachePanelProps) {
  const { data: graphStatus, isLoading, error } = useGraphStatus(subjectId);
  const regenerateGraph = useRegenerateGraph();
  const regenerateAllGraphs = useRegenerateAllGraphs();
  const invalidateCache = useInvalidateGraphCache();

  const [showDetails, setShowDetails] = useState(false);

  const handleRegenerateDraft = () => {
    regenerateGraph.mutate({ subjectId, includeDrafts: true });
  };

  const handleRegeneratePublished = () => {
    regenerateGraph.mutate({ subjectId, includeDrafts: false });
  };

  const handleRegenerateAll = () => {
    regenerateAllGraphs.mutate(subjectId);
  };

  const handleInvalidateCache = (versionType?: 'draft' | 'published') => {
    invalidateCache.mutate({ subjectId, versionType });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-4">
          <Alert variant="destructive">
            <AlertDescription>Failed to load graph cache status</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasDraft = graphStatus?.has_draft;
  const hasPublished = graphStatus?.has_published;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Graph Cache (Firestore)</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide' : 'Show'} Details
            </Button>
            <Button
              size="sm"
              onClick={handleRegenerateAll}
              disabled={regenerateAllGraphs.isPending}
            >
              {regenerateAllGraphs.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate All
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Cached prerequisite graphs for fast loading (~50ms vs 2-5s)
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cache Status Overview */}
        <div className="grid grid-cols-2 gap-4">
          {/* Draft Cache Status */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={hasDraft ? "default" : "secondary"}>
                  Draft
                </Badge>
                {hasDraft ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRegenerateDraft}
                  disabled={regenerateGraph.isPending}
                  title="Regenerate draft graph"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                {hasDraft && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleInvalidateCache('draft')}
                    disabled={invalidateCache.isPending}
                    title="Clear draft cache"
                  >
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600">
              {hasDraft ? 'Cached' : 'Not cached'}
            </p>
          </div>

          {/* Published Cache Status */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={hasPublished ? "default" : "secondary"}>
                  Published
                </Badge>
                {hasPublished ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleRegeneratePublished}
                  disabled={regenerateGraph.isPending}
                  title="Regenerate published graph"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                {hasPublished && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleInvalidateCache('published')}
                    disabled={invalidateCache.isPending}
                    title="Clear published cache"
                  >
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600">
              {hasPublished ? 'Cached' : 'Not cached'}
            </p>
          </div>
        </div>

        {/* Total cached count */}
        {graphStatus && graphStatus.total_cached > 0 && (
          <div className="text-sm text-gray-600">
            <strong>{graphStatus.total_cached}</strong> graph version{graphStatus.total_cached !== 1 ? 's' : ''} cached
          </div>
        )}

        {/* Detailed Cache Information */}
        {showDetails && graphStatus && graphStatus.cached_versions && graphStatus.cached_versions.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium text-gray-700">Cached Versions</h4>
            {graphStatus.cached_versions.map((version, idx) => (
              <div key={idx} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={version.version_type === 'draft' ? 'secondary' : 'default'}>
                      {version.version_type}
                    </Badge>
                    <code className="text-xs text-gray-600">{version.version_id}</code>
                  </div>
                </div>

                {version.metadata && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Skills:</span>{' '}
                      <span className="font-medium">{version.metadata.entity_counts?.skills || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Subskills:</span>{' '}
                      <span className="font-medium">{version.metadata.entity_counts?.subskills || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total nodes:</span>{' '}
                      <span className="font-medium">{version.metadata.entity_counts?.total || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Edges:</span>{' '}
                      <span className="font-medium">{version.metadata.edge_count || 0}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Generated:</span>
                    <span>{formatDate(version.generated_at)}</span>
                  </div>
                </div>

                {version.last_accessed && (
                  <div className="text-xs text-gray-500">
                    Last accessed: {formatDate(version.last_accessed)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* No cache message */}
        {graphStatus && graphStatus.total_cached === 0 && (
          <Alert>
            <AlertDescription>
              No cached graphs found. Click "Regenerate All" to create cached versions for faster loading.
            </AlertDescription>
          </Alert>
        )}

        {/* Operation status */}
        {regenerateGraph.isSuccess && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Graph regenerated successfully!</AlertDescription>
          </Alert>
        )}

        {regenerateAllGraphs.isSuccess && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>All graph versions regenerated successfully!</AlertDescription>
          </Alert>
        )}

        {invalidateCache.isSuccess && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Cache invalidated successfully!</AlertDescription>
          </Alert>
        )}

        {(regenerateGraph.isError || regenerateAllGraphs.isError || invalidateCache.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              Operation failed. Please try again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
