'use client';
// app/catapult/CatapultWrapper.jsx
import dynamic from 'next/dynamic';

// Load the catapult simulator component dynamically client-side only
const CatapultSimulator = dynamic(() => import('@/components/science/catapult/CatapultSimulator'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading Catapult Simulator...</p>
      </div>
    </div>
  ),
});

export default function CatapultWrapper() {
  return <CatapultSimulator />;
}