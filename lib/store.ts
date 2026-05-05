// lib/store.ts - En-memoria, se resetea al refreshear
import { Broadcast } from './types';

const broadcasts = new Map<string, Broadcast>();

export function createBroadcast(id: string, broadcasterId: string): Broadcast {
  const broadcast: Broadcast = {
    id,
    broadcasterId,
    status: 'active',
    startedAt: new Date(),
    viewerCount: 0,
  };
  broadcasts.set(id, broadcast);
  return broadcast;
}

export function getBroadcast(id: string): Broadcast | undefined {
  return broadcasts.get(id);
}

export function getAllBroadcasts(): Broadcast[] {
  return Array.from(broadcasts.values()).filter(b => b.status === 'active');
}

export function endBroadcast(id: string) {
  const b = broadcasts.get(id);
  if (b) b.status = 'ended';
}

export function incrementViewers(id: string) {
  const b = broadcasts.get(id);
  if (b) b.viewerCount++;
}

export function decrementViewers(id: string) {
  const b = broadcasts.get(id);
  if (b && b.viewerCount > 0) b.viewerCount--;
}
