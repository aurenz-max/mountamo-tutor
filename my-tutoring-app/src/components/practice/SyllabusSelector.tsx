import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Sparkles, Bookmark, BookOpen, GraduationCap, Brain } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { authApi } from '@/lib/authApiClient'; // Changed from api to authApi
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from '@/contexts/AuthContext'; // Added auth context

// Define type for advanced recommendations
interface AdvancedRecommendation {
  type: string;
  priority: string;
  unit_id: string;
  unit_title: string;
  skill_id: string;
  skill_description: string;
  subskill_id: string;
  subskill_description: string;
  proficiency: number;
  mastery: number;
  avg_score: number;
  priority_level: string;
  priority_order: number;
  readiness_status: string;
  is_ready: boolean;
  completion: number;
  attempt_count: number;
  is_attempted: boolean;
  next_subskill: string | null;
  message: string;
}

// Animation variants for tree items
const itemVariants = {
  hidden: { opacity: 0, y: -5 },
  visible: { opacity: 1, y: 0 }
};

const TreeItem = ({ 
  label, 
  id,
  children, 
  isSelected, 
  onClick, 
  hasChildren = false,
  level = 0,
  isRecommended = false,
  recommendationPriority = null,
  icon = null
}) => {
  // Change the default state to false (collapsed)
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    // Only auto-expand if this item is specifically selected
    // Do NOT auto-expand for recommendations initially
    if (isSelected) {
      setIsOpen(true);
    }
  }, [isSelected]);

  // Get recommendation style based on priority
  const getRecommendationStyle = () => {
    if (!isRecommended) return {};
    
    if (recommendationPriority === 'high') {
      return { color: 'text-amber-600 dark:text-amber-400' };
    } else if (recommendationPriority === 'medium') {
      return { color: 'text-amber-500 dark:text-amber-300' };
    } else {
      return { color: 'text-amber-400 dark:text-amber-200' };
    }
  };

  const recommendationStyle = getRecommendationStyle();

  return (
    <div className="select-none">
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={itemVariants}
        transition={{ duration: 0.2, delay: level * 0.05 }}
        className={`flex items-center gap-2 p-2 rounded-md transition-all duration-150
          ${isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
          ${level > 0 ? 'ml-4' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            setIsOpen(!isOpen);
          }
          onClick?.();
        }}
      >
        {hasChildren ? (
          <button className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        
        {icon && <span className="text-gray-500">{icon}</span>}
        
        <span className="text-sm flex-grow">{label}</span>
        
        {isRecommended && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Sparkles className={`h-4 w-4 ${recommendationStyle.color || 'text-amber-400'}`} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{recommendationPriority ? `${recommendationPriority} priority recommendation` : 'Recommended next topic'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </motion.div>
      
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
};

const SyllabusSelector = ({ onSelect }) => {
  const { user, userProfile, loading: authLoading } = useAuth(); // Added auth context
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [syllabus, setSyllabus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selection, setSelection] = useState({
    subject: null,
    unit: null,
    skill: null,
    subskill: null
  });
  // Only use the advanced recommendations
  const [recommendations, setRecommendations] = useState<AdvancedRecommendation[]>([]);

  // Function to get the recommendation priority for an item
  const getRecommendationPriority = (id) => {
    if (!recommendations || recommendations.length === 0) return null;
    
    const recommendation = recommendations.find(rec => 
      rec.unit_id === id || 
      rec.skill_id === id || 
      rec.subskill_id === id
    );
    
    return recommendation ? recommendation.priority : null;
  };

  useEffect(() => {
    const loadSubjects = async () => {
      // Wait for auth to be ready
      if (authLoading) {
        console.log('🔍 Auth still loading, waiting...');
        return;
      }

      if (!user) {
        console.log('🔍 No user, cannot load subjects');
        setError('Please log in to access subjects');
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 COMPONENT: Fetching subjects with authApi...');
        const availableSubjects = await authApi.getSubjects();
        console.log('✅ COMPONENT: Subjects received:', availableSubjects);
        setSubjects(availableSubjects);
      } catch (err) {
        console.error('❌ COMPONENT: Failed to fetch subjects:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load subjects';
        setError('Failed to load subjects: ' + errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadSubjects();
  }, [user, authLoading]); // Added dependencies

  useEffect(() => {
    const fetchSyllabusAndRecommendations = async () => {
      if (!selectedSubject) return;

      // Check auth state
      if (authLoading) {
        console.log('🔍 Auth still loading, waiting...');
        return;
      }

      if (!user) {
        console.log('🔍 No user, cannot fetch syllabus');
        setError('Please log in to access curriculum');
        return;
      }

      setLoading(true);
      setSyllabus(null);
      setError(null);
      
      try {
        console.log(`🔍 COMPONENT: Fetching curriculum for subject: ${selectedSubject} with authApi...`);
        
        // First, load the curriculum data
        const data = await authApi.getSubjectCurriculum(selectedSubject);
        console.log('✅ COMPONENT: Curriculum received:', data);
        setSyllabus(data);
        
        // Then, try to get the advanced recommendations
        if (userProfile?.student_id) {
          try {
            console.log('🔍 COMPONENT: Fetching advanced recommendations...');
            const recs = await authApi.getAdvancedRecommendations({
              student_id: userProfile.student_id, // Use actual student_id from profile
              subject: selectedSubject,
              limit: 5
            });
            console.log('✅ COMPONENT: Recommendations received:', recs);
            setRecommendations(recs);
          } catch (recError) {
            console.error('❌ Failed to fetch advanced recommendations:', recError);
            // Set empty recommendations if the API call fails
            setRecommendations([]);
          }
        } else {
          console.warn('⚠️ No student_id in user profile, skipping recommendations');
          setRecommendations([]);
        }
        
        setSelection({
          subject: selectedSubject,
          unit: null,
          skill: null,
          subskill: null
        });
      } catch (err) {
        console.error(`❌ COMPONENT: Failed to fetch curriculum for ${selectedSubject}:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load syllabus';
        setError('Failed to load syllabus: ' + errorMessage);
      } finally {
        setLoading(false);
      }
    };

    // Call the function that fetches both syllabus and recommendations
    fetchSyllabusAndRecommendations();
  }, [selectedSubject, user, authLoading, userProfile]); // Added dependencies

  // Update recommendations when selection changes
  useEffect(() => {
    const updateRecommendations = async () => {
      if (!selection.subject || !user || !userProfile?.student_id) return;

      try {
        console.log('🔍 COMPONENT: Updating advanced recommendations...');
        // Update advanced recommendations
        const advancedRecs = await authApi.getAdvancedRecommendations({
          student_id: userProfile.student_id,
          subject: selection.subject,
          limit: 5
        });
        console.log('✅ COMPONENT: Updated recommendations received:', advancedRecs);
        setRecommendations(advancedRecs);
      } catch (err) {
        console.error('❌ Failed to update recommendations:', err);
      }
    };

    updateRecommendations();
  }, [selection.skill, selection.subskill, user, userProfile]);

  const handleStartSession = () => {
    if (!selection.subject || !selection.unit) return;
  
    // Log what's being passed to make sure data is correct
    console.log("Starting session with:", {selection, currentTopic: {
      subject: selection.subject,
      selection: {
        unit: selection.unit,
        skill: selection.skill,
        subskill: selection.subskill
      }
    }});
    
    const selectedData = {
      selectedSubject: selection.subject,
      subject: selection.subject,
      selection: {
        subject: selection.subject,
        unit: selection.unit,
        skill: selection.skill,
        subskill: selection.subskill
      }
    };
  
    if (syllabus?.curriculum) {
      const unit = selection.unit ? 
        syllabus.curriculum.find(u => u.id === selection.unit) : null;
  
      if (unit) {
        selectedData.unit = unit;
        
        if (selection.skill) {
          const skill = unit.skills.find(s => s.id === selection.skill);
          if (skill) {
            selectedData.skill = skill;
            
            if (selection.subskill) {
              const subskill = skill.subskills.find(s => s.id === selection.subskill);
              if (subskill) {
                selectedData.subskill = subskill;
                selectedData.difficulty_range = subskill.difficulty_range;
              }
            }
          }
        }
      }
    }
  
    // Pass the complete data object to the parent component
    onSelect(selectedData);
  };

  const isSessionEnabled = selection.subject && selection.unit;

  // Check if an item is recommended using only the advanced recommendations
  const isRecommended = (id) => {
    if (!recommendations || recommendations.length === 0) return false;
    
    // Direct match: check if this ID matches any recommended items
    const directMatch = recommendations.some(rec => 
      rec.unit_id === id || 
      rec.skill_id === id || 
      rec.subskill_id === id
    );
    
    if (directMatch) return true;
    
    // For units and skills, also check if any children are recommended
    if (syllabus?.curriculum) {
      // If this is a unit, check if any of its skills or subskills are recommended
      const unit = syllabus.curriculum.find(u => u.id === id);
      if (unit) {
        return unit.skills.some(skill => 
          isRecommended(skill.id) || 
          skill.subskills.some(subskill => isRecommended(subskill.id))
        );
      }
      
      // If this is a skill, check if any of its subskills are recommended
      const skill = syllabus.curriculum
        .flatMap(u => u.skills)
        .find(s => s.id === id);
      if (skill) {
        return skill.subskills.some(subskill => isRecommended(subskill.id));
      }
    }
    
    return false;
  };

  // Get the next recommended item text for better UX
  const getNextRecommendedText = () => {
    if (!recommendations || recommendations.length === 0) return null;
    
    // Get the highest priority recommendation (first in the array)
    return recommendations[0].subskill_description;
  };

  const nextRecommendedText = getNextRecommendedText();

  // Get the message for the recommendation
  const getRecommendationMessage = () => {
    if (recommendations && recommendations.length > 0) {
      return recommendations[0].message;
    }
    return null;
  };

  const recommendationMessage = getRecommendationMessage();

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="animate-spin h-5 w-5 border-2 border-primary rounded-full border-t-transparent"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Initializing authentication...</span>
        </div>
      </div>
    );
  }

  // Show error if not authenticated
  if (!user) {
    return (
      <div className="p-6 border rounded-lg bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-900/50">
        <p className="text-sm">Please log in to access the curriculum selector.</p>
      </div>
    );
  }

  if (loading && !syllabus) {
    return (
      <div className="p-6 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="animate-spin h-5 w-5 border-2 border-primary rounded-full border-t-transparent"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Loading curriculum...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50">
        <p className="text-sm">{error}</p>
        <Button 
          variant="outline" 
          size="sm"
          className="mt-3"
          onClick={() => {
            setError(null);
            setSelectedSubject('');
            setSyllabus(null);
            if (user) {
              authApi.getSubjects().then(setSubjects).catch(err => {
                console.error('Retry failed:', err);
                setError('Retry failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
              });
            }
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  // Get icons for different learning levels
  const getLevelIcon = (level) => {
    switch (level) {
      case 0: return <BookOpen size={16} />;
      case 1: return <GraduationCap size={16} />;
      case 2: return <Brain size={16} />;
      default: return null;
    }
  };

  // Get the number of recommendations
  const getRecommendationCount = () => {
    return recommendations?.length || 0;
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Select Curriculum</h3>
        <Select
          value={selectedSubject}
          onValueChange={setSelectedSubject}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map(subject => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {nextRecommendedText && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 dark:bg-amber-900/20 dark:border-amber-800/30">
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Recommended next:</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">{nextRecommendedText}</p>
              {recommendationMessage && (
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 italic">{recommendationMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {syllabus?.curriculum && (
        <div className="border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-800 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b dark:bg-gray-900 dark:border-gray-800 flex justify-between items-center">
            <h4 className="font-medium text-sm">Learning Path</h4>
            {getRecommendationCount() > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30">
                <Sparkles className="h-3 w-3 mr-1" /> 
                <span className="text-xs">{getRecommendationCount()} Recommendations</span>
              </Badge>
            )}
          </div>
          
          <div className="max-h-[50vh] overflow-y-auto p-3 space-y-1 scrollbar-hide">
            {syllabus.curriculum.map((unit) => (
              <TreeItem
                key={unit.id}
                id={unit.id}
                label={unit.title}
                hasChildren={!!unit.skills?.length}
                isSelected={selection.unit === unit.id}
                isRecommended={isRecommended(unit.id)}
                recommendationPriority={getRecommendationPriority(unit.id)}
                icon={getLevelIcon(0)}
                onClick={() => setSelection(prev => ({
                  ...prev,
                  unit: unit.id,
                  skill: null,
                  subskill: null
                }))}
              >
                {unit.skills.map((skill) => (
                  <TreeItem
                    key={skill.id}
                    id={skill.id}
                    label={skill.description}
                    level={1}
                    hasChildren={!!skill.subskills?.length}
                    isSelected={selection.skill === skill.id}
                    isRecommended={isRecommended(skill.id)}
                    recommendationPriority={getRecommendationPriority(skill.id)}
                    icon={getLevelIcon(1)}
                    onClick={() => setSelection(prev => ({
                      ...prev,
                      skill: skill.id,
                      subskill: null
                    }))}
                  >
                    {skill.subskills.map((subskill) => (
                      <TreeItem
                        key={subskill.id}
                        id={subskill.id}
                        label={subskill.description}
                        level={2}
                        isSelected={selection.subskill === subskill.id}
                        isRecommended={isRecommended(subskill.id)}
                        recommendationPriority={getRecommendationPriority(subskill.id)}
                        icon={getLevelIcon(2)}
                        onClick={() => setSelection(prev => ({
                          ...prev,
                          subskill: subskill.id
                        }))}
                      />
                    ))}
                  </TreeItem>
                ))}
              </TreeItem>
            ))}
          </div>
        </div>
      )}

      <Button 
        className="w-full"
        size="lg"
        onClick={handleStartSession}
        disabled={!isSessionEnabled}
        variant={isSessionEnabled ? "default" : "outline"}
      >
        {isSessionEnabled ? (
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            <span>Start Tutoring Session</span>
          </div>
        ) : (
          <span>Select a topic to begin</span>
        )}
      </Button>
    </div>
  );
};

export default SyllabusSelector;