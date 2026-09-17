import { notFound, redirect } from 'next/navigation';

export default function LiveRuntimeConnectedPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  // This URL was mistakenly promoted from a transport fixture to a learner demo.
  // Keep existing bookmarks useful by returning to the established activity host.
  redirect('/lumina/live-activity');
}
