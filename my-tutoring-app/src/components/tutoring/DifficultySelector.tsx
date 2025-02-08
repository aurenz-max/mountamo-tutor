import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Brain, Gauge, Info } from "lucide-react";
import { api } from '@/lib/api';

interface DifficultySelectorProps {
    recommendedDifficulty: number;
    onDifficultyChange: (difficulty: number) => void;
    currentTopic: any; // Update this with proper type
    studentId: number;
  }

  const DifficultySelector = ({ 
    recommendedDifficulty = 5.0,
    onDifficultyChange,
    currentTopic,
    studentId
  }: DifficultySelectorProps) => {
  const [useRecommended, setUseRecommended] = useState(true);
  const [manualDifficulty, setManualDifficulty] = useState(recommendedDifficulty);

  // Update your handlers to use this new function
  const handleToggle = (checked: boolean) => {
    setUseRecommended(checked);
    if (checked) {
      handleDifficultyChange(recommendedDifficulty);
    } else {
      handleDifficultyChange(manualDifficulty);
    }
  };

  const handleDifficultyChange = async (newDifficulty: number) => {
    try {
      console.log('Updating difficulty:', {
        student_id: studentId,
        subject: currentTopic.subject,
        unit_id: currentTopic.selection?.unit,
        skill_id: currentTopic.selection?.skill,
        subskill_id: currentTopic.selection?.subskill,
        difficulty: newDifficulty
      });

      await api.updateDifficulty({
        student_id: studentId,
        subject: currentTopic.subject,
        unit_id: currentTopic.selection?.unit,
        skill_id: currentTopic.selection?.skill,
        subskill_id: currentTopic.selection?.subskill,
        difficulty: newDifficulty
      });
      
      onDifficultyChange(newDifficulty);
    } catch (error) {
      console.error('Failed to update difficulty:', error);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0];
    setManualDifficulty(newValue);
    if (!useRecommended) {
      handleDifficultyChange(newValue);
    }
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-gray-500" />
            <span className="font-medium">Difficulty Level</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-gray-600">AI Recommended</span>
            <Switch
              checked={useRecommended}
              onCheckedChange={handleToggle}
            />
          </div>
        </div>

        {!useRecommended && (
          <div className="space-y-4 animate-in fade-in">
            <Slider
              min={1}
              max={10}
              step={0.5}
              value={[manualDifficulty]}
              onValueChange={handleSliderChange}
              className="w-full"
            />
            
            <div className="flex justify-between text-sm text-gray-500">
              <span>Easier</span>
              <span className="font-medium">{manualDifficulty.toFixed(1)}</span>
              <span>Harder</span>
            </div>

            {Math.abs(manualDifficulty - recommendedDifficulty) > 2 && (
              <div className="text-sm text-orange-500 flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span>This is significantly different from the AI recommendation ({recommendedDifficulty.toFixed(1)})</span>
              </div>
            )}
          </div>
        )}

        {useRecommended && (
          <div className="text-sm text-gray-600">
            Using AI recommended difficulty: {recommendedDifficulty.toFixed(1)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DifficultySelector;