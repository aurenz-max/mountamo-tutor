// src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import AppChrome from '@/components/layout/AppChrome';
import { AuthProvider } from '@/contexts/AuthContext';
import { EngagementProvider } from '@/contexts/EngagementContext';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Lumina',
  description: 'Personalized learning experience powered by AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${spaceGrotesk.variable}`}>
        <QueryProvider>
          <AuthProvider>
            <EngagementProvider>
              <AppChrome>{children}</AppChrome>
              <Toaster />
            </EngagementProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
