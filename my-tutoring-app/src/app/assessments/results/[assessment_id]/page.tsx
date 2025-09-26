'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/authApiClient';
import { EnhancedAssessmentSummaryResponse } from '@/types/assessment';
import AtAGlanceHeader from '@/components/assessment/results/AtAGlanceHeader';
import AINarrative from '@/components/assessment/results/AINarrative';
import SkillBreakdown from '@/components/assessment/results/SkillBreakdown';
import DataDeepDive from '@/components/assessment/results/DataDeepDive';
import QuestionReview from '@/components/assessment/results/QuestionReview';

const AssessmentResultsPage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [resultsData, setResultsData] = useState<EnhancedAssessmentSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuestionReview, setShowQuestionReview] = useState(false);

  const assessmentId = params.assessment_id as string;

  useEffect(() => {
    const fetchResults = async () => {
      if (!assessmentId || !user) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch assessment results from the API
        const data = await authApi.getAssessmentResults(assessmentId);
        console.log('Assessment results data:', data);
        console.log('Skill analysis:', data.skill_analysis);
        console.log('AI insights skill insights:', data.ai_insights?.skill_insights);
        setResultsData(data);

      } catch (error: any) {
        console.error('Error fetching assessment results:', error);

        if (error.status === 404) {
          setError('Assessment results not found');
        } else if (error.status === 403) {
          setError('You do not have permission to view these results');
        } else {
          setError('Failed to load assessment results. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [assessmentId, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Results</h2>
          <p className="text-gray-500">Analyzing your assessment performance...</p>
        </Card>
      </div>
    );
  }

  if (error || !resultsData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Results Not Found</h2>
          <p className="text-gray-600 mb-6">
            {error || 'The assessment results could not be loaded.'}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/assessments')}
              className="w-full"
            >
              Back to Assessments
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
          <p className="text-gray-500 mb-4">Please sign in to view assessment results.</p>
          <Button onClick={() => router.push('/auth/login')}>
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  // Show question review modal/page
  if (showQuestionReview) {
    return (
      <QuestionReview
        problemReviews={resultsData.problem_reviews || []}
        onClose={() => setShowQuestionReview(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Level 1: At-a-Glance Header */}
        <AtAGlanceHeader
          summary={resultsData.summary}
          aiInsights={resultsData.ai_insights}
          skillAnalysis={resultsData.ai_insights?.skill_insights || []}
        />

        {/* Level 2: AI Narrative */}
        <AINarrative
          aiInsights={resultsData.ai_insights}
        />

        {/* Level 3: Skill Breakdown */}
        <SkillBreakdown
          skillAnalysis={resultsData.ai_insights?.skill_insights || []}
        />

        {/* Level 4: Data Deep Dive */}
        <DataDeepDive
          summary={resultsData.summary}
        />

        {/* Level 5: Question Review Button */}
        <Card className="p-6 mt-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Want to Review Individual Questions?
            </h3>
            <p className="text-gray-600 mb-4">
              See exactly which questions you got right or wrong, along with detailed explanations.
            </p>
            <Button
              onClick={() => setShowQuestionReview(true)}
              variant="outline"
              className="px-6 py-2"
            >
              Review All Questions
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AssessmentResultsPage;