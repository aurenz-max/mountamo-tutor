"use client";

import React, { useState } from 'react';
import { useLinkedStudents, useSessionHistory } from '@/hooks/useParentPortal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MessageSquare, CheckCircle, BookOpen, Activity } from 'lucide-react';
import type { SessionSummary } from '@/lib/parentPortalApi';

export default function SessionHistoryPage() {
  const { students } = useLinkedStudents();
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    students.length > 0 ? students[0] : null
  );

  const { sessionHistory, loading, error, refetch } = useSessionHistory(selectedStudentId, 20);

  // Update selected student when students list changes
  React.useEffect(() => {
    if (students.length > 0 && !selectedStudentId) {
      setSelectedStudentId(students[0]);
    }
  }, [students, selectedStudentId]);

  const getEngagementColor = (score: string) => {
    switch (score) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case 'practice_tutor':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'education_package':
        return <BookOpen className="h-5 w-5 text-purple-600" />;
      case 'read_along':
        return <Activity className="h-5 w-5 text-green-600" />;
      default:
        return <MessageSquare className="h-5 w-5 text-gray-600" />;
    }
  };

  const formatSessionType = (type: string) => {
    switch (type) {
      case 'practice_tutor':
        return 'Practice Tutor';
      case 'education_package':
        return 'Learning Package';
      case 'read_along':
        return 'Read Along';
      default:
        return type;
    }
  };

  if (students.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <p className="text-red-600 mb-4">Failed to load session history: {error.message}</p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Session History</h2>
        <p className="text-gray-600 mt-1">
          Review your child's tutoring sessions and learning activities
        </p>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <MessageSquare className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Understanding Session Summaries</h3>
              <p className="text-sm text-gray-700">
                Each AI tutoring session is automatically summarized to show you what your child learned,
                how engaged they were, and the key concepts covered. This helps you have meaningful
                conversations about their learning.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {sessionHistory?.sessions && sessionHistory.sessions.length > 0 ? (
        <div className="space-y-4">
          {sessionHistory.sessions.map((session: SessionSummary) => (
            <Card key={session.session_id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {getSessionTypeIcon(session.session_type)}
                    <div>
                      <CardTitle className="text-lg">{session.topic_covered}</CardTitle>
                      <CardDescription className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">{session.subject}</Badge>
                        <span className="text-xs">
                          {formatSessionType(session.session_type)}
                        </span>
                      </CardDescription>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {new Date(session.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center justify-end">
                      <Clock className="h-3 w-3 mr-1" />
                      {session.duration_minutes} min
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Skill Information */}
                {(session.skill_description || session.subskill_description) && (
                  <div className="text-sm text-gray-700">
                    {session.skill_description && (
                      <p className="mb-1">
                        <span className="font-medium">Skill:</span> {session.skill_description}
                      </p>
                    )}
                    {session.subskill_description && (
                      <p>
                        <span className="font-medium">Focus:</span> {session.subskill_description}
                      </p>
                    )}
                  </div>
                )}

                {/* Key Concepts */}
                {session.key_concepts && session.key_concepts.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Key Concepts Covered:</p>
                    <div className="flex flex-wrap gap-2">
                      {session.key_concepts.map((concept, idx) => (
                        <Badge key={idx} variant="secondary">
                          {concept}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance Stats */}
                {(session.problems_attempted !== null || session.student_engagement_score) && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    {session.problems_attempted !== null && (
                      <div>
                        <p className="text-xs text-gray-600 mb-1">Problems Attempted</p>
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-lg font-semibold text-gray-900">
                            {session.problems_correct}/{session.problems_attempted}
                          </span>
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-gray-600 mb-1">Engagement Level</p>
                      <Badge className={`${getEngagementColor(session.student_engagement_score)} border`}>
                        {session.student_engagement_score.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Tutor Feedback */}
                {session.tutor_feedback && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-blue-900 mb-2">AI Tutor Feedback:</p>
                    <p className="text-sm text-blue-800">{session.tutor_feedback}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sessions Yet</h3>
            <p className="text-gray-600">
              Session summaries will appear here after your child completes tutoring sessions.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {sessionHistory && sessionHistory.total_sessions > 0 && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sessionHistory.total_sessions}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Date Range</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(sessionHistory.date_range.start_date).toLocaleDateString()} -{' '}
                  {new Date(sessionHistory.date_range.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
