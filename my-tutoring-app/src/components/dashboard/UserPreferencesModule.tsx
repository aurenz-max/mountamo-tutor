import React, { useState, useEffect } from 'react';
import { 
  User, 
  BookOpen, 
  Target, 
  Brain, 
  Eye, 
  Headphones, 
  PenTool, 
  Star, 
  Save, 
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Settings,
  Loader2,
  Check,
  X,
  UserCog,
  ArrowLeft
} from 'lucide-react';

// Import your auth context and API client
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/authApiClient';

// Props interface for the preferences component
interface UserPreferencesProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserPreferencesModule: React.FC<UserPreferencesProps> = ({ isOpen, onClose }) => {
  const { userProfile, refreshUserProfile } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    profile: true,
    subjects: false,
    packages: false,
    goals: false,
    learningStyle: false
  });

  // Form state
  const [profile, setProfile] = useState({
    display_name: '',
    grade_level: null as string | null,
    email: ''
  });

  const [preferences, setPreferences] = useState({
    selectedSubjects: [] as string[],
    selectedPackages: [] as string[],
    learningGoals: [] as string[],
    preferredLearningStyle: [] as string[]
  });

  // Reference data
  const [subjects, setSubjects] = useState<any[]>([]);
  const [contentPackages, setContentPackages] = useState<any[]>([]);

  // Static reference data
  const learningGoalOptions = [
    { id: 'improve-grades', text: 'Improve my grades', icon: '📈' },
    { id: 'homework-help', text: 'Get help with homework', icon: '📝' },
    { id: 'test-prep', text: 'Prepare for tests', icon: '📋' },
    { id: 'learn-ahead', text: 'Learn ahead of my class', icon: '🚀' },
    { id: 'review-concepts', text: 'Review concepts I missed', icon: '🔄' },
    { id: 'have-fun', text: 'Make learning fun', icon: '🎉' }
  ];

  const learningStyleOptions = [
    { id: 'visual', text: 'Visual Learning', icon: <Eye className="w-5 h-5" />, description: 'Pictures, diagrams, videos' },
    { id: 'audio', text: 'Audio Learning', icon: <Headphones className="w-5 h-5" />, description: 'Listening and discussions' },
    { id: 'reading', text: 'Reading & Writing', icon: <BookOpen className="w-5 h-5" />, description: 'Text-based learning' },
    { id: 'hands-on', text: 'Hands-on Practice', icon: <PenTool className="w-5 h-5" />, description: 'Interactive problems' }
  ];

  const gradeOptions = [
    { value: 'K', label: 'Kindergarten' },
    { value: '1', label: '1st Grade' },
    { value: '2', label: '2nd Grade' },
    { value: '3', label: '3rd Grade' },
    { value: '4', label: '4th Grade' },
    { value: '5', label: '5th Grade' },
    { value: '6', label: '6th Grade' },
    { value: '7', label: '7th Grade' },
    { value: '8', label: '8th Grade' },
    { value: '9', label: '9th Grade' },
    { value: '10', label: '10th Grade' },
    { value: '11', label: '11th Grade' },
    { value: '12', label: '12th Grade' }
  ];

  // Load initial data when component opens
  useEffect(() => {
    if (isOpen) {
      loadPreferences();
      loadReferenceData();
    }
  }, [isOpen]);

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

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the userProfile from context first, then refresh if needed
      let userData = userProfile;
      
      if (!userData) {
        await refreshUserProfile();
        userData = userProfile;
      }
      
      if (!userData) {
        // If still no profile, try to fetch directly
        userData = await authApi.getUserProfile();
      }
      
      if (userData) {
        // Set profile data
        setProfile({
          display_name: userData.display_name || '',
          grade_level: userData.grade_level || null,
          email: userData.email || ''
        });

        // Set preferences from onboarding data
        if (userData.preferences?.onboarding) {
          setPreferences({
            selectedSubjects: userData.preferences.onboarding.selectedSubjects || [],
            selectedPackages: userData.preferences.onboarding.selectedPackages || [],
            learningGoals: userData.preferences.onboarding.learningGoals || [],
            preferredLearningStyle: userData.preferences.onboarding.preferredLearningStyle || []
          });
        }
      }
    } catch (err: any) {
      console.error('Error loading preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      // Load subjects from curriculum API
      const subjectsResponse = await authApi.get('/api/curriculum/subjects');
      
      // Handle different response structures
      let subjectsData = subjectsResponse;
      if (subjectsResponse && typeof subjectsResponse === 'object' && !Array.isArray(subjectsResponse)) {
        subjectsData = subjectsResponse.subjects || subjectsResponse.data || subjectsResponse.results || subjectsResponse;
      }
      
      if (Array.isArray(subjectsData)) {
        // Transform subjects data similar to your OnboardingFlow
        const formattedSubjects = subjectsData
          .filter((subject: any) => {
            const subjectStr = typeof subject === 'string' ? subject : String(subject);
            return !subjectStr.toLowerCase().includes('abc123') && 
                   !subjectStr.toLowerCase().includes('detailed') &&
                   !subjectStr.toLowerCase().includes('-syllabus');
          })
          .map((subject: any) => {
            const subjectName = typeof subject === 'string' ? subject : subject.name || subject.subject_name || subject.title;
            const cleanName = subjectName.replace(/-Syllabus$/, '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
            const subjectId = typeof subject === 'string' ? subject.toLowerCase().replace(/\s+/g, '-') : subject.id || subject.subject_id;
            
            return {
              id: subjectId,
              name: cleanName,
              icon: getSubjectIcon(cleanName)
            };
          });
        
        setSubjects(formattedSubjects);
      }

      // Load content packages
      const packagesResponse = await authApi.get('/api/packages/content-packages?status=approved&limit=50');
      
      let packagesData = packagesResponse;
      if (packagesResponse && typeof packagesResponse === 'object' && !Array.isArray(packagesResponse)) {
        packagesData = packagesResponse.packages || packagesResponse.content_packages || packagesResponse.data || packagesResponse.results || packagesResponse;
      }
      
      if (Array.isArray(packagesData)) {
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
      }
      
    } catch (err) {
      console.error('Error loading reference data:', err);
      // Don't set error state here since reference data is not critical
    }
  };

  const handleProfileChange = (field: string, value: any) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceToggle = (category: string, itemId: string) => {
    setPreferences(prev => ({
      ...prev,
      [category]: (prev[category as keyof typeof prev] as string[]).includes(itemId)
        ? (prev[category as keyof typeof prev] as string[]).filter(id => id !== itemId)
        : [...(prev[category as keyof typeof prev] as string[]), itemId]
    }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section as keyof typeof prev]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Prepare update payload matching your backend structure
      const updateData = {
        display_name: profile.display_name,
        grade_level: profile.grade_level,
        preferences: {
          onboarding: {
            selectedSubjects: preferences.selectedSubjects,
            selectedPackages: preferences.selectedPackages,
            learningGoals: preferences.learningGoals,
            preferredLearningStyle: preferences.preferredLearningStyle,
            onboardingCompleted: true,
            completedAt: new Date().toISOString()
          }
        }
      };

      // Use your authApi to update the profile
      await authApi.updateUserProfile(updateData);
      
      // Refresh the user profile in context
      await refreshUserProfile();
      
      setSuccessMessage('Preferences updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err: any) {
      console.error('Error saving preferences:', err);
      setError(err.message || 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getSectionIcon = (section: string) => {
    const icons: Record<string, React.ReactNode> = {
      profile: <User className="w-5 h-5" />,
      subjects: <BookOpen className="w-5 h-5" />,
      packages: <Star className="w-5 h-5" />,
      goals: <Target className="w-5 h-5" />,
      learningStyle: <Brain className="w-5 h-5" />
    };
    return icons[section];
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={onClose}
                className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <UserCog className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">User Preferences</h1>
                  <p className="text-gray-600">Manage your learning preferences and profile settings</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadPreferences}
                disabled={loading}
                className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <X className="w-5 h-5 text-red-500 mr-2" />
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                <span className="text-green-700">{successMessage}</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600">Loading preferences...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Information */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleSection('profile')}
                >
                  <div className="flex items-center">
                    {getSectionIcon('profile')}
                    <h2 className="ml-3 text-xl font-semibold text-gray-900">Profile Information</h2>
                  </div>
                  {expandedSections.profile ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                
                {expandedSections.profile && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                        <input
                          type="text"
                          value={profile.display_name}
                          onChange={(e) => handleProfileChange('display_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter your display name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
                        <select
                          value={profile.grade_level || ''}
                          onChange={(e) => handleProfileChange('grade_level', e.target.value || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select grade level</option>
                          {gradeOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                        <input
                          type="email"
                          value={profile.email}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed here</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Subject Preferences */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleSection('subjects')}
                >
                  <div className="flex items-center">
                    {getSectionIcon('subjects')}
                    <h2 className="ml-3 text-xl font-semibold text-gray-900">Subject Preferences</h2>
                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                      {preferences.selectedSubjects.length} selected
                    </span>
                  </div>
                  {expandedSections.subjects ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                
                {expandedSections.subjects && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {subjects.map(subject => (
                        <div
                          key={subject.id}
                          onClick={() => handlePreferenceToggle('selectedSubjects', subject.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            preferences.selectedSubjects.includes(subject.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">{subject.icon}</span>
                            <span className="font-medium text-gray-900">{subject.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Learning Goals */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleSection('goals')}
                >
                  <div className="flex items-center">
                    {getSectionIcon('goals')}
                    <h2 className="ml-3 text-xl font-semibold text-gray-900">Learning Goals</h2>
                    <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                      {preferences.learningGoals.length} selected
                    </span>
                  </div>
                  {expandedSections.goals ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                
                {expandedSections.goals && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {learningGoalOptions.map(goal => (
                        <div
                          key={goal.id}
                          onClick={() => handlePreferenceToggle('learningGoals', goal.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center ${
                            preferences.learningGoals.includes(goal.id)
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-2xl mr-3">{goal.icon}</span>
                          <span className="font-medium text-gray-900">{goal.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Learning Style */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleSection('learningStyle')}
                >
                  <div className="flex items-center">
                    {getSectionIcon('learningStyle')}
                    <h2 className="ml-3 text-xl font-semibold text-gray-900">Learning Style</h2>
                    <span className="ml-2 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                      {preferences.preferredLearningStyle.length} selected
                    </span>
                  </div>
                  {expandedSections.learningStyle ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
                
                {expandedSections.learningStyle && (
                  <div className="p-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {learningStyleOptions.map(style => (
                        <div
                          key={style.id}
                          onClick={() => handlePreferenceToggle('preferredLearningStyle', style.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            preferences.preferredLearningStyle.includes(style.id)
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start">
                            <div className="mr-3 text-orange-600">{style.icon}</div>
                            <div>
                              <h3 className="font-medium text-gray-900 mb-1">{style.text}</h3>
                              <p className="text-sm text-gray-600">{style.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          {!loading && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p>Last updated: {new Date().toLocaleDateString()}</p>
                  <p>Changes are saved to your profile and will affect your learning recommendations.</p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save All Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserPreferencesModule;