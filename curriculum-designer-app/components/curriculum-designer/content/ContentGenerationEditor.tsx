'use client';

/**
 * ContentGenerationEditor Component
 * Main container for generating and editing reading content
 * Follows the same pattern as FoundationsEditor
 */

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, FileText, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useContent,
  useGenerateContent,
} from '@/lib/curriculum-authoring/content-hooks';
import { SectionCard } from './SectionCard';
import { SectionEditor } from './SectionEditor';
import { VisualSnippetModal } from './VisualSnippetModal';
import type { ReadingSection } from '@/types/content';

interface ContentGenerationEditorProps {
  subskillId: string;
  versionId?: string;
  subjectId: string;
  onClose?: () => void;
}

export function ContentGenerationEditor({
  subskillId,
  versionId = 'v1',
  subjectId,
  onClose,
}: ContentGenerationEditorProps) {
  const [editingSection, setEditingSection] = useState<ReadingSection | null>(null);
  const [visualSection, setVisualSection] = useState<ReadingSection | null>(null);

  // Queries and mutations
  const {
    data: content,
    isLoading,
    isError,
    error,
  } = useContent(subskillId, versionId);

  const generateMutation = useGenerateContent();

  // Handle generate
  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        subskillId,
        versionId,
        useFoundations: true,
      });
    } catch (err) {
      console.error('Failed to generate content:', err);
    }
  };

  // Handle reset (regenerate all)
  const handleReset = async () => {
    if (!confirm('Are you sure you want to regenerate all content? All sections will be replaced with new AI-generated content.')) {
      return;
    }

    try {
      await generateMutation.mutateAsync({
        subskillId,
        versionId,
        useFoundations: true,
      });
    } catch (err) {
      console.error('Failed to reset content:', err);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading content...</span>
      </div>
    );
  }

  // Error state (404 = no content yet)
  if (isError && (error as any)?.status === 404) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Reading Content Yet</CardTitle>
          <CardDescription>
            Generate AI-powered reading content with interactive elements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">What will be generated:</h4>
            <ul className="text-sm text-gray-600 space-y-1 ml-4">
              <li>• 4-6 reading sections with explanatory content</li>
              <li>• Key vocabulary terms and concepts</li>
              <li>• Interactive elements (quizzes, alerts, activities)</li>
              <li>• Age-appropriate language and examples</li>
            </ul>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            size="lg"
            className="w-full"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating... (30-60 seconds)
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Reading Content
              </>
            )}
          </Button>

          {generateMutation.isPending && (
            <Alert>
              <AlertDescription>
                This may take 30-60 seconds. The AI is creating multiple sections with interactive elements...
              </AlertDescription>
            </Alert>
          )}

          {generateMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to generate content: {(generateMutation.error as Error)?.message || 'Unknown error'}
              </AlertDescription>
            </Alert>
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
          Failed to load content: {(error as Error)?.message || 'Unknown error'}
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
          <h3 className="text-lg font-semibold">Generating Reading Content</h3>
          <p className="text-sm text-muted-foreground">
            This may take 30-60 seconds. Please wait...
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Creating sections with interactive elements based on AI foundations
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
          <h2 className="text-2xl font-bold">Reading Content Editor</h2>
          {content && (
            <Badge variant="outline">
              {content.generation_status === 'generated' && 'AI Generated'}
              {content.generation_status === 'edited' && 'Edited'}
              {content.generation_status === 'pending' && 'Pending'}
            </Badge>
          )}
          {content?.is_draft && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              Draft
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={generateMutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Regenerate All
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content Info */}
      {content && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {content.title}
            </CardTitle>
            <CardDescription>
              {content.sections.length} section{content.sections.length !== 1 ? 's' : ''} •{' '}
              {content.sections.reduce((sum, s) => sum + s.interactive_primitives.length, 0)} interactive elements •{' '}
              {content.sections.filter(s => s.has_visual_snippet).length} visual snippets
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Success message */}
      {generateMutation.isSuccess && (
        <Alert>
          <AlertDescription>Content generated successfully!</AlertDescription>
        </Alert>
      )}

      {/* Sections */}
      {content && content.sections.length > 0 && (
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {content.sections
              .sort((a, b) => a.section_order - b.section_order)
              .map((section) => (
                <SectionCard
                  key={section.section_id}
                  section={section}
                  subskillId={subskillId}
                  versionId={versionId}
                  onEdit={(section) => setEditingSection(section)}
                  onVisualClick={(section) => setVisualSection(section)}
                />
              ))}
          </div>
        </ScrollArea>
      )}

      {/* Section Editor Dialog */}
      {editingSection && (
        <SectionEditor
          section={editingSection}
          subskillId={subskillId}
          versionId={versionId}
          isOpen={!!editingSection}
          onClose={() => setEditingSection(null)}
        />
      )}

      {/* Visual Snippet Modal */}
      {visualSection && (
        <VisualSnippetModal
          section={visualSection}
          subskillId={subskillId}
          isOpen={!!visualSection}
          onClose={() => setVisualSection(null)}
        />
      )}
    </div>
  );
}
