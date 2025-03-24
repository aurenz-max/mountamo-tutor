'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ReadAlongPage from '@/components/read-along/ReadAlong';

export default function ReadAlongPageWrapper() {
  const searchParams = useSearchParams();
  
  // Get parameters from the URL
  const studentId = searchParams.get('studentId');
  const topicParam = searchParams.get('topic');
  
  // Parse the topic object if it exists
  let currentTopic = null;
  if (topicParam) {
    try {
      currentTopic = JSON.parse(decodeURIComponent(topicParam));
    } catch (error) {
      console.error('Error parsing topic:', error);
    }
  }
  
  return (
    <ReadAlongPage 
      studentId={studentId ? parseInt(studentId, 10) : null} 
      currentTopic={currentTopic}
    />
  );
}