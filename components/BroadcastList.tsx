// components/BroadcastList.tsx
'use client';

import { useEffect, useState } from 'react';
import { Broadcast } from '@/lib/types';
import Link from 'next/link';

export function BroadcastList() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBroadcasts() {
      try {
        const res = await fetch('/api/broadcasts');
        const data = await res.json();
        setBroadcasts(data);
      } catch (err) {
        console.error('Error fetching broadcasts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchBroadcasts();
    const interval = setInterval(fetchBroadcasts, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {broadcasts.length === 0 ? (
        <p className="text-gray-500 col-span-full text-center py-8">
          {loading ? 'Cargando...' : 'No hay transmisiones activas'}
        </p>
      ) : (
        broadcasts.map((broadcast) => (
          <Link key={broadcast.id} href={`/watch/${broadcast.id}`}>
            <div className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800 cursor-pointer transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {broadcast.title || 'Stream Anónimo'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {broadcast.broadcasterId.slice(0, 8)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-sm font-bold">EN VIVO</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                👥 {broadcast.viewerCount} viéndolo
              </p>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
