'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSignaling(broadcastId: string, isBroadcaster: boolean = false) {
  const socketRef = useRef<WebSocket | null>(null);
  const signalCallbacksRef = useRef<((signal: any) => void)[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const role = isBroadcaster ? 'broadcaster' : 'spectator';
    const wsUrl = `wss://lta-webrtc.pendziuch.workers.dev?broadcastId=${broadcastId}&role=${role}`;
    console.log('🌐 WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => { console.log('✅ WS conectado'); setIsConnected(true); };
    socket.onmessage = (e) => {
      const signal = JSON.parse(e.data);
      console.log('📥 Signal recibido:', signal.type || 'candidate');
      signalCallbacksRef.current.forEach(cb => cb(signal));
    };
    socket.onclose = () => { console.log('❌ WS desconectado'); setIsConnected(false); };
    socketRef.current = socket;
    return () => socket.close();
  }, [broadcastId, isBroadcaster]);

  const sendSignal = useCallback((signal: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('📡 Enviando:', signal.type || 'candidate');
      socketRef.current.send(JSON.stringify(signal));
    }
  }, []);

  const onSignal = useCallback((cb: (signal: any) => void) => {
    signalCallbacksRef.current.push(cb);
    return () => { signalCallbacksRef.current = signalCallbacksRef.current.filter(c => c !== cb); };
  }, []);

  return { sendSignal, onSignal, isConnected };
}
