import React from 'react';
import EnhancedLearningDashboard from '@/components/dashboard/EnhancedLearningDashboard';

export const metadata = {
  title: 'Learning Dashboard | MathMentor',
  description: 'Track your progress and get personalized recommendations',
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <EnhancedLearningDashboard />
    </main>
  );
}