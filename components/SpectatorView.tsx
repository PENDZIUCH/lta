'use client';

import { useSFUSpectator } from '@/lib/useSFU';
import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { Chat } from './Chat';

export function SpectatorView({ broadcastId }: { broadcastId: string }) {
  const { remoteStream, connected, messages, myName, stageStatus, error, sendMessage, requestStage } = useSFUSpectator(broadcastId);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [showStageOptions, setShowStageOptions] = useState(false);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play()
        .then(() => setNeedsPlay(false))
        .catch(() => setNeedsPlay(true));
    }
  }, [remoteStream]);

  const handleRequestStage = (withVideo: boolean) => {
    requestStage(withVideo);
    setShowStageOptions(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-black p-4">
      <div className="max-w-2xl w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">📺 Viendo en Vivo</h1>
          <span className="text-gray-400 text-sm">{myName}</span>
        </div>

        {error && <div className="bg-red-500 text-white p-4 rounded mb-4 text-sm">Error: {error}</div>}

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

        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-gray-800 p-3 rounded text-white">
            <p className="text-xs text-gray-400">Estado</p>
            <p className="font-bold">{connected ? '✅ Conectado' : '⏳ Conectando...'}</p>
          </div>

          {/* Botón pedir participar */}
          <div className="flex-1">
            {stageStatus === 'idle' && (
              <div className="relative">
                <button
                  onClick={() => setShowStageOptions(!showStageOptions)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded font-bold text-sm"
                >
                  🙋 Participar
                </button>
                {showStageOptions && (
                  <div className="absolute bottom-full mb-2 w-full bg-gray-800 rounded overflow-hidden shadow-lg z-10">
                    <button
                      onClick={() => handleRequestStage(true)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-gray-700 text-sm"
                    >
                      📹 Con cámara y audio
                    </button>
                    <button
                      onClick={() => handleRequestStage(false)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-gray-700 text-sm border-t border-gray-700"
                    >
                      🎤 Solo audio
                    </button>
                  </div>
                )}
              </div>
            )}
            {stageStatus === 'requested' && (
              <div className="w-full bg-yellow-600 text-white py-3 rounded text-center text-sm font-bold">
                ⏳ Esperando aprobación...
              </div>
            )}
            {stageStatus === 'approved' && (
              <div className="w-full bg-green-600 text-white py-3 rounded text-center text-sm font-bold">
                ✅ ¡Estás en escenario!
              </div>
            )}
            {stageStatus === 'rejected' && (
              <div className="w-full bg-red-600 text-white py-3 rounded text-center text-sm font-bold">
                ❌ Solicitud rechazada
              </div>
            )}
          </div>
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
