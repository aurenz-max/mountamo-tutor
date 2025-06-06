// components/packages/PackageCard.tsx
import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Play, Headphones, BookOpen, FileText } from 'lucide-react';
import type { PackageCard } from '@/lib/packages/types';

interface PackageCardProps {
  package: PackageCard;
}

export function PackageCard({ package: pkg }: PackageCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-2 mb-2">{pkg.title}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {pkg.subject} • {pkg.skill} • {pkg.subskill}
            </CardDescription>
          </div>
          <Badge className={getDifficultyColor(pkg.difficulty_level)}>
            {pkg.difficulty_level}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Description */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {pkg.description.slice(0, 2).join(' • ')}
          </p>
        </div>

        {/* Learning Objectives Preview */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Learning Goals:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            {pkg.learning_objectives.slice(0, 2).map((objective, index) => (
              <li key={index} className="line-clamp-2">• {objective}</li>
            ))}
            {pkg.learning_objectives.length > 2 && (
              <li className="text-blue-600">+ {pkg.learning_objectives.length - 2} more...</li>
            )}
          </ul>
        </div>

        {/* Resource Icons */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2">Available Resources:</h4>
          <div className="flex space-x-3">
            <div className="flex items-center text-xs text-muted-foreground">
              <BookOpen className="h-4 w-4 mr-1 text-blue-600" />
              Reading
            </div>
            {pkg.has_visual && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Eye className="h-4 w-4 mr-1 text-green-600" />
                Visual
              </div>
            )}
            {pkg.has_audio && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Headphones className="h-4 w-4 mr-1 text-purple-600" />
                Audio
              </div>
            )}
            {pkg.has_practice && (
              <div className="flex items-center text-xs text-muted-foreground">
                <FileText className="h-4 w-4 mr-1 text-orange-600" />
                Practice
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-auto space-y-2">
          <Link href={`/packages/${pkg.id}`} className="w-full">
            <Button variant="outline" className="w-full">
              <Eye className="h-4 w-4 mr-2" />
              Preview Package
            </Button>
          </Link>
          <Link href={`/packages/${pkg.id}/learn`} className="w-full">
            <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Play className="h-4 w-4 mr-2" />
              Start Enhanced Session
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}