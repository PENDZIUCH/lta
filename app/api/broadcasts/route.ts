// app/api/broadcasts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Store en memoria (edge - se resetea por instancia)
const broadcasts = new Map<string, any>();

export async function GET() {
  return NextResponse.json(Array.from(broadcasts.values()));
}

export async function POST(request: NextRequest) {
  const { broadcasterId } = await request.json();
  const id = Math.random().toString(36).slice(2);
  const broadcast = { id, broadcasterId, startedAt: Date.now() };
  broadcasts.set(id, broadcast);
  return NextResponse.json(broadcast);
}
