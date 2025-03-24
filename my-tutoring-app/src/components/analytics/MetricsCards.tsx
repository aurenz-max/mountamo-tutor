// src/components/analytics/MetricsCards.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MetricsCards() {
  const { metrics, timeSeriesData } = useAnalytics()
  
  if (!metrics) return null

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }
  
  // Calculate changes by comparing the most recent time period with the previous one
  // This is dynamically calculated from the API's time series data
  const calculateChanges = () => {
    if (!timeSeriesData || !timeSeriesData.data || timeSeriesData.data.length < 2) {
      return {
        mastery: 0,
        proficiency: 0,
        completion: 0,
        problemsCompleted: 0
      };
    }
    
    // Sort data by date
    const sortedData = [...timeSeriesData.data].sort((a, b) => 
      new Date(b.interval_date).getTime() - new Date(a.interval_date).getTime()
    );
    
    const current = sortedData[0]?.metrics;
    const previous = sortedData[1]?.metrics;
    
    return {
      mastery: previous ? ((current.mastery - previous.mastery) * 100) : 0,
      proficiency: previous ? ((current.proficiency - previous.proficiency) * 100) : 0,
      completion: previous ? (current.completion - previous.completion) : 0,
      problemsCompleted: previous ? (current.attempts - previous.attempts) : 0
    };
  }
  
  const changes = calculateChanges();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <MetricCard 
        title="Mastery" 
        value={formatPercentage(metrics.summary.mastery * 100)}
        change={changes.mastery}
        changeLabel="vs Last Month"
      />
      
      <MetricCard 
        title="Proficiency" 
        value={formatPercentage(metrics.summary.proficiency * 100)}
        change={changes.proficiency}
        changeLabel="vs Last Month"
      />
      
      <MetricCard 
        title="Completion" 
        value={formatPercentage(metrics.summary.completion)}
        change={changes.completion}
        changeLabel="vs Last Month"
      />
      
      <MetricCard 
        title="Problems Completed" 
        value={metrics.summary.attempted_items.toString()}
        change={changes.problemsCompleted}
        changeLabel="vs Last Month"
        isPercentage={false}
      />
    </div>
  )
}

interface MetricCardProps {
  title: string
  value: string
  change: number
  changeLabel: string
  isPercentage?: boolean
}

function MetricCard({ title, value, change, changeLabel, isPercentage = true }: MetricCardProps) {
  const isPositive = change >= 0
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center">
            <span className={cn(
              "text-xs inline-flex items-center gap-1",
              isPositive ? "text-green-500" : "text-red-500"
            )}>
              {isPositive ? (
                <ArrowUpIcon className="h-3 w-3" />
              ) : (
                <ArrowDownIcon className="h-3 w-3" />
              )}
              {`${isPositive ? '+' : ''}${Math.abs(change).toFixed(2)}${isPercentage ? '%' : ''} ${changeLabel}`}
            </span>
          </div>
          <h3 className="text-3xl font-bold">{value}</h3>
          <p className="text-base font-medium text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  )
}