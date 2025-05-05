// app/playground/page.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import for the playground component
// This ensures it only loads on the client side
const UpdatedP5jsPlayground = dynamic(
  () => import('@/components/playground/P5jsPlayground'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-[500px]">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
        <p>Loading P5.js Playground...</p>
      </div>
    )
  }
);

export default function PlaygroundPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Links bar */}
      <div className="bg-white dark:bg-gray-900 border-b py-1 px-4 flex justify-end items-center gap-4">
        <Link 
          href="https://p5js.org/reference/" 
          target="_blank" 
          className="text-primary hover:underline text-sm"
        >
          P5.js Reference
        </Link>
        <Link 
          href="https://github.com/your-repo/p5js-playground" 
          target="_blank" 
          className="text-primary hover:underline text-sm"
        >
          GitHub
        </Link>
      </div>
      
      {/* Main content - takes full remaining height */}
      <div className="flex-1 overflow-hidden">
        <UpdatedP5jsPlayground />
      </div>
      
      {/* Footer */}
      <footer className="py-2 px-6 text-center text-sm text-muted-foreground border-t">
        <p>
          Made with ♥ using Next.js, p5.js, and Google Gemini AI • 
          <a href="https://p5js.org" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
            Learn more about p5.js
          </a>
        </p>
      </footer>
    </div>
  );
}