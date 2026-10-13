'use client';

/**
 * A grade grown past (learner model, ruling T1 10-12): the child has shown 60%
 * of a grade's skills in a subject, so the next grade opens. Shown to the child
 * (lesson / Pulse review, My Progress) and to the parent (progress report).
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import { LuminaCallout } from '../ui';

export interface GrownPastItem {
  /** Display subject, e.g. "Math". */
  subject: string;
  /** Grade grown past, e.g. "Kindergarten" or "1". */
  grade: string;
  /** Grade now being learned, when known. */
  nowLearning?: string | null;
}

const gradeLabel = (g: string) =>
  /^k(indergarten)?$/i.test(g) ? 'Kindergarten' : /^\d+$/.test(g) ? `Grade ${g}` : g;

export default function GrownPastBanner({ items, audience, name }: {
  items: GrownPastItem[];
  audience: 'child' | 'parent';
  name?: string;
}) {
  if (!items.length) return null;
  // the highest grade per subject is the news; earlier ones are listed with it
  const bySubject = new Map<string, GrownPastItem[]>();
  items.forEach((i) => bySubject.set(i.subject, [...(bySubject.get(i.subject) ?? []), i]));
  return (
    <div className="space-y-2">
      {Array.from(bySubject.entries()).map(([subject, list]) => {
        const grades = list.map((i) => gradeLabel(i.grade)).join(' and ');
        const next = list[list.length - 1].nowLearning;
        const subj = subject.toLowerCase();
        const text = audience === 'child'
          ? `You grew past ${grades} ${subj}!${next ? ` Now you are learning ${gradeLabel(next)} ${subj}.` : ''}`
          : `${name ?? 'Your child'} has shown most of ${grades} ${subj}${next ? ` and is now learning ${gradeLabel(next)} ${subj}` : ''}.`;
        return (
          <LuminaCallout key={subject} accent="amber" label={audience === 'child' ? 'You grew!' : 'Working ahead'}
            icon={<Sparkles className="h-4 w-4" />}>
            {text}
          </LuminaCallout>
        );
      })}
    </div>
  );
}
