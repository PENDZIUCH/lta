// app/broadcast/[id]/page.tsx
import { BroadcasterView } from '@/components/BroadcasterView';

export const runtime = 'edge';

export default function BroadcastPage({ params }: { params: { id: string } }) {
  return <BroadcasterView broadcastId={params.id} />;
}
