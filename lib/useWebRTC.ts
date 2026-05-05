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
  const { sendSignal, onSignal, isConnected: socketConnected } = useSignaling(broadcastId, isBroadcaster);

  // Obtener cámara
  useEffect(() => {
    if (!isBroadcaster) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => { console.log('✅ Cámara OK'); streamRef.current = s; setStream(s); })
      .catch(e => setError(`Cámara: ${e}`));
  }, [isBroadcaster]);

  // Función para crear/recrear peer
  const initPeer = useCallback(async (initiator: boolean, currentStream?: MediaStream | null) => {
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
    signalQueueRef.current = [];
    setConnected(false);

    if (!iceServersRef.current.length) {
      console.log('🚀 Obteniendo TURN...');
      iceServersRef.current = await getIceServers();
    }

    console.log('🔥 Creando peer, initiator:', initiator);
    const peer = createSimplePeer({ initiator, stream: currentStream || undefined, iceServers: iceServersRef.current });

    peer.on('signal', (d: any) => { console.log('📡 Signal out:', d.type || 'candidate'); sendSignal(d); });
    peer.on('connect', () => { console.log('✅✅✅ PEER CONECTADO ✅✅✅'); setConnected(true); });
    peer.on('stream', (s: MediaStream) => { console.log('🎥 Stream!'); setRemoteStream(s); });
    peer.on('error', (e: any) => { if (!e.message?.includes('wrong state')) setError(e.message); });
    peer.on('close', () => setConnected(false));

    peerRef.current = peer;
    return peer;
  }, [sendSignal]);

  // Iniciar peer cuando socket conecta
  useEffect(() => {
    if (!socketConnected) return;
    if (isBroadcaster && !stream) return;
    initPeer(isBroadcaster, stream);
    return () => { if (peerRef.current) peerRef.current.destroy(); };
  }, [socketConnected, stream, isBroadcaster]);

  // Recibir signals
  useEffect(() => {
    return onSignal(async (signal: any) => {
      // Broadcaster: nuevo spectator conectado → renegociar
      if (signal.type === 'new-spectator' && isBroadcaster) {
        console.log('👤 Nuevo spectator → recreando peer');
        await initPeer(true, streamRef.current);
        return;
      }

      if (!peerRef.current) {
        signalQueueRef.current.push(signal);
        return;
      }

      // Procesar cola primero
      if (signalQueueRef.current.length > 0) {
        const queue = [...signalQueueRef.current];
        signalQueueRef.current = [];
        for (const s of queue) {
          try { peerRef.current.signal(s); } catch {}
        }
      }

      try {
        console.log('➡️ Signal al peer:', signal.type || 'candidate');
        peerRef.current.signal(signal);
      } catch (e: any) {
        if (!e.message?.includes('wrong state')) console.error(e.message);
      }
    });
  }, [onSignal, isBroadcaster, initPeer]);

  return { stream, remoteStream, connected, error };
}
