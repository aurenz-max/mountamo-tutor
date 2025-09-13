"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/contexts/AuthContext';
import { useEngagement } from '@/contexts/EngagementContext';
import { authApi } from '@/lib/authApiClient';

/**
 * Example component showing how to integrate engagement system
 * with daily activities and content packages
 */
export const EngagementExamples: React.FC = () => {
  const { userProfile } = useAuth();
  const { processEngagementResponse } = useEngagement();

  // Example: Complete a daily activity
  const handleCompleteDailyActivity = async () => {
    if (!userProfile?.student_id) return;

    try {
      const response = await authApi.completeDailyActivity(
        userProfile.student_id,
        'example-activity-123'
      );
      
      // Process the engagement response
      processEngagementResponse({
        activity_id: response.activity_id || 'daily_activity',
        xp_earned: response.xp_earned,
        points_earned: response.xp_earned,
        total_xp: 0, // Will be updated by background task
        level_up: response.level_up,
        new_level: response.new_level,
        badges_earned: []
      });

      console.log('Daily activity completed!', response);
    } catch (error) {
      console.error('Failed to complete daily activity:', error);
    }
  };

  // Example: Complete entire daily plan
  const handleCompleteDailyPlan = async () => {
    if (!userProfile?.student_id) return;

    try {
      const response = await authApi.completeDailyPlan(userProfile.student_id);
      
      processEngagementResponse({
        activity_id: response.activity_id || 'daily_plan',
        xp_earned: response.xp_earned,
        points_earned: response.xp_earned,
        total_xp: 0,
        level_up: response.level_up,
        new_level: response.new_level,
        badges_earned: []
      });

      console.log('Daily plan completed!', response);
    } catch (error) {
      console.error('Failed to complete daily plan:', error);
    }
  };

  // Example: Complete a package section
  const handleCompletePackageSection = async () => {
    try {
      const response = await authApi.completePackageSection(
        'example-package-id',
        'example-section-id'
      );
      
      processEngagementResponse({
        activity_id: response.activity_id || 'package_section',
        xp_earned: response.xp_earned,
        points_earned: response.xp_earned,
        total_xp: 0,
        level_up: response.level_up,
        new_level: response.new_level,
        badges_earned: []
      });

      console.log('Package section completed!', response);
    } catch (error) {
      console.error('Failed to complete package section:', error);
    }
  };

  // Example: Complete entire package
  const handleCompletePackage = async () => {
    try {
      const response = await authApi.completePackage('example-package-id');
      
      processEngagementResponse({
        activity_id: response.activity_id || 'package',
        xp_earned: response.xp_earned,
        points_earned: response.xp_earned,
        total_xp: 0,
        level_up: response.level_up,
        new_level: response.new_level,
        badges_earned: []
      });

      console.log('Package completed!', response);
    } catch (error) {
      console.error('Failed to complete package:', error);
    }
  };

  // Example: Manually trigger XP toast (for testing)
  const { showXPToast, showLevelUpModal } = useEngagement();
  
  const testXPToast = () => {
    showXPToast(25);
  };

  const testLevelUp = () => {
    showLevelUpModal(5);
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Engagement System Integration Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Daily Activities</h3>
              <Button 
                onClick={handleCompleteDailyActivity}
                className="w-full"
                variant="outline"
              >
                Complete Daily Activity (+50 XP)
              </Button>
              <Button 
                onClick={handleCompleteDailyPlan}
                className="w-full"
                variant="outline"
              >
                Complete Daily Plan (+150 XP Bonus)
              </Button>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold">Package Activities</h3>
              <Button 
                onClick={handleCompletePackageSection}
                className="w-full"
                variant="outline"
              >
                Complete Package Section (+20 XP)
              </Button>
              <Button 
                onClick={handleCompletePackage}
                className="w-full"
                variant="outline"
              >
                Complete Package (+200 XP Bonus)
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">Test UI Components</h3>
            <div className="flex gap-2">
              <Button onClick={testXPToast} variant="secondary">
                Test XP Toast
              </Button>
              <Button onClick={testLevelUp} variant="secondary">
                Test Level Up
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};