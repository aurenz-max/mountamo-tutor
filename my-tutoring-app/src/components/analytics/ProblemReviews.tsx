// src/components/analytics/ProblemReviews.tsx - UPDATED FOR NEW AUTH
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { authApi } from '@/lib/authApiClient'; // Use new auth API
import { AlertCircleIcon } from 'lucide-react';

// Define types since we're using the new auth API
interface ProblemReviewDetails {
  id: string;
  subject: string;
  skill_id: string;
  subskill_id: string;
  timestamp: string;
  score: number;
  feedback_components: {
    observation?: any;
    analysis?: any;
    evaluation?: any;
    feedback?: any;
  };
  problem_content?: {
    metadata?: {
      skill?: { description?: string };
      subskill?: { description?: string };
    };
    problem_type?: string;
    problem?: string;
    answer?: string;
  };
}

interface ProblemReviewsResponse {
  reviews: ProblemReviewDetails[];
  grouped_reviews: Record<string, Record<string, ProblemReviewDetails[]>>;
}

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
        setError(null);

        // Since there's no specific getProblemReviews method in your authApi,
        // we'll need to construct the endpoint manually or add it to your API client
        // For now, let's use a generic approach
        const params = new URLSearchParams();
        if (selectedSubject) params.append('subject', selectedSubject);
        if (selectedSkill) params.append('skill_id', selectedSkill);
        
        const queryString = params.toString();
        const endpoint = `/api/analytics/student/${studentId}/problem-reviews${queryString ? `?${queryString}` : ''}`;
        
        // Use the authApi's generic get method
        const data = await authApi.get<ProblemReviewsResponse>(endpoint);
        setReviews(data);
      } catch (err) {
        console.error('Error fetching reviews:', err);
        if (err instanceof Error) {
          if (err.message.includes('Authentication') || err.message.includes('token')) {
            setError('Authentication failed. Please log in again.');
          } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
            setError('Access denied. You may not have permission to view this data.');
          } else {
            setError(`Failed to load problem reviews: ${err.message}`);
          }
        } else {
          setError('Failed to load problem reviews');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [studentId, selectedSubject, selectedSkill]);

  if (loading) {
    return <div className="p-8 text-center">Loading problem reviews...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!reviews) {
    return (
      <Alert>
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>No review data available</AlertDescription>
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