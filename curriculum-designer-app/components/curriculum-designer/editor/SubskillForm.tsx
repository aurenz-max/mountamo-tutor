'use client';

import { useForm } from 'react-hook-form';
import { useCreateSubskill, useUpdateSubskill } from '@/lib/curriculum-authoring/hooks';
import { curriculumAuthoringAPI } from '@/lib/curriculum-authoring/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Check, Puzzle, X, Plus, Search, AlertTriangle, Sparkles } from 'lucide-react';
import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Subskill, SubskillUpdate, SubskillCreate } from '@/types/curriculum-authoring';
import catalogData from '@/lib/curriculum-authoring/primitive-catalog.json';

interface CatalogEvalMode {
  evalMode: string;
  label: string;
  beta: number;
  scaffoldingMode: number;
  challengeTypes: string[];
  description: string;
}

interface CatalogEntry {
  id: string;
  domain: string;
  description: string;
  supportsEvaluation: boolean;
  evalModes: CatalogEvalMode[];
  hasTutoring: boolean;
}

interface SubskillFormProps {
  subskill: Subskill;
  subjectId: string;
  grade: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  core: 'bg-gray-100 text-gray-700',
  math: 'bg-blue-100 text-blue-700',
  engineering: 'bg-orange-100 text-orange-700',
  science: 'bg-green-100 text-green-700',
  biology: 'bg-emerald-100 text-emerald-700',
  astronomy: 'bg-purple-100 text-purple-700',
  physics: 'bg-yellow-100 text-yellow-700',
  literacy: 'bg-pink-100 text-pink-700',
  media: 'bg-indigo-100 text-indigo-700',
  assessment: 'bg-red-100 text-red-700',
};

export function SubskillForm({ subskill, subjectId, grade }: SubskillFormProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [primitiveIds, setPrimitiveIds] = useState<string[]>([]);
  const [selectedEvalModes, setSelectedEvalModes] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [isLoadingPrimitives, setIsLoadingPrimitives] = useState(false);
  const [primitivesDirty, setPrimitivesDirty] = useState(false);
  const [isSuggestingAI, setIsSuggestingAI] = useState(false);
  const [aiReasoning, setAiReasoning] = useState('');
  const isNewSubskill = subskill.subskill_id === 'new';

  const { mutate: createSubskill, isPending: isCreating, error: createError } = useCreateSubskill();
  const { mutate: updateSubskill, isPending: isUpdating, error: updateError } = useUpdateSubskill();

  const isPending = isCreating || isUpdating;
  const error = createError || updateError;

  // Build catalog lookup
  const catalog = useMemo(() => catalogData as CatalogEntry[], []);
  const catalogMap = useMemo(() => {
    const map = new Map<string, CatalogEntry>();
    for (const entry of catalog) map.set(entry.id, entry);
    return map;
  }, [catalog]);

  // Load primitive + eval modes from subskill data
  useEffect(() => {
    const tp = (subskill as any).target_primitive;
    setPrimitiveIds(tp ? [tp] : []);
    const modes = (subskill as any).target_eval_modes;
    setSelectedEvalModes(Array.isArray(modes) ? modes : []);
    setPrimitivesDirty(false);
  }, [subskill]);

  // Available eval modes from currently assigned primitives
  const availableEvalModes = useMemo(() => {
    const modes: Array<{ primitiveId: string; mode: CatalogEvalMode }> = [];
    for (const pid of primitiveIds) {
      const entry = catalogMap.get(pid);
      if (entry?.evalModes) {
        for (const em of entry.evalModes) {
          modes.push({ primitiveId: pid, mode: em });
        }
      }
    }
    return modes;
  }, [primitiveIds, catalogMap]);

  // Picker: primitives not yet assigned
  const pickerResults = useMemo(() => {
    const assigned = new Set(primitiveIds);
    return catalog
      .filter(p => !assigned.has(p.id))
      .filter(p => {
        if (!pickerSearch) return true;
        const q = pickerSearch.toLowerCase();
        return p.id.toLowerCase().includes(q)
          || p.domain.toLowerCase().includes(q)
          || p.description.toLowerCase().includes(q);
      })
      .slice(0, 20);
  }, [catalog, primitiveIds, pickerSearch]);

  const addPrimitive = useCallback((id: string) => {
    setPrimitiveIds(prev => [...prev, id]);
    setPrimitivesDirty(true);
  }, []);

  const removePrimitive = useCallback((id: string) => {
    setPrimitiveIds(prev => prev.filter(p => p !== id));
    // Also remove eval modes that belonged to this primitive
    const entry = catalogMap.get(id);
    if (entry?.evalModes) {
      const modeKeys = new Set(entry.evalModes.map(em => em.evalMode));
      setSelectedEvalModes(prev => prev.filter(m => !modeKeys.has(m)));
    }
    setPrimitivesDirty(true);
  }, [catalogMap]);

  const toggleEvalMode = useCallback((evalMode: string) => {
    setSelectedEvalModes(prev =>
      prev.includes(evalMode) ? prev.filter(m => m !== evalMode) : [...prev, evalMode]
    );
    setPrimitivesDirty(true);
  }, []);

  const handleAISuggest = useCallback(async () => {
    setIsSuggestingAI(true);
    setAiReasoning('');
    try {
      // Send only primitives with eval modes to keep the payload small
      const evalCatalog = catalog
        .filter(p => p.supportsEvaluation || p.evalModes.length > 0)
        .map(p => ({
          id: p.id,
          domain: p.domain,
          description: p.description,
          supportsEvaluation: p.supportsEvaluation,
          evalModes: p.evalModes,
        }));

      const result = await curriculumAuthoringAPI.suggestPrimitives({
        subskill_description: subskill.subskill_description,
        difficulty_start: subskill.difficulty_start,
        difficulty_end: subskill.difficulty_end,
        target_difficulty: subskill.target_difficulty,
        grade,
        subject_id: subjectId,
        catalog: evalCatalog,
      });

      if (result.suggestions?.length) {
        // Apply suggestions: add primitives and select recommended eval modes
        const newIds = [...primitiveIds];
        const newModes = [...selectedEvalModes];
        for (const s of result.suggestions) {
          if (!newIds.includes(s.primitive_id)) {
            newIds.push(s.primitive_id);
          }
          for (const em of s.recommended_eval_modes) {
            if (!newModes.includes(em)) {
              newModes.push(em);
            }
          }
        }
        setPrimitiveIds(newIds);
        setSelectedEvalModes(newModes);
        setPrimitivesDirty(true);
      }

      setAiReasoning(result.reasoning || '');
    } catch (e: any) {
      setAiReasoning(`Error: ${e.message || 'AI suggestion failed'}`);
    } finally {
      setIsSuggestingAI(false);
    }
  }, [catalog, subskill, grade, subjectId, primitiveIds, selectedEvalModes]);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty: formDirty },
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

  const isDirty = formDirty || primitivesDirty;

  const onSubmit = (data: SubskillUpdate) => {
    const payload: SubskillUpdate = {
      ...data,
      target_primitive: primitiveIds[0] || undefined,
      target_eval_modes: selectedEvalModes,
    };

    if (isNewSubskill) {
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
      createSubskill({ data: createData, grade, subjectId }, {
        onSuccess: () => {
          setShowSuccess(true);
          setPrimitivesDirty(false);
          setTimeout(() => setShowSuccess(false), 3000);
        },
      });
    } else {
      updateSubskill(
        { subskillId: subskill.subskill_id, data: payload, grade, subjectId },
        {
          onSuccess: () => {
            setShowSuccess(true);
            setPrimitivesDirty(false);
            setTimeout(() => setShowSuccess(false), 3000);
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
            <Label htmlFor="difficulty_start" className="text-xs text-gray-600">Start</Label>
            <Input id="difficulty_start" type="number" step="0.1" placeholder="0"
              {...register('difficulty_start', { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="difficulty_end" className="text-xs text-gray-600">End</Label>
            <Input id="difficulty_end" type="number" step="0.1" placeholder="10"
              {...register('difficulty_end', { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="target_difficulty" className="text-xs text-gray-600">Target</Label>
            <Input id="target_difficulty" type="number" step="0.1" placeholder="5"
              {...register('target_difficulty', { valueAsNumber: true })} />
          </div>
        </div>
        <p className="text-xs text-gray-500">Difficulty range for generated problems (0-10 scale)</p>
      </div>

      {/* ===================== PRIMITIVES SECTION ===================== */}
      {!isNewSubskill && (
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-gray-500" />
              <Label className="text-base">Primitives &amp; Eval Modes</Label>
              {primitiveIds.length > 0 && (
                <Badge variant="outline" className="text-xs">{primitiveIds.length}</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAISuggest}
                disabled={isSuggestingAI}
              >
                {isSuggestingAI ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                )}
                {isSuggestingAI ? 'Thinking...' : 'AI Suggest'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPicker(!showPicker)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Manual
              </Button>
            </div>
          </div>

          {/* Primitive Picker */}
          {showPicker && (
            <div className="border rounded-lg bg-gray-50 p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search primitives..."
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  className="pl-9 bg-white"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {pickerResults.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2 text-center">No matching primitives</p>
                ) : (
                  pickerResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { addPrimitive(p.id); setPickerSearch(''); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white text-left text-sm transition-colors"
                    >
                      <code className="font-medium text-gray-800">{p.id}</code>
                      <Badge variant="outline" className={`text-xs border-0 ${DOMAIN_COLORS[p.domain] || ''}`}>
                        {p.domain}
                      </Badge>
                      {p.evalModes.length > 0 && (
                        <span className="text-xs text-green-600">{p.evalModes.length} modes</span>
                      )}
                      {p.supportsEvaluation && !p.evalModes.length && (
                        <span className="text-xs text-yellow-600">eval (no modes)</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* AI Reasoning */}
          {aiReasoning && (
            <div className={`text-sm rounded-lg p-3 ${aiReasoning.startsWith('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-xs uppercase tracking-wide mb-0.5">AI Reasoning</div>
                  {aiReasoning}
                </div>
              </div>
            </div>
          )}

          {/* Assigned Primitives List */}
          {isLoadingPrimitives ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : primitiveIds.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-1">
              No primitives assigned. Click &ldquo;Add Primitive&rdquo; to assign one.
            </p>
          ) : (
            <div className="space-y-2">
              {primitiveIds.map(pid => {
                const entry = catalogMap.get(pid);
                return (
                  <div key={pid} className="rounded-lg border bg-white p-3">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-semibold text-gray-800">{pid}</code>
                        {entry ? (
                          <Badge variant="outline" className={`text-xs border-0 ${DOMAIN_COLORS[entry.domain] || ''}`}>
                            {entry.domain}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                            <AlertTriangle className="h-3 w-3 mr-1" />not in catalog
                          </Badge>
                        )}
                        {entry?.hasTutoring && (
                          <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                            tutoring
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                        onClick={() => removePrimitive(pid)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {entry?.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{entry.description}</p>
                    )}

                    {/* Eval mode toggles */}
                    {entry?.evalModes && entry.evalModes.length > 0 && (
                      <div className="mt-2.5">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                          Eval Modes <span className="normal-case font-normal">(click to toggle)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.evalModes.map(em => {
                            const isSelected = selectedEvalModes.includes(em.evalMode);
                            return (
                              <button
                                key={em.evalMode}
                                type="button"
                                onClick={() => toggleEvalMode(em.evalMode)}
                                className={`inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-200'
                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                                title={em.description}
                              >
                                {isSelected && <Check className="h-3 w-3 text-blue-600" />}
                                <code className={isSelected ? 'text-blue-700' : 'text-gray-600'}>{em.evalMode}</code>
                                <span className="text-gray-300">|</span>
                                <span className="font-mono text-green-700">β{em.beta}</span>
                                <span className="text-gray-300">|</span>
                                <span className="font-mono text-gray-400">S{em.scaffoldingMode}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected eval modes summary */}
          {selectedEvalModes.length > 0 && (
            <div className="text-xs text-gray-500">
              <strong>{selectedEvalModes.length}</strong> eval mode{selectedEvalModes.length !== 1 ? 's' : ''} selected:{' '}
              {selectedEvalModes.map((m, i) => (
                <span key={m}>
                  <code className="text-blue-600">{m}</code>
                  {i < selectedEvalModes.length - 1 && ', '}
                </span>
              ))}
            </div>
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
