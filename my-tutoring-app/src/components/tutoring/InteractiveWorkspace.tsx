import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import DrawingWorkspace from './DrawingWorkspace';
import './InteractiveWorkspace.css'; // CSS for floating text animations

const InteractiveWorkspace = ({ currentTopic, studentId, onSubmit, transcripts }) => {
  // Problem state
  const [currentProblem, setCurrentProblem] = useState(null);
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  
  // Transcript state - separate active subtitles from completed ones
  const [completedUtterances, setCompletedUtterances] = useState([]);
  const drawingRef = useRef();

  // Extract active subtitles from transcripts (current partial transcripts)
  // Use useMemo to avoid unnecessary recalculations
  const activeSubtitles = useMemo(() => {
    // Group by speaker and find the most recent partial transcript for each
    const activeBySpeaker = {};
    
    if (transcripts) {
      transcripts.forEach(transcript => {
        if (transcript?.isPartial) {
          const speaker = transcript.speaker || 'unknown';
          
          // Only store the most recent one per speaker
          if (!activeBySpeaker[speaker] || 
              new Date(transcript.timestamp) > new Date(activeBySpeaker[speaker].timestamp)) {
            activeBySpeaker[speaker] = transcript;
          }
        }
      });
    }
    
    return Object.values(activeBySpeaker);
  }, [transcripts]);

  // Process transcripts - identify completed utterances for animation
  useEffect(() => {
    if (!transcripts || transcripts.length === 0) return;
    
    // Find completed (non-partial) transcripts
    const newCompleted = transcripts.filter(t => 
      !t.isPartial && 
      !completedUtterances.some(existing => existing.id === t.id)
    );
    
    if (newCompleted.length > 0) {
      setCompletedUtterances(prev => [...prev, ...newCompleted]);
    }
  }, [transcripts]);

  // Cleanup old completed utterances after 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCompletedUtterances(prev => 
        prev.filter(t => now - new Date(t.timestamp).getTime() < 5000)
      );
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const generateNewProblem = async () => {
    setLoading(true);
    setError(null);
    setFeedback(null);
    if (drawingRef.current) drawingRef.current.clearCanvas();
    try {
      const problemRequest = {
        subject: currentTopic.subject,
        unit: currentTopic.unit,
        skill: currentTopic.skill,
        subskill: currentTopic.subskill,
        difficulty: currentTopic.difficulty_range?.target || 1.0,
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
      if (!canvasData) throw new Error('No drawing found. Please draw your answer before submitting.');
      const submission = {
        subject: currentTopic.subject,
        problem: currentProblem.problem,
        solution_image: canvasData,
        skill_id: currentTopic.skill?.id || '',
        subskill_id: currentTopic.subskill?.id || '',
        student_answer: '',
        canvas_used: true,
        student_id: studentId,
      };
      const response = await api.submitProblem(submission);
      setFeedback(response);
      if (onSubmit) onSubmit(canvasData);
    } catch (error) {
      console.error('Error submitting problem:', error);
      setError(error.message || 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full">
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
      <div className="flex flex-1 relative">
        {/* Drawing Area */}
        <div className={`transition-all duration-300 relative ${isProblemOpen ? 'w-2/3' : 'w-full'}`}>
          <div className="h-full">
            <DrawingWorkspace ref={drawingRef} loading={loading} />
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
                    {feedback && feedback.review && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
                        <h3 className="font-medium">Feedback:</h3>
                        {feedback.review.feedback.praise && (
                          <div className="text-sm">
                            <p className="text-green-600">{feedback.review.feedback.praise}</p>
                          </div>
                        )}
                        {feedback.review.feedback.guidance && (
                          <div className="text-sm">
                            <p className="text-blue-600">{feedback.review.feedback.guidance}</p>
                          </div>
                        )}
                        {feedback.review.feedback.encouragement && (
                          <div className="text-sm">
                            <p className="text-purple-600">{feedback.review.feedback.encouragement}</p>
                          </div>
                        )}
                        {feedback.review.feedback.next_steps && (
                          <div className="text-sm mt-2">
                            <p className="text-gray-600">{feedback.review.feedback.next_steps}</p>
                          </div>
                        )}
                        {feedback.review.evaluation && (
                          <div className="mt-2 pt-2 border-t">
                            <p className="text-sm font-medium">
                              Score: {feedback.review.evaluation}/10
                            </p>
                          </div>
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

        {/* Fixed subtitle area for current speech */}
        <div className="subtitle-area">
          {activeSubtitles.map(subtitle => (
            <div 
              key={`subtitle-${subtitle.id}`}
              className={`subtitle-container ${subtitle.speaker.includes('1') ? 'subtitle-left' : 'subtitle-right'}`}
            >
              <div className="speaker-indicator">
                {subtitle.speaker.includes('1') ? 'You' : 'Tutor'}
              </div>
              <p className="subtitle-text">{subtitle.text}</p>
            </div>
          ))}
        </div>

        {/* Floating completed utterances */}
        <div className="absolute inset-0 pointer-events-none">
          {completedUtterances.map(utterance => (
            <div
              key={`final-${utterance.id}`}
              className={`floating-text final ${utterance.speaker.includes('1') ? 'left-side' : 'right-side'}`}
            >
              {utterance.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InteractiveWorkspace;