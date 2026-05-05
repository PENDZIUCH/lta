// components/SpectatorView.tsx
'use client';

import { useWebRTC } from '@/lib/useWebRTC';
import { useRef, useEffect } from 'react';
import Link from 'next/link';

export function SpectatorView({ broadcastId }: { broadcastId: string }) {
  const { remoteStream, connected, error } = useWebRTC(broadcastId, false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-white mb-4">📺 Viendo en Vivo</h1>

        {error && (
          <div className="bg-red-500 text-white p-4 rounded mb-4">
            Error: {error}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
          {connected && remoteStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-auto bg-black"
            />
          ) : (
            <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-white">
              {connected ? '⏳ Cargando stream...' : '🔄 Conectando...'}
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded text-white mb-4">
          <p className="text-sm text-gray-400">Estado</p>
          <p className="text-xl font-bold">
            {connected ? '✅ Conectado' : '⏳ Conectando...'}
          </p>
        </div>

        <Link href="/">
          <button className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded font-bold">
            ⬅️ Volver
          </button>
        </Link>
      </div>
    </div>
  );
}
