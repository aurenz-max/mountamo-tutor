'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Clock, CheckCircle, Loader2 } from 'lucide-react';
import ProblemRenderer from '@/components/practice/ProblemRenderer';
import { authApi } from '@/lib/authApiClient';
import { useAuth } from '@/contexts/AuthContext';

interface AssessmentData {
  assessment_id: string;
  student_id: number;
  subject: string;
  total_questions: number;
  estimated_duration_minutes: number;
  blueprint: any;
  problems: any[];
  generated_at: string;
}

interface AssessmentPlayerProps {
  assessmentData: AssessmentData;
}

const AssessmentPlayer: React.FC<AssessmentPlayerProps> = ({ assessmentData }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(new Date());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentProblem = assessmentData.problems[currentIndex];
  const progress = ((currentIndex + 1) / assessmentData.total_questions) * 100;
  const isLastQuestion = currentIndex === assessmentData.total_questions - 1;

  useEffect(() => {
    // Prevent navigation away from the page
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleUpdate = (data: any) => {
    const problemId = currentProblem.id || currentProblem.problem_id || `problem_${currentIndex}`;
    setAnswers(prev => ({
      ...prev,
      [problemId]: data
    }));
  };

  const handleNext = () => {
    if (currentIndex < assessmentData.total_questions - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleFinishAssessment = async () => {
    if (!user) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const endTime = new Date();
      const timeTakenMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      // Prepare batch submission data
      const submissions = assessmentData.problems.map((problem: any, index: number) => {
        const problemId = problem.id || problem.problem_id || `problem_${index}`;
        const answer = answers[problemId];

        // For structured problems (MC, TF, etc.), prioritize primitive_response
        // For open-ended problems, use student_answer
        let studentAnswer = answer?.student_answer;
        let primitiveResponse = answer?.primitive_response;

        // If answer has selected_option_id directly (from MCQPrimitive), treat it as primitive_response
        if (answer?.selected_option_id && !primitiveResponse) {
          primitiveResponse = { selected_option_id: answer.selected_option_id };
        }

        // If answer has selected_answer directly (from TrueFalsePrimitive), treat it as primitive_response
        if (answer?.selected_answer !== undefined && !primitiveResponse) {
          primitiveResponse = {
            selected_answer: answer.selected_answer,
            explanation: answer.explanation || ''
          };
        }

        // If answer has student_categorization (from CategorizationPrimitive), treat it as primitive_response
        if (answer?.student_categorization && !primitiveResponse) {
          primitiveResponse = answer.student_categorization;
        }

        // If we have primitive_response but no student_answer, use the primitive_response as student_answer
        if (primitiveResponse && !studentAnswer) {
          studentAnswer = typeof primitiveResponse === 'string' ? primitiveResponse : JSON.stringify(primitiveResponse);
        }

        return {
          subject: assessmentData.subject,
          problem: problem, // Send original problem structure, not processed one
          skill_id: problem.skill_id || problem.problem_data?.skill_id || 'unknown',
          subskill_id: problem.subskill_id || problem.problem_data?.subskill_id,
          student_answer: studentAnswer,
          primitive_response: primitiveResponse,
          canvas_used: answer?.canvas_used || false,
          solution_image: answer?.solution_image
        };
      });

      const batchRequest = {
        assessment_context: {
          assessment_id: assessmentData.assessment_id,
          subject: assessmentData.subject,
          student_id: assessmentData.student_id
        },
        submissions
      };

      const result = await authApi.submitProblemBatch(batchRequest);

      console.log('Batch assessment submission result:', result);

      // Store results in sessionStorage for the results page
      sessionStorage.setItem(`assessment_results_${assessmentData.assessment_id}`, JSON.stringify(result));

      // Navigate to results page
      router.push(`/assessments/results/${assessmentData.assessment_id}`);
    } catch (err: any) {
      console.error('Error submitting assessment:', err);
      setError(err.message || 'Failed to submit assessment');
    } finally {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
    }
  };

  const getProblemId = (problem: any) => {
    return problem.id || problem.problem_id || `problem_${currentIndex}`;
  };

  const getCurrentResponse = () => {
    const problemId = getProblemId(currentProblem);
    return answers[problemId] || null;
  };

  const getProblemForRenderer = (problem: any) => {
    // Handle the new nested problem schema where actual problem data is in problem_data.full_problem_data
    if (problem?.problem_data?.full_problem_data) {
      return problem.problem_data.full_problem_data;
    }
    // Fallback to the original structure for backward compatibility
    return problem;
  };

  if (!currentProblem) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Assessment Error</h2>
          <p className="text-gray-600 mb-4">Unable to load assessment questions.</p>
          <Button onClick={() => router.push('/assessments')} variant="outline">
            Return to Assessments
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {assessmentData.subject} Assessment
              </h1>
              <p className="text-sm text-gray-600">
                Question {currentIndex + 1} of {assessmentData.total_questions}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="h-4 w-4 mr-1" />
                ~{assessmentData.estimated_duration_minutes} min
              </div>
              <div className="w-32">
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium mr-3">
                {currentIndex + 1}
              </span>
              Assessment Question
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ProblemRenderer
              problem={getProblemForRenderer(currentProblem)}
              isSubmitted={false}
              onSubmit={async () => {}} // No submission during assessment
              onUpdate={handleUpdate}
              currentResponse={getCurrentResponse()}
              feedback={null}
              submitting={false}
              isAssessmentMode={true} // This is the key prop for assessment mode
            />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>Progress:</span>
            <div className="flex space-x-1">
              {Array.from({ length: assessmentData.total_questions }, (_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < currentIndex
                      ? 'bg-green-500'
                      : i === currentIndex
                      ? 'bg-blue-500'
                      : answers[getProblemId(assessmentData.problems[i])]
                      ? 'bg-yellow-500'
                      : 'bg-gray-300'
                  }`}
                  title={
                    i < currentIndex
                      ? 'Completed'
                      : i === currentIndex
                      ? 'Current'
                      : answers[getProblemId(assessmentData.problems[i])]
                      ? 'Answered'
                      : 'Not answered'
                  }
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleNext}
            className="flex items-center"
            disabled={isSubmitting}
          >
            {isLastQuestion ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Finish Assessment
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Assessment?</DialogTitle>
            <DialogDescription>
              You've answered {Object.keys(answers).length} out of {assessmentData.total_questions} questions.
              Once submitted, you cannot go back to change your answers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Assessment Summary:</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <div>Subject: {assessmentData.subject}</div>
                <div>Questions: {assessmentData.total_questions}</div>
                <div>Answered: {Object.keys(answers).length}</div>
                <div>
                  Time Taken: ~{Math.ceil((new Date().getTime() - startTime.getTime()) / (1000 * 60))} minutes
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1"
                disabled={isSubmitting}
              >
                Review Answers
              </Button>
              <Button
                onClick={handleFinishAssessment}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Assessment'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssessmentPlayer;