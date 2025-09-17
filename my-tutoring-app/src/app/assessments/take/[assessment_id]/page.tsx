'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import AssessmentPlayer from '@/components/assessment/AssessmentPlayer';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/authApiClient';

const AssessmentTakePage = () => {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assessmentId = params.assessment_id as string;

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!assessmentId || !user) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch assessment data from the API
        const data = await authApi.getAssessment(assessmentId);
        setAssessmentData(data);

        // Store in sessionStorage as backup
        try {
          sessionStorage.setItem(`assessment_${assessmentId}`, JSON.stringify(data));
        } catch (err) {
          console.error('Error storing assessment data in sessionStorage:', err);
        }

      } catch (error: any) {
        console.error('Error fetching assessment:', error);

        if (error.status === 404) {
          setError('Assessment not found or expired');
        } else if (error.status === 410) {
          setError('Assessment has expired. Please start a new assessment.');
        } else {
          setError('Failed to load assessment. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [assessmentId, user]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Assessment</h2>
          <p className="text-gray-500">Preparing your personalized questions...</p>
        </Card>
      </div>
    );
  }

  if (error || !assessmentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Assessment Not Found</h2>
          <p className="text-gray-600 mb-6">
            {error || 'The assessment data could not be loaded. This might happen if you refreshed the page or the assessment has expired.'}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => router.push('/assessments')}
              className="w-full"
            >
              Start New Assessment
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
          <p className="text-gray-500 mb-4">Please sign in to take assessments.</p>
          <Button onClick={() => router.push('/auth/login')}>
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return <AssessmentPlayer assessmentData={assessmentData} />;
};

export default AssessmentTakePage;