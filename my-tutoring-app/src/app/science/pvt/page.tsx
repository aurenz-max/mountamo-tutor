'use client';

import React from 'react';
import GasSimulation from '@/components/science/pvt/GasSimulation';

export default function SciencePVTPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Gas Laws Simulation</h1>
      <GasSimulation />
    </div>
  );
}