// lib/types.ts
export type Broadcast = {
  id: string;
  broadcasterId: string;
  title?: string;
  status: 'active' | 'ended';
  startedAt: Date;
  viewerCount: number;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
};

export type PeerSignal = {
  broadcastId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
};

export type WebRTCStats = {
  connected: boolean;
  bytesReceived: number;
  bytesSent: number;
  roundTripTime: number;
};
