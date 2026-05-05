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
  const iceServersRef = useRef<any[]>([]);
  const { sendSignal, onSignal, onNewSpectator, isConnected: socketConnected } = useSignaling(broadcastId, isBroadcaster);

  useEffect(() => {
    if (!isBroadcaster) return;
    async function getLocalStream() {
      try {
        console.log('📹 Pidiendo cámara...');
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        console.log('✅ Cámara obtenida');
        setStream(mediaStream);
      } catch (err) {
        setError(`Error: ${err}`);
      }
    }
    getLocalStream();
  }, [isBroadcaster]);

  const createPeer = async (currentStream: MediaStream | null) => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (!iceServersRef.current.length) {
      console.log('🚀 Obteniendo TURN credentials...');
      iceServersRef.current = await getIceServers();
    }

    console.log('🔥 Creando peer...');
    const peer = createSimplePeer({
      initiator: isBroadcaster,
      stream: currentStream || undefined,
      iceServers: iceServersRef.current,
    });

    peer.on('signal', (data: any) => {
      console.log('📡 Signal:', data.type || 'candidate');
      sendSignal(data);
    });

    peer.on('connect', () => {
      console.log('✅✅✅ PEER CONECTADO ✅✅✅');
      setConnected(true);
    });

    peer.on('stream', (remoteMediaStream: MediaStream) => {
      console.log('🎥 Stream recibido');
      setRemoteStream(remoteMediaStream);
    });

    peer.on('error', (err: any) => {
      if (!err.message.includes('wrong state')) {
        console.error('❌ WebRTC Error:', err.message);
        setError(`Error: ${err.message}`);
      }
    });

    peer.on('close', () => setConnected(false));

    peerRef.current = peer;

    // Procesar signals encolados
    if (signalQueueRef.current.length > 0) {
      console.log(`📬 Procesando ${signalQueueRef.current.length} signals encolados`);
      for (const signal of signalQueueRef.current) {
        try { peer.signal(signal); } catch {}
      }
      signalQueueRef.current = [];
    }
  };

  useEffect(() => {
    if (!socketConnected) return;
    if (!stream && isBroadcaster) return;
    createPeer(stream);
    return () => {
      if (peerRef.current) peerRef.current.destroy();
      signalQueueRef.current = [];
    };
  }, [stream, isBroadcaster, sendSignal, socketConnected]);

  // Broadcaster: recrear peer cuando llega nuevo spectator
  useEffect(() => {
    if (!isBroadcaster) return;
    onNewSpectator(() => {
      console.log('🔄 Nuevo spectator - recreando peer...');
      setConnected(false);
      signalQueueRef.current = [];
      createPeer(stream);
    });
  }, [isBroadcaster, onNewSpectator, stream]);

  // Spectator: encolar signals
  useEffect(() => {
    const unsubscribe = onSignal((signal: any) => {
      if (!peerRef.current) {
        console.log('📥 Encolando signal:', signal.type || 'candidate');
        signalQueueRef.current.push(signal);
        return;
      }
      try {
        console.log('➡️ Signal al peer:', signal.type || 'candidate');
        peerRef.current.signal(signal);
      } catch (err: any) {
        if (!err.message?.includes('wrong state')) {
          console.error('❌ Error signal:', err.message);
        }
      }
    });
    return unsubscribe;
  }, [onSignal]);

  return { stream, remoteStream, connected, error };
}
