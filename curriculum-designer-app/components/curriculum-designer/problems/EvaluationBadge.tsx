'use client';

import { Badge } from '@/components/ui/badge';
import type { FinalRecommendation } from '@/types/problems';

interface EvaluationBadgeProps {
  recommendation: FinalRecommendation;
  score: number;
  size?: 'default' | 'sm' | 'lg';
  showScore?: boolean;
}

export function EvaluationBadge({
  recommendation,
  score,
  size = 'default',
  showScore = true
}: EvaluationBadgeProps) {
  const getStatusConfig = () => {
    switch (recommendation) {
      case 'approve':
        return {
          variant: 'default' as const,
          color: 'bg-green-500',
          label: 'Approved',
          icon: '✓',
        };
      case 'revise':
        return {
          variant: 'secondary' as const,
          color: 'bg-yellow-500',
          label: 'Needs Revision',
          icon: '⚠',
        };
      case 'reject':
        return {
          variant: 'destructive' as const,
          color: 'bg-red-500',
          label: 'Rejected',
          icon: '✗',
        };
    }
  };

  const config = getStatusConfig();
  const displayText = showScore ? `${config.icon} ${score.toFixed(1)}/10` : config.label;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    default: 'text-sm',
    lg: 'text-base px-3 py-1'
  };

  return (
    <Badge
      variant={config.variant}
      className={sizeClasses[size]}
      title={`${config.label} - Overall Score: ${score.toFixed(1)}/10`}
    >
      {displayText}
    </Badge>
  );
}

// Tier progress indicator component
interface TierProgressProps {
  tier1Passed: boolean;
  tier2Passed: boolean;
  hasLlmEvaluation: boolean;
}

export function TierProgress({ tier1Passed, tier2Passed, hasLlmEvaluation }: TierProgressProps) {
  const tiers = [
    { name: 'Structure', passed: tier1Passed, stage: 1 },
    { name: 'Heuristics', passed: tier2Passed, stage: 2 },
    { name: 'LLM Judge', passed: hasLlmEvaluation, stage: 3 },
  ];

  return (
    <div className="flex items-center gap-1 text-xs">
      {tiers.map((tier, index) => (
        <div key={tier.stage} className="flex items-center">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded ${
              tier.passed
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-400'
            }`}
            title={tier.name}
          >
            <span className="font-medium">T{tier.stage}</span>
            {tier.passed && <span>✓</span>}
          </div>
          {index < tiers.length - 1 && (
            <span className="mx-0.5 text-gray-300">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
