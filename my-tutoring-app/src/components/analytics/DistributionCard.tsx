'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ScoreHistogram } from './ScoreHistogram'
import type { ScoreDistributionItem } from '@/types/analytics'

interface DistributionCardProps {
  item: ScoreDistributionItem
  defaultExpanded?: boolean
  showHistogram?: boolean
}

// Helper to determine mastery level based on average score
const getMasteryLevel = (avgScore?: number): { label: string; color: string } => {
  if (!avgScore) return { label: 'No Data', color: 'gray' }

  if (avgScore >= 9) return { label: 'Excellent', color: 'green' }
  if (avgScore >= 7) return { label: 'Good', color: 'blue' }
  if (avgScore >= 5) return { label: 'Fair', color: 'yellow' }
  return { label: 'Needs Work', color: 'red' }
}

const getBadgeVariant = (color: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (color) {
    case 'green':
      return 'default'
    case 'blue':
      return 'secondary'
    case 'yellow':
      return 'outline'
    case 'red':
      return 'destructive'
    default:
      return 'secondary'
  }
}

export const DistributionCard: React.FC<DistributionCardProps> = ({
  item,
  defaultExpanded = false,
  showHistogram = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const mastery = getMasteryLevel(item.avg_score)

  return (
    <Card className="mb-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {showHistogram && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 w-6 p-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            <div className="flex-1">
              <CardTitle className="text-base font-semibold">
                {item.name}
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                {item.level.charAt(0).toUpperCase() + item.level.slice(1)} Level
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-lg font-bold">
                {item.avg_score ? item.avg_score.toFixed(1) : 'N/A'}
                <span className="text-sm font-normal text-gray-500">/10</span>
              </div>
              <div className="text-xs text-gray-500">
                {item.total_reviews} review{item.total_reviews !== 1 ? 's' : ''}
              </div>
            </div>
            <Badge variant={getBadgeVariant(mastery.color)}>
              {mastery.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {isExpanded && showHistogram && (
        <CardContent className="pt-0">
          <ScoreHistogram
            scoreHistogram={item.score_histogram}
            height={200}
            showPercentage={true}
          />

          {/* Additional stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Average Score:</span>
              <span className="ml-2 font-semibold">
                {item.avg_score_pct
                  ? `${(item.avg_score_pct * 100).toFixed(1)}%`
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Total Reviews:</span>
              <span className="ml-2 font-semibold">{item.total_reviews}</span>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="mt-3 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }}></div>
              <span>Excellent (9-10)</span>
              <div className="w-3 h-3 rounded ml-3" style={{ backgroundColor: '#3b82f6' }}></div>
              <span>Good (7-8)</span>
              <div className="w-3 h-3 rounded ml-3" style={{ backgroundColor: '#f59e0b' }}></div>
              <span>Fair (5-6)</span>
              <div className="w-3 h-3 rounded ml-3" style={{ backgroundColor: '#ef4444' }}></div>
              <span>Needs Work (0-4)</span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
