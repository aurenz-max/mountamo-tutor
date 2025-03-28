import React from 'react';
import LearningDashboard from '@/components/dashboard/LearningDashboard';

export const metadata = {
  title: 'Learning Dashboard | MathMentor',
  description: 'Track your progress and get personalized recommendations',
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <LearningDashboard />
    </main>
  );
}