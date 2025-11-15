// src/components/analytics/ProgressChart.tsx
'use client'

import React, { useState } from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

export default function ProgressChart() {
  const { timeSeriesData, updateTimeSeriesView, loading } = useAnalytics()
  const [interval, setInterval] = useState('month')
  const [selectedMetrics, setSelectedMetrics] = useState(['mastery', 'proficiency', 'avg_score'])
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Progress Data...</CardTitle>
        </CardHeader>
      </Card>
    )
  }
  
  if (!timeSeriesData || !timeSeriesData.data || timeSeriesData.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progress Over Time</CardTitle>
          <CardDescription>No time series data available for the selected period.</CardDescription>
        </CardHeader>
      </Card>
    )
  }
  
  // Format data for charts
  const formattedData = timeSeriesData.data.map(dataPoint => {
    // Format date for display
    const date = parseISO(dataPoint.interval_date)
    const formattedDate = format(date, 'MMM yyyy')
    
    // Format metrics as percentages
    return {
      date: formattedDate,
      rawDate: dataPoint.interval_date,
      mastery: Math.round(dataPoint.metrics.mastery * 100),
      proficiency: Math.round(dataPoint.metrics.proficiency * 100),
      avg_score: Math.round(dataPoint.metrics.avg_score * 100),
      completion: Math.round(dataPoint.metrics.completion),
      attempt_count: dataPoint.metrics.attempt_count,
      attempted_items: dataPoint.metrics.attempted_items,
      total_items: dataPoint.metrics.total_items,
      ready_items: dataPoint.metrics.ready_items,
    }
  })
  
  // Sort data by date
  formattedData.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
  
  // Handle interval change
  const handleIntervalChange = (value: string) => {
    setInterval(value)
    updateTimeSeriesView(timeSeriesData.level, value)
  }
  
  // Custom tooltip for percentage metrics
  const PercentageTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      )
    }
    return null
  }
  
  // Custom tooltip for attempt metrics
  const AttemptsTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border rounded shadow-sm">
          <p className="font-medium">{label}</p>
          <p className="text-sm">Attempt Count: {payload[0]?.payload?.attempt_count || 0}</p>
          <p className="text-sm">Attempted Items: {payload[0]?.payload?.attempted_items || 0}</p>
          <p className="text-sm">Total Items: {payload[0]?.payload?.total_items || 0}</p>
          <p className="text-sm">Ready Items: {payload[0]?.payload?.ready_items || 0}</p>
        </div>
      )
    }
    return null
  }
  
  // Metric options for advanced view
  const metricOptions = [
    { value: 'mastery', label: 'Mastery', color: '#f59e0b' },
    { value: 'proficiency', label: 'Proficiency', color: '#3b82f6' },
    { value: 'avg_score', label: 'Avg. Score', color: '#10b981' },
    { value: 'completion', label: 'Completion', color: '#6366f1' }
  ]
  
  const toggleMetric = (metricValue: string) => {
    if (selectedMetrics.includes(metricValue)) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter(m => m !== metricValue))
      }
    } else {
      setSelectedMetrics([...selectedMetrics, metricValue])
    }
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <CardTitle>Progress Over Time</CardTitle>
            <CardDescription className="mt-1">Track student performance metrics over time</CardDescription>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0">
            <span className="text-sm text-gray-500">Interval:</span>
            <Select
              value={interval}
              onValueChange={handleIntervalChange}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="quarter">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="performance">
          <TabsList className="mb-4">
            <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
            <TabsTrigger value="attempts">Attempt Metrics</TabsTrigger>
            <TabsTrigger value="advanced">Advanced View</TabsTrigger>
          </TabsList>
          
          {/* Performance Metrics Tab */}
          <TabsContent value="performance">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={formattedData}
                  margin={{
                    top: 5,
                    right: 20,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<PercentageTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="mastery" stroke="#f59e0b" name="Mastery %" />
                  <Line type="monotone" dataKey="proficiency" stroke="#3b82f6" name="Proficiency %" />
                  <Line type="monotone" dataKey="avg_score" stroke="#10b981" name="Avg. Score %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          {/* Attempts Metrics Tab */}
          <TabsContent value="attempts">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={formattedData}
                  margin={{
                    top: 5,
                    right: 20,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<AttemptsTooltip />} />
                  <Legend />
                  <Bar dataKey="attempt_count" fill="#3b82f6" name="Attempt Count" />
                  <Bar dataKey="attempted_items" fill="#10b981" name="Items Attempted" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          {/* Advanced View Tab */}
          <TabsContent value="advanced">
            <div className="mb-4 flex flex-wrap gap-2">
              {metricOptions.map(option => (
                <Badge 
                  key={option.value}
                  variant={selectedMetrics.includes(option.value) ? "default" : "outline"}
                  onClick={() => toggleMetric(option.value)}
                  className="cursor-pointer"
                  style={{ backgroundColor: selectedMetrics.includes(option.value) ? option.color : 'transparent' }}
                >
                  {option.label}
                </Badge>
              ))}
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={formattedData}
                  margin={{
                    top: 5,
                    right: 20,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={<PercentageTooltip />} />
                  <Legend />
                  {selectedMetrics.includes('mastery') && (
                    <Line type="monotone" dataKey="mastery" stroke="#f59e0b" name="Mastery %" />
                  )}
                  {selectedMetrics.includes('proficiency') && (
                    <Line type="monotone" dataKey="proficiency" stroke="#3b82f6" name="Proficiency %" />
                  )}
                  {selectedMetrics.includes('avg_score') && (
                    <Line type="monotone" dataKey="avg_score" stroke="#10b981" name="Avg. Score %" />
                  )}
                  {selectedMetrics.includes('completion') && (
                    <Line type="monotone" dataKey="completion" stroke="#6366f1" name="Completion %" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
        
        {/* Data Summary */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-sm text-gray-500">Total Attempts</div>
            <div className="text-xl font-bold">
              {formattedData.reduce((sum, item) => sum + item.attempt_count, 0)}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-sm text-gray-500">Items Attempted</div>
            <div className="text-xl font-bold">
              {formattedData.length > 0 ? formattedData[formattedData.length - 1].attempted_items : 0}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-sm text-gray-500">Latest Mastery</div>
            <div className="text-xl font-bold">
              {formattedData.length > 0 ? `${formattedData[formattedData.length - 1].mastery}%` : '0%'}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-sm text-gray-500">Latest Avg. Score</div>
            <div className="text-xl font-bold">
              {formattedData.length > 0 ? `${formattedData[formattedData.length - 1].avg_score}%` : '0%'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}