'use client';

import React from 'react';
import GeminiWrapper from '@/components/tutoring/GeminiWrapper'; // Adjust path if needed

const GeminiLiveDemoPage = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gemini Live Demo Page</h1>
      <GeminiWrapper /> {/* Include the GeminiLiveDemoInterface component */}
    </div>
  );
};

export default GeminiLiveDemoPage;