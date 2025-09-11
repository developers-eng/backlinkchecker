import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const authSession = cookieStore.get('auth-session');

    const isAuthenticated = authSession?.value === 'authenticated';

    return NextResponse.json({ 
      authenticated: isAuthenticated 
    });
  } catch (error) {
    return NextResponse.json({ 
      authenticated: false 
    });
  }
}