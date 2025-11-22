'use client';

import { useState, useEffect } from 'react';
import { useSubjects } from '@/lib/curriculum-authoring/hooks';
import { CurriculumTreeView } from '@/components/curriculum-designer/tree/CurriculumTreeView';
import { EntityEditor } from '@/components/curriculum-designer/editor/EntityEditor';
import { PrerequisitePanel } from '@/components/curriculum-designer/prerequisites/PrerequisitePanel';
import { DraftSummary } from '@/components/curriculum-designer/publishing/DraftSummary';
import { VersionHistory } from '@/components/curriculum-designer/publishing/VersionHistory';
import { GraphCachePanel } from '@/components/curriculum-designer/graph/GraphCachePanel';
import { AIUnitGenerator } from '@/components/curriculum-designer/ai/AIUnitGenerator';
import { ProblemGenerationPanel } from '@/components/curriculum-designer/problems';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Save, GitBranch, Sparkles, Database } from 'lucide-react';
import type { SelectedEntity } from '@/types/curriculum-authoring';

export default function CurriculumDesignerPage() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | undefined>();
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showPrerequisites, setShowPrerequisites] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'prerequisites' | 'problems' | 'drafts' | 'versions' | 'cache'>('editor');
  const [sidebarWidth, setSidebarWidth] = useState(384); // 384px = w-96
  const [isResizing, setIsResizing] = useState(false);

  const { data: subjects, isLoading: isLoadingSubjects } = useSubjects(true);

  const handleEntitySelect = (entity: SelectedEntity) => {
    setSelectedEntity(entity);
    setActiveTab('editor');
  };

  const handlePrerequisiteClick = () => {
    setActiveTab('prerequisites');
    setShowPrerequisites(true);
  };

  const handleAddUnit = () => {
    if (!selectedSubjectId) return;

    // Create a new unit entity for editing
    setSelectedEntity({
      type: 'unit',
      id: 'new',
      data: {
        unit_id: 'new',
        subject_id: selectedSubjectId,
        unit_title: '',
        unit_order: 0, // Will be determined by backend
        description: '',
        is_draft: true,
        version_id: '',
        created_at: '',
        updated_at: '',
      },
    });
    setActiveTab('editor');
  };

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  // Add mouse event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width, constrain between 240px and 800px
      const newWidth = Math.min(Math.max(e.clientX, 240), 800);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  if (isLoadingSubjects) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Curriculum Designer</h1>
            <p className="text-sm text-gray-500">Create and manage educational content</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAIGenerator(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              AI Generate
            </Button>

            {selectedSubjectId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('drafts')}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Drafts
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('versions')}
                >
                  <GitBranch className="mr-2 h-4 w-4" />
                  Versions
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('cache')}
                >
                  <Database className="mr-2 h-4 w-4" />
                  Cache
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Subject Selector */}
      <div className="border-b bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Subject:</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a subject...</option>
            {subjects?.map((subject) => (
              <option key={subject.subject_id} value={subject.subject_id}>
                {subject.subject_name} {subject.is_draft ? '(Draft)' : ''}
              </option>
            ))}
          </select>

          <Button size="sm" variant="ghost">
            <Plus className="mr-2 h-4 w-4" />
            New Subject
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {selectedSubjectId ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Curriculum Tree */}
          <div
            className="border-r bg-white overflow-y-auto relative"
            style={{ width: `${sidebarWidth}px` }}
          >
            <div className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Curriculum Structure</h2>
              <CurriculumTreeView
                subjectId={selectedSubjectId}
                selectedEntity={selectedEntity}
                onSelectEntity={handleEntitySelect}
                onAddUnit={handleAddUnit}
              />
            </div>

            {/* Resize Handle */}
            <div
              className="absolute top-0 right-0 w-4 h-full cursor-col-resize hover:bg-blue-500/20 transition-colors z-10"
              onMouseDown={handleMouseDown}
            >
              <div className="absolute right-0 top-0 h-full w-1 bg-gray-300 hover:bg-blue-500" />
            </div>
          </div>

          {/* Right Panel - Tabs */}
          <div className="flex-1 overflow-hidden">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
              <div className="border-b bg-white px-4">
                <TabsList className="h-12">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger
                    value="prerequisites"
                    disabled={!selectedEntity}
                  >
                    Prerequisites
                  </TabsTrigger>
                  <TabsTrigger
                    value="problems"
                    disabled={!selectedEntity || selectedEntity.type !== 'subskill'}
                  >
                    Practice Problems
                  </TabsTrigger>
                  <TabsTrigger value="drafts">Draft Changes</TabsTrigger>
                  <TabsTrigger value="versions">Version History</TabsTrigger>
                  <TabsTrigger value="cache">Graph Cache</TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <TabsContent value="editor" className="mt-0">
                  {selectedEntity ? (
                    <EntityEditor
                      entity={selectedEntity}
                      subjectId={selectedSubjectId}
                      onPrerequisiteClick={handlePrerequisiteClick}
                      onEntityDeleted={() => setSelectedEntity(undefined)}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center">
                      <p className="text-sm text-gray-500">Select an entity to edit</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="prerequisites" className="mt-0">
                  {selectedEntity ? (
                    <PrerequisitePanel
                      entityId={selectedEntity.id}
                      entityType={selectedEntity.type}
                      subjectId={selectedSubjectId}
                    />
                  ) : (
                    <div className="flex h-64 items-center justify-center">
                      <p className="text-sm text-gray-500">Select an entity to manage prerequisites</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="problems" className="mt-0">
                  {selectedEntity && selectedEntity.type === 'subskill' ? (
                    <ProblemGenerationPanel subskill={selectedEntity.data as any} />
                  ) : (
                    <div className="flex h-64 items-center justify-center">
                      <p className="text-sm text-gray-500">Select a subskill to generate practice problems</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="drafts" className="mt-0">
                  <DraftSummary subjectId={selectedSubjectId} />
                </TabsContent>

                <TabsContent value="versions" className="mt-0">
                  <VersionHistory subjectId={selectedSubjectId} />
                </TabsContent>

                <TabsContent value="cache" className="mt-0">
                  <GraphCachePanel subjectId={selectedSubjectId} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <Alert className="max-w-md">
            <AlertDescription>
              Select a subject from the dropdown above to begin editing curriculum content.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* AI Generator Dialog */}
      {showAIGenerator && selectedSubjectId && (
        <AIUnitGenerator
          subjectId={selectedSubjectId}
          open={showAIGenerator}
          onOpenChange={setShowAIGenerator}
        />
      )}
    </div>
  );
}
