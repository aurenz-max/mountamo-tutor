import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import DrawingWorkspace from './DrawingWorkspace';

const InteractiveWorkspace = ({ 
  currentTopic,
  studentId,
  onSubmit 
}) => {
  const [currentProblem, setCurrentProblem] = useState(null);
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

  const handleSubmit = async (canvasData) => {
    if (!currentProblem) return;
    
    setSubmitting(true);
    setError(null);
    
    try {
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
      
      if (onSubmit) {
        onSubmit(response);
      }
    } catch (error) {
      console.error('Error submitting problem:', error);
      setError(error.message || 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {/* Problem Display */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Current Problem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!currentProblem ? (
            <Button 
              onClick={generateNewProblem}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Generating Problem...' : 'Generate Problem'}
            </Button>
          ) : (
            <div className="space-y-6">
              <div className="text-lg">
                {currentProblem.problem}
                <div className="text-xs text-gray-400 mt-1">AI-generated</div>
              </div>

              {currentProblem.success_criteria?.map((criterion, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 text-sm"
                >
                  <AlertCircle className="h-4 w-4 text-gray-300" />
                  {criterion}
                </div>
              ))}

              <Button 
                variant="outline"
                onClick={generateNewProblem}
                disabled={loading}
                className="w-full"
              >
                Try Another Problem
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex justify-center">
              <Progress value={33} className="w-1/3" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Your Workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <DrawingWorkspace 
            ref={drawingRef}
            onSubmit={handleSubmit}
            loading={submitting}
          />

          {feedback && feedback.review && (
            <div className="space-y-4 mt-4">
              <Alert>
                <AlertDescription className="whitespace-pre-wrap">
                  {feedback.review.feedback}
                  <div className="text-xs text-gray-400 mt-1">AI-generated</div>
                </AlertDescription>
              </Alert>
              
              <div className="p-4 border rounded-lg space-y-2 bg-gray-50">
                <div className="font-medium">Teacher's Notes:</div>
                <div className="text-sm space-y-2">
                  <div><strong>Observation:</strong> {feedback.review.observation}</div>
                  <div><strong>Analysis:</strong> {feedback.review.analysis}</div>
                  <div>
                    <strong>Score:</strong> {feedback.review.evaluation}/10
                    <div className="text-xs text-gray-400">AI-generated</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InteractiveWorkspace;