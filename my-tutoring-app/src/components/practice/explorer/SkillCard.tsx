import React from 'react';
import { Button } from "@/components/ui/button";
import { Star, Sparkles } from 'lucide-react';

interface SkillCardProps {
  skill: {
    id: string;
    description: string;
  };
  mastery: number; // A value from 0 to 1
  isRecommended: boolean;
  onClick: (skillId: string) => void;
}

const MasteryStars: React.FC<{ mastery: number }> = ({ mastery }) => {
  const totalStars = 5;
  const filledStars = Math.round(mastery * totalStars);
  const masteryLevels = ['Novice', 'Beginner', 'Competent', 'Proficient', 'Expert'];
  const masteryText = masteryLevels[filledStars - 1] || 'Novice';

  return (
    <div className="flex items-center">
      <div className="flex mr-2">
        {[...Array(totalStars)].map((_, i) => (
          <Star
            key={i}
            size={16}
            className={i < filledStars ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{masteryText}</span>
    </div>
  );
};

const SkillCard: React.FC<SkillCardProps> = ({ skill, mastery, isRecommended, onClick }) => {
  return (
    <div className="flex flex-col justify-between p-6 border rounded-lg bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center">
          {isRecommended && <Sparkles className="h-5 w-5 mr-2 text-purple-500" />}
          {skill.description}
        </h3>
        <hr className="my-4" />
      </div>
      <div>
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">Mastery Level</p>
          <MasteryStars mastery={mastery} />
        </div>
        <Button onClick={() => onClick(skill.id)} className="w-full">
          View Skills →
        </Button>
      </div>
    </div>
  );
};

export default SkillCard;