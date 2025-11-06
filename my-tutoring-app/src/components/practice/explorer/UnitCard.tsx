import React from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface UnitCardProps {
  unit: {
    id: string;
    title: string;
    description: string;
  };
  progress: {
    completed: number;
    total: number;
  };
  onClick: (unitId: string) => void;
}

const UnitCard: React.FC<UnitCardProps> = ({ unit, progress, onClick }) => {
  const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="flex flex-col justify-between p-6 border rounded-lg bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          <span className="mr-2 text-xl">🔢</span> {unit.title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{unit.description}</p>
      </div>
      <div>
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">Progress</p>
          <div className="flex items-center">
            <Progress value={progressPercentage} className="w-full mr-2" />
            <span className="text-sm font-medium">{Math.round(progressPercentage)}%</span>
          </div>
        </div>
        <Button onClick={() => onClick(unit.id)} className="w-full">
          Explore Unit →
        </Button>
      </div>
    </div>
  );
};

export default UnitCard;