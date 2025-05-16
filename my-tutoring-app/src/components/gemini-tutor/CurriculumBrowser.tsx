// components/CurriculumBrowser.tsx
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, BookOpen, GraduationCap, Brain, Sparkles } from "lucide-react";
import { fetchSubjects, fetchCurriculum } from '@/lib/curriculumApi';
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from '@/lib/api';

interface CurriculumSelection {
  subject: string;
  domain?: {
    id: string;
    title: string;
  };
  skill?: {
    id: string;
    description: string;
  };
  subskill?: {
    id: string;
    description: string;
    difficulty_range?: {
      start: number;
      end: number;
      target: number;
    };
  };
}

interface CurriculumBrowserProps {
  onSelectionChange: (selection: CurriculumSelection) => void;
}

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
  icon = null,
  difficulty = null,
  isRecommended = false,
  recommendationPriority = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
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
        
        {difficulty && (
          <div className="flex items-center">
            <div className="relative h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden mr-2">
              <div 
                className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
                style={{ width: `${(difficulty.target / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{difficulty.target}/5</span>
          </div>
        )}

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

// Get icons for different learning levels
const getLevelIcon = (level) => {
  switch (level) {
    case 0: return <BookOpen size={16} />;
    case 1: return <GraduationCap size={16} />;
    case 2: return <Brain size={16} />;
    default: return null;
  }
};

const CurriculumBrowser: React.FC<CurriculumBrowserProps> = ({ onSelectionChange }) => {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [curriculum, setCurriculum] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState({
    subject: null,
    domain: null,
    skill: null,
    subskill: null
  });
  const [recommendations, setRecommendations] = useState<AdvancedRecommendation[]>([]);

  // Fetch subjects on component mount
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setIsLoading(true);
        const data = await fetchSubjects();
        setSubjects(data);
      } catch (error) {
        setError('Failed to load subjects');
        console.error('Error fetching subjects:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSubjects();
  }, []);
  
  // Fetch curriculum and recommendations when subject changes
  useEffect(() => {
    const loadCurriculumAndRecommendations = async () => {
      if (!selectedSubject) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Load curriculum
        const data = await fetchCurriculum(selectedSubject);
        setCurriculum(data.curriculum);
        
        // Try to get recommendations
        try {
          const recs = await api.getAdvancedRecommendations({
            student_id: 1, // You might want to make this configurable
            subject: selectedSubject,
            limit: 5
          });
          setRecommendations(recs);
        } catch (recError) {
          console.error('Failed to fetch recommendations:', recError);
          setRecommendations([]);
        }
        
        // Update selection state
        const newSelection = {
          subject: selectedSubject,
          domain: null,
          skill: null,
          subskill: null
        };
        setSelection(newSelection);
        onSelectionChange(newSelection);
      } catch (error) {
        setError('Failed to load curriculum');
        console.error('Error fetching curriculum:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCurriculumAndRecommendations();
  }, [selectedSubject, onSelectionChange]);

  // Remove the useEffect that updates recommendations on selection changes
  // This is not needed as recommendations are fetched when subject changes

  // Handlers for selection changes
  const handleDomainClick = (domain) => {
    const newSelection = {
      ...selection,
      domain: domain,
      skill: null,
      subskill: null
    };
    setSelection(newSelection);
    onSelectionChange(newSelection);
  };

  const handleSkillClick = (skill) => {
    const newSelection = {
      ...selection,
      skill: skill,
      subskill: null
    };
    setSelection(newSelection);
    onSelectionChange(newSelection);
  };

  const handleSubskillClick = (subskill) => {
    const newSelection = {
      ...selection,
      subskill: subskill
    };
    setSelection(newSelection);
    onSelectionChange(newSelection);
  };

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

  // Check if an item is recommended using the advanced recommendations
  const isRecommended = (id) => {
    if (!recommendations || recommendations.length === 0) return false;
    
    // Direct match: check if this ID matches any recommended items
    const directMatch = recommendations.some(rec => 
      rec.unit_id === id || 
      rec.skill_id === id || 
      rec.subskill_id === id
    );
    
    if (directMatch) return true;
    
    // For domains and skills, also check if any children are recommended
    if (curriculum) {
      // If this is a domain, check if any of its skills or subskills are recommended
      const domain = curriculum.find(d => d.id === id);
      if (domain) {
        return domain.skills.some(skill => 
          isRecommended(skill.id) || 
          skill.subskills.some(subskill => isRecommended(subskill.id))
        );
      }
      
      // If this is a skill, check if any of its subskills are recommended
      const skill = curriculum
        .flatMap(d => d.skills)
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

  // Get the number of recommendations
  const getRecommendationCount = () => {
    return recommendations?.length || 0;
  };

  if (isLoading && !curriculum) {
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
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Subject Selection */}
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Select Curriculum</h3>
        <Select
          value={selectedSubject || ''}
          onValueChange={setSelectedSubject}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recommendation Banner */}
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

      {/* Curriculum Tree */}
      {curriculum && (
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
            {curriculum.map((domain) => (
              <TreeItem
                key={domain.id}
                id={domain.id}
                label={domain.title}
                hasChildren={!!domain.skills?.length}
                isSelected={selection.domain?.id === domain.id}
                isRecommended={isRecommended(domain.id)}
                recommendationPriority={getRecommendationPriority(domain.id)}
                icon={getLevelIcon(0)}
                onClick={() => handleDomainClick(domain)}
              >
                {domain.skills?.map((skill) => (
                  <TreeItem
                    key={skill.id}
                    id={skill.id}
                    label={skill.description}
                    level={1}
                    hasChildren={!!skill.subskills?.length}
                    isSelected={selection.skill?.id === skill.id}
                    isRecommended={isRecommended(skill.id)}
                    recommendationPriority={getRecommendationPriority(skill.id)}
                    icon={getLevelIcon(1)}
                    onClick={() => handleSkillClick(skill)}
                  >
                    {skill.subskills?.map((subskill) => (
                      <TreeItem
                        key={subskill.id}
                        id={subskill.id}
                        label={subskill.description}
                        level={2}
                        isSelected={selection.subskill?.id === subskill.id}
                        isRecommended={isRecommended(subskill.id)}
                        recommendationPriority={getRecommendationPriority(subskill.id)}
                        icon={getLevelIcon(2)}
                        difficulty={subskill.difficulty_range}
                        onClick={() => handleSubskillClick(subskill)}
                      />
                    ))}
                  </TreeItem>
                ))}
              </TreeItem>
            ))}
          </div>
        </div>
      )}

      {/* Selection Summary - Only show when there's a selection */}
      {(selection.subject || selection.domain || selection.skill || selection.subskill) && (
        <div className="bg-gray-50 rounded-lg p-4 dark:bg-gray-900">
          <h3 className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">Your Selection</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selection.subject && (
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500">Subject:</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{selection.subject}</span>
              </div>
            )}
            
            {selection.domain && (
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500">Domain:</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{selection.domain.title}</span>
              </div>
            )}
            
            {selection.skill && (
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500">Skill:</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{selection.skill.description}</span>
              </div>
            )}
            
            {selection.subskill && (
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-500">Subskill:</span>
                <span className="text-sm text-gray-800 dark:text-gray-200">{selection.subskill.description}</span>
              </div>
            )}
          </div>
          
          {selection.subskill?.difficulty_range && (
            <div className="mt-4">
              <span className="text-xs font-semibold text-gray-500">Difficulty:</span>
              <div className="mt-1.5 flex items-center">
                <div className="relative h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
                    style={{ width: `${(selection.subskill.difficulty_range.target / 5) * 100}%` }}
                  />
                </div>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  {selection.subskill.difficulty_range.target}/5
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CurriculumBrowser;