const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
  ? `${process.env.NEXT_PUBLIC_API_BASE_URL}/api`
  : 'http://localhost:8000/api';


export interface TutoringSession {
  session_id: string;
  initial_message: string;
}

export interface SessionResponse {
  tutor_response: string;
}

export interface Problem {
  problem_type: string;
  problem: string;
  answer: string;
  success_criteria: string[];
  teaching_note: string;
}

export interface ProblemAttempt {
  student_id: number;
  problem_id: string;
  answer: string;
  success_criteria_met: boolean[];
}

export interface ProblemSubmission {
  subject: string;
  problem: any; // Full problem object, not just string
  solution_image: string;  // Base64 encoded image
  skill_id: string;
  student_answer?: string;
  canvas_used?: boolean;
  student_id: number; // Required now
  subskill_id?: string;
}


export interface ProblemReview {
  observation: {
    canvas_description: string;
    selected_answer: string;
    work_shown: string;
  };
  analysis: {
    understanding: string;
    approach: string;
    accuracy: string;
    creativity: string;
  };
  evaluation: {
    score: number;
    justification: string;
  } | number;  // Support both structured and simple numeric formats
  feedback: {
    praise: string;
    guidance: string;
    encouragement: string;
    next_steps: string;
  } | string;  // Support both structured and simple string formats
  skill_id: string;
  subject: string;
  subskill_id?: string;
}

export interface DailyProgress {
  day: string;
  date: string;
  competency: number;
  timeSpent: number;
  problems: number;
}

export interface SkillCompetency {
  skill: string;
  score: number;
}

export interface DetailedAnalytics {
  currentStats: {
    totalProblems: number;
    averageScore: number;
    credibility: number;
    subSkills: {
      [key: string]: {
        problems: number;
        averageScore: number;
      };
    };
  };
  progressionData: Array<{
    problems: number;
    score: number;
    credibility: number;
  }>;
}

export interface StudentAnalytics {
  dailyProgress: DailyProgress[];
  skillCompetencies: SkillCompetency[];
  detailedAnalytics: DetailedAnalytics;
}

export interface SessionRequest {
  subject: string;
  skill_description: string;
  subskill_description: string;
  student_id: number;
  competency_score: number;
}

export interface SessionResponse {
  response: string;
  context?: {
    subject: string;
    unit_id: string;
    skill_id: string;
    subskill_id: string;
  };
}

export interface DifficultyUpdate {
  student_id: number;
  subject: string;
  unit_id?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty: number;
}



interface ProblemGenerationRequest {
  subject: string;  // Only subject remains required
  unit?: {
    title?: string;
    id: string;
  };
  skill?: {
    description?: string;
    id: string;
  };
  subskill?: {
    id?: string;
    description?: string;
  };
  difficulty?: number;
  concept_group?: string;
  detailed_objective?: string;
}

export interface DecisionTreeData { // New interface for decision tree data
  learning_path_decision_tree: { [skillId: string]: string[] };
}

export interface NextRecommendationResponse {
  current_skill: string | null;
  recommended_skills: string[];
  rationale: string;
  competency_data?: {
    current_score: number;
    credibility: number;
    total_attempts: number;
  };
}

export interface SkillPrerequisitesResponse {
  skill_id: string;
  prerequisites: string[];
}

export interface ProblemReviewDetails {
  id: string;
  student_id: number;
  subject: string;
  skill_id: string;
  subskill_id: string;
  problem_id: string;
  timestamp: string;
  score: number;
  problem_content?: {
    problem_type?: string;
    problem?: string;
    answer?: string;
    success_criteria?: string[];
    teaching_note?: string;
    metadata?: {
      unit?: {
        id?: string;
        title?: string;
      };
      skill?: {
        id?: string;
        description?: string;
      };
      subskill?: {
        id?: string;
        description?: string;
      };
      difficulty?: number;
      objectives?: any;
    };
  };
  feedback_components: {
    observation: any;
    analysis: any;
    evaluation: any;
    feedback: any;
  };
}

export interface ProblemReviewsResponse {
  student_id: number;
  total_reviews: number;
  grouped_reviews: {
    [subject: string]: {
      [skill_id: string]: ProblemReviewDetails[];
    };
  };
  reviews: ProblemReviewDetails[];
}



export const api = {
  // Tutoring endpoints
  async startSession(data: SessionRequest): Promise<TutoringSession> {
    console.log('Starting session with data:', data);
    const response = await fetch(`${API_BASE_URL}/tutoring/session/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error('Failed to start session');
    return response.json();
  },

  async sendResponse(data: { 
    session_id: string; 
    response: string;
    context?: {
      subject: string;
      unit_id: string;
      skill_id: string;
      subskill_id: string;
    };
  }): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE_URL}/tutoring/response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) throw new Error('Failed to send response');
    return response.json();
  },

  async evaluateSession(session_id: string) {
    const response = await fetch(`${API_BASE_URL}/tutoring/session/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id }),
    });
    if (!response.ok) throw new Error('Failed to evaluate session');
    return response.json();
  },


  async submitProblem(data: ProblemSubmission) {
    console.log('API: Submitting problem with image data length:', data.solution_image.length);
    
    try {
      const response = await fetch(`${API_BASE_URL}/problems/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          student_id: data.student_id || 1,  // Default to 1 if not provided
          subskill_id: data.subskill_id || `${data.skill_id}_sub`  // Default derived from skill_id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('API Error:', errorData);
        throw new Error('Failed to submit problem');
      }

      return response.json();
    } catch (error) {
      console.error('Error submitting problem:', error);
      throw error;
    }
  },

  // Problems endpoints
  async generateProblem(data: ProblemGenerationRequest) {
    console.log('Sending problem generation request:', data);
    
    try {
      const requestBody = {
        student_id: 1, // Default value or get from context
        subject: data.subject,
        unit_id: data.unit?.id,
        skill_id: data.skill?.id,
        subskill_id: data.subskill?.id,
        difficulty: data.difficulty
      };
  
      console.log('Sending request body:', requestBody);
  
      const response = await fetch(`${API_BASE_URL}/problems/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Problem generation error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData?.detail || `Failed to generate problem: ${response.statusText}`);
      }
  
      const problemData = await response.json();
      console.log('Problem generation response:', problemData);
      return problemData;
    } catch (error) {
      console.error('Problem generation error:', error);
      throw error;
    }
  },

  async getRecommendedProblems(data: {
    student_id: number;
    subject?: string;
    count?: number;
  }): Promise<Problem[]> {
    const { student_id, subject, count = 3 } = data;
    
    let url = `${API_BASE_URL}/problems/student/${student_id}/recommended-problems`;
    
    // Add optional parameters
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (count !== 3) params.append('count', count.toString());
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    console.log('Fetching recommended problems:', url);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Recommended problems error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData?.detail || `Failed to fetch recommended problems: ${response.statusText}`);
      }
      
      const problemsData = await response.json();
      console.log('Recommended problems response:', problemsData);
      return problemsData;
    } catch (error) {
      console.error('Error fetching recommended problems:', error);
      throw error;
    }
  },

  async getSkillProblems(data: {
    student_id: number;
    subject: string;
    skill_id: string;
    subskill_id: string;
    count?: number;
  }): Promise<Problem[]> {
    const { student_id, subject, skill_id, subskill_id, count = 5 } = data;
    
    let url = `${API_BASE_URL}/problems/skill-problems/${student_id}`;
    
    // Add parameters
    const params = new URLSearchParams();
    params.append('subject', subject);
    params.append('skill_id', skill_id);
    params.append('subskill_id', subskill_id);
    if (count !== 5) params.append('count', count.toString());
    
    url += `?${params.toString()}`;
    
    console.log('Fetching skill-based problems:', url);
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Skill problems error:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData?.detail || `Failed to fetch skill problems: ${response.statusText}`);
      }
      
      const problemsData = await response.json();
      console.log('Skill problems response:', problemsData);
      return problemsData;
    } catch (error) {
      console.error('Error fetching skill problems:', error);
      throw error;
    }
  },
  
  async recordProblemAttempt(data: ProblemAttempt) {
    const response = await fetch(`${API_BASE_URL}/problems/attempt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to record attempt');
    return response.json();
  },
 
  async getStudentProblemProgress(student_id: number) {
    const response = await fetch(`${API_BASE_URL}/problems/student/${student_id}/progress`);
    if (!response.ok) throw new Error('Failed to fetch problem progress');
    return response.json();
  },

  // Curriculum endpoints
  async getSyllabus() {
    const response = await fetch(`${API_BASE_URL}/curriculum/syllabus`);
    if (!response.ok) throw new Error('Failed to fetch syllabus');
    return response.json();
  },

  // Competency endpoints
  async getStudentOverview(student_id: number) {
    const response = await fetch(`${API_BASE_URL}/competency/student/${student_id}`);
    if (!response.ok) throw new Error('Failed to fetch student overview');
    return response.json();
  },

  async updateDifficulty(data: DifficultyUpdate): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/problems/difficulty`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update difficulty');
    }
    
    return response.json();
  },
  // Add missing problem-types endpoint
  async getSubskillTypes(subject: string): Promise<{ problem_types: string[] }> {
    const response = await fetch(
      `${API_BASE_URL}/competency/problem-types/${encodeURIComponent(subject)}`
    );
    if (!response.ok) throw new Error('Failed to fetch problem types');
    return response.json();
  },

// Add this function to your api object
async getProblemReviews(
  studentId: number,
  subject?: string,
  skillId?: string,
  subskillId?: string,
  limit: number = 100
): Promise<ProblemReviewsResponse> {
  let url = `${API_BASE_URL}/competency/student/${studentId}/problem-reviews`;
  
  // Add optional query parameters
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  if (skillId) params.append('skill_id', skillId);
  if (subskillId) params.append('subskill_id', subskillId);
  if (limit !== 100) params.append('limit', limit.toString());
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch problem reviews');
  return response.json();
},

  // Analytics endpoints
  async getStudentAnalytics(studentId: number, days: number = 7, subject: string = 'Mathematics') {
    const response = await fetch(`${API_BASE_URL}/competency/student/${studentId}/progress?days=${days}&subject=${subject}`);
    if (!response.ok) throw new Error('Failed to fetch student analytics');
    return response.json() as Promise<StudentAnalytics>;
  },

  async getDailyProgress(studentId: number, days: number = 7) {
    const response = await fetch(`${API_BASE_URL}/competency/student/${studentId}/daily?days=${days}`);
    if (!response.ok) throw new Error('Failed to fetch daily progress');
    return response.json() as Promise<DailyProgress[]>;
  },

  async getSkillAnalysis(studentId: number, subject: string) {
    const response = await fetch(`${API_BASE_URL}/competency/student/${studentId}/skills/${subject}`);
    if (!response.ok) throw new Error('Failed to fetch skill analysis');
    return response.json() as Promise<SkillCompetency[]>;
  },

  async getDetailedAnalytics(studentId: number, subject: string) {
    const response = await fetch(`${API_BASE_URL}/competency/student/${studentId}/detailed/${subject}`);
    if (!response.ok) throw new Error('Failed to fetch detailed analytics');
    return response.json() as Promise<DetailedAnalytics>;
  },


  // Get available subjects
  async getSubjects(): Promise<string[]> {
    console.log('Fetching subjects from:', `${API_BASE_URL}/competency/subjects`);
    try {
      const response = await fetch(`${API_BASE_URL}/competency/subjects`);
      if (!response.ok) {
        console.error('Subjects API error:', response.status, response.statusText);
        throw new Error('Failed to fetch subjects');
      }
      const data = await response.json();
      console.log('Subjects API response:', data);
      return data;
    } catch (error) {
      console.error('Subjects API error:', error);
      throw error;
    }
  },

  // Get syllabus for a specific subject
  async getSubjectSyllabus(subject: string) {
    const response = await fetch(`${API_BASE_URL}/curriculum/syllabus/${encodeURIComponent(subject)}`);
    if (!response.ok) throw new Error(`Failed to fetch syllabus for ${subject}`);
    return response.json();
  },

  // Add to api.ts interface
async getSubjectCurriculum(subject: string) {
  const response = await fetch(
    `${API_BASE_URL}/competency/curriculum/${encodeURIComponent(subject)}`
  );
  if (!response.ok) throw new Error(`Failed to fetch curriculum for ${subject}`);
  return response.json();
},



async getSkillCompetency(data: { // New function for skill-level competency
  student_id: number;
  subject: string;
  skill: string;
}) {
  const { student_id, subject, skill } = data;
  const url = `${API_BASE_URL}/competency/student/${student_id}/subject/${encodeURIComponent(subject)}/skill/${skill}`; // URL for skill-level endpoint

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch skill competency');
  return response.json() as Promise<any>;
},

async getSubskillCompetency(data: { // New function for subskill-level competency
  student_id: number;
  subject: string;
  skill: string;
  subskill: string;
}) {
  const { student_id, subject, skill, subskill } = data;
  const url = `${API_BASE_URL}/competency/student/${student_id}/subject/${encodeURIComponent(subject)}/skill/${skill}/subskill/${subskill}`; // URL for subskill-level endpoint

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch subskill competency');
  return response.json() as Promise<any>;
},

  async getLearningPaths(): Promise<DecisionTreeData> { // Updated return type to DecisionTreeData
    try {
       const response = await fetch(`${API_BASE_URL}/learning-paths`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json(); // Parse JSON and assign to 'data'
      console.log('Data after response.json() in api.ts:'); // ADD THIS LINE
      console.dir(data); // ADD THIS LINE - Use console.dir() to inspect 'data' in api.ts
      return data as DecisionTreeData; 
    } catch (error) {
      console.error('Error fetching learning paths:', error);
      throw error;
    }
  },


  
// WebSocket connection helper for STT
connectSTT(): WebSocket {
  const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
  const ws = new WebSocket(`${wsBaseUrl}/api/stt/stream`);
  
  ws.onopen = () => {
    console.log('STT WebSocket connected');
    ws.send(JSON.stringify({
      config: {
        sample_rate: 24000,
        channels: 1,
        language_code: 'en-US'
      }
    }));
  };

  return ws;
},

  getAdvancedRecommendations: async ({ student_id, subject, limit = 5 }: { student_id: number; subject: string; limit?: number }) => {
    try {
      console.log(`Fetching advanced recommendations: ${API_BASE_URL}/analytics/student/${student_id}/recommendations?subject=${subject}&limit=${limit}`);

      const response = await fetch(
        `${API_BASE_URL}/analytics/student/${student_id}/recommendations?subject=${subject}&limit=${limit}`
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error getting recommendations: ${response.status} - ${errorText}`);
      }
      
      const recommendations = await response.json();
      console.log("Advanced recommendations response:", recommendations);
      
      return recommendations;
    } catch (error) {
      console.error("Failed to fetch advanced recommendations:", error);
      throw error;
    }
  },
  
  
  async getNextRecommendations(params: {
    student_id: number;
    subject: string;
    current_skill_id?: string;
    current_subskill_id?: string;
  }): Promise<NextRecommendationResponse> {
    const { student_id, subject } = params;
    let url = `${API_BASE_URL}/student/${student_id}/subject/${encodeURIComponent(subject)}/recommendations`;
    
    // Add optional parameters as query params
    if (params.current_skill_id || params.current_subskill_id) {
      const queryParams = new URLSearchParams();
      if (params.current_skill_id) {
        queryParams.append('current_skill_id', params.current_skill_id);
      }
      if (params.current_subskill_id) {
        queryParams.append('current_subskill_id', params.current_subskill_id);
      }
      url += `?${queryParams}`;
    }
  
    try {
      console.log('Fetching recommendations:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch next recommendations: ${response.statusText}. ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Recommendations response:', data);
      return data;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }
  },

  async getSkillPrerequisites(skillId: string): Promise<SkillPrerequisitesResponse> {
    const response = await fetch(`/api/learning-paths/prerequisites/${skillId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch skill prerequisites');
    }
    return response.json();
  },
}