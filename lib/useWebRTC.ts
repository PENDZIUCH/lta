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
  const { sendSignal, onSignal, isConnected: socketConnected } = useSignaling(broadcastId, isBroadcaster);

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
        setConnected(false);
      });

      peerRef.current = peer;
    }

    initPeer();

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [stream, isBroadcaster, sendSignal, socketConnected]);

  useEffect(() => {
    const unsubscribe = onSignal((signal: any) => {
      if (!peerRef.current) return;
      try {
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
