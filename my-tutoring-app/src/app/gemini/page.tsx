'use client';

// pages/gemini-live.tsx
import { useState, useEffect } from 'react';
import Head from 'next/head';
import GeminiLiveConnect from '@/components/GeminiLiveConnect';

const GeminiLivePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Use the default local endpoint as specified
  useEffect(() => {
    // Simple check to see if we're in a browser environment
    // since WebSocket is a browser API
    if (typeof window !== 'undefined') {
      setIsLoading(false);
    }
  }, []);

  // Error handling
  const handleError = (error: any) => {
    console.error('GeminiLiveConnect error:', error);
    // In a real app, you might want to display errors to the user
    // or report them to an error monitoring service
  };

  return (
    <div className="flex flex-col h-screen">
      <Head>
        <title>Gemini LiveConnect</title>
        <meta name="description" content="Gemini LiveConnect interface for voice and screen interactions" />
      </Head>

      <header className="bg-gray-800 text-white p-4">
        <h1 className="text-xl font-bold">Gemini LiveConnect</h1>
      </header>

      <main className="flex-1 overflow-hidden">
        {!isLoading ? (
          <GeminiLiveConnect 
            apiUrl="ws://localhost:8000/api/gemini/bidirectional"
            onConnect={() => console.log('Connected to Gemini LiveConnect')}
            onDisconnect={() => console.log('Disconnected from Gemini LiveConnect')}
            onError={handleError}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-500">Loading Gemini LiveConnect...</p>
          </div>
        )}
      </main>

      <footer className="bg-gray-100 p-2 text-center text-sm text-gray-600">
        Powered by Gemini LiveConnect API • Connected to localhost
      </footer>
    </div>
  );
};

export default GeminiLivePage;