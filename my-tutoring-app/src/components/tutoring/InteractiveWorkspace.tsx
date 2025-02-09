import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import DrawingWorkspace from './DrawingWorkspace';

const InteractiveWorkspace = ({ currentTopic, studentId, onSubmit }) => {
  const [currentProblem, setCurrentProblem] = useState(null);
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const drawingRef = useRef();

  const generateNewProblem = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    
    if (drawingRef.current) {
      drawingRef.current.clearCanvas();
    }

    try {
      const problemRequest = {
        subject: currentTopic.subject,
        unit: currentTopic.unit,
        skill: currentTopic.skill,
        subskill: currentTopic.subskill,
        difficulty: currentTopic.difficulty_range?.target || 1.0
      };
      
      const response = await api.generateProblem(problemRequest);
      setCurrentProblem(response);
    } catch (error) {
      console.error('Error generating problem:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!drawingRef.current) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
      const canvasData = drawingRef.current.getCanvasData();
      
      if (!canvasData) {
        throw new Error('No drawing found. Please draw your answer before submitting.');
      }
      
      const submission = {
        subject: currentTopic.subject,
        problem: currentProblem.problem,
        solution_image: canvasData,
        skill_id: currentTopic.skill?.id || '',
        subskill_id: currentTopic.subskill?.id || '',
        student_answer: '',
        canvas_used: true,
        student_id: studentId
      };
      
      const response = await api.submitProblem(submission);
      setFeedback(response);
      
      // If there's a parent onSubmit handler, call it with the canvas data
      if (onSubmit) {
        onSubmit(canvasData);
      }
    } catch (error) {
      console.error('Error submitting problem:', error);
      setError(error.message || 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top Bar */}
      <div className="bg-gray-100 p-4 flex justify-between items-center">
        <Button 
          onClick={() => setIsProblemOpen(!isProblemOpen)}
          className="ml-auto"
          variant="secondary"
        >
          {isProblemOpen ? '← Hide Problem' : 'Show Problem'}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Drawing Area */}
        <div className={`transition-all duration-300 relative ${isProblemOpen ? 'w-2/3' : 'w-full'}`}>
          <div className="h-full">
            <DrawingWorkspace
              ref={drawingRef}
              loading={loading}
            />
          </div>
        </div>

        {/* Problem Panel */}
        {isProblemOpen && (
          <div className="w-1/3 bg-white border-l">
            <div className="p-4 flex flex-col h-full">
              <h2 className="text-xl font-semibold text-center mb-6">Current Problem</h2>
              
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!currentProblem ? (
                <div className="flex-1 flex items-center justify-center">
                  <Button
                    onClick={generateNewProblem}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                  >
                    Generate Problem
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-4">
                    <p className="text-gray-700">{currentProblem.problem}</p>
                    
                    {feedback && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-medium mb-2">Feedback:</h3>
                        <p className="text-sm">{feedback.review?.feedback}</p>
                        {feedback.review?.evaluation && (
                          <p className="text-sm mt-2">Score: {feedback.review.evaluation}/10</p>
                        )}
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={handleSubmit}
                    className="w-full mt-4"
                    variant="default"
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting...' : 'Submit Answer'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveWorkspace;