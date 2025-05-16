// components/gemini-tutor/ui/FeedbackDisplay.tsx
import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Award, Brain, Lightbulb, TrendingUp } from 'lucide-react';

interface FeedbackDisplayProps {
  review: {
    observation?: {
      canvas_description?: string;
      selected_answer?: string;
      work_shown?: string;
    };
    analysis?: {
      understanding?: string;
      approach?: string;
      accuracy?: string;
      creativity?: string;
    };
    evaluation?: {
      score?: number;
      justification?: string;
    } | number;
    feedback?: {
      praise?: string;
      guidance?: string;
      encouragement?: string;
      next_steps?: string;
    } | string;
  };
  competency?: {
    previous_competency?: number;
    new_competency?: number;
    delta?: number;
    credibility?: number;
  };
  onClose?: () => void;
}

const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ review, competency, onClose }) => {
  // Extract score from evaluation
  const score = typeof review.evaluation === 'number' 
    ? review.evaluation 
    : review.evaluation?.score || 0;

  // Determine score color and icon
  const getScoreDisplay = (score: number) => {
    if (score >= 8) {
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: <CheckCircle className="w-6 h-6 text-green-600" />
      };
    } else if (score >= 6) {
      return {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: <AlertCircle className="w-6 h-6 text-yellow-600" />
      };
    } else {
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: <XCircle className="w-6 h-6 text-red-600" />
      };
    }
  };

  const scoreDisplay = getScoreDisplay(score);

  // Handle both structured and string feedback
  const getFeedbackContent = () => {
    if (typeof review.feedback === 'string') {
      return review.feedback;
    } else if (review.feedback) {
      return review.feedback.praise || review.feedback.guidance || review.feedback.encouragement;
    }
    return "No feedback available";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`p-4 border-b ${scoreDisplay.bgColor} ${scoreDisplay.borderColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {scoreDisplay.icon}
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Problem Review</h3>
                <p className={`text-2xl font-bold ${scoreDisplay.color}`}>
                  Score: {score}/10
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 p-2"
              >
                <XCircle className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Feedback Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-800">Feedback</h4>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-gray-700">{getFeedbackContent()}</p>
            </div>
          </div>

          {/* Analysis Section - only show if structured analysis exists */}
          {review.analysis && typeof review.analysis === 'object' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Analysis</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {review.analysis.understanding && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-1">Understanding</h5>
                    <p className="text-sm text-blue-700">{review.analysis.understanding}</p>
                  </div>
                )}
                {review.analysis.approach && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-1">Approach</h5>
                    <p className="text-sm text-blue-700">{review.analysis.approach}</p>
                  </div>
                )}
                {review.analysis.accuracy && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-1">Accuracy</h5>
                    <p className="text-sm text-blue-700">{review.analysis.accuracy}</p>
                  </div>
                )}
                {review.analysis.creativity && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-1">Creativity</h5>
                    <p className="text-sm text-blue-700">{review.analysis.creativity}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next Steps - only show if structured feedback with next_steps exists */}
          {review.feedback && typeof review.feedback === 'object' && review.feedback.next_steps && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-orange-600" />
                <h4 className="font-semibold text-gray-800">Next Steps</h4>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-gray-700">{review.feedback.next_steps}</p>
              </div>
            </div>
          )}

          {/* Competency Update */}
          {competency && competency.new_competency !== undefined && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-gray-800">Progress Update</h4>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Competency Level</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {competency.previous_competency?.toFixed(1)} → {competency.new_competency.toFixed(1)}
                    </p>
                  </div>
                  {competency.delta !== undefined && (
                    <div className={`text-2xl font-bold ${
                      competency.delta > 0 ? 'text-green-600' : competency.delta < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {competency.delta > 0 ? '+' : ''}{competency.delta.toFixed(2)}
                    </div>
                  )}
                </div>
                {competency.credibility !== undefined && (
                  <p className="text-sm text-gray-600 mt-2">
                    Credibility: {(competency.credibility * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Continue Practicing
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackDisplay;