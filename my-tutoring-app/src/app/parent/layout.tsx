"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useParentAccount } from '@/hooks/useParentPortal';
import { Button } from '@/components/ui/button';
import { Users, Home, BarChart2, Compass, Clock, Settings } from 'lucide-react';

interface ParentLayoutProps {
  children: React.ReactNode;
}

export default function ParentLayout({ children }: ParentLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, loading: authLoading } = useAuth();
  const { parentAccount, loading: accountLoading } = useParentAccount();

  // Check if we're on the onboarding page
  const isOnboardingPage = pathname === '/parent/onboarding';

  // Redirect to onboarding if not completed (unless already on onboarding page)
  // IMPORTANT: This useEffect must be called before any conditional returns
  useEffect(() => {
    if (!authLoading && !accountLoading && userProfile && parentAccount) {
      if (!parentAccount.onboarding_completed && !isOnboardingPage) {
        router.push('/parent/onboarding');
      }
    }
  }, [authLoading, accountLoading, userProfile, parentAccount, isOnboardingPage, router]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !userProfile) {
      router.push('/login');
    }
  }, [authLoading, userProfile, router]);

  // Show loading state
  if (authLoading || accountLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading parent portal...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show loading (redirect will happen)
  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // If onboarding not completed, only show the onboarding page
  if (parentAccount && !parentAccount.onboarding_completed && isOnboardingPage) {
    return children;
  }

  // If onboarding not completed and not on onboarding page, show loading (redirect will happen)
  if (parentAccount && !parentAccount.onboarding_completed && !isOnboardingPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to onboarding...</p>
        </div>
      </div>
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/parent/dashboard', icon: Home },
    { name: 'Analytics', href: '/parent/analytics', icon: BarChart2 },
    { name: 'Weekly Explorer', href: '/parent/explorer', icon: Compass },
    { name: 'Session History', href: '/parent/sessions', icon: Clock },
    { name: 'Settings', href: '/parent/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Parent Portal</h1>
                <p className="text-sm text-gray-600">
                  {parentAccount?.display_name || parentAccount?.email || 'Welcome'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                Student View
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 overflow-x-auto pb-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = typeof window !== 'undefined' && window.location.pathname === item.href;

              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  className={`
                    flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium
                    transition-all duration-200 whitespace-nowrap
                    ${isActive
                      ? 'bg-blue-100 text-blue-700 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
