import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Sparkles, BookOpen, GraduationCap } from 'lucide-react';

// Simplified mock data structure for curriculum
// In a real app, this would come from an API
const MOCK_CURRICULUM = {
  units: [
    {
      id: 1,
      title: "Fundamentals of P5.js",
      skills: [
        {
          id: 101,
          description: "Setting up your first sketch",
          difficulty_range: "beginner",
          recommended: false,
          subskills: [
            {
              id: 1001,
              description: "Understanding setup() and draw()",
              difficulty_range: "beginner",
              recommended: true,
              priority: "high"
            },
            {
              id: 1002,
              description: "Canvas creation and sizing",
              difficulty_range: "beginner",
              recommended: false
            }
          ]
        },
        {
          id: 102,
          description: "Basic shapes and colors",
          difficulty_range: "beginner",
          recommended: true,
          priority: "medium",
          subskills: [
            {
              id: 1003,
              description: "Drawing circles, rectangles and lines",
              difficulty_range: "beginner",
              recommended: true,
              priority: "high"
            },
            {
              id: 1004,
              description: "Fill and stroke properties",
              difficulty_range: "beginner",
              recommended: false
            }
          ]
        }
      ]
    },
    {
      id: 2,
      title: "Animation and Interaction",
      skills: [
        {
          id: 201,
          description: "Creating simple animations",
          difficulty_range: "intermediate",
          recommended: true,
          priority: "high",
          subskills: [
            {
              id: 2001,
              description: "Using variables for movement",
              difficulty_range: "intermediate",
              recommended: true,
              priority: "high"
            },
            {
              id: 2002,
              description: "Frame-based animation techniques",
              difficulty_range: "intermediate",
              recommended: false
            }
          ]
        },
        {
          id: 202,
          description: "Mouse and keyboard interaction",
          difficulty_range: "intermediate",
          recommended: false,
          subskills: [
            {
              id: 2003,
              description: "Capturing mouse position",
              difficulty_range: "intermediate",
              recommended: false
            },
            {
              id: 2004,
              description: "Responding to mouse clicks",
              difficulty_range: "intermediate",
              recommended: false
            }
          ]
        }
      ]
    }
  ]
};

interface CurriculumItem {
  id: number;
  title?: string;
  description?: string;
  difficulty_range?: string;
  recommended?: boolean;
  priority?: string;
}

interface SyllabusProps {
  onSelect: (selectedData: {
    unit?: CurriculumItem;
    skill?: CurriculumItem;
    subskill?: CurriculumItem;
  }) => void;
}

const ImprovedSyllabusSelector: React.FC<SyllabusProps> = ({ onSelect }) => {
  const [expandedUnits, setExpandedUnits] = useState<number[]>([]);
  const [expandedSkills, setExpandedSkills] = useState<number[]>([]);
  const [selection, setSelection] = useState<{
    unit?: CurriculumItem;
    skill?: CurriculumItem;
    subskill?: CurriculumItem;
  }>({});
  const [curriculum, setCurriculum] = useState(MOCK_CURRICULUM);
  const [searchText, setSearchText] = useState('');
  const [filteredCurriculum, setFilteredCurriculum] = useState(MOCK_CURRICULUM);

  // Handle searching
  useEffect(() => {
    if (!searchText.trim()) {
      setFilteredCurriculum(curriculum);
      return;
    }

    const searchLower = searchText.toLowerCase();
    
    // Deep copy and filter the curriculum
    const filtered = {
      units: curriculum.units
        .map(unit => {
          // Check if the unit matches
          const unitMatches = unit.title.toLowerCase().includes(searchLower);
          
          // Filter skills
          const filteredSkills = unit.skills
            .map(skill => {
              // Check if the skill matches
              const skillMatches = skill.description.toLowerCase().includes(searchLower);
              
              // Filter subskills
              const filteredSubskills = skill.subskills
                .filter(subskill => 
                  subskill.description.toLowerCase().includes(searchLower) || 
                  skillMatches || 
                  unitMatches
                );
              
              // Only return skills with matching subskills or that match themselves
              if (filteredSubskills.length > 0 || skillMatches) {
                return {
                  ...skill,
                  subskills: filteredSubskills
                };
              }
              return null;
            })
            .filter(Boolean);
          
          // Only return units with matching skills or that match themselves
          if (filteredSkills.length > 0 || unitMatches) {
            return {
              ...unit,
              skills: filteredSkills
            };
          }
          return null;
        })
        .filter(Boolean)
    };
    
    setFilteredCurriculum(filtered);
    
    // Automatically expand matching items
    const matchingUnits = filtered.units.map(unit => unit.id);
    const matchingSkills = filtered.units
      .flatMap(unit => unit.skills)
      .map(skill => skill.id);
    
    setExpandedUnits(matchingUnits);
    setExpandedSkills(matchingSkills);
    
  }, [searchText, curriculum]);

  // Toggle expanded state for units
  const toggleUnit = (unitId: number) => {
    setExpandedUnits(prev => 
      prev.includes(unitId) 
        ? prev.filter(id => id !== unitId)
        : [...prev, unitId]
    );
  };

  // Toggle expanded state for skills
  const toggleSkill = (skillId: number) => {
    setExpandedSkills(prev => 
      prev.includes(skillId) 
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  // Select an item from the syllabus
  const selectItem = (itemType: 'unit' | 'skill' | 'subskill', item: CurriculumItem, parentUnit?: CurriculumItem, parentSkill?: CurriculumItem) => {
    const newSelection: any = {};
    
    if (itemType === 'unit') {
      newSelection.unit = item;
    } else if (itemType === 'skill') {
      newSelection.unit = parentUnit;
      newSelection.skill = item;
    } else { // subskill
      newSelection.unit = parentUnit;
      newSelection.skill = parentSkill;
      newSelection.subskill = item;
    }
    
    setSelection(newSelection);
    
    // Only call onSelect if we have at least a unit selected
    if (newSelection.unit) {
      onSelect(newSelection);
    }
  };

  // Helper to determine if an item is selected
  const isSelected = (itemType: string, id: number) => {
    switch (itemType) {
      case 'unit':
        return selection.unit?.id === id;
      case 'skill':
        return selection.skill?.id === id;
      case 'subskill':
        return selection.subskill?.id === id;
      default:
        return false;
    }
  };

  // Render priority indicator
  const renderPriority = (item: CurriculumItem) => {
    if (!item.recommended) return null;
    
    let priorityColor = '';
    let priorityLabel = '';
    
    switch (item.priority) {
      case 'high':
        priorityColor = 'text-amber-500';
        priorityLabel = 'High priority';
        break;
      case 'medium':
        priorityColor = 'text-blue-500';
        priorityLabel = 'Recommended';
        break;
      default:
        priorityColor = 'text-green-500';
        priorityLabel = 'Suggested';
    }
    
    return (
      <div className="ml-1 flex items-center" title={priorityLabel}>
        <Sparkles className={`h-3.5 w-3.5 ${priorityColor}`} />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-blue-600" />
          <span>Learning Curriculum</span>
        </h3>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {selection.subskill || selection.skill || selection.unit ? (
            <button 
              onClick={() => setSelection({})}
              className="text-blue-600 hover:underline"
            >
              Clear Selection
            </button>
          ) : (
            "Select a topic"
          )}
        </div>
      </div>
      
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search curriculum..."
          className="w-full p-2 pr-8 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600"
        />
        {searchText && (
          <button 
            onClick={() => setSearchText('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Curriculum Tree */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {filteredCurriculum.units.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 p-2 text-center">
            No matching curriculum items found
          </div>
        ) : (
          filteredCurriculum.units.map(unit => (
            <div key={unit.id} className="space-y-1">
              {/* Unit Level */}
              <div 
                className={`flex items-center p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  isSelected('unit', unit.id) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : ''
                }`}
                onClick={() => toggleUnit(unit.id)}
              >
                <button className="mr-1">
                  {expandedUnits.includes(unit.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                <div 
                  className="flex-1 flex items-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectItem('unit', unit);
                  }}
                >
                  <BookOpen className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium">{unit.title}</span>
                </div>
              </div>
              
              {/* Skills Level */}
              {expandedUnits.includes(unit.id) && (
                <div className="pl-6 space-y-1">
                  {unit.skills.map(skill => (
                    <div key={skill.id}>
                      <div 
                        className={`flex items-center p-1.5 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          isSelected('skill', skill.id) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : ''
                        }`}
                        onClick={() => toggleSkill(skill.id)}
                      >
                        <button className="mr-1">
                          {expandedSkills.includes(skill.id) ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                        
                        <div 
                          className="flex-1 flex items-center text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectItem('skill', skill, unit);
                          }}
                        >
                          <span>{skill.description}</span>
                          {renderPriority(skill)}
                        </div>
                      </div>
                      
                      {/* Subskills Level */}
                      {expandedSkills.includes(skill.id) && (
                        <div className="pl-5 space-y-1 mb-1">
                          {skill.subskills.map(subskill => (
                            <div 
                              key={subskill.id}
                              className={`flex items-center py-1 px-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                isSelected('subskill', subskill.id) ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : ''
                              }`}
                              onClick={() => selectItem('subskill', subskill, unit, skill)}
                            >
                              <div className="w-3"></div>
                              <span className="text-xs flex-1">{subskill.description}</span>
                              {renderPriority(subskill)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Selection Summary & Action Button */}
      {(selection.subskill || selection.skill || selection.unit) && (
        <div className="mt-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md mb-2 text-sm">
            <div className="font-medium text-blue-800 dark:text-blue-300">Selected topic:</div>
            <div className="text-blue-700 dark:text-blue-200">
              {selection.subskill?.description || 
               selection.skill?.description || 
               selection.unit?.title}
            </div>
          </div>
          
          <button
            onClick={() => onSelect(selection)}
            className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
          >
            Start Tutoring Session
          </button>
        </div>
      )}
    </div>
  );
};

export default ImprovedSyllabusSelector;