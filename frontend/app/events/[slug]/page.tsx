import { notFound } from 'next/navigation';
import EventDetail from './EventDetail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params;
  
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/events/${slug}`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) {
      if (response.status === 404) {
        notFound();
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    const event = await response.json();
    return <EventDetail event={event} />;
  } catch {
    notFound();
  }
}