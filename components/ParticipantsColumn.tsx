'use client';

import { useRef, useEffect, useState } from 'react';
import { Participant } from '@/lib/useSFU';

function ParticipantCard({ participant, isLocal = false, onMute }: {
  participant: Participant;
  isLocal?: boolean;
  onMute?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioBlocked, setAudioBlocked] = useState(!isLocal);

  useEffect(() => {
    if (!participant.stream || !videoRef.current) return;
    videoRef.current.srcObject = participant.stream;
    videoRef.current.muted = isLocal || audioBlocked;
    videoRef.current.play().catch(() => {});
  }, [participant.stream, isLocal, audioBlocked]);

  const unblockAudio = () => {
    if (!videoRef.current || isLocal) return;
    videoRef.current.muted = false;
    videoRef.current.play().catch(() => {});
    setAudioBlocked(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden mb-2">
      <div className="relative cursor-pointer" onClick={unblockAudio}>
        {participant.stream ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-28 object-cover bg-black" />
        ) : (
          <div className="w-full h-16 bg-gray-700 flex items-center justify-center text-3xl">📷</div>
        )}
        {!isLocal && audioBlocked && participant.stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <span className="text-white text-xs bg-black bg-opacity-80 px-2 py-1 rounded text-center">🔇 Tocá para escuchar</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-2 py-1">
        <p className="text-white text-xs truncate">{isLocal ? 'Vos' : participant.name}</p>
        {onMute && !isLocal && (
          <button onClick={onMute} className="text-red-400 text-xs hover:text-red-300">🔇</button>
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
}

export function ParticipantsColumn({ participants, localStream, localName, onMuteParticipant }: ParticipantsColumnProps) {
  const hasContent = participants.length > 0 || localStream;
  if (!hasContent) return null;

  const localParticipant: Participant | null = localStream ? {
    number: 'local', name: localName || 'Vos', sessionId: '', trackNames: [], stream: localStream,
  } : null;

  const total = participants.length + (localParticipant ? 1 : 0);

  return (
    <div className="w-44 flex-shrink-0">
      <p className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wide">👥 En vivo ({total})</p>
      {localParticipant && <ParticipantCard participant={localParticipant} isLocal={true} />}
      {participants.map(p => (
        <ParticipantCard
          key={p.number}
          participant={p}
          isLocal={false}
          onMute={onMuteParticipant ? () => onMuteParticipant(p.number) : undefined}
        />
      ))}
    </div>
  );
}
