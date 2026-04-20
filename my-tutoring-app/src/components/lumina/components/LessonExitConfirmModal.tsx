import React, { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LessonExitConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export const LessonExitConfirmModal: React.FC<LessonExitConfirmModalProps> = ({
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-exit-title"
    >
      <Card
        className="relative max-w-md w-full mx-4 p-8 backdrop-blur-xl bg-slate-900/80 border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 id="lesson-exit-title" className="text-2xl font-bold text-slate-100">
            Leave lesson?
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            You're in the middle of an activity. If you leave now, you'll return to the exhibits screen and lose your place in this lesson.
          </p>
          <div className="flex gap-3 w-full mt-4">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="flex-1 bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
            >
              Keep learning
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-red-500/20 border border-red-400/30 hover:bg-red-500/30 text-red-100"
            >
              Leave
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
