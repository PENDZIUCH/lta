'use client';

import { useWebRTC } from '@/lib/useWebRTC';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';

export function BroadcasterView({ broadcastId }: { broadcastId: string }) {
  const { stream, error, connected } = useWebRTC(broadcastId, true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const watchUrl = `${origin}/watch/${broadcastId}`;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-white mb-4">🎥 Transmitiendo en Vivo</h1>

        {error && (
          <div className="bg-red-500 text-white p-4 rounded mb-4">
            Error: {error}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-auto bg-black" />
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-gray-800 p-4 rounded text-white">
            <p className="text-sm text-gray-400">Estado</p>
            <p className="text-xl font-bold">{connected ? '✅ En vivo' : '⏳ Conectando...'}</p>
          </div>
          <div className="flex-1 bg-gray-800 p-4 rounded text-white">
            <p className="text-sm text-gray-400">ID Broadcast</p>
            <p className="text-sm font-mono break-all">{broadcastId}</p>
          </div>
        </div>

        <div className="bg-blue-600 p-4 rounded mb-4 text-white">
          <p className="text-sm mb-2">Compartí este link con amigos:</p>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-800 p-2 rounded block break-all text-xs hover:bg-blue-700 cursor-pointer select-all"
          >
            {watchUrl}
          </a>
        </div>

        <Link href="/">
          <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded font-bold">
            🛑 Detener Transmisión
          </button>
        </Link>
      </div>
    </div>
  );
}
