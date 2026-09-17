import { notFound } from 'next/navigation';
import LiveActivitySandbox from '@/components/lumina/components/live-activity/LiveActivitySandbox';

export default function LiveActivityPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LiveActivitySandbox />;
}
