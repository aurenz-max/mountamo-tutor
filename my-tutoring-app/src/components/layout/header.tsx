'use client';

import Link from "next/link";
import { BookOpen, Brain, BarChart } from "lucide-react";

export function Header() {
  return (
    <header className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Brain className="h-6 w-6" />
          <span className="text-xl font-bold">AI Tutor</span>
        </Link>
        <nav className="ml-auto flex items-center space-x-4">
          <Link 
            href="/analytics" 
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            <div className="flex items-center space-x-2">
              <BarChart className="h-4 w-4" />
              <span>Analytics</span>
            </div>
          </Link>
          <Link 
            href="/curriculum" 
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>Curriculum</span>
            </div>
          </Link>
        </nav>
      </div>
    </header>
  );
}