// app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BroadcastList } from '@/components/BroadcastList';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function startBroadcast() {
    setLoading(true);
    try {
      const broadcasterId = Math.random().toString(36).slice(2);
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcasterId }),
      });
      const broadcast = await res.json();
      router.push(`/broadcast/${broadcast.id}`);
    } catch (err) {
      console.error('Error:', err);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2">🎬 Live Tango App</h1>
          <p className="text-gray-400 text-lg">Transmite y mira streams en vivo de forma anónima</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <button
            onClick={startBroadcast}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-8 rounded-lg font-bold text-xl transition"
          >
            {loading ? '⏳ Iniciando...' : '🎥 Transmitir'}
          </button>
          <div className="bg-blue-600 text-white py-8 rounded-lg font-bold text-xl text-center">
            👀 Ver Streams Abajo
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">📺 Transmisiones en Vivo</h2>
          <BroadcastList />
        </div>
      </div>
    </div>
  );
}
