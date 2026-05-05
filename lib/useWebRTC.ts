'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createSimplePeer, getIceServers } from './webrtc';
import { useSignaling } from './useSignaling';

export function useWebRTC(broadcastId: string, isBroadcaster: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const peerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<any[]>([]);
  const signalQueueRef = useRef<any[]>([]);
  const connectedRef = useRef(false);
  const { sendSignal, onSignal, isConnected: socketConnected } = useSignaling(broadcastId, isBroadcaster);

  useEffect(() => {
    if (!isBroadcaster) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => { console.log('✅ Cámara OK'); streamRef.current = s; setStream(s); })
      .catch(e => setError(`Cámara: ${e}`));
  }, [isBroadcaster]);

  const initPeer = useCallback(async (initiator: boolean, currentStream?: MediaStream | null) => {
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    signalQueueRef.current = [];
    connectedRef.current = false;
    setConnected(false);

    if (!iceServersRef.current.length) {
      iceServersRef.current = await getIceServers();
    }

    console.log('🔥 Creando peer, initiator:', initiator);
    const peer = createSimplePeer({ initiator, stream: currentStream || undefined, iceServers: iceServersRef.current });

    peer.on('signal', (d: any) => { sendSignal(d); });
    peer.on('connect', () => {
      console.log('✅✅✅ PEER CONECTADO ✅✅✅');
      connectedRef.current = true;
      setConnected(true);
    });
    peer.on('stream', (s: MediaStream) => { console.log('🎥 Stream!'); setRemoteStream(s); });
    peer.on('error', (e: any) => { if (!e.message?.includes('wrong state') && !e.message?.includes('Abort')) setError(e.message); });
    peer.on('close', () => { connectedRef.current = false; setConnected(false); });

    peerRef.current = peer;
    return peer;
  }, [sendSignal]);

  useEffect(() => {
    if (!socketConnected) return;
    if (isBroadcaster && !stream) return;
    initPeer(isBroadcaster, stream);
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, [socketConnected, stream, isBroadcaster]);

  useEffect(() => {
    return onSignal(async (signal: any) => {
      if (signal.type === 'new-spectator' && isBroadcaster) {
        // Solo renegociar si no hay nadie conectado
        if (connectedRef.current) {
          console.log('👤 Spectator nuevo pero ya hay conexión activa - ignorando');
          return;
        }
        console.log('👤 Nuevo spectator → recreando peer');
        await initPeer(true, streamRef.current);
        return;
      }

      if (!peerRef.current) {
        signalQueueRef.current.push(signal);
        return;
      }

      if (signalQueueRef.current.length > 0) {
        const queue = [...signalQueueRef.current];
        signalQueueRef.current = [];
        for (const s of queue) {
          try { peerRef.current.signal(s); } catch {}
        }
      }

      try {
        peerRef.current.signal(signal);
      } catch (e: any) {
        if (!e.message?.includes('wrong state')) console.error(e.message);
      }
    });
  }, [onSignal, isBroadcaster, initPeer]);

  return { stream, remoteStream, connected, error };
}
