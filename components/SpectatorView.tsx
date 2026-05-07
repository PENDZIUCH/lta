'use client';

import { useSFUSpectator } from '@/lib/useSFU';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Chat } from './Chat';
import { ParticipantsColumn } from './ParticipantsColumn';

export function SpectatorView({ broadcastId }: { broadcastId: string }) {
  const { remoteStream, localStream, connected, messages, myName, participants, micOn, cameraOn, error, sendMessage, toggleMic, toggleCamera } = useSFUSpectator(broadcastId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

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
    <div className="flex flex-col min-h-screen bg-black p-3">
      <div className="w-full max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-white">📺 En Vivo</h1>
          <span className="text-gray-400 text-sm">{myName}</span>
        </div>

        {error && <div className="bg-red-500 text-white p-3 rounded mb-3 text-sm">Error: {error}</div>}

        {/* Layout: desktop = lado a lado, mobile = apilado */}
        <div className="flex flex-col lg:flex-row gap-3">

          {/* Columna principal */}
          <div className="flex-1 min-w-0">

            {/* Video principal */}
            <div className="bg-gray-900 rounded-lg overflow-hidden mb-3 relative">
              <video
                ref={videoRef}
                autoPlay muted playsInline
                className="w-full bg-black"
                style={{ display: remoteStream ? 'block' : 'none', maxHeight: '60vh' }}
              />
              {remoteStream && muted && (
                <div
                  onClick={() => { if (videoRef.current) { videoRef.current.muted = false; setMuted(false); } }}
                  className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded cursor-pointer"
                >
                  🔇 Tocá para audio
                </div>
              )}
              {!remoteStream && (
                <div className="w-full aspect-video bg-gray-800 flex items-center justify-center text-white text-sm">
                  {connected ? '⏳ Cargando...' : '🔄 Conectando...'}
                </div>
              )}
            </div>

            {/* Controles */}
            <div className="flex gap-2 mb-3">
              <button onClick={toggleMic}
                className={`flex-1 py-2 rounded font-bold text-sm ${micOn ? 'bg-gray-700 text-white' : 'bg-red-700 text-white'}`}>
                {micOn ? '🎤 Mic' : '🔇 Muteado'}
              </button>
              <button onClick={toggleCamera}
                className={`flex-1 py-2 rounded font-bold text-sm ${cameraOn ? 'bg-gray-700 text-white' : 'bg-red-700 text-white'}`}>
                {cameraOn ? '📹 Cámara' : '📵 Sin cámara'}
              </button>
              <div className={`flex-1 py-2 rounded text-center text-sm font-bold ${connected ? 'bg-green-800 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                {connected ? '✅ Online' : '⏳ ...'}
              </div>
            </div>

            {/* Participantes en mobile - fila horizontal */}
            {(participants.length > 0 || localStream) && (
              <div className="lg:hidden mb-3">
                <p className="text-gray-400 text-xs font-bold mb-2 uppercase">👥 En vivo</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {localStream && (
                    <div className="flex-shrink-0 w-28">
                      <MiniParticipant stream={localStream} name="Vos" isLocal={true} />
                    </div>
                  )}
                  {participants.map(p => (
                    <div key={p.number} className="flex-shrink-0 w-28">
                      <MiniParticipant stream={p.stream} name={p.name} isLocal={false} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat */}
            <div className="mb-3">
              <Chat messages={messages} onSend={sendMessage} myName="Yo" />
            </div>

            <Link href="/">
              <button className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded font-bold">
                ⬅️ Volver
              </button>
            </Link>
          </div>

          {/* Columna lateral - solo desktop */}
          <div className="hidden lg:block">
            <ParticipantsColumn participants={participants} localStream={localStream} localName={myName} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniParticipant({ stream, name, isLocal }: { stream?: MediaStream | null; name: string; isLocal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className="bg-gray-800 rounded overflow-hidden">
      {stream ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal} className="w-full h-20 object-cover bg-black" />
      ) : (
        <div className="w-full h-16 bg-gray-700 flex items-center justify-center text-2xl">📷</div>
      )}
      <p className="text-white text-xs text-center py-1 truncate px-1">{name}</p>
    </div>
  );
}
