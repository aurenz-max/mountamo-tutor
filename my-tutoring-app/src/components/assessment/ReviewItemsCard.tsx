'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReviewItem {
  problem_id: string;
  question_text: string;
  your_answer_text: string;
  correct_answer_text: string;
  analysis: {
    understanding: string;
    approach: string;
  };
  feedback: {
    praise: string;
    guidance: string;
    encouragement: string;
  };
  related_skill_id: string;
  lesson_link: string;
}

interface ReviewItemsCardProps {
  reviewItems: ReviewItem[];
}

const ReviewItemsCard: React.FC<ReviewItemsCardProps> = ({ reviewItems }) => {
  const router = useRouter();

  if (!reviewItems || reviewItems.length === 0) {
    return null;
  }

  const truncateText = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const isCorrectAnswer = (yourAnswer: string, correctAnswer: string) => {
    return yourAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <BookOpen className="h-6 w-6 mr-2" />
          Let's Review Your Answers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {reviewItems.map((item, index) => {
            const isCorrect = isCorrectAnswer(item.your_answer_text, item.correct_answer_text);
            const isUnanswered = item.your_answer_text === "Not answered" ||
                                item.your_answer_text === "No answer recorded";

            return (
              <AccordionItem key={item.problem_id || index} value={`review-${index}`}>
                <AccordionTrigger className="text-left hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <span className="flex-1 text-sm text-gray-900">
                      {truncateText(item.question_text)}
                    </span>
                    <div className="flex items-center space-x-2 ml-4">
                      {isUnanswered ? (
                        <Badge variant="outline" className="bg-gray-100 text-gray-800">
                          Not Answered
                        </Badge>
                      ) : isCorrect ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Correct
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Incorrect
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 space-y-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h4 className="font-medium text-gray-900 mb-2">Question:</h4>
                    <p className="text-sm text-gray-700 mb-4">{item.question_text}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-red-600">Your Answer:</span>
                        <p className="text-sm text-red-700 mt-1 bg-red-50 p-2 rounded">
                          {item.your_answer_text}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-green-600">Correct Answer:</span>
                        <p className="text-sm text-green-700 mt-1 bg-green-50 p-2 rounded">
                          {item.correct_answer_text}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-blue-50 p-3 rounded-md">
                      <h5 className="text-sm font-medium text-blue-900 mb-1">What this means</h5>
                      <p className="text-sm text-blue-800">{item.analysis.understanding}</p>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-md border-l-4 border-purple-200">
                      <h5 className="text-sm font-medium text-purple-900 mb-1">Friendly Feedback</h5>
                      <div className="space-y-2">
                        <p className="text-sm text-purple-800">{item.feedback.guidance}</p>
                        <p className="text-sm text-purple-700 italic">{item.feedback.encouragement}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-1"
                      onClick={() => {
                        if (item.lesson_link.startsWith('http')) {
                          window.open(item.lesson_link, '_blank');
                        } else {
                          router.push(item.lesson_link);
                        }
                      }}
                    >
                      <BookOpen className="h-3 w-3" />
                      <span>Review Lesson</span>
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default ReviewItemsCard;