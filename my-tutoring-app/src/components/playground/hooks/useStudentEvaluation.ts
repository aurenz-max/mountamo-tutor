// components/playground/hooks/useStudentEvaluation.ts
import { useState } from 'react';
import apiClient, { 
  StudentEvaluationRequest, 
  StudentEvaluationResponse 
} from '@/lib/playground-api';

interface UseStudentEvaluationProps {
  studentId: number;
}

export function useStudentEvaluation({ studentId }: UseStudentEvaluationProps) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<StudentEvaluationResponse | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [isLoadingEvaluations, setIsLoadingEvaluations] = useState(false);

  /**
   * Submit student work for evaluation
   */
  const submitForEvaluation = async (
    code: string, 
    messages: Array<{role: string, text: string}>,
    exerciseId: string,
    conceptDomain: string,
    exerciseMetadata?: any
  ) => {
    setIsEvaluating(true);
    setEvaluationError(null);
    
    try {
      const payload: StudentEvaluationRequest = {
        studentId,
        exerciseId,
        finalCode: code,
        chatInteractions: messages,
        conceptDomain,
        exerciseMetadata
      };
      
      const result = await apiClient.evaluateStudentWork(payload);
      setEvaluationResult(result);
      return result;
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : 'Failed to evaluate work');
      throw error;
    } finally {
      setIsEvaluating(false);
    }
  };

  /**
   * Load evaluations for this student
   */
  const loadEvaluations = async (exerciseId?: string) => {
    setIsLoadingEvaluations(true);
    
    try {
      const results = await apiClient.getStudentEvaluations(studentId, exerciseId);
      setEvaluations(results);
      return results;
    } catch (error) {
      console.error('Error loading evaluations:', error);
      setEvaluations([]);
      return [];
    } finally {
      setIsLoadingEvaluations(false);
    }
  };

  /**
   * Load a specific evaluation by ID
   */
  const loadEvaluation = async (evaluationId: string) => {
    try {
      const result = await apiClient.getEvaluationById(evaluationId, studentId);
      setEvaluationResult(result);
      return result;
    } catch (error) {
      console.error('Error loading evaluation:', error);
      setEvaluationError(error instanceof Error ? error.message : 'Failed to load evaluation');
      return null;
    }
  };

  /**
   * Clear the current evaluation result
   */
  const clearEvaluation = () => {
    setEvaluationResult(null);
    setEvaluationError(null);
  };

  return {
    isEvaluating,
    evaluationResult,
    evaluationError,
    evaluations,
    isLoadingEvaluations,
    submitForEvaluation,
    loadEvaluations,
    loadEvaluation,
    clearEvaluation
  };
}

export default useStudentEvaluation;