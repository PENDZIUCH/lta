// app/watch/[id]/page.tsx
import { SpectatorView } from '@/components/SpectatorView';

export const runtime = 'edge';

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SpectatorView broadcastId={id} />;
}
