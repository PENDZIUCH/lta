// lib/useSignaling.ts - WebSocket signaling con estado de conexión
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSignaling(broadcastId: string) {
  const socketRef = useRef<WebSocket | null>(null);
  const signalCallbacksRef = useRef<((signal: any) => void)[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Conectar al WebSocket de Cloudflare
  useEffect(() => {
    console.log('🔌 Conectando a Cloudflare WebSocket...');
    
    const wsUrl = `wss://lta-webrtc.pendziuch.workers.dev?broadcastId=${broadcastId}`;
    console.log('🌐 WebSocket URL:', wsUrl);

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('✅ WebSocket conectado a Cloudflare');
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const signal = JSON.parse(event.data);
      console.log('📥 Signal recibido:', signal.type);
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

    return () => {
      console.log('🧹 Cerrando WebSocket');
      socket.close();
    };
  }, [broadcastId]);

  // Enviar signal al servidor
  const sendSignal = useCallback((signal: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Socket no conectado, esperando...');
      return;
    }

    console.log('📡 Enviando signal:', signal.type);
    socketRef.current.send(JSON.stringify(signal));
  }, []);

  // Registrar callback para signals entrantes
  const onSignal = useCallback((callback: (signal: any) => void) => {
    signalCallbacksRef.current.push(callback);
    
    return () => {
      signalCallbacksRef.current = signalCallbacksRef.current.filter(cb => cb !== callback);
    };
  }, []);

  return { sendSignal, onSignal, isConnected };
}
