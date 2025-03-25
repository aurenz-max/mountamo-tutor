// src/components/analytics/StudentAnalytics.tsx
'use client'

import React, { useState, createContext, useContext } from 'react'
import { useStudentAnalytics } from '@/lib/use-student-analytics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import FilterControls from './FilterControls'
import ProgressDashboard from './ProgressDashboard'
import ProblemReviews from './ProblemReviews'

// Create context for child components
const AnalyticsContext = createContext<ReturnType<typeof useStudentAnalytics> | null>(null);

// Hook for child components to consume context
export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within a StudentAnalytics component');
  }
  return context;
};

export default function StudentAnalytics() {
  const analyticsData = useStudentAnalytics();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <AnalyticsContext.Provider value={analyticsData}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Student Learning Analytics</h1>
        
        <FilterControls />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="problem-reviews">Problem Reviews</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dashboard" className="mt-6">
            <ProgressDashboard />
          </TabsContent>
          
          <TabsContent value="problem-reviews" className="mt-6">
            <ProblemReviews studentId={analyticsData.studentId} initialSubject={analyticsData.subject || undefined} />
          </TabsContent>
        </Tabs>
      </div>
    </AnalyticsContext.Provider>
  )
}