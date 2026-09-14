import { notFound } from 'next/navigation';
import PipSurfacePlayground from '@/components/lumina/pip/PipSurfacePlayground';

export default function PipSurfacePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <main className="min-h-screen bg-slate-950"><PipSurfacePlayground /></main>;
}
