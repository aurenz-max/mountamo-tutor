'use client';

import React from 'react';
import { Brain, BookOpen, Puzzle, LayoutDashboard } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LandingPageProps {
  onSelectMode?: (mode: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectMode }) => {
  const router = useRouter();

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
      title: "Full Library",
      description: "Complete curriculum access",
      icon: BookOpen,
      price: "All Grades K-K",
      path: "/curriculum"
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
      router.push(mode.path);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">All learning styles.</h1>
        <h2 className="text-3xl text-gray-500">Take your pick.</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modes.map((mode) => {
          const Icon = mode.icon;
          return (
            <div 
              key={mode.title}
              className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 cursor-pointer"
              onClick={() => handleModeSelect(mode)}
            >
              {mode.badge && (
                <span className="text-sm text-orange-500 font-medium mb-4 block">
                  {mode.badge}
                </span>
              )}
              
              <div className="h-48 flex items-center justify-center mb-6">
                <Icon className="w-24 h-24 text-gray-800" strokeWidth={1.5} />
              </div>

              <h2 className="text-2xl font-semibold mb-2">{mode.title}</h2>
              <p className="text-gray-500 mb-4">{mode.description}</p>
              
              <div className="mt-auto space-y-4">
                <p className="text-sm text-gray-600">{mode.price}</p>
                <button className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm hover:bg-blue-600 transition-colors">
                  Start Learning
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center text-gray-500 text-sm">
        Learn more about our {' '}
        <button className="text-blue-500 hover:underline">
          educational approach
        </button>
      </div>
    </div>
  );
};

export default LandingPage;