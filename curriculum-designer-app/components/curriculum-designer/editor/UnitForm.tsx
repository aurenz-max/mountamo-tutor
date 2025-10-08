'use client';

import { useForm } from 'react-hook-form';
import { useCreateUnit, useUpdateUnit } from '@/lib/curriculum-authoring/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Unit, UnitUpdate, UnitCreate } from '@/types/curriculum-authoring';

interface UnitFormProps {
  unit: Unit;
}

export function UnitForm({ unit }: UnitFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const isNewUnit = unit.unit_id === 'new';

  const { mutate: createUnit, isPending: isCreating, error: createError } = useCreateUnit();
  const { mutate: updateUnit, isPending: isUpdating, error: updateError } = useUpdateUnit();

  const isPending = isCreating || isUpdating;
  const error = createError || updateError;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<UnitUpdate>({
    defaultValues: {
      unit_title: unit.unit_title,
      unit_order: unit.unit_order,
      description: unit.description || '',
    },
  });

  useEffect(() => {
    reset({
      unit_title: unit.unit_title,
      unit_order: unit.unit_order,
      description: unit.description || '',
    });
  }, [unit, reset]);

  const onSubmit = (data: UnitUpdate) => {
    if (isNewUnit) {
      // Create new unit - generate a unique ID
      const unitId = `${unit.subject_id}-U${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const createData: UnitCreate = {
        unit_id: unitId,
        subject_id: unit.subject_id,
        unit_title: data.unit_title || '',
        unit_order: data.unit_order,
        description: data.description,
      };

      createUnit(createData, {
        onSuccess: () => {
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 3000);
        },
      });
    } else {
      // Update existing unit
      updateUnit(
        { unitId: unit.unit_id, data },
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
        <Label htmlFor="unit_title">Unit Title</Label>
        <Input
          id="unit_title"
          {...register('unit_title', { required: 'Unit title is required' })}
        />
        {errors.unit_title && (
          <p className="text-sm text-red-600">{errors.unit_title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit_order">Order</Label>
        <Input
          id="unit_order"
          type="number"
          placeholder="1"
          {...register('unit_order', { valueAsNumber: true })}
        />
        <p className="text-xs text-gray-500">
          Determines the order in which units are displayed
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder="Unit description..."
          {...register('description')}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(error as any).message || 'Failed to update unit'}
          </AlertDescription>
        </Alert>
      )}

      {showSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            {isNewUnit ? 'Unit created successfully' : 'Unit updated successfully'}
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
        <Button type="submit" disabled={(!isDirty && !isNewUnit) || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isNewUnit ? 'Creating...' : 'Saving...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isNewUnit ? 'Create Unit' : 'Save Changes'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
