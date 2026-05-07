'use client';

import { useRef, useEffect } from 'react';
import { Participant } from '@/lib/useSFU';

function ParticipantCard({ participant, isLocal = false }: { participant: Participant; isLocal?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (participant.stream && videoRef.current) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [participant.stream]);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden mb-2">
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} // solo mute la propia cámara
          className="w-full h-28 object-cover bg-black"
        />
      ) : (
        <div className="w-full h-16 bg-gray-700 flex items-center justify-center">
          <span className="text-3xl">📷</span>
        </div>
      )}
      <p className="text-white text-xs text-center py-1 px-2 truncate">
        {isLocal ? 'Vos' : participant.name}
      </p>
    </div>
  );
}

interface ParticipantsColumnProps {
  participants: Participant[];
  localStream?: MediaStream | null;
  localName?: string;
}

export function ParticipantsColumn({ participants, localStream, localName }: ParticipantsColumnProps) {
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
        <ParticipantCard key={p.number} participant={p} isLocal={false} />
      ))}
    </div>
  );
}
