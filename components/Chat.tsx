'use client';

import { useEffect, useRef, useState } from 'react';

interface Message { text: string; from: string; }

interface ChatProps {
  messages: Message[];
  onSend: (text: string) => void;
  myName?: string;
}

export function Chat({ messages, onSend, myName = 'Yo' }: ChatProps) {
  const chatRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [unread, setUnread] = useState(0);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  // Auto-scroll cuando llega mensaje nuevo
  useEffect(() => {
    if (!chatRef.current) return;
    const el = chatRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;

    if (isAtBottom || !isScrolledUp) {
      el.scrollTop = el.scrollHeight;
      setUnread(0);
    } else {
      setUnread(prev => prev + 1);
    }
  }, [messages]);

  const handleScroll = () => {
    if (!chatRef.current) return;
    const el = chatRef.current;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setIsScrolledUp(!isAtBottom);
    if (isAtBottom) setUnread(0);
  };

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
      setUnread(0);
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white font-bold">💬 Chat en vivo</p>
        {unread > 0 && (
          <button
            onClick={scrollToBottom}
            className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full animate-bounce"
          >
            ↓ {unread} nuevo{unread > 1 ? 's' : ''}
          </button>
        )}
      </div>

      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="h-40 overflow-y-auto mb-2 space-y-1 scroll-smooth"
      >
        {messages.length === 0
          ? <p className="text-gray-500 text-sm">Sin mensajes aún...</p>
          : messages.map((m, i) => (
            <p key={i} className="text-white text-sm">
              <span className={`font-bold ${m.from === myName ? 'text-green-400' : 'text-blue-400'}`}>
                {m.from}:
              </span>{' '}
              {m.text}
            </p>
          ))
        }
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Escribí un mensaje..."
          className="flex-1 bg-gray-700 text-white px-3 py-2 rounded text-sm outline-none"
        />
        <button
          onClick={handleSend}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
