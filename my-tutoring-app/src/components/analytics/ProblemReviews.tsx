'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AlertCircleIcon, TrendingUp, BarChart3, List } from 'lucide-react'

import { useScoreDistribution } from '@/hooks/useScoreDistribution'
import { useScoreTrends } from '@/hooks/useScoreTrends'
import { TrendsChart } from './TrendsChart'
import { DistributionCard } from './DistributionCard'

interface ProblemReviewsProps {
  studentId: number
  initialSubject?: string | null
}

// Available subjects (you may want to fetch this dynamically)
const AVAILABLE_SUBJECTS = [
  'Language Arts',
  'Mathematics',
  'Science',
  'Social Studies',
  'Art',
  'Music'
]

const ProblemReviews: React.FC<ProblemReviewsProps> = ({
  studentId,
  initialSubject = 'Language Arts'
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || 'Language Arts')
  const [granularity, setGranularity] = useState<'weekly' | 'monthly'>('weekly')

  // Fetch score distribution
  const {
    data: distributionData,
    loading: distributionLoading,
    error: distributionError
  } = useScoreDistribution(studentId, {
    subject: selectedSubject
  })

  // Fetch score trends
  const {
    data: trendsData,
    loading: trendsLoading,
    error: trendsError
  } = useScoreTrends(studentId, {
    granularity: granularity,
    lookback_weeks: granularity === 'weekly' ? 52 : undefined,
    lookback_months: granularity === 'monthly' ? 12 : undefined
  })

  // Organize distribution data by level
  const subjectLevel = distributionData?.distributions.filter(d => d.level === 'subject') || []
  const unitLevel = distributionData?.distributions.filter(d => d.level === 'unit') || []
  const skillLevel = distributionData?.distributions.filter(d => d.level === 'skill') || []

  // Calculate summary metrics
  const overallAvgScore = subjectLevel[0]?.avg_score
  const totalReviews = subjectLevel[0]?.total_reviews || 0

  // Get recent trend (compare last two periods)
  const getRecentTrend = () => {
    if (!trendsData?.trends || trendsData.trends.length === 0) return null

    const subjectTrend = trendsData.trends.find(t => t.subject === selectedSubject)
    if (!subjectTrend || subjectTrend.periods.length < 2) return null

    const periods = subjectTrend.periods.sort((a, b) =>
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    )
    const latest = periods[0]
    const previous = periods[1]

    const change = latest.avg_score - previous.avg_score
    return { change, latest: latest.avg_score, previous: previous.avg_score }
  }

  const trend = getRecentTrend()

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Problem Reviews & Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Score distributions and performance trends from BigQuery analytics
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Overall Average Score</CardDescription>
            <CardTitle className="text-3xl">
              {distributionLoading ? (
                '...'
              ) : overallAvgScore ? (
                <>
                  {overallAvgScore.toFixed(1)}
                  <span className="text-lg text-gray-500">/10</span>
                </>
              ) : (
                'N/A'
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Reviews</CardDescription>
            <CardTitle className="text-3xl">
              {distributionLoading ? '...' : totalReviews.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Recent Trend</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {trendsLoading ? (
                '...'
              ) : trend ? (
                <>
                  <TrendingUp
                    className={`h-6 w-6 ${
                      trend.change > 0 ? 'text-green-500' : trend.change < 0 ? 'text-red-500' : 'text-gray-500'
                    }`}
                  />
                  <span className={trend.change > 0 ? 'text-green-500' : trend.change < 0 ? 'text-red-500' : 'text-gray-500'}>
                    {trend.change > 0 ? '+' : ''}{trend.change.toFixed(2)}
                  </span>
                </>
              ) : (
                'N/A'
              )}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="distribution" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="distribution">
            <BarChart3 className="h-4 w-4 mr-2" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="summary">
            <List className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          {distributionError && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>{distributionError}</AlertDescription>
            </Alert>
          )}

          {distributionLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">Loading score distribution...</p>
              </CardContent>
            </Card>
          ) : distributionData ? (
            <div className="space-y-6">
              {/* Subject Level */}
              {subjectLevel.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Subject Overview</h3>
                  {subjectLevel.map(item => (
                    <DistributionCard key={item.id} item={item} defaultExpanded={true} />
                  ))}
                </div>
              )}

              {/* Unit Level */}
              {unitLevel.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">By Unit ({unitLevel.length} units)</h3>
                  <div className="space-y-3">
                    {unitLevel.map(item => (
                      <DistributionCard key={item.id} item={item} defaultExpanded={false} />
                    ))}
                  </div>
                </div>
              )}

              {/* Skill Level */}
              {skillLevel.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">By Skill ({skillLevel.length} skills)</h3>
                  <div className="space-y-3">
                    {skillLevel.map(item => (
                      <DistributionCard key={item.id} item={item} defaultExpanded={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No distribution data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          {/* Granularity Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Time Period:</span>
            <div className="flex gap-2">
              <Badge
                variant={granularity === 'weekly' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setGranularity('weekly')}
              >
                Weekly
              </Badge>
              <Badge
                variant={granularity === 'monthly' ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setGranularity('monthly')}
              >
                Monthly
              </Badge>
            </div>
          </div>

          {trendsError && (
            <Alert variant="destructive">
              <AlertCircleIcon className="h-4 w-4" />
              <AlertDescription>{trendsError}</AlertDescription>
            </Alert>
          )}

          {trendsLoading ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">Loading trends...</p>
              </CardContent>
            </Card>
          ) : trendsData && trendsData.trends.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Score Trends Over Time</CardTitle>
                <CardDescription>
                  {granularity === 'weekly' ? 'Last 52 weeks' : 'Last 12 months'} - All subjects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendsChart trends={trendsData.trends} showReviewCount={true} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">No trend data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Summary - {selectedSubject}</CardTitle>
              <CardDescription>Key metrics and insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {distributionLoading || trendsLoading ? (
                <p className="text-center text-gray-500">Loading summary...</p>
              ) : (
                <>
                  {/* Overall Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-gray-600">Average Score</p>
                      <p className="text-2xl font-bold">
                        {overallAvgScore ? `${overallAvgScore.toFixed(1)}/10` : 'N/A'}
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-gray-600">Total Reviews</p>
                      <p className="text-2xl font-bold">{totalReviews}</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-gray-600">Units Practiced</p>
                      <p className="text-2xl font-bold">{unitLevel.length}</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="text-sm text-gray-600">Skills Practiced</p>
                      <p className="text-2xl font-bold">{skillLevel.length}</p>
                    </div>
                  </div>

                  {/* Top Performing Units */}
                  {unitLevel.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Top Performing Units</h4>
                      <div className="space-y-2">
                        {unitLevel
                          .sort((a, b) => (b.avg_score || 0) - (a.avg_score || 0))
                          .slice(0, 5)
                          .map(unit => (
                            <div key={unit.id} className="flex items-center justify-between border-b pb-2">
                              <span className="text-sm">{unit.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">
                                  {unit.avg_score?.toFixed(1) || 'N/A'}/10
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({unit.total_reviews} reviews)
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Areas for Improvement */}
                  {unitLevel.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Areas for Improvement</h4>
                      <div className="space-y-2">
                        {unitLevel
                          .sort((a, b) => (a.avg_score || 0) - (b.avg_score || 0))
                          .slice(0, 5)
                          .map(unit => (
                            <div key={unit.id} className="flex items-center justify-between border-b pb-2">
                              <span className="text-sm">{unit.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">
                                  {unit.avg_score?.toFixed(1) || 'N/A'}/10
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({unit.total_reviews} reviews)
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ProblemReviews
