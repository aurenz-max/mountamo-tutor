'use client';



import React, { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import { RotateCcw, CheckCircle } from 'lucide-react';

import { api, DecisionTreeData } from '@/lib/api';

import { CurriculumData, Skill, SubSkill } from '@/lib/api-interfaces';

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

    const [completedChoices, setCompletedChoices] = useState(new Set());

    const [unlockedPaths, setUnlockedPaths] = useState<string[]>(['COUNT001-01']);

    const [curriculumData, setCurriculumData] = useState<CurriculumData | null>(null);

    const [decisionTreeData, setDecisionTreeData] = useState<DecisionTreeData | null>(null);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState<Error | null>(null);

    const [currentSkillId, setCurrentSkillId] = useState<string | null>(null);

    const [competencyScores, setCompetencyScores] = useState<Map<string, CompetencyData>>(new Map());

    const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);



    useEffect(() => {

        const fetchData = async () => {

            setLoading(true);

            setError(null);

            try {

                const curriculum = await api.getSubjectCurriculum('Mathematics');

                setCurriculumData(curriculum);

                const pathsData = await api.getLearningPaths();

                setDecisionTreeData(pathsData);

                setLoading(false);

            } catch (e) {

                if (e instanceof Error) {

                    setError(e);

                } else {

                    setError(new Error('Failed to load data'));

                }

                setLoading(false);

            }

        };

        fetchData();

    }, []);



    const fetchCompetencyForSkill = async (skillId: string, subskillId: string) => {

        try {

            let competency;

            if (subskillId) {

                competency = await api.getSubskillCompetency({

                    student_id: 1,

                    subject: 'Mathematics',

                    skill: skillId,

                    subskill: subskillId,

                });

            } else {

                competency = await api.getSkillCompetency({

                    student_id: 1,

                    subject: 'Mathematics',

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



    const handleChoice = async (choice: string) => {

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

      setExpandedSkillId(prevExpandedSkillId => {

          const isExpanding = prevExpandedSkillId !== skillId;

          if (isExpanding && curriculumData) {

              const selectedSkill = curriculumData.curriculum

                  .flatMap(unit => unit.skills)

                  .find(skill => skill.id === skillId);

                  

              if (selectedSkill) {

                  // Fetch skill level competency first

                  fetchCompetencyForSkill(skillId, '');

                  

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

        setUnlockedPaths(['COUNT001-01']);

        setCurrentSkillId(null);

        setCompetencyScores(new Map());

        setExpandedSkillId(null);

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



    if (loading) {

        return <Card className="w-full max-w-4xl mx-auto"><CardContent className="p-6">Loading curriculum data...</CardContent></Card>;

    }



    if (error) {

        return <Card className="w-full max-w-4xl mx-auto"><CardContent className="p-6">Error loading curriculum data...</CardContent></Card>;

    }



    if (!curriculumData) {

        return <Card className="w-full max-w-4xl mx-auto"><CardContent className="p-6">No curriculum data available.</CardContent></Card>;

    }



    const allSkillsCount = curriculumData.curriculum.flatMap(unit => unit.skills).length;

    const availableChoices = getAvailableChoices();



    return (

        <Card className="w-full max-w-4xl mx-auto">

            <CardContent className="p-6">

                <div className="mb-6">

                    <div className="flex justify-between items-center mb-4">

                        <h2 className="text-xl font-bold">Decision Navigator</h2>

                        <div className="flex items-center gap-4">

                            <span className="text-sm">

                                Progress: {completedChoices.size}/{allSkillsCount} Choices

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

                                                                  <CardContent className="flex justify-around p-0 border-t mt-4">

                                                                      <Button variant="secondary" size="sm">Teaching</Button>

                                                                       <Button variant="secondary" size="sm">Practice</Button>

                                                              </CardContent>

                                                              </Card>

                                                          );

                                                      })}

                                                  </div>

                                              </div>

                                          )}

                                          {!expandedSkillId === choiceItem.choice && (

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

                                All Choices Complete!

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

                    <h4 className="font-semibold mb-2">Completed Choices:</h4>

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