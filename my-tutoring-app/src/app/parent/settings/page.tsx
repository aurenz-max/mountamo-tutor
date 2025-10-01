"use client";

import React, { useState } from 'react';
import { useParentAccount } from '@/hooks/useParentPortal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Bell, Mail, User, Shield } from 'lucide-react';

export default function ParentSettingsPage() {
  const { parentAccount, loading, error } = useParentAccount();
  const [saving, setSaving] = useState(false);

  const [notifications, setNotifications] = useState({
    weekly_digest: parentAccount?.notification_preferences?.weekly_digest ?? true,
    daily_summary: parentAccount?.notification_preferences?.daily_summary ?? false,
    milestone_alerts: parentAccount?.notification_preferences?.milestone_alerts ?? true,
    struggle_alerts: parentAccount?.notification_preferences?.struggle_alerts ?? true,
  });

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      // TODO: Implement save notification preferences endpoint
      console.log('Saving notification preferences:', notifications);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-8 text-center">
          <p className="text-red-600">Failed to load settings: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-600 mt-1">Manage your parent portal preferences</p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-blue-600" />
            <span>Account Information</span>
          </CardTitle>
          <CardDescription>Your parent account details</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-gray-600">Email</Label>
            <p className="font-medium text-gray-900">{parentAccount?.email}</p>
          </div>

          <div>
            <Label className="text-sm text-gray-600">Display Name</Label>
            <p className="font-medium text-gray-900">
              {parentAccount?.display_name || 'Not set'}
            </p>
          </div>

          <div>
            <Label className="text-sm text-gray-600">Account Status</Label>
            <div className="flex items-center space-x-2 mt-1">
              {parentAccount?.email_verified ? (
                <Badge variant="default" className="flex items-center space-x-1">
                  <Shield className="h-3 w-3" />
                  <span>Verified</span>
                </Badge>
              ) : (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Shield className="h-3 w-3" />
                  <span>Unverified</span>
                </Badge>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm text-gray-600">Linked Students</Label>
            <p className="font-medium text-gray-900">
              {parentAccount?.linked_student_ids?.length || 0} student(s)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-purple-600" />
            <span>Notification Preferences</span>
          </CardTitle>
          <CardDescription>
            Choose how you want to receive updates about your child's progress
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Weekly Digest */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <Mail className="h-4 w-4 text-blue-600" />
                <Label htmlFor="weekly-digest" className="font-medium">
                  Weekly Digest
                </Label>
              </div>
              <p className="text-sm text-gray-600">
                Receive a comprehensive weekly summary every Sunday evening
              </p>
            </div>
            <Switch
              id="weekly-digest"
              checked={notifications.weekly_digest}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, weekly_digest: checked })
              }
            />
          </div>

          {/* Daily Summary */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <Mail className="h-4 w-4 text-green-600" />
                <Label htmlFor="daily-summary" className="font-medium">
                  Daily Summary
                </Label>
              </div>
              <p className="text-sm text-gray-600">
                Get a quick daily recap of what your child learned each evening
              </p>
            </div>
            <Switch
              id="daily-summary"
              checked={notifications.daily_summary}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, daily_summary: checked })
              }
            />
          </div>

          {/* Milestone Alerts */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <Bell className="h-4 w-4 text-yellow-600" />
                <Label htmlFor="milestone-alerts" className="font-medium">
                  Milestone Alerts
                </Label>
              </div>
              <p className="text-sm text-gray-600">
                Get notified when your child achieves important learning milestones
              </p>
            </div>
            <Switch
              id="milestone-alerts"
              checked={notifications.milestone_alerts}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, milestone_alerts: checked })
              }
            />
          </div>

          {/* Struggle Alerts */}
          <div className="flex items-start justify-between space-x-4">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <Bell className="h-4 w-4 text-orange-600" />
                <Label htmlFor="struggle-alerts" className="font-medium">
                  Support Alerts
                </Label>
              </div>
              <p className="text-sm text-gray-600">
                Receive alerts when your child might benefit from extra support
              </p>
            </div>
            <Switch
              id="struggle-alerts"
              checked={notifications.struggle_alerts}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, struggle_alerts: checked })
              }
            />
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={handleSaveNotifications}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy & Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-green-600" />
            <span>Privacy & Security</span>
          </CardTitle>
          <CardDescription>Manage your account security and privacy</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-900 mb-2 block">
              Account Created
            </Label>
            <p className="text-sm text-gray-600">
              {parentAccount?.created_at
                ? new Date(parentAccount.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Unknown'}
            </p>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-900 mb-2 block">
              Last Login
            </Label>
            <p className="text-sm text-gray-600">
              {parentAccount?.last_login
                ? new Date(parentAccount.last_login).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Never'}
            </p>
          </div>

          <div className="pt-4 border-t">
            <Button variant="outline" className="w-full sm:w-auto">
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
