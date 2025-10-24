'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, CheckCircle, LogIn, User, AlertCircle, RefreshCw, BookOpen, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, AuthApiError } from '@/lib/authApiClient';
import Link from 'next/link';
import type {
  VisualizationResponse,
  Recommendation,
  SkillDetailsResponse
} from '@/types/learning-paths';

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

    // New state for prerequisite graph system
    const [visualizationData, setVisualizationData] = useState<VisualizationResponse | null>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [expandedSkillDetails, setExpandedSkillDetails] = useState<SkillDetailsResponse | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

    // Subject handling
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [subjectsLoading, setSubjectsLoading] = useState(true);

    // Legacy state (kept for backward compatibility - used by legacy code paths)
    const [curriculumData, setCurriculumData] = useState<CurriculumData | null>(null);

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

    const fetchVisualizationData = async (subject: string) => {
        console.log(`🔍 COMPONENT: Fetching visualization data for subject: ${subject}...`);

        if (!subject || !userProfile?.student_id) {
            console.log('🔍 COMPONENT: Missing subject or student_id, skipping fetch');
            return;
        }

        try {
            setError(null);
            setLoading(true);

            // Fetch visualization graph with student progress and recommendations in parallel
            const [vizData, recsData] = await Promise.all([
                authApi.getLearningGraphVisualization(subject, userProfile.student_id) as Promise<VisualizationResponse>,
                authApi.getLearningRecommendations(userProfile.student_id, subject, 5) as Promise<{ recommendations: Recommendation[]; count: number }>
            ]);

            console.log('✅ COMPONENT: Visualization data received:', vizData);
            console.log('✅ COMPONENT: Recommendations received:', recsData);

            setVisualizationData(vizData);
            setRecommendations(recsData.recommendations || []);

            // Also populate legacy curriculumData for backward compatibility
            if (vizData?.skills) {
                const legacyCurriculum: CurriculumData = {
                    subject: subject,
                    curriculum: [{
                        id: 'default-unit',
                        title: `${subject} Skills`,
                        skills: vizData.skills.map((skill) => ({
                            id: skill.skill_id,
                            description: skill.title,
                            subskills: skill.subskills.map((subskill) => ({
                                id: subskill.subskill_id,
                                description: subskill.description,
                                difficulty_range: {
                                    start: subskill.difficulty_start || 1.0,
                                    end: subskill.difficulty_end || 2.0,
                                    target: ((subskill.difficulty_start || 1.0) + (subskill.difficulty_end || 2.0)) / 2
                                }
                            }))
                        }))
                    }]
                };
                setCurriculumData(legacyCurriculum);
            }

        } catch (error) {
            console.error(`❌ COMPONENT: Failed to fetch visualization data for ${subject}:`, error);

            let errorMessage = `Failed to fetch learning path data for ${subject}`;

            if (error && typeof error === 'object' && 'status' in error) {
                const apiError = error as AuthApiError;
                if (apiError.status === 404) {
                    errorMessage = `No learning path data available for ${subject}. Please try a different subject.`;
                } else {
                    errorMessage = apiError.message || errorMessage;
                }
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
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

    // Effect to fetch visualization data when subject changes
    useEffect(() => {
        if (selectedSubject && !subjectsLoading) {
            console.log(`🔍 COMPONENT: Subject changed to: ${selectedSubject}`);
            fetchVisualizationData(selectedSubject);
            fetchLearningPaths();
        }
    }, [selectedSubject, subjectsLoading, userProfile?.student_id]);

    // Effect to set loading state
    useEffect(() => {
        if (!subjectsLoading && selectedSubject) {
            setLoading(false);
        }
    }, [subjectsLoading, selectedSubject, curriculumData]);


    const handleExpandSkill = async (skillId: string) => {
        if (!userProfile?.student_id) {
            console.warn('Cannot expand skill: missing student_id');
            return;
        }

        // Toggle expansion
        if (expandedSkillId === skillId) {
            setExpandedSkillId(null);
            setExpandedSkillDetails(null);
            return;
        }

        try {
            // Fetch detailed skill information
            const details = await authApi.getSkillDetails(
                skillId,
                userProfile.student_id
            ) as SkillDetailsResponse;

            console.log('✅ COMPONENT: Skill details received:', details);
            setExpandedSkillDetails(details);
            setExpandedSkillId(skillId);

        } catch (error) {
            console.error(`❌ COMPONENT: Failed to fetch skill details for ${skillId}:`, error);
        }
    };

    const resetProgress = () => {
        setExpandedSkillId(null);
        setExpandedSkillDetails(null);

        // Refetch visualization data to get latest state
        if (selectedSubject) {
            fetchVisualizationData(selectedSubject);
        }
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
            fetchVisualizationData(selectedSubject);
        } else {
            fetchAvailableSubjects();
        }
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

    // Calculate progress based on visualization data
    const allSkillsCount = visualizationData?.skills.length || 0;
    const totalSubskills = visualizationData?.skills.reduce((sum, skill) => sum + skill.subskills.length, 0) || 0;
    const masteredSubskills = visualizationData?.skills
        .flatMap(skill => skill.subskills)
        .filter(subskill => (subskill.student_data?.proficiency || 0) >= 0.8).length || 0;

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

                {/* Recommendations Section */}
                {recommendations.length > 0 && (
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                            🎯 Recommended for You
                        </h3>
                        <div className="space-y-2">
                            {recommendations.map((rec) => (
                                <div key={rec.entity_id} className="p-3 bg-white rounded-lg border border-yellow-100 hover:border-yellow-300 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-gray-900">{rec.description}</span>
                                                <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                                                    rec.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {rec.priority === 'high' ? '🔥 High Priority' : '📈 Medium Priority'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 mb-1">
                                                Part of: <span className="font-medium">{rec.skill_description}</span>
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {rec.message} • {rec.reason.replace('_', ' ')}
                                            </p>
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

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold">
                            {selectedSubject} Learning Path
                        </h2>
                        <div className="flex items-center gap-4">
                            <span className="text-sm">
                                Mastered: {masteredSubskills}/{totalSubskills} Subskills ({allSkillsCount} Skills)
                            </span>
                            <Button
                                variant="outline"
                                onClick={resetProgress}
                                className="flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                            style={{ width: `${totalSubskills > 0 ? (masteredSubskills / totalSubskills) * 100 : 0}%` }}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    {visualizationData?.skills && visualizationData.skills.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 gap-6">
                                {visualizationData.skills.map((skill) => {
                                    // Calculate skill-level progress
                                    const unlockedSubskills = skill.subskills.filter(s => s.student_data?.unlocked);
                                    const totalSubskills = skill.subskills.length;
                                    const avgProficiency = skill.subskills
                                        .filter(s => s.student_data)
                                        .reduce((sum, s) => sum + (s.student_data?.proficiency || 0), 0) /
                                        (skill.subskills.filter(s => s.student_data).length || 1);

                                    return (
                                        <Card key={skill.skill_id} className={`relative text-left border rounded-lg p-4 ${
                                            expandedSkillId === skill.skill_id ? 'bg-blue-50' : 'hover:bg-blue-50 cursor-pointer'
                                        }`} onClick={() => handleExpandSkill(skill.skill_id)}>
                                            <CardHeader className="p-0 mb-2">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-lg font-semibold">{skill.skill_id}</CardTitle>
                                                    <span className="text-xs text-gray-500">
                                                        {unlockedSubskills.length}/{totalSubskills} unlocked
                                                    </span>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <p className="text-sm text-gray-700 mb-4">{skill.title}</p>

                                                {/* Skill-level progress */}
                                                <div className="mb-3">
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span>Overall Progress</span>
                                                        <span>{(avgProficiency * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className={`rounded-full h-2 transition-all ${
                                                                avgProficiency >= 0.8 ? 'bg-green-500' :
                                                                avgProficiency >= 0.5 ? 'bg-yellow-500' : 'bg-blue-500'
                                                            }`}
                                                            style={{ width: `${avgProficiency * 100}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Show prerequisites if any */}
                                                {skill.prerequisites.length > 0 && (
                                                    <div className="mb-3 text-xs text-gray-600">
                                                        Prerequisites: {skill.prerequisites.map(p => p.prerequisite_id).join(', ')}
                                                    </div>
                                                )}

                                                {expandedSkillId === skill.skill_id && (
                                                    <div className="space-y-4 mt-4">
                                                        <h4 className="font-semibold">Subskills:</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {skill.subskills.map((subskill) => {
                                                                const isUnlocked = subskill.student_data?.unlocked ?? false;
                                                                const proficiency = subskill.student_data?.proficiency || 0;
                                                                const attempts = subskill.student_data?.attempts || 0;

                                                                return (
                                                                    <Card key={subskill.subskill_id} className="p-4 relative flex flex-col justify-between min-h-[16rem]">
                                                                        <CardContent className="p-0 relative">
                                                                            {/* Lock overlay for locked subskills */}
                                                                            {!isUnlocked && (
                                                                                <div className="absolute inset-0 bg-gray-900 bg-opacity-40 rounded flex items-center justify-center z-10">
                                                                                    <Lock className="w-8 h-8 text-white" />
                                                                                </div>
                                                                            )}

                                                                            {/* Unlocked indicator */}
                                                                            {isUnlocked && proficiency >= 0.8 && (
                                                                                <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-green-500" />
                                                                            )}

                                                                            <div className="flex flex-col items-start gap-1">
                                                                                <span className="font-semibold text-sm">{subskill.subskill_id}</span>
                                                                                <span className="text-sm text-gray-700">{subskill.description}</span>

                                                                                {/* Prerequisites info */}
                                                                                {subskill.prerequisites.length > 0 && (
                                                                                    <div className="mt-2 text-xs text-gray-500">
                                                                                        Requires: {subskill.prerequisites.map(p => p.prerequisite_id).join(', ')}
                                                                                    </div>
                                                                                )}

                                                                                {/* Progress bar */}
                                                                                {isUnlocked && (
                                                                                    <div className="mt-3 w-full">
                                                                                        <div className="flex justify-between text-xs mb-1">
                                                                                            <span>Proficiency</span>
                                                                                            <span>{(proficiency * 100).toFixed(0)}%</span>
                                                                                        </div>
                                                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                                                            <div
                                                                                                className={`rounded-full h-2 transition-all ${
                                                                                                    proficiency >= 0.8 ? 'bg-green-500' :
                                                                                                    proficiency >= 0.5 ? 'bg-yellow-500' : 'bg-blue-500'
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

                                                                                {!isUnlocked && (
                                                                                    <div className="mt-3 text-xs text-red-600 font-medium">
                                                                                        🔒 Locked - Complete prerequisites first
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </CardContent>
                                                                        <CardContent className="flex justify-around p-0 border-t mt-4 pt-2">
                                                                            <Button variant="secondary" size="sm" disabled={!isUnlocked}>
                                                                                Teaching
                                                                            </Button>
                                                                            <Button variant="secondary" size="sm" disabled={!isUnlocked}>
                                                                                Practice
                                                                            </Button>
                                                                        </CardContent>
                                                                    </Card>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {expandedSkillId !== skill.skill_id && (
                                                    <div className="mt-4 text-blue-600 text-sm">Click to see subskills</div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="text-center p-6 bg-gray-50 rounded-lg">
                            <h3 className="text-xl font-bold text-gray-600 mb-4">
                                No skills available
                            </h3>
                            <p className="text-gray-500">
                                Please select a different subject or check back later.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default DecisionPathUI;