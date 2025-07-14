// app/daily-learning/[subskillId]/page.tsx
// This page now serves as a redirect/fallback since the card-based interface 
// eliminates the need for the intermediate learning hub screen

"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SubskillPageProps {
  params: {
    subskillId: string;
  };
}

export default function SubskillPage({ params }: SubskillPageProps) {
  const { userProfile } = useAuth();
  const router = useRouter();
  const { subskillId } = params;

  // Auto-redirect to dashboard since we now use card-based interface
  useEffect(() => {
    // Small delay to show the redirect message
    const timer = setTimeout(() => {
      router.push('/dashboard');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  const handleBackToDashboard = () => {
    router.push('/dashboard');
  };

  if (!userProfile) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading user profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <Button 
          onClick={handleBackToDashboard}
          variant="ghost" 
          className="flex items-center text-gray-600 mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Redirect Message */}
      <div className="max-w-2xl mx-auto">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center text-blue-800">
              <Info className="mr-2 h-5 w-5" />
              Learning Experience Updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-blue-700">
                We've improved the learning experience! Instead of navigating to separate pages, 
                you can now choose your learning method directly from the activity cards on your dashboard.
              </p>
              
              <div className="bg-white border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">What's New:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Click any activity card to see learning options</li>
                  <li>• Choose from AI Tutoring, Practice Problems, Educational Content, or Projects</li>
                  <li>• No more intermediate screens - go straight to learning!</li>
                </ul>
              </div>

              <div className="pt-2">
                <p className="text-sm text-blue-600 mb-3">
                  You're being redirected to the dashboard where you can find the activity for <strong>{subskillId}</strong>.
                </p>
                
                <Button 
                  onClick={handleBackToDashboard}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Go to Dashboard Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}