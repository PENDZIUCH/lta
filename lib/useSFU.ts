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

async function subscribeToParticipantSFU(
  p: Participant,
  pcsMap: Map<string, RTCPeerConnection>,
  onStream: (number: string, stream: MediaStream) => void
) {
  if (pcsMap.has(p.number)) return;
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' });
    pcsMap.set(p.number, pc);
    const mediaStream = new MediaStream();
    let received = 0;
    pc.ontrack = (e) => {
      mediaStream.addTrack(e.track);
      received++;
      if (received >= p.trackNames.length) {
        onStream(p.number, new MediaStream(mediaStream.getTracks()));
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
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

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
            const list = Object.values(msg.participants) as Participant[];
            setParticipants(list);
            list.forEach(p => subscribeToParticipantSFU(p, pcsRef.current, (number, s) => {
              setParticipants(prev => prev.map(x => x.number === number ? { ...x, stream: s } : x));
            }));
          }
        };
      } catch (err: any) { setError(err.message || String(err)); }
    }

    start();
    return () => { ws?.close(); pc?.close(); pcsRef.current.forEach(p => p.close()); };
  }, [broadcastId]);

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
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const myNumberRef = useRef<string>('0');
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

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
        localStreamRef.current = camStream;
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
        const list = (Object.values(msg.participants) as Participant[]).filter(p => p.number !== myNumberRef.current);
        setParticipants(list);
        list.forEach(p => subscribeToParticipantSFU(p, pcsRef.current, (number, s) => {
          setParticipants(prev => prev.map(x => x.number === number ? { ...x, stream: s } : x));
        }));
      }
    };

    return () => {
      wsRef.current?.send(JSON.stringify({ type: 'participant-left' }));
      ws.close();
      mainPc?.close();
      pcsRef.current.forEach(p => p.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [broadcastId]);

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOn(videoTrack.enabled);
    }
  }, []);

  return { remoteStream, localStream, connected, messages, myName, participants, micOn, cameraOn, error, sendMessage, toggleMic, toggleCamera };
}
