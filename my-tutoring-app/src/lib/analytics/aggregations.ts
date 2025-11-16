/**
 * Aggregation utilities for assessment analytics
 * Aggregates performance data across multiple assessments
 */

import { AssessmentHistoryItem } from '@/types/analytics'

// Aggregated problem type performance
export interface AggregatedProblemType {
  problem_type: string
  total: number
  correct: number
  percentage: number
  assessment_count: number // Number of assessments with this problem type
}

// Aggregated learning category performance
export interface AggregatedCategory {
  category: string
  total: number
  correct: number
  percentage: number
  unique_skills: number
  assessment_count: number // Number of assessments with this category
}

/**
 * Parse value to number (handles string or number inputs)
 */
const parseToNumber = (value: string | number): number => {
  return typeof value === 'string' ? parseFloat(value) : value
}

/**
 * Aggregate performance by problem type across all assessments
 */
export function aggregatePerformanceByType(
  assessments: AssessmentHistoryItem[]
): AggregatedProblemType[] {
  const typeMap = new Map<string, {
    total: number
    correct: number
    assessment_count: number
  }>()

  // Aggregate data from all assessments
  assessments.forEach((assessment) => {
    if (!assessment.performance_by_type || assessment.performance_by_type.length === 0) {
      return
    }

    assessment.performance_by_type.forEach((item) => {
      const existing = typeMap.get(item.problem_type) || {
        total: 0,
        correct: 0,
        assessment_count: 0
      }

      typeMap.set(item.problem_type, {
        total: existing.total + parseToNumber(item.total),
        correct: existing.correct + parseToNumber(item.correct),
        assessment_count: existing.assessment_count + 1
      })
    })
  })

  // Convert map to array and calculate percentages
  const results: AggregatedProblemType[] = []
  typeMap.forEach((value, key) => {
    results.push({
      problem_type: key,
      total: value.total,
      correct: value.correct,
      percentage: value.total > 0 ? (value.correct / value.total) * 100 : 0,
      assessment_count: value.assessment_count
    })
  })

  // Sort by total questions (most common problem types first)
  return results.sort((a, b) => b.total - a.total)
}

/**
 * Aggregate performance by learning category across all assessments
 */
export function aggregatePerformanceByCategory(
  assessments: AssessmentHistoryItem[]
): AggregatedCategory[] {
  const categoryMap = new Map<string, {
    total: number
    correct: number
    unique_skills: Set<number>
    assessment_count: number
  }>()

  // Aggregate data from all assessments
  assessments.forEach((assessment) => {
    if (!assessment.performance_by_category || assessment.performance_by_category.length === 0) {
      return
    }

    assessment.performance_by_category.forEach((item) => {
      const existing = categoryMap.get(item.category) || {
        total: 0,
        correct: 0,
        unique_skills: new Set<number>(),
        assessment_count: 0
      }

      // Add unique skills (if available in the data)
      const skillCount = parseToNumber(item.unique_skills)
      for (let i = 0; i < skillCount; i++) {
        existing.unique_skills.add(i) // Placeholder - actual skill IDs not available
      }

      categoryMap.set(item.category, {
        total: existing.total + parseToNumber(item.total),
        correct: existing.correct + parseToNumber(item.correct),
        unique_skills: existing.unique_skills,
        assessment_count: existing.assessment_count + 1
      })
    })
  })

  // Convert map to array and calculate percentages
  const results: AggregatedCategory[] = []
  categoryMap.forEach((value, key) => {
    results.push({
      category: key,
      total: value.total,
      correct: value.correct,
      percentage: value.total > 0 ? (value.correct / value.total) * 100 : 0,
      unique_skills: value.unique_skills.size,
      assessment_count: value.assessment_count
    })
  })

  // Sort by category priority: weak_spots, foundational_review, new_frontiers, others
  const categoryOrder: Record<string, number> = {
    'weak_spots': 1,
    'foundational_review': 2,
    'new_frontiers': 3,
    'recent_practice': 4
  }

  return results.sort((a, b) => {
    const orderA = categoryOrder[a.category] || 999
    const orderB = categoryOrder[b.category] || 999
    return orderA - orderB
  })
}

/**
 * Get category display configuration
 */
export function getCategoryConfig(category: string): {
  label: string
  colorClass: string
  bgClass: string
} {
  const configs: Record<string, { label: string; colorClass: string; bgClass: string }> = {
    'weak_spots': {
      label: 'Weak Spots',
      colorClass: 'text-red-800',
      bgClass: 'bg-red-100'
    },
    'foundational_review': {
      label: 'Foundational Review',
      colorClass: 'text-blue-800',
      bgClass: 'bg-blue-100'
    },
    'new_frontiers': {
      label: 'New Frontiers',
      colorClass: 'text-purple-800',
      bgClass: 'bg-purple-100'
    },
    'recent_practice': {
      label: 'Recent Practice',
      colorClass: 'text-green-800',
      bgClass: 'bg-green-100'
    }
  }

  return configs[category] || {
    label: category.replace(/_/g, ' '),
    colorClass: 'text-gray-800',
    bgClass: 'bg-gray-100'
  }
}

/**
 * Get score badge color based on percentage
 */
export function getScoreBadgeClass(percentage: number): string {
  if (percentage >= 80) return 'bg-green-100 text-green-800'
  if (percentage >= 60) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}
