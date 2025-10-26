'use client';

import { useForm } from 'react-hook-form';
import { useCreateSubskill, useUpdateSubskill, useSubskillPrimitives, useUpdateSubskillPrimitives } from '@/lib/curriculum-authoring/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PrimitiveSelector } from '../primitives/PrimitiveSelector';
import type { Subskill, SubskillUpdate, SubskillCreate } from '@/types/curriculum-authoring';

interface SubskillFormProps {
  subskill: Subskill;
  subjectId?: string;
}

export function SubskillForm({ subskill, subjectId }: SubskillFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedPrimitives, setSelectedPrimitives] = useState<string[]>([]);
  const isNewSubskill = subskill.subskill_id === 'new';

  const { mutate: createSubskill, isPending: isCreating, error: createError } = useCreateSubskill();
  const { mutate: updateSubskill, isPending: isUpdating, error: updateError } = useUpdateSubskill();
  const { mutate: updatePrimitives, isPending: isUpdatingPrimitives } = useUpdateSubskillPrimitives();

  // Fetch existing primitives for this subskill
  const { data: existingPrimitives, isLoading: isLoadingPrimitives } = useSubskillPrimitives(
    !isNewSubskill ? subskill.subskill_id : undefined,
    subjectId
  );

  const isPending = isCreating || isUpdating || isUpdatingPrimitives;
  const error = createError || updateError;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SubskillUpdate>({
    defaultValues: {
      subskill_description: subskill.subskill_description,
      subskill_order: subskill.subskill_order,
      difficulty_start: subskill.difficulty_start,
      difficulty_end: subskill.difficulty_end,
      target_difficulty: subskill.target_difficulty,
    },
  });

  useEffect(() => {
    reset({
      subskill_description: subskill.subskill_description,
      subskill_order: subskill.subskill_order,
      difficulty_start: subskill.difficulty_start,
      difficulty_end: subskill.difficulty_end,
      target_difficulty: subskill.target_difficulty,
    });
  }, [subskill, reset]);

  // Load existing primitives when they're fetched
  useEffect(() => {
    if (existingPrimitives) {
      setSelectedPrimitives(existingPrimitives.map((p) => p.primitive_id));
    }
  }, [existingPrimitives]);

  const onSubmit = (data: SubskillUpdate) => {
    if (isNewSubskill) {
      // Create new subskill - generate a unique ID
      const subskillId = `${subskill.skill_id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const createData: SubskillCreate = {
        subskill_id: subskillId,
        skill_id: subskill.skill_id,
        subskill_description: data.subskill_description || '',
        subskill_order: data.subskill_order,
        difficulty_start: data.difficulty_start,
        difficulty_end: data.difficulty_end,
        target_difficulty: data.target_difficulty,
      };

      createSubskill(createData, {
        onSuccess: () => {
          // After creating the subskill, update primitives if any are selected
          if (selectedPrimitives.length > 0 && subjectId) {
            updatePrimitives({
              subskillId,
              primitiveIds: selectedPrimitives,
              subjectId,
            });
          }
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        },
      });
    } else {
      // Update existing subskill
      updateSubskill(
        { subskillId: subskill.subskill_id, data },
        {
          onSuccess: () => {
            // Update primitives if subjectId is available
            if (subjectId) {
              updatePrimitives(
                {
                  subskillId: subskill.subskill_id,
                  primitiveIds: selectedPrimitives,
                  subjectId,
                },
                {
                  onSuccess: () => {
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 3000);
                  },
                }
              );
            } else {
              setShowSuccess(true);
              setTimeout(() => setShowSuccess(false), 3000);
            }
          },
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subskill_description">Subskill Description</Label>
        <Textarea
          id="subskill_description"
          rows={3}
          {...register('subskill_description', { required: 'Subskill description is required' })}
        />
        {errors.subskill_description && (
          <p className="text-sm text-red-600">{errors.subskill_description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="subskill_order">Order</Label>
        <Input
          id="subskill_order"
          type="number"
          placeholder="1"
          {...register('subskill_order', { valueAsNumber: true })}
        />
        <p className="text-xs text-gray-500">
          Determines the order in which subskills are displayed within the skill
        </p>
      </div>

      <div className="space-y-3">
        <Label>Difficulty Range</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="difficulty_start" className="text-xs text-gray-600">
              Start
            </Label>
            <Input
              id="difficulty_start"
              type="number"
              step="0.1"
              placeholder="0"
              {...register('difficulty_start', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="difficulty_end" className="text-xs text-gray-600">
              End
            </Label>
            <Input
              id="difficulty_end"
              type="number"
              step="0.1"
              placeholder="10"
              {...register('difficulty_end', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="target_difficulty" className="text-xs text-gray-600">
              Target
            </Label>
            <Input
              id="target_difficulty"
              type="number"
              step="0.1"
              placeholder="5"
              {...register('target_difficulty', { valueAsNumber: true })}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Difficulty range for generated problems (0-10 scale)
        </p>
      </div>

      {/* Visual Primitives Section */}
      {subjectId && (
        <div className="space-y-2 pt-2 border-t">
          <Label>Visual Primitives</Label>
          <p className="text-sm text-muted-foreground">
            Select the types of interactive visuals allowed for this subskill
          </p>
          {isLoadingPrimitives ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Loading primitives...</span>
            </div>
          ) : (
            <PrimitiveSelector
              selectedPrimitiveIds={selectedPrimitives}
              onSelectionChange={setSelectedPrimitives}
            />
          )}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(error as any).message || 'Failed to update subskill'}
          </AlertDescription>
        </Alert>
      )}

      {showSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {isNewSubskill ? 'Subskill created successfully' : 'Subskill updated successfully'}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          disabled={!isDirty || isPending}
        >
          Reset
        </Button>
        <Button type="submit" disabled={(!isDirty && !isNewSubskill) || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isNewSubskill ? 'Creating...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isNewSubskill ? 'Create Subskill' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
