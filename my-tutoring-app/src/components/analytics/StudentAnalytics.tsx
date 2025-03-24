// src/components/analytics/StudentAnalytics.tsx
'use client'

import React, { useState, createContext, useContext } from 'react'
import { useStudentAnalytics } from '@/lib/use-student-analytics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import FilterControls from './FilterControls'
import ProgressDashboard from './ProgressDashboard'
import DetailedUnitView from './DetailedUnitView'
import ProficiencyView from './ProficiencyView'
import ProblemReviews from './ProblemReviews' // Importing your existing component

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
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <AnalyticsContext.Provider value={analyticsData}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Student Learning Analytics</h1>
        
        <FilterControls />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Detailed Units</TabsTrigger>
            <TabsTrigger value="proficiency">Proficiency</TabsTrigger>
            <TabsTrigger value="problems">Problem Reviews</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-6">
            <ProgressDashboard />
          </TabsContent>
          
          <TabsContent value="details" className="mt-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Detailed Unit Overview</h2>
              <DetailedUnitView />
            </Card>
          </TabsContent>
          
          <TabsContent value="proficiency" className="mt-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Proficiency Analysis</h2>
              <ProficiencyView />
            </Card>
          </TabsContent>
          
          <TabsContent value="problems" className="mt-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Problem Reviews</h2>
              <ProblemReviews />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AnalyticsContext.Provider>
  )
}