'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSkillProgress } from '@/hooks/useSkillProgress';
import CraftingCard from './CraftingCard';
import AlmostReadyList from './AlmostReadyList';
import ProgressOverview from './ProgressOverview';

interface SkillProgressPanelProps {
  studentId: number;
}

const SkillProgressPanel: React.FC<SkillProgressPanelProps> = ({ studentId }) => {
  const { data, loading, error, refetch } = useSkillProgress(studentId);
  const router = useRouter();

  const handleStart = async (subskillId: string) => {
    try {
      const { authApi } = await import('@/lib/authApiClient');
      const response = await authApi.getContentPackageForSubskill(subskillId);
      if (response.packageId) {
        router.push(`/packages/${response.packageId}/learn`);
      }
    } catch (err) {
      console.error('Error starting skill:', err);
      router.push('/packages');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-red-300 text-sm">{error}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetch}
          className="text-red-300 hover:text-red-200"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const hasCrafting = data.crafting_now.length > 0;
  const hasAlmostReady = data.almost_ready.length > 0;
  const hasProgress = Object.keys(data.progress_overview).length > 0;

  if (!hasCrafting && !hasAlmostReady && !hasProgress) return null;

  return (
    <div className="space-y-4">
      {/* Layer 1: Crafting Now */}
      {hasCrafting && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Working Toward
          </h3>
          {data.crafting_now.map((item) => (
            <CraftingCard key={item.skill_id} item={item} onStart={handleStart} />
          ))}
        </div>
      )}

      {/* Layer 2: Almost Ready */}
      {hasAlmostReady && <AlmostReadyList items={data.almost_ready} />}

      {/* Layer 3: Progress Overview */}
      {hasProgress && <ProgressOverview subjects={data.progress_overview} />}
    </div>
  );
};

export default SkillProgressPanel;
