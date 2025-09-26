'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// CHANGED: Added more icons for a richer visual experience
import { CheckCircle, XCircle, Clock, Zap, ArrowRight, Target, TrendingUp, Repeat, Sparkles, BookOpen } from 'lucide-react';
import { AssessmentSkillAnalysisItem } from '@/types/assessment';

interface SkillBreakdownProps {
  skillAnalysis: AssessmentSkillAnalysisItem[];
}

// NEW: A dedicated component for subskills to make them more visual
const SubskillItem = ({ subskill }: { subskill: AssessmentSkillAnalysisItem['subskills'][0] }) => {
  const percentage = subskill.questions > 0 ? (subskill.correct / subskill.questions) * 100 : 0;
  return (
    <div className="text-sm bg-gray-50 p-3 rounded-lg border border-gray-200/80">
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-800 font-medium pr-2">{subskill.subskill_description}</span>
        <span className="text-gray-500 font-semibold whitespace-nowrap">
          {subskill.correct}/{subskill.questions}
        </span>
      </div>
      {/* NEW: Added a progress bar for instant visual feedback */}
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div
          className="bg-blue-500 h-1.5 rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};


const SkillBreakdown: React.FC<SkillBreakdownProps> = ({ skillAnalysis }) => {
  if (!skillAnalysis || skillAnalysis.length === 0) {
    // No changes needed for the fallback state, it's already good.
    return (
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Skills Assessment
        </h3>
        <p className="text-gray-600">
          Here&apos;s how you performed on each skill area, prioritized by areas that need the most attention.
        </p>
        <Card className="p-6">
          <p className="text-gray-500 text-center">
            No skill analysis data available yet. This may be because the assessment is still being processed.
          </p>
        </Card>
      </div>
    );
  }

  // No changes to color/icon logic, it's solid.
  const getPerformanceColor = (label?: string) => {
    switch (label) {
      case 'Mastered': return 'bg-green-100 text-green-800 border-green-200';
      case 'Proficient': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Developing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Needs Review': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPerformanceIcon = (label?: string) => {
    switch (label) {
      case 'Mastered': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Proficient': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'Developing': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'Needs Review': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };
  
  // CHANGED: Swapped emojis for consistent Lucide icons. More professional and scalable.
  const getFocusTagIcon = (tag?: string) => {
    if (!tag) return <BookOpen className="h-5 w-5 text-gray-500" />;
    if (tag.includes('Weak Spot') || tag.includes('🎯')) return <Target className="h-5 w-5 text-red-500" />;
    if (tag.includes('Growth Area') || tag.includes('📈')) return <TrendingUp className="h-5 w-5 text-yellow-500" />;
    if (tag.includes('Review') || tag.includes('🔄')) return <Repeat className="h-5 w-5 text-blue-500" />;
    if (tag.includes('Strong') || tag.includes('✨')) return <Sparkles className="h-5 w-5 text-green-500" />;
    return <BookOpen className="h-5 w-5 text-gray-500" />;
  };

  return (
    <div className="mb-6">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Skills Assessment
        </h3>
        <p className="text-gray-600">
          Here's how you performed on each skill area, prioritized by areas that need the most attention.
        </p>
      </div>

      <div className="space-y-6"> {/* Increased spacing between cards */}
        {skillAnalysis.map((skill) => (
          // CHANGED: Removed padding from Card and added it to an inner div for better layout control.
          <Card key={skill.skill_id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
            <div className="p-6"> {/* Main content padding */}
              <div className="flex flex-col gap-5"> {/* Increased gap for better breathing room */}
                
                {/* --- Skill Header --- */}
                <div className="flex items-start gap-4">
                  {/* CHANGED: Larger, more prominent icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getFocusTagIcon(skill.assessment_focus_tag)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* CHANGED: Improved typography for better hierarchy */}
                    <h4 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
                      {skill.skill_name}
                    </h4>
                    <p className="text-sm text-gray-500 break-words">
                      {skill.unit_title}
                    </p>
                  </div>
                </div>

                {/* --- Performance & Insight --- */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={`${getPerformanceColor(skill.performance_label)} font-semibold`}>
                        {getPerformanceIcon(skill.performance_label)}
                        <span className="ml-1.5">{skill.performance_label || 'No Label'}</span>
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600 font-medium">
                      <span>{skill.correct_count}/{skill.total_questions} correct</span>
                      <span className="text-gray-500 ml-2">({Math.round(skill.percentage)}%)</span>
                    </div>
                  </div>
                  
                  {skill.insight_text && (
                    <div className="text-gray-800 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-300">
                      <p className="text-sm leading-relaxed">{skill.insight_text}</p>
                    </div>
                  )}
                </div>

                {/* --- Subskills Breakdown --- */}
                {skill.subskills && skill.subskills.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      Breakdown by topics:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {skill.subskills.map((subskill) => (
                        <SubskillItem key={subskill.subskill_id} subskill={subskill} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* --- Recommended Action Footer --- */}
            {/* CHANGED: This section now has a distinct background, making it feel like a proper footer */}
            {skill.next_step && (
              <div className="bg-gray-50/70 border-t border-gray-200/80 px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">
                    Recommended Action
                  </p>
                  <Button
                    onClick={() => window.open(skill.next_step!.link, '_blank')}
                    // CHANGED: Simplified button classes, using a dynamic background color
                    className={`
                      px-4 py-2 flex items-center gap-2 text-sm w-full sm:w-auto justify-center
                      font-semibold text-white transition-colors
                      ${skill.performance_label === 'Needs Review' ? 'bg-red-600 hover:bg-red-700' :
                        skill.performance_label === 'Developing' ? 'bg-yellow-500 hover:bg-yellow-600' :
                        'bg-blue-600 hover:bg-blue-700'
                      }
                    `}
                  >
                    <Zap className="h-4 w-4" />
                    <span>{skill.next_step.text}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SkillBreakdown;