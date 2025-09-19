'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Target, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface SkillAnalysisItem {
  skill_id: string;
  skill_name: string;
  total_questions: number;
  correct_count: number;
  assessment_focus: string;
  performance_label: string;
  insight_text: string;
  next_step: {
    text: string;
    link: string;
  };
}

interface SkillAnalysisCardProps {
  skillAnalysis: SkillAnalysisItem[];
}

const SkillAnalysisCard: React.FC<SkillAnalysisCardProps> = ({ skillAnalysis }) => {
  const router = useRouter();

  const getPerformanceBadgeColor = (label: string) => {
    switch (label) {
      case 'Mastered':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'Proficient':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'Developing':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
      case 'Needs Review':
        return 'bg-red-100 text-red-800 hover:bg-red-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  const getAssessmentFocusBadgeColor = (focus: string) => {
    switch (focus) {
      case 'Weak Spot':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      case 'New Frontier':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      case 'Foundational Review':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'Recent Practice':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  if (!skillAnalysis || skillAnalysis.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Target className="h-6 w-6 mr-2" />
          Skill Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {skillAnalysis.map((skill, index) => (
            <AccordionItem key={skill.skill_id || index} value={`skill-${index}`}>
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="flex items-center justify-between w-full mr-4">
                  <span className="font-medium text-gray-900">{skill.skill_name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {skill.correct_count}/{skill.total_questions}
                    </span>
                    <Badge
                      variant="outline"
                      className={getPerformanceBadgeColor(skill.performance_label)}
                    >
                      {skill.performance_label}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Assessment Focus:</span>
                  <Badge
                    variant="outline"
                    className={getAssessmentFocusBadgeColor(skill.assessment_focus)}
                  >
                    {skill.assessment_focus}
                  </Badge>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-700">{skill.insight_text}</p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium text-gray-700">Next Step:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-1"
                    onClick={() => {
                      if (skill.next_step.link.startsWith('http')) {
                        window.open(skill.next_step.link, '_blank');
                      } else {
                        router.push(skill.next_step.link);
                      }
                    }}
                  >
                    <span>{skill.next_step.text}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default SkillAnalysisCard;