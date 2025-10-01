"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
  Users, ChevronRight, ChevronLeft, Sparkles, Target, BarChart2,
  Compass, Home, AlertCircle, CheckCircle2, Heart, Bell, TrendingUp, Loader2
} from 'lucide-react';
import parentPortalApi from '@/lib/parentPortalApi';
import { useLinkedStudents, useParentAccount } from '@/hooks/useParentPortal';

interface OnboardingStep {
  title: string;
  subtitle: string;
}

const steps: OnboardingStep[] = [
  { title: "Welcome to the Parent Portal!", subtitle: "Let's get you set up in just a few minutes" },
  { title: "Link Your First Student", subtitle: "Connect to your child's account to get started" },
  { title: "Set Your Preferences", subtitle: "Choose how you'd like to stay informed" },
  { title: "You're All Set!", subtitle: "Ready to support your child's learning journey" }
];

export default function ParentOnboardingFlow() {
  const router = useRouter();
  const { linkStudent, refetch } = useLinkedStudents();
  const { refetch: refetchParentAccount } = useParentAccount();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Link Student State
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [studentLinked, setStudentLinked] = useState(false);

  // Step 3: Notification Preferences
  const [notificationPreferences, setNotificationPreferences] = useState({
    weekly_digest: true,
    daily_summary: false,
    milestone_alerts: true,
    struggle_alerts: true
  });

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleLinkStudent = async () => {
    setError(null);

    const studentIdNum = parseInt(studentId);
    if (isNaN(studentIdNum) || studentIdNum <= 0) {
      setError('Please enter a valid student ID');
      return;
    }

    setLoading(true);
    try {
      await linkStudent(studentIdNum, relationship);
      setStudentLinked(true);
      await refetch();

      // Auto-advance after 1 second
      setTimeout(() => {
        handleNext();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to link student:', err);
      setError(err.message || 'Failed to link student. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);

    try {
      await parentPortalApi.completeOnboarding(notificationPreferences);

      // Refetch parent account to update onboarding_completed flag
      await refetchParentAccount();

      // Redirect to dashboard
      router.push('/parent/dashboard');
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      setError(err.message || 'Failed to complete onboarding. Please try again.');
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0: return true; // Welcome
      case 1: return studentLinked; // Link Student
      case 2: return true; // Preferences
      case 3: return true; // Complete
      default: return false;
    }
  };

  const renderWelcomeStep = () => (
    <div className="text-center max-w-2xl mx-auto space-y-8">
      <div>
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Users className="w-10 h-10 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to the Parent Portal!</h1>
        <p className="text-lg text-gray-600 mb-8">
          Get weekly insights, track progress, and discover fun ways to support your child's learning journey.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2">
          <CardContent className="pt-6">
            <Home className="w-8 h-8 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Dashboard</h3>
            <p className="text-sm text-gray-600">
              See today's plan and weekly progress at a glance
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <BarChart2 className="w-8 h-8 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Analytics</h3>
            <p className="text-sm text-gray-600">
              Dive deep into mastery and performance over time
            </p>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="pt-6">
            <Compass className="w-8 h-8 text-purple-600 mx-auto mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Weekly Explorer</h3>
            <p className="text-sm text-gray-600">
              Plan ahead with hands-on projects for upcoming topics
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-gray-500">This will only take about 2-3 minutes</p>
    </div>
  );

  const renderLinkStudentStep = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">How to find the Student ID:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Ask your child to log into their student account</li>
                <li>Navigate to their profile or settings page</li>
                <li>The Student ID will be displayed there</li>
                <li>Enter that ID below to link your accounts</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-purple-600" />
            <span>Link Student</span>
          </CardTitle>
          <CardDescription>
            Enter the student's ID and your relationship to them
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Student ID Input */}
          <div className="space-y-2">
            <Label htmlFor="student-id">Student ID *</Label>
            <Input
              id="student-id"
              type="number"
              placeholder="e.g., 12345"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              disabled={loading || studentLinked}
              className="text-lg"
            />
            <p className="text-xs text-gray-600">
              The numeric ID from the student's account
            </p>
          </div>

          {/* Relationship Select */}
          <div className="space-y-2">
            <Label htmlFor="relationship">Relationship *</Label>
            <Select
              value={relationship}
              onValueChange={setRelationship}
              disabled={loading || studentLinked}
            >
              <SelectTrigger id="relationship">
                <SelectValue placeholder="Select your relationship" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="guardian">Guardian</SelectItem>
                <SelectItem value="tutor">Tutor</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="mentor">Mentor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Success Alert */}
          {studentLinked && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Student linked successfully! Moving to next step...
              </AlertDescription>
            </Alert>
          )}

          {/* Link Button */}
          {!studentLinked && (
            <Button
              onClick={handleLinkStudent}
              disabled={loading || !studentId}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Linking...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Link Student
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderPreferencesStep = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-orange-600" />
            <span>Notification Preferences</span>
          </CardTitle>
          <CardDescription>
            Choose how you'd like to stay informed about your child's progress
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Weekly Digest */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="weekly-digest" className="text-base font-medium">
                Weekly Digest Email
              </Label>
              <p className="text-sm text-gray-600">
                Receive a summary of your child's progress every Monday
              </p>
            </div>
            <Switch
              id="weekly-digest"
              checked={notificationPreferences.weekly_digest}
              onCheckedChange={(checked) =>
                setNotificationPreferences({ ...notificationPreferences, weekly_digest: checked })
              }
            />
          </div>

          <div className="border-t" />

          {/* Milestone Alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="milestone-alerts" className="text-base font-medium">
                Milestone Alerts
              </Label>
              <p className="text-sm text-gray-600">
                Get notified when your child masters a new skill
              </p>
            </div>
            <Switch
              id="milestone-alerts"
              checked={notificationPreferences.milestone_alerts}
              onCheckedChange={(checked) =>
                setNotificationPreferences({ ...notificationPreferences, milestone_alerts: checked })
              }
            />
          </div>

          <div className="border-t" />

          {/* Struggle Alerts */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="struggle-alerts" className="text-base font-medium">
                Struggle Alerts
              </Label>
              <p className="text-sm text-gray-600">
                Be alerted when your child seems to be stuck on a topic
              </p>
            </div>
            <Switch
              id="struggle-alerts"
              checked={notificationPreferences.struggle_alerts}
              onCheckedChange={(checked) =>
                setNotificationPreferences({ ...notificationPreferences, struggle_alerts: checked })
              }
            />
          </div>

          <div className="border-t" />

          {/* Daily Summary */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="daily-summary" className="text-base font-medium">
                Daily Summary
              </Label>
              <p className="text-sm text-gray-600">
                Get a brief daily update about today's activities
              </p>
            </div>
            <Switch
              id="daily-summary"
              checked={notificationPreferences.daily_summary}
              onCheckedChange={(checked) =>
                setNotificationPreferences({ ...notificationPreferences, daily_summary: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="py-4">
          <p className="text-sm text-purple-900">
            <strong>Note:</strong> You can change these preferences anytime in your settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderCompletionStep = () => (
    <div className="text-center max-w-2xl mx-auto space-y-8">
      <div>
        <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">You're All Set!</h1>
        <p className="text-lg text-gray-600 mb-8">
          You're ready to start supporting your child's learning journey with powerful insights and actionable recommendations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6 text-center">
            <Home className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-gray-900">Dashboard</h3>
            <p className="text-xs text-gray-600 mt-1">
              Your at-a-glance view of today's plan and weekly progress
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6 text-center">
            <Compass className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-gray-900">Weekly Explorer</h3>
            <p className="text-xs text-gray-600 mt-1">
              Plan ahead with hands-on projects for upcoming topics
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6 text-center">
            <BarChart2 className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold text-sm text-gray-900">Analytics</h3>
            <p className="text-xs text-gray-600 mt-1">
              Dive deep into mastery and performance over time
            </p>
          </CardContent>
        </Card>
      </div>

      <Button
        onClick={handleFinish}
        disabled={loading}
        size="lg"
        className="w-full max-w-md mx-auto"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Setting up your dashboard...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Go to Dashboard
          </>
        )}
      </Button>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderWelcomeStep();
      case 1: return renderLinkStudentStep();
      case 2: return renderPreferencesStep();
      case 3: return renderCompletionStep();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Step {currentStep + 1} of {steps.length}</span>
            <span className="text-sm text-gray-600">{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Title */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">{steps[currentStep].title}</h2>
          <p className="text-gray-600 mt-2">{steps[currentStep].subtitle}</p>
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <div className="mb-8">
          {renderCurrentStep()}
        </div>

        {/* Navigation */}
        {currentStep < steps.length - 1 && (
          <div className="flex justify-between max-w-2xl mx-auto">
            <Button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              variant="outline"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            <Button
              onClick={handleNext}
              disabled={!isStepValid() || loading}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
