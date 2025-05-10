// lib/hooks/useLessonContent.ts
import { useState, useEffect } from 'react';

interface LessonSection {
  heading: string;
  content?: string;
  bullets?: string[];
  image?: string;
  image_mime_type?: string;
}

interface LessonContent {
  title: string;
  sections: LessonSection[];
}

export const useLessonContent = (curriculum: {
  subject: string;
  skill?: { description: string };
  subskill?: { description: string };
}, ageGroup: string) => {
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const response = await fetch('/api/gemini/generate_lesson', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: curriculum.subject,
            skill: curriculum.skill?.description || '',
            subskill: curriculum.subskill?.description,
            age_group: ageGroup,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate lesson');
        }

        const data = await response.json();
        
        // Transform the API response to match your frontend structure
        const sections: LessonSection[] = data.explanation.sections.map((section: any) => {
          const lessonSection: LessonSection = {
            heading: `Section ${section.section_number}`,
            content: section.text,
          };

          // Add image if available
          if (section.image) {
            lessonSection.image = `data:${section.image_mime_type};base64,${section.image}`;
          }

          // Parse text to extract bullet points if they exist
          if (section.text.includes('\n•') || section.text.includes('\n-')) {
            const lines = section.text.split('\n');
            const bullets: string[] = [];
            let content = '';
            
            lines.forEach(line => {
              if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                bullets.push(line.trim().substring(1).trim());
              } else {
                content += line + '\n';
              }
            });

            if (bullets.length > 0) {
              lessonSection.bullets = bullets;
              lessonSection.content = content.trim();
            }
          }

          return lessonSection;
        });

        setLessonContent({
          title: `Understanding ${data.explanation.skill || curriculum.subject}`,
          sections,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lesson');
      } finally {
        setLoading(false);
      }
    };

    fetchLesson();
  }, [curriculum, ageGroup]);

  return { lessonContent, loading, error };
};