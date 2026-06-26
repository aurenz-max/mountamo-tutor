'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ExhibitApp from '@/components/lumina/App';
import type { GradeLevel } from '@/components/lumina/components/GradeLevelSelector';

// Reads the optional ?topic= / ?grade= handoff from the landing page and
// hands it to the app so the lesson starts immediately.
function LuminaWithHandoff() {
  const params = useSearchParams();
  const topic = params.get('topic') ?? undefined;
  const grade = (params.get('grade') as GradeLevel | null) ?? undefined;
  return <ExhibitApp initialTopic={topic} initialGrade={grade} />;
}

export default function LuminaPage() {
  // useSearchParams() requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<ExhibitApp />}>
      <LuminaWithHandoff />
    </Suspense>
  );
}
