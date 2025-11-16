'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Target, BookOpen, TrendingUp } from 'lucide-react'
import { AssessmentHistoryItem } from '@/types/analytics'
import {
  aggregatePerformanceByType,
  aggregatePerformanceByCategory,
  getCategoryConfig,
  getScoreBadgeClass
} from '@/lib/analytics/aggregations'

interface PerformanceTabProps {
  assessments: AssessmentHistoryItem[]
  selectedSubject: string
}

const PerformanceTab: React.FC<PerformanceTabProps> = ({
  assessments,
  selectedSubject
}) => {
  // Aggregate performance data
  const aggregatedByType = useMemo(() => {
    return aggregatePerformanceByType(assessments)
  }, [assessments])

  const aggregatedByCategory = useMemo(() => {
    return aggregatePerformanceByCategory(assessments)
  }, [assessments])

  // Show empty state if no data
  if (assessments.length === 0) {
    return (
      <div className="space-y-4 mt-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-2">
              <TrendingUp className="h-12 w-12 mx-auto text-gray-400" />
              <p className="text-gray-500 font-medium">No assessment data available</p>
              <p className="text-sm text-gray-400">
                {selectedSubject !== 'All Subjects'
                  ? `No assessments found for ${selectedSubject}`
                  : 'Complete some assessments to see performance analytics'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Assessments</CardDescription>
            <CardTitle className="text-3xl">{assessments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Score</CardDescription>
            <CardTitle className="text-3xl">
              {assessments.length > 0
                ? (assessments.reduce((sum, a) => sum + a.score_percentage, 0) / assessments.length).toFixed(1)
                : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Questions</CardDescription>
            <CardTitle className="text-3xl">
              {assessments.reduce((sum, a) => sum + a.total_questions, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Performance by Problem Type */}
      {aggregatedByType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance by Problem Type
            </CardTitle>
            <CardDescription>How you performed on different question formats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aggregatedByType.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium capitalize">
                      {item.problem_type.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-gray-600">
                      {item.correct}/{item.total} correct
                    </p>
                  </div>
                  <Badge className={getScoreBadgeClass(item.percentage)}>
                    {item.percentage.toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={item.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Performance by Learning Category */}
      {aggregatedByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Performance by Learning Category
            </CardTitle>
            <CardDescription>Your progress across different skill focus areas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aggregatedByCategory.map((item, idx) => {
              const categoryConfig = getCategoryConfig(item.category)

              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={categoryConfig.bgClass + ' ' + categoryConfig.colorClass}>
                          {categoryConfig.label}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {item.unique_skills} skill{item.unique_skills !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.correct}/{item.total} correct
                      </p>
                    </div>
                    <Badge className={getScoreBadgeClass(item.percentage)}>
                      {item.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={item.percentage} className="h-2" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Additional Context */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Performance data is aggregated across {assessments.length} assessment{assessments.length !== 1 ? 's' : ''}
            {selectedSubject !== 'All Subjects' && ` in ${selectedSubject}`}.
            Use the subject filter above to view performance for specific subjects.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default PerformanceTab
