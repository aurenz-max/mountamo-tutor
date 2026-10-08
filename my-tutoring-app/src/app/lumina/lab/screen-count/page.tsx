import { notFound } from 'next/navigation';
import ScreenCountLab from '@/components/lumina/lab/ScreenCountLab';

export default function ScreenCountLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <main className="min-h-screen bg-slate-950"><ScreenCountLab /></main>;
}
