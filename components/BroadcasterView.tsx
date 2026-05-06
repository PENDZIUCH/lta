'use client';

import { useSFUBroadcaster } from '@/lib/useSFU';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';

export function BroadcasterView({ broadcastId }: { broadcastId: string }) {
  const { stream, live, viewers, error } = useSFUBroadcaster(broadcastId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const watchUrl = `${origin}/watch/${broadcastId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(watchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(watchUrl)}`, '_blank');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-white mb-4">🎥 Transmitiendo en Vivo</h1>

        {error && <div className="bg-red-500 text-white p-4 rounded mb-4">Error: {error}</div>}

        <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-auto bg-black" />
        </div>

        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-gray-800 p-4 rounded text-white">
            <p className="text-sm text-gray-400">Estado</p>
            <p className="text-xl font-bold">{live ? '🔴 En vivo' : '⏳ Iniciando...'}</p>
          </div>
          <div className="flex-1 bg-gray-800 p-4 rounded text-white">
            <p className="text-sm text-gray-400">Espectadores</p>
            <p className="text-xl font-bold">👥 {viewers}</p>
          </div>
        </div>

        <div className="bg-blue-600 p-4 rounded mb-4 text-white">
          <p className="text-sm mb-2">Compartí este link:</p>
          <p className="bg-blue-800 p-2 rounded text-xs break-all mb-3">{watchUrl}</p>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="flex-1 bg-white text-blue-700 font-bold py-2 px-4 rounded text-sm">
              {copied ? '✅ Copiado!' : '📋 Copiar'}
            </button>
            <button onClick={handleWhatsApp} className="flex-1 bg-green-500 text-white font-bold py-2 px-4 rounded text-sm">
              📲 Compartir
            </button>
          </div>
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
