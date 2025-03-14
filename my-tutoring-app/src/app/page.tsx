import LandingPage from '@/components/landing/LandingPage';
import dynamic from 'next/dynamic';


export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <LandingPage />
    </main>
  );
}