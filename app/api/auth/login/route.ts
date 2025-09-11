import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Fallback credentials for Render deployment
    const appUser = process.env.APP_USER || 'madx';
    const appPassword = process.env.APP_PW || 'As0YlmF3[9\\4';

    console.log('Auth attempt:', {
      hasAppUser: !!appUser,
      hasAppPassword: !!appPassword,
      appUser: appUser ? appUser.substring(0, 2) + '***' : 'undefined',
      nodeEnv: process.env.NODE_ENV,
      providedUsername: username ? username.substring(0, 2) + '***' : 'undefined'
    });

    if (username === appUser && password === appPassword) {
      try {
        // Set a session cookie
        const cookieStore = cookies();
        cookieStore.set('auth-session', 'authenticated', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60, // 24 hours
          path: '/',
        });

        console.log('Login successful, cookie set');
        return NextResponse.json({ success: true });
      } catch (cookieError) {
        console.error('Error setting cookie:', cookieError);
        return NextResponse.json({ success: true }); // Still return success even if cookie fails
      }
    } else {
      console.log('Invalid credentials provided');
      return NextResponse.json(
        { success: false, message: 'Invalid username or password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}