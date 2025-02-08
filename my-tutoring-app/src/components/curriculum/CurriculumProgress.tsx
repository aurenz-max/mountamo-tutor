'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Star, Trophy, BookOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ProgressBar = ({ value, className = "" }) => {
  // Ensure value is between 0 and 100
  const safeValue = Math.min(100, Math.max(0, value));
  
  // Color based on progress level
  const getColorClass = (val) => {
    if (val >= 80) return "bg-green-500";
    if (val >= 60) return "bg-blue-500";
    if (val >= 40) return "bg-yellow-500";
    return "bg-gray-500";
  };

  return (
    <div className={`h-2 bg-gray-200 rounded-full ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${getColorClass(safeValue)}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
};

const CompetencyBadge = ({ score }) => {
  // Define competency levels
  const levels = [
    { min: 90, label: "Expert", icon: Trophy, color: "text-yellow-500" },
    { min: 70, label: "Advanced", icon: Star, color: "text-blue-500" },
    { min: 50, label: "Intermediate", icon: BookOpen, color: "text-green-500" },
    { min: 0, label: "Beginner", icon: BookOpen, color: "text-gray-500" }
  ];

  const level = levels.find(l => score >= l.min) || levels[levels.length - 1];
  const Icon = level.icon;

  return (
    <div className={`flex items-center gap-1 ${level.color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{level.label}</span>
    </div>
  );
};

const SubskillItem = ({ subskill, progress }) => {
  const { id, description } = subskill;
  const subskillProgress = progress?.subskills?.[id] || { averageScore: 0, problems: 0 };
  
  return (
    <div className="ml-12 mb-2 last:mb-0">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">{description}</span>
            <span className="text-sm text-gray-500">
              {subskillProgress.problems} attempts
            </span>
          </div>
          <ProgressBar value={subskillProgress.averageScore * 10} />
        </div>
      </div>
    </div>
  );
};

const SkillItem = ({ skill, progress, expanded, onToggle }) => {
  const skillProgress = skill.subskills.reduce((acc, subskill) => {
    const subProgress = progress?.subskills?.[subskill.id];
    if (subProgress) {
      acc.totalScore += subProgress.averageScore;
      acc.count += 1;
    }
    return acc;
  }, { totalScore: 0, count: 0 });

  const averageScore = skillProgress.count ? 
    (skillProgress.totalScore / skillProgress.count) * 10 : 
    0;

  return (
    <div className="mb-4 last:mb-0">
      <div 
        className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
        onClick={onToggle}
      >
        {expanded ? 
          <ChevronDown className="h-5 w-5 text-gray-500" /> : 
          <ChevronRight className="h-5 w-5 text-gray-500" />
        }
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium">{skill.description}</div>
            <CompetencyBadge score={averageScore} />
          </div>
          <ProgressBar value={averageScore} />
        </div>
      </div>
      
      {expanded && (
        <div className="mt-2">
          {skill.subskills.map((subskill) => (
            <SubskillItem 
              key={subskill.id}
              subskill={subskill}
              progress={progress}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const UnitSection = ({ unit, progress, expanded, onToggle }) => {
  const [expandedSkills, setExpandedSkills] = useState(new Set());

  const unitProgress = unit.skills.reduce((acc, skill) => {
    const skillTotal = skill.subskills.reduce((skillAcc, subskill) => {
      const subProgress = progress?.subskills?.[subskill.id];
      if (subProgress) {
        skillAcc.totalScore += subProgress.averageScore;
        skillAcc.count += 1;
      }
      return skillAcc;
    }, { totalScore: 0, count: 0 });

    if (skillTotal.count) {
      acc.totalScore += skillTotal.totalScore / skillTotal.count;
      acc.count += 1;
    }
    return acc;
  }, { totalScore: 0, count: 0 });

  const averageScore = unitProgress.count ? 
    (unitProgress.totalScore / unitProgress.count) * 10 : 
    0;

  const toggleSkill = (skillId) => {
    setExpandedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  return (
    <Card className="mb-4">
      <CardHeader 
        className="cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {expanded ? 
            <ChevronDown className="h-5 w-5" /> : 
            <ChevronRight className="h-5 w-5" />
          }
          <CardTitle className="text-lg">{unit.title}</CardTitle>
        </div>
        <div className="flex items-center justify-between mt-2">
          <CompetencyBadge score={averageScore} />
          <span className="text-sm text-gray-500">
            {unitProgress.count} skills in progress
          </span>
        </div>
        <ProgressBar value={averageScore} className="mt-2" />
      </CardHeader>

      {expanded && (
        <CardContent>
          {unit.skills.map((skill) => (
            <SkillItem
              key={skill.id}
              skill={skill}
              progress={progress}
              expanded={expandedSkills.has(skill.id)}
              onToggle={() => toggleSkill(skill.id)}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
};

const CurriculumProgress = ({ curriculum, analytics }) => {
  const [expandedUnits, setExpandedUnits] = useState(new Set());

  const toggleUnit = (unitId) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  if (!curriculum?.length) {
    return (
      <Alert>
        <AlertDescription>
          No curriculum data available.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Curriculum Progress</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-sm">Mastered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-sm">Proficient</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span className="text-sm">Learning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-gray-500" />
            <span className="text-sm">Not Started</span>
          </div>
        </div>
      </div>

      {curriculum.map((unit) => (
        <UnitSection
          key={unit.id}
          unit={unit}
          progress={analytics?.detailedAnalytics?.currentStats}
          expanded={expandedUnits.has(unit.id)}
          onToggle={() => toggleUnit(unit.id)}
        />
      ))}
    </div>
  );
};

export default CurriculumProgress;