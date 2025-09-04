'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, HelpCircle, RotateCcw, BookOpen, Award, FolderOpen, Package } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';

interface CategorizationItem {
  item_text: string;
  correct_category: string;
}

interface CategorizationQuestion {
  id: string;
  subject?: string;
  skill_id?: string;
  subskill_id?: string;
  difficulty: string;
  instruction: string;
  categories: string[];
  categorization_items: CategorizationItem[];
  rationale: string;
  teaching_note: string;
  success_criteria: string[];
  metadata?: {
    [key: string]: any;
  };
}

interface CategorizationSubmission {
  categorization: CategorizationQuestion;
  student_categorization: {
    [item_text: string]: string;
  };
}

interface CategorizationReview {
  is_correct: boolean;
  student_categorization: {
    [item_text: string]: string;
  };
  correct_categorization: {
    [item_text: string]: string;
  };
  explanation: string;
  item_feedback: Array<{
    item_text: string;
    student_category: string;
    correct_category: string;
    is_correct: boolean;
    feedback: string;
  }>;
  total_score: number;
  percentage_correct: number;
  metadata: {
    [key: string]: any;
  };
}

interface CategorizationComponentProps {
  categorization: CategorizationQuestion;
  onNext?: () => void;
  onComplete?: (review: CategorizationReview) => void;
  onNewQuestion?: () => void;
}

const CategorizationComponent: React.FC<CategorizationComponentProps> = ({
  categorization,
  onNext,
  onComplete,
  onNewQuestion
}) => {
  const [studentCategorization, setStudentCategorization] = useState<{[item_text: string]: string}>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<CategorizationReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, item: string) => {
    if (submitted) return;
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    if (!draggedItem || submitted) return;

    setStudentCategorization(prev => ({
      ...prev,
      [draggedItem]: category
    }));
    setDraggedItem(null);
  };

  const handleItemClick = (item: string, category: string) => {
    if (submitted) return;
    
    setStudentCategorization(prev => ({
      ...prev,
      [item]: category
    }));
  };

  const removeItemFromCategory = (item: string) => {
    if (submitted) return;
    
    setStudentCategorization(prev => {
      const newCategorization = { ...prev };
      delete newCategorization[item];
      return newCategorization;
    });
  };

  const handleSubmit = async () => {
    // Check if all items are categorized
    const uncategorizedItems = categorization.categorization_items.filter(
      item => !studentCategorization[item.item_text]
    );
    
    if (uncategorizedItems.length > 0) {
      setError(`Please categorize all items. Missing: ${uncategorizedItems.map(i => i.item_text).join(', ')}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submission: CategorizationSubmission = {
        categorization: categorization,
        student_categorization: studentCategorization
      };

      const reviewResult: CategorizationReview = await authApi.submitCategorization(submission);

      setReview(reviewResult);
      setSubmitted(true);

      if (onComplete) {
        onComplete(reviewResult);
      }
    } catch (err: any) {
      console.error('Error submitting Categorization:', err);
      setError(err.message || 'Failed to submit answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewQuestion = () => {
    setStudentCategorization({});
    setSubmitted(false);
    setReview(null);
    setError(null);
    setDraggedItem(null);

    if (onNewQuestion) {
      onNewQuestion();
    }
  };

  const renderQuestion = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {categorization.instruction}
            </h3>
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
            categorization.difficulty === 'easy'
              ? 'bg-green-100 text-green-800'
              : categorization.difficulty === 'hard'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
          }`}>
            {categorization.difficulty}
          </span>
          {categorization.skill_id && (
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              {categorization.skill_id}
            </span>
          )}
        </div>
      </div>

      {/* Items Pool */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-800 mb-3">Items to Categorize:</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categorization.categorization_items
            .filter(item => !studentCategorization[item.item_text])
            .map((item) => (
              <div
                key={item.item_text}
                draggable={!submitted}
                onDragStart={(e) => handleDragStart(e, item.item_text)}
                className={`p-3 rounded-lg border-2 border-dashed cursor-move transition-all ${
                  draggedItem === item.item_text
                    ? 'border-blue-400 bg-blue-50 shadow-md'
                    : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center">
                  <Package className="w-4 h-4 text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-900">{item.item_text}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorization.categories.map((category) => {
          const itemsInCategory = categorization.categorization_items.filter(
            item => studentCategorization[item.item_text] === category
          );
          
          return (
            <div
              key={category}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, category)}
              className="min-h-[150px] p-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center mb-3">
                <FolderOpen className="w-5 h-5 text-blue-600 mr-2" />
                <h4 className="font-medium text-gray-800">{category}</h4>
              </div>
              
              <div className="space-y-2">
                {itemsInCategory.map((item) => {
                  const feedback = review?.item_feedback?.find(f => f.item_text === item.item_text);
                  const isCorrect = feedback?.is_correct;
                  const isIncorrect = feedback && !feedback.is_correct;
                  
                  return (
                    <div
                      key={`${item.item_text}-${category}`}
                      className={`p-2 rounded border transition-all ${
                        submitted
                          ? isCorrect
                            ? 'border-green-300 bg-green-50 text-green-800'
                            : isIncorrect
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : 'border-gray-300 bg-white'
                          : 'border-blue-300 bg-blue-50 text-blue-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.item_text}</span>
                        <div className="flex items-center">
                          {submitted && (
                            <span className="mr-2">
                              {isCorrect && <CheckCircle className="w-4 h-4 text-green-600" />}
                              {isIncorrect && <XCircle className="w-4 h-4 text-red-600" />}
                            </span>
                          )}
                          {!submitted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItemFromCategory(item.item_text)}
                              className="h-6 w-6 p-0 hover:bg-red-100"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </div>
                      {submitted && isIncorrect && feedback && (
                        <p className="text-xs text-red-600 mt-1">
                          Should be in: {feedback.correct_category}
                        </p>
                      )}
                    </div>
                  );
                })}
                
                {itemsInCategory.length === 0 && (
                  <p className="text-sm text-gray-500 italic text-center py-4">
                    Drop items here or click to add
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button
          onClick={handleNewQuestion}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Question
        </Button>

        {!submitted ? (
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6"
          >
            {loading ? 'Submitting...' : 'Submit Categorization'}
          </Button>
        ) : (
          <>
            {onNext && (
              <Button
                onClick={onNext}
                className="px-6"
              >
                Next Question
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderFeedback = () => {
    if (!review) return null;

    return (
      <div className="mt-6 space-y-4">
        <Alert className={review.is_correct ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'}>
          <div className="flex items-center">
            {review.is_correct ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <Package className="w-5 h-5 text-yellow-600 mr-2" />
            )}
            <AlertDescription className={review.is_correct ? 'text-green-800' : 'text-yellow-800'}>
              <strong>
                {review.is_correct ? 'Perfect Categorization!' : `${review.percentage_correct}% Correct`}
              </strong>
              {review.total_score && (
                <span className="ml-2">Score: {review.total_score}/10</span>
              )}
            </AlertDescription>
          </div>
        </Alert>

        {!review.is_correct && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-800">Item-by-Item Feedback:</h4>
            {review.item_feedback.map((feedback, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                feedback.is_correct 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start">
                  {feedback.is_correct ? (
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-semibold ${feedback.is_correct ? 'text-green-800' : 'text-red-800'}`}>
                      "{feedback.item_text}"
                    </p>
                    <p className={`text-sm ${feedback.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                      Your answer: {feedback.student_category}
                    </p>
                    {!feedback.is_correct && (
                      <p className="text-sm text-gray-600">
                        Correct category: {feedback.correct_category}
                      </p>
                    )}
                    {feedback.feedback && (
                      <p className="text-sm text-gray-600 mt-1">{feedback.feedback}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start">
            <Award className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-800 mb-1">Explanation:</p>
              <p className="text-gray-700">{review.explanation}</p>
            </div>
          </div>
        </div>

        {categorization.teaching_note && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <BookOpen className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-1">Teaching Note:</p>
                <p className="text-blue-700">{categorization.teaching_note}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="w-6 h-6" />
          Categorization Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderQuestion()}
        {review && renderFeedback()}
      </CardContent>
    </Card>
  );
};

export default CategorizationComponent;