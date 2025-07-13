// app/daily-learning/[subskillId]/page.tsx

"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import SubskillLearningHub from '@/components/dashboard/SubskillLearningHub';

interface SubskillPageProps {
  params: {
    subskillId: string;
  };
}

export default function SubskillPage({ params }: SubskillPageProps) {
  const { userProfile } = useAuth();
  const router = useRouter();
  const { subskillId } = params;
  const [activityData, setActivityData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch activity data from your API (optional - fallback to placeholder if it fails)
  useEffect(() => {
    const fetchActivityData = async () => {
      if (!userProfile?.student_id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Try to fetch the daily plan to get activity details
        const response = await fetch(`/api/daily-plan/${userProfile.student_id}`);
        if (!response.ok) {
          console.log('API call failed, using placeholder data');
          setActivityData(null); // Will use fallback data in component
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        // Find the specific activity by ID
        const activity = data.activities?.find((act: any) => act.id === subskillId);
        
        if (activity) {
          console.log('Found activity data from API:', activity);
          setActivityData(activity);
        } else {
          console.log('Activity not found in API response, using placeholder data');
          setActivityData(null); // Will use fallback data in component
        }
      } catch (err) {
        console.log('Error fetching activity data, using placeholder data:', err);
        setActivityData(null); // Will use fallback data in component
      } finally {
        setLoading(false);
      }
    };

    fetchActivityData();
  }, [subskillId, userProfile?.student_id]);

  // Handle back navigation
  const handleBackToDashboard = () => {
    router.push('/dashboard'); // Adjust to your dashboard route
  };

  // Handle learning option selection with updated routing
  const handleLearningOptionSelect = (option: any) => {
    console.log('Learning option selected:', option);
    
    // If the option has a route, use it directly
    if (option.route) {
      router.push(option.route);
      return;
    }
    
    // Fallback to the original routing logic based on option ID
    switch (option.id) {
      case 'live-tutoring':
        router.push(`/tutoring/live/${subskillId}`);
        break;
      case 'practice-problems':
        router.push(`/practice/${subskillId}`); // Updated to match your filepath
        break;
      case 'educational-content':
        router.push(`/content/packages/${subskillId}`);
        break;
      case 'projects':
        router.push(`/projects/activities/${subskillId}`);
        break;
      default:
        console.log('Unknown learning option:', option);
    }
  };

  if (!userProfile) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading user profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading activity data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Always render the SubskillLearningHub - it will handle fallback data internally
  return (
    <SubskillLearningHub
      subskillId={subskillId}
      activityData={activityData} // null if API failed, actual data if successful
      studentId={userProfile.student_id}
      onBack={handleBackToDashboard}
      onLearningOptionSelect={handleLearningOptionSelect}
    />
  );
}