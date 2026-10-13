import { notFound } from 'next/navigation';
import DrawerLab from '@/components/lumina/lab/DrawerLab';

export default function DrawerLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <main className="min-h-screen bg-slate-950"><DrawerLab /></main>;
}
