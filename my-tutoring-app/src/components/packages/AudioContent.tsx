import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Headphones, Play, Pause } from 'lucide-react';

interface AudioContentProps {
  content: {
    duration_seconds: number;
    audio_blob_url: string;
  };
  isCompleted: boolean;
  onComplete: () => void;
  onAskAI: (message: string) => void;
}

export function AudioContent({ content, isCompleted, onComplete, onAskAI }: AudioContentProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = content.duration_seconds > 0 
    ? (currentTime / content.duration_seconds) * 100 
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Headphones className="w-6 h-6 text-green-600" />
            <div>
              <CardTitle className="text-2xl">Audio Content</CardTitle>
              <p className="text-muted-foreground">
                {Math.ceil(content.duration_seconds / 60)} minute dialogue
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Custom Audio Player */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <Button 
                onClick={togglePlayback}
                className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-full shadow-lg"
                size="lg"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>
              
              <div className="flex-1">
                <div className="bg-gray-300 rounded-full h-3 mb-2">
                  <div 
                    className="bg-green-600 h-3 rounded-full transition-all duration-200"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(content.duration_seconds)}</span>
                </div>
              </div>
            </div>
            
            {/* Hidden HTML5 Audio Element */}
            <audio
              ref={audioRef}
              src={content.audio_blob_url}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="w-full"
              controls
            />
          </div>

          {/* Audio Description */}
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">About This Audio:</h4>
            <p className="text-green-800 text-sm">
              Interactive conversation exploring the key concepts through dialogue and discussion.
              Listen along to hear explanations, examples, and insights about the topic.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onAskAI("What are the main points from the audio dialogue?")}
              className="flex-1"
            >
              Summarize audio content
            </Button>
            <Button
              variant="outline"
              onClick={() => onAskAI("Can you explain any concepts I might have missed in the audio?")}
              className="flex-1"
            >
              Clarify concepts
            </Button>
          </div>
          
          <div className="pt-6 border-t">
            <Button 
              onClick={onComplete}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isCompleted}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completed
                </>
              ) : (
                <>
                  <span>Mark as Complete</span>
                  <span className="ml-2 text-yellow-200 font-semibold">+20 XP</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}