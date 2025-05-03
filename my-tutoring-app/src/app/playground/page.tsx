// app/playground/page.tsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import for the playground component
// This ensures it only loads on the client side
const P5jsPlayground = dynamic(
  () => import('@/components/playground/Playground'),
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
    <div className="flex flex-col min-h-screen">
      <header className="border-b bg-background py-3 px-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg className="w-9 h-9" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0V256H256V0H0Z" fill="#ED225D"/>
              <path d="M70.5 132.5C70.5 153.21 87.29 170 108 170C128.71 170 145.5 153.21 145.5 132.5C145.5 111.79 128.71 95 108 95C87.29 95 70.5 111.79 70.5 132.5Z" fill="white"/>
            </svg>
            <h1 className="text-xl font-medium">P5.js AI Playground</h1>
          </div>
          <div className="flex gap-4">
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
        </div>
        <p className="text-sm text-muted-foreground mt-1 ml-12">Create interactive sketches with AI assistance</p>
      </header>
      
      <main className="flex-1 p-6">
        <div className="h-[calc(100vh-160px)] min-h-[600px]">
          <P5jsPlayground />
        </div>
      </main>
      
      <footer className="py-4 px-6 text-center text-sm text-muted-foreground border-t">
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