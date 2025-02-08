'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { api } from '@/lib/api';

const TreeItem = ({ 
  label, 
  id,
  children, 
  isSelected, 
  onClick, 
  hasChildren = false,
  level = 0,
  isRecommended = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-1 p-1 rounded hover:bg-gray-100 cursor-pointer
          ${isSelected ? 'bg-blue-100 hover:bg-blue-100' : ''}
          ${level > 0 ? 'ml-4' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            setIsOpen(!isOpen);
          }
          onClick?.();
        }}
      >
        {hasChildren && (
          <span className="w-4 h-4">
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}
        <span className="text-sm flex-grow">{label}</span>
        {isRecommended && (
          <Sparkles className="h-4 w-4 text-yellow-500" />
        )}
      </div>
      {isOpen && children}
    </div>
  );
};

const SyllabusSelector = ({ onSelect }) => {
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
  const [recommendations, setRecommendations] = useState(null);

  useEffect(() => {
    const loadSubjects = async () => {
      setLoading(true);
      try {
        const availableSubjects = await api.getSubjects();
        setSubjects(availableSubjects);
      } catch (err) {
        setError('Failed to load subjects: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSubjects();
  }, []);

  useEffect(() => {
    const loadSyllabus = async () => {
      if (!selectedSubject) return;

      setLoading(true);
      setSyllabus(null);
      
      try {
        const data = await api.getSubjectCurriculum(selectedSubject);
        setSyllabus(data);
        
        // Get initial recommendations
        const initialRecommendations = await api.getNextRecommendations({
          student_id: 1, // You might want to make this configurable
          subject: selectedSubject
        });
        setRecommendations(initialRecommendations);
        
        setSelection({
          subject: selectedSubject,
          unit: null,
          skill: null,
          subskill: null
        });
      } catch (err) {
        setError('Failed to load syllabus: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadSyllabus();
  }, [selectedSubject]);

  // Update recommendations when selection changes
  useEffect(() => {
    const updateRecommendations = async () => {
      if (!selection.subject) return;

      try {
        const newRecommendations = await api.getNextRecommendations({
          student_id: 1, // You might want to make this configurable
          subject: selection.subject,
          current_skill_id: selection.skill,
          current_subskill_id: selection.subskill
        });
        setRecommendations(newRecommendations);
      } catch (err) {
        console.error('Failed to update recommendations:', err);
      }
    };

    updateRecommendations();
  }, [selection.skill, selection.subskill]);

  const handleStartSession = () => {
    if (!selection.subject) return;
  
    const selectedData = {
      subject: selection.subject,
      selection: {
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
  
    onSelect(selectedData);
  };

  const isSessionEnabled = selection.subject && selection.unit;


  const isRecommended = (id: string) => {
    if (!recommendations?.recommended_skills) return false;
    
    // Check if this ID or any child ID is in the recommendations
    const isDirectlyRecommended = recommendations.recommended_skills.includes(id);
    
    // If this is a unit, check if any of its skills or subskills are recommended
    if (syllabus?.curriculum) {
      const unit = syllabus.curriculum.find(u => u.id === id);
      if (unit) {
        const hasRecommendedChild = unit.skills.some(skill => 
          isRecommended(skill.id) || 
          skill.subskills.some(subskill => isRecommended(subskill.id))
        );
        return isDirectlyRecommended || hasRecommendedChild;
      }
  
      // If this is a skill, check if any of its subskills are recommended
      const skill = syllabus.curriculum
        .flatMap(u => u.skills)
        .find(s => s.id === id);
      if (skill) {
        const hasRecommendedChild = skill.subskills.some(subskill => 
          isRecommended(subskill.id)
        );
        return isDirectlyRecommended || hasRecommendedChild;
      }
    }
  
    // For subskills or if no children found, just check direct recommendation
    return isDirectlyRecommended;
  };

  if (loading && !syllabus) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          <span>Loading curriculum...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50 text-red-700">
        <p>{error}</p>
        <Button 
          variant="outline" 
          className="mt-2"
          onClick={() => {
            setError(null);
            setSelectedSubject('');
            setSyllabus(null);
            api.getSubjects().then(setSubjects);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="w-full">
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

      {syllabus?.curriculum && (
        <div className="border rounded-lg p-4 bg-white max-h-[60vh] overflow-y-auto">
          {syllabus.curriculum.map((unit) => (
            <TreeItem
              key={unit.id}
              id={unit.id}
              label={unit.title}
              hasChildren={!!unit.skills?.length}
              isSelected={selection.unit === unit.id}
              isRecommended={isRecommended(unit.id)}
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
      )}

      <Button 
        className="w-full" 
        onClick={handleStartSession}
        disabled={!isSessionEnabled}
      >
        Start Tutoring Session
      </Button>

      {process.env.NODE_ENV === 'development' && (
        <pre className="text-xs text-gray-500 mt-4">
          {JSON.stringify({ selectedSubject, selection, recommendations }, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default SyllabusSelector;