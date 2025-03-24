// src/components/analytics/ProgressDashboard.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { 
  Card, 
  CardContent 
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import MetricsCards from './MetricsCards'
import ProgressChart from './ProgressChart'
import CompletionChart from './CompletionChart'
import RecentActivityTable from './RecentActivityTable'
import OverallMasteryTable from './OverallMasteryTable'

export default function ProgressDashboard() {
  const { loading, error } = useAnalytics()

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <MetricsCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Progress Over Time</h2>
          <ProgressChart />
        </Card>
        
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-4">Completion</h2>
          <CompletionChart />
        </Card>
      </div>
      
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-4">Recent Activity (30 Days)</h2>
        <RecentActivityTable />
      </Card>
      
      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-4">Overall Mastery</h2>
        <OverallMasteryTable />
      </Card>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-8 w-1/4 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <Skeleton className="h-6 w-1/3 mb-4" />
          <Skeleton className="h-[200px] w-full" />
        </Card>
        
        <Card className="p-4">
          <Skeleton className="h-6 w-1/3 mb-4" />
          <Skeleton className="h-[200px] w-full" />
        </Card>
      </div>
      
      <Card className="p-4">
        <Skeleton className="h-6 w-1/3 mb-4" />
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full mb-2" />
        <Skeleton className="h-8 w-full mb-2" />
      </Card>
    </div>
  )
}