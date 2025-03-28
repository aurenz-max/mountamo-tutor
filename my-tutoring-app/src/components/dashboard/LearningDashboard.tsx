'use client';

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
  ChevronLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Link from 'next/link';
import { analyticsApi, Recommendation } from '@/lib/studentAnalyticsAPI';

const LearningDashboard = () => {
  const router = useRouter();
  
  // Student data
  const [studentId] = useState(1); // Assuming student ID 1 for API calls
  const [studentName] = useState('Alex');
  const [points] = useState(750);
  const [streak] = useState(5);
  const [dailyGoal] = useState(85);
  const [goalProgress] = useState(45);
  
  // State for API data
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch recommendations on component mount
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const data = await analyticsApi.getRecommendations(studentId, {
          limit: 5 // Get top 5 recommendations
        });
        setRecommendations(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load recommendations');
        setLoading(false);
        console.error('Error fetching recommendations:', err);
      }
    };
    
    fetchRecommendations();
  }, [studentId]);
  
  const calculateGoalPercentage = () => {
    return (goalProgress / dailyGoal) * 100;
  };

  // Map recommendation type to icon
  const getRecommendationIcon = (subskillId: string) => {
    // Simple mapping based on skill area
    if (subskillId.startsWith('COUNT')) {
      return <PenTool size={20} />;
    } else if (subskillId.startsWith('GEOM')) {
      return <Puzzle size={20} />;
    } else {
      return <Brain size={20} />;
    }
  };

  // Determine estimated time based on subskill complexity (placeholder logic)
  const getEstimatedTime = (priority: string, attemptCount: number) => {
    if (priority === 'high') {
      return `${15 + (attemptCount > 3 ? 5 : 0)} min`;
    } else if (priority === 'medium') {
      return `${10 + (attemptCount > 3 ? 5 : 0)} min`;
    } else {
      return '8 min';
    }
  };

  // Calculate points reward based on priority and complexity
  const getPointsReward = (priority: string, proficiency: number) => {
    if (priority === 'high') {
      return Math.round(50 * (1 - proficiency) + 30);
    } else if (priority === 'medium') {
      return Math.round(30 * (1 - proficiency) + 20);
    } else {
      return 20;
    }
  };

  // Transform API recommendations to UI format
  const formatRecommendations = () => {
    if (!recommendations.length) return [];
    
    return recommendations.map(rec => ({
      id: rec.subskill_id,
      title: rec.unit_title,
      description: rec.subskill_description,
      type: rec.is_attempted ? 'Practice' : 'New Skill',
      urgency: rec.priority,
      icon: getRecommendationIcon(rec.subskill_id),
      points: getPointsReward(rec.priority, rec.proficiency),
      estimatedTime: getEstimatedTime(rec.priority, rec.attempt_count),
      proficiency: rec.proficiency * 100,
      // Add original recommendation data for passing to practice page
      originalData: rec
    }));
  };

  // Format recommendations for display
  const formattedRecommendations = formatRecommendations();
  
  // Handle click on recommendation to start practice
  const handleStartPractice = (recommendation: any) => {
    // Create a practice topic object from the recommendation
    const practiceTopic = {
      subject: 'mathematics', // Assuming math as the default subject
      selection: {
        unit: recommendation.originalData.unit_id,
        skill: recommendation.originalData.skill_id,
        subskill: recommendation.originalData.subskill_id,
      },
      unit: {
        title: recommendation.title
      },
      skill: {
        description: recommendation.originalData.skill_description || recommendation.title
      },
      subskill: {
        description: recommendation.description
      },
      difficulty_range: {
        target: recommendation.originalData.difficulty || 3.0
      },
      // Add flags for auto-starting the practice session
      autoStart: true,
      useRecommendations: true
    };
    
    // Save the selection to localStorage for the practice page to use
    localStorage.setItem('selectedPractice', JSON.stringify(practiceTopic));
    
    // Navigate to the practice page
    router.push('/practice');
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link href="/">
          <Button 
            variant="ghost" 
            className="flex items-center text-gray-600"
          >
            <ChevronLeft className="mr-1" size={16} />
            Back to Learning Modes
          </Button>
        </Link>
      </div>
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">MathMentor</h1>
          <p className="text-gray-500">Your daily math adventure</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Award className="text-yellow-500 mr-2" />
            <span className="font-bold">{points} points</span>
          </div>
          <div className="flex items-center">
            <Calendar className="text-yellow-500 mr-2" />
            <span className="font-bold">{streak} day streak</span>
          </div>
          <div className="bg-gray-100 rounded-full p-2">
            <span className="font-bold">A</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Goal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2">
                <Progress value={calculateGoalPercentage()} className="h-5">
                  {calculateGoalPercentage() > 20 && (
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span className="text-xs text-white font-semibold">
                        {goalProgress}/{dailyGoal} points
                      </span>
                    </div>
                  )}
                </Progress>
              </div>
              <p className="text-sm text-gray-600">Earn {dailyGoal - goalProgress} more points to reach your daily goal!</p>
            </CardContent>
          </Card>
          
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
          <Card className="bg-blue-500 text-white border-0">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-2">Good morning, {studentName}!</h2>
              <p>Our recommendation engine suggests focusing on <strong>Counting and Cardinality</strong> today. You have some skills that need improvement!</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Today's Recommendations</CardTitle>
              <Button variant="link" className="text-sm text-blue-600">View All</Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-6">Loading recommendations...</div>
              ) : error ? (
                <div className="text-center py-6 text-red-500">{error}</div>
              ) : (
                <div className="space-y-4">
                  {formattedRecommendations.length > 0 ? (
                    formattedRecommendations.map(recommendation => (
                      <div 
                        key={recommendation.id} 
                        className={`p-4 rounded-lg border-l-4 ${
                          recommendation.urgency === 'high' ? 'border-red-500' : 
                          recommendation.urgency === 'medium' ? 'border-yellow-500' : 'border-green-500'
                        } hover:bg-gray-50 cursor-pointer`}
                        onClick={() => handleStartPractice(recommendation)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <div className={`p-2 rounded-full mr-3 ${
                                recommendation.type === 'Practice' ? 'bg-blue-100 text-blue-600' :
                                recommendation.type === 'New Skill' ? 'bg-green-100 text-green-600' :
                                'bg-purple-100 text-purple-600'
                              }`}>
                                {recommendation.icon}
                              </div>
                              <div>
                                <h3 className="font-bold">{recommendation.title}</h3>
                                <span className="text-xs text-gray-500">{recommendation.type} • {recommendation.estimatedTime}</span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 ml-12">{recommendation.description}</p>
                            <div className="ml-12 mt-2">
                              <div className="text-xs text-gray-500 mb-1">Current proficiency: {recommendation.proficiency.toFixed(1)}%</div>
                              <Progress value={recommendation.proficiency} className="h-2 w-full max-w-xs" />
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center text-yellow-600 mb-2">
                              <Star size={16} className="mr-1" />
                              <span className="font-bold">{recommendation.points} pts</span>
                            </div>
                            <Button 
                              variant="link" 
                              className="flex items-center text-sm text-blue-600 p-0 h-auto font-semibold"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the parent div's onClick
                                handleStartPractice(recommendation);
                              }}
                            >
                              Start now <ArrowRight size={16} className="ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6">No recommendations available at this time.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Upcoming Schedule and Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center p-2 bg-blue-50 rounded-lg">
                    <Calendar className="text-blue-500 mr-3" />
                    <div className="flex-1">
                      <p className="font-medium">Live Tutoring Session</p>
                      <p className="text-sm text-gray-500">Tomorrow • 4:00 PM</p>
                    </div>
                    <Button size="sm">Join</Button>
                  </div>
                  <div className="flex items-center p-2">
                    <Calendar className="text-blue-500 mr-3" />
                    <div className="flex-1">
                      <p className="font-medium">Algebra Test</p>
                      <p className="text-sm text-gray-500">Next Monday • All day</p>
                    </div>
                    <Button variant="outline" size="sm">Prepare</Button>
                  </div>
                  <div className="flex items-center p-2">
                    <Calendar className="text-blue-500 mr-3" />
                    <div className="flex-1">
                      <p className="font-medium">Group Study Session</p>
                      <p className="text-sm text-gray-500">Next Wednesday • 5:00 PM</p>
                    </div>
                    <Button variant="outline" size="sm">Details</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Recent Activity Card */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity (30 Days)</CardTitle>
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
                        <td className="px-6 py-2 font-medium">Alphabet Recognition</td>
                        <td className="text-right px-4">0</td>
                        <td className="text-right px-4">0%</td>
                        <td className="text-right px-6">0%</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 font-medium">Counting and Cardinality</td>
                        <td className="text-right px-4">45</td>
                        <td className="text-right px-4"><span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">74%</span></td>
                        <td className="text-right px-6">83%</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 font-medium">Geometry</td>
                        <td className="text-right px-4">4</td>
                        <td className="text-right px-4"><span className="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800">95%</span></td>
                        <td className="text-right px-6">93%</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 font-medium">Reading Foundations</td>
                        <td className="text-right px-4">0</td>
                        <td className="text-right px-4">0%</td>
                        <td className="text-right px-6">0%</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 font-medium">Writing</td>
                        <td className="text-right px-4">0</td>
                        <td className="text-right px-4">0%</td>
                        <td className="text-right px-6">0%</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-2 font-bold">Total</td>
                        <td className="text-right px-4 font-bold">57</td>
                        <td className="text-right px-4 font-bold"><span className="px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-800">78%</span></td>
                        <td className="text-right px-6 font-bold">88%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LearningDashboard;