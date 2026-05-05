// lib/webrtc.ts - SimplePeer helpers con TURN servers
import SimplePeer from 'simple-peer';

export function createSimplePeer(options?: SimplePeer.Options): SimplePeer.Instance {
  return new SimplePeer({
    initiator: options?.initiator ?? false,
    trickle: true,
    stream: options?.stream,
    config: {
      iceServers: [
        // STUN servers (para descubrir IP pública)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        
        // TURN servers (relay cuando falla conexión directa)
        // OpenRelay - Free TURN server
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
      iceTransportPolicy: 'all', // Probar todas las rutas (STUN + TURN)
    },
  });
}

export function getStreamStats(peer: SimplePeer.Instance): any {
  return {
    connected: peer.connected,
    bytesReceived: 0,
    bytesSent: 0,
    roundTripTime: 0,
  };
}
