'use client';

/**
 * AI Foundations Editor
 * Main container component with tabs for Master Context, Context Primitives, and Visual Schemas
 */

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, Save, RotateCcw, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useFoundations,
  useGenerateFoundations,
  useSaveFoundations,
  useDeleteFoundations,
} from '@/lib/curriculum-authoring/foundations-hooks';
import type { FoundationsData, SaveFoundationsRequest } from '@/types/foundations';
import { MasterContextForm } from './MasterContextForm';
import { ContextPrimitivesForm } from './ContextPrimitivesForm';
import { VisualSchemaSelector } from './VisualSchemaSelector';

interface FoundationsEditorProps {
  subskillId: string;
  versionId?: string;
  subjectId: string;
  onClose?: () => void;
}

export function FoundationsEditor({
  subskillId,
  versionId = 'v1',
  subjectId,
  onClose,
}: FoundationsEditorProps) {
  const [activeTab, setActiveTab] = useState('master-context');
  const [editedData, setEditedData] = useState<SaveFoundationsRequest | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Queries and mutations
  const {
    data: foundations,
    isLoading,
    isError,
    error,
  } = useFoundations(subskillId, versionId);

  const generateMutation = useGenerateFoundations();
  const saveMutation = useSaveFoundations();
  const deleteMutation = useDeleteFoundations();

  // Initialize editedData when foundations load
  useEffect(() => {
    if (foundations && !editedData) {
      setEditedData({
        master_context: foundations.master_context,
        context_primitives: foundations.context_primitives,
        approved_visual_schemas: foundations.approved_visual_schemas,
      });
    }
  }, [foundations, editedData]);

  // Handle generate
  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({ subskillId, versionId });
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to generate foundations:', err);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!editedData) return;

    try {
      await saveMutation.mutateAsync({
        subskillId,
        data: editedData,
        versionId,
      });
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to save foundations:', err);
    }
  };

  // Handle reset (regenerate)
  const handleReset = async () => {
    if (!confirm('Are you sure you want to regenerate? All edits will be lost.')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ subskillId, versionId });
      await generateMutation.mutateAsync({ subskillId, versionId });
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to reset foundations:', err);
    }
  };

  // Handle data updates from child forms
  const handleMasterContextChange = (masterContext: FoundationsData['master_context']) => {
    setEditedData((prev) => ({
      master_context: masterContext,
      context_primitives: prev?.context_primitives || {} as any,
      approved_visual_schemas: prev?.approved_visual_schemas || [],
    }));
    setHasUnsavedChanges(true);
  };

  const handleContextPrimitivesChange = (contextPrimitives: FoundationsData['context_primitives']) => {
    setEditedData((prev) => ({
      master_context: prev?.master_context || {} as any,
      context_primitives: contextPrimitives,
      approved_visual_schemas: prev?.approved_visual_schemas || [],
    }));
    setHasUnsavedChanges(true);
  };

  const handleVisualSchemasChange = (schemas: string[]) => {
    setEditedData((prev) => ({
      master_context: prev?.master_context || {} as any,
      context_primitives: prev?.context_primitives || {} as any,
      approved_visual_schemas: schemas,
    }));
    setHasUnsavedChanges(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading foundations...</span>
      </div>
    );
  }

  // Error state (404 = no foundations yet)
  if (isError && (error as any)?.status === 404) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Foundations Yet</CardTitle>
          <CardDescription>
            Generate AI foundations to provide context for content generation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            size="lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating... (10-30 seconds)
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Foundations
              </>
            )}
          </Button>
          {generateMutation.isPending && (
            <p className="mt-2 text-sm text-muted-foreground">
              This may take 10-30 seconds. Please wait...
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Other errors
  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load foundations: {(error as Error)?.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    );
  }

  // Generating state
  if (generateMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="text-lg font-semibold">Generating AI Foundations</h3>
          <p className="text-sm text-muted-foreground">
            This may take 10-30 seconds. Please wait...
          </p>
        </div>
      </div>
    );
  }

  // Main editor UI
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">AI Foundations Editor</h2>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
          {foundations && (
            <Badge variant="outline">
              {foundations.generation_status === 'generated' && 'AI Generated'}
              {foundations.generation_status === 'edited' && 'Edited'}
              {foundations.generation_status === 'pending' && 'Pending'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={deleteMutation.isPending || generateMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to AI
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Success messages */}
      {saveMutation.isSuccess && (
        <Alert>
          <AlertDescription>Foundations saved successfully!</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="master-context">Master Context</TabsTrigger>
          <TabsTrigger value="context-primitives">Context Primitives</TabsTrigger>
          <TabsTrigger value="visual-schemas">Visual Schemas</TabsTrigger>
        </TabsList>

        <TabsContent value="master-context" className="space-y-4">
          {editedData && (
            <MasterContextForm
              data={editedData.master_context}
              onChange={handleMasterContextChange}
            />
          )}
        </TabsContent>

        <TabsContent value="context-primitives" className="space-y-4">
          {editedData && (
            <ContextPrimitivesForm
              data={editedData.context_primitives}
              onChange={handleContextPrimitivesChange}
              subjectId={subjectId}
            />
          )}
        </TabsContent>

        <TabsContent value="visual-schemas" className="space-y-4">
          {editedData && (
            <VisualSchemaSelector
              selectedSchemas={editedData.approved_visual_schemas}
              onChange={handleVisualSchemasChange}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
