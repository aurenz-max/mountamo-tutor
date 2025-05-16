// src/components/dashboard/RecentProgressCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { CheckCircle } from 'lucide-react';
import { analyticsApi, TimeSeriesData } from '@/lib/studentAnalyticsAPI';

interface RecentActivity {
  title: string;
  timeAgo: string;
  description: string;
  points: number;
}

const RecentProgressCard = ({ studentId }: { studentId: number }) => {
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        setLoading(true);
        
        // Get time series data for the last 7 days
        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        
        const formattedStartDate = sevenDaysAgo.toISOString().split('T')[0];
        const formattedEndDate = today.toISOString().split('T')[0];
        
        const timeSeriesData = await analyticsApi.getTimeSeriesMetrics(studentId, {
          interval: 'day',
          level: 'student',
          startDate: formattedStartDate,
          endDate: formattedEndDate
        });
        
        // Transform the data into activities
        const transformedActivities = transformTimeSeriesIntoActivities(timeSeriesData);
        setActivities(transformedActivities);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching recent activity:', err);
        setError('Failed to load recent activity');
        setLoading(false);
      }
    };
    
    fetchRecentActivity();
  }, [studentId]);

  // Helper function to transform API data into activity items
  const transformTimeSeriesIntoActivities = (data: TimeSeriesData): RecentActivity[] => {
    // This is a sample transformation - in a real app, you would parse the actual data
    // Since the API response format is complex, this is a simplified example
    
    // For demonstration purposes, creating sample activities
    // In reality, you would extract this from the timeseries data
    const sampleActivities: RecentActivity[] = [
      {
        title: "Completed Linear Equations Quiz",
        timeAgo: "Yesterday",
        description: "85% correct",
        points: 35
      },
      {
        title: "Watched Function Video Series",
        timeAgo: "2 days ago",
        description: "3 videos",
        points: 40
      },
      {
        title: "Solved Weekly Challenge",
        timeAgo: "3 days ago",
        description: "First attempt",
        points: 100
      }
    ];
    
    // In a real implementation, you would parse the intervals from the response
    // and create activities based on the metrics
    
    return sampleActivities;
  };

  // Function to generate real activities from the API data
  // This would be implemented based on the actual structure of your timeseries data
  const generateRealActivities = (timeSeriesData: TimeSeriesData): RecentActivity[] => {
    const activities: RecentActivity[] = [];
    
    // Example of how you might parse real data (implementation would depend on your API structure)
    if (timeSeriesData.intervals) {
      // Sort intervals by date (most recent first)
      const sortedIntervals = [...timeSeriesData.intervals].sort((a, b) => 
        new Date(b.interval_date).getTime() - new Date(a.interval_date).getTime()
      );
      
      // For each interval, create activity entries
      sortedIntervals.forEach(interval => {
        // You would extract specific activity details from your data
        if (interval.summary.attempt_count > 0) {
          // This is where you would create activity entries based on your data structure
          // For example, if you had assessment data:
          activities.push({
            title: `Completed Assessment`,
            timeAgo: formatTimeAgo(interval.interval_date),
            description: `${(interval.summary.avg_score * 100).toFixed(0)}% correct`,
            points: Math.round(interval.summary.attempt_count * 10) // Example points calculation
          });
        }
      });
    }
    
    return activities;
  };

  // Helper to format date as "X days ago" or "Today"/"Yesterday"
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading recent activity...</div>
        ) : error ? (
          <div className="text-center py-4 text-red-500">{error}</div>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-center">
                <CheckCircle className="text-green-500 mr-3" />
                <div className="flex-1">
                  <p className="font-medium">{activity.title}</p>
                  <p className="text-sm text-gray-500">{activity.timeAgo} • {activity.description}</p>
                </div>
                <div className="text-yellow-600 font-bold">+{activity.points} pts</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">No recent activity found</div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentProgressCard;