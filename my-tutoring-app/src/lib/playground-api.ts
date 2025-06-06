// lib/playground-api.ts

/**
 * Interface for the payload sent to the Gemini API
 */
export interface GeminiPayload {
  message: string;
  role: string;
  code?: string;
  codeHasChanged: boolean;
  conversationHistory?: Array<{role: string, text: string}>;
}

/**
 * Interface for the response from the Gemini API
 */
export interface GeminiResponse {
  explanation: string;
  code: string;
  thinking_info?: string;
}

/**
 * Interface for a code snippet
 */
export interface CodeSnippet {
  id: string;
  title: string;
  code: string;
  description: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Add syllabus metadata fields
  unit_id?: string;
  unit_title?: string;
  skill_id?: string;
  skill_description?: string;
  subskill_id?: string;
  subskill_description?: string;
}

/**
 * Interface for saving a code snippet
 */
export interface SaveCodePayload {
  title: string;
  code: string;
  description: string;
  tags: string[];
  // Add syllabus metadata fields
  unit_id?: string;
  unit_title?: string;
  skill_id?: string;
  skill_description?: string;
  subskill_id?: string;
  subskill_description?: string;
}

/**
 * Interface for student evaluation request
 */
export interface StudentEvaluationRequest {
  studentId: number;
  exerciseId: string;
  finalCode: string;
  chatInteractions: Array<{role: string, text: string}>;
  programOutput?: any;
  conceptDomain: string;
  exerciseMetadata?: any;
}

/**
 * Interface for student evaluation response
 */
export interface StudentEvaluationResponse {
  evaluationId: string;
  studentId: number;
  exerciseId: string;
  evaluation: string;
  overallGrade: string;
  numericScore?: number;
  criterionScores: number[];
  timestamp: string;
  exerciseData: {
    domain: string;
    title: string;
    [key: string]: any;
  };
}

/**
 * API client for communicating with the FastAPI backend
 */
export const apiClient = {
  /**
   * Send a request to the Gemini API
   * @param payload The payload to send to the API
   * @returns A promise that resolves to the API response
   */
  async sendToGemini(payload: GeminiPayload): Promise<GeminiResponse> {
    try {
      // Use the backend URL from environment variables or default to localhost
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/gemini`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending request to Gemini API:', error);
      throw error;
    }
  },

  /**
   * Save a code snippet
   * @param payload The code snippet to save
   * @param studentId The ID of the student
   * @returns A promise that resolves to the saved code snippet
   */
  async saveCodeSnippet(payload: SaveCodePayload, studentId: number): Promise<CodeSnippet> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/code/save?student_id=${studentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving code snippet:', error);
      throw error;
    }
  },

  /**
   * Get a list of code snippets for a student
   * @param studentId The ID of the student
   * @param limit Optional limit on the number of results
   * @returns A promise that resolves to an array of code snippets
   */
  async getCodeSnippets(studentId: number, limit: number = 100): Promise<CodeSnippet[]> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/code/list?student_id=${studentId}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting code snippets:', error);
      throw error;
    }
  },

  /**
   * Get a specific code snippet
   * @param snippetId The ID of the snippet
   * @param studentId The ID of the student
   * @returns A promise that resolves to the code snippet
   */
  async getCodeSnippet(snippetId: string, studentId: number): Promise<CodeSnippet> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/code/${snippetId}?student_id=${studentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting code snippet:', error);
      throw error;
    }
  },

  /**
   * Update a code snippet
   * @param snippetId The ID of the snippet to update
   * @param payload The updated code snippet
   * @param studentId The ID of the student
   * @returns A promise that resolves to the updated code snippet
   */
  async updateCodeSnippet(snippetId: string, payload: SaveCodePayload, studentId: number): Promise<CodeSnippet> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/code/${snippetId}?student_id=${studentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating code snippet:', error);
      throw error;
    }
  },

  /**
   * Delete a code snippet
   * @param snippetId The ID of the snippet to delete
   * @param studentId The ID of the student
   * @returns A promise that resolves to a success indicator
   */
  async deleteCodeSnippet(snippetId: string, studentId: number): Promise<{success: boolean}> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/code/${snippetId}?student_id=${studentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting snippet:', error);
      throw error;
    }
  },

  /**
   * Submit student work for evaluation
   * @param payload The student evaluation request
   * @returns A promise that resolves to the evaluation response
   */
  async evaluateStudentWork(payload: StudentEvaluationRequest): Promise<StudentEvaluationResponse> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error evaluating student work:', error);
      throw error;
    }
  },

  /**
   * Get evaluations for a student
   * @param studentId The ID of the student
   * @param exerciseId Optional exercise ID to filter by
   * @param limit Optional limit on the number of results
   * @returns A promise that resolves to an array of evaluations
   */
  async getStudentEvaluations(
    studentId: number, 
    exerciseId?: string, 
    limit: number = 10
  ): Promise<any[]> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      let url = `${backendUrl}/api/playground/evaluations?student_id=${studentId}&limit=${limit}`;
      if (exerciseId) {
        url += `&exercise_id=${exerciseId}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting student evaluations:', error);
      throw error;
    }
  },

  /**
   * Get a specific evaluation
   * @param evaluationId The ID of the evaluation
   * @param studentId The ID of the student
   * @returns A promise that resolves to the evaluation
   */
  async getEvaluationById(evaluationId: string, studentId: number): Promise<any> {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/playground/evaluations/${evaluationId}?student_id=${studentId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! Status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting evaluation:', error);
      throw error;
    }
  }
};

export default apiClient;