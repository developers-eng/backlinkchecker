import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { urlFrom, urlTo, anchorText } = await request.json();
    
    if (!urlFrom || !urlTo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // Forward the request to the backend server
    const response = await fetch(`${backendUrl}/api/check-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urlFrom,
        urlTo,
        anchorText: anchorText || '',
      }),
    });

    const result = await response.json();
    
    return NextResponse.json(result, { status: response.status });
    
  } catch (error) {
    console.error('Error checking backlink:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
