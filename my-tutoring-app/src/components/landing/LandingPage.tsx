// components/LandingPage.tsx
'use client';

import React from 'react';
import { Brain, BookOpen, Puzzle, LayoutDashboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface LandingPageProps {
  onSelectMode?: (mode: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectMode }) => {
  const router = useRouter();
  const { user } = useAuth();

  const modes = [
    {
      title: "AI Tutor",
      description: "Learn naturally through conversation",
      icon: Brain,
      price: "All subjects included",
      badge: "NEW",
      path: "/tutoring"
    },
    {
      title: "Practice Mode",
      description: "Master concepts through guided practice",
      icon: Puzzle,
      price: "Personalized feedback",
      path: "/practice"
    },
    {
      title: "Guided Learning",
      description: "Interactive Tutoring",
      icon: BookOpen,
      price: "All Grades K-12",
      path: "/packages"
    },
    {
      title: "Learning Dashboard",
      description: "Track progress and get personalized recommendations",
      icon: LayoutDashboard,
      price: "All learning activities",
      badge: "FEATURED",
      path: "/dashboard"
    }
  ];

  const handleModeSelect = (mode: typeof modes[0]) => {
    if (onSelectMode) {
      onSelectMode(mode.title);
    } else {
      // Check if user is authenticated
      if (!user) {
        // Redirect to login with intended destination
        router.push(`/login?redirect=${encodeURIComponent(mode.path)}`);
      } else {
        // User is authenticated, go to the mode
        router.push(mode.path);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      {!user && (
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            AI-Powered Learning
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Personalized education that adapts to your learning style. 
            Get instant feedback, track your progress, and achieve your goals faster.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Get Started Free
            </button>
            <button
              onClick={() => router.push('/login')}
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Modes Section */}
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">
          {user ? 'Welcome back!' : 'All learning styles.'}
        </h2>
        <h3 className="text-3xl text-gray-500">
          {user ? 'Continue your journey.' : 'Take your pick.'}
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <div 
              key={mode.title}
              className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 cursor-pointer group"
              onClick={() => handleModeSelect(mode)}
            >
              {mode.badge && (
                <span className="text-sm text-orange-500 font-medium mb-4 block">
                  {mode.badge}
                </span>
              )}
              
              <div className="h-48 flex items-center justify-center mb-6">
                <Icon className="w-24 h-24 text-gray-800 group-hover:text-blue-600 transition-colors" strokeWidth={1.5} />
              </div>

              <h3 className="text-2xl font-semibold mb-2">{mode.title}</h3>
              <p className="text-gray-500 mb-4">{mode.description}</p>
              
              <div className="mt-auto space-y-4">
                <p className="text-sm text-gray-600">{mode.price}</p>
                <button className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm hover:bg-blue-600 transition-colors w-full group-hover:bg-blue-600">
                  {user ? 'Continue Learning' : 'Start Learning'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Features Section */}
      {!user && (
        <div className="mt-16 bg-gray-50 rounded-2xl p-8">
          <h3 className="text-2xl font-semibold text-center mb-8">
            Why Choose Our AI Tutor?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-semibold mb-2">Personalized Learning</h4>
              <p className="text-gray-600 text-sm">
                AI adapts to your learning pace and style for optimal results
              </p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <LayoutDashboard className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-semibold mb-2">Progress Tracking</h4>
              <p className="text-gray-600 text-sm">
                Monitor your improvement with detailed analytics and insights
              </p>
            </div>
            <div className="text-center">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Puzzle className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-semibold mb-2">Interactive Practice</h4>
              <p className="text-gray-600 text-sm">
                Engage with problems that challenge and grow your skills
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-12 text-center text-gray-500 text-sm">
        {user ? (
          <p>Need help getting started? Check out our learning guides.</p>
        ) : (
          <>
            Learn more about our{' '}
            <button className="text-blue-500 hover:underline">
              educational approach
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LandingPage;