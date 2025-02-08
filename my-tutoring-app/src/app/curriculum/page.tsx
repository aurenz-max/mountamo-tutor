'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import CurriculumProgress from '@/components/curriculum/CurriculumProgress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CurriculumPage() {
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [curriculum, setCurriculum] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch available subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const availableSubjects = await api.getSubjects();
        setSubjects(availableSubjects);
        if (availableSubjects.length > 0) {
          setSelectedSubject(availableSubjects[0]);
        }
      } catch (err) {
        setError('Failed to load subjects: ' + err.message);
        console.error('Error fetching subjects:', err);
      }
    };

    fetchSubjects();
  }, []);

  // Fetch curriculum and analytics when subject changes
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedSubject) return;

      try {
        setLoading(true);
        const studentId = 1; // You can make this dynamic later

        const [curriculumData, analyticsData] = await Promise.all([
          api.getSubjectCurriculum(selectedSubject),
          api.getStudentAnalytics(studentId, 7, selectedSubject) // 7 days of analytics
        ]);

        setCurriculum(curriculumData.curriculum);
        setAnalytics(analyticsData);
        setError(null);
      } catch (err) {
        setError('Failed to load curriculum: ' + err.message);
        console.error('Error fetching curriculum data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSubject]);

  if (loading && !curriculum) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Subject selector */}
      <div className="w-full max-w-xs">
        <Select
          value={selectedSubject}
          onValueChange={setSelectedSubject}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="text-red-500 p-4 rounded-lg bg-red-50 border border-red-200">
          {error}
        </div>
      ) : (
        curriculum && (
          <CurriculumProgress 
            curriculum={curriculum} 
            analytics={analytics}
          />
        )
      )}
    </div>
  );
}