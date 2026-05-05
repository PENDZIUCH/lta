// app/watch/[id]/page.tsx
import { SpectatorView } from '@/components/SpectatorView';

export const runtime = 'edge';

export default function WatchPage({ params }: { params: { id: string } }) {
  return <SpectatorView broadcastId={params.id} />;
}
