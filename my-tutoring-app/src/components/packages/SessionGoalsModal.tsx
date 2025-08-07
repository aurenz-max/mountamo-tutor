import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, Clock, Target, Rocket } from 'lucide-react';

interface SessionGoalsModalProps {
  title: string;
  learningObjectives: string[];
  estimatedTime: number; // Time in minutes
  onStartSession: () => void;
}

export function SessionGoalsModal({ title, learningObjectives, estimatedTime, onStartSession }: SessionGoalsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in-0">
      <Card className="w-full max-w-2xl animate-in zoom-in-95">
        <CardHeader className="text-center p-8 bg-gray-50 rounded-t-lg">
          <Target className="w-12 h-12 mx-auto text-blue-600 mb-4" />
          <CardTitle className="text-2xl font-bold">Welcome to: {title}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">Let's get started!</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-muted-foreground" />
                Estimated Time
              </h3>
              <p className="text-3xl font-bold">{estimatedTime} <span className="text-xl font-medium text-muted-foreground">minutes</span></p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-muted-foreground" />
                Today, you will learn to:
              </h3>
              <ul className="space-y-2">
                {learningObjectives.map((objective, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-1 mr-2 flex-shrink-0" />
                    <span className="text-gray-700">{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="text-center">
            <Button 
              size="lg" 
              onClick={onStartSession} 
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              <Rocket className="w-5 h-5 mr-2" />
              Start Learning
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}