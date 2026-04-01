/**
 * React hooks for Curriculum Authoring
 * Uses React Query for efficient server state management
 *
 * All subject-scoped hooks require grade alongside subject_id.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { curriculumAuthoringAPI } from './api';
import { curriculumGraphAPI } from './graphApi';
import type {
  Subject, SubjectCreate, SubjectUpdate,
  Unit, UnitCreate, UnitUpdate,
  Skill, SkillCreate, SkillUpdate,
  Subskill, SubskillCreate, SubskillUpdate,
  CurriculumTree,
  PrerequisiteCreate, EntityType,
  GenerateUnitRequest, GenerateSkillRequest,
  SuggestPrerequisitesRequest, ImproveDescriptionRequest,
  PublishRequest,
  Primitive, PrimitiveCategory
} from '@/types/curriculum-authoring';

// ==================== QUERY KEYS ====================

export const QUERY_KEYS = {
  subjects: (includeDrafts?: boolean) => ['subjects', { includeDrafts }] as const,
  subject: (subjectId: string, grade: string) => ['subject', subjectId, grade] as const,
  curriculumTree: (subjectId: string, grade: string, includeDrafts?: boolean) =>
    ['curriculumTree', subjectId, grade, { includeDrafts }] as const,
  units: (subjectId: string, grade: string, includeDrafts?: boolean) =>
    ['units', subjectId, grade, { includeDrafts }] as const,
  unit: (unitId: string, grade: string, subjectId: string) => ['unit', unitId, grade, subjectId] as const,
  skills: (unitId: string, grade: string, subjectId: string, includeDrafts?: boolean) =>
    ['skills', unitId, grade, subjectId, { includeDrafts }] as const,
  subskills: (skillId: string, grade: string, subjectId: string, includeDrafts?: boolean) =>
    ['subskills', skillId, grade, subjectId, { includeDrafts }] as const,
  entityPrerequisites: (entityId: string, entityType: EntityType, grade: string, subjectId: string, includeDrafts?: boolean) =>
    ['entityPrerequisites', entityId, entityType, grade, subjectId, { includeDrafts }] as const,
  subjectGraph: (subjectId: string, grade: string, includeDrafts?: boolean) =>
    ['subjectGraph', subjectId, grade, { includeDrafts }] as const,
  baseSkills: (subjectId: string, grade: string) => ['baseSkills', subjectId, grade] as const,
  draftChanges: (subjectId: string, grade: string) => ['draftChanges', subjectId, grade] as const,
  versionHistory: (subjectId: string, grade: string) => ['versionHistory', subjectId, grade] as const,
  activeVersion: (subjectId: string, grade: string) => ['activeVersion', subjectId, grade] as const,
  graphStatus: (subjectId: string, grade: string) => ['graphStatus', subjectId, grade] as const,
  cachedSubjects: () => ['cachedSubjects'] as const,
  allCachedGraphs: () => ['allCachedGraphs'] as const,
  primitives: () => ['primitives'] as const,
};

// ==================== CURRICULUM HOOKS ====================

export function useSubjects(includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.subjects(includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSubjects(includeDrafts),
  });
}

export function useSubject(subjectId: string, grade: string) {
  return useQuery({
    queryKey: QUERY_KEYS.subject(subjectId, grade),
    queryFn: () => curriculumAuthoringAPI.getSubject(subjectId, grade),
    enabled: !!subjectId && !!grade,
  });
}

export function useCurriculumTree(subjectId: string, grade: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.curriculumTree(subjectId, grade, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getCurriculumTree(subjectId, grade, includeDrafts),
    enabled: !!subjectId && !!grade,
  });
}

export function useUnits(subjectId: string, grade: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.units(subjectId, grade, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getUnits(subjectId, grade, includeDrafts),
    enabled: !!subjectId && !!grade,
  });
}

export function useUnit(unitId: string, grade: string, subjectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.unit(unitId, grade, subjectId),
    queryFn: () => curriculumAuthoringAPI.getUnit(unitId, grade, subjectId),
    enabled: !!unitId && !!grade && !!subjectId,
  });
}

export function useSkills(unitId: string, grade: string, subjectId: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.skills(unitId, grade, subjectId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSkills(unitId, grade, subjectId, includeDrafts),
    enabled: !!unitId && !!grade && !!subjectId,
  });
}

export function useSubskills(skillId: string, grade: string, subjectId: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.subskills(skillId, grade, subjectId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSubskills(skillId, grade, subjectId, includeDrafts),
    enabled: !!skillId && !!grade && !!subjectId,
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
    mutationFn: ({ subjectId, data, grade }: { subjectId: string; data: SubjectUpdate; grade: string }) =>
      curriculumAuthoringAPI.updateSubject(subjectId, data, grade),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, grade }: { data: UnitCreate; grade: string }) =>
      curriculumAuthoringAPI.createUnit(data, grade),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['units', result.subject_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree', result.subject_id] });
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, data, grade, subjectId }: { unitId: string; data: UnitUpdate; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.updateUnit(unitId, data, grade, subjectId),
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
    mutationFn: ({ unitId, grade, subjectId }: { unitId: string; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.deleteUnit(unitId, grade, subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, grade, subjectId }: { data: SkillCreate; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.createSkill(data, grade, subjectId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['skills', result.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useUpdateSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ skillId, data, grade, subjectId }: { skillId: string; data: SkillUpdate; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.updateSkill(skillId, data, grade, subjectId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['skills', result.unit_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useDeleteSkill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ skillId, grade, subjectId }: { skillId: string; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.deleteSkill(skillId, grade, subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useCreateSubskill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ data, grade, subjectId }: { data: SubskillCreate; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.createSubskill(data, grade, subjectId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subskills', result.skill_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useUpdateSubskill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subskillId, data, grade, subjectId }: { subskillId: string; data: SubskillUpdate; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.updateSubskill(subskillId, data, grade, subjectId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['subskills', result.skill_id] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

export function useDeleteSubskill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subskillId, grade, subjectId }: { subskillId: string; grade: string; subjectId: string }) =>
      curriculumAuthoringAPI.deleteSubskill(subskillId, grade, subjectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subskills'] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree'] });
    },
  });
}

// ==================== PREREQUISITE HOOKS ====================

export function useEntityPrerequisites(
  entityId: string,
  entityType: EntityType,
  grade: string,
  subjectId: string,
  includeDrafts: boolean = false,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: QUERY_KEYS.entityPrerequisites(entityId, entityType, grade, subjectId, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getEntityPrerequisites(entityId, entityType, grade, subjectId, includeDrafts),
    enabled: (options?.enabled ?? true) && !!entityId && !!entityType && !!grade && !!subjectId,
  });
}

export function useSubjectGraph(subjectId: string, grade: string, includeDrafts: boolean = false) {
  return useQuery({
    queryKey: QUERY_KEYS.subjectGraph(subjectId, grade, includeDrafts),
    queryFn: () => curriculumAuthoringAPI.getSubjectGraph(subjectId, grade, includeDrafts),
    enabled: !!subjectId && !!grade,
  });
}

export function useBaseSkills(subjectId: string, grade: string) {
  return useQuery({
    queryKey: QUERY_KEYS.baseSkills(subjectId, grade),
    queryFn: () => curriculumAuthoringAPI.getBaseSkills(subjectId, grade),
    enabled: !!subjectId && !!grade,
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

export function useDraftChanges(subjectId: string, grade: string) {
  return useQuery({
    queryKey: QUERY_KEYS.draftChanges(subjectId, grade),
    queryFn: () => curriculumAuthoringAPI.getDraftChanges(subjectId, grade),
    enabled: !!subjectId && !!grade,
  });
}

export function usePublishSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, request, grade }: { subjectId: string; request: PublishRequest; grade: string }) =>
      curriculumAuthoringAPI.publishSubject(subjectId, request, grade),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['draftChanges', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['versionHistory', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['activeVersion', subjectId] });
    },
  });
}

export function useVersionHistory(subjectId: string, grade: string) {
  return useQuery({
    queryKey: QUERY_KEYS.versionHistory(subjectId, grade),
    queryFn: () => curriculumAuthoringAPI.getVersionHistory(subjectId, grade),
    enabled: !!subjectId && !!grade,
  });
}

export function useActiveVersion(subjectId: string, grade: string) {
  return useQuery({
    queryKey: QUERY_KEYS.activeVersion(subjectId, grade),
    queryFn: () => curriculumAuthoringAPI.getActiveVersion(subjectId, grade),
    enabled: !!subjectId && !!grade,
  });
}

export function useRollbackVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, versionId, grade }: { subjectId: string; versionId: string; grade: string }) =>
      curriculumAuthoringAPI.rollbackVersion(subjectId, versionId, grade),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['subject', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['curriculumTree', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['versionHistory', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['activeVersion', subjectId] });
    },
  });
}

// ==================== DEPLOYMENT HOOKS ====================

export function useDeployCurriculum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, versionId }: { subjectId: string; versionId?: string }) =>
      curriculumAuthoringAPI.deployCurriculum(subjectId, versionId),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['deployStatus', subjectId] });
    },
  });
}

export function useDeployStatus(subjectId: string) {
  return useQuery({
    queryKey: ['deployStatus', subjectId],
    queryFn: () => curriculumAuthoringAPI.getDeployStatus(subjectId),
    enabled: !!subjectId,
  });
}

// ==================== PRIMITIVE HOOKS ====================

export function usePrimitives() {
  return useQuery({
    queryKey: QUERY_KEYS.primitives(),
    queryFn: () => curriculumAuthoringAPI.getPrimitives(),
    staleTime: 1000 * 60 * 60, // 1 hour - primitives rarely change
  });
}


// ==================== GRAPH CACHING HOOKS ====================

export function useGraphStatus(subjectId: string, grade: string) {
  return useQuery({
    queryKey: QUERY_KEYS.graphStatus(subjectId, grade),
    queryFn: () => curriculumGraphAPI.getGraphStatus(subjectId, grade),
    enabled: !!subjectId && !!grade,
  });
}

export function useCachedSubjects() {
  return useQuery({
    queryKey: QUERY_KEYS.cachedSubjects(),
    queryFn: () => curriculumGraphAPI.listCachedSubjects(),
  });
}

export function useRegenerateGraph() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, grade, includeDrafts }: { subjectId: string; grade: string; includeDrafts?: boolean }) =>
      curriculumGraphAPI.regenerateGraph(subjectId, grade, includeDrafts),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['graphStatus', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subjectGraph', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['cachedSubjects'] });
    },
  });
}

export function useRegenerateAllGraphs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, grade }: { subjectId: string; grade: string }) =>
      curriculumGraphAPI.regenerateAllVersions(subjectId, grade),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['graphStatus', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subjectGraph', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['cachedSubjects'] });
    },
  });
}

export function useInvalidateGraphCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subjectId, grade, versionType }: { subjectId: string; grade: string; versionType?: 'draft' | 'published' }) =>
      curriculumGraphAPI.invalidateCache(subjectId, grade, versionType),
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ['graphStatus', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subjectGraph', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['cachedSubjects'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allCachedGraphs() });
    },
  });
}

export function useAllCachedGraphs() {
  return useQuery({
    queryKey: QUERY_KEYS.allCachedGraphs(),
    queryFn: () => curriculumGraphAPI.listAllCachedGraphs(),
  });
}

export function useDeleteAllCachedGraphs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => curriculumGraphAPI.deleteAllCachedGraphs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allCachedGraphs() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cachedSubjects() });
      queryClient.invalidateQueries({ queryKey: ['graphStatus'] });
      queryClient.invalidateQueries({ queryKey: ['subjectGraph'] });
    },
  });
}

export function useDeleteGraphsByIds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentIds: string[]) => curriculumGraphAPI.deleteGraphsByIds(documentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allCachedGraphs() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cachedSubjects() });
      queryClient.invalidateQueries({ queryKey: ['graphStatus'] });
      queryClient.invalidateQueries({ queryKey: ['subjectGraph'] });
    },
  });
}
