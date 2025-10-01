"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLinkedStudents } from '@/hooks/useParentPortal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Link as LinkIcon, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LinkStudentPage() {
  const router = useRouter();
  const { linkStudent, refetch } = useLinkedStudents();

  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('parent');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate student ID
    const studentIdNum = parseInt(studentId);
    if (isNaN(studentIdNum) || studentIdNum <= 0) {
      setError('Please enter a valid student ID');
      return;
    }

    setLoading(true);

    try {
      await linkStudent(studentIdNum, relationship);
      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/parent/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Failed to link student:', err);
      setError(err.message || 'Failed to link student. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Link Student Account</h2>
        <p className="text-gray-600 mt-1">
          Connect your parent account to a student account to view their progress
        </p>
      </div>

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
            <LinkIcon className="h-5 w-5 text-purple-600" />
            <span>Link Student</span>
          </CardTitle>
          <CardDescription>
            Enter the student's ID and your relationship to them
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Student ID Input */}
            <div className="space-y-2">
              <Label htmlFor="student-id">Student ID *</Label>
              <Input
                id="student-id"
                type="number"
                placeholder="e.g., 12345"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={loading}
                required
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
                disabled={loading}
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

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Alert */}
            {success && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Student linked successfully! Redirecting to dashboard...
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <div className="flex space-x-3 pt-4">
              <Button
                type="submit"
                disabled={loading || success}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Linking...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Link Student
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/parent/dashboard')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Note */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <p className="font-semibold mb-1">Privacy & Security</p>
              <p className="text-yellow-800">
                For security, we recommend implementing email verification or a unique linking code
                in a future update. Currently, any parent can link to any student ID if they know it.
                Please only share the Student ID with trusted family members.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
