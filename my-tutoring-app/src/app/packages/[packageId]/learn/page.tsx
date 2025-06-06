// app/packages/[packageId]/learn/page.tsx
'use client';

import React from 'react';
import { EnhancedLearningSession } from '@/components/packages/EnhancedLearningSession';

interface LearnPageProps {
  params: { packageId: string };
  searchParams: { student_id?: string };
}

export default function LearnPage({ params, searchParams }: LearnPageProps) {
  const studentId = searchParams.student_id ? parseInt(searchParams.student_id) : undefined;

  return (
    <EnhancedLearningSession 
      packageId={params.packageId} 
      studentId={studentId}
    />
  );
}