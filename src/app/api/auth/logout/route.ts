import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('nutrisnap_session_id');
  return response;
}
