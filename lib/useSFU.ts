'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const SFU_BASE = 'https://rtc.live.cloudflare.com/v1/apps/d4846f45ddaf81d8900ac815bb1aa2b4';
const SFU_SECRET = 'e8e330bcc823d3d8636f28bfbd7d1ae23d8b476f1095f300d76c63b1c35384ed';
const WS_BASE = 'wss://lta-webrtc.pendziuch.workers.dev';

async function sfu(path: string, body?: any, method = 'POST') {
  const res = await fetch(`${SFU_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SFU_SECRET}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export interface Participant {
  number: string;
  name: string;
  sessionId: string;
  trackNames: string[];
  stream?: MediaStream;
}

// ─── BROADCASTER ─────────────────────────────────────────────────────────────

export function useSFUBroadcaster(broadcastId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const participantPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const subscribeToParticipant = useCallback(async (p: Participant) => {
    if (participantPcsRef.current.has(p.number)) return;
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' });
      participantPcsRef.current.set(p.number, pc);
      const mediaStream = new MediaStream();
      let received = 0;
      pc.ontrack = (e) => {
        mediaStream.addTrack(e.track);
        received++;
        if (received >= p.trackNames.length) {
          setParticipants(prev => prev.map(x => x.number === p.number ? { ...x, stream: new MediaStream(mediaStream.getTracks()) } : x));
        }
      };
      const session = await sfu('/sessions/new');
      const pullResult = await sfu(`/sessions/${session.sessionId}/tracks/new`, {
        tracks: p.trackNames.map(trackName => ({ location: 'remote', sessionId: p.sessionId, trackName })),
      });
      if (pullResult.requiresImmediateRenegotiation) {
        await pc.setRemoteDescription(new RTCSessionDescription(pullResult.sessionDescription));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sfu(`/sessions/${session.sessionId}/renegotiate`, { sessionDescription: { type: 'answer', sdp: answer.sdp } }, 'PUT');
      }
    } catch (err: any) { console.error('Error suscribiendo a participante:', err); }
  }, []);

  useEffect(() => {
    let pc: RTCPeerConnection;
    let ws: WebSocket;

    async function start() {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(localStream);
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' });
        const transceivers = localStream.getTracks().map(track => pc.addTransceiver(track, { direction: 'sendonly' }));
        await pc.setLocalDescription(await pc.createOffer());
        const sessionResult = await sfu('/sessions/new', { sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp } });
        await pc.setRemoteDescription(new RTCSessionDescription(sessionResult.sessionDescription));
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('ICE timeout')), 15000);
          pc.addEventListener('iceconnectionstatechange', () => {
            if (pc.iceConnectionState === 'connected') { clearTimeout(t); resolve(); }
            if (pc.iceConnectionState === 'failed') { clearTimeout(t); reject(new Error('ICE failed')); }
          });
        });
        await pc.setLocalDescription(await pc.createOffer());
        const tracksResult = await sfu(`/sessions/${sessionResult.sessionId}/tracks/new`, {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp },
          tracks: transceivers.map(t => ({ location: 'local', mid: t.mid, trackName: t.sender.track!.id })),
        });
        await pc.setRemoteDescription(new RTCSessionDescription(tracksResult.sessionDescription));
        const trackNames = transceivers.map(t => t.sender.track!.id);
        setLive(true);

        ws = new WebSocket(`${WS_BASE}?broadcastId=${broadcastId}&role=broadcaster`);
        wsRef.current = ws;
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'broadcaster-info', data: { sessionId: sessionResult.sessionId, trackNames } }));
        };
        ws.onmessage = async (e) => {
          const msg = JSON.parse(e.data);
          if (msg.type === 'viewer-count') setViewers(msg.count);
          if (msg.type === 'chat') setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
          if (msg.type === 'participants-update') {
            const list: Participant[] = Object.values(msg.participants);
            setParticipants(list);
            list.forEach(p => subscribeToParticipant(p));
          }
        };
      } catch (err: any) { setError(err.message || String(err)); }
    }

    start();
    return () => { ws?.close(); pc?.close(); participantPcsRef.current.forEach(p => p.close()); };
  }, [broadcastId, subscribeToParticipant]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text, from: 'Broadcaster' }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  return { stream, live, viewers, messages, participants, error, sendMessage };
}

// ─── SPECTATOR ────────────────────────────────────────────────────────────────

export function useSFUSpectator(broadcastId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [myName, setMyName] = useState('Espectador');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const myNumberRef = useRef<string>('0');
  const participantPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const subscribeToParticipant = useCallback(async (p: Participant) => {
    if (participantPcsRef.current.has(p.number)) return;
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' });
      participantPcsRef.current.set(p.number, pc);
      const mediaStream = new MediaStream();
      let received = 0;
      pc.ontrack = (e) => {
        mediaStream.addTrack(e.track);
        received++;
        if (received >= p.trackNames.length) {
          setParticipants(prev => prev.map(x => x.number === p.number ? { ...x, stream: new MediaStream(mediaStream.getTracks()) } : x));
        }
      };
      const session = await sfu('/sessions/new');
      const pullResult = await sfu(`/sessions/${session.sessionId}/tracks/new`, {
        tracks: p.trackNames.map(trackName => ({ location: 'remote', sessionId: p.sessionId, trackName })),
      });
      if (pullResult.requiresImmediateRenegotiation) {
        await pc.setRemoteDescription(new RTCSessionDescription(pullResult.sessionDescription));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sfu(`/sessions/${session.sessionId}/renegotiate`, { sessionDescription: { type: 'answer', sdp: answer.sdp } }, 'PUT');
      }
    } catch (err: any) { console.error('Error suscribiendo:', err); }
  }, []);

  useEffect(() => {
    let mainPc: RTCPeerConnection;

    async function subscribeToMain(broadcasterInfo: { sessionId: string; trackNames: string[] }) {
      try {
        mainPc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' });
        const mediaStream = new MediaStream();
        let received = 0;
        mainPc.ontrack = (e) => {
          mediaStream.addTrack(e.track);
          received++;
          if (received >= broadcasterInfo.trackNames.length) {
            setRemoteStream(new MediaStream(mediaStream.getTracks()));
            setConnected(true);
          }
        };
        const session = await sfu('/sessions/new');
        const pullResult = await sfu(`/sessions/${session.sessionId}/tracks/new`, {
          tracks: broadcasterInfo.trackNames.map(trackName => ({ location: 'remote', sessionId: broadcasterInfo.sessionId, trackName })),
        });
        if (pullResult.requiresImmediateRenegotiation) {
          await mainPc.setRemoteDescription(new RTCSessionDescription(pullResult.sessionDescription));
          const answer = await mainPc.createAnswer();
          await mainPc.setLocalDescription(answer);
          await sfu(`/sessions/${session.sessionId}/renegotiate`, { sessionDescription: { type: 'answer', sdp: answer.sdp } }, 'PUT');
        }
      } catch (err: any) { setError(err.message || String(err)); }
    }

    async function publishLocalCamera(ws: WebSocket) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(camStream);
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' });
        const transceivers = camStream.getTracks().map(track => pc.addTransceiver(track, { direction: 'sendonly' }));
        await pc.setLocalDescription(await pc.createOffer());
        const sessionResult = await sfu('/sessions/new', { sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp } });
        await pc.setRemoteDescription(new RTCSessionDescription(sessionResult.sessionDescription));
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('ICE timeout')), 15000);
          pc.addEventListener('iceconnectionstatechange', () => {
            if (pc.iceConnectionState === 'connected') { clearTimeout(t); resolve(); }
            if (pc.iceConnectionState === 'failed') { clearTimeout(t); reject(new Error('ICE failed')); }
          });
        });
        await pc.setLocalDescription(await pc.createOffer());
        const tracksResult = await sfu(`/sessions/${sessionResult.sessionId}/tracks/new`, {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp },
          tracks: transceivers.map(t => ({ location: 'local', mid: t.mid, trackName: t.sender.track!.id })),
        });
        await pc.setRemoteDescription(new RTCSessionDescription(tracksResult.sessionDescription));
        const trackNames = transceivers.map(t => t.sender.track!.id);
        ws.send(JSON.stringify({ type: 'participant-joined', sessionId: sessionResult.sessionId, trackNames }));
      } catch (err: any) {
        console.warn('No se pudo activar cámara:', err.message);
      }
    }

    const ws = new WebSocket(`${WS_BASE}?broadcastId=${broadcastId}&role=spectator`);
    wsRef.current = ws;

    ws.onopen = () => { publishLocalCamera(ws); };

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'your-name') { setMyName(msg.name); myNumberRef.current = String(msg.number); }
      if (msg.type === 'broadcaster-info') await subscribeToMain(msg.data);
      if (msg.type === 'broadcaster-left') { setConnected(false); setRemoteStream(null); }
      if (msg.type === 'chat-history') setMessages(msg.messages.map((m: any) => ({ text: m.text, from: m.from })));
      if (msg.type === 'chat' && !msg.own) setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
      if (msg.type === 'participants-update') {
        const list: Participant[] = Object.values(msg.participants).filter((p: any) => p.number !== myNumberRef.current);
        setParticipants(list);
        list.forEach(p => subscribeToParticipant(p));
      }
    };

    return () => {
      ws.send(JSON.stringify({ type: 'participant-left' }));
      ws.close();
      mainPc?.close();
      participantPcsRef.current.forEach(p => p.close());
    };
  }, [broadcastId, subscribeToParticipant]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  return { remoteStream, localStream, connected, messages, myName, participants, error, sendMessage };
}
