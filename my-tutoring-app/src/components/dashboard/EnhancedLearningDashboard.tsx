"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Award, 
  BarChart2, 
  PenTool, 
  Users,
  RefreshCw,
  Flame,
  Settings,
  BookOpen,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import components
import { useAuth } from '@/contexts/AuthContext';
import UserPreferencesModule from './UserPreferencesModule';
import DailyBriefingComponent from './DailyBriefingComponent';
import { AICoachToggleButton } from '@/components/layout/GlobalAICoachToggle'; // Import the global toggle
import VelocityMetricsCard from '@/components/analytics/VelocityMetricsCard';
import { useVelocityMetrics } from '@/hooks/useVelocityMetrics';
import { LevelBadge } from '@/components/engagement/LevelBadge';
import { XPProgressBar } from '@/components/engagement/XPProgressBar';
import XPCounter from '@/components/engagement/XPCounter';
import StreakCounter from '@/components/engagement/StreakCounter';

const EnhancedLearningDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPreferences, setShowPreferences] = useState(false);

  const studentId = userProfile?.student_id;
  const studentName = userProfile?.display_name || 'Student';
  
  // Engagement & Progression System data (prefer new fields, fallback to legacy)
  const totalXP = userProfile?.total_xp || userProfile?.total_points || 0;
  const currentLevel = userProfile?.current_level || userProfile?.level || 1;
  const xpForNextLevel = userProfile?.xp_for_next_level || 100;
  const streak = userProfile?.current_streak || 0;

  // Fetch velocity metrics
  const { 
    data: velocityData, 
    loading: velocityLoading, 
    error: velocityError, 
    refetch: refetchVelocity 
  } = useVelocityMetrics(studentId);

  // Handle activity selection from recommendations
  const handleActivitySelect = async (subskillId: string, subject: string) => {
    console.log('Activity selected:', { subskillId, subject });
    
    try {
      // Import the auth API client dynamically to avoid SSR issues
      const { authApi } = await import('@/lib/authApiClient');
      
      console.log('🚀 Starting learning session for subskill:', subskillId);
      
      // Use the same logic as packages page: get or create content package
      const response = await authApi.getContentPackageForSubskill(subskillId);
      console.log('✅ Content package response:', response);
      
      if (response.packageId) {
        // Navigate to the learning session
        console.log('🎯 Navigating to packages session:', response.packageId);
        router.push(`/packages/${response.packageId}/learn`);
      } else {
        throw new Error('No package ID returned from server');
      }
    } catch (error) {
      console.error('❌ Error handling activity selection:', error);
      // Fallback to packages list on error
      router.push('/packages');
    }
  };

  // Different contexts for different sections
  const dashboardContext = {
    type: 'daily_planning' as const,
    title: 'Dashboard Overview',
    focus_area: 'General learning guidance and daily planning',
    metadata: {
      page: 'dashboard',
      sessionType: 'general'
    }
  };

  const todayContext = {
    type: 'daily_planning' as const,
    title: 'Today\'s Learning Plan',
    focus_area: 'Today\'s specific learning activities and goals',
    metadata: {
      page: 'today',
      sessionType: 'daily_planning'
    }
  };

  const analyticsContext = {
    type: 'activity' as const,
    title: 'Learning Analytics',
    focus_area: 'Performance analysis and improvement strategies',
    metadata: {
      page: 'analytics',
      sessionType: 'progress_review'
    }
  };

  // Loading state
  if (!userProfile) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!studentId) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">Unable to load student profile. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {studentName}!</h1>
          <p className="text-gray-500">Your personalized learning hub</p>
        </div>
        <div className="flex items-center space-x-4">
          
          {/* Global AI Coach Toggle */}
          <AICoachToggleButton 
            context={activeTab === 'today' ? todayContext : activeTab === 'analytics' ? analyticsContext : dashboardContext}
          />
          
          <button
            onClick={() => setShowPreferences(true)}
            className="flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="User Preferences"
          >
            <Settings className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Preferences</span>
          </button>
          
          <div className="bg-gray-100 rounded-full p-2">
            <span className="font-bold">{studentName.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="today">Today's Plan</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6">
          <div className="space-y-6">
            {/* Welcome Card with Progress */}
            <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2">Good morning, {studentName}!</h2>
                    <p className="mb-4">Ready to continue your learning journey? Your activities are ready below, and your AI coach is standing by to help.</p>
                  </div>
                  <div className="ml-6">
                    <LevelBadge level={currentLevel} className="scale-125" />
                  </div>
                </div>
                
                {/* XP Progress Bar */}
                <div className="mt-4 bg-white/10 rounded-lg p-4">
                  <XPProgressBar 
                    totalXP={totalXP}
                    currentLevel={currentLevel}
                    xpForNextLevel={xpForNextLevel}
                    className="text-white [&_.text-gray-600]:text-white/80 [&_.text-gray-800]:text-white [&_.text-gray-500]:text-white/70"
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveTab('today')}
                  >
                    <Calendar className="h-6 w-6 text-blue-500" />
                    <span className="text-sm">Today's Plan</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                  >
                    <Users className="h-6 w-6 text-green-500" />
                    <span className="text-sm">Live Tutoring</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveTab('analytics')}
                  >
                    <BarChart2 className="h-6 w-6 text-purple-500" />
                    <span className="text-sm">My Analytics</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                  >
                    <BookOpen className="h-6 w-6 text-orange-500" />
                    <span className="text-sm">Learning Path</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                  >
                    <PenTool className="h-6 w-6 text-red-500" />
                    <span className="text-sm">Practice</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setShowPreferences(true)}
                  >
                    <Settings className="h-6 w-6 text-gray-500" />
                    <span className="text-sm">Settings</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Velocity Metrics Card */}
            <VelocityMetricsCard 
              data={velocityData}
              loading={velocityLoading}
              error={velocityError}
              studentId={studentId}
              onActivitySelect={handleActivitySelect}
            />
            
            {/* Today's Activities Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Today's Activities</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setActiveTab('today')}
                  >
                    Focus Mode
                  </Button>
                </div>
                <CardDescription>All your learning activities for today</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyBriefingComponent 
                  studentId={studentId}
                  className="max-w-none"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Today's Plan Tab */}
        <TabsContent value="today" className="mt-6">
          <DailyBriefingComponent 
            studentId={studentId}
            className="max-w-none"
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          {/* Velocity Metrics Card */}
          <VelocityMetricsCard 
            data={velocityData}
            loading={velocityLoading}
            error={velocityError}
            studentId={studentId}
            onActivitySelect={handleActivitySelect}
          />

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity (30 Days)</CardTitle>
              <CardDescription>
                Your learning analytics and progress overview
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-6">Units</th>
                      <th className="text-right px-4">Recent Activity</th>
                      <th className="text-right px-4">Avg Score</th>
                      <th className="text-right px-6">Proficiency %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-6 py-2 font-medium">Counting and Cardinality</td>
                      <td className="text-right px-4">45</td>
                      <td className="text-right px-4">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          74%
                        </Badge>
                      </td>
                      <td className="text-right px-6">83%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 font-medium">Geometry</td>
                      <td className="text-right px-4">4</td>
                      <td className="text-right px-4">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          95%
                        </Badge>
                      </td>
                      <td className="text-right px-6">93%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 font-medium">Fractions</td>
                      <td className="text-right px-4">12</td>
                      <td className="text-right px-4">
                        <Badge variant="secondary" className="bg-red-100 text-red-800">
                          65%
                        </Badge>
                      </td>
                      <td className="text-right px-6">68%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 font-bold">Total</td>
                      <td className="text-right px-4 font-bold">61</td>
                      <td className="text-right px-4 font-bold">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          78%
                        </Badge>
                      </td>
                      <td className="text-right px-6 font-bold">81%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* User Preferences Modal */}
      <UserPreferencesModule 
        isOpen={showPreferences} 
        onClose={() => setShowPreferences(false)} 
      />
    </div>
  );
};

export default EnhancedLearningDashboard;