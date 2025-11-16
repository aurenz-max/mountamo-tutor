'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Award,
  TrendingUp,
  AlertCircle,
  BookOpen,
  Target,
  Lightbulb
} from 'lucide-react'
import { AssessmentHistoryItem } from '@/types/analytics'

interface AssessmentDetailsModalProps {
  assessment: AssessmentHistoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AssessmentDetailsModal: React.FC<AssessmentDetailsModalProps> = ({
  assessment,
  open,
  onOpenChange
}) => {
  if (!assessment) return null

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get score color class
  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Get score background color
  const getScoreBgColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100'
    if (percentage >= 60) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  // Parse percentage values (handle string or number)
  const parsePercentage = (value: string | number): number => {
    return typeof value === 'string' ? parseFloat(value) : value
  }

  // Parse count values (handle string or number)
  const parseCount = (value: string | number): number => {
    return typeof value === 'string' ? parseInt(value) : value
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {assessment.subject} Assessment
              </DialogTitle>
              <DialogDescription>
                {assessment.completed_at && formatDate(assessment.completed_at)}
              </DialogDescription>
            </div>
            <div className={`text-4xl font-bold ${getScoreColor(assessment.score_percentage)}`}>
              {assessment.score_percentage.toFixed(1)}%
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Overall Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Questions</CardDescription>
                <CardTitle className="text-xl">
                  {assessment.correct_count}/{assessment.total_questions}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Time Taken</CardDescription>
                <CardTitle className="text-xl">
                  {assessment.time_taken_minutes || 'N/A'} min
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Skills Mastered</CardDescription>
                <CardTitle className="text-xl text-green-600">
                  {assessment.skills_mastered}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Skills Struggling</CardDescription>
                <CardTitle className="text-xl text-red-600">
                  {assessment.skills_struggling}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* AI Summary Section */}
          {assessment.ai_summary && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Lightbulb className="h-5 w-5" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-blue-800 leading-relaxed">{assessment.ai_summary}</p>
              </CardContent>
            </Card>
          )}

          {/* Performance Quote */}
          {assessment.performance_quote && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Award className="h-5 w-5" />
                  Motivational Message
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-purple-800 italic leading-relaxed">
                  "{assessment.performance_quote}"
                </p>
              </CardContent>
            </Card>
          )}

          {/* Performance by Problem Type */}
          {assessment.performance_by_type && assessment.performance_by_type.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Performance by Problem Type
                </CardTitle>
                <CardDescription>How you performed on different question formats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assessment.performance_by_type.map((item, idx) => {
                  const percentage = parsePercentage(item.percentage)
                  const correct = parseCount(item.correct)
                  const total = parseCount(item.total)

                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium capitalize">
                            {item.problem_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {correct}/{total} correct
                          </p>
                        </div>
                        <Badge className={getScoreBgColor(percentage)}>
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Performance by Category */}
          {assessment.performance_by_category && assessment.performance_by_category.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Performance by Learning Category
                </CardTitle>
                <CardDescription>Your progress across different skill focus areas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assessment.performance_by_category.map((item, idx) => {
                  const percentage = parsePercentage(item.percentage)
                  const correct = parseCount(item.correct)
                  const total = parseCount(item.total)
                  const uniqueSkills = parseCount(item.unique_skills)

                  // Category badges with colors
                  const getCategoryColor = (category: string) => {
                    if (category === 'weak_spots') return 'bg-red-100 text-red-800'
                    if (category === 'foundational_review') return 'bg-blue-100 text-blue-800'
                    if (category === 'new_frontiers') return 'bg-purple-100 text-purple-800'
                    if (category === 'recent_practice') return 'bg-green-100 text-green-800'
                    return 'bg-gray-100 text-gray-800'
                  }

                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={getCategoryColor(item.category)}>
                              {item.category.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {uniqueSkills} skill{uniqueSkills !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {correct}/{total} correct
                          </p>
                        </div>
                        <Badge className={getScoreBgColor(percentage)}>
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Common Misconceptions */}
          {assessment.common_misconceptions && assessment.common_misconceptions.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-900">
                  <AlertCircle className="h-5 w-5" />
                  Areas for Growth
                </CardTitle>
                <CardDescription>Common patterns identified in this assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {assessment.common_misconceptions.map((misconception, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-orange-500 mt-1">•</span>
                      <span className="text-gray-700 flex-1">{misconception}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Focus Areas Summary */}
          <Card className="bg-gray-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Focus Areas Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-sm font-medium text-red-800">Weak Spots</span>
                  <span className="text-2xl font-bold text-red-600">{assessment.weak_spots_count}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-sm font-medium text-blue-800">Foundation Review</span>
                  <span className="text-2xl font-bold text-blue-600">{assessment.foundational_review_count}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <span className="text-sm font-medium text-purple-800">New Frontiers</span>
                  <span className="text-2xl font-bold text-purple-600">{assessment.new_frontiers_count}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AssessmentDetailsModal
