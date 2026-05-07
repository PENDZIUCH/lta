'use client';

import { useSFUBroadcaster } from '@/lib/useSFU';
import { useRef, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Chat } from './Chat';
import { ParticipantsColumn } from './ParticipantsColumn';

export function BroadcasterView({ broadcastId }: { broadcastId: string }) {
  const { stream, live, viewers, messages, participants, error, sendMessage } = useSFUBroadcaster(broadcastId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const toggleMic = useCallback(() => {
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  }, [stream]);

  const toggleCamera = useCallback(() => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCameraOn(track.enabled); }
  }, [stream]);

  const watchUrl = `${origin}/watch/${broadcastId}`;

  return (
    <div className="flex flex-col min-h-screen bg-black p-3">
      <div className="w-full max-w-5xl mx-auto">

        <h1 className="text-xl font-bold text-white mb-3">🎥 Transmitiendo</h1>
        {error && <div className="bg-red-500 text-white p-3 rounded mb-3 text-sm">Error: {error}</div>}

        <div className="flex flex-col lg:flex-row gap-3">

          {/* Columna principal */}
          <div className="flex-1 min-w-0">

            {/* Video */}
            <div className="bg-gray-900 rounded-lg overflow-hidden mb-3">
              <video ref={videoRef} autoPlay muted playsInline
                className="w-full bg-black"
                style={{ maxHeight: '60vh' }} />
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
            </div>

            {/* Estado */}
            <div className="flex gap-3 mb-3">
              <div className="flex-1 bg-gray-800 p-3 rounded text-white">
                <p className="text-xs text-gray-400">Estado</p>
                <p className="font-bold">{live ? '🔴 En vivo' : '⏳ Iniciando...'}</p>
              </div>
              <div className="flex-1 bg-gray-800 p-3 rounded text-white">
                <p className="text-xs text-gray-400">Espectadores</p>
                <p className="font-bold">👥 {viewers}</p>
              </div>
            </div>

            {/* Participantes en mobile - fila horizontal */}
            {participants.length > 0 && (
              <div className="lg:hidden mb-3">
                <p className="text-gray-400 text-xs font-bold mb-2 uppercase">👥 Participantes</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {participants.map(p => (
                    <div key={p.number} className="flex-shrink-0 w-28">
                      <MiniParticipant stream={p.stream} name={p.name} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Link */}
            <div className="bg-blue-600 p-3 rounded mb-3 text-white">
              <p className="text-xs mb-2">Compartí este link:</p>
              <p className="bg-blue-800 p-2 rounded text-xs break-all mb-2">{watchUrl}</p>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(watchUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="flex-1 bg-white text-blue-700 font-bold py-1 px-3 rounded text-xs">
                  {copied ? '✅ Copiado!' : '📋 Copiar'}
                </button>
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(watchUrl)}`, '_blank')}
                  className="flex-1 bg-green-500 text-white font-bold py-1 px-3 rounded text-xs">
                  📲 WhatsApp
                </button>
              </div>
            </div>

            <div className="mb-3">
              <Chat messages={messages} onSend={sendMessage} myName="Yo" />
            </div>

            <Link href="/">
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded font-bold">
                🛑 Detener
              </button>
            </Link>
          </div>

          {/* Columna lateral - solo desktop */}
          <div className="hidden lg:block">
            <ParticipantsColumn participants={participants} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniParticipant({ stream, name }: { stream?: MediaStream | null; name: string }) {
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
        <video ref={videoRef} autoPlay playsInline className="w-full h-20 object-cover bg-black" />
      ) : (
        <div className="w-full h-16 bg-gray-700 flex items-center justify-center text-2xl">📷</div>
      )}
      <p className="text-white text-xs text-center py-1 truncate px-1">{name}</p>
    </div>
  );
}
