// app/broadcast/[id]/page.tsx
import { BroadcasterView } from '@/components/BroadcasterView';

export const runtime = 'edge';

export default async function BroadcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BroadcasterView broadcastId={id} />;
}
