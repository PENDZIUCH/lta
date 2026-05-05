// lib/webrtc.ts - SimplePeer con Cloudflare TURN
import SimplePeer from 'simple-peer';

export async function getIceServers() {
  try {
    const res = await fetch('https://lta-webrtc.pendziuch.workers.dev/turn-credentials');
    const data = await res.json();
    console.log('✅ TURN credentials obtenidas de Cloudflare');
    console.log('📋 Ice servers count:', data.iceServers?.length);
    console.log('📋 Ice servers:', JSON.stringify(data.iceServers));
    return data.iceServers;
  } catch (err) {
    console.warn('⚠️ No se pudieron obtener TURN credentials, usando solo STUN');
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

export function createSimplePeer(options?: SimplePeer.Options & { iceServers?: any[] }): SimplePeer.Instance {
  return new SimplePeer({
    initiator: options?.initiator ?? false,
    trickle: true,
    stream: options?.stream,
    config: {
      iceServers: options?.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }],
    },
  });
}
