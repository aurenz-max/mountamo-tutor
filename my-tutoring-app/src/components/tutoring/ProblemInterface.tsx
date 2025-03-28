'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from '@/lib/api';
import DrawingWorkspace from './DrawingWorkspace';
import ProblemReader from './ProblemReader';


const ProblemInterface = ({ currentTopic, studentId = 1 }) => {
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const drawingRef = useRef();

  const generateProblem = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    
    if (drawingRef.current) {
      drawingRef.current.clearCanvas();
    }

    try {
      const problemRequest = {
        subject: currentTopic.subject,
        unit: {
          id: currentTopic.selection.unit,
          title: currentTopic.unit?.title || ''
        },
        skill: {
          id: currentTopic.selection.skill,
          description: currentTopic.skill?.description || ''
        },
        subskill: {
          id: currentTopic.selection.subskill,
          SubskillDescription: currentTopic.subskill?.description || ''
        },
        difficulty: currentTopic.difficulty_range?.target || 3.0
      };
  
      console.log('Sending problem request:', problemRequest);
      const response = await api.generateProblem(problemRequest);
      console.log('Received problem response:', response);
      setProblem(response);
    } catch (error) {
      console.error('Error generating problem:', error);
      setError(error.message || 'An error occurred while generating the problem.');
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!drawingRef.current) return;
   
    setSubmitting(true);
    setError(null);
   
    try {
      const canvasData = await drawingRef.current.getCanvasData();
     
      if (!canvasData) {
        throw new Error('No drawing found. Please draw your answer before submitting.');
      }
     
      // Fix: Pass the entire problem object, not just problem.problem
      const submission = {
        subject: currentTopic.subject,
        problem: problem, // Pass the entire problem object
        solution_image: canvasData,
        skill_id: currentTopic.selection?.skill || currentTopic.skill?.id || '',
        subskill_id: currentTopic.selection?.subskill || currentTopic.subskill?.id || '',
        student_answer: '',
        canvas_used: true,
        student_id: studentId
      };
     
      console.log('Submitting problem with data:', submission);
      const response = await api.submitProblem(submission);
      console.log('Received submission response:', response);
      setFeedback(response);
    } catch (error) {
      console.error('Error submitting problem:', error);
      setError(error.message || 'Failed to submit answer. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!problem ? (
          <div className="flex justify-center">
            <Button 
              onClick={generateProblem}
              disabled={loading}
              size="lg"
              className="w-64"
            >
              {loading ? 'Creating Problem...' : 'Start Problem'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-lg font-medium p-4 bg-gray-50 rounded-lg">
              <ProblemReader 
                text={problem.problem} 
                contentType="problem"
                autoRead={true}
              />
              {problem.problem}
            </div>
            
            <DrawingWorkspace 
              ref={drawingRef}
              loading={submitting}
            />

            {!feedback ? (
              <Button 
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="w-full"
              >
                {submitting ? 'Checking Answer...' : 'Submit Answer'}
              </Button>
            ) : (
              <div className="space-y-4">
                <FeedbackDisplay feedback={feedback} />
                <Button 
                  onClick={generateProblem}
                  variant="outline"
                  className="w-full"
                >
                  Try Another Problem
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProblemInterface;