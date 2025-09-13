// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import NavHeader from '@/components/NavHeader';
import { AuthProvider } from '@/contexts/AuthContext';
import { AICoachProvider } from '@/contexts/AICoachContext';
import { GlobalAICoachProvider } from '@/components/layout/GlobalAICoachToggle'; // Add this import
import { EngagementProvider } from '@/contexts/EngagementContext';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Tutor',
  description: 'Personalized learning experience powered by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <EngagementProvider>
            <AICoachProvider>
              <GlobalAICoachProvider>
                <NavHeader />
                {children}
                <Toaster />
              </GlobalAICoachProvider>
            </AICoachProvider>
          </EngagementProvider>
        </AuthProvider>
      </body>
    </html>
  );
}