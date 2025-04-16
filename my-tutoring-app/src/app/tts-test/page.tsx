// app/tts-test/page.tsx
"use client";

import React from 'react';
import TTSWebSocketTest from '@/components/TTSWebSocketTest';

export default function TTSTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">Gemini Text-to-Speech Test</h1>
      <TTSWebSocketTest />
      
      <div className="mt-8 bg-gray-50 p-4 rounded-md">
        <h2 className="text-lg font-semibold mb-2">How to use:</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Click "Connect WebSocket" to establish a connection to the Gemini TTS service</li>
          <li>Enter the text you want to convert to speech in the text area</li>
          <li>Click "Synthesize" to send the text to the Gemini API</li>
          <li>Audio will stream and play automatically as it's received</li>
          <li>Use the Stop button to cancel playback</li>
          <li>Toggle mute using the volume icon</li>
        </ol>
      </div>
    </div>
  );
}