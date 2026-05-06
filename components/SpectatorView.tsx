'use client';

import { useSFUSpectator } from '@/lib/useSFU';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Chat } from './Chat';

export function SpectatorView({ broadcastId }: { broadcastId: string }) {
  const { remoteStream, connected, messages, error, sendMessage } = useSFUSpectator(broadcastId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play()
        .then(() => setNeedsPlay(false))
        .catch(() => setNeedsPlay(true));
    }
  }, [remoteStream]);

  return (
    <div className="flex flex-col min-h-screen bg-black p-4">
      <div className="max-w-2xl w-full mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">📺 Viendo en Vivo</h1>

        {error && <div className="bg-red-500 text-white p-4 rounded mb-4">Error: {error}</div>}

        <div className="bg-gray-900 rounded-lg overflow-hidden mb-4 relative">
          <video
            ref={videoRef}
            autoPlay playsInline
            className="w-full h-auto bg-black"
            style={{ display: remoteStream ? 'block' : 'none' }}
          />
          {needsPlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
              <button
                onClick={() => { videoRef.current?.play(); setNeedsPlay(false); }}
                className="bg-white text-black font-bold py-4 px-8 rounded-full text-xl"
              >
                ▶ Ver stream
              </button>
            </div>
          )}
          {!remoteStream && (
            <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-white">
              {connected ? '⏳ Cargando stream...' : '🔄 Conectando...'}
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded text-white mb-4">
          <p className="text-sm text-gray-400">Estado</p>
          <p className="text-xl font-bold">{connected ? '✅ Conectado' : '⏳ Conectando...'}</p>
        </div>

        <div className="mb-4">
          <Chat messages={messages} onSend={sendMessage} myName="Yo" />
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
