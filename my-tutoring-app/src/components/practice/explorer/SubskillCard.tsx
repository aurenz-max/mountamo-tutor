import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock } from 'lucide-react';

interface SubskillCardProps {
  subskill: {
    id: string;
    description: string;
  };
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // in minutes
  onStartPractice: (subskillId: string) => void;
}

const SubskillCard: React.FC<SubskillCardProps> = ({ subskill, difficulty, estimatedTime, onStartPractice }) => {
  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800',
  };

  return (
    <div className="flex flex-col justify-between p-6 border rounded-lg bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
      <div>
        <h3 className="text-lg font-semibold mb-2">{subskill.description}</h3>
        <hr className="my-4" />
      </div>
      <div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-4">
          <Clock size={16} className="mr-2" />
          <span>~{estimatedTime} min</span>
          <span className="mx-2">•</span>
          <Badge className={`${difficultyColors[difficulty]} capitalize`}>{difficulty}</Badge>
        </div>
        <Button onClick={() => onStartPractice(subskill.id)} className="w-full">
          Start Practice →
        </Button>
      </div>
    </div>
  );
};

export default SubskillCard;