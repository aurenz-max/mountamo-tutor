'use client';

// pages/word-learning.js or pages/index.js
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamically import the component to avoid SSR issues with browser APIs
const WordLearningExperience = dynamic(
  () => import('@/components/reading/ReadingApp'),
  { ssr: false }
);

export default function WordLearningPage() {
  return (
    <div>
      <Head>
        <title>Word Learning Adventure</title>
        <meta name="description" content="Learn words with images and speech" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <WordLearningExperience />
      </main>
    </div>
  );
}