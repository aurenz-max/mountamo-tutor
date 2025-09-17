'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Trophy, Target, BookOpen, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useEngagement } from '@/contexts/EngagementContext';
import { authApi } from '@/lib/authApiClient';
import XPCounter from '@/components/engagement/XPCounter';
import StreakCounter from '@/components/engagement/StreakCounter';

interface AssessmentSummary {
  assessment_id: string;
  subject: string;
  total_questions: number;
  correct_count: number; // Backend returns correct_count, not correct_answers
  score_percentage: number;
  time_taken_minutes?: number;
  skill_breakdown: Array<{
    skill_name: string;
    total_questions: number;
    correct_answers: number;
    percentage: number;
  }>;
  engagement_transaction?: {
    xp_earned: number;
    streak_bonus: number;
    level_gained: boolean;
    current_level: number;
    total_xp: number;
  };
  submitted_at?: string;
}

const AssessmentResultsPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { processEngagementResponse } = useEngagement();

  const [summary, setSummary] = useState<AssessmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [engagementProcessed, setEngagementProcessed] = useState(false);

  const assessmentId = params.assessment_id as string;

  useEffect(() => {
    const fetchAssessmentSummary = async () => {
      try {
        // Wait for auth to finish loading before checking user
        if (authLoading) {
          return;
        }

        if (!user) {
          setError('Please log in to view results');
          setLoading(false);
          return;
        }

        // Try to get results from sessionStorage first (from submission)
        const storedResults = sessionStorage.getItem(`assessment_results_${assessmentId}`);
        if (storedResults) {
          const results = JSON.parse(storedResults);

          // Map the backend response to our interface
          const formattedSummary: AssessmentSummary = {
            assessment_id: results.assessment_id,
            subject: results.subject,
            total_questions: results.total_questions,
            correct_count: results.correct_count, // Use correct_count from backend
            score_percentage: results.score_percentage,
            time_taken_minutes: results.time_taken_minutes,
            skill_breakdown: results.skill_breakdown || [],
            engagement_transaction: results.engagement_transaction,
            submitted_at: results.submitted_at
          };

          setSummary(formattedSummary);

          // Process engagement if present
          if (results.engagement_transaction && !engagementProcessed) {
            await processEngagementResponse(results.engagement_transaction);
            setEngagementProcessed(true);
          }

          setLoading(false);
          // Clear the session storage after use
          sessionStorage.removeItem(`assessment_results_${assessmentId}`);
          return;
        }

        // Otherwise fetch from API (fallback)
        const data = await authApi.getAssessmentSummary(assessmentId);

        // Map the API response to our interface (same mapping as sessionStorage)
        const formattedSummary: AssessmentSummary = {
          assessment_id: data.assessment_id,
          subject: data.subject,
          total_questions: data.total_questions,
          correct_count: data.correct_count,
          score_percentage: data.score_percentage,
          time_taken_minutes: data.time_taken_minutes,
          skill_breakdown: data.skill_breakdown || [],
          engagement_transaction: data.engagement_transaction,
          submitted_at: data.submitted_at
        };

        setSummary(formattedSummary);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching assessment summary:', err);
        setError('Unable to load assessment results. Please try again.');
        setLoading(false);
      }
    };

    if (assessmentId) {
      fetchAssessmentSummary();
    }
  }, [assessmentId, user, authLoading, processEngagementResponse, engagementProcessed]);

  const getScoreColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 80) return 'text-blue-600 bg-blue-50';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreLabel = (percentage: number) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Good';
    if (percentage >= 70) return 'Fair';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
            <span className="text-gray-700">Loading assessment results...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Results</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={() => router.push('/assessments')} className="w-full">
              Back to Assessments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Trophy className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Complete!</h1>
          <p className="text-gray-600">Here are your results for the {summary.subject} assessment</p>
        </div>

        {/* Score Summary */}
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl mb-4">Overall Score</CardTitle>
            <div className={`inline-flex items-center px-6 py-3 rounded-full text-2xl font-bold ${getScoreColor(summary.score_percentage || 0)}`}>
              {summary.correct_count} / {summary.total_questions} ({(summary.score_percentage || 0).toFixed(1)}%)
            </div>
            <Badge variant="outline" className="mt-2 text-lg px-4 py-1">
              {getScoreLabel(summary.score_percentage || 0)}
            </Badge>
          </CardHeader>
        </Card>

        {/* XP and Engagement Rewards */}
        {summary.engagement_transaction && (
          <Card className="shadow-lg border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-yellow-700">
                <Trophy className="h-6 w-6 mr-2" />
                Rewards Earned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    +{summary.engagement_transaction.xp_earned} XP
                  </div>
                  <div className="text-sm text-gray-600">Experience Points</div>
                </div>

                {summary.engagement_transaction.streak_bonus > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 mb-1">
                      +{summary.engagement_transaction.streak_bonus} XP
                    </div>
                    <div className="text-sm text-gray-600">Streak Bonus</div>
                  </div>
                )}

                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    Level {summary.engagement_transaction.current_level}
                  </div>
                  <div className="text-sm text-gray-600">
                    {summary.engagement_transaction.level_gained ? 'Level Up!' : 'Current Level'}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center space-x-6">
                <XPCounter
                  currentXP={summary.engagement_transaction.total_xp}
                  size="lg"
                  animate={true}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skill Breakdown */}
        {summary.skill_breakdown && summary.skill_breakdown.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-6 w-6 mr-2" />
                Skill Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.skill_breakdown.map((skill, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">{skill.skill_name}</span>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${getScoreColor(skill.percentage)}`}>
                      {skill.correct_answers}/{skill.total_questions} ({skill.percentage}%)
                    </span>
                  </div>
                  <Progress value={skill.percentage} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Time Taken */}
        {summary.time_taken_minutes && (
          <Card className="shadow-lg">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {Math.round(summary.time_taken_minutes)} minutes
                </div>
                <div className="text-gray-600">Time taken</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => router.push('/assessments')}
            className="flex items-center"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Take Another Assessment
          </Button>

          <Button
            onClick={() => router.push('/')}
            className="flex items-center"
          >
            <Home className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push('/practice')}
            className="flex items-center"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Practice More
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentResultsPage;