// app/packages/[packageId]/learn/page.tsx
'use client';

import React from 'react';
import { EnhancedLearningSession } from '@/components/packages/EnhancedLearningSession';

interface LearnPageProps {
  params: { packageId: string };
  searchParams: { student_id?: string; activity_id?: string };
}

export default function LearnPage({ params, searchParams }: LearnPageProps) {
  const studentId = searchParams.student_id ? parseInt(searchParams.student_id) : undefined;
  const activityId = searchParams.activity_id || null;

  return (
    <EnhancedLearningSession
      packageId={params.packageId}
      studentId={studentId}
      activityId={activityId}
    />
  );
}