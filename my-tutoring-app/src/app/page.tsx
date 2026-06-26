import LuminaLanding from '@/components/landing/LuminaLanding';

// The root route is now the Lumina marketing landing. The legacy auth-gated
// dashboard (EnhancedLearningDashboard / the old LandingPage) is sunset — the
// product lives at /lumina, and this page is its front door.
export default function Home() {
  return <LuminaLanding />;
}
