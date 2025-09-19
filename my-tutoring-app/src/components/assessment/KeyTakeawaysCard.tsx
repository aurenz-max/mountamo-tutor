'use client';

import React from 'react';
import { AlertCircle, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface KeyTakeawaysCardProps {
  commonMisconceptions: string[];
  skillAnalysis: Array<{
    skill_name: string;
    assessment_focus: string;
    performance_label: string;
  }>;
}

const KeyTakeawaysCard: React.FC<KeyTakeawaysCardProps> = ({
  commonMisconceptions,
  skillAnalysis
}) => {
  const hasMeaningfulMisconceptions = commonMisconceptions.length > 0 &&
    !commonMisconceptions.some(misconception =>
      misconception.toLowerCase().includes('no misconceptions') ||
      misconception.toLowerCase().includes('no specific misconceptions') ||
      misconception.toLowerCase().includes('no significant misconceptions')
    );

  const masteredWeakSpots = skillAnalysis.filter(skill =>
    skill.assessment_focus === 'Weak Spot' && skill.performance_label === 'Mastered'
  );

  const masteredNewFrontiers = skillAnalysis.filter(skill =>
    skill.assessment_focus === 'New Frontier' && skill.performance_label === 'Mastered'
  );

  if (hasMeaningfulMisconceptions) {
    return (
      <Card className="shadow-lg border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-700">
            <AlertCircle className="h-6 w-6 mr-2" />
            Focus for Next Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {commonMisconceptions.map((misconception, index) => (
              <li key={index} className="flex items-start">
                <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span className="text-gray-700">{misconception}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
      <CardHeader>
        <CardTitle className="flex items-center text-green-700">
          <Trophy className="h-6 w-6 mr-2" />
          Top Strengths
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {masteredWeakSpots.length > 0 && (
            <div className="flex items-center">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              <span className="text-gray-700">
                Turned a Weak Spot into a Strength in '{masteredWeakSpots[0].skill_name}'!
              </span>
            </div>
          )}
          {masteredNewFrontiers.length > 0 && masteredWeakSpots.length === 0 && (
            <div className="flex items-center">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              <span className="text-gray-700">
                Mastered a New Frontier in '{masteredNewFrontiers[0].skill_name}'!
              </span>
            </div>
          )}
          {masteredWeakSpots.length === 0 && masteredNewFrontiers.length === 0 && (
            <div className="flex items-center">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              <span className="text-gray-700">
                Excellent overall performance with no major misconceptions identified!
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default KeyTakeawaysCard;