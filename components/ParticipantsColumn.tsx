'use client';

import { useRef, useEffect } from 'react';
import { Participant } from '@/lib/useSFU';

function ParticipantCard({ participant }: { participant: Participant }) {
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
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-28 object-cover bg-black" />
      ) : (
        <div className="w-full h-16 bg-gray-700 flex items-center justify-center">
          <span className="text-3xl">📷</span>
        </div>
      )}
      <p className="text-white text-xs text-center py-1 px-2 truncate">{participant.name}</p>
    </div>
  );
}

export function ParticipantsColumn({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) return null;

  return (
    <div className="w-44 flex-shrink-0">
      <p className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wide">
        👥 En vivo ({participants.length})
      </p>
      {participants.map(p => (
        <ParticipantCard key={p.number} participant={p} />
      ))}
    </div>
  );
}
