'use client'

import { WebSocketProvider } from '@/lib/use-websocket'
import GeminiDemo from './GeminiLiveDemoInterface'
import GeminiAudioPlayer from './GeminiAudioPlayer'

export default function GeminiWrapper() {
  return (
    <WebSocketProvider>
      <div className="flex flex-col space-y-4">
        <GeminiDemo />
        <GeminiAudioPlayer />
      </div>
    </WebSocketProvider>
  )
}