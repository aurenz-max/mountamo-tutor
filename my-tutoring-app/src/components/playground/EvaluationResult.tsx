// components/playground/EvaluationResults.tsx
import React from 'react';
import { 
  Trophy, 
  AlertCircle, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp,
  Award
} from 'lucide-react';
import { StudentEvaluationResponse } from '@/lib/playground-api';

interface EvaluationResultsProps {
  evaluation: StudentEvaluationResponse;
  onClose: () => void;
}

const EvaluationResults: React.FC<EvaluationResultsProps> = ({ 
  evaluation, 
  onClose 
}) => {
  const [expanded, setExpanded] = React.useState(false);
  
  // Helper to get color based on grade
  const getGradeColor = (grade: string) => {
    const gradeChar = grade.charAt(0);
    switch (gradeChar) {
      case 'A': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'B': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'C': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400';
      case 'D': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
      case 'F': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  // Helper for score colors
  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-green-600';
    if (score >= 7) return 'text-blue-600';
    if (score >= 5) return 'text-amber-600';
    if (score >= 3) return 'text-orange-600';
    return 'text-red-600';
  };

  // Extract scores and criteria from the evaluation
  const criteriaLabels = [
    'Concept Mastery',
    'Effective AI Collaboration',
    'Technical Implementation',
    'Creativity and Engagement',
    'Scientific/Mathematical Rigor'
  ];
  
  // Parse the evaluation text for recommendations
  const getRecommendations = (): string[] => {
    const text = evaluation.evaluation;
    // Look for the recommendations section at the end
    const recommendationsRegex = /recommendations?(?:\s+for\s+improvement)?:?\s*([\s\S]*?)(?:\n\n|$)/i;
    const match = text.match(recommendationsRegex);
    
    if (match && match[1]) {
      return match[1]
        .split(/\n/)
        .map(line => {
          // Clean up bullet points or numbers
          return line.replace(/^(?:\d+\.|-|\*|\s)+\s*/, '').trim();
        })
        .filter(line => line.length > 0);
    }
    
    return ['Improve understanding of the core concepts', 'Practice more with code examples', 'Review relevant learning materials'];
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Header with grade and timestamp */}
      <div className="p-6 border-b dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <div className={`p-3 rounded-full mr-4 ${getGradeColor(evaluation.overallGrade)}`}>
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">{evaluation.exerciseData.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Submitted on {new Date(evaluation.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className={`text-3xl font-bold ${getGradeColor(evaluation.overallGrade)}`}>
              {evaluation.overallGrade}
            </div>
            {evaluation.numericScore !== undefined && (
              <div className="text-sm mt-1 text-gray-500 dark:text-gray-400">
                Score: {evaluation.numericScore.toFixed(1)}/10
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Criteria scores */}
      <div className="p-6 border-b dark:border-gray-700">
        <h4 className="text-lg font-medium mb-4">Evaluation Criteria</h4>
        <div className="space-y-4">
          {criteriaLabels.map((label, index) => {
            const score = evaluation.criterionScores[index] || 0;
            return (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${getScoreColor(score)} bg-opacity-10`}>
                      <span className="font-semibold">{score}</span>
                    </div>
                    <span className="font-medium">{label}</span>
                  </div>
                </div>
                <div className="w-32">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getScoreColor(score)} bg-current bg-opacity-60`}
                      style={{ width: `${score * 10}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="p-6 border-b dark:border-gray-700">
        <h4 className="text-lg font-medium mb-4">Recommendations</h4>
        <ul className="space-y-2">
          {getRecommendations().map((recommendation, index) => (
            <li key={index} className="flex items-start">
              <span className="mr-3 mt-1 text-amber-500">
                <Award className="h-4 w-4" />
              </span>
              <span>{recommendation}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Toggle full feedback */}
      <div className="px-6 py-4 border-b dark:border-gray-700">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="font-medium">Detailed Feedback</span>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>
        
        {expanded && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-md whitespace-pre-wrap text-sm">
            {evaluation.evaluation}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 flex justify-end space-x-2 bg-gray-50 dark:bg-gray-900">
        <button 
          onClick={onClose}
          className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default EvaluationResults;