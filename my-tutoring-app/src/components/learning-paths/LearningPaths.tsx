'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, CheckCircle, LogIn, User, AlertCircle, RefreshCw, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, AuthApiError } from '@/lib/authApiClient';
import Link from 'next/link';

interface CurriculumData {
    subject: string;
    curriculum: Array<{
        id: string;
        title: string;
        skills: Skill[];
    }>;
}

interface Skill {
    id: string;
    description: string;
    subskills: SubSkill[];
}

interface SubSkill {
    id: string;
    description: string;
    difficulty_range: {
        start: number;
        end: number;
        target: number;
    };
}

interface CompetencyData {
    current_score?: number;
    credibility: number;
    total_attempts: number;
}

const DecisionPathUI = () => {
    const { user, userProfile, loading: authLoading } = useAuth();
    const [completedChoices, setCompletedChoices] = useState(new Set());
    const [unlockedPaths, setUnlockedPaths] = useState<string[]>([]);
    const [curriculumData, setCurriculumData] = useState<CurriculumData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentSkillId, setCurrentSkillId] = useState<string | null>(null);
    const [competencyScores, setCompetencyScores] = useState<Map<string, CompetencyData>>(new Map());
    const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
    
    // New state for dynamic subject handling
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [subjectsLoading, setSubjectsLoading] = useState(true);

    const fetchAvailableSubjects = async () => {
        console.log('🔍 COMPONENT: Fetching available subjects with authApi...');
        
        try {
            setSubjectsLoading(true);
            const subjects = await authApi.getSubjects();
            
            console.log('✅ COMPONENT: Subjects received:', subjects);
            setAvailableSubjects(subjects);
            
            // Set the first available subject as default
            if (subjects && subjects.length > 0) {
                const firstSubject = subjects[0];
                setSelectedSubject(firstSubject);
                console.log(`✅ COMPONENT: Selected default subject: ${firstSubject}`);
                
                // Set initial unlocked path based on first subject
                if (firstSubject === 'Mathematics') {
                    setUnlockedPaths(['COUNT001-01']);
                } else {
                    // For other subjects, we'll set this after getting curriculum
                    setUnlockedPaths([]);
                }
            } else {
                console.warn('⚠️ COMPONENT: No subjects available');
                setError('No curriculum subjects are available');
            }
            
        } catch (error) {
            console.error('❌ COMPONENT: Failed to fetch subjects:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch subjects';
            setError(errorMessage);
        } finally {
            setSubjectsLoading(false);
        }
    };

    const fetchCurriculumData = async (subject: string) => {
        console.log(`🔍 COMPONENT: Fetching curriculum for subject: ${subject} with authApi...`);
        
        if (!subject) {
            console.log('🔍 COMPONENT: No subject provided, skipping curriculum fetch');
            return;
        }

        try {
            setError(null);
            const curriculum = await authApi.getSubjectCurriculum(subject);
            
            console.log('✅ COMPONENT: Curriculum received:', curriculum);
            setCurriculumData(curriculum);
            
            // Set initial unlocked paths based on curriculum structure
            if (curriculum?.curriculum && curriculum.curriculum.length > 0) {
                const firstUnit = curriculum.curriculum[0];
                if (firstUnit.skills && firstUnit.skills.length > 0) {
                    const firstSkillId = firstUnit.skills[0].id;
                    setUnlockedPaths([firstSkillId]);
                    console.log(`✅ COMPONENT: Set initial unlocked path: ${firstSkillId}`);
                }
            }
            
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

    const fetchLearningPaths = async () => {
        console.log('🔍 COMPONENT: Fetching learning paths with authApi...');
        
        try {
            const pathsData = await authApi.getLearningPaths();
            console.log('✅ COMPONENT: Learning paths received:', pathsData);
            // Store learning paths data if needed
        } catch (error) {
            console.error('❌ COMPONENT: Failed to fetch learning paths:', error);
            // Don't set error here as this is optional data
        }
    };

    const fetchCompetencyForSkill = async (skillId: string, subskillId?: string) => {
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

    // Main data fetching effect
    useEffect(() => {
        const fetchData = async () => {
            if (authLoading) {
                console.log('🔍 COMPONENT: Auth still loading, waiting...');
                return;
            }

            if (!user) {
                console.log('🔍 COMPONENT: No user, stopping data fetch');
                setLoading(false);
                return;
            }

            console.log('🔍 COMPONENT: Starting data fetch sequence with authApi...');
            setLoading(true);
            setError(null);

            // Step 1: Get available subjects
            await fetchAvailableSubjects();
        };

        fetchData();
    }, [user, authLoading]);

    // Effect to fetch curriculum when subject changes
    useEffect(() => {
        if (selectedSubject && !subjectsLoading) {
            console.log(`🔍 COMPONENT: Subject changed to: ${selectedSubject}`);
            fetchCurriculumData(selectedSubject);
            fetchLearningPaths();
        }
    }, [selectedSubject, subjectsLoading]);

    // Effect to set loading state
    useEffect(() => {
        if (!subjectsLoading && selectedSubject) {
            setLoading(false);
        }
    }, [subjectsLoading, selectedSubject, curriculumData]);

    const handleChoice = async (choice: string) => {
        if (!user) {
            console.warn('Cannot make choice: user not authenticated');
            return;
        }

        setCompletedChoices(prev => new Set([...prev, choice]));
        setCurrentSkillId(choice);

        if (curriculumData) {
            const selectedSkill = curriculumData.curriculum.flatMap(unit => unit.skills).find(skill => skill.id === choice);
            if (selectedSkill && selectedSkill.subskills) {
                const subskillIds = selectedSkill.subskills.map(subskill => subskill.id);
                setUnlockedPaths(subskillIds);
            } else {
                setUnlockedPaths([]);
            }
        }
    };

    const handleExpandSkill = async (skillId: string) => {
        if (!user) {
            console.warn('Cannot expand skill: user not authenticated');
            return;
        }

        setExpandedSkillId(prevExpandedSkillId => {
            const isExpanding = prevExpandedSkillId !== skillId;
            if (isExpanding && curriculumData) {
                const selectedSkill = curriculumData.curriculum
                    .flatMap(unit => unit.skills)
                    .find(skill => skill.id === skillId);
                    
                if (selectedSkill) {
                    // Fetch skill level competency first
                    fetchCompetencyForSkill(skillId);
                    
                    // Then fetch all subskill competencies
                    if (selectedSkill.subskills) {
                        selectedSkill.subskills.forEach(subskill => 
                            fetchCompetencyForSkill(skillId, subskill.id)
                        );
                    }
                }
            }
            return isExpanding ? skillId : null;
        });
    };

    const resetProgress = () => {
        setCompletedChoices(new Set());
        setCompetencyScores(new Map());
        setExpandedSkillId(null);
        
        // Reset to first skill of current subject
        if (curriculumData?.curriculum && curriculumData.curriculum.length > 0) {
            const firstUnit = curriculumData.curriculum[0];
            if (firstUnit.skills && firstUnit.skills.length > 0) {
                setUnlockedPaths([firstUnit.skills[0].id]);
            }
        }
        setCurrentSkillId(null);
    };

    const handleSubjectChange = (newSubject: string) => {
        console.log(`🔍 COMPONENT: Changing subject to: ${newSubject}`);
        setSelectedSubject(newSubject);
        setCurriculumData(null);
        resetProgress();
        setError(null);
    };

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

    const getAvailableChoices = () => {
        if (!curriculumData) return [];

        return unlockedPaths.map(skillId => {
            const skill = curriculumData.curriculum.flatMap(unit => unit.skills).find(s => s.id === skillId);
            return {
                path: 'skills',
                choice: skillId,
                description: skill?.description,
                skill_description: skill?.description,
                subject: curriculumData.subject,
                subskills: skill?.subskills
            };
        }).filter(choice => !completedChoices.has(choice.choice));
    };

    // Debug function to test auth API
    const debugAuthApi = async () => {
        console.log('🔍 DEBUG: Testing AuthAPI...');
        try {
            // Test if user is authenticated
            console.log('🔍 DEBUG: Is authenticated:', authApi.isAuthenticated());
            console.log('🔍 DEBUG: Current user:', authApi.getCurrentUser()?.email);
            
            // Test subjects endpoint
            const subjects = await authApi.getSubjects();
            console.log('✅ DEBUG: Subjects test successful:', subjects);
            
            // Test user profile
            const profile = await authApi.getUserProfile();
            console.log('✅ DEBUG: Profile test successful:', profile);
            
        } catch (error) {
            console.error('❌ DEBUG: AuthAPI test failed:', error);
        }
    };

    // Show loading while auth is initializing
    if (authLoading) {
        return (
            <Card className="w-full max-w-4xl mx-auto">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span>Initializing authentication...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show login prompt if user is not authenticated
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

    // Show error if user profile is missing critical data
    if (user && !userProfile?.student_id) {
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

    if (loading || subjectsLoading) {
        return (
            <Card className="w-full max-w-4xl mx-auto">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        <span>
                            {subjectsLoading ? 'Loading available subjects...' : 'Loading curriculum data...'}
                        </span>
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
                        
                        <div className="flex justify-center space-x-2">
                            <Button onClick={retryDataFetch}>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Try Again
                            </Button>
                            <Button variant="outline" onClick={debugAuthApi}>
                                🐛 Debug API
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!curriculumData) {
        return (
            <Card className="w-full max-w-4xl mx-auto">
                <CardContent className="p-6">
                    <div className="text-center space-y-4">
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
                        
                        <Button onClick={debugAuthApi} variant="outline">
                            🐛 Debug API
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const allSkillsCount = curriculumData.curriculum.flatMap(unit => unit.skills).length;
    const availableChoices = getAvailableChoices();

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
                                <span className="text-sm text-gray-600">
                                    (Grade {userProfile.grade_level})
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-4">
                            {userProfile?.total_points && (
                                <div className="text-sm text-blue-600 font-medium">
                                    Points: {userProfile.total_points}
                                </div>
                            )}
                            <Button variant="outline" size="sm" onClick={debugAuthApi}>
                                🐛 Test API
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Subject Selection */}
                {availableSubjects.length > 1 && (
                    <div className="mb-6 p-3 bg-gray-50 rounded-lg">
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

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">
                            {selectedSubject} Learning Path
                        </h2>
                        <div className="flex items-center gap-4">
                            <span className="text-sm">
                                Progress: {completedChoices.size}/{allSkillsCount} Skills
                            </span>
                            <Button
                                variant="outline"
                                onClick={resetProgress}
                                className="flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </Button>
                        </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                            style={{ width: `${(completedChoices.size / allSkillsCount) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    {completedChoices.size < allSkillsCount ? (
                        <>
                            <div className="grid grid-cols-1 gap-6">
                                {availableChoices.map((choiceItem) => (
                                    <Card key={choiceItem.choice} className={`relative text-left border rounded-lg p-4 ${
                                      expandedSkillId === choiceItem.choice ? 'bg-blue-50' : 'hover:bg-blue-50 cursor-pointer'
                                  }`} onClick={() => handleExpandSkill(choiceItem.choice)}>
                                      <CardHeader className="p-0 mb-2">
                                          <CardTitle className="text-lg font-semibold">{choiceItem.choice}</CardTitle>
                                      </CardHeader>
                                      <CardContent className="p-0">
                                          <p className="text-sm text-gray-700 mb-4">{choiceItem.description}</p>
                                          {competencyScores.get(choiceItem.choice)?.current_score !== undefined && (
                                              <span className="text-xs text-blue-700 mt-1">
                                                  Competency: {(competencyScores.get(choiceItem.choice)?.current_score || 0) * 100}%
                                              </span>
                                          )}
                                          
                                          {expandedSkillId === choiceItem.choice && choiceItem.subskills && (
                                              <div className="space-y-4 mt-4">
                                                  <h4 className="font-semibold">Subskills:</h4>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                      {choiceItem.subskills.map((subskill) => {
                                                          const competencyData = competencyScores.get(subskill.id);
                                                          return (
                                                              <Card key={subskill.id} className="p-4 relative flex flex-col justify-between h-64">
                                                                  <CardContent className="p-0">
                                                                      {completedChoices.has(subskill.id) && (
                                                                          <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-green-500" />
                                                                      )}
                                                                      <div className="flex flex-col items-start gap-1">
                                                                          <span className="font-semibold">{subskill.id}</span>
                                                                          <span className="text-sm text-gray-700">{subskill.description}</span>
                                                                          {competencyData?.current_score !== undefined && (
                                                                              <span className="text-xs text-blue-700 mt-1">
                                                                                  Competency: {(competencyData.current_score * 100).toFixed(0)}%
                                                                              </span>
                                                                          )}
                                                                      </div>
                                                                  </CardContent>
                                                                  <CardContent className="flex justify-around p-0 border-t mt-4 pt-2">
                                                                      <Button variant="secondary" size="sm">Teaching</Button>
                                                                       <Button variant="secondary" size="sm">Practice</Button>
                                                              </CardContent>
                                                              </Card>
                                                          );
                                                      })}
                                                  </div>
                                              </div>
                                          )}
                                          {expandedSkillId !== choiceItem.choice && (
                                              <div className="mt-4 text-blue-600 text-sm">Click to see subskills</div>
                                          )}
                                      </CardContent>
                                  </Card>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-6 bg-green-50 rounded-lg">
                            <h3 className="text-xl font-bold text-green-600 mb-4">
                                All Skills Complete!
                            </h3>
                            <div className="flex flex-wrap justify-center gap-2">
                                {Array.from(completedChoices).map((choice, index) => (
                                    <span key={index} className="px-3 py-1 bg-green-100 rounded">
                                        {choice}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t">
                    <h4 className="font-semibold mb-2">Completed Skills:</h4>
                    <div className="flex flex-wrap gap-2">
                        {Array.from(completedChoices).map((choice, index) => (
                            <span key={index} className="px-2 py-1 bg-blue-100 rounded text-sm">
                                {choice}
                            </span>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default DecisionPathUI;