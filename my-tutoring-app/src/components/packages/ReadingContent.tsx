import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, BookOpen } from 'lucide-react';

interface ReadingContentProps {
  content: {
    title: string;
    sections: Array<{
      heading: string;
      content: string;
    }>;
    word_count: number;
  };
  isCompleted: boolean;
  onComplete: () => void;
  onAskAI: (message: string) => void;
}

export function ReadingContent({ content, isCompleted, onComplete, onAskAI }: ReadingContentProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <div>
              <CardTitle className="text-2xl">{content.title}</CardTitle>
              <p className="text-muted-foreground">
                {content.word_count} words • {content.sections.length} sections
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {content.sections.map((section, index) => (
            <div key={index} className="border-b border-gray-100 pb-6 last:border-b-0">
              <h3 className="text-xl font-semibold mb-3 text-gray-900">{section.heading}</h3>
              <div className="prose prose-lg max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => onAskAI(`Tell me more about "${section.heading}"`)}
              >
                Ask AI about this section
              </Button>
            </div>
          ))}
          
          <div className="pt-6 border-t">
            <Button 
              onClick={onComplete}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isCompleted}
            >
              {isCompleted ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Completed
                </>
              ) : (
                'Mark as Complete'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}