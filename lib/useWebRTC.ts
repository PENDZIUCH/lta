// lib/useWebRTC.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { createSimplePeer, getIceServers } from './webrtc';
import { useSignaling } from './useSignaling';

export function useWebRTC(broadcastId: string, isBroadcaster: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const peerRef = useRef<any>(null);
  const signalQueueRef = useRef<any[]>([]);
  const peerReadyRef = useRef(false);
  const { sendSignal, onSignal, isConnected: socketConnected } = useSignaling(broadcastId, isBroadcaster);

  // 1. Obtener cámara (broadcaster)
  useEffect(() => {
    if (!isBroadcaster) return;
    navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: true,
    }).then(mediaStream => {
      console.log('✅ Cámara obtenida');
      setStream(mediaStream);
    }).catch(err => setError(`Error cámara: ${err}`));
  }, [isBroadcaster]);

  // 2. Crear peer cuando WebSocket conecta
  useEffect(() => {
    if (!socketConnected) return;
    if (isBroadcaster && !stream) return;

    async function initPeer() {
      console.log('🚀 Obteniendo TURN credentials...');
      const iceServers = await getIceServers();
      console.log('🔥 Creando peer...');

      const peer = createSimplePeer({
        initiator: isBroadcaster,
        stream: stream || undefined,
        iceServers,
      });

      peer.on('signal', (data: any) => {
        console.log('📡 Signal out:', data.type || 'candidate');
        sendSignal(data);
      });

      peer.on('connect', () => {
        console.log('✅✅✅ PEER CONECTADO ✅✅✅');
        setConnected(true);
      });

      peer.on('stream', (remoteMediaStream: MediaStream) => {
        console.log('🎥 Stream recibido!');
        setRemoteStream(remoteMediaStream);
      });

      peer.on('error', (err: any) => {
        if (!err.message?.includes('wrong state')) {
          console.error('❌ Error:', err.message);
          setError(err.message);
        }
      });

      peer.on('close', () => setConnected(false));

      peerRef.current = peer;
      peerReadyRef.current = true;

      // Procesar signals encolados
      if (signalQueueRef.current.length > 0) {
        console.log(`📬 Procesando ${signalQueueRef.current.length} signals encolados`);
        const queue = [...signalQueueRef.current];
        signalQueueRef.current = [];
        for (const signal of queue) {
          try {
            console.log('➡️ Signal encolado al peer:', signal.type || 'candidate');
            peer.signal(signal);
          } catch (e: any) {
            if (!e.message?.includes('wrong state')) console.error(e.message);
          }
        }
      }
    }

    initPeer();

    return () => {
      peerReadyRef.current = false;
      if (peerRef.current) peerRef.current.destroy();
      signalQueueRef.current = [];
    };
  }, [socketConnected, stream, isBroadcaster, sendSignal]);

  // 3. Recibir signals
  useEffect(() => {
    const unsubscribe = onSignal((signal: any) => {
      if (signal.type === 'new-spectator') return;

      if (!peerReadyRef.current || !peerRef.current) {
        console.log('📥 Encolando signal:', signal.type || 'candidate');
        signalQueueRef.current.push(signal);
        return;
      }

      try {
        console.log('➡️ Signal al peer:', signal.type || 'candidate');
        peerRef.current.signal(signal);
      } catch (e: any) {
        if (!e.message?.includes('wrong state')) console.error(e.message);
      }
    });
    return unsubscribe;
  }, [onSignal]);

  return { stream, remoteStream, connected, error };
}
