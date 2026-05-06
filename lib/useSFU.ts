'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const WORKER_URL = 'https://lta-webrtc.pendziuch.workers.dev';
const SFU_BASE = 'https://rtc.live.cloudflare.com/v1/apps/d4846f45ddaf81d8900ac815bb1aa2b4';
const SFU_SECRET = 'e8e330bcc823d3d8636f28bfbd7d1ae23d8b476f1095f300d76c63b1c35384ed';

async function sfu(path: string, body?: any, method = 'POST') {
  const res = await fetch(`${SFU_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SFU_SECRET}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── BROADCASTER ─────────────────────────────────────────────────────────────

export function useSFUBroadcaster(broadcastId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let pc: RTCPeerConnection;
    let ws: WebSocket;

    async function start() {
      try {
        // 1. Cámara
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(localStream);

        // 2. PeerConnection con bundlePolicy max-bundle (requerido por Cloudflare)
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
        });

        // 3. Agregar tracks como sendonly
        const transceivers = localStream.getTracks().map(track =>
          pc.addTransceiver(track, { direction: 'sendonly' })
        );

        // 4. Crear sesión SFU con offer inicial
        await pc.setLocalDescription(await pc.createOffer());
        const sessionResult = await sfu('/sessions/new', {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp }
        });
        await pc.setRemoteDescription(new RTCSessionDescription(sessionResult.sessionDescription));

        // 5. Esperar ICE connected
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('ICE timeout')), 15000);
          pc.addEventListener('iceconnectionstatechange', () => {
            console.log('ICE state:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected') { clearTimeout(t); resolve(); }
            if (pc.iceConnectionState === 'failed') { clearTimeout(t); reject(new Error('ICE failed')); }
          });
        });

        // 6. Publicar tracks
        await pc.setLocalDescription(await pc.createOffer());
        const trackObjects = transceivers.map(t => ({
          location: 'local',
          mid: t.mid,
          trackName: t.sender.track!.id,
        }));

        const tracksResult = await sfu(`/sessions/${sessionResult.sessionId}/tracks/new`, {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp },
          tracks: trackObjects,
        });
        await pc.setRemoteDescription(new RTCSessionDescription(tracksResult.sessionDescription));

        const trackNames = transceivers.map(t => t.sender.track!.id);
        setLive(true);
        console.log('✅ Broadcaster live, tracks:', trackNames);

        // 7. WebSocket coordinación
        ws = new WebSocket(`wss://lta-webrtc.pendziuch.workers.dev?broadcastId=${broadcastId}&role=broadcaster`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'broadcaster-info',
            data: { sessionId: sessionResult.sessionId, trackNames }
          }));
        };

        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'viewer-count') setViewers(msg.count);
          if (msg.type === 'chat') setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
        };

      } catch (err: any) {
        console.error('Broadcaster error:', err);
        setError(err.message || String(err));
      }
    }

    start();
    return () => { ws?.close(); pc?.close(); };
  }, [broadcastId]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text, from: 'Broadcaster' }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  return { stream, live, viewers, messages, error, sendMessage };
}

// ─── SPECTATOR ────────────────────────────────────────────────────────────────

export function useSFUSpectator(broadcastId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let pc: RTCPeerConnection;

    async function subscribeToStream(broadcasterInfo: { sessionId: string; trackNames: string[] }) {
      try {
        console.log('🔌 Suscribiendo a tracks:', broadcasterInfo.trackNames);

        // 1. PeerConnection
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
        });

        const mediaStream = new MediaStream();
        let tracksReceived = 0;

        pc.ontrack = (e) => {
          console.log('🎥 Track recibido:', e.track.kind);
          mediaStream.addTrack(e.track);
          tracksReceived++;
          if (tracksReceived >= broadcasterInfo.trackNames.length) {
            setRemoteStream(new MediaStream(mediaStream.getTracks()));
            setConnected(true);
          }
        };

        // 2. Crear sesión SFU para el spectator con offer vacía
        await pc.setLocalDescription(await pc.createOffer());
        const session = await sfu('/sessions/new', {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp }
        });
        await pc.setRemoteDescription(new RTCSessionDescription(session.sessionDescription));

        // 3. Esperar ICE
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('ICE timeout')), 15000);
          pc.addEventListener('iceconnectionstatechange', () => {
            console.log('Spectator ICE:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected') { clearTimeout(t); resolve(); }
            if (pc.iceConnectionState === 'failed') { clearTimeout(t); reject(new Error('ICE failed')); }
          });
        });

        // 4. Pedir tracks del broadcaster
        const pullResult = await sfu(`/sessions/${session.sessionId}/tracks/new`, {
          tracks: broadcasterInfo.trackNames.map(trackName => ({
            location: 'remote',
            sessionId: broadcasterInfo.sessionId,
            trackName,
          })),
        });

        console.log('Pull result:', pullResult);

        if (pullResult.requiresImmediateRenegotiation) {
          await pc.setRemoteDescription(new RTCSessionDescription(pullResult.sessionDescription));
          await pc.setLocalDescription(await pc.createAnswer());
          await sfu(`/sessions/${session.sessionId}/renegotiate`, {
            sessionDescription: { type: 'answer', sdp: pc.localDescription!.sdp }
          }, 'PUT');
        }

      } catch (err: any) {
        console.error('Spectator error:', err);
        setError(err.message || String(err));
      }
    }

    const ws = new WebSocket(`wss://lta-webrtc.pendziuch.workers.dev?broadcastId=${broadcastId}&role=spectator`);
    wsRef.current = ws;

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'broadcaster-info') await subscribeToStream(msg.data);
      if (msg.type === 'broadcaster-left') { setConnected(false); setRemoteStream(null); }
      if (msg.type === 'chat') setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
    };

    return () => { ws.close(); pc?.close(); };
  }, [broadcastId]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text, from: 'Espectador' }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  return { remoteStream, connected, messages, error, sendMessage };
}
