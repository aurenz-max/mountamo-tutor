// app/(dashboard)/learning-paths/page.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import LearningPaths from '@/components/tutoring/LearningPaths';

export default function LearningPathsPage() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Learning Paths</h1>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This visualization shows the primary learning paths through the curriculum.
          Each color represents a different recommended learning sequence. Click the path
          buttons to highlight specific sequences.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Curriculum Learning Paths</CardTitle>
        </CardHeader>
        <CardContent>
          <LearningPaths />
        </CardContent>
      </Card>
    </div>
  );
}