// src/app/layout.tsx
import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, Space_Grotesk } from 'next/font/google';
import NavHeader from '@/components/NavHeader';
import { AuthProvider } from '@/contexts/AuthContext';
import { AICoachProvider } from '@/contexts/AICoachContext';
import { GlobalAICoachProvider } from '@/components/layout/GlobalAICoachToggle';
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
      <body className={`${inter.className} ${spaceGrotesk.variable}`}>
        <QueryProvider>
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
        </QueryProvider>

        {/* Global visualization libraries - loaded once for all components */}
        <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="lazyOnload" />
        <Script src="https://d3js.org/d3.v7.min.js" strategy="lazyOnload" />
        <Script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.min.js" strategy="lazyOnload" />
        <Script src="https://unpkg.com/roughjs@latest/bundled/rough.js" strategy="lazyOnload" />
        <Script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js" strategy="lazyOnload" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}