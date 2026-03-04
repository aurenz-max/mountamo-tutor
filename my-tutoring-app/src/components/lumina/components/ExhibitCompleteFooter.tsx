import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { LessonBlock } from '@/lib/sessionPlanAPI';

const SUBJECT_COLORS: Record<string, string> = {
  ELA: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Math: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Science: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Social Studies': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

interface ExhibitCompleteFooterProps {
  block: LessonBlock;
  evalCount: number;
  onContinue: () => void;
}

export default function ExhibitCompleteFooter({ block, evalCount, onContinue }: ExhibitCompleteFooterProps) {
  const subjectStyle = SUBJECT_COLORS[block.subject] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  const message = block.celebration_message || 'Great work on this block!';

  return (
    <div className="mt-24 mb-12 max-w-3xl mx-auto animate-fade-in">
      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-500/30" />
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          <span>Block Complete</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-500/30" />
      </div>

      <Card className="backdrop-blur-xl bg-slate-900/60 border-emerald-500/20 ring-1 ring-emerald-500/10">
        <CardContent className="p-8 text-center">
          <div className="text-4xl mb-4">🎉</div>
          <p className="text-xl font-semibold text-emerald-300 mb-2">{message}</p>

          <div className="flex items-center justify-center gap-3 mb-6">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${subjectStyle}`}>
              {block.subject}
            </span>
            <span className="text-slate-400 text-sm">{block.title}</span>
            {evalCount > 0 && (
              <span className="text-slate-500 text-sm">{evalCount} answered</span>
            )}
          </div>

          <Button
            onClick={onContinue}
            className="bg-emerald-600/80 hover:bg-emerald-500/80 text-white border border-emerald-400/30 px-8 py-3 text-base font-semibold rounded-xl transition-all duration-200 hover:scale-105"
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
