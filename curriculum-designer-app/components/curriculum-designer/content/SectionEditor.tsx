'use client';

/**
 * SectionEditor Component
 * Modal dialog for manually editing section content
 */

import { useForm } from 'react-hook-form';
import { X, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateSection } from '@/lib/curriculum-authoring/content-hooks';
import type { ReadingSection, UpdateSectionRequest } from '@/types/content';

interface SectionEditorProps {
  section: ReadingSection;
  subskillId: string;
  versionId?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  heading: string;
  content_text: string;
  key_terms: string;
  concepts_covered: string;
}

export function SectionEditor({
  section,
  subskillId,
  versionId = 'v1',
  isOpen,
  onClose,
}: SectionEditorProps) {
  const updateMutation = useUpdateSection();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      heading: section.heading,
      content_text: section.content_text,
      key_terms: section.key_terms.join(', '),
      concepts_covered: section.concepts_covered.join(', '),
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      // Parse comma-separated strings into arrays
      const updateData: UpdateSectionRequest = {
        heading: data.heading,
        content_text: data.content_text,
        key_terms: data.key_terms
          .split(',')
          .map((term) => term.trim())
          .filter((term) => term.length > 0),
        concepts_covered: data.concepts_covered
          .split(',')
          .map((concept) => concept.trim())
          .filter((concept) => concept.length > 0),
      };

      await updateMutation.mutateAsync({
        subskillId,
        sectionId: section.section_id,
        data: updateData,
        versionId,
      });

      // Close dialog on success
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Failed to update section:', error);
    }
  };

  const handleClose = () => {
    if (isDirty && !confirm('You have unsaved changes. Are you sure you want to close?')) {
      return;
    }
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Section</DialogTitle>
          <DialogDescription>
            Make changes to the section content. Interactive primitives can be edited separately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Heading */}
          <div className="space-y-2">
            <Label htmlFor="heading">
              Section Heading <span className="text-red-500">*</span>
            </Label>
            <Input
              id="heading"
              {...register('heading', { required: 'Heading is required' })}
              placeholder="E.g., What is Counting?"
            />
            {errors.heading && (
              <p className="text-sm text-red-600">{errors.heading.message}</p>
            )}
          </div>

          {/* Content Text */}
          <div className="space-y-2">
            <Label htmlFor="content_text">
              Content Text <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="content_text"
              {...register('content_text', { required: 'Content is required' })}
              placeholder="Main content of the section..."
              rows={10}
              className="font-mono text-sm"
            />
            {errors.content_text && (
              <p className="text-sm text-red-600">{errors.content_text.message}</p>
            )}
            <p className="text-xs text-gray-500">
              Write the main explanatory text for this section
            </p>
          </div>

          {/* Key Terms */}
          <div className="space-y-2">
            <Label htmlFor="key_terms">Key Terms</Label>
            <Input
              id="key_terms"
              {...register('key_terms')}
              placeholder="counting, number, quantity (comma-separated)"
            />
            <p className="text-xs text-gray-500">
              Enter key vocabulary terms separated by commas
            </p>
          </div>

          {/* Concepts Covered */}
          <div className="space-y-2">
            <Label htmlFor="concepts_covered">Concepts Covered</Label>
            <Input
              id="concepts_covered"
              {...register('concepts_covered')}
              placeholder="one-to-one correspondence, number recognition (comma-separated)"
            />
            <p className="text-xs text-gray-500">
              Enter learning concepts separated by commas
            </p>
          </div>

          {/* Interactive Primitives Info */}
          <Alert>
            <AlertDescription>
              This section has {section.interactive_primitives.length} interactive element
              {section.interactive_primitives.length !== 1 ? 's' : ''}.
              Advanced primitive editing will be available in a future update.
            </AlertDescription>
          </Alert>

          {/* Success Message */}
          {updateMutation.isSuccess && (
            <Alert>
              <AlertDescription>
                Section updated successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {updateMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Failed to update section: {(updateMutation.error as Error)?.message || 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={updateMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || updateMutation.isPending}
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
