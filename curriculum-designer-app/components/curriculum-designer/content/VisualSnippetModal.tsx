'use client';

/**
 * VisualSnippetModal Component
 * Modal for viewing, editing, and generating HTML visual snippets
 */

import { useState, useEffect } from 'react';
import { Eye, Code, Save, Trash2, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useVisualSnippet,
  useGenerateVisual,
  useUpdateVisual,
  useDeleteVisual,
} from '@/lib/curriculum-authoring/content-hooks';
import type { ReadingSection } from '@/types/content';

interface VisualSnippetModalProps {
  section: ReadingSection;
  subskillId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VisualSnippetModal({
  section,
  subskillId,
  isOpen,
  onClose,
}: VisualSnippetModalProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [editedHtml, setEditedHtml] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Queries and mutations
  const {
    data: visualSnippet,
    isLoading: isLoadingSnippet,
    isError: isSnippetError,
  } = useVisualSnippet(subskillId, section.section_id);

  const generateMutation = useGenerateVisual();
  const updateMutation = useUpdateVisual();
  const deleteMutation = useDeleteVisual();

  // Initialize edited HTML when snippet loads
  useEffect(() => {
    if (visualSnippet?.html_content) {
      setEditedHtml(visualSnippet.html_content);
      setHasUnsavedChanges(false);
    }
  }, [visualSnippet]);

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({
        subskillId,
        sectionId: section.section_id,
        request: {
          section_id: section.section_id,
          custom_prompt: customPrompt || undefined,
        },
      });
      setCustomPrompt('');
    } catch (error) {
      console.error('Failed to generate visual:', error);
    }
  };

  const handleSave = async () => {
    if (!editedHtml.trim()) return;

    try {
      await updateMutation.mutateAsync({
        subskillId,
        sectionId: section.section_id,
        htmlContent: editedHtml,
      });
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to update visual:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this visual snippet? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        subskillId,
        sectionId: section.section_id,
      });
      onClose();
    } catch (error) {
      console.error('Failed to delete visual:', error);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    setEditedHtml('');
    setCustomPrompt('');
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleHtmlChange = (value: string) => {
    setEditedHtml(value);
    setHasUnsavedChanges(value !== visualSnippet?.html_content);
  };

  // Determine what to show
  const hasVisual = visualSnippet?.html_content;
  const isGenerating = generateMutation.isPending;
  const showGenerateForm = !hasVisual && !isGenerating;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Visual Snippet: {section.heading}
          </DialogTitle>
          <DialogDescription>
            {hasVisual
              ? 'View or edit the interactive HTML visualization'
              : 'Generate an interactive HTML visualization for this section'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading State */}
          {isLoadingSnippet && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 mb-4 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600">Loading visual snippet...</p>
            </div>
          )}

          {/* Generating State */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 mb-4 animate-spin text-purple-600" />
              <p className="text-sm text-gray-600">Generating visual (20-40 seconds)...</p>
              <p className="text-xs text-gray-500 mt-2">This may take a moment. Please wait...</p>
            </div>
          )}

          {/* Generate Form */}
          {showGenerateForm && !isLoadingSnippet && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="custom_prompt">
                  Custom Generation Instructions (optional)
                </Label>
                <Textarea
                  id="custom_prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="E.g., 'Create an interactive counting game with clickable apples', 'Make a number line visualization'"
                  rows={3}
                />
                <p className="text-xs text-gray-500">
                  Provide specific instructions for what kind of visual you want
                </p>
              </div>

              <Button onClick={handleGenerate} className="w-full">
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Visual Snippet
              </Button>
            </div>
          )}

          {/* Visual Snippet Tabs */}
          {hasVisual && !isGenerating && !isLoadingSnippet && (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'edit')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="edit">
                  <Code className="w-4 h-4 mr-2" />
                  Edit HTML
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-4">
                <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={editedHtml}
                    sandbox="allow-scripts"
                    className="w-full h-[500px] bg-white"
                    title={`Visual snippet for ${section.heading}`}
                  />
                </div>

                {hasUnsavedChanges && (
                  <Alert>
                    <AlertDescription>
                      You have unsaved changes. Switch to Edit tab to save them.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="edit" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="html_content">HTML Content</Label>
                  <Textarea
                    id="html_content"
                    value={editedHtml}
                    onChange={(e) => handleHtmlChange(e.target.value)}
                    rows={20}
                    className="font-mono text-xs"
                    placeholder="<!DOCTYPE html>..."
                  />
                  <p className="text-xs text-gray-500">
                    Edit the HTML, CSS, and JavaScript for this visualization
                  </p>
                </div>

                {updateMutation.isSuccess && (
                  <Alert>
                    <AlertDescription>
                      Visual snippet updated successfully!
                    </AlertDescription>
                  </Alert>
                )}

                {updateMutation.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      Failed to update: {(updateMutation.error as Error)?.message || 'Unknown error'}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          )}

          {/* Error State */}
          {(generateMutation.isError || isSnippetError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {generateMutation.isError
                  ? `Failed to generate: ${(generateMutation.error as Error)?.message || 'Unknown error'}`
                  : 'Failed to load visual snippet'}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          {hasVisual && !isGenerating && (
            <>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </>
                )}
              </Button>

              {activeTab === 'edit' && (
                <Button
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges || updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}
            </>
          )}

          <Button variant="outline" onClick={handleClose}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
