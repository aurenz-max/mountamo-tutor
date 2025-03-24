export interface ReadAlongRequest {
    session_id?: string;
    student_id: number;
    student_grade: string;
    student_interests: string[];
    reading_level: number;
    theme?: string;
    with_image: boolean;
  }
  
  export interface ReadAlongContent {
    id: string;
    type: string;
    session_id: string;
    text_content: string;
    reading_instructions: string;
    image_base64?: string;
    mime_type?: string;
    reading_level?: number;
    timestamp?: string;
  }
  
  export interface ReadAlongResponse {
    status: string;
    message?: string;
    data?: ReadAlongContent;
  }
  
  export interface ReadAlongFormData {
    studentId: number;
    studentGrade: string;
    readingLevel: number;
    theme: string;
    withImage: boolean;
    studentInterests: string[];
  }