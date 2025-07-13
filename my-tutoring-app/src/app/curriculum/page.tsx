// app/(dashboard)/curriculum/page.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen } from "lucide-react";
import CurriculumExplorer from '@/components/curriculum/CurriculumExplorer';

export default function CurriculumPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Curriculum Overview</h1>
      </div>

      <Alert>
        <BookOpen className="h-4 w-4" />
        <AlertDescription>
          Explore the complete curriculum structure organized by subjects, units, skills, and subskills.
          Track your progress and competency levels across all learning objectives. Click to expand
          sections and view detailed information about each component.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Interactive Curriculum Explorer</CardTitle>
        </CardHeader>
        <CardContent>
          <CurriculumExplorer />
        </CardContent>
      </Card>
    </div>
  );
}