'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useGenerateUnit } from '@/lib/curriculum-authoring/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Sparkles, CheckCircle } from 'lucide-react';
import type { GenerateUnitRequest, AIGeneratedUnit } from '@/types/curriculum-authoring';

interface AIUnitGeneratorProps {
  subjectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIUnitGenerator({
  subjectId,
  open,
  onOpenChange,
}: AIUnitGeneratorProps) {
  const [generatedUnit, setGeneratedUnit] = useState<AIGeneratedUnit | null>(null);

  const { mutate: generateUnit, isPending, error } = useGenerateUnit();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GenerateUnitRequest>();

  const onSubmit = (data: GenerateUnitRequest) => {
    generateUnit(data, {
      onSuccess: (result) => {
        setGeneratedUnit(result);
      },
    });
  };

  const handleClose = () => {
    reset();
    setGeneratedUnit(null);
    onOpenChange(false);
  };

  const handleSaveDraft = () => {
    // TODO: Implement save draft functionality
    console.log('Save draft:', generatedUnit);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Unit Generator
          </DialogTitle>
          <DialogDescription>
            Generate a complete curriculum unit with AI assistance
          </DialogDescription>
        </DialogHeader>

        {!generatedUnit ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g., Mathematics"
                {...register('subject', { required: 'Subject is required' })}
              />
              {errors.subject && (
                <p className="text-sm text-red-600">{errors.subject.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="grade_level">Grade Level</Label>
              <Input
                id="grade_level"
                placeholder="e.g., 1st Grade"
                {...register('grade_level', { required: 'Grade level is required' })}
              />
              {errors.grade_level && (
                <p className="text-sm text-red-600">{errors.grade_level.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic_prompt">Topic/Concept</Label>
              <Textarea
                id="topic_prompt"
                rows={3}
                placeholder="e.g., Addition within 20"
                {...register('topic_prompt', { required: 'Topic is required' })}
              />
              {errors.topic_prompt && (
                <p className="text-sm text-red-600">{errors.topic_prompt.message}</p>
              )}
              <p className="text-xs text-gray-500">
                Describe the topic or learning objective for this unit
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Additional Context (Optional)</Label>
              <Textarea
                id="context"
                rows={2}
                placeholder="Any additional information to guide the AI..."
                {...register('context')}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  {(error as any).message || 'Failed to generate unit'}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Unit
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Unit generated successfully! Review and save as draft.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 rounded-lg border p-4">
              <div>
                <h3 className="font-semibold">Unit: {generatedUnit.unit.unit_title}</h3>
                <p className="text-sm text-gray-600">{generatedUnit.unit.description}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Skills ({generatedUnit.skills.length})</h4>
                {generatedUnit.skills.map((skillGroup, idx) => (
                  <div key={idx} className="ml-4 space-y-1 border-l-2 border-blue-200 pl-3">
                    <p className="text-sm font-medium">{skillGroup.skill.skill_description}</p>
                    <div className="ml-4 space-y-0.5">
                      {skillGroup.subskills.map((subskill, sidx) => (
                        <p key={sidx} className="text-xs text-gray-600">
                          • {subskill.subskill_description}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>
                Discard
              </Button>
              <Button onClick={handleSaveDraft}>
                Save as Draft
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
