'use client';

import React from 'react';
import OsmosisSimulationV2 from '@/components/science/osmosis/OsmosisSimulationV2';
import Head from 'next/head';

export default function OsmosisPage() {
  return (
    <div>
      <Head>
        <title>Osmosis Simulation</title>
        <meta name="description" content="Interactive Osmosis Simulation in React/Next.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem' }}>
        <h1>Biology Experiment: Osmosis (Molecular View)</h1>
        <OsmosisSimulationV2 />
      </main>

      <footer style={{ textAlign: 'center', marginTop: '2rem', color: '#888' }}>
        Experiment by AI
      </footer>
    </div>
  );
}