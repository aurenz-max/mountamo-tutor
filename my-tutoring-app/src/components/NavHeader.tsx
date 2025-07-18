// components/NavHeader.tsx

"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  ShoppingBag, 
  Brain, 
  User, 
  LogOut, 
  Settings, 
  BarChart3,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NavHeader = () => {
  const { user, userProfile, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const UserMenu = () => {
    if (!user) return null;

    return (
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
          </div>
          <ChevronDown className="h-4 w-4 text-gray-600" />
        </button>

        {showUserMenu && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">
                {user.displayName || 'User'}
              </p>
              <p className="text-xs text-gray-500">{user.email}</p>
              {userProfile && (
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-600">
                  <span>Grade: {userProfile.grade_level}</span>
                  <span>Points: {userProfile.total_points || 0}</span>
                  <span>Streak: {userProfile.current_streak || 0}</span>
                </div>
              )}
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                href="/dashboard"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowUserMenu(false)}
              >
                <BarChart3 className="h-4 w-4 mr-3" />
                Dashboard
              </Link>
              
              <Link
                href="/profile"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowUserMenu(false)}
              >
                <User className="h-4 w-4 mr-3" />
                Profile
              </Link>
              
              <Link
                href="/settings"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => setShowUserMenu(false)}
              >
                <Settings className="h-4 w-4 mr-3" />
                Settings
              </Link>
            </div>

            {/* Logout */}
            <div className="border-t border-gray-100 pt-1">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  handleLogout();
                }}
                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo/Home */}
          <Link
            href={user ? "/dashboard" : "/"}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <Brain className="h-8 w-8" />
          </Link>

          {/* Main Navigation - Only show if user is logged in */}
          {user && (
            <div className="hidden md:flex items-center space-x-8">
              <Link href="/dashboard" className="text-sm hover:opacity-80 transition-opacity">
                Dashboard
              </Link>
              <Link href="/tutoring" className="text-sm hover:opacity-80 transition-opacity">
                AI Tutor
              </Link>
              <Link href="/practice" className="text-sm hover:opacity-80 transition-opacity">
                Practice
              </Link>
              <Link href="/curriculum" className="text-sm hover:opacity-80 transition-opacity">
                Library
              </Link>
              <Link href="/learning-paths" className="text-sm hover:opacity-80 transition-opacity">
                Learning Paths
              </Link>
              <Link href="/analytics" className="text-sm hover:opacity-80 transition-opacity">
                Progress
              </Link>
              <Link href="/read-along" className="text-sm hover:opacity-80 transition-opacity">
                Read Along
              </Link>
            </div>
          )}

          {/* Right Side Items */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <Search className="h-5 w-5" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ShoppingBag className="h-5 w-5" />
                </button>
              </>
            )}
            
            {user ? (
              <UserMenu />
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/login"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </nav>
  );
};

export default NavHeader;