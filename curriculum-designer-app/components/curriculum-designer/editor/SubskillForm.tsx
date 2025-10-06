'use client';

import { useForm } from 'react-hook-form';
import { useUpdateSubskill } from '@/lib/curriculum-authoring/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Subskill, SubskillUpdate } from '@/types/curriculum-authoring';

interface SubskillFormProps {
  subskill: Subskill;
}

export function SubskillForm({ subskill }: SubskillFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { mutate: updateSubskill, isPending, error } = useUpdateSubskill();

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

  const onSubmit = (data: SubskillUpdate) => {
    updateSubskill(
      { subskillId: subskill.subskill_id, data },
      {
        onSuccess: () => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        },
      }
    );
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
            Subskill updated successfully
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
        <Button type="submit" disabled={!isDirty || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
