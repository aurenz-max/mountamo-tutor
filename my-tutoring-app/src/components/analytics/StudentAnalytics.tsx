// components/analytics/StudentAnalytics.tsx - Simplified version
'use client'

import React, { useState } from 'react'
import { useStudentAnalytics } from '@/lib/hooks/useStudentAnalytics'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, AlertCircle, TrendingUp, Target, Award, BookOpen } from 'lucide-react'
import FilterControls from './FilterControls'
import ProgressDashboard from './ProgressDashboard'
import ProblemReviews from './ProblemReviews'

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    <span className="ml-3 text-lg">Loading analytics...</span>
  </div>
);

// Error component
const ErrorDisplay = ({ error, onRetry, onClear }: { 
  error: string; 
  onRetry: () => void; 
  onClear: () => void; 
}) => (
  <Alert variant="destructive" className="mb-6">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription className="flex items-center justify-between">
      <span>{error}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClear}>
          Dismiss
        </Button>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </AlertDescription>
  </Alert>
);

// Summary cards component
const SummaryCards = ({ summary }: { summary: any }) => {
  if (!summary) return null;

  const cards = [
    {
      title: "Overall Mastery",
      value: `${Math.round(summary.mastery * 100)}%`,
      icon: Award,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Proficiency",
      value: `${Math.round(summary.proficiency * 100)}%`,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Completion",
      value: `${summary.attempted_items}/${summary.total_items}`,
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    },
    {
      title: "Ready Items",
      value: summary.ready_items.toString(),
      icon: BookOpen,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Recommendations component
const RecommendationsSection = ({ recommendations }: { recommendations: any[] | null }) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>No recommendations available at this time.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const highPriorityItems = recommendations.filter(r => r.priority === 'high').slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next Steps</CardTitle>
        <CardDescription>High-priority recommendations for your learning path</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {highPriorityItems.map((rec, index) => (
            <div key={rec.subskill_id} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-sm">{rec.skill_description}</h4>
                <p className="text-sm text-muted-foreground">{rec.subskill_description}</p>
                <div className="mt-1 flex items-center space-x-4 text-xs text-muted-foreground">
                  <span>Mastery: {Math.round(rec.mastery * 100)}%</span>
                  <span>Proficiency: {Math.round(rec.proficiency * 100)}%</span>
                  <span className={`px-2 py-1 rounded ${
                    rec.readiness_status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {rec.readiness_status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default function StudentAnalytics() {
  const analytics = useStudentAnalytics();
  const [activeTab, setActiveTab] = useState('dashboard');

  console.log('📊 StudentAnalytics render:', {
    studentId: analytics.studentId,
    loading: analytics.loading,
    hasMetrics: !!analytics.metrics,
    hasRecommendations: !!analytics.recommendations,
    error: analytics.error,
    lastFetch: analytics.lastFetch
  });

  // Show loading state
  if (analytics.loading && !analytics.metrics) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Student Learning Analytics</h1>
        <LoadingSpinner />
      </div>
    );
  }

  // Show error state
  if (analytics.error && !analytics.metrics) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Student Learning Analytics</h1>
        <ErrorDisplay 
          error={analytics.error} 
          onRetry={analytics.refresh}
          onClear={analytics.clearError}
        />
      </div>
    );
  }

  // Show no student ID state
  if (!analytics.studentId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Student Learning Analytics</h1>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No student profile found. Please ensure you're logged in and have a valid student account.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Student Learning Analytics</h1>
        <div className="flex items-center gap-2">
          {analytics.lastFetch && (
            <span className="text-sm text-muted-foreground">
              Last updated: {analytics.lastFetch.toLocaleTimeString()}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={analytics.refresh}
            disabled={analytics.loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${analytics.loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error display (if error exists but we have cached data) */}
      {analytics.error && analytics.metrics && (
        <ErrorDisplay 
          error={analytics.error} 
          onRetry={analytics.refresh}
          onClear={analytics.clearError}
        />
      )}

      {/* Filter Controls */}
      <FilterControls 
        filters={analytics.filters} 
        onFiltersChange={analytics.setFilters}
        disabled={analytics.loading}
      />

      {/* Summary Cards */}
      {analytics.metrics?.summary && (
        <SummaryCards summary={analytics.metrics.summary} />
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="problem-reviews">Problem Reviews</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="mt-6">
          {analytics.metrics ? (
            <ProgressDashboard 
              data={analytics.metrics} 
              timeseries={analytics.timeseries}
              loading={analytics.loading}
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">No dashboard data available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="recommendations" className="mt-6">
          <RecommendationsSection recommendations={analytics.recommendations} />
        </TabsContent>
        
        <TabsContent value="problem-reviews" className="mt-6">
          <ProblemReviews 
            studentId={analytics.studentId} 
            initialSubject={analytics.filters.subject}
            loading={analytics.loading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}