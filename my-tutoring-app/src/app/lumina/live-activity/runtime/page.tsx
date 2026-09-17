import { notFound } from 'next/navigation';
import LiveRuntimeLab from '@/components/lumina/components/live-activity/runtime/LiveRuntimeLab';

export default function LiveRuntimePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LiveRuntimeLab />;
}
