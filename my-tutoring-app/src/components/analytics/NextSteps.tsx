// src/components/analytics/NextSteps.tsx
'use client'

import React from 'react'
import { useAnalytics } from './StudentAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Check, Target, Star, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function NextSteps() {
  const { metrics, recommendations } = useAnalytics()
  
  if (!metrics || !recommendations) {
    return null
  }

  // Group recommendations by priority level
  const groupedRecommendations = recommendations.reduce((groups, rec) => {
    const group = rec.priority_level.replace(' ', '');
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(rec);
    return groups;
  }, {});

  // Get high priority items
  const highPriorityItems = recommendations.filter(rec => 
    rec.priority === 'high' && rec.proficiency < 0.8
  );

  // Get mastered items
  const masteredItems = recommendations.filter(rec => 
    rec.priority_level === 'Mastered'
  );

  // Get not started items
  const notStartedItems = recommendations.filter(rec => 
    rec.priority_level === 'Not Started'
  );

  // Get performance color based on score
  const getPerformanceColor = (score) => {
    const percent = score * 100;
    if (percent >= 80) return 'text-green-600';
    if (percent >= 70) return 'text-lime-600';
    if (percent >= 60) return 'text-yellow-600';
    if (percent >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  // Helper to get accurate attempt count from various sources
  const getAttemptCount = (item) => {
    // Explicit prioritization of data sources
    if (item.attempt_count !== undefined) {
      return item.attempt_count;
    }
    
    // For backward compatibility
    if (item.attempts !== undefined) {
      return item.attempts;
    }
    
    // Use is_attempted as a fallback
    return item.is_attempted ? 1 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Focus Areas */}
      <Card>
        <CardHeader>
          <CardTitle>Focus Areas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Attempts</TableHead>
                  <TableHead className="text-center">Proficiency %</TableHead>
                  <TableHead className="text-center">Completion Rate %</TableHead>
                  <TableHead className="text-center">Mastery %</TableHead>
                  <TableHead className="text-center">Average Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highPriorityItems.length > 0 && (
                  <>
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={6} className="font-medium">
                        <div className="flex items-center">
                          <Target className="h-4 w-4 mr-2 text-orange-500" />
                          High Priority
                        </div>
                      </TableCell>
                    </TableRow>
                    {highPriorityItems.map((item, index) => (
                      <TableRow key={`high-${index}`}>
                        <TableCell className="pl-8 text-sm">
                          {item.subskill_description}
                        </TableCell>
                        <TableCell className="text-center">{getAttemptCount(item)}</TableCell>
                        <TableCell className="text-center">{Math.round(item.proficiency * 100)}%</TableCell>
                        <TableCell className="text-center">100%</TableCell>
                        <TableCell className="text-center">
                          {Math.round((item.proficiency * 1.25) * 100)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium",
                            getPerformanceColor(item.proficiency)
                          )}>
                            {Math.round(item.proficiency * 100)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                <TableRow className="font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{highPriorityItems.reduce((sum, item) => sum + getAttemptCount(item), 0)}</TableCell>
                  <TableCell className="text-center">
                    {Math.round(highPriorityItems.reduce((sum, item) => sum + item.proficiency, 0) / 
                      Math.max(highPriorityItems.length, 1) * 100)}%
                  </TableCell>
                  <TableCell className="text-center">100%</TableCell>
                  <TableCell className="text-center">
                    {Math.round(highPriorityItems.reduce((sum, item) => sum + (item.proficiency * 1.25), 0) / 
                      Math.max(highPriorityItems.length, 1) * 100)}%
                  </TableCell>
                  <TableCell className="text-center">
                    {Math.round(highPriorityItems.reduce((sum, item) => sum + item.proficiency, 0) / 
                      Math.max(highPriorityItems.length, 1) * 100)}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Attempts</TableHead>
                  <TableHead className="text-center">Proficiency %</TableHead>
                  <TableHead className="text-center">Completion Rate %</TableHead>
                  <TableHead className="text-center">Mastery %</TableHead>
                  <TableHead className="text-center">Average Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {masteredItems.length > 0 && (
                  <>
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={6} className="font-medium">
                        <div className="flex items-center">
                          <Check className="h-4 w-4 mr-2 text-green-500" />
                          Mastered
                        </div>
                      </TableCell>
                    </TableRow>
                    {masteredItems.map((item, index) => (
                      <TableRow key={`mastered-${index}`}>
                        <TableCell className="pl-8 text-sm">
                          {item.subskill_description}
                        </TableCell>
                        <TableCell className="text-center">{getAttemptCount(item)}</TableCell>
                        <TableCell className="text-center">{Math.round(item.proficiency * 100)}%</TableCell>
                        <TableCell className="text-center">100%</TableCell>
                        <TableCell className="text-center">
                          {Math.round((item.proficiency * 1.1) * 100)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium",
                            "bg-green-100 text-green-800"
                          )}>
                            {Math.round(item.proficiency * 100)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                
                {highPriorityItems.length > 0 && (
                  <>
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={6} className="font-medium">
                        <div className="flex items-center">
                          <Target className="h-4 w-4 mr-2 text-orange-500" />
                          High Priority
                        </div>
                      </TableCell>
                    </TableRow>
                    {highPriorityItems.slice(0, 1).map((item, index) => (
                      <TableRow key={`high-next-${index}`}>
                        <TableCell className="pl-8 text-sm">
                          {item.subskill_description}
                        </TableCell>
                        <TableCell className="text-center">{getAttemptCount(item)}</TableCell>
                        <TableCell className="text-center">{Math.round(item.proficiency * 100)}%</TableCell>
                        <TableCell className="text-center">100%</TableCell>
                        <TableCell className="text-center">
                          {Math.round((item.proficiency * 1.25) * 100)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium",
                            getPerformanceColor(item.proficiency)
                          )}>
                            {Math.round(item.proficiency * 100)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}

                {notStartedItems.length > 0 && (
                  <>
                    <TableRow className="bg-gray-100">
                      <TableCell colSpan={6} className="font-medium">
                        <div className="flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2 text-blue-500" />
                          Not Started
                        </div>
                      </TableCell>
                    </TableRow>
                    {notStartedItems.slice(0, 5).map((item, index) => (
                      <TableRow key={`not-started-${index}`}>
                        <TableCell className="pl-8 text-sm">
                          {item.subskill_description}
                        </TableCell>
                        <TableCell className="text-center">0</TableCell>
                        <TableCell className="text-center">0%</TableCell>
                        <TableCell className="text-center">0%</TableCell>
                        <TableCell className="text-center">0%</TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-md text-xs font-medium",
                            "bg-gray-100 text-gray-800"
                          )}>
                            0%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                
                <TableRow className="font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">
                    {recommendations.reduce((sum, item) => sum + getAttemptCount(item), 0)}
                  </TableCell>
                  <TableCell className="text-center">
                    {Math.round(recommendations.filter(r => r.proficiency > 0).reduce((sum, item) => sum + item.proficiency, 0) / 
                      Math.max(recommendations.filter(r => r.proficiency > 0).length, 1) * 100)}%
                  </TableCell>
                  <TableCell className="text-center">
                    {Math.round(recommendations.filter(r => r.is_attempted).length / 
                      Math.max(recommendations.length, 1) * 100)}%
                  </TableCell>
                  <TableCell className="text-center">
                    {Math.round(recommendations.filter(r => r.proficiency > 0).reduce((sum, item) => sum + (item.proficiency * 1.1), 0) / 
                      Math.max(recommendations.filter(r => r.proficiency > 0).length, 1) * 100)}%
                  </TableCell>
                  <TableCell className="text-center">
                    {Math.round(recommendations.filter(r => r.proficiency > 0).reduce((sum, item) => sum + item.avg_score || item.proficiency, 0) / 
                      Math.max(recommendations.filter(r => r.proficiency > 0).length, 1) * 100)}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}