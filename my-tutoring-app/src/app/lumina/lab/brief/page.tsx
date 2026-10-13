import { notFound } from 'next/navigation';
import BriefLab from '@/components/lumina/lab/BriefLab';

export default function BriefLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <main className="min-h-screen bg-slate-950"><BriefLab /></main>;
}
