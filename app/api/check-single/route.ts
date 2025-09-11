import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { urlFrom, urlTo, anchorText } = await request.json();
    
    if (!urlFrom || !urlTo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Since we're running everything on the same server, use localhost
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/api/check-single`, {
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
