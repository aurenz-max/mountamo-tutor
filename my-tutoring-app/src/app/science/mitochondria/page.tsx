'use client';

import React from 'react';
import dynamic from 'next/dynamic'; // Import the dynamic function from Next.js
import Head from 'next/head'; // Import Head for setting page title and meta tags

// Dynamically import the MitochondriaSimulation component
// 'ssr: false' ensures this component is only rendered on the client-side
const MitochondriaSimulationComponent = dynamic(
  () => import('@/components/science/mitochondria/mitochondria-simulation'), // Adjust the path if your component is located elsewhere
  { ssr: false } // Disable Server-Side Rendering for this component
);

// Define the main page component
const MitochondriaPage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      {/* Head component to set the page title */}
      <Head>
        <title>Mitochondria Simulation | Next.js</title>
        <meta name="description" content="Client-side rendered p5.js simulation of mitochondria cellular respiration in a Next.js app." />
        <link rel="icon" href="/favicon.ico" /> {/* Optional: Add a favicon */}
      </Head>

      {/* Main content area */}
      <main className="w-full max-w-4xl">
        {/* Render the dynamically imported component */}
        {/* This component will only render after the page loads in the browser */}
        <MitochondriaSimulationComponent />
      </main>

      {/* Optional Footer */}
      <footer className="mt-8 text-center text-gray-500 text-sm">
        Powered by Next.js and p5.js
      </footer>
    </div>
  );
};

// Export the page component as the default export
export default MitochondriaPage;