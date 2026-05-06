// lib/useSFU.ts - Cloudflare SFU WebRTC
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const WORKER_URL = 'https://lta-webrtc.pendziuch.workers.dev';

async function api(path: string, body?: any) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function getTurnServers() {
  const res = await fetch(`${WORKER_URL}/turn-credentials`, { method: 'GET' });
  const data = await res.json();
  return data.iceServers || [];
}

export function useSFUBroadcaster(broadcastId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => { setStream(s); setLive(true); })
      .catch(e => setError(`Cámara: ${e}`));
  }, []);

  useEffect(() => {
    if (!stream) return;

    const ws = new WebSocket(`wss://lta-webrtc.pendziuch.workers.dev?broadcastId=${broadcastId}&role=broadcaster`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'viewer-count') setViewers(msg.count);
    };

    async function startBroadcast() {
      try {
        const iceServers = await getTurnServers();
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        // Agregar tracks al peer connection
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Crear sesión en SFU
        const session = await api('/session/new');
        sessionIdRef.current = session.sessionId;

        // Crear offer local
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Publicar tracks en SFU
        const tracks = stream.getTracks().map(track => ({
          location: 'local',
          mid: pc.getSenders().find(s => s.track === track)?.transport?.toString() || 
               pc.getTransceivers().find(t => t.sender.track === track)?.mid,
          trackName: track.id,
        }));

        const pushResponse = await api(`/session/${session.sessionId}/tracks/new`, {
          sessionDescription: { type: 'offer', sdp: offer.sdp },
          tracks: stream.getTracks().map((track, i) => ({
            location: 'local',
            trackName: track.id,
          })),
        });

        // Setear answer del SFU
        await pc.setRemoteDescription(new RTCSessionDescription(pushResponse.sessionDescription));

        // Manejar ICE candidates
        pc.onicecandidate = async ({ candidate }) => {
          if (!candidate && pc.localDescription) {
            // ICE gathering completo - renegociar si es necesario
          }
        };

        // Publicar info del broadcaster para espectadores
        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'broadcaster-info',
            data: {
              sessionId: session.sessionId,
              trackNames: stream.getTracks().map(t => t.id),
            }
          }));
        };

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'broadcaster-info',
            data: {
              sessionId: session.sessionId,
              trackNames: stream.getTracks().map(t => t.id),
            }
          }));
        }

      } catch (err: any) {
        setError(err.message);
      }
    }

    startBroadcast();

    return () => {
      ws.close();
      pcRef.current?.close();
      stream.getTracks().forEach(t => t.stop());
    };
  }, [stream, broadcastId]);

  return { stream, live, viewers, error };
}

export function useSFUSpectator(broadcastId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`wss://lta-webrtc.pendziuch.workers.dev?broadcastId=${broadcastId}&role=spectator`);
    wsRef.current = ws;

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'broadcaster-info') {
        await subscribeToStream(msg.data);
      }

      if (msg.type === 'broadcaster-left') {
        setConnected(false);
        setRemoteStream(null);
      }

      if (msg.type === 'chat') {
        setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
      }
    };

    async function subscribeToStream(broadcasterInfo: { sessionId: string; trackNames: string[] }) {
      try {
        const iceServers = await getTurnServers();
        const pc = new RTCPeerConnection({ iceServers });
        pcRef.current = pc;

        const mediaStream = new MediaStream();
        pc.ontrack = (e) => {
          mediaStream.addTrack(e.track);
          setRemoteStream(new MediaStream(mediaStream.getTracks()));
          setConnected(true);
        };

        // Crear sesión de espectador
        const session = await api('/session/new');

        // Suscribirse a los tracks del broadcaster
        const pullResponse = await api(`/session/${session.sessionId}/tracks/new`, {
          tracks: broadcasterInfo.trackNames.map(trackName => ({
            location: 'remote',
            sessionId: broadcasterInfo.sessionId,
            trackName,
          })),
        });

        if (pullResponse.requiresImmediateRenegotiation) {
          await pc.setRemoteDescription(new RTCSessionDescription(pullResponse.sessionDescription));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await fetch(`${WORKER_URL}/session/${session.sessionId}/renegotiate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionDescription: { type: 'answer', sdp: answer.sdp } }),
          });
        }

      } catch (err: any) {
        setError(err.message);
      }
    }

    return () => {
      ws.close();
      pcRef.current?.close();
    };
  }, [broadcastId]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text, from: 'Espectador' }));
  }, []);

  return { remoteStream, connected, error, messages, sendMessage };
}
