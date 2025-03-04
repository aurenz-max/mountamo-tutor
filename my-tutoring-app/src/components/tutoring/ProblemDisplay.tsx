import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BookOpen, CheckCircle2, ThumbsUp, Lightbulb, ArrowRight } from 'lucide-react';

interface ProblemDisplayProps {
  problem: any;
  loading: boolean;
  error: string | null;
  feedback: any;
  submitting: boolean;
  isTheaterMode: boolean;
  onGenerateProblem: () => void;
  onSubmit: () => void;
}

// Helper function to extract and render feedback content
const getFeedbackContent = (feedback: any) => {
  if (!feedback || !feedback.review) return null;
  
  const reviewData = feedback.review;
  
  // Extract praise
  let praise = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.praise) {
    praise = reviewData.feedback.praise;
  } else if (typeof reviewData.feedback === 'string') {
    praise = reviewData.feedback;
  }
  
  // Extract guidance
  let guidance = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.guidance) {
    guidance = reviewData.feedback.guidance;
  }
  
  // Extract encouragement
  let encouragement = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.encouragement) {
    encouragement = reviewData.feedback.encouragement;
  }
  
  // Extract next steps
  let nextSteps = "";
  if (typeof reviewData.feedback === 'object' && reviewData.feedback.next_steps) {
    nextSteps = reviewData.feedback.next_steps;
  }
  
  // Extract score
  let score = 0;
  if (typeof reviewData.evaluation === 'object' && reviewData.evaluation.score) {
    score = reviewData.evaluation.score;
  } else if (typeof reviewData.evaluation === 'number') {
    score = reviewData.evaluation;
  } else if (typeof reviewData.evaluation === 'string') {
    score = parseFloat(reviewData.evaluation);
  }
  
  return { praise, guidance, encouragement, nextSteps, score };
};

const ProblemDisplay: React.FC<ProblemDisplayProps> = ({
  problem,
  loading,
  error,
  feedback,
  submitting,
  isTheaterMode,
  onGenerateProblem,
  onSubmit
}) => {
  const feedbackContent = getFeedbackContent(feedback);
  
  return (
    <Card className={`w-full h-full overflow-hidden flex flex-col ${isTheaterMode ? 'shadow-lg rounded-lg' : ''}`}>
      <CardHeader className="pb-2 space-y-0 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex items-center">
          <BookOpen className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-lg">Current Problem</CardTitle>
        </div>
        <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
          Complete the exercise below using the drawing tools
        </CardDescription>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full w-full">
          <div className="p-4 space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {!problem ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                    <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-medium">No active problem</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Generate a new problem to get started
                  </p>
                  <Button
                    onClick={onGenerateProblem}
                    disabled={loading}
                    variant="default"
                    className="mt-2"
                  >
                    Generate Problem
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div className="text-base font-medium text-slate-800 dark:text-slate-200">
                      {problem.problem}
                    </div>
                  </div>
                  
                  {feedbackContent && (
                    <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-sm font-medium flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                          Feedback
                        </h3>
                      </div>
                      <div className="p-4 space-y-3 text-sm">
                        {feedbackContent.praise && (
                          <div className="flex items-start">
                            <ThumbsUp className="w-4 h-4 mr-2 text-green-500 mt-0.5" />
                            <p className="text-green-700 dark:text-green-400">{feedbackContent.praise}</p>
                          </div>
                        )}
                        
                        {feedbackContent.guidance && (
                          <div className="flex items-start">
                            <Lightbulb className="w-4 h-4 mr-2 text-blue-500 mt-0.5" />
                            <p className="text-blue-700 dark:text-blue-400">{feedbackContent.guidance}</p>
                          </div>
                        )}
                        
                        {feedbackContent.encouragement && (
                          <div className="flex items-start">
                            <ArrowRight className="w-4 h-4 mr-2 text-purple-500 mt-0.5" />
                            <p className="text-purple-700 dark:text-purple-400">{feedbackContent.encouragement}</p>
                          </div>
                        )}
                        
                        {feedbackContent.nextSteps && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {feedbackContent.nextSteps}
                            </p>
                          </div>
                        )}
                        
                        {feedbackContent.score > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">Score:</span>
                              <span className="text-sm font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-0.5 rounded">
                                {feedbackContent.score}/10
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      
      {problem && (
        <CardFooter className="border-t dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
          <Button
            onClick={onSubmit}
            className="w-full"
            variant="default"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Answer'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default ProblemDisplay;