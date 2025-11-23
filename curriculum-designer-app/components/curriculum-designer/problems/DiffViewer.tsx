'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DiffResult } from '@/types/problems';

interface DiffViewerProps {
  diff: DiffResult;
  originalText: string;
  improvedText: string;
  showSideBySide?: boolean;
}

export function DiffViewer({
  diff,
  originalText,
  improvedText,
  showSideBySide = false
}: DiffViewerProps) {
  const renderUnifiedDiff = () => {
    if (!diff.has_changes) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          No changes detected
        </div>
      );
    }

    return (
      <div className="font-mono text-xs">
        {diff.unified_diff.split('\n').map((line, index) => {
          let className = 'px-2 py-0.5';
          let prefix = '';

          if (line.startsWith('+++') || line.startsWith('---')) {
            className += ' font-bold text-muted-foreground';
          } else if (line.startsWith('@@')) {
            className += ' bg-blue-100 text-blue-700 font-medium';
          } else if (line.startsWith('+')) {
            className += ' bg-green-50 text-green-700';
            prefix = '+';
          } else if (line.startsWith('-')) {
            className += ' bg-red-50 text-red-700';
            prefix = '-';
          } else {
            className += ' text-muted-foreground';
            prefix = ' ';
          }

          return (
            <div key={index} className={className}>
              <span className="select-none opacity-50 mr-2">{prefix}</span>
              {line.substring(1)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSideBySide = () => {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="bg-red-50 border-b border-red-200 px-3 py-2">
            <span className="text-sm font-medium text-red-700">Original</span>
          </div>
          <div className="p-3">
            <pre className="text-xs whitespace-pre-wrap break-words">
              {originalText}
            </pre>
          </div>
        </div>
        <div>
          <div className="bg-green-50 border-b border-green-200 px-3 py-2">
            <span className="text-sm font-medium text-green-700">Improved</span>
          </div>
          <div className="p-3">
            <pre className="text-xs whitespace-pre-wrap break-words">
              {improvedText}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  const renderChangeHunks = () => {
    if (!diff.changes || diff.changes.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          No change hunks available
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {diff.changes.map((hunk, index) => (
          <Card key={index}>
            <CardHeader className="py-2 px-3 bg-muted/50">
              <code className="text-xs text-blue-600">{hunk.header}</code>
            </CardHeader>
            <CardContent className="p-0">
              <div className="font-mono text-xs">
                {/* Context before */}
                {hunk.context.map((line, i) => (
                  <div key={`context-${i}`} className="px-3 py-0.5 text-muted-foreground">
                    <span className="select-none opacity-50 mr-2"> </span>
                    {line}
                  </div>
                ))}

                {/* Removals */}
                {hunk.removals.map((line, i) => (
                  <div key={`removal-${i}`} className="px-3 py-0.5 bg-red-50 text-red-700">
                    <span className="select-none opacity-50 mr-2">-</span>
                    {line}
                  </div>
                ))}

                {/* Additions */}
                {hunk.additions.map((line, i) => (
                  <div key={`addition-${i}`} className="px-3 py-0.5 bg-green-50 text-green-700">
                    <span className="select-none opacity-50 mr-2">+</span>
                    {line}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {diff.stats.total_hunks} change{diff.stats.total_hunks !== 1 ? 's' : ''}
        </Badge>
        {diff.stats.total_additions > 0 && (
          <Badge variant="default" className="text-xs bg-green-500">
            +{diff.stats.total_additions} additions
          </Badge>
        )}
        {diff.stats.total_removals > 0 && (
          <Badge variant="destructive" className="text-xs">
            -{diff.stats.total_removals} removals
          </Badge>
        )}
      </div>

      {/* Diff Display */}
      <Tabs defaultValue="unified" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="unified">Unified Diff</TabsTrigger>
          <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
          <TabsTrigger value="hunks">Change Hunks</TabsTrigger>
        </TabsList>

        <TabsContent value="unified" className="mt-3">
          <Card>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {renderUnifiedDiff()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="side-by-side" className="mt-3">
          <Card>
            <CardContent className="p-0 max-h-96 overflow-y-auto">
              {renderSideBySide()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hunks" className="mt-3">
          <div className="max-h-96 overflow-y-auto">
            {renderChangeHunks()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
