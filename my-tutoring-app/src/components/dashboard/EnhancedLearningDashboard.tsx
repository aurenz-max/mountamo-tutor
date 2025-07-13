"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Updated for App Router
import { 
  Award, 
  BarChart2, 
  PenTool, 
  Users,
  Star,
  RefreshCw,
  TrendingUp,
  Flame,
  Settings,
  MessageCircle,
  Mic,
  BookOpen,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import your actual auth context
import { useAuth } from '@/contexts/AuthContext';

// Import the User Preferences Module
import UserPreferencesModule from './UserPreferencesModule';

// Import the Daily Briefing Gemini Component
import DailyBriefingGemini from './DailyBriefingGemini';

// Import the existing Daily Briefing Component (current activities display)
import DailyBriefing from './DailyBriefingComponent';

// Import the SubskillLearningHub component
import SubskillLearningHub from './SubskillLearningHub';

// Enhanced Learning Dashboard Component
const EnhancedLearningDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const router = useRouter(); // App Router hook
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showPreferences, setShowPreferences] = useState(false);
  const [showDailyBriefing, setShowDailyBriefing] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(false);
  
  // New state for learning hub navigation
  const [currentView, setCurrentView] = useState<'dashboard' | 'learning-hub'>('dashboard');
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [loadingActivity, setLoadingActivity] = useState<string | null>(null);

  const studentId = userProfile?.student_id;
  const studentName = userProfile?.display_name || 'Student';
  const points = userProfile?.total_points || 0;
  const streak = userProfile?.current_streak || 0;

  // Updated handleActivityClick function to show learning hub instead of navigating
  const handleActivityClick = (activity: any) => {
    console.log('Activity clicked:', activity);
    
    if (activity.id) {
      setLoadingActivity(activity.id);
      
      // Set the selected activity and switch to learning hub view
      setSelectedActivity(activity);
      setCurrentView('learning-hub');
      setLoadingActivity(null);
    }
  };

  // Add function to handle going back to dashboard
  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedActivity(null);
    setLoadingActivity(null);
  };

  // Add function to handle learning option selection
  const handleLearningOptionSelect = (option: any) => {
    console.log('Learning option selected:', option);
    
    // Navigate to the appropriate route based on the option
    if (option.route) {
      router.push(option.route);
    } else if (option.endpoint) {
      router.push(option.endpoint);
    } else {
      // Fallback navigation
      const endpoint = option.curriculum_context ? 
        `/learning/${option.curriculum_context.subskill_id}?type=${option.id}` :
        `/learning/${selectedActivity?.id}?type=${option.id}`;
      router.push(endpoint);
    }
  };

  // Loading state while we get user profile
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

  // Render learning hub if an activity is selected
  if (currentView === 'learning-hub' && selectedActivity) {
    return (
      <SubskillLearningHub
        activityData={selectedActivity}
        studentId={studentId}
        onBack={handleBackToDashboard}
        onLearningOptionSelect={handleLearningOptionSelect}
        loading={loadingActivity === selectedActivity.id}
      />
    );
  }

  // Main dashboard view
  return (
    <div className="container mx-auto p-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mountamo Learning</h1>
          <p className="text-gray-500">Your personalized learning journey</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Award className="text-yellow-500 mr-2" />
            <span className="font-bold">{points} points</span>
          </div>
          <div className="flex items-center">
            <Flame className="text-orange-500 mr-2" />
            <span className="font-bold">{streak} day streak</span>
          </div>
          
          {/* Daily Briefing Button */}
          <button
            onClick={() => setShowDailyBriefing(true)}
            className="flex items-center px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
            title="Daily Briefing"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Daily Briefing</span>
          </button>
          
          {/* Preferences Button */}
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
          <TabsTrigger value="daily-plan">Today's Plan</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Quick Access */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li 
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => setShowDailyBriefing(true)}
                    >
                      <MessageCircle className="text-blue-500 mr-3" />
                      <span>Daily Briefing</span>
                      <Badge className="ml-auto bg-blue-500 text-xs">AI</Badge>
                    </li>
                    <li 
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => setShowPreferences(true)}
                    >
                      <Settings className="text-blue-500 mr-3" />
                      <span>Preferences</span>
                    </li>
                    <li className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <Users className="text-blue-500 mr-3" />
                      <span>Live Tutoring</span>
                    </li>
                    <li 
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => setActiveTab('analytics')}
                    >
                      <BarChart2 className="text-blue-500 mr-3" />
                      <span>My Analytics</span>
                    </li>
                    <li className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <BookOpen className="text-blue-500 mr-3" />
                      <span>Learning Path</span>
                    </li>
                    <li className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <PenTool className="text-blue-500 mr-3" />
                      <span>Practice Problems</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Daily Briefing Quick Access Card */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-blue-800 flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    AI Coach
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-blue-700 mb-3">
                    Get personalized guidance and discuss your learning plan with your AI coach.
                  </p>
                  <Button 
                    onClick={() => setBriefingExpanded(true)}
                    size="sm" 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <Mic className="h-3 w-3 mr-2" />
                    Quick Chat
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            {/* Main Dashboard Area */}
            <div className="lg:col-span-3 space-y-6">
              {/* Welcome Card with Daily Briefing CTA */}
              <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Good morning, {studentName}!</h2>
                      <p className="mb-4">Ready to continue your learning journey? Your AI coach has prepared a personalized briefing for you.</p>
                    </div>
                    <Button 
                      onClick={() => setShowDailyBriefing(true)}
                      className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                      size="lg"
                    >
                      <Mic className="h-5 w-5 mr-2" />
                      Start Daily Briefing
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              {/* Daily Activities Display Component - Updated with new handler */}
              <DailyBriefing 
                studentId={studentId}
                onActivityClick={handleActivityClick}
              />

              {/* Loading indicator for activity selection */}
              {loadingActivity && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                      <span className="text-blue-800">Loading activity: {loadingActivity}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Daily Plan Tab - Show existing daily briefing component + Gemini AI */}
        <TabsContent value="daily-plan" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DailyBriefing 
                studentId={studentId}
                className="max-w-none"
                onActivityClick={handleActivityClick}
              />
            </div>
            
            {/* Embedded Daily Briefing Gemini for Today's Plan */}
            <div className="lg:col-span-1">
              <div className="sticky top-4">
                <DailyBriefingGemini
                  studentId={studentId}
                  expanded={true}
                  className="h-[600px]"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
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
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">
                          74%
                        </span>
                      </td>
                      <td className="text-right px-6">83%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 font-medium">Geometry</td>
                      <td className="text-right px-4">4</td>
                      <td className="text-right px-4">
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">
                          95%
                        </span>
                      </td>
                      <td className="text-right px-6">93%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 font-medium">Fractions</td>
                      <td className="text-right px-4">12</td>
                      <td className="text-right px-4">
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800">
                          65%
                        </span>
                      </td>
                      <td className="text-right px-6">68%</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-2 font-bold">Total</td>
                      <td className="text-right px-4 font-bold">61</td>
                      <td className="text-right px-4 font-bold">
                        <span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">
                          78%
                        </span>
                      </td>
                      <td className="text-right px-6 font-bold">81%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Analytics Actions */}
              <div className="px-6 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    Want to dive deeper into your learning analytics?
                  </p>
                  <Button 
                    onClick={() => setShowDailyBriefing(true)} 
                    variant="outline" 
                    size="sm"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Discuss with AI
                  </Button>
                </div>
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

      {/* Daily Briefing Modal - Full Screen */}
      {showDailyBriefing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-4xl w-full h-[80vh]">
            <DailyBriefingGemini 
              studentId={studentId}
              expanded={true}
              onClose={() => setShowDailyBriefing(false)}
              className="w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Floating Daily Briefing - Bottom Right */}
      <DailyBriefingGemini
        studentId={studentId}
        expanded={briefingExpanded}
        onClose={() => setBriefingExpanded(false)}
        className={briefingExpanded ? "fixed bottom-4 right-4 w-96 h-[500px] z-40" : ""}
      />
    </div>
  );
};

export default EnhancedLearningDashboard;