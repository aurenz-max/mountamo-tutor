import React from 'react';
import Link from 'next/link';
import { Search, ShoppingBag, Brain, Route } from 'lucide-react';

const NavHeader = () => {
  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo/Home */}
          <Link
            href="/"
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
          >
            <Brain className="h-8 w-8" />
          </Link>
          {/* Main Navigation */}
          <div className="hidden md:flex items-center space-x-8">
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
            <Link href="/gemini" className="text-sm hover:opacity-80 transition-opacity"> {/* New Link for Gemini Demo Page */}
              Gemini Demo
            </Link>
          </div>
          {/* Right Side Items */}
          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <Search className="h-5 w-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ShoppingBag className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavHeader;