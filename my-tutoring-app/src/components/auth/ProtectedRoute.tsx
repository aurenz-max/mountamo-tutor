// components/auth/ProtectedRoute.tsx
'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Brain } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireProfile?: boolean; // Whether user needs a complete profile
}

const LoadingSpinner: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <div className="bg-white p-4 rounded-full shadow-lg mb-4 mx-auto w-16 h-16 flex items-center justify-center">
        <Brain className="h-8 w-8 text-blue-600" />
      </div>
      <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
      <p className="text-gray-600">Loading your learning environment...</p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireProfile = false 
}) => {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // User is not authenticated, redirect to login
        router.push('/login');
      } else if (requireProfile && !userProfile) {
        // User is authenticated but doesn't have a profile
        // Could redirect to profile setup page
        router.push('/setup-profile');
      }
    }
  }, [user, userProfile, loading, router, requireProfile]);

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingSpinner />;
  }

  // If user is not authenticated, don't render children
  // (redirect will happen in useEffect)
  if (!user) {
    return <LoadingSpinner />;
  }

  // If profile is required but doesn't exist, don't render children
  if (requireProfile && !userProfile) {
    return <LoadingSpinner />;
  }

  // User is authenticated (and has profile if required), render children
  return <>{children}</>;
};

export default ProtectedRoute;