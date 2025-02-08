'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { api } from '@/lib/api';
import DifficultySelector from './DifficultySelector';
import DrawingWorkspace from './DrawingWorkspace';
import ProblemReader from './ProblemReader';  // Add this import


const ProblemInterface = ({ currentTopic, studentId = 1 }) => {
  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const drawingRef = useRef();
  const [difficulty, setDifficulty] = useState(currentTopic?.difficulty_range?.target || 1.0);
  const [isReading, setIsReading] = useState(false);

  const hasValidSelection = (topic) => {
    return topic && (
      topic.selection?.subskill || // If subskill is selected
      topic.selection?.skill || // Or if skill is selected
      topic.selection?.unit // Or if unit is selected
    );
  };
  const generateProblem = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    
    // Clear the canvas if there's an existing drawing
    if (drawingRef.current) {
      drawingRef.current.clearCanvas();
    }

    try {
      console.log('currentTopic:', currentTopic);
  
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
        difficulty: difficulty
      };
  
      console.log('Problem request:', problemRequest);
  
      const response = await api.generateProblem(problemRequest);
      setProblem(response);
    } catch (error) {
      console.error('Error generating problem:', error);
      setError(error.message);
    }
    setLoading(false);
  };

  const handleSubmit = async (canvasData) => {
    setSubmitting(true);
    setError(null);
    try {
      console.log('Starting submission...');
      
      if (!canvasData) {
        throw new Error('No drawing found. Please draw your answer before submitting.');
      }
      
      const submission = {
        subject: currentTopic.subject,
        problem: problem.problem,
        solution_image: canvasData,
        skill_id: currentTopic.skill?.id || '',
        subskill_id: currentTopic.subskill?.id || '',
        student_answer: '',
        canvas_used: true,
        student_id: studentId
      };
      
      console.log('Submitting with canvas data length:', canvasData.length);
      
      const response = await api.submitProblem(submission);
      setFeedback(response);
    } catch (error) {
      console.error('Error submitting problem:', error);
      setError(error.message || 'Failed to submit answer. Please try again.');
    }
    setSubmitting(false);
  };

  const getTopicDescription = () => {
    if (!currentTopic) return '';
    
    const parts = [];
    if (currentTopic.unit?.title) parts.push(currentTopic.unit.title);
    if (currentTopic.skill?.description) parts.push(currentTopic.skill.description);
    if (currentTopic.subskill?.description) parts.push(currentTopic.subskill.description);
    
    return parts.join(' - ');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Practice Problem</CardTitle>
        {currentTopic && (
          <div className="text-sm text-gray-500">
            {currentTopic.subject} - {getTopicDescription()}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {hasValidSelection(currentTopic) && (
          <DifficultySelector
          recommendedDifficulty={currentTopic.difficulty_range?.target || 5.0}
          onDifficultyChange={setDifficulty}
          currentTopic={currentTopic}
          studentId={studentId}
          />
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!problem ? (
          <Button 
            onClick={generateProblem}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Generating Problem...' : 'Generate Problem'}
          </Button>
        ) : (

          <div className="space-y-6">
            <div className="text-lg">
            <ProblemReader 
              text={problem.problem} 
              contentType="problem"
              autoRead={true}
            />
              {problem.problem}
              <div className="text-xs text-gray-400 mt-1">AI-generated</div>
            </div>
            
            <DrawingWorkspace 
            ref={drawingRef}
            onSubmit={handleSubmit}
            loading={submitting}
            />

            {feedback && feedback.review && (
              <div className="space-y-4">
                <Alert>
                <ProblemReader 
                  text={feedback.review.feedback}
                  contentType="feedback"
                  autoRead={true}
                />
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
                    <div><strong>Score:</strong> {feedback.review.evaluation}/10
                      <div className="text-xs text-gray-400">AI-generated</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {problem.success_criteria?.map((criterion, index) => (
                <div 
                  key={index}
                  className="flex items-center gap-2 text-sm"
                >
                  <AlertCircle className="h-4 w-4 text-gray-300" />
                  {criterion}
                </div>
              ))}
            </div>

            <Button 
              variant="outline"
              onClick={generateProblem}
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
  );
};

export default ProblemInterface;