import { NextResponse } from 'next/server';
import { revokeSession } from '@/lib/session';

export async function POST() {
  await revokeSession();
  return NextResponse.json({ success: true });
}
