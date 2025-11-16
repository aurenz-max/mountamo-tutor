'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertCircleIcon,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  BarChart3,
  Minus
} from 'lucide-react'

import { useAssessmentOverview } from '@/hooks/useAssessmentOverview'
// import { useAssessmentPerformance } from '@/hooks/useAssessmentPerformance' // Disabled: BigQuery schema issues
import { useAssessmentHistory } from '@/hooks/useAssessmentHistory'
import AssessmentDetailsModal from './AssessmentDetailsModal'
import PerformanceTab from './PerformanceTab'
import type { AssessmentHistoryItem } from '@/types/analytics'

interface AssessmentAnalyticsProps {
  studentId: number
  initialSubject?: string | null
}

// Available subjects
const AVAILABLE_SUBJECTS = [
  'All Subjects',
  'Language Arts',
  'Mathematics',
  'Science',
  'Social Studies'
]

const AssessmentAnalytics: React.FC<AssessmentAnalyticsProps> = ({
  studentId,
  initialSubject = 'All Subjects'
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || 'All Subjects')
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentHistoryItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Fetch all assessment data
  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError
  } = useAssessmentOverview(studentId, {
    subject: selectedSubject !== 'All Subjects' ? selectedSubject : undefined
  })

  // TEMPORARILY DISABLED: Performance endpoint has BigQuery schema issues
  // const {
  //   data: performanceData,
  //   loading: performanceLoading,
  //   error: performanceError
  // } = useAssessmentPerformance(studentId, {
  //   subject: selectedSubject !== 'All Subjects' ? selectedSubject : undefined
  // })

  const {
    data: historyData,
    loading: historyLoading,
    error: historyError
  } = useAssessmentHistory(studentId, {
    subject: selectedSubject !== 'All Subjects' ? selectedSubject : undefined,
    limit: 20
  })

  // Helper function to get trend icon
  const getTrendIcon = (trend: string) => {
    if (trend === 'Improving') return <TrendingUp className="h-4 w-4 text-green-600" />
    if (trend === 'Declining') return <TrendingDown className="h-4 w-4 text-red-600" />
    return <Minus className="h-4 w-4 text-gray-600" />
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Handle assessment row click
  const handleAssessmentClick = (assessment: AssessmentHistoryItem) => {
    setSelectedAssessment(assessment)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Assessment Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Comprehensive assessment insights and performance metrics
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_SUBJECTS.map(subject => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error Display */}
      {(overviewError || historyError) && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            {overviewError || historyError}
          </AlertDescription>
        </Alert>
      )}

      {/* Nested Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          {overviewLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">Loading overview data...</p>
              </CardContent>
            </Card>
          ) : overviewData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Object.entries(overviewData.total_assessments_by_subject).map(([subject, count]) => (
                  <Card key={subject}>
                    <CardHeader className="pb-3">
                      <CardDescription>{subject}</CardDescription>
                      <CardTitle className="text-2xl flex items-center justify-between">
                        <span>{count} Assessments</span>
                        {getTrendIcon(overviewData.trend_status_by_subject[subject])}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        Avg Score: {overviewData.avg_score_by_subject[subject]?.toFixed(1)}%
                      </p>
                    </CardHeader>
                  </Card>
                ))}
              </div>

              {/* Recent Assessments */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Assessments</CardTitle>
                  <CardDescription>Your latest assessment results</CardDescription>
                </CardHeader>
                <CardContent>
                  {overviewData.recent_assessments.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Questions</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {overviewData.recent_assessments.map((assessment) => (
                          <TableRow key={assessment.assessment_id}>
                            <TableCell className="font-medium">{assessment.subject}</TableCell>
                            <TableCell>{formatDate(assessment.completed_at)}</TableCell>
                            <TableCell>
                              <Badge className={assessment.score_percentage >= 80 ? 'bg-green-100 text-green-800' : assessment.score_percentage >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                                {assessment.score_percentage.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell>{assessment.correct_count}/{assessment.total_questions}</TableCell>
                            <TableCell>{assessment.time_taken_minutes ? `${assessment.time_taken_minutes} min` : 'N/A'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-center text-gray-500 py-8">No recent assessments found</p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">No assessment data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Performance Tab - Aggregated from History Data */}
        <TabsContent value="performance" className="space-y-4 mt-6">
          {historyLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">Loading performance data...</p>
              </CardContent>
            </Card>
          ) : (
            <PerformanceTab
              assessments={historyData?.assessments || []}
              selectedSubject={selectedSubject}
            />
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-6">
          {historyLoading ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">Loading assessment history...</p>
              </CardContent>
            </Card>
          ) : historyData && historyData.assessments && historyData.assessments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Assessment History</CardTitle>
                <CardDescription>Complete record of all assessments</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Skills</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.assessments.map((assessment) => (
                      <TableRow
                        key={assessment.assessment_id}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleAssessmentClick(assessment)}
                      >
                        <TableCell>{formatDate(assessment.completed_at || assessment.created_at)}</TableCell>
                        <TableCell className="font-medium">{assessment.subject}</TableCell>
                        <TableCell>
                          <Badge className={assessment.score_percentage >= 80 ? 'bg-green-100 text-green-800' : assessment.score_percentage >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                            {assessment.score_percentage.toFixed(1)}%
                          </Badge>
                          <span className="text-xs text-gray-500 ml-2">
                            ({assessment.correct_count}/{assessment.total_questions})
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <span className="text-green-600">{assessment.skills_mastered} mastered</span>
                            {assessment.skills_struggling > 0 && (
                              <span className="text-red-600 ml-2">{assessment.skills_struggling} struggling</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{assessment.time_taken_minutes ? `${assessment.time_taken_minutes} min` : 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            assessment.performance_vs_average === 'above_average' ? 'border-green-500 text-green-700' :
                            assessment.performance_vs_average === 'below_average' ? 'border-red-500 text-red-700' :
                            'border-gray-500 text-gray-700'
                          }>
                            {assessment.performance_vs_average.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">No assessment history available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Assessment Details Modal */}
      <AssessmentDetailsModal
        assessment={selectedAssessment}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  )
}

export default AssessmentAnalytics
