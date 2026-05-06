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

export interface StageParticipant {
  name: string;
  number: number;
  stream: MediaStream | null;
  withVideo: boolean;
}

export interface StageRequest {
  from: string;
  viewerNumber: number;
  withVideo: boolean;
}

// ─── BROADCASTER ─────────────────────────────────────────────────────────────

export function useSFUBroadcaster(broadcastId: string) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [stageRequests, setStageRequests] = useState<StageRequest[]>([]);
  const [stageParticipants, setStageParticipants] = useState<StageParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stagePeersRef = useRef<Map<number, RTCPeerConnection>>(new Map());

  useEffect(() => {
    let pc: RTCPeerConnection;
    let ws: WebSocket;

    async function start() {
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(localStream);

        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
        });

        const transceivers = localStream.getTracks().map(track =>
          pc.addTransceiver(track, { direction: 'sendonly' })
        );

        await pc.setLocalDescription(await pc.createOffer());
        const sessionResult = await sfu('/sessions/new', {
          sessionDescription: { type: 'offer', sdp: pc.localDescription!.sdp }
        });
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
          ws.send(JSON.stringify({
            type: 'broadcaster-info',
            data: { sessionId: sessionResult.sessionId, trackNames }
          }));
        };

        ws.onmessage = async (e) => {
          const msg = JSON.parse(e.data);

          if (msg.type === 'viewer-count') setViewers(msg.count);

          if (msg.type === 'chat') {
            setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
          }

          if (msg.type === 'stage-request') {
            setStageRequests(prev => [...prev, {
              from: msg.from,
              viewerNumber: Number(msg.viewerNumber),
              withVideo: msg.withVideo,
            }]);
          }

          // WebRTC p2p para el stage (broadcaster recibe offer del spectator)
          if (msg.type === 'stage-signal') {
            const viewerNumber = Number(msg.fromNumber);
            let stagePc = stagePeersRef.current.get(viewerNumber);

            if (!stagePc) {
              stagePc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
              stagePeersRef.current.set(viewerNumber, stagePc);

              stagePc.ontrack = (e) => {
                const stageStream = new MediaStream([e.track]);
                setStageParticipants(prev => {
                  const existing = prev.find(p => p.number === viewerNumber);
                  if (existing) {
                    return prev.map(p => p.number === viewerNumber ? { ...p, stream: stageStream } : p);
                  }
                  return [...prev, { name: msg.fromName, number: viewerNumber, stream: stageStream, withVideo: true }];
                });
              };

              stagePc.onicecandidate = ({ candidate }) => {
                if (candidate) {
                  ws.send(JSON.stringify({ type: 'stage-signal', signal: { type: 'candidate', candidate }, toNumber: viewerNumber }));
                }
              };
            }

            if (msg.signal.type === 'offer') {
              await stagePc.setRemoteDescription(new RTCSessionDescription(msg.signal));
              const answer = await stagePc.createAnswer();
              await stagePc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: 'stage-signal', signal: { type: 'answer', sdp: answer.sdp }, toNumber: viewerNumber }));
            } else if (msg.signal.type === 'candidate') {
              await stagePc.addIceCandidate(new RTCIceCandidate(msg.signal.candidate));
            }
          }
        };

      } catch (err: any) {
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

  const approveStage = useCallback((req: StageRequest) => {
    wsRef.current?.send(JSON.stringify({ type: 'stage-approved', viewerNumber: req.viewerNumber, withVideo: req.withVideo }));
    setStageRequests(prev => prev.filter(r => r.viewerNumber !== req.viewerNumber));
    // Agregar placeholder mientras llega el stream
    setStageParticipants(prev => [...prev, {
      name: req.from,
      number: req.viewerNumber,
      stream: null,
      withVideo: req.withVideo,
    }]);
  }, []);

  const rejectStage = useCallback((viewerNumber: number) => {
    wsRef.current?.send(JSON.stringify({ type: 'stage-rejected', viewerNumber }));
    setStageRequests(prev => prev.filter(r => r.viewerNumber !== viewerNumber));
  }, []);

  const removeFromStage = useCallback((viewerNumber: number) => {
    stagePeersRef.current.get(viewerNumber)?.close();
    stagePeersRef.current.delete(viewerNumber);
    setStageParticipants(prev => prev.filter(p => p.number !== viewerNumber));
  }, []);

  return { stream, live, viewers, messages, stageRequests, stageParticipants, error, sendMessage, approveStage, rejectStage, removeFromStage };
}

// ─── SPECTATOR ────────────────────────────────────────────────────────────────

export function useSFUSpectator(broadcastId: string) {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<{ text: string; from: string }[]>([]);
  const [myName, setMyName] = useState('Espectador');
  const [myNumber, setMyNumber] = useState(0);
  const [stageStatus, setStageStatus] = useState<'idle' | 'requested' | 'approved' | 'rejected'>('idle');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const stagePcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    let pc: RTCPeerConnection;

    async function subscribeToStream(broadcasterInfo: { sessionId: string; trackNames: string[] }) {
      try {
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
        });

        const mediaStream = new MediaStream();
        let tracksReceived = 0;

        pc.ontrack = (e) => {
          mediaStream.addTrack(e.track);
          tracksReceived++;
          if (tracksReceived >= broadcasterInfo.trackNames.length) {
            setRemoteStream(new MediaStream(mediaStream.getTracks()));
            setConnected(true);
          }
        };

        const session = await sfu('/sessions/new');

        const pullResult = await sfu(`/sessions/${session.sessionId}/tracks/new`, {
          tracks: broadcasterInfo.trackNames.map(trackName => ({
            location: 'remote',
            sessionId: broadcasterInfo.sessionId,
            trackName,
          })),
        });

        if (pullResult.requiresImmediateRenegotiation) {
          await pc.setRemoteDescription(new RTCSessionDescription(pullResult.sessionDescription));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sfu(`/sessions/${session.sessionId}/renegotiate`, {
            sessionDescription: { type: 'answer', sdp: answer.sdp }
          }, 'PUT');
        }

      } catch (err: any) {
        setError(err.message || String(err));
      }
    }

    const ws = new WebSocket(`${WS_BASE}?broadcastId=${broadcastId}&role=spectator`);
    wsRef.current = ws;

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'your-name') {
        setMyName(msg.name);
        setMyNumber(msg.number);
      }

      if (msg.type === 'broadcaster-info') await subscribeToStream(msg.data);
      if (msg.type === 'broadcaster-left') { setConnected(false); setRemoteStream(null); }

      if (msg.type === 'chat' && !msg.own) {
        setMessages(prev => [...prev, { text: msg.text, from: msg.from }]);
      }

      if (msg.type === 'stage-approved') {
        setStageStatus('approved');
        // Iniciar WebRTC p2p con el broadcaster
        await startStageConnection(ws);
      }

      if (msg.type === 'stage-rejected') {
        setStageStatus('rejected');
        setTimeout(() => setStageStatus('idle'), 3000);
      }

      // WebRTC signals del broadcaster
      if (msg.type === 'stage-signal' && stagePcRef.current) {
        if (msg.signal.type === 'answer') {
          await stagePcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.signal.sdp }));
        } else if (msg.signal.type === 'candidate') {
          await stagePcRef.current.addIceCandidate(new RTCIceCandidate(msg.signal.candidate));
        }
      }
    };

    return () => { ws.close(); pc?.close(); stagePcRef.current?.close(); };
  }, [broadcastId]);

  async function startStageConnection(ws: WebSocket) {
    try {
      const stagePc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
      stagePcRef.current = stagePc;

      // Pedir cámara/audio
      const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.getTracks().forEach(track => stagePc.addTrack(track, localStream));

      stagePc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          ws.send(JSON.stringify({ type: 'stage-signal', signal: { type: 'candidate', candidate } }));
        }
      };

      const offer = await stagePc.createOffer();
      await stagePc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'stage-signal', signal: { type: 'offer', sdp: offer.sdp } }));

    } catch (err: any) {
      setError(err.message);
    }
  }

  const sendMessage = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: 'chat', text }));
    setMessages(prev => [...prev, { text, from: 'Yo' }]);
  }, []);

  const requestStage = useCallback((withVideo: boolean) => {
    wsRef.current?.send(JSON.stringify({ type: 'stage-request', withVideo }));
    setStageStatus('requested');
  }, []);

  return { remoteStream, connected, messages, myName, myNumber, stageStatus, error, sendMessage, requestStage };
}
