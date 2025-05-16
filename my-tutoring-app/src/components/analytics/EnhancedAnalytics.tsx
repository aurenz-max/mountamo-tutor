// components/analytics/EnhancedAnalytics.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api';

// Import all the components
import DashboardSummary from './DashboardSummary';
import MasteryHeatmap from './MasteryHeatmap';
import SkillsProgression from './SkillsProgression';
// Removed SkillGaps import - high computational cost
import TimeAnalysis from './TimeAnalysis';
import PersonalizedRecommendations from './PersonalizedRecommendations';
import ProblemReviews from './ProblemReviews';
// Removed ProblemPatterns import - potentially high cost and lower value

interface EnhancedAnalyticsProps {
  studentId: number;
  initialTab?: string;
}

const EnhancedAnalytics: React.FC<EnhancedAnalyticsProps> = ({ 
  studentId,
  initialTab = 'dashboard'
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available subjects
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        const data = await api.getSubjects();
        setSubjects(data);
        
        if (data.length > 0 && !selectedSubject) {
          setSelectedSubject(data[0]);
        }
        
        setError(null);
      } catch (err) {
        setError('Failed to load subjects');
        console.error('Error fetching subjects:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Learning Analytics</h1>
        {/* Show subject selector for subject-specific tabs */}
        {(activeTab === 'heatmap' || activeTab === 'skills' || activeTab === 'time') && (
          <Select value={selectedSubject || ''} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(subject => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="heatmap">Mastery Map</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          {/* Removed Gaps tab */}
          {/* Removed Patterns tab */}
          <TabsTrigger value="time">Time</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <DashboardSummary studentId={studentId} />
        </TabsContent>

        {/* Mastery Heatmap Tab */}
        <TabsContent value="heatmap">
          {selectedSubject && (
            <MasteryHeatmap studentId={studentId} subject={selectedSubject} />
          )}
        </TabsContent>

        {/* Skills Progression Tab */}
        <TabsContent value="skills">
          <SkillsProgression studentId={studentId} subject={selectedSubject || undefined} />
        </TabsContent>

        {/* Time Analysis Tab */}
        <TabsContent value="time">
          <TimeAnalysis studentId={studentId} subject={selectedSubject || undefined} />
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <PersonalizedRecommendations 
            studentId={studentId} 
            subject={selectedSubject || undefined}
            count={5} // Reduced from 10 to 5 to improve performance
          />
        </TabsContent>

        {/* Problem Reviews Tab */}
        <TabsContent value="reviews">
          <ProblemReviews studentId={studentId} initialSubject={selectedSubject} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedAnalytics;