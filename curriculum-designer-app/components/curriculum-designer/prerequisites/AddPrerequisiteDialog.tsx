'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useCurriculumTree, useCreatePrerequisite, useValidatePrerequisite } from '@/lib/curriculum-authoring/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EntityType, PrerequisiteCreate } from '@/types/curriculum-authoring';

interface AddPrerequisiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: EntityType;
  subjectId: string;
}

interface EntityOption {
  id: string;
  type: EntityType;
  description: string;
  parentContext?: string;
}

interface FormData {
  prerequisite_entity_id: string;
  min_proficiency_threshold: number;
}

export function AddPrerequisiteDialog({
  open,
  onOpenChange,
  entityId,
  entityType,
  subjectId,
}: AddPrerequisiteDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrereq, setSelectedPrereq] = useState<EntityOption | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: tree, isLoading: isLoadingTree } = useCurriculumTree(subjectId, true);
  const { mutate: createPrerequisite, isPending: isCreating, error: createError } = useCreatePrerequisite();
  const { mutate: validatePrerequisite, isPending: isValidating, data: validationResult } = useValidatePrerequisite();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    defaultValues: {
      min_proficiency_threshold: 0.8,
    },
  });

  // Build list of available prerequisite options from curriculum tree
  const availableEntities = useMemo(() => {
    if (!tree) return [];

    const entities: EntityOption[] = [];

    tree.units.forEach((unit) => {
      unit.skills.forEach((skill) => {
        // Only allow skills and subskills as prerequisites
        if (skill.id !== entityId) {
          entities.push({
            id: skill.id,
            type: 'skill',
            description: skill.description,
            parentContext: `${unit.title}`,
          });
        }

        skill.subskills.forEach((subskill) => {
          if (subskill.id !== entityId) {
            entities.push({
              id: subskill.id,
              type: 'subskill',
              description: subskill.description,
              parentContext: `${unit.title} > ${skill.description}`,
            });
          }
        });
      });
    });

    return entities;
  }, [tree, entityId]);

  // Filter entities based on search query
  const filteredEntities = useMemo(() => {
    if (!searchQuery) return availableEntities;

    const query = searchQuery.toLowerCase();
    return availableEntities.filter(
      (entity) =>
        entity.description.toLowerCase().includes(query) ||
        entity.id.toLowerCase().includes(query) ||
        entity.parentContext?.toLowerCase().includes(query)
    );
  }, [availableEntities, searchQuery]);

  const onSubmit = (data: FormData) => {
    if (!selectedPrereq) return;

    const prerequisiteData: PrerequisiteCreate = {
      prerequisite_entity_id: selectedPrereq.id,
      prerequisite_entity_type: selectedPrereq.type,
      unlocks_entity_id: entityId,
      unlocks_entity_type: entityType,
      min_proficiency_threshold: data.min_proficiency_threshold,
    };

    // Validate first
    validatePrerequisite(prerequisiteData, {
      onSuccess: (validation) => {
        if (validation.valid) {
          // Create the prerequisite
          createPrerequisite(prerequisiteData, {
            onSuccess: () => {
              setShowSuccess(true);
              setTimeout(() => {
                setShowSuccess(false);
                onOpenChange(false);
                reset();
                setSelectedPrereq(null);
                setSearchQuery('');
              }, 1500);
            },
          });
        }
      },
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setSelectedPrereq(null);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Prerequisite</DialogTitle>
          <DialogDescription>
            Select a skill or subskill that must be mastered before this {entityType}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          {/* Search */}
          <div className="space-y-2 mb-4">
            <Label htmlFor="search">Search Prerequisites</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by description or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Entity Selection List */}
          <div className="flex-1 overflow-y-auto border rounded-lg min-h-0">
            {isLoadingTree ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-gray-500">
                  {searchQuery ? 'No matching entities found' : 'No available prerequisites'}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredEntities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => setSelectedPrereq(entity)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedPrereq?.id === entity.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {entity.type}
                          </Badge>
                          <code className="text-xs text-gray-500">{entity.id}</code>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{entity.description}</p>
                        {entity.parentContext && (
                          <p className="text-xs text-gray-500 mt-0.5">{entity.parentContext}</p>
                        )}
                      </div>
                      {selectedPrereq?.id === entity.id && (
                        <Check className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Threshold Input */}
          {selectedPrereq && (
            <div className="space-y-2 mt-4">
              <Label htmlFor="threshold">Minimum Proficiency Threshold</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="threshold"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  {...register('min_proficiency_threshold', {
                    required: 'Threshold is required',
                    min: { value: 0, message: 'Minimum is 0' },
                    max: { value: 1, message: 'Maximum is 1' },
                    valueAsNumber: true,
                  })}
                  className="max-w-xs"
                />
                <span className="text-sm text-gray-500">
                  ({((selectedPrereq && 0.8) * 100).toFixed(0)}% proficiency required)
                </span>
              </div>
              {errors.min_proficiency_threshold && (
                <p className="text-sm text-red-600">{errors.min_proficiency_threshold.message}</p>
              )}
            </div>
          )}

          {/* Validation/Error Messages */}
          {validationResult && !validationResult.valid && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationResult.error}</AlertDescription>
            </Alert>
          )}

          {createError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(createError as any).message || 'Failed to create prerequisite'}
              </AlertDescription>
            </Alert>
          )}

          {showSuccess && (
            <Alert className="border-green-200 bg-green-50 mt-4">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Prerequisite added successfully!
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedPrereq || isCreating || isValidating}
            >
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Prerequisite'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
