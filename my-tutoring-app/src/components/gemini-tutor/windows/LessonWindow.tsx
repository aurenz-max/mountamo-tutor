// components/gemini-tutor/windows/LessonWindow.tsx
import React, { useState, useEffect } from 'react';
import { Book } from 'lucide-react';
import DraggableWindow from '../ui/DraggableWindow';

interface LessonWindowProps {
  initialCurriculum: {
    subject: string;
    skill?: { description: string };
    subskill?: { description: string };
  };
  ageGroup: string;
}

export const LessonWindow: React.FC<LessonWindowProps> = ({ initialCurriculum, ageGroup }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [lessonContent, setLessonContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLesson = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8000/api/gemini/generate_lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: initialCurriculum.subject,
          skill: initialCurriculum.skill?.description || '',
          subskill: initialCurriculum.subskill?.description,
          age_group: ageGroup,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate lesson');
      
      const data = await response.json();
      
      // Transform the response
      const sections = data.explanation.sections.map((section: any) => ({
        id: section.section_number,
        heading: `Section ${section.section_number}`,
        content: section.text,
        image: section.image ? `data:${section.image_mime_type};base64,${section.image}` : null,
        bullets: parseBullets(section.text)
      }));

      setLessonContent({
        title: `Understanding ${data.explanation.skill || initialCurriculum.subject}`,
        sections
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lesson');
    } finally {
      setLoading(false);
    }
  };

  const parseBullets = (text: string) => {
    const lines = text.split('\n');
    const bullets: string[] = [];
    
    lines.forEach(line => {
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        bullets.push(line.trim().substring(1).trim());
      }
    });
    
    return bullets.length > 0 ? bullets : null;
  };

  useEffect(() => {
    if (isVisible && !lessonContent) {
      fetchLesson();
    }
  }, [isVisible]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`p-2 rounded-lg transition-colors ${
          isVisible ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
        } hover:bg-gray-200`}
      >
        <Book className="w-5 h-5" />
      </button>

      {/* Window */}
      {isVisible && (
        <DraggableWindow
          id="lesson"
          title={lessonContent?.title || "Loading Lesson..."}
          icon={<Book className="w-4 h-4 text-blue-600" />}
          defaultPosition={{ x: 50, y: 100 }}
          onClose={() => setIsVisible(false)}
          width="w-96"
        >
          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Generating lesson content...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 p-3 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {lessonContent && !loading && (
              lessonContent.sections.map((section: any) => (
                <div key={section.id} className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">{section.heading}</h3>
                  
                  {section.content && !section.bullets && (
                    <p className="text-sm text-gray-600 mb-2">{section.content}</p>
                  )}
                  
                  {section.image && (
                    <img 
                      src={section.image} 
                      alt={`${section.heading} illustration`}
                      className="w-full rounded-lg mb-2"
                    />
                  )}
                  
                  {section.bullets && (
                    <ul className="space-y-1">
                      {section.bullets.map((bullet: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </DraggableWindow>
      )}
    </>
  );
};