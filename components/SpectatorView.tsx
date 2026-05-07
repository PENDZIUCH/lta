'use client';

import { useSFUSpectator } from '@/lib/useSFU';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Chat } from './Chat';
import { ParticipantsColumn } from './ParticipantsColumn';

export function SpectatorView({ broadcastId }: { broadcastId: string }) {
  const { remoteStream, localStream, connected, messages, myName, participants, error, sendMessage } = useSFUSpectator(broadcastId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Activar audio en el primer click
  useEffect(() => {
    const handleClick = () => {
      if (videoRef.current && muted) {
        videoRef.current.muted = false;
        setMuted(false);
      }
    };
    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, [muted]);

  return (
    <div className="flex flex-col min-h-screen bg-black p-4">
      <div className="max-w-5xl w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">📺 Viendo en Vivo</h1>
          <span className="text-gray-400 text-sm">{myName}</span>
        </div>

        {error && <div className="bg-red-500 text-white p-3 rounded mb-4 text-sm">Error: {error}</div>}

        <div className="flex gap-4">
          {/* Main */}
          <div className="flex-1 min-w-0">
            <div className="bg-gray-900 rounded-lg overflow-hidden mb-4 relative">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-auto bg-black"
                style={{ display: remoteStream ? 'block' : 'none' }} />
              {remoteStream && muted && (
                <div onClick={() => { if (videoRef.current) { videoRef.current.muted = false; setMuted(false); } }}
                  className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded cursor-pointer">
                  🔇 Tocá para activar audio
                </div>
              )}
              {!remoteStream && (
                <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-white">
                  {connected ? '⏳ Cargando stream...' : '🔄 Conectando...'}
                </div>
              )}
            </div>

            {/* Preview cámara local */}
            {localStream && (
              <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
                <p className="text-gray-400 text-xs px-3 pt-2">Tu cámara (los demás te ven)</p>
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-32 object-cover" />
              </div>
            )}

            <div className="bg-gray-800 p-3 rounded text-white mb-4">
              <p className="text-xs text-gray-400">Estado</p>
              <p className="font-bold">{connected ? '✅ Conectado' : '⏳ Conectando...'}</p>
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

          {/* Columna participantes */}
          <ParticipantsColumn participants={participants} />
        </div>
      </div>
    </div>
  );
}
