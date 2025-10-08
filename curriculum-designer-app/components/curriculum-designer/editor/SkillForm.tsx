'use client';

import { useForm } from 'react-hook-form';
import { useCreateSkill, useUpdateSkill } from '@/lib/curriculum-authoring/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Skill, SkillUpdate, SkillCreate } from '@/types/curriculum-authoring';

interface SkillFormProps {
  skill: Skill;
}

export function SkillForm({ skill }: SkillFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const isNewSkill = skill.skill_id === 'new';

  const { mutate: createSkill, isPending: isCreating, error: createError } = useCreateSkill();
  const { mutate: updateSkill, isPending: isUpdating, error: updateError } = useUpdateSkill();

  const isPending = isCreating || isUpdating;
  const error = createError || updateError;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SkillUpdate>({
    defaultValues: {
      skill_description: skill.skill_description,
      skill_order: skill.skill_order,
    },
  });

  useEffect(() => {
    reset({
      skill_description: skill.skill_description,
      skill_order: skill.skill_order,
    });
  }, [skill, reset]);

  const onSubmit = (data: SkillUpdate) => {
    if (isNewSkill) {
      // Create new skill - generate a unique ID
      const skillId = `${skill.unit_id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const createData: SkillCreate = {
        skill_id: skillId,
        unit_id: skill.unit_id,
        skill_description: data.skill_description || '',
        skill_order: data.skill_order,
      };

      createSkill(createData, {
        onSuccess: () => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        },
      });
    } else {
      // Update existing skill
      updateSkill(
        { skillId: skill.skill_id, data },
        {
          onSuccess: () => {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
          },
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="skill_description">Skill Description</Label>
        <Textarea
          id="skill_description"
          rows={3}
          {...register('skill_description', { required: 'Skill description is required' })}
        />
        {errors.skill_description && (
          <p className="text-sm text-red-600">{errors.skill_description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill_order">Order</Label>
        <Input
          id="skill_order"
          type="number"
          placeholder="1"
          {...register('skill_order', { valueAsNumber: true })}
        />
        <p className="text-xs text-gray-500">
          Determines the order in which skills are displayed within the unit
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(error as any).message || 'Failed to update skill'}
          </AlertDescription>
        </Alert>
      )}

      {showSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {isNewSkill ? 'Skill created successfully' : 'Skill updated successfully'}
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
        <Button type="submit" disabled={(!isDirty && !isNewSkill) || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isNewSkill ? 'Creating...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isNewSkill ? 'Create Skill' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
