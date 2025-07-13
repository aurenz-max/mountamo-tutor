// components/curriculum/CurriculumExplorer.tsx
'use client';

import React, { useState, useEffect } from 'react';
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
  LogIn
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, AuthApiError } from '@/lib/authApiClient';
import Link from 'next/link';

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

const CurriculumExplorer = () => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [curriculumData, setCurriculumData] = useState<CurriculumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Expanded states for tree navigation
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());
  
  // Competency data
  const [competencyScores, setCompetencyScores] = useState<Map<string, CompetencyData>>(new Map());

  // Fetch available subjects
  const fetchAvailableSubjects = async () => {
    console.log('🔍 COMPONENT: Fetching available subjects...');
    
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  // Fetch curriculum data for selected subject
  const fetchCurriculumData = async (subject: string) => {
    console.log(`🔍 COMPONENT: Fetching curriculum for subject: ${subject}...`);
    
    if (!subject) {
      console.log('🔍 COMPONENT: No subject provided, skipping curriculum fetch');
      return;
    }

    try {
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
    }
  };

  // Fetch competency for a skill or subskill
  const fetchCompetencyForItem = async (skillId: string, subskillId?: string) => {
    if (!userProfile?.student_id || !selectedSubject) {
      console.warn('Cannot fetch competency: missing student_id or subject');
      return;
    }

    try {
      let competency;
      if (subskillId) {
        competency = await authApi.getSubskillCompetency({
          subject: selectedSubject,
          skill: skillId,
          subskill: subskillId,
        });
      } else {
        competency = await authApi.getSkillCompetency({
          subject: selectedSubject,
          skill: skillId,
        });
      }

      if (competency) {
        const key = subskillId ? subskillId : skillId;
        setCompetencyScores(prevScores => new Map(prevScores).set(key, competency));
      }
    } catch (error) {
      console.error(`Error fetching competency for ${subskillId || skillId}:`, error);
    }
  };

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
        // Fetch competency data when expanding
        fetchCompetencyForItem(skillId);
      }
      return newSet;
    });
  };

  // Load competency for subskill
  const loadSubskillCompetency = (skillId: string, subskillId: string) => {
    fetchCompetencyForItem(skillId, subskillId);
  };

  // Calculate progress statistics
  const getProgressStats = () => {
    if (!curriculumData) return { total: 0, attempted: 0, mastered: 0 };
    
    let total = 0;
    let attempted = 0;
    let mastered = 0;
    
    curriculumData.curriculum.forEach(unit => {
      unit.skills.forEach(skill => {
        skill.subskills.forEach(subskill => {
          total++;
          const competency = competencyScores.get(subskill.id);
          if (competency && competency.total_attempts > 0) {
            attempted++;
            if (competency.current_score && competency.current_score > 0.8) {
              mastered++;
            }
          }
        });
      });
    });
    
    return { total, attempted, mastered };
  };

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
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedSubject && !loading) {
      fetchCurriculumData(selectedSubject);
    }
  }, [selectedSubject]);

  // Handle subject change
  const handleSubjectChange = (newSubject: string) => {
    console.log(`🔍 COMPONENT: Changing subject to: ${newSubject}`);
    setSelectedSubject(newSubject);
    setCurriculumData(null);
    setCompetencyScores(new Map());
    setExpandedUnits(new Set());
    setExpandedSkills(new Set());
    setError(null);
  };

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
    setLoading(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center space-x-2 p-6">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span>Loading curriculum data...</span>
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

  if (!curriculumData) {
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

  const stats = getProgressStats();
  const progressPercentage = stats.total > 0 ? (stats.attempted / stats.total) * 100 : 0;
  const masteryPercentage = stats.total > 0 ? (stats.mastered / stats.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* User Info Header */}
      <div className="p-4 bg-blue-50 rounded-lg">
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

      {/* Progress Overview */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-3">Progress Overview</h3>
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
      <div className="space-y-4">
        {curriculumData.curriculum.map(unit => (
          <div key={unit.id} className="border rounded-lg">
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

            {/* Unit Content */}
            {expandedUnits.has(unit.id) && (
              <div className="p-4 border-t">
                <div className="space-y-3">
                  {unit.skills.map(skill => (
                    <div key={skill.id} className="ml-4 border-l-2 border-gray-200 pl-4">
                      {/* Skill Header */}
                      <div
                        className="p-3 bg-blue-50 rounded cursor-pointer hover:bg-blue-100 transition-colors"
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
                          {competencyScores.get(skill.id) && (
                            <span className={`text-xs font-medium ${getCompetencyColor(competencyScores.get(skill.id)?.current_score)}`}>
                              {((competencyScores.get(skill.id)?.current_score || 0) * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Subskills */}
                      {expandedSkills.has(skill.id) && (
                        <div className="mt-3 ml-6 space-y-2">
                          {skill.subskills.map(subskill => {
                            const competency = competencyScores.get(subskill.id);
                            return (
                              <div
                                key={subskill.id}
                                className="p-3 bg-white border rounded hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => loadSubskillCompetency(skill.id, subskill.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {getCompetencyIcon(competency?.current_score, competency?.total_attempts || 0)}
                                  <span className="font-medium text-sm">{subskill.description}</span>
                                  {competency && (
                                    <span className={`text-xs font-medium ${getCompetencyColor(competency.current_score)}`}>
                                      {((competency.current_score || 0) * 100).toFixed(0)}%
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500">
                                    Difficulty: {subskill.difficulty_range.start}-{subskill.difficulty_range.end}
                                  </span>
                                </div>
                                {competency && competency.total_attempts > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {competency.total_attempts} attempts • Credibility: {(competency.credibility * 100).toFixed(0)}%
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CurriculumExplorer;