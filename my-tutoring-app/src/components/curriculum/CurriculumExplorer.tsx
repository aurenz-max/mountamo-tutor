// components/curriculum/CurriculumExplorer.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronRight,
  BookOpen,
  Target,
  CheckCircle,
  Circle,
  User,
  AlertCircle,
  RefreshCw,
  BarChart3,
  TreePine,
  Layers,
  GraduationCap,
  LogIn,
  Play,
  Loader2,
  Star
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, AuthApiError } from '@/lib/authApiClient';
import { analyticsApi } from '@/lib/studentAnalyticsAPI';
import type { StudentMetrics, SubskillData } from '@/lib/studentAnalyticsAPI';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SubSkill {
  id: string;
  description: string;
  difficulty_range: {
    start: number;
    end: number;
    target: number;
  };
}

interface Skill {
  id: string;
  description: string;
  subskills: SubSkill[];
}

interface Unit {
  id: string;
  title: string;
  skills: Skill[];
}

interface CurriculumData {
  subject: string;
  curriculum: Unit[];
}

interface CompetencyData {
  current_score?: number;
  credibility: number;
  total_attempts: number;
}

// Skeleton loader components
const SkeletonSubjectButton = () => (
  <div className="h-9 w-32 bg-gray-200 rounded animate-pulse"></div>
);

const SkeletonProgressCard = () => (
  <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
    <div className="h-6 w-40 bg-gray-200 rounded mb-3"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="text-center space-y-2">
          <div className="h-8 w-16 bg-gray-300 rounded mx-auto"></div>
          <div className="h-4 w-24 bg-gray-200 rounded mx-auto"></div>
        </div>
      ))}
    </div>
    <div className="space-y-2">
      <div className="h-4 w-full bg-gray-200 rounded"></div>
      <div className="h-2 w-full bg-gray-200 rounded"></div>
      <div className="h-4 w-full bg-gray-200 rounded mt-2"></div>
      <div className="h-2 w-full bg-gray-200 rounded"></div>
    </div>
  </div>
);

const SkeletonCurriculumTree = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="border rounded-lg animate-pulse">
        <div className="p-4 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-gray-300 rounded"></div>
            <div className="h-5 w-5 bg-gray-300 rounded"></div>
            <div className="h-5 w-48 bg-gray-300 rounded"></div>
            <div className="h-4 w-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

const CurriculumExplorer = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [curriculumData, setCurriculumData] = useState<CurriculumData | null>(null);

  // Granular loading states
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingCurriculum, setLoadingCurriculum] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded states for tree navigation
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  // Analytics data from BigQuery
  const [analyticsData, setAnalyticsData] = useState<StudentMetrics | null>(null);

  // Content package loading states
  const [loadingSubskills, setLoadingSubskills] = useState<Set<string>>(new Set());
  const [packageErrors, setPackageErrors] = useState<Map<string, string>>(new Map());

  // Fetch available subjects with memoization
  const fetchAvailableSubjects = useCallback(async () => {
    console.log('🔍 COMPONENT: Fetching available subjects...');

    try {
      setLoadingSubjects(true);
      const subjects = await authApi.getSubjects();
      console.log('✅ COMPONENT: Subjects received:', subjects);
      setAvailableSubjects(subjects);

      if (subjects && subjects.length > 0) {
        const firstSubject = subjects[0];
        setSelectedSubject(firstSubject);
        console.log(`✅ COMPONENT: Selected default subject: ${firstSubject}`);
      } else {
        console.warn('⚠️ COMPONENT: No subjects available');
        setError('No curriculum subjects are available');
      }
    } catch (error) {
      console.error('❌ COMPONENT: Failed to fetch subjects:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subjects';
      setError(errorMessage);
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  // Fetch curriculum data for selected subject with memoization
  const fetchCurriculumData = useCallback(async (subject: string) => {
    console.log(`🔍 COMPONENT: Fetching curriculum for subject: ${subject}...`);

    if (!subject) {
      console.log('🔍 COMPONENT: No subject provided, skipping curriculum fetch');
      return;
    }

    try {
      setLoadingCurriculum(true);
      setError(null);
      const curriculum = await authApi.getSubjectCurriculum(subject);
      console.log('✅ COMPONENT: Curriculum received:', curriculum);
      setCurriculumData(curriculum);
    } catch (error) {
      console.error(`❌ COMPONENT: Failed to fetch curriculum for ${subject}:`, error);

      let errorMessage = `Failed to fetch curriculum for ${subject}`;

      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as AuthApiError;
        if (apiError.status === 404) {
          errorMessage = `No curriculum data available for ${subject}. Please try a different subject.`;
        } else {
          errorMessage = apiError.message || errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setError(errorMessage);
      setCurriculumData(null);
    } finally {
      setLoadingCurriculum(false);
    }
  }, []);

  // Fetch analytics data from BigQuery for selected subject with memoization
  const fetchAnalyticsForSubject = useCallback(async (subject: string) => {
    if (!userProfile?.student_id) {
      console.warn('Cannot fetch analytics: missing student_id');
      return;
    }

    try {
      setLoadingAnalytics(true);
      console.log(`🔍 Fetching analytics for student ${userProfile.student_id}, subject: ${subject}`);
      const data = await analyticsApi.getStudentMetrics(userProfile.student_id, {
        subject: subject
      });
      console.log('✅ Analytics data received:', data);
      setAnalyticsData(data);
    } catch (error) {
      console.error(`Error fetching analytics for ${subject}:`, error);
      // Set empty analytics data on error so UI doesn't break
      setAnalyticsData(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [userProfile?.student_id]);

  // Toggle unit expansion
  const toggleUnit = (unitId: string) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  };

  // Toggle skill expansion
  const toggleSkill = (skillId: string) => {
    setExpandedSkills(prev => {
      const newSet = new Set(prev);
      if (newSet.has(skillId)) {
        newSet.delete(skillId);
      } else {
        newSet.add(skillId);
      }
      return newSet;
    });
  };

  // Helper function to find unit analytics from hierarchical data
  const getUnitAnalytics = (unitId: string) => {
    if (!analyticsData) return null;

    const unit = analyticsData.hierarchical_data.find(u => u.unit_id === unitId);
    return unit || null;
  };

  // Helper function to find skill analytics from hierarchical data
  const getSkillAnalytics = (skillId: string) => {
    if (!analyticsData) return null;

    for (const unit of analyticsData.hierarchical_data) {
      const skill = unit.skills.find(s => s.skill_id === skillId);
      if (skill) return skill;
    }
    return null;
  };

  // Helper function to find subskill analytics from hierarchical data
  const getSubskillAnalytics = (subskillId: string): SubskillData | null => {
    if (!analyticsData) return null;

    for (const unit of analyticsData.hierarchical_data) {
      for (const skill of unit.skills) {
        const subskill = skill.subskills.find(s => s.subskill_id === subskillId);
        if (subskill) return subskill;
      }
    }
    return null;
  };

  // Handle "Start Learning" button click
  const handleStartLearning = async (subskillId: string) => {
    console.log('🚀 Starting learning session for subskill:', subskillId);
    
    // Add to loading state
    setLoadingSubskills(prev => new Set(prev).add(subskillId));
    
    // Clear any previous errors for this subskill
    setPackageErrors(prev => {
      const newErrors = new Map(prev);
      newErrors.delete(subskillId);
      return newErrors;
    });

    try {
      // Call the content package API
      const response = await authApi.getContentPackageForSubskill(subskillId);
      console.log('✅ Content package response:', response);
      
      if (response.packageId) {
        // Navigate to the learning session
        console.log('🎯 Navigating to packages session:', response.packageId);
        router.push(`/packages/${response.packageId}/learn`);
      } else {
        throw new Error('No package ID returned from server');
      }
    } catch (error) {
      console.error('❌ Failed to get content package for subskill:', subskillId, error);
      
      let errorMessage = 'Failed to start learning session';
      
      if (error && typeof error === 'object' && 'status' in error) {
        const apiError = error as AuthApiError;
        if (apiError.status === 404) {
          errorMessage = 'No content available for this subskill yet';
        } else if (apiError.status === 500) {
          errorMessage = 'Content generation failed. Please try again.';
        } else {
          errorMessage = apiError.message || errorMessage;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Store error for this subskill
      setPackageErrors(prev => new Map(prev).set(subskillId, errorMessage));
    } finally {
      // Remove from loading state
      setLoadingSubskills(prev => {
        const newSet = new Set(prev);
        newSet.delete(subskillId);
        return newSet;
      });
    }
  };

  // Handle practice navigation
  const handlePractice = (subskill: SubSkill, skill: Skill, unit: Unit) => {
    console.log('🎯 Starting practice session for subskill:', subskill.id);

    const params = new URLSearchParams();
    params.append('subject', selectedSubject);
    params.append('unit_id', unit.id);
    params.append('skill_id', skill.id);
    params.append('subskill_id', subskill.id);
    params.append('unit_title', unit.title);
    params.append('skill_description', skill.description);
    params.append('subskill_description', subskill.description);

    router.push(`/practice?${params.toString()}`);
  };

  // Calculate progress statistics from BigQuery analytics (memoized)
  const stats = useMemo(() => {
    if (!analyticsData) {
      // Fallback: count from curriculum structure
      if (!curriculumData) return { total: 0, attempted: 0, mastered: 0 };

      let total = 0;
      curriculumData.curriculum.forEach(unit => {
        unit.skills.forEach(skill => {
          total += skill.subskills.length;
        });
      });
      return { total, attempted: 0, mastered: 0 };
    }

    // Use BigQuery summary data
    const total = analyticsData.summary.total_items;
    const attempted = analyticsData.summary.attempted_items;

    // Count mastered from hierarchical data (mastery > 0.8)
    let mastered = 0;
    analyticsData.hierarchical_data.forEach(unit => {
      unit.skills.forEach(skill => {
        skill.subskills.forEach(subskill => {
          if (subskill.mastery > 0.8) {
            mastered++;
          }
        });
      });
    });

    return { total, attempted, mastered };
  }, [analyticsData, curriculumData]);

  // Get competency color
  const getCompetencyColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score > 0.8) return 'text-green-600';
    if (score > 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get competency icon
  const getCompetencyIcon = (score?: number, attempts: number = 0) => {
    if (attempts === 0) return <Circle className="w-4 h-4 text-gray-400" />;
    if (score && score > 0.8) return <CheckCircle className="w-4 h-4 text-green-600" />;
    return <Target className="w-4 h-4 text-yellow-600" />;
  };

  // Effects
  useEffect(() => {
    if (!authLoading && user) {
      fetchAvailableSubjects();
    }
  }, [user, authLoading, fetchAvailableSubjects]);

  useEffect(() => {
    if (selectedSubject) {
      fetchCurriculumData(selectedSubject);
    }
  }, [selectedSubject, fetchCurriculumData]);

  // Fetch analytics when curriculum and user profile are ready
  useEffect(() => {
    if (selectedSubject && curriculumData && userProfile?.student_id) {
      fetchAnalyticsForSubject(selectedSubject);
    }
  }, [selectedSubject, curriculumData, userProfile?.student_id, fetchAnalyticsForSubject]);

  // Handle subject change with optimistic UI updates
  const handleSubjectChange = useCallback((newSubject: string) => {
    console.log(`🔍 COMPONENT: Changing subject to: ${newSubject}`);

    // Immediately update the selected subject (optimistic update)
    setSelectedSubject(newSubject);

    // Clear previous data but don't set loading states - let useEffects handle that
    // Keep curriculum/analytics visible with opacity during transition
    setExpandedUnits(new Set());
    setExpandedSkills(new Set());
    setError(null);

    // Clear content package states
    setLoadingSubskills(new Set());
    setPackageErrors(new Map());

    // The useEffects will trigger based on selectedSubject change
  }, []);

  // Expand all items
  const expandAll = () => {
    if (!curriculumData) return;
    
    const allUnits = new Set(curriculumData.curriculum.map(unit => unit.id));
    const allSkills = new Set(curriculumData.curriculum.flatMap(unit => 
      unit.skills.map(skill => skill.id)
    ));
    
    setExpandedUnits(allUnits);
    setExpandedSkills(allSkills);
  };

  // Collapse all items
  const collapseAll = () => {
    setExpandedUnits(new Set());
    setExpandedSkills(new Set());
  };

  // Retry data fetch
  const retryDataFetch = () => {
    console.log('🔍 COMPONENT: Retrying data fetch...');
    setError(null);
    if (selectedSubject) {
      fetchCurriculumData(selectedSubject);
    } else {
      fetchAvailableSubjects();
    }
  };

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="flex items-center justify-center space-x-2 p-6">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span>Initializing authentication...</span>
      </div>
    );
  }

  // Show login prompt if user is not authenticated
  if (!user) {
    return (
      <div className="text-center space-y-4 p-6">
        <LogIn className="w-16 h-16 mx-auto text-gray-400" />
        <h2 className="text-xl font-bold">Authentication Required</h2>
        <p className="text-gray-600">
          Please log in to access your curriculum and track your progress.
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
    );
  }

  // Show error if user profile is missing critical data
  if (user && !userProfile?.student_id) {
    return (
      <div className="text-center space-y-4 p-6">
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
    );
  }

  // Initial loading state (only when subjects are loading for the first time)
  if (loadingSubjects && availableSubjects.length === 0) {
    return (
      <div className="space-y-6">
        {/* User Info Header - Keep visible during loading */}
        {user && (
          <div className="p-4 bg-blue-50 rounded-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <span className="font-medium">
                  Welcome, {userProfile?.displayName || user.email}
                </span>
                {userProfile?.grade_level && (
                  <span className="text-sm text-gray-600">
                    (Grade {userProfile.grade_level})
                  </span>
                )}
              </div>
              {userProfile?.total_points && (
                <div className="text-sm text-blue-600 font-medium">
                  Points: {userProfile.total_points}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        <div className="flex items-center justify-center space-x-2 p-6">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span>Loading curriculum data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center space-y-4 p-6">
        <AlertCircle className="w-16 h-16 mx-auto text-red-500" />
        <h2 className="text-xl font-bold text-red-600">Error Loading Data</h2>
        <p className="text-gray-600">{error}</p>
        
        {/* Subject selection if we have subjects but curriculum failed */}
        {availableSubjects.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Try selecting a different subject:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {availableSubjects.map(subject => (
                <Button
                  key={subject}
                  variant={subject === selectedSubject ? "default" : "outline"}
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
        
        <Button onClick={retryDataFetch}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  // Show loading state if curriculum is being fetched and we don't have data yet
  if (loadingCurriculum && !curriculumData) {
    return (
      <div className="space-y-6">
        {/* User Info Header - Keep visible during loading */}
        {user && (
          <div className="p-4 bg-blue-50 rounded-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-600" />
                <span className="font-medium">
                  Welcome, {userProfile?.displayName || user.email}
                </span>
                {userProfile?.grade_level && (
                  <span className="text-sm text-gray-600">
                    (Grade {userProfile.grade_level})
                  </span>
                )}
              </div>
              {userProfile?.total_points && (
                <div className="text-sm text-blue-600 font-medium">
                  Points: {userProfile.total_points}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subject Selection - Show if available */}
        {availableSubjects.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Subject:</h3>
            <div className="flex flex-wrap gap-2">
              {availableSubjects.map(subject => (
                <Button
                  key={subject}
                  variant={subject === selectedSubject ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSubjectChange(subject)}
                  disabled={loadingCurriculum}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {subject}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        <div className="flex items-center justify-center space-x-2 p-6">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span>Loading {selectedSubject || 'curriculum'} data...</span>
        </div>
      </div>
    );
  }

  // Only show "No Curriculum Data" if we're NOT loading and there's no data
  if (!curriculumData && !loadingCurriculum) {
    return (
      <div className="text-center space-y-4 p-6">
        <AlertCircle className="w-16 h-16 mx-auto text-gray-400" />
        <h2 className="text-xl font-bold">No Curriculum Data</h2>
        <p className="text-gray-600">
          No curriculum data available for {selectedSubject || 'the selected subject'}.
        </p>

        {/* Subject selection */}
        {availableSubjects.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Available subjects:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {availableSubjects.map(subject => (
                <Button
                  key={subject}
                  variant={subject === selectedSubject ? "default" : "outline"}
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
    );
  }

  // At this point, curriculumData is guaranteed to exist (all early returns handled above)
  if (!curriculumData) {
    // This should never happen, but TypeScript needs the check
    return null;
  }

  // Calculate percentages based on memoized stats
  const progressPercentage = stats.total > 0 ? (stats.attempted / stats.total) * 100 : 0;
  const masteryPercentage = stats.total > 0 ? (stats.mastered / stats.total) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* User Info Header */}
      <div className="p-4 bg-blue-50 rounded-lg transition-all duration-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-600" />
            <span className="font-medium">
              Welcome, {userProfile?.displayName || user.email}
            </span>
            {userProfile?.grade_level && (
              <span className="text-sm text-gray-600">
                (Grade {userProfile.grade_level})
              </span>
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
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Subject:</h3>
          <div className="flex flex-wrap gap-2">
            {loadingSubjects ? (
              <>
                <SkeletonSubjectButton />
                <SkeletonSubjectButton />
                <SkeletonSubjectButton />
              </>
            ) : (
              availableSubjects.map(subject => (
                <Button
                  key={subject}
                  variant={subject === selectedSubject ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSubjectChange(subject)}
                  disabled={loadingCurriculum}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  {subject}
                </Button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Progress Overview */}
      {loadingCurriculum && !curriculumData ? (
        <SkeletonProgressCard />
      ) : (
        <div className="p-4 bg-gray-50 rounded-lg transition-opacity duration-300" style={{ opacity: loadingAnalytics ? 0.6 : 1 }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Progress Overview</h3>
            {loadingAnalytics && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Subskills</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.attempted}</div>
              <div className="text-sm text-gray-600">Attempted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
              <div className="text-sm text-gray-600">Mastered</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <span>Mastery</span>
              <span>{masteryPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 rounded-full h-2 transition-all duration-300"
                style={{ width: `${masteryPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* View Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{selectedSubject} Curriculum</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={expandAll}>
            <Layers className="w-4 h-4 mr-2" />
            Expand All
          </Button>
          <Button size="sm" variant="outline" onClick={collapseAll}>
            <TreePine className="w-4 h-4 mr-2" />
            Collapse All
          </Button>
        </div>
      </div>

      {/* Curriculum Tree */}
      {loadingCurriculum && !curriculumData ? (
        <SkeletonCurriculumTree />
      ) : (
        <div className="space-y-4 transition-opacity duration-300" style={{ opacity: loadingCurriculum ? 0.6 : 1 }}>
          {curriculumData.curriculum.map(unit => {
          const unitAnalytics = getUnitAnalytics(unit.id);

          return (
            <div key={unit.id} className="border rounded-lg transition-all duration-200 hover:shadow-md">
              {/* Unit Header */}
              <div
                className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => toggleUnit(unit.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedUnits.has(unit.id) ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-lg">{unit.title}</span>
                  <span className="text-sm text-gray-500">({unit.skills.length} skills)</span>
                </div>
              </div>

              {/* Unit Analytics Summary - Always visible */}
              {unitAnalytics && unitAnalytics.attempt_count > 0 && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                  <div className="flex items-center justify-around text-center">
                    <div>
                      <div className="text-xs text-gray-600">Attempts</div>
                      <div className="text-sm font-bold text-blue-600">{unitAnalytics.attempt_count}</div>
                    </div>
                    <div className="h-8 w-px bg-blue-200" />
                    <div>
                      <div className="text-xs text-gray-600">Mastery</div>
                      <div className={`text-sm font-bold ${getCompetencyColor(unitAnalytics.mastery)}`}>
                        {(unitAnalytics.mastery * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="h-8 w-px bg-blue-200" />
                    <div>
                      <div className="text-xs text-gray-600">Completion</div>
                      <div className="text-sm font-bold text-purple-600">
                        {unitAnalytics.completion.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Unit Content */}
              {expandedUnits.has(unit.id) && (
                <div className="p-4 border-t">
                  <div className="space-y-3">
                  {unit.skills.map(skill => {
                    const skillAnalytics = getSkillAnalytics(skill.id);

                    return (
                      <div key={skill.id} className="ml-4 border-l-2 border-gray-200 pl-4 transition-all duration-150">
                        {/* Skill Header */}
                        <div
                          className="p-3 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 transition-all duration-150"
                          onClick={() => toggleSkill(skill.id)}
                        >
                          <div className="flex items-center gap-2">
                            {expandedSkills.has(skill.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            <Target className="w-4 h-4 text-green-600" />
                            <span className="font-medium">{skill.description}</span>
                            <span className="text-sm text-gray-600">
                              ({skill.subskills.length} subskills)
                            </span>
                            {skillAnalytics && skillAnalytics.attempt_count > 0 && (
                              <span className={`text-xs font-medium ${getCompetencyColor(skillAnalytics.mastery)}`}>
                                {(skillAnalytics.mastery * 100).toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Skill Analytics Summary - Always visible */}
                        {skillAnalytics && skillAnalytics.attempt_count > 0 && (
                          <div className="mt-2 px-3 py-1.5 bg-green-50 rounded border border-green-100">
                            <div className="flex items-center justify-around text-center">
                              <div>
                                <div className="text-xs text-gray-600">Attempts</div>
                                <div className="text-xs font-bold text-blue-600">{skillAnalytics.attempt_count}</div>
                              </div>
                              <div className="h-6 w-px bg-green-200" />
                              <div>
                                <div className="text-xs text-gray-600">Mastery</div>
                                <div className={`text-xs font-bold ${getCompetencyColor(skillAnalytics.mastery)}`}>
                                  {(skillAnalytics.mastery * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div className="h-6 w-px bg-green-200" />
                              <div>
                                <div className="text-xs text-gray-600">Completion</div>
                                <div className="text-xs font-bold text-purple-600">
                                  {skillAnalytics.completion.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Subskills */}
                        {expandedSkills.has(skill.id) && (
                        <div className="mt-3 ml-6 space-y-2">
                          {skill.subskills.map(subskill => {
                            const subskillAnalytics = getSubskillAnalytics(subskill.id);
                            const isLoading = loadingSubskills.has(subskill.id);
                            const error = packageErrors.get(subskill.id);

                            return (
                              <div
                                key={subskill.id}
                                className="p-3 bg-white border rounded hover:bg-gray-50 transition-all duration-150 hover:shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    {getCompetencyIcon(
                                      subskillAnalytics?.mastery,
                                      subskillAnalytics?.attempt_count || 0
                                    )}
                                    <span className="font-medium text-sm">{subskill.description}</span>
                                    {subskillAnalytics && subskillAnalytics.attempt_count > 0 && (
                                      <>
                                        <span className={`text-xs font-medium ${getCompetencyColor(subskillAnalytics.proficiency)}`}>
                                          {(subskillAnalytics.proficiency * 100).toFixed(1)}%
                                        </span>
                                        {subskillAnalytics.readiness_status && (
                                          <span className={`text-xs px-2 py-0.5 rounded ${
                                            subskillAnalytics.readiness_status === 'Ready'
                                              ? 'bg-green-100 text-green-700'
                                              : 'bg-gray-100 text-gray-600'
                                          }`}>
                                            {subskillAnalytics.readiness_status}
                                          </span>
                                        )}
                                        {subskillAnalytics.priority_level && subskillAnalytics.priority_level !== 'Not Started' && (
                                          <span className={`text-xs px-2 py-0.5 rounded ${
                                            subskillAnalytics.priority_level === 'Mastered'
                                              ? 'bg-blue-100 text-blue-700'
                                              : subskillAnalytics.priority_level === 'High Priority'
                                              ? 'bg-red-100 text-red-700'
                                              : 'bg-yellow-100 text-yellow-700'
                                          }`}>
                                            {subskillAnalytics.priority_level}
                                          </span>
                                        )}
                                      </>
                                    )}
                                    <span className="text-xs text-gray-500">
                                      Difficulty: {subskill.difficulty_range.start}-{subskill.difficulty_range.end}
                                    </span>
                                  </div>

                                  {/* Dual-Action Buttons: Learn & Practice */}
                                  <div className="flex gap-2 shrink-0">
                                    {/* Learn Button - Always on the left */}
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartLearning(subskill.id);
                                      }}
                                      disabled={isLoading}
                                      variant={subskillAnalytics && subskillAnalytics.mastery > 0.6 ? "outline" : undefined}
                                      className={subskillAnalytics && subskillAnalytics.mastery > 0.6 ? "" : "bg-blue-600 text-white hover:bg-blue-700"}
                                    >
                                      {isLoading ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          Generating...
                                        </>
                                      ) : (
                                        <>
                                          {(!subskillAnalytics || subskillAnalytics.mastery <= 0.6) && (
                                            <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                                          )}
                                          <Play className="w-3 h-3 mr-1" />
                                          Learn
                                        </>
                                      )}
                                    </Button>

                                    {/* Practice Button - Always on the right */}
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePractice(subskill, skill, unit);
                                      }}
                                      variant={subskillAnalytics && subskillAnalytics.mastery > 0.6 ? undefined : "outline"}
                                      className={subskillAnalytics && subskillAnalytics.mastery > 0.6 ? "bg-blue-600 text-white hover:bg-blue-700" : ""}
                                    >
                                      {subskillAnalytics && subskillAnalytics.mastery > 0.6 && (
                                        <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                                      )}
                                      <Target className="w-3 h-3 mr-1" />
                                      Practice
                                    </Button>
                                  </div>
                                </div>

                                {/* Analytics Info Row */}
                                {subskillAnalytics && subskillAnalytics.attempt_count > 0 && (
                                  <div className="text-xs text-gray-500 mt-2">
                                    {subskillAnalytics.attempt_count} attempts •
                                    Mastery: {(subskillAnalytics.mastery * 100).toFixed(1)}% •
                                    Avg Score: {(subskillAnalytics.avg_score * 100).toFixed(1)}%
                                  </div>
                                )}

                                {/* Error Display */}
                                {error && (
                                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {error}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="ml-auto h-auto p-0 text-red-600 hover:text-red-800"
                                      onClick={() => handleStartLearning(subskill.id)}
                                    >
                                      Try Again
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          );
        })}
        </div>
      )}
    </div>
  );
};

export default CurriculumExplorer;