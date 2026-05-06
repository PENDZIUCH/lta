'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const WORKER_URL = 'https://lta-webrtc.pendziuch.workers.dev';
const SFU_URL = 'https://rtc.live.cloudflare.com/v1/apps/d4846f45ddaf81d8900ac815bb1aa2b4';
const SFU_SECRET = 'e8e330bcc823d3d8636f28bfbd7d1ae23d8b476f1095f300d76c63b1c35384ed';

async function sfuRequest(path: string, body?: any, method = 'POST') {
  const res = await fetch(`${SFU_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SFU_SECRET}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── BROADCASTER ────────────────────────────────────────────────────────────

export function useSFUBroadcaster(broadcastId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [stageRequests, setStageRequests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const trackNamesRef = useRef<string[]>([]);

  useEffect(() => {
    let pc: RTCPeerConnection;
    let ws: WebSocket;

    async function start() {
      try {
        // 1. Cámara
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(localStream);

        // 2. PeerConnection
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
        });

        // 3. Transceivers sendonly
        const transceivers = localStream.getTracks().map(track =>
          pc.addTransceiver(track, { direction: 'sendonly' })
        );

        // 4. Crear sesión en SFU
        await pc.setLocalDescription(await pc.createOffer());
        const sessionResult = await sfuRequest('/sessions/new', {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp }
        });
        await pc.setRemoteDescription(new RTCSessionDescription(sessionResult.sessionDescription));
        sessionIdRef.current = sessionResult.sessionId;

        // 5. Esperar ICE connected
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject('ICE timeout'), 10000);
          pc.addEventListener('iceconnectionstatechange', () => {
            if (pc.iceConnectionState === 'connected') { clearTimeout(timeout); resolve(); }
            if (pc.iceConnectionState === 'failed') { clearTimeout(timeout); reject('ICE failed'); }
          });
        });

        // 6. Publicar tracks
        await pc.setLocalDescription(await pc.createOffer());
        const trackObjects = transceivers.map(t => ({
          location: 'local',
          mid: t.mid,
          trackName: t.sender.track!.id,
        }));
        trackNamesRef.current = transceivers.map(t => t.sender.track!.id);

        const tracksResult = await sfuRequest(`/sessions/${sessionIdRef.current}/tracks/new`, {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp },
          tracks: trackObjects,
        });
        await pc.setRemoteDescription(new RTCSessionDescription(tracksResult.sessionDescription));

        setLive(true);

        // 7. WebSocket para coordinación
        ws = new WebSocket(`${WORKER_URL.replace('https', 'wss')}?broadcastId=${broadcastId}&role=broadcaster`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'broadcaster-info',
            data: { sessionId: sessionIdRef.current, trackNames: trackNamesRef.current }
          }));
        };

        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'viewer-count') setViewers(msg.count);
          if (msg.type === 'chat') setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
          if (msg.type === 'stage-request') setStageRequests(prev => [...prev, msg.from]);
        };

      } catch (err: any) {
        setError(err.message || err);
      }
    }

    start();

    return () => {
      ws?.close();
      pc?.close();
    };
  }, [broadcastId]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text, from: 'Broadcaster' }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  const approveStage = useCallback((viewerId: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'stage-approved', to: viewerId }));
    setStageRequests(prev => prev.filter(id => id !== viewerId));
  }, []);

  return { stream, live, viewers, messages, stageRequests, error, sendMessage, approveStage };
}

// ─── SPECTATOR ───────────────────────────────────────────────────────────────

export function useSFUSpectator(broadcastId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [stageApproved, setStageApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const myId = useRef(`viewer-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    let pc: RTCPeerConnection;

    const ws = new WebSocket(`${WORKER_URL.replace('https', 'wss')}?broadcastId=${broadcastId}&role=spectator&viewerId=${myId.current}`);
    wsRef.current = ws;

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'broadcaster-info') {
        const { sessionId, trackNames } = msg.data;

        try {
          pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
            bundlePolicy: 'max-bundle',
          });

          const mediaStream = new MediaStream();
          let trackCount = 0;

          pc.ontrack = (e) => {
            mediaStream.addTrack(e.track);
            trackCount++;
            if (trackCount >= trackNames.length) {
              setRemoteStream(mediaStream);
              setConnected(true);
            }
          };

          // Crear sesión de espectador
          const session = await sfuRequest('/sessions/new', {
            sessionDescription: { type: 'offer', sdp: (await pc.createOffer()).sdp }
          });

          // Suscribirse a tracks del broadcaster
          const pullResult = await sfuRequest(`/sessions/${session.sessionId}/tracks/new`, {
            tracks: trackNames.map((trackName: string) => ({
              location: 'remote',
              sessionId,
              trackName,
            })),
          });

          if (pullResult.requiresImmediateRenegotiation) {
            await pc.setRemoteDescription(new RTCSessionDescription(pullResult.sessionDescription));
            await pc.setLocalDescription(await pc.createAnswer());
            await sfuRequest(`/sessions/${session.sessionId}/renegotiate`, {
              sessionDescription: { type: 'answer', sdp: pc.localDescription!.sdp }
            }, 'PUT');
          }

        } catch (err: any) {
          setError(err.message);
        }
      }

      if (msg.type === 'chat') setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
      if (msg.type === 'broadcaster-left') { setConnected(false); setRemoteStream(null); }
      if (msg.type === 'stage-approved' && msg.to === myId.current) setStageApproved(true);
    };

    return () => { ws.close(); pc?.close(); };
  }, [broadcastId]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text, from: 'Espectador' }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  const requestStage = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'stage-request', from: myId.current }));
  }, []);

  return { remoteStream, connected, messages, stageApproved, error, sendMessage, requestStage };
}
