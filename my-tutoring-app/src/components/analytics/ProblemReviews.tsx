'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';
import type { ProblemReviewsResponse, ProblemReviewDetails } from '@/lib/api';

interface ProblemReviewsProps {
  studentId: number;
  initialSubject?: string | null;
}

const ProblemReviews: React.FC<ProblemReviewsProps> = ({ 
  studentId, 
  initialSubject = null 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ProblemReviewsResponse | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(initialSubject);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const data = await api.getProblemReviews(
          studentId, 
          selectedSubject || undefined,
          selectedSkill || undefined
        );
        setReviews(data);
        setError(null);
      } catch (err) {
        setError('Failed to load problem reviews');
        console.error('Error fetching reviews:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [studentId, selectedSubject, selectedSkill]);

  if (loading) {
    return <div className="p-8 text-center">Loading problem reviews...</div>;
  }

  if (error || !reviews) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'No review data available'}</AlertDescription>
      </Alert>
    );
  }

  // Get list of subjects from the grouped reviews
  const subjects = Object.keys(reviews.grouped_reviews || {});
  
  // Get list of skills for the selected subject
  const skills = selectedSubject 
    ? Object.keys(reviews.grouped_reviews[selectedSubject] || {})
    : [];

  // Get reviews to display based on selection
  const reviewsToDisplay = selectedSubject && selectedSkill
    ? reviews.grouped_reviews[selectedSubject][selectedSkill]
    : reviews.reviews;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Problem Reviews</h2>
        <div className="flex gap-4">
          <Select 
            value={selectedSubject || 'all_subjects'} 
            onValueChange={(value) => {
              setSelectedSubject(value === 'all_subjects' ? null : value);
              setSelectedSkill(null); // Reset skill when subject changes
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_subjects">All Subjects</SelectItem>
              {subjects.map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedSubject && (
            <Select 
              value={selectedSkill || 'all_skills'} 
              onValueChange={(value) => setSelectedSkill(value === 'all_skills' ? null : value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select skill" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_skills">All Skills</SelectItem>
                {skills.map(skill => (
                  <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {reviewsToDisplay.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">No reviews found with the selected filters.</p>
            </CardContent>
          </Card>
        ) : (
          reviewsToDisplay.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </div>
    </div>
  );
};

// Component to display a single review
const ReviewCard = ({ review }: { review: ProblemReviewDetails }) => {
  const { subject, skill_id, subskill_id, timestamp, score, feedback_components, problem_content } = review;
  const { observation, analysis, evaluation, feedback } = feedback_components;
  
  // Format date
  const formattedDate = new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Extract meaningful information from problem_content if available
  const problemTitle = problem_content?.metadata?.subskill?.description || 
                      problem_content?.metadata?.skill?.description || 
                      `${subject} - ${skill_id}`;
  
  const problemType = problem_content?.problem_type || '';
  const problemText = problem_content?.problem || '';
  const problemAnswer = problem_content?.answer || '';
  
  // Extract metadata if available
  const skillDescription = problem_content?.metadata?.skill?.description || '';
  const subskillDescription = problem_content?.metadata?.subskill?.description || '';
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            {/* Use the more descriptive title if available, otherwise fall back to IDs */}
            {subskillDescription || skillDescription || `${subject} - ${skill_id} - ${subskill_id}`}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{formattedDate}</span>
            <div className={`px-3 py-1 rounded-full text-white font-medium ${
              score >= 8 ? 'bg-green-500' : 
              score >= 6 ? 'bg-yellow-500' : 
              'bg-red-500'
            }`}>
              {score.toFixed(1)}
            </div>
          </div>
        </div>
        {/* Show problem type if available */}
        {problemType && (
          <div className="text-sm text-gray-500">
            Problem Type: {problemType}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {/* Show problem content if available */}
        {problemText && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between">
              <h3 className="font-semibold text-sm mb-1">Problem</h3>
              {problemAnswer && (
                <div className="text-xs text-gray-500">
                  Expected answer: {problemAnswer}
                </div>
              )}
            </div>
            <p className="text-sm">{problemText}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Observation Section */}
          {observation && Object.keys(observation).length > 0 && (
            <div>
              <h3 className="font-semibold text-base mb-1">Observation</h3>
              <div className="pl-3 border-l-2 border-gray-200">
                {observation.canvas_description && (
                  <p className="text-sm mb-1"><span className="font-medium">Canvas:</span> {observation.canvas_description}</p>
                )}
                {observation.selected_answer && (
                  <p className="text-sm mb-1"><span className="font-medium">Answer:</span> {observation.selected_answer}</p>
                )}
                {observation.work_shown && (
                  <p className="text-sm"><span className="font-medium">Work:</span> {observation.work_shown}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Analysis Section */}
          {analysis && Object.keys(analysis).length > 0 && (
            <div>
              <h3 className="font-semibold text-base mb-1">Analysis</h3>
              <div className="pl-3 border-l-2 border-gray-200">
                {analysis.understanding && (
                  <p className="text-sm mb-1"><span className="font-medium">Understanding:</span> {analysis.understanding}</p>
                )}
                {analysis.approach && (
                  <p className="text-sm mb-1"><span className="font-medium">Approach:</span> {analysis.approach}</p>
                )}
                {analysis.accuracy && (
                  <p className="text-sm mb-1"><span className="font-medium">Accuracy:</span> {analysis.accuracy}</p>
                )}
                {analysis.creativity && (
                  <p className="text-sm"><span className="font-medium">Creativity:</span> {analysis.creativity}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Evaluation Section */}
          {evaluation && typeof evaluation === 'object' && Object.keys(evaluation).length > 0 && (
            <div>
              <h3 className="font-semibold text-base mb-1">Evaluation</h3>
              <div className="pl-3 border-l-2 border-gray-200">
                {evaluation.justification && (
                  <p className="text-sm"><span className="font-medium">Justification:</span> {evaluation.justification}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Feedback Section */}
          {feedback && typeof feedback === 'object' && Object.keys(feedback).length > 0 && (
            <div>
              <h3 className="font-semibold text-base mb-1">Feedback</h3>
              <div className="pl-3 border-l-2 border-gray-200">
                {feedback.praise && (
                  <p className="text-sm mb-1"><span className="font-medium">Praise:</span> {feedback.praise}</p>
                )}
                {feedback.guidance && (
                  <p className="text-sm mb-1"><span className="font-medium">Guidance:</span> {feedback.guidance}</p>
                )}
                {feedback.encouragement && (
                  <p className="text-sm mb-1"><span className="font-medium">Encouragement:</span> {feedback.encouragement}</p>
                )}
                {feedback.next_steps && (
                  <p className="text-sm"><span className="font-medium">Next Steps:</span> {feedback.next_steps}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Handle string feedback format */}
          {feedback && typeof feedback === 'string' && (
            <div>
              <h3 className="font-semibold text-base mb-1">Feedback</h3>
              <div className="pl-3 border-l-2 border-gray-200">
                <p className="text-sm">{feedback}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProblemReviews;