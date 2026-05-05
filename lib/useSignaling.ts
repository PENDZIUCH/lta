// lib/useSignaling.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSignaling(broadcastId: string, isBroadcaster: boolean = false) {
  const socketRef = useRef<WebSocket | null>(null);
  const signalCallbacksRef = useRef<((signal: any) => void)[]>([]);
  const newSpectatorCallbackRef = useRef<(() => void) | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const role = isBroadcaster ? 'broadcaster' : 'spectator';
    const wsUrl = `wss://lta-webrtc.pendziuch.workers.dev?broadcastId=${broadcastId}&role=${role}`;
    console.log('🌐 WebSocket URL:', wsUrl);

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ WebSocket conectado a Cloudflare');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const signal = JSON.parse(event.data);
      
      // Si es notificación de nuevo spectator, avisar al broadcaster
      if (signal.type === 'new-spectator') {
        console.log('👤 Nuevo spectator conectado - reenviar offer');
        if (newSpectatorCallbackRef.current) {
          newSpectatorCallbackRef.current();
        }
        return;
      }

      console.log('➡️ Signal recibido:', signal.type || 'candidate');
      signalCallbacksRef.current.forEach(cb => cb(signal));
    };

    socket.onclose = () => {
      console.log('❌ WebSocket desconectado');
      setIsConnected(false);
    };

    socket.onerror = (err) => {
      console.error('❌ Error WebSocket:', err);
    };

    socketRef.current = socket;
    return () => { socket.close(); };
  }, [broadcastId, isBroadcaster]);

  const sendSignal = useCallback((signal: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Socket no conectado');
      return;
    }
    console.log('📡 Enviando signal:', signal.type || 'candidate');
    socketRef.current.send(JSON.stringify(signal));
  }, []);

  const onSignal = useCallback((callback: (signal: any) => void) => {
    signalCallbacksRef.current.push(callback);
    return () => {
      signalCallbacksRef.current = signalCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  const onNewSpectator = useCallback((callback: () => void) => {
    newSpectatorCallbackRef.current = callback;
  }, []);

  return { sendSignal, onSignal, onNewSpectator, isConnected };
}
