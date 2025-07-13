// app/onboarding/page.tsx
import React from 'react';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

export const metadata = {
  title: 'Setup Your Learning Journey | AI Tutor',
  description: 'Personalize your learning experience with AI Tutor',
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <OnboardingFlow />
    </main>
  );
}