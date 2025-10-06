'use client';

import { useForm } from 'react-hook-form';
import { useUpdateSubject } from '@/lib/curriculum-authoring/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Subject, SubjectUpdate } from '@/types/curriculum-authoring';

interface SubjectFormProps {
  subject: Subject;
}

export function SubjectForm({ subject }: SubjectFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { mutate: updateSubject, isPending, error } = useUpdateSubject();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<SubjectUpdate>({
    defaultValues: {
      subject_name: subject.subject_name,
      description: subject.description || '',
      grade_level: subject.grade_level || '',
    },
  });

  useEffect(() => {
    reset({
      subject_name: subject.subject_name,
      description: subject.description || '',
      grade_level: subject.grade_level || '',
    });
  }, [subject, reset]);

  const onSubmit = (data: SubjectUpdate) => {
    updateSubject(
      { subjectId: subject.subject_id, data },
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
        <Label htmlFor="subject_name">Subject Name</Label>
        <Input
          id="subject_name"
          {...register('subject_name', { required: 'Subject name is required' })}
        />
        {errors.subject_name && (
          <p className="text-sm text-red-600">{errors.subject_name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="grade_level">Grade Level</Label>
        <Input
          id="grade_level"
          placeholder="e.g., 1st Grade, K-2"
          {...register('grade_level')}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder="Subject description..."
          {...register('description')}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {(error as any).message || 'Failed to update subject'}
          </AlertDescription>
        </Alert>
      )}

      {showSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Subject updated successfully
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
