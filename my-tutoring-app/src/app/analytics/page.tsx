'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, BookOpen, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import VelocityMetricsCard from '@/components/analytics/VelocityMetricsCard';
import ProblemReviews from '@/components/analytics/ProblemReviews';
import CurriculumExplorer from '@/components/curriculum/CurriculumExplorer';
import { useVelocityMetrics } from '@/hooks/useVelocityMetrics';
import { authApi } from '@/lib/authApiClient';

export default function AnalyticsPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  const studentId = userProfile?.student_id ?? null;

  // Fetch velocity metrics for overview tab
  const {
    data: velocityData,
    loading: velocityLoading,
    error: velocityError,
  } = useVelocityMetrics(studentId);

  // Handle activity selection from velocity metrics
  const handleActivitySelect = async (subskillId: string) => {
    if (!studentId) {
      console.error('No student ID available');
      return;
    }

    try {
      // Generate or fetch content package for the selected subskill
      const contentPackage = await authApi.getContentPackageForSubskill(subskillId);

      if (contentPackage?.packageId) {
        // Navigate to the learning session
        router.push(`/learn/${contentPackage.packageId}`);
      } else {
        console.error('No content package available for this subskill');
      }
    } catch (error) {
      console.error('Error fetching content package:', error);
    }
  };

  // Show login prompt if not authenticated
  if (!user || !studentId) {
    return (
      <main className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Analytics Dashboard</CardTitle>
            <CardDescription>Please log in to view your analytics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              You need to be logged in to access your learning analytics and progress tracking.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Track your learning progress, explore curriculum, and review past work
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Curriculum</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              <span>Problem Reviews</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - Velocity Metrics Only */}
          <TabsContent value="overview" className="space-y-6">
            <VelocityMetricsCard
              data={velocityData}
              loading={velocityLoading}
              error={velocityError}
              studentId={studentId}
              onActivitySelect={handleActivitySelect}
            />
          </TabsContent>

          {/* Curriculum Tab - Full CurriculumExplorer */}
          <TabsContent value="curriculum" className="space-y-6">
            <CurriculumExplorer />
          </TabsContent>

          {/* Problem Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6">
            <ProblemReviews studentId={studentId} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
