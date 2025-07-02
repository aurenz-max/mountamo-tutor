"use client";

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Calendar, 
  CheckCircle, 
  Award, 
  Video, 
  BarChart2, 
  PenTool, 
  Users,
  ArrowRight,
  Star,
  Brain,
  Puzzle,
  ChevronLeft,
  Coffee,
  Clock,
  Eye,
  Headphones,
  Target,
  Zap,
  RefreshCw,
  TrendingUp,
  Flame,
  Timer,
  Plus,
  PlayCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Import the real API instead of using mocks
import { 
  useDailyActivities, 
  ActivityUtils, 
  TimeSlotConfig,
  ActivityColors,
  PriorityColors,
  DailyActivity,
  DailyPlan
} from '@/lib/dailyActivitiesAPI';

// Import your actual auth context - replace with your real implementation
import { useAuth } from '@/contexts/AuthContext'; // Adjust path as needed

// If you don't have the real useAuth hook, use this mock with correct student_id:
// const useAuth = () => ({
//   userProfile: {
//     uid: "8bVc9u8JUybDYgy6LlpXuJFeaTU2",
//     email: "xbox360gamer.chris@gmail.com",
//     display_name: "Chris",
//     student_id: 1001, // Use the REAL student_id from your profile
//     grade_level: null,
//     total_points: 20,
//     current_streak: 1,
//     level: 1
//   },
//   getAuthToken: async () => "your-real-jwt-token" // Return real JWT token
// });

// Activity icon mapping
const ActivityIcons = {
  zap: Zap,
  headphones: Headphones,
  target: Target,
  eye: Eye,
  brain: Brain,
  book: BookOpen,
  star: Star,
  coffee: Coffee,
  timer: Timer,
  puzzle: Puzzle,
  pen: PenTool
};

// Enhanced Learning Dashboard Component
const EnhancedLearningDashboard: React.FC = () => {
  const { userProfile, getAuthToken } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const studentId = userProfile?.student_id;
  const studentName = userProfile?.display_name || 'Student';
  const points = userProfile?.total_points || 0;
  const streak = userProfile?.current_streak || 0;

  // Use the real API hook with conditional loading
  const {
    dailyPlan,
    dailyStats,
    loading,
    error,
    refreshPlan,
    completeActivity,
    isCompleting
  } = useDailyActivities({
    studentId: studentId!, // This will now be 1001 instead of 12345
    autoRefresh: true,
    refreshInterval: 300000 // 5 minutes
  });

  // Don't attempt to load data if we don't have a valid student ID
  if (!studentId) {
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

  // Utility functions
  const getActivityIcon = (iconType: string) => {
    const IconComponent = ActivityIcons[iconType as keyof typeof ActivityIcons] || BookOpen;
    return <IconComponent size={20} />;
  };

  const currentTimeSlot = ActivityUtils.getCurrentTimeSlot();

  // Get next activities for quick view
  const getNextActivities = () => {
    if (!dailyPlan) return [];
    return ActivityUtils.getNextActivities(dailyPlan.activities, 3);
  };

  // Handle activity completion with proper error handling
  const handleCompleteActivity = async (activityId: string) => {
    if (!studentId || isCompleting) return;

    try {
      const response = await completeActivity(activityId, {
        completion_time_seconds: Math.floor(Date.now() / 1000)
      });
      
      if (response.success) {
        // Show success message
        alert(`✅ ${response.message}`);
      }
    } catch (err: any) {
      alert(`Failed to complete activity: ${err?.message || 'Unknown error'}`);
    }
  };

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

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">MathMentor</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Left Sidebar */}
            <div className="md:col-span-1 space-y-6">
              {/* Daily Goal */}
              <Card>
                <CardHeader>
                  <CardTitle>Daily Goal</CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyPlan ? (
                    <>
                      <div className="mb-2">
                        <Progress value={dailyPlan.progress.progress_percentage} className="h-5" />
                      </div>
                      <p className="text-sm text-gray-600">
                        {dailyPlan.progress.points_earned_today}/{dailyPlan.progress.daily_goal} points
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {dailyPlan.progress.daily_goal - dailyPlan.progress.points_earned_today} more to reach your goal!
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <div className="animate-pulse">
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded"></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Quick Access */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <Users className="text-blue-500 mr-3" />
                      <span>Live Tutoring</span>
                    </li>
                    <li className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
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
            </div>
            
            {/* Main Dashboard Area */}
            <div className="md:col-span-3 space-y-6">
              {/* Welcome Card */}
              <Card className="bg-blue-500 text-white border-0">
                <CardContent className="pt-6">
                  <h2 className="text-2xl font-bold mb-2">Good morning, {studentName}!</h2>
                  <p>Ready to continue your learning journey? You have some exciting activities waiting for you today.</p>
                </CardContent>
              </Card>
              
              {/* Next Up Activities */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>Up Next</CardTitle>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={refreshPlan}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button 
                      variant="link" 
                      className="text-sm text-blue-600"
                      onClick={() => setActiveTab('daily-plan')}
                    >
                      View Full Plan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      Loading activities...
                    </div>
                  ) : error ? (
                    <div className="text-center py-6">
                      <div className="text-red-500 mb-2">{error}</div>
                      <Button variant="outline" size="sm" onClick={refreshPlan}>
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {getNextActivities().map(activity => (
                        <div 
                          key={activity.id} 
                          className={`p-4 rounded-lg border-l-4 ${ActivityUtils.getPriorityColor(activity.priority)} hover:bg-gray-50`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center mb-2">
                                <div className={`p-2 rounded-full mr-3 ${ActivityUtils.getActivityColor(activity.type).split(' ')[0]} ${ActivityUtils.getActivityColor(activity.type).split(' ')[1]}`}>
                                  {getActivityIcon(activity.icon_type)}
                                </div>
                                <div>
                                  <h3 className="font-bold">{activity.title}</h3>
                                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                                    <Badge variant="outline" className="text-xs">
                                      {activity.type}
                                    </Badge>
                                    <span>•</span>
                                    <span>{activity.estimated_time}</span>
                                    <span>•</span>
                                    <span className="flex items-center">
                                      <Star size={12} className="mr-1 text-yellow-500" />
                                      {activity.points} pts
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 ml-12">{activity.description}</p>
                            </div>
                            <div className="flex flex-col items-end">
                              <Button 
                                onClick={() => handleCompleteActivity(activity.id)}
                                disabled={isCompleting === activity.id}
                                className="flex items-center text-sm"
                              >
                                {isCompleting === activity.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Starting...
                                  </>
                                ) : (
                                  <>
                                    <PlayCircle size={16} className="mr-1" />
                                    Start
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {getNextActivities().length === 0 && dailyPlan && (
                        <div className="text-center py-8">
                          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                          <h3 className="text-lg font-semibold mb-2">All activities completed!</h3>
                          <p className="text-gray-600">Great job! Check back tomorrow for new activities.</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Progress Today */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="mr-2" size={20} />
                      Today's Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailyPlan ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Activities</span>
                          <span className="font-bold">
                            {dailyPlan.progress.completed_activities}/{dailyPlan.progress.total_activities}
                          </span>
                        </div>
                        <Progress 
                          value={(dailyPlan.progress.completed_activities / dailyPlan.progress.total_activities) * 100}
                          className="h-2"
                        />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Points Today</span>
                          <span className="font-bold text-yellow-600">
                            {dailyPlan.progress.points_earned_today} pts
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="animate-pulse space-y-4">
                        <div className="h-4 bg-gray-200 rounded"></div>
                        <div className="h-2 bg-gray-200 rounded"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Focus Areas */}
                <Card>
                  <CardHeader>
                    <CardTitle>Focus Areas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dailyPlan ? (
                      <div className="space-y-2">
                        {dailyPlan.goals.focus_areas.map((area, index) => (
                          <Badge key={index} variant="secondary" className="w-full justify-center py-2">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="animate-pulse space-y-2">
                        <div className="h-8 bg-gray-200 rounded"></div>
                        <div className="h-8 bg-gray-200 rounded"></div>
                        <div className="h-8 bg-gray-200 rounded"></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Daily Plan Tab */}
        <TabsContent value="daily-plan" className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Loading your daily plan...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">{error}</div>
              <Button onClick={refreshPlan} variant="outline">
                Try Again
              </Button>
            </div>
          ) : dailyPlan ? (
            <div className="space-y-6">
              {/* Plan Header */}
              <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Today's Learning Plan</h2>
                      <p className="opacity-90">
                        {dailyPlan.progress.total_activities} activities • 
                        Goal: {dailyPlan.progress.daily_goal} points
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{dailyPlan.progress.progress_percentage.toFixed(0)}%</div>
                      <div className="text-sm opacity-90">completed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activities by Time Slot */}
              {Object.entries(TimeSlotConfig).map(([timeSlot, config]) => {
                const activities = dailyPlan.activities.filter(a => a.time_slot === timeSlot);
                if (activities.length === 0) return null;

                const isCurrentTimeSlot = timeSlot === currentTimeSlot;

                return (
                  <Card key={timeSlot} className={isCurrentTimeSlot ? 'ring-2 ring-blue-500' : ''}>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <config.icon className={`mr-3 ${config.color}`} size={24} />
                        <span>{config.name}</span>
                        {isCurrentTimeSlot && (
                          <Badge className="ml-2 bg-blue-500">Current</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {activities.map((activity) => (
                          <div
                            key={activity.id}
                            className={`p-4 rounded-lg border-l-4 ${ActivityUtils.getPriorityColor(activity.priority)} ${
                              activity.is_completed ? 'opacity-60' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center mb-2">
                                  <div className={`p-2 rounded-full mr-3 ${ActivityUtils.getActivityColor(activity.type).split(' ')[0]} ${ActivityUtils.getActivityColor(activity.type).split(' ')[1]}`}>
                                    {getActivityIcon(activity.icon_type)}
                                  </div>
                                  <div>
                                    <h3 className="font-bold flex items-center">
                                      {activity.title}
                                      {activity.is_completed && (
                                        <CheckCircle className="ml-2 text-green-500" size={16} />
                                      )}
                                    </h3>
                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                      <Badge variant="outline" className="text-xs">
                                        {activity.type}
                                      </Badge>
                                      <span>•</span>
                                      <span>{activity.estimated_time}</span>
                                      <span>•</span>
                                      <span className="flex items-center">
                                        <Star size={12} className="mr-1 text-yellow-500" />
                                        {activity.points} pts
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 ml-12">
                                  {activity.description}
                                </p>
                              </div>
                              <div className="flex flex-col items-end space-y-2">
                                {!activity.is_completed ? (
                                  <Button
                                    onClick={() => handleCompleteActivity(activity.id)}
                                    disabled={isCompleting === activity.id}
                                    className="flex items-center text-sm"
                                  >
                                    {isCompleting === activity.id ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Starting...
                                      </>
                                    ) : (
                                      <>
                                        <PlayCircle size={16} className="mr-1" />
                                        Start
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Badge className="bg-green-500">
                                    ✓ Completed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p>No daily plan available</p>
              <Button onClick={refreshPlan} className="mt-4">
                Generate Plan
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity (30 Days)</CardTitle>
              {dailyStats && (
                <CardDescription>
                  Completion rate: {dailyStats.completion_rate.toFixed(1)}% • 
                  Current streak: {dailyStats.current_streak} days
                </CardDescription>
              )}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedLearningDashboard;