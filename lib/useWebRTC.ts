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
  const { sendSignal, onSignal, isConnected: socketConnected } = useSignaling(broadcastId);

  // 1. Obtener stream local (cámara)
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
        console.error('❌ Error cámara:', err);
        setError(`Error: ${err}`);
      }
    }

    getLocalStream();
  }, [isBroadcaster]);

  // 2. Crear SimplePeer con TURN credentials de Cloudflare
  useEffect(() => {
    if (!socketConnected) return;
    if (!stream && isBroadcaster) return;

    async function initPeer() {
      console.log('🚀 Obteniendo TURN credentials...');
      const iceServers = await getIceServers();

      const peer = createSimplePeer({
        initiator: isBroadcaster,
        stream: stream || undefined,
        iceServers,
      });

      // Log ICE connection state via underlying RTCPeerConnection
      (peer as any)._pc?.addEventListener('iceconnectionstatechange', () => {
        console.log('🧊 ICE state:', (peer as any)._pc?.iceConnectionState);
      });

      (peer as any)._pc?.addEventListener('icegatheringstatechange', () => {
        console.log('🧊 ICE gathering:', (peer as any)._pc?.iceGatheringState);
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
        console.error('❌ WebRTC Error:', err.message);
        if (!err.message.includes('wrong state')) {
          setError(`Error: ${err.message}`);
        }
      });

      peer.on('close', () => {
        console.log('❌ Peer cerrado');
        setConnected(false);
      });

      peerRef.current = peer;
    }

    initPeer();

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [stream, isBroadcaster, sendSignal, socketConnected]);

  // 3. Escuchar señales entrantes
  useEffect(() => {
    const unsubscribe = onSignal((signal: any) => {
      if (!peerRef.current) return;
      try {
        console.log('➡️ Signal al peer:', signal.type || 'candidate');
        peerRef.current.signal(signal);
      } catch (err: any) {
        if (!err.message.includes('wrong state')) {
          console.error('❌ Error signal:', err.message);
        }
      }
    });
    return unsubscribe;
  }, [onSignal]);

  return { stream, remoteStream, connected, error };
}
