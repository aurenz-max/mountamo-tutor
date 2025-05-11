// components/gemini-tutor/panels/ProblemPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Brain, RefreshCw, Loader2, ChevronLeft, ChevronRight, CheckCircle, TrendingUp } from 'lucide-react';
import DrawingCanvas from '../ui/DrawingCanvas';
import { api } from '@/lib/api';

interface ProblemPanelProps {
  initialCurriculum: {
    subject: string;
    skill?: { id: string; description: string };
    subskill?: { 
      id: string; 
      description: string;
      difficulty_range?: { start: number; end: number; target: number };
    };
  };
  ageGroup: string;
  onSubmit: (problem: any, canvasData?: string) => void;
  studentId?: number;
}

export const ProblemPanel: React.FC<ProblemPanelProps> = ({ 
  initialCurriculum, 
  ageGroup,
  onSubmit,
  studentId = 1
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [problemData, setProblemData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProblemIndex, setCurrentProblemIndex] = useState(0);
  const [problems, setProblems] = useState<any[]>([]);
  const [feedbackData, setFeedbackData] = useState<{
    review: any;
    competency?: any;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<any>(null);

  const fetchProblems = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let fetchedProblems;
      
      if (initialCurriculum.skill?.id && initialCurriculum.subskill?.id) {
        fetchedProblems = await api.getSkillProblems({
          student_id: studentId,
          subject: initialCurriculum.subject,
          skill_id: initialCurriculum.skill.id,
          subskill_id: initialCurriculum.subskill.id,
          count: 5
        });
      } else {
        fetchedProblems = await api.getRecommendedProblems({
          student_id: studentId,
          subject: initialCurriculum.subject,
          count: 3
        });
      }
      
      if (fetchedProblems && fetchedProblems.length > 0) {
        setProblems(fetchedProblems);
        setProblemData(fetchedProblems[0]);
        setCurrentProblemIndex(0);
      } else {
        throw new Error('No problems available');
      }
    } catch (err) {
      console.error('Failed to fetch problems:', err);
      setError(err instanceof Error ? err.message : 'Failed to load problems');
    } finally {
      setLoading(false);
    }
  };

  const fetchSingleProblem = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const problemData = await api.generateProblem({
        subject: initialCurriculum.subject,
        skill: initialCurriculum.skill,
        subskill: initialCurriculum.subskill,
        difficulty: initialCurriculum.subskill?.difficulty_range?.target
      });
      
      setProblemData(problemData);
      setProblems([problemData]);
      setCurrentProblemIndex(0);
    } catch (err) {
      console.error('Failed to generate problem:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate problem');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && problems.length === 0) {
      fetchProblems();
    }
  }, [isOpen]);

  const handleNextProblem = () => {
    if (currentProblemIndex < problems.length - 1) {
      setCurrentProblemIndex(currentProblemIndex + 1);
      setProblemData(problems[currentProblemIndex + 1]);
      setFeedbackData(null);
      if (canvasRef.current) {
        canvasRef.current.clearCanvas();
      }
    }
  };

  const handlePreviousProblem = () => {
    if (currentProblemIndex > 0) {
      setCurrentProblemIndex(currentProblemIndex - 1);
      setProblemData(problems[currentProblemIndex - 1]);
      setFeedbackData(null);
      if (canvasRef.current) {
        canvasRef.current.clearCanvas();
      }
    }
  };

  const handleSubmit = async () => {
    if (problemData) {
      let canvasData = null;
      if (canvasRef.current) {
        canvasData = canvasRef.current.getCanvasData();
      }
      
      if (!canvasData) {
        alert('Please solve the problem on the canvas before submitting.');
        return;
      }

      setIsSubmitting(true);
      
      try {
        onSubmit(problemData, canvasData);
        
        const response = await api.submitProblem({
          student_id: studentId,
          subject: initialCurriculum.subject,
          problem: problemData,
          solution_image: canvasData,
          skill_id: initialCurriculum.skill?.id || problemData.metadata?.skill?.id,
          subskill_id: initialCurriculum.subskill?.id || problemData.metadata?.subskill?.id,
          student_answer: '',
          canvas_used: true
        });

        setFeedbackData({
          review: response.review,
          competency: response.competency
        });
        
      } catch (error) {
        console.error('Error submitting problem:', error);
        alert('Failed to submit problem. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const getScore = () => {
    if (!feedbackData?.review?.evaluation) return null;
    return typeof feedbackData.review.evaluation === 'number' 
      ? feedbackData.review.evaluation 
      : feedbackData.review.evaluation?.score || 0;
  };

  const getFeedbackText = () => {
    if (!feedbackData?.review?.feedback) return '';
    return typeof feedbackData.review.feedback === 'string' 
      ? feedbackData.review.feedback 
      : feedbackData.review.feedback?.praise || 'Good effort!';
  };

  return (
    <>
      {/* Toggle Button */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`group flex items-center justify-center h-24 bg-purple-600 text-white hover:bg-purple-700 transition-all duration-300 shadow-lg ${
            isOpen ? 'w-12 rounded-r-xl' : 'w-16 rounded-r-2xl'
          }`}
        >
          {isOpen ? (
            <ChevronLeft className="w-6 h-6" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <Brain className="w-8 h-8" />
              <span className="text-xs font-medium">Practice</span>
            </div>
          )}
        </button>
      </div>

      {/* Panel */}
      <div className={`fixed left-0 top-0 h-full bg-white shadow-2xl z-40 transition-all duration-300 ${
        isOpen ? 'w-full md:w-3/4 lg:w-2/3' : 'w-0'
      } overflow-hidden`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-purple-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6" />
              <h2 className="text-lg font-semibold">Practice Problem</h2>
            </div>
            {problemData && (
              <div className="flex items-center gap-4">
                <span className="text-sm opacity-90">
                  {currentProblemIndex + 1} of {problems.length}
                </span>
                <button
                  onClick={fetchSingleProblem}
                  className="p-2 rounded hover:bg-purple-700 transition-colors"
                  title="Generate new problem"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Problem and Feedback */}
            <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Loading problem...</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 p-3 rounded-lg text-red-700 text-sm">
                    {error}
                    <button
                      onClick={fetchProblems}
                      className="ml-2 text-red-600 underline hover:no-underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {problemData && !loading && (
                  <>
                    {/* Problem Type */}
                    <div className="text-sm font-medium text-purple-600">
                      {problemData.problem_type}
                    </div>
                    
                    {/* Problem Content */}
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4">
                      <p className="text-gray-800">{problemData.problem}</p>
                    </div>

                    {/* Feedback Section */}
                    {feedbackData && (
                      <div className="space-y-3">
                        {/* Score */}
                        <div className={`p-3 rounded-lg ${
                          getScore() >= 8 ? 'bg-green-50 border border-green-200' :
                          getScore() >= 6 ? 'bg-yellow-50 border border-yellow-200' :
                          'bg-red-50 border border-red-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className={`w-5 h-5 ${
                              getScore() >= 8 ? 'text-green-600' :
                              getScore() >= 6 ? 'text-yellow-600' :
                              'text-red-600'
                            }`} />
                            <span className="font-semibold text-lg">Score: {getScore()}/10</span>
                          </div>
                          <p className="text-gray-700">{getFeedbackText()}</p>
                        </div>

                        {/* Competency Update */}
                        {feedbackData.competency && feedbackData.competency.new_competency !== undefined && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingUp className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-medium text-blue-800">Progress Update</span>
                            </div>
                            <div className="text-sm text-gray-700">
                              Competency: {feedbackData.competency.previous_competency?.toFixed(1)} → {feedbackData.competency.new_competency.toFixed(1)}
                              {feedbackData.competency.delta !== undefined && (
                                <span className={`ml-2 font-semibold ${
                                  feedbackData.competency.delta > 0 ? 'text-green-600' : 
                                  feedbackData.competency.delta < 0 ? 'text-red-600' : 
                                  'text-gray-600'
                                }`}>
                                  ({feedbackData.competency.delta > 0 ? '+' : ''}{feedbackData.competency.delta.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Action Buttons */}
              {problemData && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex gap-2">
                    {problems.length > 1 && (
                      <>
                        <button
                          onClick={handlePreviousProblem}
                          disabled={currentProblemIndex === 0}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <button
                          onClick={handleNextProblem}
                          disabled={currentProblemIndex === problems.length - 1}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !!feedbackData}
                      className="flex-1 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : feedbackData ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Submitted
                        </>
                      ) : (
                        'Submit Answer'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Canvas */}
            <div className="flex-1 h-full bg-gray-50">
              <DrawingCanvas
                ref={canvasRef}
                onSubmit={handleSubmit}
                loading={isSubmitting}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};