import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Grid, ChevronDown, ChevronRight } from "lucide-react";
import { api } from '@/lib/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const CurriculumHeatmap = ({ studentId, subject, onSelectSkill }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [expandedUnits, setExpandedUnits] = useState({});

  useEffect(() => {
    const fetchHeatmapData = async () => {
      if (!subject) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Get mastery heatmap data
        const data = await api.getMasteryAnalytics(studentId, subject);
        setHeatmapData(data);
        
        // Initialize expanded state for all units
        const expanded = {};
        data.mastery_map.forEach(unit => {
          expanded[unit.id] = false;
        });
        setExpandedUnits(expanded);
        
        setLoading(false);
      } catch (err) {
        setError('Failed to load curriculum heatmap');
        console.error('Error fetching curriculum heatmap:', err);
        setLoading(false);
      }
    };

    fetchHeatmapData();
  }, [studentId, subject]);
  
  const toggleUnitExpansion = (unitId) => {
    setExpandedUnits(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  // Function to get color based on mastery/score value
  const getMasteryColor = (value) => {
    // For light background colors (useful for backgrounds)
    if (value >= 80) return 'bg-green-100';
    if (value >= 60) return 'bg-blue-100';
    if (value >= 40) return 'bg-yellow-100';
    if (value > 0) return 'bg-red-100';
    return 'bg-gray-100';
  };
  
  // Function to get border color based on mastery/score value
  const getMasteryBorderColor = (value) => {
    // Darker border colors
    if (value >= 80) return 'border-green-500';
    if (value >= 60) return 'border-blue-500';
    if (value >= 40) return 'border-yellow-500';
    if (value > 0) return 'border-red-500';
    return 'border-gray-500';
  };
  
  // Function to get text color based on mastery/score value
  const getMasteryTextColor = (value) => {
    if (value >= 80) return 'text-green-800';
    if (value >= 60) return 'text-blue-800';
    if (value >= 40) return 'text-yellow-800';
    if (value > 0) return 'text-red-800';
    return 'text-gray-800';
  };
  
  const handleSkillClick = (unitId, skillId) => {
    if (onSelectSkill) {
      onSelectSkill(unitId, skillId);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid className="h-5 w-5" />
          Curriculum Mastery Map
        </CardTitle>
        <CardDescription>
          Visual breakdown of curriculum mastery and performance
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6">
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : heatmapData ? (
          <div className="overflow-y-auto max-h-[400px]">
            <div className="grid grid-cols-5 gap-1 px-4 py-2 bg-muted text-xs font-medium">
              <div className="col-span-2">Unit/Skill</div>
              <div className="text-center">Mastery</div>
              <div className="text-center">Score</div>
              <div className="text-center">Coverage</div>
            </div>
            
            <div className="space-y-1 px-2 py-2">
              {heatmapData.mastery_map.map((unit) => (
                <Collapsible 
                  key={unit.id}
                  open={expandedUnits[unit.id]}
                  onOpenChange={() => toggleUnitExpansion(unit.id)}
                  className="border rounded-md overflow-hidden"
                >
                  <CollapsibleTrigger className="w-full text-left p-2 hover:bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center">
                      {expandedUnits[unit.id] ? (
                        <ChevronDown className="h-4 w-4 mr-2 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0" />
                      )}
                      <span className="font-medium truncate">{unit.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-8 h-6 rounded text-center text-xs py-1 ${getMasteryColor(unit.mastery)} ${getMasteryTextColor(unit.mastery)}`}>
                        {unit.mastery.toFixed(0)}%
                      </span>
                      <span className={`inline-block w-8 h-6 rounded text-center text-xs py-1 ${getMasteryColor(unit.average_score)} ${getMasteryTextColor(unit.average_score)}`}>
                        {unit.average_score.toFixed(0)}%
                      </span>
                      <span className={`inline-block w-8 h-6 rounded text-center text-xs py-1 ${getMasteryColor(unit.completion)} ${getMasteryTextColor(unit.completion)}`}>
                        {unit.completion.toFixed(0)}%
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="border-t">
                      {unit.skills.map((skill) => (
                        <div 
                          key={skill.id}
                          className="grid grid-cols-5 gap-1 px-2 py-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleSkillClick(unit.id, skill.id)}
                        >
                          <div className="col-span-2 pl-6 truncate">
                            {skill.description}
                          </div>
                          <div className="flex justify-center">
                            <span className={`inline-block w-8 h-6 rounded text-xs py-1 text-center ${getMasteryColor(skill.mastery)} ${getMasteryTextColor(skill.mastery)}`}>
                              {skill.mastery.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-center">
                            <span className={`inline-block w-8 h-6 rounded text-xs py-1 text-center ${getMasteryColor(skill.average_score)} ${getMasteryTextColor(skill.average_score)}`}>
                              {skill.average_score.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-center">
                            <span className={`inline-block w-8 h-6 rounded text-xs py-1 text-center ${getMasteryColor(skill.completion)} ${getMasteryTextColor(skill.completion)}`}>
                              {skill.completion.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
            
            <div className="bg-muted p-3 flex items-center justify-between text-sm">
              <div>Subject Overall:</div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1">
                  <span>Mastery:</span>
                  <span className={`inline-block px-2 py-0.5 rounded ${getMasteryColor(heatmapData.subject_mastery)} ${getMasteryTextColor(heatmapData.subject_mastery)}`}>
                    {heatmapData.subject_mastery.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span>Coverage:</span>
                  <span className={`inline-block px-2 py-0.5 rounded ${getMasteryColor(heatmapData.subject_completion)} ${getMasteryTextColor(heatmapData.subject_completion)}`}>
                    {heatmapData.subject_completion.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-sm text-muted-foreground">
            Select a subject to view curriculum heatmap
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CurriculumHeatmap;