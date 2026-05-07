'use client';

import { useRef, useEffect, useState } from 'react';
import { Participant } from '@/lib/useSFU';

function ParticipantCard({ participant, isLocal = false, onMute, isMutedByHost }: {
  participant: Participant;
  isLocal?: boolean;
  onMute?: () => void;
  isMutedByHost?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (participant.stream && videoRef.current) {
      videoRef.current.srcObject = participant.stream;
      // Local siempre muted, remoto intentar con audio
      videoRef.current.muted = isLocal;
      videoRef.current.play()
        .then(() => setPlaying(true))
        .catch(() => {
          // Si falla con audio, intentar muteado
          if (!isLocal && videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
          }
        });
    }
  }, [participant.stream, isLocal]);

  const handleClick = () => {
    if (videoRef.current && videoRef.current.muted && !isLocal) {
      videoRef.current.muted = false;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden mb-2 relative">
      {participant.stream ? (
        <div className="relative cursor-pointer" onClick={handleClick}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className="w-full h-28 object-cover bg-black"
          />
          {!isLocal && videoRef.current?.muted && playing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
              <span className="text-white text-xs bg-black bg-opacity-70 px-2 py-1 rounded">🔇 Tocá para audio</span>
            </div>
          )}
          {isMutedByHost && (
            <div className="absolute top-1 left-1 bg-red-600 text-white text-xs px-1 rounded">MUTEADO</div>
          )}
        </div>
      ) : (
        <div className="w-full h-16 bg-gray-700 flex items-center justify-center">
          <span className="text-3xl">📷</span>
        </div>
      )}
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-white text-xs truncate">{isLocal ? 'Vos' : participant.name}</p>
        {onMute && !isLocal && (
          <button onClick={onMute} className="text-red-400 text-xs hover:text-red-300 ml-1">🔇</button>
        )}
      </div>
    </div>
  );
}

interface ParticipantsColumnProps {
  participants: Participant[];
  localStream?: MediaStream | null;
  localName?: string;
  onMuteParticipant?: (number: string) => void;
  mutedByHost?: Set<string>;
}

export function ParticipantsColumn({ participants, localStream, localName, onMuteParticipant, mutedByHost }: ParticipantsColumnProps) {
  const hasContent = participants.length > 0 || localStream;
  if (!hasContent) return null;

  const localParticipant: Participant | null = localStream ? {
    number: 'local',
    name: localName || 'Vos',
    sessionId: '',
    trackNames: [],
    stream: localStream,
  } : null;

  const total = participants.length + (localParticipant ? 1 : 0);

  return (
    <div className="w-44 flex-shrink-0">
      <p className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wide">
        👥 En vivo ({total})
      </p>
      {localParticipant && (
        <ParticipantCard participant={localParticipant} isLocal={true} />
      )}
      {participants.map(p => (
        <ParticipantCard
          key={p.number}
          participant={p}
          isLocal={false}
          onMute={onMuteParticipant ? () => onMuteParticipant(p.number) : undefined}
          isMutedByHost={mutedByHost?.has(p.number)}
        />
      ))}
    </div>
  );
}
