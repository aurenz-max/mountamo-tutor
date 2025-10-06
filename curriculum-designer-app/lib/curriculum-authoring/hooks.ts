/**
 * React hooks for Curriculum Authoring
 * Uses React Query for efficient server state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumAuthoringAPI } from './api';
import type {
  Subject, SubjectCreate, SubjectUpdate,
  Unit, UnitCreate, UnitUpdate,
  Skill, SkillCreate, SkillUpdate,
  Subskill, SubskillCreate, SubskillUpdate,
  CurriculumTree,
  PrerequisiteCreate, EntityType,
  GenerateUnitRequest, GenerateSkillRequest,
  SuggestPrerequisitesRequest, ImproveDescriptionRequest,
  PublishRequest
} from '@/types/curriculum-authoring';

// ==================== QUERY KEYS ====================

export const QUERY_KEYS = {
  subjects: (includeDrafts?: boolean) => ['subjects', { includeDrafts }] as const,
  subject: (subjectId: string) => ['subject', subjectId] as const,
  curriculumTree: (subjectId: string, includeDrafts?: boolean) =>
    ['curriculumTree', subjectId, { includeDrafts }] as const,
  units: (subjectId: string, includeDrafts?: boolean) =>
    ['units', subjectId, { includeDrafts }] as const,
  unit: (unitId: string) => ['unit', unitId] as const,
  skills: (unitId: string, includeDrafts?: boolean) =>
    ['skills', unitId, { includeDrafts }] as const,
  subskills: (skillId: string, includeDrafts?: boolean) =>
    ['subskills', skillId, { includeDrafts }] as const,
  entityPrerequisites: (entityId: string, entityType: EntityType, includeDrafts?: boolean) =>
    ['entityPrerequisites', entityId, entityType, { includeDrafts }] as const,
  subjectGraph: (subjectId: string, includeDrafts?: boolean) =>
    ['subjectGraph', subjectId, { includeDrafts }] as const,
  baseSkills: (subjectId: string) => ['baseSkills', subjectId] as const,
  draftChanges: (subjectId: string) => ['draftChanges', subjectId] as const,
  versionHistory: (subjectId: string) => ['versionHistory', subjectId] as const,
  activeVersion: (subjectId: string) => ['activeVersion', subjectId] as const,
};

// ==================== CURRICULUM HOOKS ====================

export function useSubjects(includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.subjects(includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSubjects(includeDrafts),
  });
}

export function useSubject(subjectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.subject(subjectId),
    queryFn: () => curriculumAuthoringAPI.getSubject(subjectId),
    enabled: !!subjectId,
  });
}

export function useCurriculumTree(subjectId: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.curriculumTree(subjectId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getCurriculumTree(subjectId, includeDrafts),
    enabled: !!subjectId,
  });
}

export function useUnits(subjectId: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.units(subjectId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getUnits(subjectId, includeDrafts),
    enabled: !!subjectId,
  });
}

export function useUnit(unitId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.unit(unitId),
    queryFn: () => curriculumAuthoringAPI.getUnit(unitId),
    enabled: !!unitId,
  });
}

export function useSkills(unitId: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.skills(unitId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSkills(unitId, includeDrafts),
    enabled: !!unitId,
  });
}

export function useSubskills(skillId: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.subskills(skillId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSubskills(skillId, includeDrafts),
    enabled: !!skillId,
  });
}

// ==================== MUTATION HOOKS ====================

export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubjectCreate) => curriculumAuthoringAPI.createSubject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, data }: { subjectId: string; data: SubjectUpdate }) =>
      curriculumAuthoringAPI.updateSubject(subjectId, data),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UnitCreate) => curriculumAuthoringAPI.createUnit(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['units', result.subject_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree', result.subject_id] });
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, data }: { unitId: string; data: UnitUpdate }) =>
      curriculumAuthoringAPI.updateUnit(unitId, data),
    onSuccess: (result, { unitId }) => {
      queryClient.invalidateQueries({ queryKey: ['unit', unitId] });
      queryClient.invalidateQueries({ queryKey: ['units', result.subject_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree', result.subject_id] });
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => curriculumAuthoringAPI.deleteUnit(unitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SkillCreate) => curriculumAuthoringAPI.createSkill(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['skills', result.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ skillId, data }: { skillId: string; data: SkillUpdate }) =>
      curriculumAuthoringAPI.updateSkill(skillId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['skills', result.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useCreateSubskill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SubskillCreate) => curriculumAuthoringAPI.createSubskill(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subskills', result.skill_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useUpdateSubskill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subskillId, data }: { subskillId: string; data: SubskillUpdate }) =>
      curriculumAuthoringAPI.updateSubskill(subskillId, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subskills', result.skill_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

// ==================== PREREQUISITE HOOKS ====================

export function useEntityPrerequisites(
  entityId: string,
  entityType: EntityType,
  includeDrafts: boolean = false
) {
  return useQuery({
    queryKey: QUERY_KEYS.entityPrerequisites(entityId, entityType, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getEntityPrerequisites(entityId, entityType, includeDrafts),
    enabled: !!entityId && !!entityType,
  });
}

export function useSubjectGraph(subjectId: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.subjectGraph(subjectId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSubjectGraph(subjectId, includeDrafts),
    enabled: !!subjectId,
  });
}

export function useBaseSkills(subjectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.baseSkills(subjectId),
    queryFn: () => curriculumAuthoringAPI.getBaseSkills(subjectId),
    enabled: !!subjectId,
  });
}

export function useCreatePrerequisite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PrerequisiteCreate) => curriculumAuthoringAPI.createPrerequisite(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['entityPrerequisites'] });
      queryClient.invalidateQueries({ queryKey: ['subjectGraph'] });
    },
  });
}

export function useDeletePrerequisite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prerequisiteId: string) => curriculumAuthoringAPI.deletePrerequisite(prerequisiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entityPrerequisites'] });
      queryClient.invalidateQueries({ queryKey: ['subjectGraph'] });
    },
  });
}

export function useValidatePrerequisite() {
  return useMutation({
    mutationFn: (data: PrerequisiteCreate) => curriculumAuthoringAPI.validatePrerequisite(data),
  });
}

// ==================== AI GENERATION HOOKS ====================

export function useGenerateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: GenerateUnitRequest) => curriculumAuthoringAPI.generateUnit(request),
    onSuccess: () => {
      // Don't invalidate - let the user review and save the draft
    },
  });
}

export function useGenerateSkill() {
  return useMutation({
    mutationFn: (request: GenerateSkillRequest) => curriculumAuthoringAPI.generateSkill(request),
  });
}

export function useSuggestPrerequisites() {
  return useMutation({
    mutationFn: (request: SuggestPrerequisitesRequest) =>
      curriculumAuthoringAPI.suggestPrerequisites(request),
  });
}

export function useImproveDescription() {
  return useMutation({
    mutationFn: (request: ImproveDescriptionRequest) =>
      curriculumAuthoringAPI.improveDescription(request),
  });
}

// ==================== PUBLISHING HOOKS ====================

export function useDraftChanges(subjectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.draftChanges(subjectId),
    queryFn: () => curriculumAuthoringAPI.getDraftChanges(subjectId),
    enabled: !!subjectId,
  });
}

export function usePublishSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, request }: { subjectId: string; request: PublishRequest }) =>
      curriculumAuthoringAPI.publishSubject(subjectId, request),
    onSuccess: (_, { subjectId }) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['draftChanges', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['versionHistory', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['activeVersion', subjectId] });
    },
  });
}

export function useVersionHistory(subjectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.versionHistory(subjectId),
    queryFn: () => curriculumAuthoringAPI.getVersionHistory(subjectId),
    enabled: !!subjectId,
  });
}

export function useActiveVersion(subjectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.activeVersion(subjectId),
    queryFn: () => curriculumAuthoringAPI.getActiveVersion(subjectId),
    enabled: !!subjectId,
  });
}

export function useRollbackVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, versionId }: { subjectId: string; versionId: string }) =>
      curriculumAuthoringAPI.rollbackVersion(subjectId, versionId),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['versionHistory', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['activeVersion', subjectId] });
    },
  });
}
