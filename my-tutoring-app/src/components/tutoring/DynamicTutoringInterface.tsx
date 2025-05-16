import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mic, MicOff, Volume2, VolumeX, PanelRightOpen, PanelRightClose, Loader2 } from 'lucide-react';
import DrawingWorkspace from './DrawingWorkspace';
import { cn } from '@/lib/utils';

const DynamicTutoringInterface = ({ 
  currentTopic,
  studentId 
}) => {
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [status, setStatus] = useState('disconnected');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleProblem = () => {
    setIsProblemOpen(!isProblemOpen);
  };

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between bg-gray-100 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <Button
            variant={status === 'recording' ? 'destructive' : 'default'}
            size="lg"
            className="rounded-full"
          >
            {status === 'recording' ? (
              <MicOff className="w-6 h-6 animate-pulse" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </Button>
          <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full">
            {isPlaying ? (
              <Volume2 className="w-4 h-4 text-green-500" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-sm">
              {isPlaying ? 'Tutor Speaking' : 'Waiting for Input'}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={toggleProblem}
        >
          {isProblemOpen ? (
            <>
              <PanelRightClose className="w-4 h-4" />
              Hide Problem
            </>
          ) : (
            <>
              <PanelRightOpen className="w-4 h-4" />
              Show Problem
            </>
          )}
        </Button>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-12 gap-6 transition-all duration-300">
        {/* Canvas Area */}
        <Card className={cn(
          "transition-all duration-300",
          isProblemOpen ? "col-span-7" : "col-span-12"
        )}>
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-xl">Your Workspace</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <DrawingWorkspace 
              ref={null}
              onSubmit={() => {}}
              loading={false}
            />
          </CardContent>
        </Card>

        {/* Problem Panel */}
        {isProblemOpen && (
          <Card className="col-span-5 transition-all duration-300">
            <CardHeader className="border-b bg-gray-50/50">
              <CardTitle className="text-xl">Current Problem</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!currentProblem ? (
                <div className="h-full flex items-center justify-center">
                  <Button 
                    size="lg"
                    className="w-full max-w-md"
                    onClick={() => {
                      setLoading(true);
                      setTimeout(() => {
                        setCurrentProblem({
                          problem: "Example problem text would appear here."
                        });
                        setLoading(false);
                      }, 1000);
                    }}
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Problem...
                      </div>
                    ) : (
                      'Generate Problem'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs text-gray-500">AI-generated</div>
                    <div className="text-lg leading-relaxed mt-2">
                      {currentProblem.problem}
                    </div>
                  </div>

                  <Button 
                    variant="outline"
                    onClick={() => setCurrentProblem(null)}
                    className="w-full"
                  >
                    Try Another Problem
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DynamicTutoringInterface;