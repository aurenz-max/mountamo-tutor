'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ClipboardCheck, BookOpen, Clock, BarChart3 } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import { useAuth } from '@/contexts/AuthContext';

interface Subject {
  id: string;
  name: string;
  description?: string;
  available_question_count?: number;
}

const AssessmentsHubPage = () => {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [questionCount, setQuestionCount] = useState(15);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && userProfile) {
      loadSubjects();
    }
  }, [user, userProfile]);

  const loadSubjects = async () => {
    try {
      setError(null);
      const response = await authApi.getAssessmentSubjects();
      // Transform the response to match our interface
      const subjectsData = response.available_subjects || [];
      const transformedSubjects = subjectsData.map((subject: any) => ({
        id: subject,
        name: subject,
        description: `Practice assessment for ${subject}`,
        available_question_count: 25 // Default max questions
      }));
      setSubjects(transformedSubjects);
    } catch (err: any) {
      console.error('Error loading subjects:', err);
      setError(err.message || 'Failed to load available subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssessment = async () => {
    if (!selectedSubject || !user || !userProfile) return;

    try {
      setCreating(true);
      setError(null);

      const assessmentData = await authApi.createAssessment(selectedSubject.name, {
        student_id: userProfile.student_id,
        question_count: questionCount
      });

      // Navigate to the assessment player (data will be fetched from API)
      router.push(`/assessments/take/${assessmentData.assessment_id}`);
    } catch (err: any) {
      console.error('Error creating assessment:', err);
      setError(err.message || 'Failed to create assessment');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Assessments</h2>
            <p className="text-gray-500">Fetching available subjects...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <ClipboardCheck className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Subject Assessments</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Take personalized assessments to review your knowledge, identify areas for improvement,
            and track your progress across different subjects.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <Button
              variant="outline"
              onClick={loadSubjects}
              className="mt-2"
              size="sm"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Subjects Grid */}
        {subjects.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Subjects Available</h3>
            <p className="text-gray-500 mb-4">
              There are currently no subjects available for assessment. Please check back later.
            </p>
            <Button onClick={loadSubjects} variant="outline">
              Refresh
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((subject) => (
              <Card key={subject.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <BookOpen className="h-5 w-5 mr-2 text-blue-600" />
                    {subject.name}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {subject.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Up to {subject.available_question_count} questions available
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      ~30-60 minutes
                    </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          className="w-full"
                          onClick={() => setSelectedSubject(subject)}
                        >
                          Start Assessment
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Configure {subject.name} Assessment</DialogTitle>
                          <DialogDescription>
                            Choose how many questions you'd like in your assessment.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Number of Questions
                            </label>
                            <Select
                              value={questionCount.toString()}
                              onValueChange={(value) => setQuestionCount(parseInt(value))}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10 questions (~20 minutes)</SelectItem>
                                <SelectItem value="15">15 questions (~30 minutes)</SelectItem>
                                <SelectItem value="20">20 questions (~40 minutes)</SelectItem>
                                <SelectItem value="25">25 questions (~50 minutes)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Assessment Features:</h4>
                            <ul className="text-sm text-blue-800 space-y-1">
                              <li>• Personalized questions based on your learning history</li>
                              <li>• Focus on your weak spots and recent practice areas</li>
                              <li>• Immediate feedback and detailed explanations</li>
                              <li>• XP rewards based on performance</li>
                            </ul>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button
                            onClick={handleCreateAssessment}
                            disabled={creating}
                            className="flex-1"
                          >
                            {creating ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Creating Assessment...
                              </>
                            ) : (
                              'Start Assessment'
                            )}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Stats Section */}
        {subjects.length > 0 && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6 text-center">
                <BookOpen className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-semibold text-lg">{subjects.length} Subjects</h3>
                <p className="text-gray-600 text-sm">Available for assessment</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Clock className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-semibold text-lg">Quick Reviews</h3>
                <p className="text-gray-600 text-sm">10-25 question assessments</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <BarChart3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <h3 className="font-semibold text-lg">Personalized</h3>
                <p className="text-gray-600 text-sm">Based on your learning data</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentsHubPage;