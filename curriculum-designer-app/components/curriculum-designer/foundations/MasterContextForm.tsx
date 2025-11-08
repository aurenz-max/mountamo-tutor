'use client';

/**
 * Master Context Form
 * Edits core concepts, terminology, learning objectives, and applications
 */

import { useState } from 'react';
import { Plus, X, BookOpen, Target, Lightbulb, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { MasterContext } from '@/types/foundations';

interface MasterContextFormProps {
  data: MasterContext;
  onChange: (data: MasterContext) => void;
}

export function MasterContextForm({ data, onChange }: MasterContextFormProps) {
  const [newConcept, setNewConcept] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newApplication, setNewApplication] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newDefinition, setNewDefinition] = useState('');

  // Add core concept
  const addConcept = () => {
    if (!newConcept.trim()) return;
    onChange({
      ...data,
      core_concepts: [...data.core_concepts, newConcept.trim()],
    });
    setNewConcept('');
  };

  // Remove core concept
  const removeConcept = (index: number) => {
    onChange({
      ...data,
      core_concepts: data.core_concepts.filter((_, i) => i !== index),
    });
  };

  // Add learning objective
  const addObjective = () => {
    if (!newObjective.trim()) return;
    onChange({
      ...data,
      learning_objectives: [...data.learning_objectives, newObjective.trim()],
    });
    setNewObjective('');
  };

  // Remove learning objective
  const removeObjective = (index: number) => {
    onChange({
      ...data,
      learning_objectives: data.learning_objectives.filter((_, i) => i !== index),
    });
  };

  // Add real-world application
  const addApplication = () => {
    if (!newApplication.trim()) return;
    onChange({
      ...data,
      real_world_applications: [...data.real_world_applications, newApplication.trim()],
    });
    setNewApplication('');
  };

  // Remove real-world application
  const removeApplication = (index: number) => {
    onChange({
      ...data,
      real_world_applications: data.real_world_applications.filter((_, i) => i !== index),
    });
  };

  // Add terminology
  const addTerminology = () => {
    if (!newTerm.trim() || !newDefinition.trim()) return;
    onChange({
      ...data,
      key_terminology: {
        ...data.key_terminology,
        [newTerm.trim()]: newDefinition.trim(),
      },
    });
    setNewTerm('');
    setNewDefinition('');
  };

  // Remove terminology
  const removeTerminology = (term: string) => {
    const { [term]: _, ...rest } = data.key_terminology;
    onChange({
      ...data,
      key_terminology: rest,
    });
  };

  return (
    <div className="space-y-4">
      {/* Core Concepts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Core Concepts
          </CardTitle>
          <CardDescription>
            4-6 fundamental concepts students must understand
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {data.core_concepts.map((concept, index) => (
              <Badge key={index} variant="secondary" className="text-sm py-1 px-3">
                {concept}
                <button
                  onClick={() => removeConcept(index)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add a core concept..."
              value={newConcept}
              onChange={(e) => setNewConcept(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addConcept()}
            />
            <Button onClick={addConcept} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Terminology */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Key Terminology
          </CardTitle>
          <CardDescription>
            Important terms and their definitions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {Object.entries(data.key_terminology).map(([term, definition]) => (
              <div key={term} className="flex items-start gap-2 p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{term}</div>
                  <div className="text-sm text-muted-foreground">{definition}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTerminology(term)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
            <div>
              <Label htmlFor="new-term">Term</Label>
              <Input
                id="new-term"
                placeholder="e.g., Algorithm"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="new-definition">Definition</Label>
              <Textarea
                id="new-definition"
                placeholder="e.g., A step-by-step procedure for solving a problem"
                value={newDefinition}
                onChange={(e) => setNewDefinition(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={addTerminology} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Term
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Learning Objectives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Learning Objectives
          </CardTitle>
          <CardDescription>
            4-6 specific, measurable learning goals
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {data.learning_objectives.map((objective, index) => (
              <div key={index} className="flex items-start gap-2 p-2 border rounded">
                <span className="text-sm flex-1">{objective}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeObjective(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a learning objective..."
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              rows={2}
            />
            <Button onClick={addObjective} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Real-World Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Real-World Applications
          </CardTitle>
          <CardDescription>
            Practical examples where this skill is used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {data.real_world_applications.map((application, index) => (
              <div key={index} className="flex items-start gap-2 p-2 border rounded">
                <span className="text-sm flex-1">{application}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeApplication(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a real-world application..."
              value={newApplication}
              onChange={(e) => setNewApplication(e.target.value)}
              rows={2}
            />
            <Button onClick={addApplication} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Read-Only Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Context Information (Read-Only)</CardTitle>
          <CardDescription>
            These fields are derived from the subskill metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Difficulty Level</Label>
            <div className="text-sm text-muted-foreground">{data.difficulty_level}</div>
          </div>
          <div>
            <Label>Grade Level</Label>
            <div className="text-sm text-muted-foreground">{data.grade_level}</div>
          </div>
          <div>
            <Label>Prerequisites</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {data.prerequisites.map((prereq, index) => (
                <Badge key={index} variant="outline">
                  {prereq}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
