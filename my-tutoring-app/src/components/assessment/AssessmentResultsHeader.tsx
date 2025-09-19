'use client';

import React from 'react';
import { Trophy } from 'lucide-react';

interface AssessmentResultsHeaderProps {
  performanceQuote?: string;
  subject: string;
}

const AssessmentResultsHeader: React.FC<AssessmentResultsHeaderProps> = ({
  performanceQuote,
  subject
}) => {
  const defaultQuote = `Here are your results for the ${subject} assessment`;

  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
        <Trophy className="h-8 w-8 text-blue-600" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Assessment Complete!</h1>
      <p className="text-gray-600 text-lg">
        {performanceQuote || defaultQuote}
      </p>
    </div>
  );
};

export default AssessmentResultsHeader;