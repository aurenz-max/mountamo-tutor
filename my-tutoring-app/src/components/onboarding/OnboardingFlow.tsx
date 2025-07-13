// components/onboarding/OnboardingFlow.tsx - COMPLETE FIXED VERSION
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, BookOpen, Brain, Headphones, Eye, PenTool, Star, Target, Trophy, Sparkles, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/authApiClient';
import { useAuth } from '@/contexts/AuthContext';

const OnboardingFlow = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  // Onboarding state
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [preferredLearningStyle, setPreferredLearningStyle] = useState<string[]>([]);
  
  // Data loading state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [contentPackages, setContentPackages] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Static data for goals and learning styles (MUST match backend validation)
  const learningGoalOptions = [
    { id: 'improve-grades', text: 'Improve my grades', icon: '📈' },
    { id: 'homework-help', text: 'Get help with homework', icon: '📝' },
    { id: 'test-prep', text: 'Prepare for tests', icon: '📋' },
    { id: 'learn-ahead', text: 'Learn ahead of my class', icon: '🚀' },
    { id: 'review-concepts', text: 'Review concepts I missed', icon: '🔄' },
    { id: 'have-fun', text: 'Make learning fun', icon: '🎉' }
  ];

  const learningStyleOptions = [
    { id: 'visual', text: 'Visual Learning', icon: <Eye className="w-6 h-6" />, description: 'Pictures, diagrams, and videos' },
    { id: 'audio', text: 'Audio Learning', icon: <Headphones className="w-6 h-6" />, description: 'Listening and discussions' },
    { id: 'reading', text: 'Reading & Writing', icon: <BookOpen className="w-6 h-6" />, description: 'Text-based learning' },
    { id: 'hands-on', text: 'Hands-on Practice', icon: <PenTool className="w-6 h-6" />, description: 'Interactive problems and activities' }
  ];

  const steps = [
    { title: "Welcome!", subtitle: "Let's personalize your learning journey" },
    { title: "What interests you?", subtitle: "Select subjects you'd like to explore" },
    { title: "Choose your adventures", subtitle: "Pick interactive content that excites you" },
    { title: "What are your goals?", subtitle: "Tell us what you want to achieve" },
    { title: "How do you learn best?", subtitle: "Help us tailor your experience" },
    { title: "You're all set!", subtitle: "Welcome to your personalized learning journey" }
  ];

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login');
      return;
    }

    // Check if user has already completed onboarding
    if (user) {
      checkOnboardingStatus();
    }
  }, [user, authLoading, router]);

  const checkOnboardingStatus = async () => {
    try {
      // Use dedicated onboarding status endpoint instead of profile
      const status = await authApi.get('/api/user-profiles/onboarding/status');
      if (status.completed) {
        router.push('/dashboard');
        return;
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // Fallback to profile check if status endpoint fails
      try {
        const profile = await authApi.getUserProfile();
        if (profile.preferences?.onboarding?.onboardingCompleted) {
          router.push('/dashboard');
          return;
        }
      } catch (fallbackError) {
        console.error('Fallback profile check failed:', fallbackError);
      }
    }
  };

  // Load subjects when step 1 is reached
  useEffect(() => {
    if (currentStep === 1 && subjects.length === 0) {
      loadSubjects();
    }
  }, [currentStep]);

  // Load content packages when step 2 is reached
  useEffect(() => {
    if (currentStep === 2 && contentPackages.length === 0) {
      loadContentPackages();
    }
  }, [currentStep]);

  const loadSubjects = async () => {
    setIsLoadingData(true);
    try {
      const response = await authApi.get('/api/curriculum/subjects');
      
      // Handle different response structures
      let subjectsData = response;
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        subjectsData = response.subjects || response.data || response.results || response;
      }
      
      if (!Array.isArray(subjectsData)) {
        console.error('Expected array but got:', subjectsData);
        throw new Error('Invalid response format from subjects API');
      }
      
      // Clean and filter the subject names
      const cleanedSubjects = subjectsData
        .filter((subject: string) => {
          const subjectStr = typeof subject === 'string' ? subject : String(subject);
          return !subjectStr.toLowerCase().includes('abc123') && 
                 !subjectStr.toLowerCase().includes('detailed') &&
                 !subjectStr.toLowerCase().includes('-syllabus');
        })
        .map((subject: string) => {
          let cleanName = typeof subject === 'string' ? subject : String(subject);
          cleanName = cleanName.replace(/-Syllabus$/, '');
          cleanName = cleanName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return cleanName;
        });
      
      // Transform to consistent format
      const formattedSubjects = cleanedSubjects.map((subject: any) => {
        const subjectName = typeof subject === 'string' ? subject : subject.name || subject.subject_name || subject.title;
        const subjectId = typeof subject === 'string' ? subject.toLowerCase().replace(/\s+/g, '-') : subject.id || subject.subject_id;
        
        return {
          id: subjectId,
          name: subjectName,
          icon: getSubjectIcon(subjectName),
          description: `Learn ${subjectName} concepts and skills`
        };
      });
      
      setSubjects(formattedSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
      setError('Failed to load subjects. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadContentPackages = async () => {
    setIsLoadingData(true);
    try {
      const response = await authApi.get('/api/packages/content-packages?status=approved&limit=50');
      
      let packagesData = response;
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        packagesData = response.packages || response.content_packages || response.data || response.results || response;
      }
      
      if (!Array.isArray(packagesData)) {
        console.warn('Creating empty packages array since API returned invalid data');
        packagesData = [];
      }
      
      // Transform API response to match component structure
      const formattedPackages = packagesData.map((pkg: any) => ({
        id: pkg.package_id || pkg.id || pkg.title?.toLowerCase().replace(/\s+/g, '-'),
        title: pkg.title || pkg.name || pkg.package_name,
        subject: pkg.subject_id || pkg.subject || pkg.subject_name,
        type: pkg.package_type || pkg.type || 'Interactive Content',
        duration: pkg.estimated_duration || pkg.duration || '15 min',
        description: pkg.description || 'Engaging interactive learning experience',
        features: pkg.content_types || pkg.features || ['reading', 'visual', 'problems'],
        difficulty: pkg.difficulty_level || pkg.difficulty || 'Beginner',
        grade_levels: pkg.grade_levels || pkg.grades || []
      }));
      
      setContentPackages(formattedPackages);
    } catch (error) {
      console.error('Error loading content packages:', error);
      setError('Failed to load content packages. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const getSubjectIcon = (subjectName: string) => {
    const iconMap: Record<string, string> = {
      'mathematics': '📊',
      'math': '📊',
      'science': '🔬',
      'english': '📚',
      'language arts': '📚',
      'language-arts': '📚',
      'reading': '📚',
      'history': '🏛️',
      'social studies': '🌍',
      'geography': '🌍',
      'art': '🎨',
      'arts': '🎨',
      'music': '🎵',
      'physical education': '⚽',
      'computer science': '💻'
    };
    
    const key = subjectName?.toLowerCase() || '';
    return iconMap[key] || '📖';
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects(prev => 
      prev.includes(subjectId) 
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const togglePackage = (packageId: string) => {
    setSelectedPackages(prev => 
      prev.includes(packageId) 
        ? prev.filter(id => id !== packageId)
        : [...prev, packageId]
    );
  };

  const toggleGoal = (goalId: string) => {
    setLearningGoals(prev => 
      prev.includes(goalId) 
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const toggleLearningStyle = (styleId: string) => {
    setPreferredLearningStyle(prev => 
      prev.includes(styleId) 
        ? prev.filter(id => id !== styleId)
        : [...prev, styleId]
    );
  };

  const getFilteredPackages = () => {
    if (selectedSubjects.length === 0) return contentPackages;
    
    // Get the selected subject names (not IDs)
    const selectedSubjectNames = selectedSubjects.map(id => {
      const subject = subjects.find(s => s.id === id);
      return subject?.name;
    }).filter(Boolean);
    
    // Filter packages based on selected subjects
    return contentPackages.filter(pkg => {
      return selectedSubjectNames.includes(pkg.subject);
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // FIXED: Use dedicated onboarding endpoint and remove duplicate activity logging
  const handleFinish = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Prepare onboarding data - MUST match backend OnboardingData model exactly
      const onboardingData = {
        selectedSubjects,
        selectedPackages,
        learningGoals,
        preferredLearningStyle,
        onboardingCompleted: true,
        completedAt: new Date().toISOString()
      };
      
      // OPTION 1: Use dedicated onboarding endpoint (RECOMMENDED)
      try {
        const result = await authApi.post('/api/user-profiles/onboarding/complete', onboardingData);
        console.log('Onboarding completed via dedicated endpoint:', result);
      } catch (dedicatedEndpointError) {
        console.warn('Dedicated endpoint failed, falling back to profile update:', dedicatedEndpointError);
        
        // OPTION 2: Fallback to profile update method
        await authApi.updateUserProfile({
          preferences: { onboarding: onboardingData }
        });
        console.log('Onboarding completed via profile update fallback');
      }

      // DO NOT log activity here - backend handles it automatically
      // This prevents duplicate activity logging

      // Redirect to dashboard
      router.push('/dashboard');
      
    } catch (error) {
      console.error('Error completing onboarding:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('validation')) {
          setError('Please check your selections and try again.');
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError('Failed to save your preferences. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch(currentStep) {
      case 1: return selectedSubjects.length > 0;
      case 2: return selectedPackages.length > 0;
      case 3: return learningGoals.length > 0;
      case 4: return preferredLearningStyle.length > 0;
      default: return true;
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const renderWelcomeStep = () => (
    <div className="text-center max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Brain className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to AI Tutor!</h1>
        <p className="text-lg text-gray-600 mb-8">
          We're excited to help you on your learning journey. Let's take a few minutes to 
          personalize your experience so we can recommend the perfect content for you.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
          <Target className="w-8 h-8 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Personalized Learning</h3>
          <p className="text-sm text-gray-600">Content tailored to your interests and learning style</p>
        </div>
        
        <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
          <Trophy className="w-8 h-8 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Track Progress</h3>
          <p className="text-sm text-gray-600">Monitor your achievements and celebrate milestones</p>
        </div>
        
        <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
          <Sparkles className="w-8 h-8 text-purple-600 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Interactive Fun</h3>
          <p className="text-sm text-gray-600">Engaging activities that make learning enjoyable</p>
        </div>
      </div>
      
      <p className="text-sm text-gray-500">This will only take about 2-3 minutes</p>
    </div>
  );

  const renderSubjectSelection = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">What subjects interest you?</h2>
        <p className="text-gray-600">Select all the subjects you'd like to explore (you can always change this later)</p>
      </div>
      
      {isLoadingData ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading subjects...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map(subject => (
              <div
                key={subject.id}
                onClick={() => toggleSubject(subject.id)}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedSubjects.includes(subject.id)
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-3">{subject.icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-2">{subject.name}</h3>
                  <p className="text-sm text-gray-600">{subject.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
              Selected: {selectedSubjects.length} subject{selectedSubjects.length !== 1 ? 's' : ''}
            </p>
          </div>
        </>
      )}
    </div>
  );

  const renderPackageSelection = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose your learning adventures</h2>
        <p className="text-gray-600">Pick interactive content packages that sound exciting to you</p>
      </div>
      
      {isLoadingData ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading content packages...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {getFilteredPackages().map(pkg => (
              <div
                key={pkg.id}
                onClick={() => togglePackage(pkg.id)}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPackages.includes(pkg.id)
                    ? 'border-green-500 bg-green-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-900">{pkg.title}</h3>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {pkg.duration}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-4">{pkg.description}</p>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  {pkg.features.map((feature: string) => (
                    <span key={feature} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {feature}
                    </span>
                  ))}
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{pkg.type}</span>
                  <span className="font-medium">{pkg.difficulty}</span>
                </div>
              </div>
            ))}
          </div>
          
          {getFilteredPackages().length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No content packages available for selected subjects.</p>
              <p className="text-sm text-gray-400 mt-2">Try selecting different subjects in the previous step.</p>
            </div>
          )}
          
          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
              Selected: {selectedPackages.length} package{selectedPackages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </>
      )}
    </div>
  );

  const renderGoalsSelection = () => (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">What are your learning goals?</h2>
        <p className="text-gray-600">Tell us what you want to achieve so we can help you succeed</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {learningGoalOptions.map(goal => (
          <div
            key={goal.id}
            onClick={() => toggleGoal(goal.id)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center ${
              learningGoals.includes(goal.id)
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl mr-4">{goal.icon}</span>
            <span className="font-medium text-gray-900">{goal.text}</span>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          Selected: {learningGoals.length} goal{learningGoals.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );

  const renderLearningStyleSelection = () => (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">How do you learn best?</h2>
        <p className="text-gray-600">Select your preferred learning styles to get personalized content</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {learningStyleOptions.map(style => (
          <div
            key={style.id}
            onClick={() => toggleLearningStyle(style.id)}
            className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
              preferredLearningStyle.includes(style.id)
                ? 'border-orange-500 bg-orange-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start">
              <div className="mr-4 text-orange-600">{style.icon}</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{style.text}</h3>
                <p className="text-sm text-gray-600">{style.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          Selected: {preferredLearningStyle.length} style{preferredLearningStyle.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );

  const renderCompletionStep = () => (
    <div className="text-center max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">You're all set!</h1>
        <p className="text-lg text-gray-600 mb-8">
          Great job! We've personalized your learning experience based on your preferences. 
          You're ready to start your learning journey.
        </p>
      </div>
      
      <div className="bg-gray-50 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">Your Learning Profile:</h3>
        <div className="text-left space-y-3">
          <div>
            <span className="font-medium text-gray-700">Subjects:</span>
            <span className="ml-2 text-gray-600">
              {selectedSubjects.map(id => subjects.find(s => s.id === id)?.name).filter(Boolean).join(', ')}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Selected Packages:</span>
            <span className="ml-2 text-gray-600">{selectedPackages.length} interactive experiences</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Goals:</span>
            <span className="ml-2 text-gray-600">{learningGoals.length} learning objectives</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Learning Style:</span>
            <span className="ml-2 text-gray-600">
              {preferredLearningStyle.map(id => learningStyleOptions.find(s => s.id === id)?.text).filter(Boolean).join(', ')}
            </span>
          </div>
        </div>
      </div>
      
      <button
        onClick={handleFinish}
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Setting up your dashboard...
          </>
        ) : (
          'Start Learning!'
        )}
      </button>
    </div>
  );

  const renderCurrentStep = () => {
    switch(currentStep) {
      case 0: return renderWelcomeStep();
      case 1: return renderSubjectSelection();
      case 2: return renderPackageSelection();
      case 3: return renderGoalsSelection();
      case 4: return renderLearningStyleSelection();
      case 5: return renderCompletionStep();
      default: return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Brain className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">AI Tutor Setup</h1>
      </div>

      {/* Progress Bar */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Step {currentStep + 1} of {steps.length}</span>
          <span className="text-sm text-gray-600">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Title */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{steps[currentStep].title}</h2>
        <p className="text-gray-600 mt-2">{steps[currentStep].subtitle}</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="mb-8">
        {renderCurrentStep()}
      </div>

      {/* Navigation */}
      {currentStep < steps.length - 1 && (
        <div className="flex justify-between max-w-2xl mx-auto">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </button>
          
          <button
            onClick={handleNext}
            disabled={!isStepValid() || isLoadingData}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoadingData ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Loading...
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;