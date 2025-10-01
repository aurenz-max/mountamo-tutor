// lib/curriculumApi.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
  ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/curriculum`
  : 'http://localhost:8000/api/curriculum';

/**
 * Fetches all available curriculum subjects
 */
export async function fetchSubjects() {
  try {
    const response = await fetch(`${API_BASE_URL}/subjects`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch subjects: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching subjects:', error);
    throw error;
  }
}

/**
 * Fetches the complete curriculum structure for a specific subject
 * @param subject - The name of the curriculum subject (e.g., "Mathematics")
 */
export async function fetchCurriculum(subject: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/curriculum/${subject}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch curriculum: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching curriculum for ${subject}:`, error);
    throw error;
  }
}

/**
 * Fetches all available problem types (subskills) for a specific subject
 * @param subject - The name of the curriculum subject (e.g., "Mathematics")
 */
export async function fetchSubskills(subject: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/subskills/${subject}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch subskills: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching subskills for ${subject}:`, error);
    throw error;
  }
}

/**
 * Fetches detailed learning objectives for a specific subskill within a subject
 * @param subject - The name of the curriculum subject (e.g., "Mathematics")
 * @param subskillId - The ID of the subskill (e.g., "GEOM001-02-G")
 */
export async function fetchObjectives(subject: string, subskillId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/objectives/${subject}/${subskillId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch objectives: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching objectives for ${subject}/${subskillId}:`, error);
    throw error;
  }
}

/**
 * Type definitions for the curriculum data structure
 */
export interface CurriculumSubject {
  subject: string;
  curriculum: CurriculumDomain[];
}

export interface CurriculumDomain {
  id: string;
  title: string;
  skills: CurriculumSkill[];
}

export interface CurriculumSkill {
  id: string;
  description: string;
  subskills: CurriculumSubskill[];
}

export interface CurriculumSubskill {
  id: string;
  description: string;
  difficulty_range: {
    start: number;
    end: number;
    target: number;
  };
}

export interface LearningObjectives {
  subject: string;
  subskill_id: string;
  objectives: {
    ConceptGroup?: string;
    DetailedObjective?: string;
    SubskillDescription?: string;
  };
}