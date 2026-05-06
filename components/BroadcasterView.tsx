'use client';

import { useSFUBroadcaster } from '@/lib/useSFU';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Chat } from './Chat';

function StageParticipantCard({ participant, onRemove }: { participant: any; onRemove: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (participant.stream && videoRef.current) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden mb-2">
      {participant.withVideo && participant.stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-32 object-cover bg-black" />
      ) : (
        <div className="w-full h-16 bg-gray-700 flex items-center justify-center">
          <span className="text-white text-2xl">🎤</span>
        </div>
      )}
      <div className="p-2 flex items-center justify-between">
        <span className="text-white text-sm font-bold">{participant.name}</span>
        <button onClick={onRemove} className="text-red-400 text-xs hover:text-red-300">✕ Sacar</button>
      </div>
    </div>
  );
}

export function BroadcasterView({ broadcastId }: { broadcastId: string }) {
  const { stream, live, viewers, messages, stageRequests, stageParticipants, error, sendMessage, approveStage, rejectStage, removeFromStage } = useSFUBroadcaster(broadcastId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [origin, setOrigin] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const watchUrl = `${origin}/watch/${broadcastId}`;

  return (
    <div className="flex flex-col min-h-screen bg-black p-4">
      <div className="max-w-5xl w-full mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">🎥 Transmitiendo en Vivo</h1>

        {error && <div className="bg-red-500 text-white p-4 rounded mb-4 text-sm">Error: {error}</div>}

        {/* Stage requests */}
        {stageRequests.map((req) => (
          <div key={req.viewerNumber} className="bg-yellow-600 text-white p-3 rounded mb-2 flex items-center justify-between">
            <span className="text-sm font-bold">
              {req.from} quiere {req.withVideo ? '📹 participar con cámara' : '🎤 participar solo con audio'}
            </span>
            <div className="flex gap-2">
              <button onClick={() => approveStage(req)} className="bg-green-500 px-3 py-1 rounded text-sm font-bold">✅ Aceptar</button>
              <button onClick={() => rejectStage(req.viewerNumber)} className="bg-red-500 px-3 py-1 rounded text-sm font-bold">❌ Rechazar</button>
            </div>
          </div>
        ))}

        <div className="flex gap-4">
          {/* Main content */}
          <div className="flex-1">
            <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-auto bg-black" />
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 bg-gray-800 p-3 rounded text-white">
                <p className="text-xs text-gray-400">Estado</p>
                <p className="font-bold">{live ? '🔴 En vivo' : '⏳ Iniciando...'}</p>
              </div>
              <div className="flex-1 bg-gray-800 p-3 rounded text-white">
                <p className="text-xs text-gray-400">Espectadores</p>
                <p className="font-bold">👥 {viewers}</p>
              </div>
            </div>

            <div className="bg-blue-600 p-3 rounded mb-4 text-white">
              <p className="text-xs mb-2">Link para compartir:</p>
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

            <div className="mb-4">
              <Chat messages={messages} onSend={sendMessage} myName="Yo" />
            </div>

            <Link href="/">
              <button className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded font-bold">
                🛑 Detener Transmisión
              </button>
            </Link>
          </div>

          {/* Columna lateral - participantes en escenario */}
          {stageParticipants.length > 0 && (
            <div className="w-48">
              <p className="text-white text-sm font-bold mb-2">🎭 En escenario</p>
              {stageParticipants.map((p) => (
                <StageParticipantCard
                  key={p.number}
                  participant={p}
                  onRemove={() => removeFromStage(p.number)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
