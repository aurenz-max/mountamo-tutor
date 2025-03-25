// src/components/analytics/RecommendationsPanel.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from "@/components/ui/progress"
import { ArrowRight, Target, Lightbulb, AlertTriangle, TrendingUp, Clock, BarChart2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

export default function RecommendationsPanel() {
  const { recommendations, loading } = useAnalytics()
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Recommendations...</CardTitle>
        </CardHeader>
      </Card>
    )
  }
  
  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Learning Recommendations</CardTitle>
          <CardDescription>No recommendations available at this time.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'performance_gap':
        return <Target className="h-5 w-5 text-orange-500" />
      case 'coverage_gap':
        return <Lightbulb className="h-5 w-5 text-blue-500" />
      case 'future_item':
        return <ArrowRight className="h-5 w-5 text-green-500" />
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    }
  }
  
  const getRecommendationTypeLabel = (type: string) => {
    switch (type) {
      case 'performance_gap':
        return 'Needs Improvement'
      case 'coverage_gap':
        return 'Not Attempted'
      case 'future_item':
        return 'Future Learning'
      default:
        return 'Recommendation'
    }
  }
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-orange-100 text-orange-800'
      case 'low':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const getProgressColor = (value: number) => {
    const percent = value * 100;
    if (percent >= 80) return "bg-green-500";
    if (percent >= 60) return "bg-yellow-500";
    if (percent >= 40) return "bg-orange-500";
    return "bg-red-500";
  }

  const getReadinessStatusChip = (readinessStatus: string) => {
    switch (readinessStatus) {
      case 'Ready':
        return <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium">Ready</span>
      case 'Ready for Subskill':
        return <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">Ready for Subskill</span>
      case 'Ready for Skill':
        return <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium">Ready for Skill</span>
      case 'Not Ready':
        return <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">Not Ready</span>
      default:
        return null
    }
  }

  const getAttemptStatusLabel = (recommendation) => {
    if (recommendation.attempt_count > 0) {
      return `${recommendation.attempt_count} attempt${recommendation.attempt_count > 1 ? 's' : ''} made`;
    }
    return 'Not attempted yet';
  }

  // Function to find the most recent timestamp from individual attempts if available
  const getLastAttemptDate = (recommendation) => {
    if (!recommendation.is_attempted || recommendation.attempt_count === 0) {
      return null;
    }
    
    // If we have individual attempts data
    if (recommendation.individual_attempts && recommendation.individual_attempts.length > 0) {
      // Sort by timestamp descending and get the most recent
      const sortedAttempts = [...recommendation.individual_attempts].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      if (sortedAttempts[0]?.timestamp) {
        const date = new Date(sortedAttempts[0].timestamp);
        try {
          return formatDistanceToNow(date, { addSuffix: true });
        } catch (error) {
          return 'recently';
        }
      }
    }
    
    // Fallback
    return 'recently';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Recommendations</CardTitle>
        <CardDescription>Personalized recommendations based on student performance and readiness</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {recommendations.map((recommendation, index) => (
            <div 
              key={`${recommendation.subskill_id}-${index}`}
              className="p-5 border rounded-lg bg-white shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {getRecommendationIcon(recommendation.type)}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      getPriorityColor(recommendation.priority)
                    )}>
                      {recommendation.priority_level}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">
                      {getRecommendationTypeLabel(recommendation.type)}
                    </span>
                    {getReadinessStatusChip(recommendation.readiness_status)}
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-base font-semibold mb-1">{recommendation.subskill_description}</h4>
                    <div className="flex flex-col text-sm text-gray-600 mb-2">
                      <span>
                        <span className="font-medium">Path:</span> {recommendation.unit_title} &gt; {recommendation.skill_description}
                      </span>
                      {recommendation.next_subskill && (
                        <span className="text-xs text-gray-500 mt-1">
                          <span className="font-medium">Next in sequence:</span> {recommendation.next_subskill}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Performance Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 p-3 rounded-md">
                    {/* Proficiency */}
                    <div className="flex flex-col">
                      <div className="flex items-center mb-1">
                        <BarChart2 className="h-4 w-4 mr-1 text-blue-600" />
                        <span className="text-xs font-medium text-gray-700">Current Proficiency</span>
                      </div>
                      <div className="flex items-center mb-1">
                        <span className="text-sm font-semibold">{formatPercent(recommendation.proficiency)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                        <Progress 
                          value={recommendation.proficiency * 100} 
                          className={cn("h-2.5", getProgressColor(recommendation.proficiency))} 
                        />
                      </div>
                    </div>
                    
                    {/* Mastery vs Avg Score */}
                    <div className="flex flex-col">
                      <div className="flex items-center mb-1">
                        <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
                        <span className="text-xs font-medium text-gray-700">
                          {recommendation.is_attempted ? 'Average Score' : 'Target Score'}
                        </span>
                      </div>
                      <div className="flex items-center mb-1">
                        <span className="text-sm font-semibold">
                          {recommendation.is_attempted 
                            ? formatPercent(recommendation.avg_score)
                            : 'Not yet attempted'}
                        </span>
                      </div>
                      {recommendation.is_attempted && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                          <Progress 
                            value={recommendation.avg_score * 100} 
                            className={cn("h-2.5", getProgressColor(recommendation.avg_score))} 
                          />
                        </div>
                      )}
                      {!recommendation.is_attempted && (
                        <div className="text-xs text-gray-500">Start attempting to track your progress</div>
                      )}
                    </div>
                    
                    {/* Attempts with completion */}
                    <div className="flex flex-col">
                      <div className="flex items-center mb-1">
                        <Clock className="h-4 w-4 mr-1 text-purple-600" />
                        <span className="text-xs font-medium text-gray-700">Activity Status</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm font-semibold flex items-center gap-1">
                          {recommendation.is_attempted 
                            ? <CheckCircle2 className="h-3 w-3 text-green-600" /> 
                            : <XCircle className="h-3 w-3 text-gray-400" />}
                          {getAttemptStatusLabel(recommendation)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {recommendation.is_attempted 
                          ? `Last attempt: ${getLastAttemptDate(recommendation)}`
                          : `Completion: ${formatPercent(recommendation.completion)}`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Recommendation Message */}
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Recommendation:</span> {recommendation.message}
                    </p>
                    {recommendation.type === 'performance_gap' && (
                      <p className="text-xs text-gray-600 mt-2">
                        Focus on improving proficiency to reach mastery level (80% or higher).
                      </p>
                    )}
                    {recommendation.type === 'coverage_gap' && (
                      <p className="text-xs text-gray-600 mt-2">
                        This skill is ready to be learned but hasn't been attempted yet.
                      </p>
                    )}
                    {recommendation.type === 'future_item' && (
                      <p className="text-xs text-gray-600 mt-2">
                        Upcoming skill in the learning path that will be unlocked after prerequisite skills are mastered.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}