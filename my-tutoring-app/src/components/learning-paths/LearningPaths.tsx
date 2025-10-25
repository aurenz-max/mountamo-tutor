'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RotateCcw,
  CheckCircle,
  LogIn,
  User,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Lock,
  Unlock,
  Clock,
  Trophy
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  useGraphVisualization,
  useRecommendations,
  useInvalidateLearningPaths
} from '@/lib/learning-paths/hooks';
import type { NodeStatus, Skill, Subskill, Recommendation, UnlockData } from '@/types/learning-paths';

/**
 * Learning Paths Component - Refactored for Student State Engine
 *
 * Uses the BigQuery-backed prerequisite graph system with Firestore caching
 * for fast (~50ms) loads and accurate LOCKED/UNLOCKED/IN_PROGRESS/MASTERED states.
 */
const LearningPaths = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathematics');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  // Use Student State Engine via visualization endpoint (hierarchical structure)
  const {
    data: visualizationData,
    isLoading,
    error,
    refetch,
  } = useGraphVisualization(selectedSubject, userProfile?.student_id);

  // Get personalized recommendations
  const { data: recommendationsData } = useRecommendations(
    userProfile?.student_id,
    selectedSubject,
    5
  );

  // Mutation for refreshing after practice
  const invalidatePaths = useInvalidateLearningPaths();

  // Available subjects (simplified for now)
  const availableSubjects = ['Mathematics', 'Language Arts', 'Science'];

  /**
   * Get status color classes for visual feedback
   */
  const getStatusColor = (status: NodeStatus): string => {
    switch (status) {
      case 'MASTERED':
        return 'bg-green-50 border-green-500 hover:bg-green-100';
      case 'IN_PROGRESS':
        return 'bg-yellow-50 border-yellow-500 hover:bg-yellow-100';
      case 'UNLOCKED':
        return 'bg-blue-50 border-blue-500 hover:bg-blue-100';
      case 'LOCKED':
        return 'bg-gray-50 border-gray-300 hover:bg-gray-100';
      default:
        return 'bg-gray-50 border-gray-300';
    }
  };

  /**
   * Get status icon component
   */
  const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case 'MASTERED':
        return <Trophy className="w-4 h-4 text-green-600" />;
      case 'IN_PROGRESS':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'UNLOCKED':
        return <Unlock className="w-4 h-4 text-blue-600" />;
      case 'LOCKED':
        return <Lock className="w-4 h-4 text-gray-600" />;
    }
  };

  /**
   * Get status badge label
   */
  const getStatusLabel = (status: NodeStatus): string => {
    switch (status) {
      case 'MASTERED': return 'Mastered';
      case 'IN_PROGRESS': return 'In Progress';
      case 'UNLOCKED': return 'Ready to Start';
      case 'LOCKED': return 'Locked';
    }
  };

  /**
   * Handle skill card expansion
   */
  const handleExpandSkill = (skillId: string) => {
    setExpandedSkillId(expandedSkillId === skillId ? null : skillId);
  };

  /**
   * Handle subject change
   */
  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
    setExpandedSkillId(null);
  };

  /**
   * Handle refresh button
   */
  const handleRefresh = async () => {
    if (userProfile?.student_id) {
      await invalidatePaths.mutateAsync({
        studentId: userProfile.student_id,
        subject: selectedSubject,
      });
      refetch();
    }
  };

  // Calculate progress statistics
  const allSkills = visualizationData?.units.flatMap((unit) => unit.skills) || [];

  const totalSubskills = allSkills.reduce(
    (sum: number, skill: Skill) => sum + skill.subskills.length,
    0
  ) || 0;

  const masteredSubskills = allSkills
    .flatMap((skill: Skill) => skill.subskills)
    .filter((subskill: Subskill) => (subskill.student_data?.proficiency || 0) >= 0.8).length || 0;

  const inProgressSubskills = allSkills
    .flatMap((skill: Skill) => skill.subskills)
    .filter((subskill: Subskill) => {
      const prof = subskill.student_data?.proficiency || 0;
      return prof > 0 && prof < 0.8;
    }).length || 0;

  const unlockedSubskills = allSkills
    .flatMap((skill: Skill) => skill.subskills)
    .filter((subskill: Subskill) => {
      const prof = subskill.student_data?.proficiency || 0;
      return subskill.student_data?.unlocked && prof === 0;
    }).length || 0;

  const progressPercentage = totalSubskills > 0 ? (masteredSubskills / totalSubskills) * 100 : 0;

  // ==================== LOADING & ERROR STATES ====================

  if (authLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <span>Initializing authentication...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <LogIn className="w-16 h-16 mx-auto text-gray-400" />
            <h2 className="text-xl font-bold">Authentication Required</h2>
            <p className="text-gray-600">
              Please log in to access your learning paths and track your progress.
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/login">
                <Button>
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline">
                  <User className="w-4 h-4 mr-2" />
                  Register
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userProfile?.student_id) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-yellow-500" />
            <h2 className="text-xl font-bold">Profile Setup Required</h2>
            <p className="text-gray-600">
              Your profile is missing required information. Please complete your profile setup.
            </p>
            <Link href="/profile">
              <Button>
                <User className="w-4 h-4 mr-2" />
                Complete Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
            <span>Loading your learning path...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="text-xl font-bold text-red-600">Error Loading Data</h2>
            <p className="text-gray-600">
              {error instanceof Error ? error.message : 'Failed to load learning path data'}
            </p>
            <div className="flex justify-center space-x-2">
              <Button onClick={handleRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!visualizationData || visualizationData.units.length === 0) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="w-16 h-16 mx-auto text-gray-400" />
            <h2 className="text-xl font-bold">No Curriculum Data</h2>
            <p className="text-gray-600">
              No curriculum data available for {selectedSubject}.
            </p>
            {availableSubjects.length > 1 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Try selecting a different subject:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {availableSubjects.map((subject) => (
                    <Button
                      key={subject}
                      variant={subject === selectedSubject ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleSubjectChange(subject)}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      {subject}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ==================== MAIN UI ====================

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-6">
        {/* User Info Header */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-blue-600" />
              <span className="font-medium">
                Welcome, {userProfile?.displayName || user.email}
              </span>
              {userProfile?.grade_level && (
                <span className="text-sm text-gray-600">(Grade {userProfile.grade_level})</span>
              )}
            </div>
            {userProfile?.total_points && (
              <div className="text-sm text-blue-600 font-medium">
                Points: {userProfile.total_points}
              </div>
            )}
          </div>
        </div>

        {/* Subject Selection */}
        {availableSubjects.length > 1 && (
          <div className="mb-6 p-3 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Subject:</h3>
            <div className="flex flex-wrap gap-2">
              {availableSubjects.map((subject) => (
                <Button
                  key={subject}
                  variant={subject === selectedSubject ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSubjectChange(subject)}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {subject}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Section */}
        {recommendationsData && recommendationsData.recommendations.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              🎯 Recommended for You
            </h3>
            <div className="space-y-2">
              {recommendationsData.recommendations.map((rec: Recommendation) => (
                <div
                  key={rec.entity_id}
                  className="p-3 bg-white rounded-lg border border-yellow-100 hover:border-yellow-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{rec.description}</span>
                        <Badge
                          variant={rec.priority === 'high' ? 'destructive' : 'secondary'}
                        >
                          {rec.priority === 'high' ? '🔥 High Priority' : '📈 Medium Priority'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        Part of: <span className="font-medium">{rec.skill_description}</span>
                      </p>
                      <p className="text-xs text-gray-500">{rec.message}</p>
                      {rec.current_proficiency > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Current Progress</span>
                            <span>{(rec.current_proficiency * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 rounded-full h-1.5 transition-all"
                              style={{ width: `${rec.current_proficiency * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleExpandSkill(rec.skill_id)}
                      className="ml-4"
                    >
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress Overview */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{selectedSubject} Learning Path</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-green-600" />
                <span>{masteredSubskills} Mastered</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span>{inProgressSubskills} In Progress</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Unlock className="w-4 h-4 text-blue-600" />
                <span>{unlockedSubskills} Ready</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-green-500 rounded-full h-3 transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2 text-right">
            {masteredSubskills} / {totalSubskills} subskills mastered ({progressPercentage.toFixed(1)}%)
          </p>
        </div>

        {/* Units List */}
        <div className="space-y-8">
          {visualizationData.units.map((unit) => (
            <div key={unit.unit_id} className="space-y-4">
              {/* Unit Header */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border-2 border-purple-200">
                <h3 className="text-xl font-bold text-purple-900">{unit.unit_title}</h3>
                <p className="text-sm text-gray-600 mt-1">Unit ID: {unit.unit_id}</p>
              </div>

              {/* Skills within Unit */}
              <div className="space-y-4 ml-4">
                {unit.skills.map((skill: Skill) => {
                  const skillUnlockedCount = skill.subskills.filter(
                    (s: Subskill) => s.student_data?.unlocked
                  ).length;
                  const skillMasteredCount = skill.subskills.filter(
                    (s: Subskill) => (s.student_data?.proficiency || 0) >= 0.8
                  ).length;
                  const skillAvgProficiency =
                    skill.subskills.filter((s: Subskill) => s.student_data).reduce(
                      (sum: number, s: Subskill) => sum + (s.student_data?.proficiency || 0),
                      0
                    ) / (skill.subskills.filter((s: Subskill) => s.student_data).length || 1);

                  const isExpanded = expandedSkillId === skill.skill_id;

                  return (
                    <Card
                      key={skill.skill_id}
                      className={`cursor-pointer transition-colors ${
                        isExpanded ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleExpandSkill(skill.skill_id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg font-semibold">{skill.skill_description}</CardTitle>
                            <p className="text-xs text-gray-500 mt-1">Skill ID: {skill.skill_id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {skillMasteredCount}/{skill.subskills.length} Mastered
                            </Badge>
                            <Badge variant="secondary">
                              {skillUnlockedCount}/{skill.subskills.length} Unlocked
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>

                  {/* Skill-level progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Overall Progress</span>
                      <span>{(skillAvgProficiency * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`rounded-full h-2 transition-all ${
                          skillAvgProficiency >= 0.8
                            ? 'bg-green-500'
                            : skillAvgProficiency >= 0.5
                            ? 'bg-yellow-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${skillAvgProficiency * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Prerequisites */}
                  {skill.prerequisites.length > 0 && (
                    <div className="mb-3 text-xs text-gray-600">
                      Prerequisites: {skill.prerequisites.map((p: any) => p.description || p.prerequisite_id).join(', ')}
                    </div>
                  )}

                  {/* Subskills (when expanded) */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      <h4 className="font-semibold">Subskills:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {skill.subskills.map((subskill: Subskill) => {
                          const isUnlocked = subskill.student_data?.unlocked ?? false;
                          const proficiency = subskill.student_data?.proficiency || 0;
                          const attempts = subskill.student_data?.attempts || 0;
                          const unlockData = subskill.student_data?.unlock_data;

                          // Determine status (mimicking backend logic for display)
                          let status: NodeStatus = 'LOCKED';
                          if (isUnlocked) {
                            if (proficiency >= 0.8) status = 'MASTERED';
                            else if (proficiency > 0) status = 'IN_PROGRESS';
                            else status = 'UNLOCKED';
                          }

                          return (
                            <Card
                              key={subskill.subskill_id}
                              className={`border-2 ${getStatusColor(status)} relative`}
                            >
                              <CardContent className="p-4">
                                {/* Lock overlay for locked subskills */}
                                {!isUnlocked && (
                                  <div className="absolute inset-0 bg-gray-900 bg-opacity-30 rounded flex items-center justify-center z-10">
                                    <Lock className="w-8 h-8 text-white" />
                                  </div>
                                )}

                                {/* Status badge */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1">
                                    {getStatusIcon(status)}
                                    <Badge variant="outline" className="text-xs">
                                      {getStatusLabel(status)}
                                    </Badge>
                                  </div>
                                  {status === 'MASTERED' && (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <span className="font-semibold text-sm block">
                                    {subskill.description}
                                  </span>
                                  <span className="text-xs text-gray-500 block">
                                    Subskill ID: {subskill.subskill_id}
                                  </span>

                                  {/* Prerequisites info */}
                                  {subskill.prerequisites.length > 0 && (
                                    <div className="text-xs text-gray-500">
                                      Requires: {subskill.prerequisites.map((p: any) => p.description || p.prerequisite_id).join(', ')}
                                    </div>
                                  )}

                                  {/* Progress bar for unlocked subskills */}
                                  {isUnlocked && (
                                    <div className="mt-3">
                                      <div className="flex justify-between text-xs mb-1">
                                        <span>Proficiency</span>
                                        <span>{(proficiency * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`rounded-full h-2 transition-all ${
                                            proficiency >= 0.8
                                              ? 'bg-green-500'
                                              : proficiency >= 0.5
                                              ? 'bg-yellow-500'
                                              : 'bg-blue-500'
                                          }`}
                                          style={{ width: `${proficiency * 100}%` }}
                                        />
                                      </div>
                                      {attempts > 0 && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          {attempts} attempt{attempts !== 1 ? 's' : ''}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {!isUnlocked && unlockData && unlockData.length > 0 && (
                                    <div className="mt-3 text-xs text-red-600 font-medium space-y-1">
                                      <p className="font-bold">🔒 Locked - Prerequisites not met:</p>
                                      <ul className="list-disc pl-4 text-gray-700">
                                        {unlockData.map((d: UnlockData) => (
                                          <li key={d.id}>
                                            {d.description}:{' '}
                                            <span className="font-semibold">
                                              {Math.round(d.current_proficiency * 100)}% / {Math.round(d.required * 100)}%
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {!isUnlocked && (!unlockData || unlockData.length === 0) && (
                                      <div className="mt-3 text-xs text-red-600 font-medium">
                                          🔒 Locked - Complete prerequisites first
                                      </div>
                                  )}
                                </div>

                                {/* Action buttons */}
                                <div className="flex justify-around mt-4 pt-3 border-t gap-2">
                                  <Button variant="secondary" size="sm" disabled={!isUnlocked}>
                                    Teaching
                                  </Button>
                                  <Button variant="secondary" size="sm" disabled={!isUnlocked}>
                                    Practice
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!isExpanded && (
                    <div className="mt-3 text-blue-600 text-sm font-medium">
                      Click to see subskills →
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LearningPaths;
