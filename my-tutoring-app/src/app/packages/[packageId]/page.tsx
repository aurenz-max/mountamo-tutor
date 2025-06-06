// Update your PackageDetailPage component with debugging
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Play, ArrowLeft, Clock, Users, Target, BookOpen, 
  Eye, Headphones, FileText, CheckCircle, Lightbulb 
} from 'lucide-react';
import { usePackageDetail } from '@/lib/packages/hooks';

interface PackageDetailPageProps {
  params: { packageId: string };
}

export default function PackageDetailPage({ params }: PackageDetailPageProps) {
  // Add extensive debugging
  console.log('=== PackageDetailPage Debug ===');
  console.log('Full params object:', params);
  console.log('packageId from params:', params.packageId);
  console.log('typeof packageId:', typeof params.packageId);
  console.log('packageId length:', params.packageId?.length);
  console.log('packageId is truthy:', !!params.packageId);
  
  const { package: pkg, loading, error } = usePackageDetail(params.packageId);
  
  console.log('Hook results:');
  console.log('- loading:', loading);
  console.log('- error:', error);
  console.log('- package:', pkg);
  console.log('================================');

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-32 mb-4" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-64 w-full" />
          </div>
          <div>
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <CardContent>
            <h2 className="text-xl font-semibold mb-2">Package Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {error || 'The requested package could not be found.'}
            </p>
            <div className="mb-4 p-4 bg-gray-100 rounded text-left text-sm">
              <strong>Debug Info:</strong><br />
              Package ID: {params.packageId}<br />
              Error: {error}<br />
              Package data: {pkg ? 'Found' : 'Not found'}
            </div>
            <Link href="/packages/browse">
              <Button>Browse All Packages</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rest of your existing component code...
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const estimatedTime = Math.ceil(pkg.content.reading.word_count / 200) + 
    (pkg.content.audio ? Math.ceil(pkg.content.audio.duration_seconds / 60) : 0) +
    (pkg.content.practice ? pkg.content.practice.estimated_time_minutes : 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Show debug info at the top temporarily */}
      <div className="mb-4 p-4 bg-green-100 rounded text-sm">
        <strong>Success! Package loaded:</strong><br />
        ID: {pkg.id}<br />
        Title: {pkg.content.reading.title}
      </div>
      
      {/* Rest of your existing JSX... */}
      <nav className="mb-6">
        <Link 
          href="/packages/browse" 
          className="text-muted-foreground hover:text-foreground flex items-center text-sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Browse
        </Link>
      </nav>

      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
              <span>{pkg.subject}</span>
              <span>•</span>
              <span>{pkg.skill}</span>
              <span>•</span>
              <span>{pkg.subskill}</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">{pkg.content.reading.title}</h1>
            <p className="text-xl text-muted-foreground mb-4">
              {pkg.master_context.core_concepts.slice(0, 2).join(' • ')}
            </p>
          </div>
          <Badge className={getDifficultyColor(pkg.master_context.difficulty_level)}>
            {pkg.master_context.difficulty_level}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            ~{estimatedTime} minutes
          </div>
          <div className="flex items-center">
            <Target className="h-4 w-4 mr-1" />
            {pkg.master_context.learning_objectives.length} learning objectives
          </div>
        </div>

        <Link href={`/packages/${pkg.id}/learn`}>
          <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Play className="h-5 w-5 mr-2" />
            Start Enhanced Learning Session
          </Button>
        </Link>
      </div>
    </div>
  );
}