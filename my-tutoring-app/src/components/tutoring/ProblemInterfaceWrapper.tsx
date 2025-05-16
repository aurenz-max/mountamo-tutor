// ProblemInterfaceWrapper.tsx
'use client'

import { WebSocketProvider } from '@/lib/use-websocket'
import ProblemInterface from './ProblemInterface'
import GeminiAudioPlayer from './GeminiAudioPlayer'

export default function ProblemInterfaceWrapper({ currentTopic, studentId }) {
  return (
    <WebSocketProvider>
      <div className="flex flex-col space-y-4">
        <ProblemInterface currentTopic={currentTopic} studentId={studentId} />
        <GeminiAudioPlayer />
      </div>
    </WebSocketProvider>
  )
}